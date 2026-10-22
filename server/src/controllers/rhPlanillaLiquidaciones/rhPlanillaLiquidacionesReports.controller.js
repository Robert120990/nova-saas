const pool = require('../../config/db');
const { generateLiquidacionPDF, generateFiniquitoPDF, generateAcuerdoPagoPDF } = require('../../services/pdf.service');
const { generateFiniquitoDocx } = require('../../services/finiquitoDocx.service');
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
            pago_ultima_planilla: p.pago_ultima_planilla,
            pago_horas_extras: p.pago_horas_extras,
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
        const { motivo, format, tipo_persona } = req.query;

        const [rows] = await pool.query(`
            SELECT pl.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.fecha_nacimiento,
                   e.ocupacion,
                   e.departamento as empleado_departamento,
                   e.municipio as empleado_municipio,
                   e.distrito as empleado_distrito,
                   COALESCE(dist_e.description, dist_c.description) as distrito_nombre,
                   COALESCE(mun_e.description, mun_c.description) as municipio_nombre,
                   COALESCE(dep_e.description, dep_c.description) as depto_nombre,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   c.descripcion as cargo_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.nrc as company_nrc,
                   comp.tipo_persona as company_tipo_persona,
                   comp.direccion as company_direccion,
                   comp.departamento as company_departamento,
                   comp.municipio as company_municipio,
                   comp.distrito as company_distrito,
                   comp.logo_url
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            JOIN companies comp ON pl.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN cat_008_distrito dist_e ON dist_e.code = e.distrito AND dist_e.dep_code = e.departamento
            LEFT JOIN cat_013_municipio mun_e ON mun_e.code = e.municipio AND mun_e.dep_code = e.departamento
            LEFT JOIN cat_012_departamento dep_e ON dep_e.code = e.departamento
            LEFT JOIN cat_008_distrito dist_c ON dist_c.code = comp.distrito AND dist_c.dep_code = comp.departamento
            LEFT JOIN cat_013_municipio mun_c ON mun_c.code = comp.municipio AND mun_c.dep_code = comp.departamento
            LEFT JOIN cat_012_departamento dep_c ON dep_c.code = comp.departamento
            WHERE pl.id = ? AND pl.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Liquidacion no encontrada' });
        const p = rows[0];

        let patronoNombre = p.company_name;
        let notarioNombre = '', notarioDomicilio = '', notarioDept = '';
        let firmaUrl = '', selloUrl = '';
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url, notario_nombre, notario_domicilio, notario_departamento FROM rh_config WHERE company_id = ?`, [req.company_id]);
        if (rhCfg.length > 0) {
            if (rhCfg[0].responsable_nombre) patronoNombre = rhCfg[0].responsable_nombre;
            notarioNombre = rhCfg[0].notario_nombre || '';
            notarioDomicilio = rhCfg[0].notario_domicilio || '';
            notarioDept = rhCfg[0].notario_departamento || '';
            firmaUrl = rhCfg[0].firma_url || '';
            selloUrl = rhCfg[0].sello_url || '';
        }

        // Determinar modalidad: Persona Natural o Persona Jurídica
        let isPersonaNatural = false;
        if (tipo_persona) {
            isPersonaNatural = (tipo_persona === 'natural' || String(tipo_persona) === '1');
        } else {
            isPersonaNatural = String(p.company_tipo_persona) === '1' ||
                !/S\.?A\.?|C\.?V\.?|SOCIEDAD|LTDA|LIMITADA|R\.L\./i.test(p.company_name);
        }

        const finiquitoData = {
            is_persona_natural: isPersonaNatural,
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            fecha_nacimiento: p.fecha_nacimiento,
            empleado_ocupacion: p.ocupacion || p.cargo_nombre || 'empleado(a)',
            empleado_departamento: p.depto_nombre || p.empleado_departamento || p.company_departamento,
            empleado_municipio: p.municipio_nombre || p.empleado_municipio || p.company_municipio,
            empleado_distrito: p.distrito_nombre || p.empleado_distrito || p.company_distrito,
            distrito_nombre: p.distrito_nombre,
            municipio_nombre: p.municipio_nombre,
            depto_nombre: p.depto_nombre,
            cargo_nombre: p.cargo_nombre,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            patrono_nombre: patronoNombre,
            patrono_ocupacion: 'mayor de edad, estudiante',
            patrono_domicilio: p.municipio_nombre || p.distrito_nombre || 'San Salvador',
            patrono_departamento: p.depto_nombre || p.company_departamento || 'San Salvador',
            patrono_dui: p.company_nit ? p.company_nit.substring(0, 10) : '',
            notario_nombre: notarioNombre || 'KARIN ARMANDO BATRES ANGEL',
            notario_domicilio: notarioDomicilio || 'San Martín',
            notario_departamento: notarioDept || 'San Salvador',
            firma_url: firmaUrl,
            sello_url: selloUrl,
            motivo: motivo || 'RENUNCIA VOLUNTARIA',
            fecha_documento: p.ultimos_dias_laborados || p.created_at || new Date()
        };

        if (format === 'docx' || format === 'word') {
            const docxBuffer = await generateFiniquitoDocx(finiquitoData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=Finiquito_${id}.docx`);
            return res.send(docxBuffer);
        }

        const pdfBuffer = await generateFiniquitoPDF(finiquitoData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Finiquito_${id}.pdf`);
        return res.send(pdfBuffer);
    } catch (error) {
        console.error('[Finiquito Export] Error:', error);
        res.status(500).json({ message: 'Error al generar finiquito' });
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
