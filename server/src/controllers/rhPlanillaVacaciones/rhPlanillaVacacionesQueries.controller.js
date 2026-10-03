const pool = require('../../config/db');
const { benefitRevision } = require('../../services/rhBenefitsPersistence.service');
const TABLE = 'rh_planilla_vacaciones';
const LABEL = 'Planilla de Vacaciones';

const getPlanillas = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, año, mes } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT pv.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} pv
            JOIN rh_empleados e ON pv.empleado_id = e.id AND e.company_id = pv.company_id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pv.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pv.periodo_año = ?`;
            params.push(parseInt(año));
        }
        if (mes) {
            query += ` AND pv.periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY pv.periodo_año DESC, pv.periodo_mes DESC, pv.id DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows.map(row => ({ ...row, revision: benefitRevision('vacaciones', row) })), total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPlanilla = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT pv.*, 
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.sueldo_base,
                    e.cargo_id,
                    e.departamento_personal_id,
                    e.afp_id,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM ${TABLE} pv
             JOIN rh_empleados e ON pv.empleado_id = e.id AND e.company_id = pv.company_id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE pv.id = ? AND pv.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ ...rows[0], revision: benefitRevision('vacaciones', rows[0]) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getEmpleadoData = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.bonificacion_fija,
                    e.afp_id, e.cargo_id, e.departamento_personal_id, e.fecha_ingreso,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM rh_empleados e
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE e.id = ? AND e.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getUltimaVacacion = async (req, res) => {
    try {
        const { empleado_id } = req.params;
        // Most recent vacation record ordered by the final date of the service period
        const [rows] = await pool.query(
            `SELECT * FROM ${TABLE}
             WHERE empleado_id = ? AND company_id = ? AND fecha_final IS NOT NULL
             ORDER BY fecha_final DESC, id DESC LIMIT 1`,
            [empleado_id, req.company_id]
        );
        res.json(rows.length > 0 ? rows[0] : null);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getPlanillas, getPlanilla, getEmpleadoData, getUltimaVacacion };
