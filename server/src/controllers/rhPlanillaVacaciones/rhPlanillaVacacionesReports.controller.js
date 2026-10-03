const pool = require('../../config/db');
const { generateVacacionPDF } = require('../../services/pdf.service');
const { numberToWords } = require('../../utils/numberToWords');

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT pv.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                    e.sueldo_base,
                    e.num_dui, e.num_nit,
                    e.fecha_ingreso, e.afp_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM rh_planilla_vacaciones pv
            JOIN rh_empleados e ON pv.empleado_id = e.id
            JOIN companies comp ON pv.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pv.id = ? AND pv.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });
        const p = rows[0];

        // Fetch ISSS/AFP rates for display
        const today = new Date().toISOString().split('T')[0];
        let isssPorcentaje = 0, afpPorcentaje = 0;

        const [isssRows] = await pool.query(
            `SELECT porcentaje_empleado FROM rh_isss_tasas 
             WHERE company_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
             ORDER BY fecha_desde DESC LIMIT 1`,
            [req.company_id, today, today]
        );
        if (isssRows.length > 0) isssPorcentaje = isssRows[0].porcentaje_empleado;

        if (p.afp_id) {
            const [afpRows] = await pool.query(
                `SELECT porcentaje_empleado FROM rh_afp_tasas
                 WHERE company_id = ? AND afp_id = ? AND fecha_desde <= ? AND (fecha_hasta IS NULL OR fecha_hasta >= ?)
                 ORDER BY fecha_desde DESC LIMIT 1`,
                [req.company_id, p.afp_id, today, today]
            );
            if (afpRows.length > 0) afpPorcentaje = afpRows[0].porcentaje_empleado;
        }

        let responsable = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(
            `SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`,
            [req.company_id]
        );
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) responsable = rhCfg[0].responsable_nombre;
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        const pdfData = {
            id: p.id,
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            responsable_nombre: responsable,
            firma_url: firmaUrl,
            sello_url: selloUrl,
            empleado_codigo: p.empleado_codigo,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            sueldo_base: p.sueldo_base,
            cargo_nombre: p.cargo_nombre,
            departamento_nombre: p.departamento_nombre,
            fecha_ingreso: p.fecha_ingreso,
            fecha_inicial: p.fecha_inicial,
            fecha_final: p.fecha_final,
            vacaciones_monto: p.vacaciones_monto,
            descuento_isss: p.descuento_isss,
            descuento_afp: p.descuento_afp,
            descuento_renta: p.descuento_renta,
            total_devengado: p.total_devengado,
            total_deducciones: p.total_deducciones,
            total_recibir: p.monto_recibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            monto_letras: numberToWords(parseFloat(p.monto_recibir))
        };

        const pdfBuffer = await generateVacacionPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Vacacion_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Vacaciones PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

module.exports = { exportPDF };
