const pool = require('../../config/db');
const { generateLiquidacionPDF, generateFiniquitoPDF, generateAcuerdoPagoPDF } = require('../../services/pdf.service');
const { numberToWords } = require('../../utils/numberToWords');
const TABLE = 'rh_planilla_liquidaciones';

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT pl.*, 
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
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            JOIN companies comp ON pl.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pl.id = ? AND pl.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Liquidacion no encontrada' });
        const p = rows[0];

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
            periodo_indemnizacion_desde: p.periodo_indemnizacion_desde,
            periodo_indemnizacion_hasta: p.periodo_indemnizacion_hasta,
            periodo_vacaciones_desde: p.periodo_vacaciones_desde,
            periodo_vacaciones_hasta: p.periodo_vacaciones_hasta,
            periodo_aguinaldo_desde: p.periodo_aguinaldo_desde,
            periodo_aguinaldo_hasta: p.periodo_aguinaldo_hasta,
            dias_indemnizacion: p.dias_indemnizacion,
            dias_vacaciones: p.dias_vacaciones,
            dias_aguinaldo: p.dias_aguinaldo,
            ultimos_dias_laborados: p.ultimos_dias_laborados,
            pago_ultimos_dias: p.pago_ultimos_dias,
            total_indemnizacion: p.total_indemnizacion,
            total_vacaciones: p.total_vacaciones,
            total_aguinaldo: p.total_aguinaldo,
            total_devengado: p.total_devengado,
            descuento_isss: p.descuento_isss,
            descuento_afp: p.descuento_afp,
            descuento_renta: p.descuento_renta,
            otros_descuentos: p.otros_descuentos,
            total_deducciones: p.total_deducciones,
            monto_recibir: p.monto_recibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            pago_cuotas: p.pago_cuotas,
            cuotas: p.cuotas,
            pago_por_cuota: p.pago_por_cuota,
            monto_letras: numberToWords(parseFloat(p.monto_recibir))
        };

        const pdfBuffer = await generateLiquidacionPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Liquidacion_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Liquidaciones PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

const exportFiniquito = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.query;

        const [rows] = await pool.query(`
            SELECT pl.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   c.descripcion as cargo_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            JOIN companies comp ON pl.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            WHERE pl.id = ? AND pl.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Liquidacion no encontrada' });
        const p = rows[0];

        let empleadorNombre = p.company_name;
        let notarioNombre = '', notarioDomicilio = '', notarioDept = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url, notario_nombre, notario_domicilio, notario_departamento FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) empleadorNombre = rhCfg[0].responsable_nombre;
            notarioNombre = rhCfg[0].notario_nombre || '';
            notarioDomicilio = rhCfg[0].notario_domicilio || '';
            notarioDept = rhCfg[0].notario_departamento || '';
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        const pdfData = {
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            cargo_nombre: p.cargo_nombre,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            empleador_nombre: empleadorNombre,
            notario_nombre: notarioNombre,
            notario_domicilio: notarioDomicilio,
            notario_dept: notarioDept,
            firma_url: firmaUrl,
            sello_url: selloUrl,
            motivo: motivo || 'RENUNCIA INMEDIATA'
        };

        const pdfBuffer = await generateFiniquitoPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Finiquito_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Finiquito PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de finiquito' });
    }
};

const exportAcuerdoPago = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT pl.*, 
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.num_dui, e.num_nit,
                   c.descripcion as cargo_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            JOIN companies comp ON pl.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            WHERE pl.id = ? AND pl.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Liquidacion no encontrada' });
        const p = rows[0];
        if (!p.pago_cuotas) return res.status(400).json({ message: 'Esta liquidacion no tiene pago en cuotas' });

        let empleadorNombre = p.company_name;
        let notarioNombre = '', notarioDomicilio = '', notarioDept = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url, notario_nombre, notario_domicilio, notario_departamento FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) empleadorNombre = rhCfg[0].responsable_nombre;
            notarioNombre = rhCfg[0].notario_nombre || '';
            notarioDomicilio = rhCfg[0].notario_domicilio || '';
            notarioDept = rhCfg[0].notario_departamento || '';
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        const pdfData = {
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            cargo_nombre: p.cargo_nombre,
            num_dui: p.num_dui,
            empleador_nombre: empleadorNombre,
            notario_nombre: notarioNombre,
            notario_domicilio: notarioDomicilio,
            notario_dept: notarioDept,
            firma_url: firmaUrl,
            sello_url: selloUrl,
            monto_recibir: p.monto_recibir,
            cuotas: p.cuotas,
            pago_por_cuota: p.pago_por_cuota
        };

        const pdfBuffer = await generateAcuerdoPagoPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=AcuerdoPago_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[AcuerdoPago PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF de acuerdo de pago' });
    }
};

module.exports = { exportPDF, exportFiniquito, exportAcuerdoPago };
