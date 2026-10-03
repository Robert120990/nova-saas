const pool = require('../../config/db');
const TABLE = 'rh_planilla_quincena25';
const reportPdfHelper = require('../../utils/reportPdfHelper');
const { generateQuincena25PDF, generateQuincena25RecibosPDF } = require('../../services/pdf.service');

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

        query += ` ORDER BY (CASE WHEN e.cuenta_planillera IS NOT NULL AND TRIM(e.cuenta_planillera) != '' AND TRIM(e.cuenta_planillera) != '0' AND TRIM(e.cuenta_planillera) != '-' THEN 0 ELSE 1 END), e.codigo ASC`;
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Sin registros con monto a cobrar para exportar' });
        }

        // Ordenar defensivamente en memoria: empleados con cuenta primero, sin cuenta al final
        const sortedRows = [...rows].sort((a, b) => {
            const cuentaA = String(a.cuenta_planillera || '').trim();
            const cuentaB = String(b.cuenta_planillera || '').trim();
            const hasA = Boolean(cuentaA && cuentaA !== '0' && cuentaA !== '-');
            const hasB = Boolean(cuentaB && cuentaB !== '0' && cuentaB !== '-');
            if (hasA && !hasB) return -1;
            if (!hasA && hasB) return 1;
            return 0;
        });

        // CSV bancario (Excel friendly)
        const csvRows = sortedRows.map(r => {
            const nombre = `${r.nombres || ''} ${r.apellidos || ''}`.trim();
            const cuenta = r.cuenta_planillera || '';
            const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
            return `="${cuenta}",${monto},"${nombre}"`;
        });
        const contentCsv = '\uFEFF' + 'sep=,\n' + csvRows.join('\n');

        // TXT bancario (Tabs)
        const contentTxt = sortedRows.map(r => {
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
module.exports = { exportPDF, exportRecibos, exportBanco, exportHaciendaF14 };
