const pool = require('../../config/db');
const TABLE = 'rh_planilla_aguinaldos';
const notificationService = require('../../services/notification.service');
const { httpError, validateEmployeeBatch, assertQuincena25Editable } = require('../../services/rhPayroll/rhIntegrity.service');

const savePlanilla = async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { año, mes, items, filtro_departamento_id } = req.body;
        if (!año || !items || !items.length) {
            return res.status(400).json({ message: 'año e items requeridos' });
        }

        for (const item of items) {
            await connection.query(
                `INSERT INTO ${TABLE} 
                 (company_id, empleado_id, departamento_personal_id, filtro_departamento_id, periodo_año, periodo_mes,
                  sueldo_base, fecha_ingreso, fecha_base, dias_antiguedad, dias_segun_tabla,
                  aguinaldo_calculado, excedente, renta, monto_recibir)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                  departamento_personal_id = VALUES(departamento_personal_id),
                  filtro_departamento_id = VALUES(filtro_departamento_id),
                  sueldo_base = VALUES(sueldo_base),
                  fecha_ingreso = VALUES(fecha_ingreso),
                  fecha_base = VALUES(fecha_base),
                  dias_antiguedad = VALUES(dias_antiguedad),
                  dias_segun_tabla = VALUES(dias_segun_tabla),
                  aguinaldo_calculado = VALUES(aguinaldo_calculado),
                  excedente = VALUES(excedente),
                  renta = VALUES(renta),
                  monto_recibir = VALUES(monto_recibir)`,
                [req.company_id, item.empleado_id, item.departamento_personal_id || null,
                 filtro_departamento_id || null,
                 parseInt(año), parseInt(mes) || 12,
                 item.sueldo_base, item.fecha_ingreso, item.fecha_base,
                 item.dias_antiguedad, item.dias_segun_tabla,
                 item.aguinaldo_calculado, item.excedente, item.renta, item.monto_recibir]
            );
        }

        await connection.commit();
        notificationService.notify('bonus_payroll_generated', req.company_id, req.user?.branch_id, {
            periodo: `${mes || 12}/${año}`,
            total_empleados: items.length,
            total_pagar: items.reduce((s, i) => s + parseFloat(i.monto_recibir || 0), 0),
            fecha_generacion: new Date().toISOString().split('T')[0]
        }).catch(() => {});
        res.json({ message: 'Planilla guardada exitosamente' });
    } catch (error) {
        await connection.rollback();
        console.error('[Aguinaldos save] Error:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const deletePeriodo = async (req, res) => {
    try {
        const { año, mes, departamento_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let sql = `DELETE FROM ${TABLE} WHERE company_id = ? AND periodo_año = ?`;
        let params = [req.company_id, parseInt(año)];

        if (mes) {
            sql += ` AND periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (departamento_id && departamento_id !== '0') {
            sql += ` AND filtro_departamento_id = ?`;
            params.push(parseInt(departamento_id));
        } else {
            sql += ` AND filtro_departamento_id IS NULL`;
        }

        const [result] = await pool.query(sql, params);
        res.json({ message: `${result.affectedRows} registros eliminados` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = { savePlanilla, deletePeriodo };
