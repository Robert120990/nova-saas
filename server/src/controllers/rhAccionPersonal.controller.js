const pool = require('../config/db');
const {
    generateAccionPersonalPDF,
    ALL_INFRACCIONES,
    INFRACCIONES_COL1,
    INFRACCIONES_COL2,
    ACCIONES_OPCIONES,
    TIEMPO_LABORADO_MAP
} = require('../services/rhAccionPersonalPdf.service');

const TABLE = 'rh_acciones_personal';
const LABEL = 'Acción de personal';

const generateCorrelativo = async (companyId, anio) => {
    const prefix = `AP-${anio}-`;
    const [rows] = await pool.query(
        `SELECT codigo FROM ${TABLE} WHERE company_id = ? AND codigo LIKE ? ORDER BY id DESC LIMIT 1`,
        [companyId, `${prefix}%`]
    );

    if (rows.length === 0) return `${prefix}0001`;

    const last = rows[0].codigo;
    const numPart = parseInt(last.replace(prefix, ''), 10);
    const nextNum = isNaN(numPart) ? 1 : numPart + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
};

const getAcciones = async (req, res) => {
    try {
        const {
            search,
            empleado_id,
            fecha_desde,
            fecha_hasta,
            accion_tomar,
            estado,
            page = 1,
            limit = 15
        } = req.query;

        const offset = (page - 1) * limit;

        let query = `
            SELECT ap.*,
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.num_dui,
                   e.sueldo_base,
                   e.fecha_ingreso,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} ap
            JOIN rh_empleados e ON ap.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE ap.company_id = ?
        `;
        const params = [req.company_id];

        if (empleado_id) {
            query += ` AND ap.empleado_id = ?`;
            params.push(parseInt(empleado_id));
        }

        if (accion_tomar) {
            query += ` AND ap.accion_tomar = ?`;
            params.push(accion_tomar);
        }

        if (estado) {
            query += ` AND ap.estado = ?`;
            params.push(estado);
        }

        if (fecha_desde) {
            query += ` AND ap.fecha >= ?`;
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ` AND ap.fecha <= ?`;
            params.push(fecha_hasta);
        }

        if (search) {
            query += ` AND (
                ap.codigo LIKE ? OR
                e.codigo LIKE ? OR
                e.nombres LIKE ? OR
                e.apellidos LIKE ? OR
                ap.jefe_inmediato LIKE ? OR
                ap.descripcion_causa LIKE ?
            )`;
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY ap.fecha DESC, ap.id DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);

        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAccion = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT ap.*,
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.num_dui,
                    e.sueldo_base,
                    e.fecha_ingreso,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM ${TABLE} ap
             JOIN rh_empleados e ON ap.empleado_id = e.id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE ap.id = ? AND ap.company_id = ?`,
            [id, req.company_id]
        );

        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createAccion = async (req, res) => {
    try {
        const {
            empleado_id,
            fecha,
            jefe_inmediato,
            lugar_trabajo,
            tiempo_laborado,
            tipo_accion = 'amonestacion',
            infracciones,
            infraccion_otra,
            descripcion_causa,
            articulo_codigo_trabajo,
            accion_tomar = 'llamado_escrito_1',
            dias_suspension = 0,
            fecha_inicio_suspension,
            fecha_fin_suspension,
            accion_otra,
            recursos_humanos,
            estado_firma = 'pendiente',
            testigo_nombre,
            observaciones,
            estado = 'aplicada'
        } = req.body;

        if (!empleado_id || !fecha || !descripcion_causa) {
            return res.status(400).json({ message: 'Empleado, fecha y descripción de la causa son requeridos' });
        }

        const anio = new Date(fecha).getFullYear() || new Date().getFullYear();
        const codigo = await generateCorrelativo(req.company_id, anio);

        // Normalize infracciones array
        const infraccionesJson = JSON.stringify(Array.isArray(infracciones) ? infracciones : []);

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (
                company_id, empleado_id, codigo, fecha, jefe_inmediato, lugar_trabajo,
                tiempo_laborado, tipo_accion, infracciones, infraccion_otra,
                descripcion_causa, articulo_codigo_trabajo, accion_tomar,
                dias_suspension, fecha_inicio_suspension, fecha_fin_suspension,
                accion_otra, recursos_humanos, estado_firma, testigo_nombre,
                observaciones, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.company_id, empleado_id, codigo, fecha, jefe_inmediato || null, lugar_trabajo || null,
                tiempo_laborado || '0_a_1', tipo_accion, infraccionesJson, infraccion_otra || null,
                descripcion_causa, articulo_codigo_trabajo || null, accion_tomar,
                parseInt(dias_suspension) || 0, fecha_inicio_suspension || null, fecha_fin_suspension || null,
                accion_otra || null, recursos_humanos || null, estado_firma, testigo_nombre || null,
                observaciones || null, estado
            ]
        );

        res.status(201).json({ id: result.insertId, codigo, message: 'Acción de personal registrada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAccion = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            fecha,
            jefe_inmediato,
            lugar_trabajo,
            tiempo_laborado,
            tipo_accion,
            infracciones,
            infraccion_otra,
            descripcion_causa,
            articulo_codigo_trabajo,
            accion_tomar,
            dias_suspension,
            fecha_inicio_suspension,
            fecha_fin_suspension,
            accion_otra,
            recursos_humanos,
            estado_firma,
            testigo_nombre,
            observaciones,
            estado
        } = req.body;

        const infraccionesJson = JSON.stringify(Array.isArray(infracciones) ? infracciones : []);

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET
                fecha = ?, jefe_inmediato = ?, lugar_trabajo = ?,
                tiempo_laborado = ?, tipo_accion = ?, infracciones = ?, infraccion_otra = ?,
                descripcion_causa = ?, articulo_codigo_trabajo = ?, accion_tomar = ?,
                dias_suspension = ?, fecha_inicio_suspension = ?, fecha_fin_suspension = ?,
                accion_otra = ?, recursos_humanos = ?, estado_firma = ?, testigo_nombre = ?,
                observaciones = ?, estado = ?
             WHERE id = ? AND company_id = ?`,
            [
                fecha, jefe_inmediato || null, lugar_trabajo || null,
                tiempo_laborado || '0_a_1', tipo_accion || 'amonestacion', infraccionesJson, infraccion_otra || null,
                descripcion_causa, articulo_codigo_trabajo || null, accion_tomar,
                parseInt(dias_suspension) || 0, fecha_inicio_suspension || null, fecha_fin_suspension || null,
                accion_otra || null, recursos_humanos || null, estado_firma || 'pendiente', testigo_nombre || null,
                observaciones || null, estado || 'aplicada',
                id, req.company_id
            ]
        );

        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ id, message: 'Acción de personal actualizada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAccion = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(
            `DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`,
            [id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ message: 'Acción de personal eliminada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT ap.*,
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.num_dui,
                    e.sueldo_base,
                    e.fecha_ingreso,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre,
                    comp.razon_social as company_name,
                    comp.nit as company_nit,
                    comp.logo_url
             FROM ${TABLE} ap
             JOIN rh_empleados e ON ap.empleado_id = e.id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             JOIN companies comp ON ap.company_id = comp.id
             WHERE ap.id = ? AND ap.company_id = ?`,
            [id, req.company_id]
        );

        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        const record = rows[0];

        // Parse JSON infracciones if needed
        if (typeof record.infracciones === 'string') {
            try { record.infracciones = JSON.parse(record.infracciones); } catch { record.infracciones = []; }
        }

        // Default HR name from rh_config if not set in record
        if (!record.recursos_humanos) {
            const [cfg] = await pool.query(
                `SELECT responsable_nombre FROM rh_config WHERE company_id = ? LIMIT 1`,
                [req.company_id]
            );
            if (cfg.length > 0 && cfg[0].responsable_nombre) {
                record.recursos_humanos = cfg[0].responsable_nombre;
            }
        }

        const pdfBuffer = await generateAccionPersonalPDF(record);

        const safeCode = (record.codigo || 'AP').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `ACCION_PERSONAL_${safeCode}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating Accion Personal PDF:', error);
        res.status(500).json({ message: 'Error generando PDF: ' + error.message });
    }
};

const getInfraccionesCatalogo = async (req, res) => {
    try {
        res.json({
            columna1: INFRACCIONES_COL1,
            columna2: INFRACCIONES_COL2,
            todas: ALL_INFRACCIONES,
            acciones: ACCIONES_OPCIONES,
            tiempo_laborado: TIEMPO_LABORADO_MAP
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAcciones,
    getAccion,
    createAccion,
    updateAccion,
    deleteAccion,
    exportPDF,
    getInfraccionesCatalogo
};
