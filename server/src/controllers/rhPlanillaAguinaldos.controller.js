const pool = require('../config/db');
const notificationService = require('../services/notification.service');

const TABLE = 'rh_planilla_aguinaldos';

const getResumen = async (req, res) => {
    try {
        const { año } = req.query;
        let query = `
            SELECT pa.periodo_año, pa.periodo_mes, pa.filtro_departamento_id,
                   d.descripcion as departamento_nombre,
                   COUNT(*) as total_empleados,
                   SUM(pa.monto_recibir) as total_monto
            FROM rh_planilla_aguinaldos pa
            LEFT JOIN rh_departamentos d ON pa.filtro_departamento_id = d.id
            WHERE pa.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pa.periodo_año = ?`;
            params.push(parseInt(año));
        }

        query += ` GROUP BY pa.periodo_año, pa.periodo_mes, pa.filtro_departamento_id, d.descripcion
                   ORDER BY pa.periodo_año DESC, pa.periodo_mes DESC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPlanilla = async (req, res) => {
    try {
        const { año, mes, departamento_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pa.*, 
                   e.codigo,
                   e.nombres,
                   e.apellidos,
                   e.num_nit,
                   e.cuenta_planillera,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} pa
            JOIN rh_empleados e ON pa.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pa.company_id = ? AND pa.periodo_año = ?
        `;
        let params = [req.company_id, parseInt(año)];

        if (mes) {
            query += ` AND pa.periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (departamento_id) {
            query += ` AND pa.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }

        query += ` ORDER BY e.codigo ASC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const calcular = async (req, res) => {
    try {
        const { año, mes, departamento_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        const anio = parseInt(año);
        const mesNum = parseInt(mes) || 12;
        const periodStart = `${anio - 1}-12-12`;
        const periodEnd = `${anio}-12-12`;

        // Get active aguinaldo config
        const today = new Date().toISOString().split('T')[0];
        const [configRows] = await pool.query(
            `SELECT ac.id FROM rh_aguinaldo_config ac
             WHERE ac.company_id = ? AND ac.fecha_desde <= ? AND (ac.fecha_hasta IS NULL OR ac.fecha_hasta >= ?)
             ORDER BY ac.fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );

        let detalles = [];
        if (configRows.length > 0) {
            const [detRows] = await pool.query(
                `SELECT anios_desde, anios_hasta, dias_aguinaldo FROM rh_aguinaldo_config_detalle
                 WHERE aguinaldo_config_id = ? ORDER BY anios_desde ASC`,
                [configRows[0].id]
            );
            detalles = detRows;
        }

        // Get active employees
        let empQuery = `
            SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.fecha_ingreso,
                   e.departamento_personal_id, e.cargo_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.company_id = ? AND e.es_activo = 1
        `;
        let params = [req.company_id];

        if (departamento_id) {
            empQuery += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }

        empQuery += ` ORDER BY e.codigo ASC`;
        const [empleados] = await pool.query(empQuery, params);

        const results = [];

        for (const emp of empleados) {
            // Find last indemnizacion date
            const [liqRows] = await pool.query(
                `SELECT MAX(periodo_indemnizacion_hasta) as ultima_indemnizacion
                 FROM rh_planilla_liquidaciones
                 WHERE empleado_id = ? AND company_id = ? AND periodo_indemnizacion_hasta IS NOT NULL`,
                [emp.id, req.company_id]
            );
            const ultimaIndemnizacion = liqRows[0]?.ultima_indemnizacion || null;

            const fechaBase = ultimaIndemnizacion
                ? new Date(ultimaIndemnizacion)
                : (emp.fecha_ingreso ? new Date(emp.fecha_ingreso) : null);

            if (!fechaBase) continue;

            const pEnd = new Date(periodEnd);
            const pStart = new Date(periodStart);

            // Días de antigüedad (desde fecha_base hasta period_end)
            const diasAntiguedad = Math.max(0, Math.ceil((pEnd - fechaBase) / (1000 * 60 * 60 * 24)) + 1);
            const aniosServicio = Math.floor(diasAntiguedad / 365);

            // Find matching dias_segun_tabla from config
            let diasSegunTabla = 0;
            if (detalles.length > 0) {
                const match = detalles.find(d => aniosServicio >= d.anios_desde && aniosServicio <= d.anios_hasta);
                if (match) {
                    diasSegunTabla = parseFloat(match.dias_aguinaldo);
                } else if (aniosServicio < detalles[0].anios_desde) {
                    diasSegunTabla = parseFloat(detalles[0].dias_aguinaldo);
                } else {
                    diasSegunTabla = parseFloat(detalles[detalles.length - 1].dias_aguinaldo);
                }
            }

            // Proportional calculation
            const sueldo = parseFloat(emp.sueldo_base) || 0;
            const aguinaldoCompleto = sueldo > 0 ? (sueldo / 30) * diasSegunTabla : 0;

            // Days worked in this period
            const effectiveStart = fechaBase > pStart ? fechaBase : pStart;
            const diasLaborados = Math.max(0, Math.ceil((pEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1);
            const totalPeriodDays = Math.ceil((pEnd - pStart) / (1000 * 60 * 60 * 24)) + 1;
            const proporcion = totalPeriodDays > 0 ? diasLaborados / totalPeriodDays : 1;

            const aguinaldoCalculado = Math.round(aguinaldoCompleto * proporcion * 100) / 100;
            const excedente = Math.max(0, aguinaldoCalculado - 1500);
            const renta = Math.round(excedente * 0.10 * 100) / 100;
            const montoRecibir = Math.round((aguinaldoCalculado - renta) * 100) / 100;

            results.push({
                empleado_id: emp.id,
                codigo: emp.codigo,
                nombres: emp.nombres,
                apellidos: emp.apellidos,
                cargo_nombre: emp.cargo_nombre || '',
                departamento_nombre: emp.departamento_nombre || '',
                departamento_personal_id: emp.departamento_personal_id,
                sueldo_base: sueldo,
                fecha_ingreso: emp.fecha_ingreso,
                fecha_base: fechaBase.toISOString().substring(0, 10),
                dias_antiguedad: diasAntiguedad,
                dias_segun_tabla: diasSegunTabla,
                aguinaldo_calculado: aguinaldoCalculado,
                excedente,
                renta,
                monto_recibir: montoRecibir
            });
        }

        res.json(results);
    } catch (error) {
        console.error('[Aguinaldos calcular] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

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

const exportPDF = async (req, res) => {
    try {
        const { año, mes, departamento_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pa.*, e.codigo, e.nombres, e.apellidos,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit, comp.logo_url
            FROM ${TABLE} pa
            JOIN rh_empleados e ON pa.empleado_id = e.id
            JOIN companies comp ON pa.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pa.company_id = ? AND pa.periodo_año = ? AND pa.periodo_mes = ?
        `;
        let params = [req.company_id, parseInt(año), parseInt(mes) || 12];

        if (departamento_id && departamento_id !== '0') {
            query += ` AND pa.filtro_departamento_id = ?`;
            params.push(parseInt(departamento_id));
        } else {
            query += ` AND pa.filtro_departamento_id IS NULL`;
        }

        query += ` ORDER BY d.descripcion, e.codigo`;
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });

        const months = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        const depLabel = departamento_id && departamento_id !== '0' ? (rows[0]?.departamento_nombre || '') : 'Todos';

        const { generateAguinaldoPDF } = require('../services/pdf.service');
        const pdfData = {
            company_name: rows[0]?.company_name || '',
            company_nit: rows[0]?.company_nit || '',
            logo_url: rows[0]?.logo_url || '',
            periodo_label: `${months[parseInt(mes) || 12]} ${año}`,
            departamento_label: depLabel,
            items: rows
        };

        const pdfBuffer = await generateAguinaldoPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Aguinaldos_${año}_${mes || 12}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Aguinaldos PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

const exportRecibos = async (req, res) => {
    try {
        const { año, mes, departamento_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pa.*, e.codigo, e.nombres, e.apellidos,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit, comp.logo_url
            FROM ${TABLE} pa
            JOIN rh_empleados e ON pa.empleado_id = e.id
            JOIN companies comp ON pa.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pa.company_id = ? AND pa.periodo_año = ? AND pa.periodo_mes = ?
        `;
        let params = [req.company_id, parseInt(año), parseInt(mes) || 12];

        if (departamento_id && departamento_id !== '0') {
            query += ` AND pa.filtro_departamento_id = ?`;
            params.push(parseInt(departamento_id));
        } else {
            query += ` AND pa.filtro_departamento_id IS NULL`;
        }

        query += ` ORDER BY d.descripcion, e.codigo`;
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });

        let responsable = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) responsable = rhCfg[0].responsable_nombre;
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        const { generateAguinaldoRecibosPDF } = require('../services/pdf.service');
        const pdfData = {
            company_name: rows[0]?.company_name || '',
            company_nit: rows[0]?.company_nit || '',
            logo_url: rows[0]?.logo_url || '',
            responsable_nombre: responsable,
            firma_url: firmaUrl,
            sello_url: selloUrl,
            año: parseInt(año),
            items: rows
        };

        const pdfBuffer = await generateAguinaldoRecibosPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Recibos_Aguinaldos_${año}_${mes || 12}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Aguinaldos Recibos] Error:', error);
        res.status(500).json({ message: 'Error al generar recibos' });
    }
};

module.exports = { getResumen, getPlanilla, calcular, savePlanilla, deletePeriodo, exportPDF, exportRecibos };
