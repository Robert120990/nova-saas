const pool = require('../../config/db');
const TABLE = 'rh_planilla_aguinaldos';
const reportPdfHelper = require('../../utils/reportPdfHelper');
const { parseIdList } = require('../../services/rhPayroll/shared');

const exportPDF = async (req, res) => {
    try {
        const { año, mes, departamento_id, branch_ids, departamento_ids } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pa.*, e.codigo, e.nombres, e.apellidos,
                   e.branch_id,
                   COALESCE(b.nombre, 'SIN SUCURSAL') as branch_nombre,
                   COALESCE(pa.departamento_personal_id, e.departamento_personal_id) as departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit, comp.logo_url
            FROM ${TABLE} pa
            JOIN rh_empleados e ON pa.empleado_id = e.id
            JOIN companies comp ON pa.company_id = comp.id
            LEFT JOIN branches b ON e.branch_id = b.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON COALESCE(pa.departamento_personal_id, e.departamento_personal_id) = d.id
            WHERE pa.company_id = ? AND pa.periodo_año = ? AND pa.periodo_mes = ?
        `;
        let params = [req.company_id, parseInt(año), parseInt(mes) || 12];

        const branchList = parseIdList(branch_ids);
        if (branchList.length > 0) {
            query += ` AND e.branch_id IN (?)`;
            params.push(branchList);
        }

        const deptoList = parseIdList(departamento_ids);
        if (deptoList.length > 0) {
            query += ` AND COALESCE(pa.departamento_personal_id, e.departamento_personal_id) IN (?)`;
            params.push(deptoList);
        } else if (departamento_id && departamento_id !== '0') {
            query += ` AND (pa.filtro_departamento_id = ? OR COALESCE(pa.departamento_personal_id, e.departamento_personal_id) = ?)`;
            params.push(parseInt(departamento_id), parseInt(departamento_id));
        }

        query += ` ORDER BY COALESCE(d.descripcion, 'ZZZ') ASC, COALESCE(b.nombre, 'ZZZ') ASC, e.codigo ASC`;
        const [rows] = await pool.query(query, params);

        const months = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        const company = await reportPdfHelper.getCompanyInfo(req.company_id);
        const depLabel = (deptoList.length === 1 || (departamento_id && departamento_id !== '0' && deptoList.length === 0))
            ? (rows[0]?.departamento_nombre || '')
            : 'Todos';

        const { generateAguinaldoPDF } = require('../../services/pdf.service');
        const pdfData = {
            company,
            company_name: company.razon_social || rows[0]?.company_name || '',
            company_nit: company.nit || rows[0]?.company_nit || '',
            company_nrc: company.nrc || '',
            logo_url: rows[0]?.logo_url || '',
            periodo_label: `${months[parseInt(mes) || 12]} ${año}`,
            departamento_label: depLabel,
            branch_ids: branchList,
            departamento_ids: deptoList,
            año: parseInt(año),
            mes: parseInt(mes) || 12,
            items: rows
        };

        const pdfBuffer = await generateAguinaldoPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Planilla_Aguinaldos_${año}_${mes || 12}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Aguinaldos PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

const exportRecibos = async (req, res) => {
    try {
        const { año, mes, departamento_id, branch_ids, departamento_ids } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pa.*, e.codigo, e.nombres, e.apellidos,
                   e.num_dui, e.num_nit, e.fecha_ingreso,
                   e.branch_id,
                   COALESCE(b.nombre, 'SIN SUCURSAL') as branch_nombre,
                   COALESCE(pa.departamento_personal_id, e.departamento_personal_id) as departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit, comp.logo_url
            FROM ${TABLE} pa
            JOIN rh_empleados e ON pa.empleado_id = e.id
            JOIN companies comp ON pa.company_id = comp.id
            LEFT JOIN branches b ON e.branch_id = b.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON COALESCE(pa.departamento_personal_id, e.departamento_personal_id) = d.id
            WHERE pa.company_id = ? AND pa.periodo_año = ? AND pa.periodo_mes = ?
        `;
        let params = [req.company_id, parseInt(año), parseInt(mes) || 12];

        const branchList = parseIdList(branch_ids);
        if (branchList.length > 0) {
            query += ` AND e.branch_id IN (?)`;
            params.push(branchList);
        }

        const deptoList = parseIdList(departamento_ids);
        if (deptoList.length > 0) {
            query += ` AND COALESCE(pa.departamento_personal_id, e.departamento_personal_id) IN (?)`;
            params.push(deptoList);
        } else if (departamento_id && departamento_id !== '0') {
            query += ` AND (pa.filtro_departamento_id = ? OR COALESCE(pa.departamento_personal_id, e.departamento_personal_id) = ?)`;
            params.push(parseInt(departamento_id), parseInt(departamento_id));
        }

        query += ` ORDER BY e.codigo ASC`;
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) return res.status(404).json({ message: 'No hay recibos de aguinaldo para los filtros seleccionados' });

        let responsable = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) responsable = rhCfg[0].responsable_nombre;
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        const { generateAguinaldoRecibosPDF } = require('../../services/pdf.service');
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
module.exports = { exportPDF, exportRecibos };
