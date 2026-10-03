const pool = require('../../config/db');
const TABLE = 'rh_empleados';
const LABEL = 'Empleado';

const getEmpleados = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, solo_activos, cargo_id, departamento_personal_id, branch_id, estado } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT e.*, 
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   a.descripcion as afp_nombre,
                   tc.descripcion as tipo_contrato_nombre,
                   b.nombre as sucursal_nombre,
                   (SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT('id', ec.id, 'nombre', ec.nombre, 'telefono', ec.telefono, 'parentesco', ec.parentesco)), '[]')
                    FROM rh_empleado_emergency_contacts ec WHERE ec.empleado_id = e.id
                   ) AS emergency_contacts
            FROM ${TABLE} e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_afp a ON e.afp_id = a.id
            LEFT JOIN rh_tipos_contrato tc ON e.tipo_contrato_id = tc.id
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE e.company_id = ?
        `;
        let params = [req.company_id];

        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ? OR e.num_dui LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        if (cargo_id && cargo_id !== 'all' && cargo_id !== '') {
            query += ` AND e.cargo_id = ?`;
            params.push(parseInt(cargo_id));
        }

        if (departamento_personal_id && departamento_personal_id !== 'all' && departamento_personal_id !== '') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_personal_id));
        }

        if (branch_id && branch_id !== 'all' && branch_id !== '') {
            query += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        if (estado === 'activo' || estado === '1' || solo_activos === '1' || solo_activos === 'true') {
            query += ` AND e.es_activo = 1`;
        } else if (estado === 'inactivo' || estado === '0') {
            query += ` AND e.es_activo = 0`;
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
                   tc.descripcion as tipo_contrato_nombre,
                   b.nombre as sucursal_nombre,
                   (SELECT IFNULL(JSON_ARRAYAGG(JSON_OBJECT('id', ec.id, 'nombre', ec.nombre, 'telefono', ec.telefono, 'parentesco', ec.parentesco)), '[]')
                    FROM rh_empleado_emergency_contacts ec WHERE ec.empleado_id = e.id
                   ) AS emergency_contacts
            FROM ${TABLE} e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_afp a ON e.afp_id = a.id
            LEFT JOIN rh_tipos_contrato tc ON e.tipo_contrato_id = tc.id
            LEFT JOIN branches b ON e.branch_id = b.id
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
module.exports = { getEmpleados, getEmpleado, getNextCode };
