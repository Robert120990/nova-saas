const { TABLE, LABEL } = require('./shared');

const descontarCuotas = async (companyId, empleadoIds, quincena, pool) => {
    if (!empleadoIds || empleadoIds.length === 0) return;
    await pool.query(
        `UPDATE rh_empleado_descuentos
         SET activo = IF(cuotas_restantes <= 1, 0, activo),
             cuotas_restantes = GREATEST(0, cuotas_restantes - 1)
         WHERE company_id = ? 
           AND empleado_id IN (?)
           AND activo = 1 
           AND cuotas_restantes > 0
           AND (quincena = 'ambas' OR quincena = ?)`,
        [companyId, empleadoIds, quincena]
    );
};

const pagarPlanilla = async (req, res, pool, notificationService) => {
    try {
        const { id } = req.params;
        const [existing] = await pool.query(
            `SELECT empleado_id, quincena, estado FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (existing.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        if (existing[0].estado !== 'pagada') {
            await descontarCuotas(req.company_id, [existing[0].empleado_id], existing[0].quincena, pool);
        }

        await pool.query(
            `UPDATE ${TABLE} SET estado = 'pagada' WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );

        notificationService.notify('payroll_closed', req.company_id, req.user?.branch_id, {
            tipo_planilla: 'quincenal',
            periodo: '',
            total_empleados: 1,
            total_pagado: 0,
            fecha_pago: new Date().toISOString().split('T')[0]
        }).catch(() => {});

        res.json({ message: 'Planilla marcada como pagada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const cerrarPeriodo = async (req, res, pool) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        const [pendientes] = await pool.query(
            `SELECT DISTINCT empleado_id FROM ${TABLE} 
             WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? AND estado != 'pagada'`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        if (pendientes.length > 0) {
            const empIds = pendientes.map(p => p.empleado_id);
            await descontarCuotas(req.company_id, empIds, quincena, pool);
        }

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET estado = 'pagada' WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        res.json({ message: `Periodo cerrado exitosamente`, total: result.affectedRows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const eliminarPeriodo = async (req, res, pool) => {
    try {
        const { periodo_anio, periodo_mes, quincena } = req.body;
        if (!periodo_anio || !periodo_mes || !quincena) {
            return res.status(400).json({ message: 'periodo_anio, periodo_mes y quincena requeridos' });
        }

        const [pagadas] = await pool.query(
            `SELECT DISTINCT empleado_id FROM ${TABLE} 
             WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? AND estado = 'pagada'`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        if (pagadas.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar un período que contiene planillas pagadas. Se debe conservar el historial de pagos.' });
        }

        const [result] = await pool.query(
            `DELETE FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
            [req.company_id, periodo_anio, periodo_mes, quincena]
        );

        res.json({ message: `Período eliminado exitosamente`, total: result.affectedRows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { descontarCuotas, pagarPlanilla, cerrarPeriodo, eliminarPeriodo };
