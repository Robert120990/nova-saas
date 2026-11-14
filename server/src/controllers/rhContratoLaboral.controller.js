const pool = require('../config/db');
const { generateContratoLaboralPDF, calculateAge } = require('../services/rhContratoLaboralPdf.service');
const {
    normalizeLegalName,
    fetchPatronoConfig,
    resolveContratoPatrono
} = require('../services/rhPatrono.service');

const TABLE = 'rh_contratos_laborales';
const LABEL = 'Contrato laboral';

const generateCorrelativo = async (companyId, anio) => {
    const prefix = `CT-${anio}-`;
    const [rows] = await pool.query(
        `SELECT codigo FROM ${TABLE} WHERE company_id = ? AND codigo LIKE ? ORDER BY id DESC LIMIT 1`,
        [companyId, `${prefix}%`]
    );
    if (rows.length === 0) return `${prefix}0001`;
    const numPart = parseInt((rows[0].codigo || '').replace(prefix, ''), 10);
    return `${prefix}${String(isNaN(numPart) ? 1 : numPart + 1).padStart(4, '0')}`;
};

const parseDependientes = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }
    return [];
};

const getPatronoDefaults = async (req, res) => {
    try {
        const defaults = await fetchPatronoConfig(req.company_id);
        res.json(defaults);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getContratos = async (req, res) => {
    try {
        const { search, empleado_id, fecha_desde, fecha_hasta, estado, page = 1, limit = 15 } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 15);
        const offset = (pageNum - 1) * limitNum;

        let query = `
            SELECT cl.*, e.codigo as empleado_codigo, e.nombres as empleado_nombres, e.apellidos as empleado_apellidos
            FROM ${TABLE} cl
            LEFT JOIN rh_empleados e ON cl.empleado_id = e.id
            WHERE cl.company_id = ?
        `;
        const params = [req.company_id];

        if (empleado_id) { query += ` AND cl.empleado_id = ?`; params.push(parseInt(empleado_id, 10)); }
        if (estado) { query += ` AND cl.estado = ?`; params.push(estado); }
        if (fecha_desde) { query += ` AND cl.fecha_creacion >= ?`; params.push(fecha_desde); }
        if (fecha_hasta) { query += ` AND cl.fecha_creacion <= ?`; params.push(fecha_hasta); }
        if (search) {
            query += ` AND (cl.codigo LIKE ? OR cl.trabajador_nombre LIKE ? OR cl.num_dui LIKE ? OR cl.num_nit LIKE ? OR cl.cargo_laboral LIKE ? OR cl.lugar_trabajo LIKE ? OR e.codigo LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s, s);
        }

        const [[countResult], patronoCfg] = await Promise.all([
            pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params),
            fetchPatronoConfig(req.company_id)
        ]);
        const total = countResult[0]?.total || 0;

        query += ` ORDER BY cl.fecha_creacion DESC, cl.id DESC LIMIT ? OFFSET ?`;
        params.push(limitNum, offset);

        const [rows] = await pool.query(query, params);
        const formatted = rows.map(r => ({
            ...r,
            ...resolveContratoPatrono(r, patronoCfg),
            dependientes: parseDependientes(r.dependientes)
        }));

        res.json({ data: formatted, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getContrato = async (req, res) => {
    try {
        const { id } = req.params;
        const [[rows], patronoCfg] = await Promise.all([
            pool.query(
                `SELECT cl.*,
                        e.codigo as empleado_codigo,
                        e.nombres as empleado_nombres,
                        e.apellidos as empleado_apellidos
                 FROM ${TABLE} cl
                 LEFT JOIN rh_empleados e ON cl.empleado_id = e.id
                 WHERE cl.id = ? AND cl.company_id = ?`,
                [id, req.company_id]
            ),
            fetchPatronoConfig(req.company_id)
        ]);

        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        const record = {
            ...rows[0],
            ...resolveContratoPatrono(rows[0], patronoCfg),
            dependientes: parseDependientes(rows[0].dependientes)
        };
        res.json(record);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const buildContratoPayload = (body, patronoCfg) => {
    const edadCalc = calculateAge(body.fecha_nacimiento, body.edad);
    const deps = parseDependientes(body.dependientes).map(d => ({
        nombre: (d.nombre || '').trim().toUpperCase(),
        apellido: (d.apellido || '').trim().toUpperCase(),
        fecha_nacimiento: d.fecha_nacimiento || '',
        edad: calculateAge(d.fecha_nacimiento, d.edad) || null,
        direccion: (d.direccion || '').trim().toUpperCase()
    }));

    const incomingPatronoName = normalizeLegalName(body.patrono_nombre || '');
    const resolvedPatronoName = (incomingPatronoName || patronoCfg.patrono_nombre || '').trim().toUpperCase();
    const parsedPatronoEdad = body.patrono_edad !== undefined && body.patrono_edad !== null && body.patrono_edad !== '' && Number(body.patrono_edad) > 0
        ? parseInt(body.patrono_edad, 10)
        : (patronoCfg.patrono_edad || null);

    return {
        empleado_id: body.empleado_id && Number(body.empleado_id) > 0 ? parseInt(body.empleado_id, 10) : null,
        trabajador_nombre: (body.trabajador_nombre || '').trim().toUpperCase(),
        fecha_nacimiento: body.fecha_nacimiento || null,
        edad: edadCalc !== '' && Number(edadCalc) > 0 ? Number(edadCalc) : null,
        sexo: (body.sexo || 'MASCULINO').trim().toUpperCase(),
        estado_civil: (body.estado_civil || 'SOLTERO').trim().toUpperCase(),
        profesion_oficio: (body.profesion_oficio || 'ESTUDIANTE').trim().toUpperCase(),
        direccion: (body.direccion || '').trim().toUpperCase(),
        nacionalidad: (body.nacionalidad || 'SALVADOREÑO').trim().toUpperCase(),
        num_dui: (body.num_dui || '').trim(),
        dui_extendido_en: (body.dui_extendido_en || '').trim().toUpperCase(),
        num_nit: (body.num_nit || '').trim(),
        num_isss: (body.num_isss || '').trim(),
        cargo_laboral: (body.cargo_laboral || '').trim().toUpperCase(),
        obligaciones: (body.obligaciones || '').trim().toUpperCase(),
        lugar_trabajo: (body.lugar_trabajo || '').trim().toUpperCase(),
        jefe_inmediato: (body.jefe_inmediato || '').trim().toUpperCase(),
        plazo_contrato: (body.plazo_contrato || 'TIEMPO INDEFINIDO').trim().toUpperCase(),
        fecha_inicio: body.fecha_inicio,
        lugar_creacion: (body.lugar_creacion || 'SAN SALVADOR').trim().toUpperCase(),
        fecha_creacion: body.fecha_creacion,
        salario_mensual: parseFloat(body.salario_mensual) || 0,
        lugar_pago: (body.lugar_pago || '').trim().toUpperCase(),
        forma_pago: (body.forma_pago || 'TRANFERENCIA BANCARIA').trim().toUpperCase(),
        horario_dia_inicio: (body.horario_dia_inicio || 'LUNES').trim().toUpperCase(),
        horario_dia_fin: (body.horario_dia_fin || 'VIERNES').trim().toUpperCase(),
        horario_manana_desde: (body.horario_manana_desde || '8:00 A.M.').trim().toUpperCase(),
        horario_manana_hasta: (body.horario_manana_hasta || '12:00 P.M.').trim().toUpperCase(),
        horario_tarde_desde: (body.horario_tarde_desde || '1:00 P.M.').trim().toUpperCase(),
        horario_tarde_hasta: (body.horario_tarde_hasta || '5:00 P.M.').trim().toUpperCase(),
        horario_dia_extra: (body.horario_dia_extra || 'SABADO').trim().toUpperCase(),
        horario_extra_desde: (body.horario_extra_desde || '8:00 A.M.').trim().toUpperCase(),
        horario_extra_hasta: (body.horario_extra_hasta || '12:00 P.M.').trim().toUpperCase(),
        total_horas_semana: parseFloat(body.total_horas_semana) || 44,
        dependientes: JSON.stringify(deps),
        patrono_nombre: resolvedPatronoName,
        patrono_edad: parsedPatronoEdad,
        patrono_sexo: (body.patrono_sexo ?? patronoCfg.patrono_sexo ?? '').trim().toUpperCase(),
        patrono_estado_civil: (body.patrono_estado_civil ?? patronoCfg.patrono_estado_civil ?? '').trim().toUpperCase(),
        patrono_profesion: (body.patrono_profesion ?? patronoCfg.patrono_profesion ?? '').trim().toUpperCase(),
        patrono_direccion: (body.patrono_direccion || patronoCfg.patrono_direccion || '').trim(),
        patrono_nacionalidad: (body.patrono_nacionalidad || patronoCfg.patrono_nacionalidad || 'SALVADOREÑA').trim().toUpperCase(),
        patrono_dui: (body.patrono_dui ?? patronoCfg.patrono_dui ?? '').trim(),
        patrono_dui_extendido: (body.patrono_dui_extendido ?? patronoCfg.patrono_dui_extendido ?? '').trim().toUpperCase(),
        patrono_nit: (body.patrono_nit || patronoCfg.patrono_nit || '').trim(),
        herramientas_materiales: body.herramientas_materiales || null,
        otras_estipulaciones: body.otras_estipulaciones || null,
        estado: body.estado || 'vigente'
    };
};

const createContrato = async (req, res) => {
    try {
        const patronoCfg = await fetchPatronoConfig(req.company_id);
        const payload = buildContratoPayload(req.body, patronoCfg);

        const anio = new Date(payload.fecha_creacion || Date.now()).getFullYear() || new Date().getFullYear();
        const codigo = await generateCorrelativo(req.company_id, anio);

        const insertData = {
            company_id: req.company_id,
            codigo,
            ...payload
        };

        const [result] = await pool.query(`INSERT INTO ${TABLE} SET ?`, [insertData]);

        res.status(201).json({
            id: result.insertId,
            codigo,
            message: 'Contrato laboral registrado exitosamente'
        });
    } catch (error) {
        console.error('[rhContratoLaboral create] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const updateContrato = async (req, res) => {
    try {
        const { id } = req.params;
        const patronoCfg = await fetchPatronoConfig(req.company_id);
        const payload = buildContratoPayload(req.body, patronoCfg);

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET ? WHERE id = ? AND company_id = ?`,
            [payload, id, req.company_id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ id: Number(id), message: 'Contrato laboral actualizado exitosamente' });
    } catch (error) {
        console.error('[rhContratoLaboral update] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const deleteContrato = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ message: 'Contrato laboral eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [[rows], patronoCfg] = await Promise.all([
            pool.query(
                `SELECT * FROM ${TABLE} WHERE id = ? AND company_id = ?`,
                [id, req.company_id]
            ),
            fetchPatronoConfig(req.company_id)
        ]);

        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });

        const record = rows[0];
        record.dependientes = parseDependientes(record.dependientes);

        const mergedRecord = {
            ...record,
            ...resolveContratoPatrono(record, patronoCfg)
        };

        const pdfBuffer = await generateContratoLaboralPDF(mergedRecord);
        const safeCode = (record.codigo || `CT_${record.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `CONTRATO_LABORAL_${safeCode}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating Contrato Laboral PDF:', error);
        res.status(500).json({ message: 'Error generando PDF: ' + error.message });
    }
};

module.exports = {
    getPatronoDefaults,
    getContratos,
    getContrato,
    createContrato,
    updateContrato,
    deleteContrato,
    exportPDF
};
