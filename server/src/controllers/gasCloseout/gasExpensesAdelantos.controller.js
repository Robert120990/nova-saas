const {
    pool,
    sendCloseoutToRrs,
    dteService,
    notificationService,
    dteValidoExistsSql,
    applyCloseoutLubricantsInventory,
    revertCloseoutLubricantsInventory,
    CLOSEOUT_SECTIONS,
    SECTION_BUSINESS_FIELDS,
    NUMERIC_FIELDS,
    formatItemLabel,
    getNaturalKey,
    enrichSectionRows,
    getSectionRows,
    fieldChanges,
    buildSectionDiff,
    summarizeDiff,
    logCloseoutChange,
    logSectionChange,
    toDateStr,
    recalcularTanquesPosteriores,
    recalcularLubricantesPosteriores,
    logDeleteRow
} = require('./gasCloseoutUtils');


// --- CATEGORÍAS DE GASTOS Y GASTOS DEL TURNO ---
exports.getExpenseCategories = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, name FROM gas_station_expense_categories WHERE company_id = ? AND branch_id = ? ORDER BY name`,
            [req.company_id, req.user.branch_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error getExpenseCategories:', error);
        res.status(500).json({ message: 'Error al obtener rubros' });
    }
};

exports.createExpenseCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Nombre es requerido' });
        const [result] = await pool.query(
            `INSERT INTO gas_station_expense_categories (company_id, branch_id, name) VALUES (?, ?, ?)`,
            [req.company_id, req.user.branch_id, name]
        );
        res.status(201).json({ id: result.insertId, name });
    } catch (error) {
        console.error('Error createExpenseCategory:', error);
        res.status(500).json({ message: 'Error al crear rubro' });
    }
};

exports.updateExpenseCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Nombre es requerido' });
        const [result] = await pool.query(
            `UPDATE gas_station_expense_categories SET name = ? WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [name, id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Rubro no encontrado' });
        res.json({ id: parseInt(id), name });
    } catch (error) {
        console.error('Error updateExpenseCategory:', error);
        res.status(500).json({ message: 'Error al actualizar rubro' });
    }
};

exports.deleteExpenseCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM gas_station_expense_categories WHERE id = ? AND company_id = ? AND branch_id = ?`,
            [id, req.company_id, req.user.branch_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Rubro no encontrado' });
        res.json({ message: 'Rubro eliminado' });
    } catch (error) {
        console.error('Error deleteExpenseCategory:', error);
        res.status(500).json({ message: 'Error al eliminar rubro' });
    }
};

// === Closeout Expenses ===

exports.getExpenses = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT e.*, p.nombre as proveedor_nombre, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_expenses e
            LEFT JOIN providers p ON e.provider_id = p.id
            LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = e.closeout_id AND cd.despachador_id = e.despachador_id
            WHERE e.closeout_id = ?
            ORDER BY e.id ASC
        `, [id]);
        const mapped = rows.map(e => ({
            ...e,
            proveedor: e.proveedor_nombre || e.proveedor
        }));
        res.json(mapped);
    } catch (error) {
        console.error('Error getExpenses:', error);
        res.status(500).json({ message: 'Error al obtener gastos' });
    }
};

exports.saveExpenses = async (req, res) => {
    try {
        const { id } = req.params;
        const { expenses } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'gastos');

        await pool.query(`DELETE FROM gas_station_closeout_expenses WHERE closeout_id = ?`, [id]);

        const invalidExpenses = expenses.filter(e => !e.despachador_id);
        if (invalidExpenses.length > 0) {
            return res.status(400).json({ message: 'Todos los gastos deben tener un despachador asignado' });
        }

        if (expenses && expenses.length > 0) {
            const providerIds = expenses.map(e => e.provider_id).filter(id => id);
            const providerMap = {};
            if (providerIds.length > 0) {
                const [providers] = await pool.query(
                    `SELECT id, nombre FROM providers WHERE id IN (?) AND company_id = ?`,
                    [providerIds, req.company_id]
                );
                providers.forEach(p => { providerMap[p.id] = p.nombre; });
            }

            const values = expenses.map(e => {
                const providerId = e.provider_id ? parseInt(e.provider_id) : null;
                const proveedor = providerId ? (providerMap[providerId] || '') : (e.proveedor || '');
                return [
                    parseInt(id),
                    e.rubro || '',
                    e.fecha || null,
                    e.documento || '',
                    e.tipo || 'ccf',
                    providerId,
                    proveedor,
                    parseFloat(e.valor) || 0,
                    e.despachador_id ? parseInt(e.despachador_id) : null,
                    e.comentario || ''
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_expenses (closeout_id, rubro, fecha, documento, tipo, provider_id, proveedor, valor, despachador_id, comentario) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT e.*, p.nombre as proveedor_nombre, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_expenses e
            LEFT JOIN providers p ON e.provider_id = p.id
            LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = e.closeout_id AND cd.despachador_id = e.despachador_id
            WHERE e.closeout_id = ?
            ORDER BY e.id ASC
        `, [id]);

        const mapped = remaining.map(e => ({
            ...e,
            proveedor: e.proveedor_nombre || e.proveedor
        }));

        if (isReabierto) {
            await logSectionChange(req, id, 'gastos', beforeRows, expenses);
        }

        res.json(mapped);
    } catch (error) {
        console.error('Error saveExpenses:', error);
        res.status(500).json({ message: 'Error al guardar gastos' });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id, expenseId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_expenses WHERE id = ? AND closeout_id = ?`,
                [expenseId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_expenses WHERE id = ? AND closeout_id = ?`,
            [expenseId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Gasto no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'gastos', deletedRow);
        res.json({ message: 'Gasto eliminado' });
    } catch (error) {
        console.error('Error deleteExpense:', error);
        res.status(500).json({ message: 'Error al eliminar gasto' });
    }
};

// === Closeout Remesas ===


// --- DESCUENTOS DEL TURNO ---
exports.getDescuentos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT d.*, desp.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), desp.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_descuentos d
            LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = d.closeout_id AND cd.despachador_id = d.despachador_id
            WHERE d.closeout_id = ?
            ORDER BY d.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getDescuentos:', error);
        res.status(500).json({ message: 'Error al obtener descuentos' });
    }
};

exports.saveDescuentos = async (req, res) => {
    try {
        const { id } = req.params;
        const { descuentos } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'descuentos');

        await pool.query(`DELETE FROM gas_station_closeout_descuentos WHERE closeout_id = ?`, [id]);

        const invalidDescuentos = descuentos.filter(d => !d.despachador_id);
        if (invalidDescuentos.length > 0) {
            return res.status(400).json({ message: 'Todos los descuentos deben tener un despachador asignado' });
        }

        if (descuentos && descuentos.length > 0) {
            const clienteIds = descuentos.filter(d => d.cliente_id).map(d => parseInt(d.cliente_id));
            const clienteMap = {};
            if (clienteIds.length > 0) {
                const [clientes] = await pool.query(
                    `SELECT id, nombre FROM customers WHERE id IN (?) AND company_id = ?`,
                    [clienteIds, req.company_id]
                );
                clientes.forEach(c => { clienteMap[c.id] = c.nombre; });
            }

            const values = descuentos.map(d => {
                const clienteId = d.cliente_id ? parseInt(d.cliente_id) : null;
                const clienteNombre = clienteId ? (clienteMap[clienteId] || '') : '';
                const cantidad = parseFloat(d.cantidad) || 0;
                const valor = parseFloat(d.valor) || 0;
                const total = cantidad * valor;
                return [
                    parseInt(id),
                    d.documento || '',
                    clienteId,
                    clienteNombre,
                    d.producto_codigo || '',
                    d.producto_descripcion || '',
                    cantidad,
                    valor,
                    total,
                    d.despachador_id ? parseInt(d.despachador_id) : null
                ];
            });
            await pool.query(
                `INSERT INTO gas_station_closeout_descuentos (closeout_id, documento, cliente_id, cliente_nombre, producto_codigo, producto_descripcion, cantidad, valor, total, despachador_id) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT d.*, desp.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), desp.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_descuentos d
            LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = d.closeout_id AND cd.despachador_id = d.despachador_id
            WHERE d.closeout_id = ?
            ORDER BY d.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'descuentos', beforeRows, descuentos);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveDescuentos:', error);
        res.status(500).json({ message: 'Error al guardar descuentos' });
    }
};

exports.deleteDescuento = async (req, res) => {
    try {
        const { id, descuentoId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_descuentos WHERE id = ? AND closeout_id = ?`,
                [descuentoId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_descuentos WHERE id = ? AND closeout_id = ?`,
            [descuentoId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Descuento no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'descuentos', deletedRow);
        res.json({ message: 'Descuento eliminado' });
    } catch (error) {
        console.error('Error deleteDescuento:', error);
        res.status(500).json({ message: 'Error al eliminar descuento' });
    }
};

// === Closeout Adelantos ===


// --- ADELANTOS DEL TURNO ---
exports.getAdelantos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT a.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_adelantos a
            LEFT JOIN gas_station_despachadores d ON a.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = a.closeout_id AND cd.despachador_id = a.despachador_id
            WHERE a.closeout_id = ?
            ORDER BY a.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getAdelantos:', error);
        res.status(500).json({ message: 'Error al obtener adelantos' });
    }
};

exports.saveAdelantos = async (req, res) => {
    try {
        const { id } = req.params;
        const { adelantos } = req.body;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        const isReabierto = closeouts[0].estado === 'reabierto';
        let beforeRows = [];
        if (isReabierto) beforeRows = await getSectionRows(id, 'adelantos');

        await pool.query(`DELETE FROM gas_station_closeout_adelantos WHERE closeout_id = ?`, [id]);

        const invalidAdelantos = adelantos.filter(a => !a.despachador_id);
        if (invalidAdelantos.length > 0) {
            return res.status(400).json({ message: 'Todos los adelantos deben tener un despachador asignado' });
        }

        if (adelantos && adelantos.length > 0) {
            const values = adelantos.map(a => [
                parseInt(id),
                a.empleado || '',
                parseFloat(a.monto) || 0,
                a.despachador_id ? parseInt(a.despachador_id) : null
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_adelantos (closeout_id, empleado, monto, despachador_id) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT a.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_adelantos a
            LEFT JOIN gas_station_despachadores d ON a.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = a.closeout_id AND cd.despachador_id = a.despachador_id
            WHERE a.closeout_id = ?
            ORDER BY a.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'adelantos', beforeRows, adelantos);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveAdelantos:', error);
        res.status(500).json({ message: 'Error al guardar adelantos' });
    }
};

exports.deleteAdelanto = async (req, res) => {
    try {
        const { id, adelantoId } = req.params;

        const [closeouts] = await pool.query(
            `SELECT estado, branch_id FROM gas_station_closeouts WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (closeouts.length === 0) return res.status(404).json({ message: 'Cierre no encontrado' });
        if (closeouts[0].estado === 'cerrado') {
            return res.status(400).json({ message: 'El cierre ya está cerrado' });
        }
        if (req.user.branch_id && closeouts[0].branch_id != req.user.branch_id) {
            return res.status(404).json({ message: 'Cierre no encontrado' });
        }

        let deletedRow = null;
        if (closeouts[0].estado === 'reabierto') {
            const [rows] = await pool.query(
                `SELECT * FROM gas_station_closeout_adelantos WHERE id = ? AND closeout_id = ?`,
                [adelantoId, id]
            );
            deletedRow = rows[0] || null;
        }

        const [result] = await pool.query(
            `DELETE FROM gas_station_closeout_adelantos WHERE id = ? AND closeout_id = ?`,
            [adelantoId, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Adelanto no encontrado' });
        if (deletedRow) await logDeleteRow(req, id, 'adelantos', deletedRow);
        res.json({ message: 'Adelanto eliminado' });
    } catch (error) {
        console.error('Error deleteAdelanto:', error);
        res.status(500).json({ message: 'Error al eliminar adelanto' });
    }
};

