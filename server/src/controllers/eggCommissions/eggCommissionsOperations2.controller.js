const { pool } = require('./shared');
const { assertPayrollPeriodEditable, applyCommissionToPayroll } = require('../../services/rhPayroll/commissionPayroll.service');

const transferCommissionToPayroll = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        const { commission_id, seller_id, year, month, quincena = 'segunda' } = req.body;
        const [companies] = await connection.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [companyId]);
        if (!companies.length) {
            await connection.rollback();
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        // Mismo orden de bloqueo que el cálculo: vendedor, luego liquidación.
        let lockSellerId = seller_id;
        if (commission_id) {
            const [owner] = await connection.query('SELECT seller_id FROM egg_seller_commissions WHERE id = ? AND company_id = ?', [commission_id, companyId]);
            lockSellerId = owner[0]?.seller_id;
        }
        if (lockSellerId) await connection.query('SELECT id FROM sellers WHERE id = ? AND company_id = ? FOR UPDATE', [lockSellerId, companyId]);
        // 1. Obtener registro de comisión
        let comm;
        if (commission_id) {
            const [rows] = await connection.query(
                `SELECT * FROM egg_seller_commissions WHERE id = ? AND company_id = ? FOR UPDATE`,
                [commission_id, companyId]
            );
            comm = rows[0];
        } else if (seller_id && year && month) {
            const [rows] = await connection.query(
                `SELECT * FROM egg_seller_commissions
                 WHERE seller_id = ? AND period_year = ? AND period_month = ? AND quincena = ? AND company_id = ? FOR UPDATE`,
                [seller_id, year, month, quincena, companyId]
            );
            comm = rows[0];
        }

        if (!comm) {
            await connection.rollback();
            return res.status(404).json({ message: 'No se encontró la liquidación de comisión especificada.' });
        }

        if (comm.status === 'pagado' || (comm.status === 'transferido_planilla' && comm.transferred_to_planilla_id)) {
            await connection.commit(); return res.json({ success: true, already_transferred: true, planilla_id: comm.transferred_to_planilla_id });
        }
        if (!comm.employee_id) {
            await connection.rollback();
            return res.status(400).json({
                message: 'El vendedor no tiene un Empleado de Planilla (RH) vinculado. Vincúlelo primero en el módulo de Vendedores.'
            });
        }

        const commissionAmount = parseFloat(comm.capped_commission_amount || 0);
        if (commissionAmount <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El monto de la comisión es $0.00. No hay saldo para transferir.' });
        }
        const payrollQuincena = comm.quincena === 'mensual' ? 'segunda' : comm.quincena;
        await assertPayrollPeriodEditable(connection, companyId, comm.period_year, comm.period_month, payrollQuincena);

        // 2. Localizar o asegurar cuenta de COMISIONES (código '07') en rh_cuentas_planillas
        const [cuentaRows] = await connection.query(
            `SELECT id, codigo, descripcion, operacion FROM rh_cuentas_planillas
             WHERE company_id = ? AND (codigo = '07' OR descripcion LIKE '%COMISION%')
             LIMIT 1`,
            [companyId]
        );
        let cuentaComisiones = cuentaRows[0];
        if (!cuentaComisiones) {
            const [newCuenta] = await connection.query(
                `INSERT INTO rh_cuentas_planillas
                    (company_id, codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden)
                 VALUES (?, '07', 'COMISIONES', 'sumar', 'valor', 1, 1, 1, 7)`,
                [companyId]
            );
            cuentaComisiones = { id: newCuenta.insertId, codigo: '07', descripcion: 'COMISIONES', operacion: 'sumar' };
        }

        const planillaId = await applyCommissionToPayroll(connection, companyId, comm, cuentaComisiones, payrollQuincena);

        await connection.commit();

        res.json({
            success: true,
            message: `Comisión de $${commissionAmount.toFixed(2)} transferida exitosamente a la Planilla #${planillaId} de Recursos Humanos.`,
            planilla_id: planillaId,
            commission_amount: commissionAmount
        });
    } catch (error) {
        await connection.rollback();
        console.error('[EggCommissions] Error in transferCommissionToPayroll:', error);
        res.status(error.statusCode || 500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const getCommissionsSummary = async (req, res) => {
    try {
        const companyId = req.company_id || req.user?.company_id;
        const { year, month } = req.query;

        const currentYear = parseInt(year) || new Date().getFullYear();
        const currentMonth = parseInt(month) || (new Date().getMonth() + 1);

        const [rows] = await pool.query(
            `SELECT c.*,
                    s.nombre as seller_name,
                    e.codigo as empleado_codigo,
                    CONCAT(e.nombres, ' ', e.apellidos) as empleado_nombre_completo,
                    e.sueldo_base as empleado_sueldo_base,
                    g.target_volume_lbs,
                    g.commission_cap_usd
             FROM egg_seller_commissions c
             JOIN sellers s ON c.seller_id = s.id
             LEFT JOIN rh_empleados e ON c.employee_id = e.id
             LEFT JOIN egg_seller_goals g
                    ON c.seller_id = g.seller_id
                   AND c.period_year = g.period_year
                   AND c.period_month = g.period_month
             WHERE c.company_id = ? AND c.period_year = ? AND c.period_month = ?
             ORDER BY s.nombre ASC, c.quincena ASC`,
            [companyId, currentYear, currentMonth]
        );

        res.json(rows);
    } catch (error) {
        console.error('[EggCommissions] Error in getCommissionsSummary:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { transferCommissionToPayroll, getCommissionsSummary };
