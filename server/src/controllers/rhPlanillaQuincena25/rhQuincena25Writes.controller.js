const pool = require('../../config/db');
const TABLE = 'rh_planilla_quincena25';
const notificationService = require('../../services/notification.service');
const { httpError, validateEmployeeBatch, assertQuincena25Editable } = require('../../services/rhPayroll/rhIntegrity.service');

const savePlanilla = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { año, items, filtro_departamento_id, estado = 'borrador' } = req.body;
        if (!año || !items || !items.length) {
            return res.status(400).json({ message: 'año e items requeridos' });
        }

        const anio = parseInt(año);

        for (const item of items) {
            const montoQ25 = parseFloat(item.monto_quincena25 || 0);
            const ajuste = parseFloat(item.ajuste || 0);
            const netoRecibir = Math.round((montoQ25 + ajuste) * 100) / 100;

            await connection.query(
                `INSERT INTO ${TABLE} 
                 (company_id, empleado_id, departamento_personal_id, branch_id, filtro_departamento_id,
                  periodo_anio, sueldo_base, fecha_ingreso, fecha_base, dias_laborados_anio,
                  es_proporcional, monto_quincena25, ajuste, monto_recibir, observaciones, estado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                  departamento_personal_id = VALUES(departamento_personal_id),
                  branch_id = VALUES(branch_id),
                  filtro_departamento_id = VALUES(filtro_departamento_id),
                  sueldo_base = VALUES(sueldo_base),
                  fecha_ingreso = VALUES(fecha_ingreso),
                  fecha_base = VALUES(fecha_base),
                  dias_laborados_anio = VALUES(dias_laborados_anio),
                  es_proporcional = VALUES(es_proporcional),
                  monto_quincena25 = VALUES(monto_quincena25),
                  ajuste = VALUES(ajuste),
                  monto_recibir = VALUES(monto_recibir),
                  observaciones = VALUES(observaciones),
                  estado = VALUES(estado)`,
                [
                    req.company_id,
                    item.empleado_id,
                    item.departamento_personal_id || null,
                    item.branch_id || null,
                    filtro_departamento_id || null,
                    anio,
                    parseFloat(item.sueldo_base || 0),
                    item.fecha_ingreso || null,
                    item.fecha_base || null,
                    parseInt(item.dias_laborados_anio || 0),
                    item.es_proporcional ? 1 : 0,
                    montoQ25,
                    ajuste,
                    netoRecibir,
                    item.observaciones || null,
                    estado
                ]
            );
        }

        await connection.commit();

        notificationService.notify('bonus_payroll_generated', req.company_id, req.user?.branch_id, {
            periodo: `Quincena 25 / ${anio}`,
            total_empleados: items.length,
            total_pagar: items.reduce((s, i) => s + parseFloat(i.monto_recibir || 0), 0),
            fecha_generacion: new Date().toISOString().split('T')[0]
        }).catch(() => {});

        res.json({ message: 'Planilla 25 guardada exitosamente' });
    } catch (error) {
        await connection.rollback();
        console.error('[Quincena25 save] Error:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const cerrarPeriodo = async (req, res) => {
    try {
        const { año } = req.body;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        const [result] = await pool.query(
            `UPDATE ${TABLE} 
             SET estado = 'pagada', fecha_pago = CURDATE()
             WHERE company_id = ? AND periodo_anio = ?`,
            [req.company_id, parseInt(año)]
        );

        res.json({ message: `Período ${año} cerrado con éxito. Registros actualizados: ${result.affectedRows}` });
    } catch (error) {
        console.error('[Quincena25 cerrarPeriodo] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const reabrirPeriodo = async (req, res) => {
    try {
        const { año } = req.body;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        const [result] = await pool.query(
            `UPDATE ${TABLE} 
             SET estado = 'borrador', fecha_pago = NULL
             WHERE company_id = ? AND periodo_anio = ?`,
            [req.company_id, parseInt(año)]
        );

        res.json({ message: `Período ${año} reabierto a borrador con éxito.` });
    } catch (error) {
        console.error('[Quincena25 reabrirPeriodo] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const deletePeriodo = async (req, res) => {
    try {
        const { año, departamento_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let sql = `DELETE FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ?`;
        let params = [req.company_id, parseInt(año)];

        if (departamento_id && departamento_id !== '0' && departamento_id !== 'all') {
            sql += ` AND filtro_departamento_id = ?`;
            params.push(parseInt(departamento_id));
        }

        const [result] = await pool.query(sql, params);
        res.json({ message: `${result.affectedRows} registros eliminados con éxito` });
    } catch (error) {
        console.error('[Quincena25 deletePeriodo] Error:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { savePlanilla, deletePeriodo, cerrarPeriodo, reabrirPeriodo };
