const { pool, generatePlanillaPDF, generatePlanillaReciboPDF, numberToWords, TABLE } = require('../../services/rhPayroll/shared');

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   e.cargo_id, e.departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            JOIN companies comp ON p.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.id = ? AND p.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });
        const p = rows[0];

        const [detalles] = await pool.query(
            `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
            [id]
        );

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

        const otrasDed = detalles.reduce((acc, d) => acc + (d.operacion === 'restar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const totalPercep = detalles.reduce((acc, d) => acc + (d.operacion === 'sumar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const isss = parseFloat(p.descuento_isss || 0);
        const afp = parseFloat(p.descuento_afp || 0);
        const renta = parseFloat(p.descuento_renta || 0);
        const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
        const netoPercep = totalPercep > 0 ? totalPercep : parseFloat(p.total_percepciones || 0);
        const montoRecibir = Math.round((netoPercep - totalDed) * 100) / 100;

        const pdfData = {
            id: p.id,
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            empleado_codigo: p.empleado_codigo,
            empleado_nombres: p.empleado_nombres,
            empleado_apellidos: p.empleado_apellidos,
            sueldo_base: p.sueldo_base,
            cargo_nombre: p.cargo_nombre,
            departamento_nombre: p.departamento_nombre,
            fecha_ingreso: p.fecha_ingreso,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            periodo_anio: p.periodo_anio,
            periodo_mes: p.periodo_mes,
            quincena: p.quincena,
            dias_trabajados: p.dias_trabajados,
            detalles: detalles,
            total_percepciones: netoPercep,
            total_deducciones: totalDed,
            descuento_isss: isss,
            descuento_afp: afp,
            descuento_renta: renta,
            monto_recibir: montoRecibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            monto_letras: numberToWords(parseFloat(montoRecibir))
        };

        const pdfBuffer = await generatePlanillaPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Planilla_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Planilla PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

const exportRecibo = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   e.num_dui, e.num_nit,
                   e.fecha_ingreso, e.afp_id,
                   e.cargo_id, e.departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   comp.razon_social as company_name,
                   comp.nit as company_nit,
                   comp.logo_url
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            JOIN companies comp ON p.company_id = comp.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.id = ? AND p.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) return res.status(404).json({ message: 'Planilla no encontrada' });
        const p = rows[0];

        const [detalles] = await pool.query(
            `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
            [id]
        );

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

        const otrasDed = detalles.reduce((acc, d) => acc + (d.operacion === 'restar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const totalPercep = detalles.reduce((acc, d) => acc + (d.operacion === 'sumar' ? parseFloat(d.valor_ingresado || 0) : 0), 0);
        const isss = parseFloat(p.descuento_isss || 0);
        const afp = parseFloat(p.descuento_afp || 0);
        const renta = parseFloat(p.descuento_renta || 0);
        const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
        const netoPercep = totalPercep > 0 ? totalPercep : parseFloat(p.total_percepciones || 0);
        const montoRecibir = Math.round((netoPercep - totalDed) * 100) / 100;

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
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            periodo_anio: p.periodo_anio,
            periodo_mes: p.periodo_mes,
            quincena: p.quincena,
            dias_trabajados: p.dias_trabajados,
            detalles: detalles,
            total_percepciones: netoPercep,
            total_deducciones: totalDed,
            descuento_isss: isss,
            descuento_afp: afp,
            descuento_renta: renta,
            monto_recibir: montoRecibir,
            isss_porcentaje: isssPorcentaje,
            afp_porcentaje: afpPorcentaje,
            monto_letras: numberToWords(parseFloat(montoRecibir))
        };

        const pdfBuffer = await generatePlanillaReciboPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Recibo_Planilla_${id}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Planilla Recibo] Error:', error);
        res.status(500).json({ message: 'Error al generar recibo' });
    }
};



module.exports = { exportPDF, exportRecibo };
