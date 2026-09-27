const { pool } = require('./shared');

const transferCommissionToPayroll = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const companyId = req.company_id || req.user?.company_id;
        const { commission_id, seller_id, year, month, quincena = 'segunda' } = req.body;

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

        if (['transferido_planilla', 'pagado'].includes(comm.status)) {
            await connection.commit(); return res.json({ success: true, already_transferred: true, planilla_id: comm.transferred_to_planilla_id });
        }
        const [other] = await connection.query("SELECT id FROM egg_seller_commissions WHERE company_id = ? AND seller_id = ? AND period_year = ? AND period_month = ? AND id != ? AND status IN ('transferido_planilla', 'pagado')", [companyId, comm.seller_id, comm.period_year, comm.period_month, comm.id]);
        if (other.length) { await connection.rollback(); return res.status(409).json({ message: 'Este mes ya tiene una comisión transferida. Concilie la liquidación existente.' }); }
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

        // 3. Buscar planilla abierta para este empleado en el período indicado
        const [planillaRows] = await connection.query(
            `SELECT * FROM rh_planillas
             WHERE company_id = ? AND empleado_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? FOR UPDATE`,
            [companyId, comm.employee_id, comm.period_year, comm.period_month, comm.quincena]
        );

        let planillaId;
        if (planillaRows.length > 0) {
            if (planillaRows[0].estado === 'pagada') {
                await connection.rollback();
                return res.status(400).json({ message: 'La planilla para este período ya fue PAGADA y CERRADA. No se puede modificar.' });
            }
            planillaId = planillaRows[0].id;
        } else {
            // Obtener sueldo base del empleado
            const [emp] = await connection.query(
                `SELECT sueldo_base, bonificacion_fija FROM rh_empleados WHERE id = ? AND company_id = ?`,
                [comm.employee_id, companyId]
            );
            const sueldoBase = parseFloat(emp[0]?.sueldo_base || 0);
            const bonifFija = parseFloat(emp[0]?.bonificacion_fija || 0);

            const [newPlanilla] = await connection.query(
                `INSERT INTO rh_planillas
                    (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija, estado)
                 VALUES (?, ?, ?, ?, ?, 15, ?, ?, 'pendiente')`,
                [companyId, comm.employee_id, comm.period_year, comm.period_month, comm.quincena, sueldoBase, bonifFija]
            );
            planillaId = newPlanilla.insertId;
        }

        // 4. Inyectar o actualizar detalle de comisión en rh_planilla_detalles
        const [existingDetail] = await connection.query(
            `SELECT id FROM rh_planilla_detalles WHERE planilla_id = ? AND cuenta_id = ?`,
            [planillaId, cuentaComisiones.id]
        );

        if (existingDetail.length > 0) {
            await connection.query(
                `UPDATE rh_planilla_detalles
                 SET valor_ingresado = ?, valor_base = ?
                 WHERE id = ?`,
                [commissionAmount, commissionAmount, existingDetail[0].id]
            );
        } else {
            await connection.query(
                `INSERT INTO rh_planilla_detalles
                    (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
                 VALUES (?, ?, ?, ?, 'sumar', 'valor', ?, ?, 7)`,
                [planillaId, cuentaComisiones.id, cuentaComisiones.codigo, cuentaComisiones.descripcion, commissionAmount, commissionAmount]
            );
        }

        // 5. Recalcular percepciones y total de la planilla
        const [detalles] = await connection.query(
            `SELECT operacion, valor_ingresado FROM rh_planilla_detalles WHERE planilla_id = ?`,
            [planillaId]
        );

        let percepciones = 0;
        let deducciones = 0;
        detalles.forEach(d => {
            const val = parseFloat(d.valor_ingresado || 0);
            if (d.operacion === 'sumar') percepciones += val;
            else deducciones += val;
        });

        const [pInfo] = await connection.query(`SELECT sueldo_base FROM rh_planillas WHERE id = ?`, [planillaId]);
        const sBaseQuincena = (parseFloat(pInfo[0]?.sueldo_base || 0) / 2);
        const totalPercepciones = Math.round((sBaseQuincena + percepciones) * 100) / 100;
        const totalDeducciones = Math.round(deducciones * 100) / 100;
        const montoRecibir = Math.max(0, Math.round((totalPercepciones - totalDeducciones) * 100) / 100);

        await connection.query(
            `UPDATE rh_planillas
             SET total_percepciones = ?, total_deducciones = ?, monto_recibir = ?, updated_at = NOW()
             WHERE id = ?`,
            [totalPercepciones, totalDeducciones, montoRecibir, planillaId]
        );

        // 6. Actualizar estado en egg_seller_commissions
        await connection.query(
            `UPDATE egg_seller_commissions
             SET status = 'transferido_planilla', transferred_to_planilla_id = ?, transferred_at = NOW()
             WHERE id = ?`,
            [planillaId, comm.id]
        );

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
        res.status(500).json({ message: error.message });
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
