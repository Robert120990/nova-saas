const pool = require('../config/db');
const notificationService = require('../services/notification.service');
const reportPdfHelper = require('../utils/reportPdfHelper');
const { generateQuincena25PDF, generateQuincena25RecibosPDF } = require('../services/pdf.service');

const TABLE = 'rh_planilla_quincena25';
const LABEL = 'Planilla 25 (Quincena 25)';

const getResumen = async (req, res) => {
    try {
        const { año } = req.query;
        let query = `
            SELECT pq.periodo_anio, pq.filtro_departamento_id,
                   d.descripcion as departamento_nombre,
                   COUNT(*) as total_empleados,
                   SUM(CASE WHEN pq.monto_recibir > 0 THEN 1 ELSE 0 END) as total_beneficiarios,
                   SUM(pq.monto_recibir) as total_monto,
                   MAX(pq.estado) as estado,
                   MAX(pq.fecha_pago) as fecha_pago
            FROM ${TABLE} pq
            LEFT JOIN rh_departamentos d ON pq.filtro_departamento_id = d.id
            WHERE pq.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pq.periodo_anio = ?`;
            params.push(parseInt(año));
        }

        query += ` GROUP BY pq.periodo_anio, pq.filtro_departamento_id, d.descripcion
                   ORDER BY pq.periodo_anio DESC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('[Quincena25 getResumen] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const getPlanilla = async (req, res) => {
    try {
        const { año, departamento_id, branch_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pq.*, 
                   e.codigo,
                   e.nombres,
                   e.apellidos,
                   e.num_dui,
                   e.num_nit,
                   e.cuenta_planillera,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   b.nombre as sucursal_nombre
            FROM ${TABLE} pq
            JOIN rh_empleados e ON pq.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE pq.company_id = ? AND pq.periodo_anio = ?
        `;
        let params = [req.company_id, parseInt(año)];

        if (departamento_id && departamento_id !== 'all' && departamento_id !== '0') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }
        if (branch_id && branch_id !== 'all' && branch_id !== '0') {
            query += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        query += ` ORDER BY e.codigo ASC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('[Quincena25 getPlanilla] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const calcular = async (req, res) => {
    try {
        const { año, departamento_id, branch_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        const anio = parseInt(año);
        const fechaCorteAnterior = new Date(Date.UTC(anio - 1, 11, 31)); // 31 de Diciembre del año anterior
        const fechaInicioAnterior = new Date(Date.UTC(anio - 1, 0, 1));   // 1 de Enero del año anterior

        // Obtener empleados activos
        let empQuery = `
            SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.fecha_ingreso,
                   e.num_dui, e.num_nit, e.cuenta_planillera,
                   e.departamento_personal_id, e.cargo_id, e.branch_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   b.nombre as sucursal_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE e.company_id = ? AND e.es_activo = 1
        `;
        let params = [req.company_id];

        if (departamento_id && departamento_id !== 'all' && departamento_id !== '0') {
            empQuery += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }
        if (branch_id && branch_id !== 'all' && branch_id !== '0') {
            empQuery += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        empQuery += ` ORDER BY e.codigo ASC`;
        const [empleados] = await pool.query(empQuery, params);

        const results = [];

        for (const emp of empleados) {
            const sueldo = parseFloat(emp.sueldo_base || 0);

            // 1. Techo Legal: Salario mensual nominal <= $1,500.00
            if (sueldo > 1500.00) {
                results.push({
                    empleado_id: emp.id,
                    codigo: emp.codigo,
                    nombres: emp.nombres,
                    apellidos: emp.apellidos,
                    cargo_nombre: emp.cargo_nombre || 'GENERAL',
                    departamento_nombre: emp.departamento_nombre || 'GENERAL',
                    departamento_personal_id: emp.departamento_personal_id,
                    sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                    branch_id: emp.branch_id,
                    sueldo_base: sueldo,
                    fecha_ingreso: emp.fecha_ingreso,
                    fecha_base: emp.fecha_ingreso,
                    dias_laborados_anio: 0,
                    es_proporcional: 0,
                    monto_quincena25: 0,
                    ajuste: 0,
                    monto_recibir: 0,
                    aplica: false,
                    motivo_exclusion: 'Excluido por techo legal de Ley (Sueldo mayor a $1,500.00)',
                    observaciones: 'Excluido por Ley D.L. 499 (Sueldo > $1,500.00)'
                });
                continue;
            }

            // 2. Determinar fecha base (última liquidación si aplica, o fecha de ingreso)
            const [liqRows] = await pool.query(
                `SELECT MAX(periodo_indemnizacion_hasta) as ultima_indemnizacion
                 FROM rh_planilla_liquidaciones
                 WHERE empleado_id = ? AND company_id = ? AND periodo_indemnizacion_hasta IS NOT NULL`,
                [emp.id, req.company_id]
            );
            const ultimaIndemnizacion = liqRows[0]?.ultima_indemnizacion || null;
            const rawFechaBase = ultimaIndemnizacion || emp.fecha_ingreso;

            if (!rawFechaBase) {
                results.push({
                    empleado_id: emp.id,
                    codigo: emp.codigo,
                    nombres: emp.nombres,
                    apellidos: emp.apellidos,
                    cargo_nombre: emp.cargo_nombre || 'GENERAL',
                    departamento_nombre: emp.departamento_nombre || 'GENERAL',
                    departamento_personal_id: emp.departamento_personal_id,
                    sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                    branch_id: emp.branch_id,
                    sueldo_base: sueldo,
                    fecha_ingreso: null,
                    fecha_base: null,
                    dias_laborados_anio: 0,
                    es_proporcional: 0,
                    monto_quincena25: 0,
                    ajuste: 0,
                    monto_recibir: 0,
                    aplica: false,
                    motivo_exclusion: 'Sin fecha de ingreso registrada',
                    observaciones: 'Sin fecha de ingreso'
                });
                continue;
            }

            const fechaBase = new Date(rawFechaBase);
            const fbUtc = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth(), fechaBase.getUTCDate()));

            // 3. Evaluar días laborados en el ejercicio precedente
            let diasLaborados = 0;
            let esProporcional = 0;

            if (fbUtc <= fechaInicioAnterior) {
                // Empleado con 1 año o más de antigüedad al cierre del año previo
                diasLaborados = 365;
                esProporcional = 0;
            } else if (fbUtc <= fechaCorteAnterior) {
                // Ingresó durante el año previo (cálculo proporcional)
                const diffTime = Math.max(0, fechaCorteAnterior.getTime() - fbUtc.getTime());
                diasLaborados = Math.min(365, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
                esProporcional = 1;
            } else {
                // Ingresó en el año actual (después del 31 de dic del año anterior)
                diasLaborados = 0;
                esProporcional = 1;
            }

            if (diasLaborados === 0) {
                results.push({
                    empleado_id: emp.id,
                    codigo: emp.codigo,
                    nombres: emp.nombres,
                    apellidos: emp.apellidos,
                    cargo_nombre: emp.cargo_nombre || 'GENERAL',
                    departamento_nombre: emp.departamento_nombre || 'GENERAL',
                    departamento_personal_id: emp.departamento_personal_id,
                    sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                    branch_id: emp.branch_id,
                    sueldo_base: sueldo,
                    fecha_ingreso: emp.fecha_ingreso,
                    fecha_base: rawFechaBase,
                    dias_laborados_anio: 0,
                    es_proporcional: 1,
                    monto_quincena25: 0,
                    ajuste: 0,
                    monto_recibir: 0,
                    aplica: false,
                    motivo_exclusion: `Ingreso en ${anio} (posterior al período computable)`,
                    observaciones: `Ingreso en ${anio}`
                });
                continue;
            }

            // 4. Cálculo: 50% del salario mensual con factor proporcional
            const quincenaCompleta = sueldo * 0.50;
            const factor = diasLaborados / 365;
            const montoCalculado = Math.round((quincenaCompleta * factor) * 100) / 100;

            results.push({
                empleado_id: emp.id,
                codigo: emp.codigo,
                nombres: emp.nombres,
                apellidos: emp.apellidos,
                cargo_nombre: emp.cargo_nombre || 'GENERAL',
                departamento_nombre: emp.departamento_nombre || 'GENERAL',
                departamento_personal_id: emp.departamento_personal_id,
                sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                branch_id: emp.branch_id,
                sueldo_base: sueldo,
                fecha_ingreso: emp.fecha_ingreso,
                fecha_base: typeof rawFechaBase === 'string' ? rawFechaBase.substring(0, 10) : new Date(rawFechaBase).toISOString().substring(0, 10),
                dias_laborados_anio: diasLaborados,
                es_proporcional: esProporcional,
                monto_quincena25: montoCalculado,
                ajuste: 0,
                monto_recibir: montoCalculado,
                aplica: true,
                motivo_exclusion: null,
                observaciones: esProporcional ? `Proporcional (${diasLaborados} días)` : '100% de Ley (1 año+)'
            });
        }

        res.json(results);
    } catch (error) {
        console.error('[Quincena25 calcular] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

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

const exportPDF = async (req, res) => {
    try {
        const { año, departamento_id, branch_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pq.*, e.codigo, e.nombres, e.apellidos,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   b.nombre as sucursal_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit, comp.nrc as company_nrc, comp.logo_url
            FROM ${TABLE} pq
            JOIN rh_empleados e ON pq.empleado_id = e.id
            JOIN companies comp ON pq.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE pq.company_id = ? AND pq.periodo_anio = ?
        `;
        let params = [req.company_id, parseInt(año)];

        if (departamento_id && departamento_id !== '0' && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }
        if (branch_id && branch_id !== '0' && branch_id !== 'all') {
            query += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        query += ` ORDER BY d.descripcion, e.codigo`;
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla 25 no encontrada para los filtros seleccionados' });

        const company = await reportPdfHelper.getCompanyInfo(req.company_id);
        const depLabel = departamento_id && departamento_id !== '0' && departamento_id !== 'all' ? (rows[0]?.departamento_nombre || '') : 'Todos';
        const sucLabel = branch_id && branch_id !== '0' && branch_id !== 'all' ? (rows[0]?.sucursal_nombre || '') : 'Todas';

        const pdfData = {
            company,
            company_name: company.razon_social || rows[0]?.company_name || '',
            company_nit: company.nit || rows[0]?.company_nit || '',
            company_nrc: company.nrc || rows[0]?.company_nrc || '',
            logo_url: rows[0]?.logo_url || '',
            anio: parseInt(año),
            departamento_label: depLabel,
            sucursal_label: sucLabel,
            items: rows
        };

        const pdfBuffer = await generateQuincena25PDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Planilla_Quincena25_${año}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Quincena25 PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de Planilla 25' });
    }
};

const exportRecibos = async (req, res) => {
    try {
        const { año, departamento_id, branch_id, empleado_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pq.*, e.codigo, e.nombres, e.apellidos,
                   e.num_dui, e.num_nit, e.fecha_ingreso,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   b.nombre as sucursal_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit, comp.logo_url
            FROM ${TABLE} pq
            JOIN rh_empleados e ON pq.empleado_id = e.id
            JOIN companies comp ON pq.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE pq.company_id = ? AND pq.periodo_anio = ?
        `;
        let params = [req.company_id, parseInt(año)];

        if (empleado_id) {
            query += ` AND pq.empleado_id = ?`;
            params.push(parseInt(empleado_id));
        }
        if (departamento_id && departamento_id !== '0' && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }
        if (branch_id && branch_id !== '0' && branch_id !== 'all') {
            query += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        query += ` ORDER BY d.descripcion, e.codigo`;
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) return res.status(404).json({ message: 'Recibos no encontrados para los filtros seleccionados' });

        let responsable = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) responsable = rhCfg[0].responsable_nombre;
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        const pdfData = {
            company_name: rows[0]?.company_name || '',
            company_nit: rows[0]?.company_nit || '',
            logo_url: rows[0]?.logo_url || '',
            responsable_nombre: responsable,
            firma_url: firmaUrl,
            sello_url: selloUrl,
            anio: parseInt(año),
            items: rows
        };

        const pdfBuffer = await generateQuincena25RecibosPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Recibos_Quincena25_${año}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Quincena25 Recibos] Error:', error);
        res.status(500).json({ message: 'Error al generar recibos de Quincena 25' });
    }
};

const exportBanco = async (req, res) => {
    try {
        const { año, departamento_id, branch_id, formatoBancario = 'ambos' } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pq.*, e.codigo, e.nombres, e.apellidos, e.cuenta_planillera
            FROM ${TABLE} pq
            JOIN rh_empleados e ON pq.empleado_id = e.id
            WHERE pq.company_id = ? AND pq.periodo_anio = ? AND pq.monto_recibir > 0
        `;
        let params = [req.company_id, parseInt(año)];

        if (departamento_id && departamento_id !== '0' && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }
        if (branch_id && branch_id !== '0' && branch_id !== 'all') {
            query += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        query += ` ORDER BY e.codigo ASC`;
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Sin registros con monto a cobrar para exportar' });
        }

        // CSV bancario (Excel friendly)
        const csvRows = rows.map(r => {
            const nombre = `${r.nombres || ''} ${r.apellidos || ''}`.trim();
            const cuenta = r.cuenta_planillera || '';
            const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
            return `="${cuenta}",${monto},"${nombre}"`;
        });
        const contentCsv = '\uFEFF' + 'sep=,\n' + csvRows.join('\n');

        // TXT bancario (Tabs)
        const contentTxt = rows.map(r => {
            const nombre = `${r.nombres || ''} ${r.apellidos || ''}`.trim();
            const cuenta = r.cuenta_planillera || '';
            const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
            return `${cuenta}\t${monto}\t${nombre}`;
        }).join('\r\n');

        res.json({
            csv: contentCsv,
            txt: contentTxt,
            filename: `DISPERSION_QUINCENA25_${año}`,
            total_empleados: rows.length,
            total_monto: rows.reduce((s, r) => s + parseFloat(r.monto_recibir || 0), 0)
        });
    } catch (error) {
        console.error('[Quincena25 exportBanco] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const exportHaciendaF14 = async (req, res) => {
    try {
        const { año } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        const [rows] = await pool.query(
            `SELECT pq.*, e.codigo, e.nombres, e.apellidos, e.num_dui, e.num_nit
             FROM ${TABLE} pq
             JOIN rh_empleados e ON pq.empleado_id = e.id
             WHERE pq.company_id = ? AND pq.periodo_anio = ? AND pq.monto_recibir > 0
             ORDER BY e.codigo ASC`,
            [req.company_id, parseInt(año)]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Sin registros para generar el Anexo F-14' });
        }

        // Formato oficial DGII Anexo F-14 Quincena 25 (MH.UVI.DGII/006.001/2026):
        // Tipo Documento | Número Identificación | Nombre Completo | Concepto de Renta No Gravada | Monto Devengado
        const csvLines = rows.map((r, idx) => {
            const idDoc = (r.num_nit || r.num_dui || '').replace(/[^0-9]/g, '');
            const tipoDoc = (r.num_nit && r.num_nit.length >= 14) ? 'NIT' : 'DUI';
            const nombre = `${r.nombres || ''} ${r.apellidos || ''}`.trim().toUpperCase().replace(/,/g, '');
            const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
            return `${idx + 1};${tipoDoc};${idDoc};${nombre};Q25_LEY_499;${monto};0.00`;
        });

        const header = 'LINEA;TIPO_DOC;NUM_DOCUMENTO;NOMBRE_EMPLEADO;CODIGO_INGRESO;MONTO_DEVENGADO;RETENCION_APLICADA';
        const csvContent = '\uFEFF' + header + '\r\n' + csvLines.join('\r\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=ANEXO_F14_QUINCENA25_${año}.csv`);
        res.send(csvContent);
    } catch (error) {
        console.error('[Quincena25 exportHaciendaF14] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getResumen,
    getPlanilla,
    calcular,
    savePlanilla,
    cerrarPeriodo,
    reabrirPeriodo,
    deletePeriodo,
    exportPDF,
    exportRecibos,
    exportBanco,
    exportHaciendaF14
};
