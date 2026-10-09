const {
    pool,
    getSectionRows,
    logSectionChange,
    logDeleteRow
} = require('./gasCloseoutUtils');

// --- CHEQUES ---
exports.getCheques = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT ch.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_cheques ch
            LEFT JOIN gas_station_despachadores d ON ch.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = ch.closeout_id AND cd.despachador_id = ch.despachador_id
            WHERE ch.closeout_id = ?
            ORDER BY ch.id ASC
        `, [id]);
        res.json(rows);
    } catch (error) {
        console.error('Error getCheques:', error);
        res.status(500).json({ message: 'Error al obtener cheques' });
    }
};

exports.saveCheques = async (req, res) => {
    try {
        const { id } = req.params;
        const { cheques } = req.body;

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
        if (isReabierto) beforeRows = await getSectionRows(id, 'cheques');

        await pool.query(`DELETE FROM gas_station_closeout_cheques WHERE closeout_id = ?`, [id]);

        if (cheques && cheques.length > 0) {
            const invalidCheques = cheques.filter(c => !c.despachador_id);
            if (invalidCheques.length > 0) {
                return res.status(400).json({ message: 'Todos los cheques deben tener un despachador asignado' });
            }

            const values = cheques.map(c => [
                parseInt(id),
                c.numero_cheque || '',
                c.banco || '',
                c.despachador_id ? parseInt(c.despachador_id) : null,
                c.tipo_operacion || 'venta_combustible',
                parseFloat(c.monto) || 0
            ]);
            await pool.query(
                `INSERT INTO gas_station_closeout_cheques (closeout_id, numero_cheque, banco, despachador_id, tipo_operacion, monto) VALUES ?`,
                [values]
            );
        }

        const [remaining] = await pool.query(`
            SELECT ch.*, d.codigo as despachador_codigo, COALESCE(NULLIF(cd.nombre, ''), d.descripcion, '') as despachador_descripcion
            FROM gas_station_closeout_cheques ch
            LEFT JOIN gas_station_despachadores d ON ch.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = ch.closeout_id AND cd.despachador_id = ch.despachador_id
            WHERE ch.closeout_id = ?
            ORDER BY ch.id ASC
        `, [id]);

        if (isReabierto) {
            await logSectionChange(req, id, 'cheques', beforeRows, cheques);
        }

        res.json(remaining);
    } catch (error) {
        console.error('Error saveCheques:', error);
        res.status(500).json({ message: 'Error al guardar cheques' });
    }
};

exports.deleteCheque = async (req, res) => {
    try {
        const { id, chequeId } = req.params;

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
                `SELECT * FROM gas_station_closeout_cheques WHERE id = ? AND closeout_id = ?`,
                [chequeId, id]
            );
            deletedRow = rows[0] || null;
        }

        await pool.query(`DELETE FROM gas_station_closeout_cheques WHERE id = ? AND closeout_id = ?`, [chequeId, id]);
        if (deletedRow) await logDeleteRow(req, id, 'cheques', deletedRow);
        res.json({ message: 'Cheque eliminado' });
    } catch (error) {
        console.error('Error deleteCheque:', error);
        res.status(500).json({ message: 'Error al eliminar cheque' });
    }
};
