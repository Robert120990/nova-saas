const pool = require('../config/db');

const TABLE = 'rh_empleados';
const LABEL = 'Empleado';

const getEmpleados = async (req, res) => {
    try {
        const { search, page = 1, limit = 10, solo_activos } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT e.*, 
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   a.descripcion as afp_nombre,
                   tc.descripcion as tipo_contrato_nombre
            FROM ${TABLE} e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_afp a ON e.afp_id = a.id
            LEFT JOIN rh_tipos_contrato tc ON e.tipo_contrato_id = tc.id
            WHERE e.company_id = ?
        `;
        let params = [req.company_id];

        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ? OR e.num_dui LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (solo_activos === '1' || solo_activos === 'true') {
            query += ` AND e.es_activo = 1`;
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY e.codigo ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT e.*, 
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   a.descripcion as afp_nombre,
                   tc.descripcion as tipo_contrato_nombre
            FROM ${TABLE} e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_afp a ON e.afp_id = a.id
            LEFT JOIN rh_tipos_contrato tc ON e.tipo_contrato_id = tc.id
            WHERE e.id = ? AND e.company_id = ?
        `;
        const [rows] = await pool.query(query, [id, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getNextCode = async (req, res) => {
    try {
        const [maxResult] = await pool.query(
            `SELECT COALESCE(MAX(CAST(codigo AS UNSIGNED)), 0) + 1 as next FROM ${TABLE} WHERE company_id = ?`,
            [req.company_id]
        );
        const nextCode = String(maxResult[0].next).padStart(4, '0');
        res.json({ codigo: nextCode });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createEmpleado = async (req, res) => {
    try {
        let { codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
              ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
              contacto_emergencia_nombre, contacto_emergencia_telefono,
              cargo_id, departamento_personal_id, num_isss, num_nup, fecha_ingreso,
              tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
              es_activo, es_jubilado, en_vacaciones, incapacitado, comentarios } = req.body;

        if (!codigo) {
            const [maxResult] = await pool.query(
                `SELECT COALESCE(MAX(CAST(codigo AS UNSIGNED)), 0) + 1 as next FROM ${TABLE} WHERE company_id = ?`,
                [req.company_id]
            );
            codigo = String(maxResult[0].next).padStart(4, '0');
        }

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (company_id, codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
              ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
              contacto_emergencia_nombre, contacto_emergencia_telefono,
              cargo_id, departamento_personal_id, num_isss, num_nup, fecha_ingreso,
              tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
              es_activo, es_jubilado, en_vacaciones, incapacitado, comentarios)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
             ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
             contacto_emergencia_nombre, contacto_emergencia_telefono,
             cargo_id, departamento_personal_id, num_isss, num_nup, fecha_ingreso,
             tipo_contrato_id, sueldo_base || 0, bonificacion_fija || 0, cuenta_planillera,
             es_activo ?? 1, es_jubilado ?? 0, en_vacaciones ?? 0, incapacitado ?? 0, comentarios]
        );
        res.status(201).json({ id: result.insertId, codigo });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const updateEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
                ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
                contacto_emergencia_nombre, contacto_emergencia_telefono,
                cargo_id, departamento_personal_id, num_isss, num_nup, fecha_ingreso,
                tipo_contrato_id, sueldo_base, bonificacion_fija, cuenta_planillera,
                es_activo, es_jubilado, en_vacaciones, incapacitado, comentarios } = req.body;

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET codigo = ?, nombres = ?, apellidos = ?, fecha_nacimiento = ?, num_dui = ?, num_nit = ?, afp_id = ?,
             ocupacion = ?, direccion = ?, departamento = ?, municipio = ?, distrito = ?, telefono = ?, correo = ?,
             contacto_emergencia_nombre = ?, contacto_emergencia_telefono = ?,
             cargo_id = ?, departamento_personal_id = ?, num_isss = ?, num_nup = ?, fecha_ingreso = ?,
             tipo_contrato_id = ?, sueldo_base = ?, bonificacion_fija = ?, cuenta_planillera = ?,
             es_activo = ?, es_jubilado = ?, en_vacaciones = ?, incapacitado = ?, comentarios = ?
             WHERE id = ? AND company_id = ?`,
            [codigo, nombres, apellidos, fecha_nacimiento, num_dui, num_nit, afp_id,
             ocupacion, direccion, departamento, municipio, distrito, telefono, correo,
             contacto_emergencia_nombre, contacto_emergencia_telefono,
             cargo_id, departamento_personal_id, num_isss, num_nup, fecha_ingreso,
             tipo_contrato_id, sueldo_base || 0, bonificacion_fija || 0, cuenta_planillera,
             es_activo ?? 1, es_jubilado ?? 0, en_vacaciones ?? 0, incapacitado ?? 0, comentarios,
             id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ id, codigo });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `El código de ${LABEL} ya existe en esta empresa` });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteEmpleado = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ message: `${LABEL} eliminado` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Descuentos Programados Asignados ---

const getDescuentos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT ed.*, d.codigo as descuento_codigo, d.descripcion as descuento_nombre
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados d ON ed.descuento_id = d.id
             WHERE ed.empleado_id = ? AND ed.company_id = ?
             ORDER BY ed.id`,
            [id, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createDescuento = async (req, res) => {
    try {
        const { id } = req.params;
        const { descuento_id, quincena, valor, numero_cuotas, cuotas_restantes, numero_credito } = req.body;
        const [result] = await pool.query(
            `INSERT INTO rh_empleado_descuentos (company_id, empleado_id, descuento_id, quincena, valor, numero_cuotas, cuotas_restantes, numero_credito)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, id, descuento_id, quincena || 'primera', valor || 0, numero_cuotas || 1, cuotas_restantes ?? numero_cuotas ?? 1, numero_credito]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateDescuento = async (req, res) => {
    try {
        const { id, did } = req.params;
        const { descuento_id, quincena, valor, numero_cuotas, cuotas_restantes, numero_credito, activo } = req.body;
        const [result] = await pool.query(
            `UPDATE rh_empleado_descuentos SET descuento_id = ?, quincena = ?, valor = ?, numero_cuotas = ?, cuotas_restantes = ?, numero_credito = ?, activo = ?
             WHERE id = ? AND empleado_id = ? AND company_id = ?`,
            [descuento_id, quincena, valor, numero_cuotas, cuotas_restantes, numero_credito, activo ?? 1, did, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Descuento no encontrado' });
        res.json({ id: did });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteDescuento = async (req, res) => {
    try {
        const { id, did } = req.params;
        const [result] = await pool.query(
            `DELETE FROM rh_empleado_descuentos WHERE id = ? AND empleado_id = ? AND company_id = ?`,
            [did, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Descuento no encontrado' });
        res.json({ message: 'Descuento eliminado' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Indemnizaciones ---

const getIndemnizaciones = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM rh_indemnizaciones WHERE empleado_id = ? AND company_id = ? ORDER BY fecha_aplicacion DESC`,
            [id, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createIndemnizacion = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo, monto, fecha_aplicacion } = req.body;
        const [result] = await pool.query(
            `INSERT INTO rh_indemnizaciones (company_id, empleado_id, motivo, monto, fecha_aplicacion) VALUES (?, ?, ?, ?, ?)`,
            [req.company_id, id, motivo, monto || 0, fecha_aplicacion]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteIndemnizacion = async (req, res) => {
    try {
        const { id, iid } = req.params;
        const [result] = await pool.query(
            `DELETE FROM rh_indemnizaciones WHERE id = ? AND empleado_id = ? AND company_id = ?`,
            [iid, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Indemnización no encontrada' });
        res.json({ message: 'Indemnización eliminada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Ausencias ---

const getAusencias = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT * FROM rh_empleado_ausencias WHERE empleado_id = ? AND company_id = ? ORDER BY fecha_inicio DESC`,
            [id, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createAusencia = async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, fecha_inicio, fecha_fin, motivo, justificada } = req.body;
        const [result] = await pool.query(
            `INSERT INTO rh_empleado_ausencias (company_id, empleado_id, tipo, fecha_inicio, fecha_fin, motivo, justificada) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, id, tipo || 'falta', fecha_inicio, fecha_fin, motivo, justificada ?? 0]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAusencia = async (req, res) => {
    try {
        const { id, aid } = req.params;
        const { tipo, fecha_inicio, fecha_fin, motivo, justificada } = req.body;
        const [result] = await pool.query(
            `UPDATE rh_empleado_ausencias SET tipo = ?, fecha_inicio = ?, fecha_fin = ?, motivo = ?, justificada = ? WHERE id = ? AND empleado_id = ? AND company_id = ?`,
            [tipo || 'falta', fecha_inicio, fecha_fin, motivo, justificada ?? 0, aid, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Ausencia no encontrada' });
        res.json({ id: aid });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAusencia = async (req, res) => {
    try {
        const { id, aid } = req.params;
        const [result] = await pool.query(
            `DELETE FROM rh_empleado_ausencias WHERE id = ? AND empleado_id = ? AND company_id = ?`,
            [aid, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Ausencia no encontrada' });
        res.json({ message: 'Ausencia eliminada' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Historial de indemnizaciones (desde liquidaciones) ---

const getHistorialIndemnizaciones = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT periodo_año, periodo_mes,
                    periodo_indemnizacion_desde, periodo_indemnizacion_hasta,
                    dias_indemnizacion, total_indemnizacion, total_devengado,
                    monto_recibir, pago_cuotas, cuotas, pago_por_cuota
             FROM rh_planilla_liquidaciones
             WHERE empleado_id = ? AND company_id = ? AND total_indemnizacion > 0
             ORDER BY periodo_año DESC, periodo_mes DESC, id DESC`,
            [id, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getEmpleados, getEmpleado, getNextCode, createEmpleado, updateEmpleado, deleteEmpleado,
    getDescuentos, createDescuento, updateDescuento, deleteDescuento,
    getIndemnizaciones, createIndemnizacion, deleteIndemnizacion,
    getAusencias, createAusencia, updateAusencia, deleteAusencia, getHistorialIndemnizaciones
};
