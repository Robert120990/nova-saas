const { cargarCuentasPorDefecto } = require('./defaults.service');
const { recalculateSavedPlanilla } = require('./calculation.service');
const { readRevision, ensureExpectedRevision } = require('./revision.service');
const { validateDetails } = require('./saveValidation.service');

async function replaceDetails(connection, id, details) {
    if (details === undefined) return;
    await connection.query('DELETE FROM rh_planilla_detalles WHERE planilla_id = ?', [id]);
    const values = details.map(detail => [
        id, detail.cuenta_id, detail.codigo, detail.descripcion, detail.operacion, detail.tipo_valor,
        detail.valor_base ?? detail.cantidad ?? null, detail.valor_ingresado ?? 0, detail.orden ?? 0
    ]);
    await connection.query(
        `INSERT INTO rh_planilla_detalles
         (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
         VALUES ?`, [values]
    );
}

function validDays(days, response) {
    if (days === undefined || (Number.isInteger(Number(days)) && Number(days) >= 0 && Number(days) <= 15)) return true;
    response.status(400).json({ message: 'Los días trabajados deben ser un entero entre 0 y 15.' });
    return false;
}

async function savedResponse(connection, id, companyId, response, status = 200) {
    const totals = await recalculateSavedPlanilla(connection, companyId, id);
    const revision = await readRevision(connection, id, companyId);
    response.status(status).json({ id, ...totals, revision });
}

const createPlanilla = async (req, res, connection) => {
    const { empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, detalles, expected_revision } = req.body;
    if (!periodo_anio || !periodo_mes || !['primera', 'segunda'].includes(quincena)) {
        return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
    }
    if (!validDays(dias_trabajados, res) || !await validateDetails(connection, req.company_id, detalles, res)) return;
    const [abiertas] = await connection.query(
        `SELECT id FROM rh_planillas WHERE company_id = ? AND estado != 'pagada'
         AND NOT (periodo_anio = ? AND periodo_mes = ? AND quincena = ?) LIMIT 1`,
        [req.company_id, periodo_anio, periodo_mes, quincena]
    );
    if (abiertas.length) return res.status(400).json({ message: 'Debe cerrar el período abierto antes de iniciar otro.' });
    const [cerradas] = await connection.query(
        `SELECT id FROM rh_planillas WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ?
         AND quincena = ? AND estado = 'pagada' LIMIT 1`, [req.company_id, periodo_anio, periodo_mes, quincena]
    );
    if (cerradas.length) return res.status(400).json({ message: 'No se puede modificar un período pagado y cerrado.' });
    const [employees] = await connection.query(
        'SELECT sueldo_base, bonificacion_fija FROM rh_empleados WHERE id = ? AND company_id = ?',
        [empleado_id, req.company_id]
    );
    if (!employees.length) return res.status(404).json({ message: 'Empleado no encontrado' });
    const [existing] = await connection.query(
        `SELECT id FROM rh_planillas WHERE company_id = ? AND empleado_id = ?
         AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
        [req.company_id, empleado_id, periodo_anio, periodo_mes, quincena]
    );
    const days = dias_trabajados ?? 15;
    const salary = Number(employees[0].sueldo_base || 0);
    const bonus = Number(employees[0].bonificacion_fija || 0);
    let id;
    if (existing.length) {
        id = existing[0].id;
        if (!await ensureExpectedRevision(connection, id, req.company_id, expected_revision, res)) return;
        await connection.query(
            `UPDATE rh_planillas SET dias_trabajados = ?, sueldo_base = ?, bonificacion_fija = ?, updated_at = NOW()
             WHERE id = ? AND company_id = ?`, [days, salary, bonus, id, req.company_id]
        );
    } else {
        if (expected_revision) return res.status(409).json({ message: 'La planilla ya no existe. Recargue el período antes de guardar.' });
        const [inserted] = await connection.query(
            `INSERT INTO rh_planillas
             (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [req.company_id, empleado_id, periodo_anio, periodo_mes, quincena, days, salary, bonus]
        );
        id = inserted.insertId;
    }
    await replaceDetails(connection, id, detalles);
    if (!existing.length && detalles === undefined) {
        await cargarCuentasPorDefecto(connection, id, req.company_id, days, salary, empleado_id, quincena, bonus);
    }
    await savedResponse(connection, id, req.company_id, res, existing.length ? 200 : 201);
};

const updatePlanilla = async (req, res, connection) => {
    const { id } = req.params;
    const { dias_trabajados, detalles, expected_revision } = req.body;
    const [existing] = await connection.query(
        'SELECT id, estado FROM rh_planillas WHERE id = ? AND company_id = ?', [id, req.company_id]
    );
    if (!existing.length) return res.status(404).json({ message: 'Planilla no encontrada' });
    if (existing[0].estado === 'pagada') return res.status(400).json({ message: 'No se puede modificar una planilla pagada y cerrada.' });
    if (!await ensureExpectedRevision(connection, id, req.company_id, expected_revision, res)) return;
    if (!validDays(dias_trabajados, res) || !await validateDetails(connection, req.company_id, detalles, res)) return;
    if (dias_trabajados !== undefined) {
        await connection.query(
            'UPDATE rh_planillas SET dias_trabajados = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
            [dias_trabajados, id, req.company_id]
        );
    }
    await replaceDetails(connection, id, detalles);
    await savedResponse(connection, id, req.company_id, res);
};

const deletePlanilla = async (req, res, connection) => {
    const { id } = req.params;
    const [rows] = await connection.query(
        'SELECT estado FROM rh_planillas WHERE id = ? AND company_id = ?', [id, req.company_id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Planilla no encontrada' });
    if (rows[0].estado === 'pagada') return res.status(400).json({ message: 'No se puede eliminar individualmente una planilla pagada y cerrada.' });
    await connection.query('DELETE FROM rh_planillas WHERE id = ? AND company_id = ?', [id, req.company_id]);
    res.json({ message: 'Planilla eliminada' });
};

module.exports = { createPlanilla, updatePlanilla, deletePlanilla };
