const pool = require('../../config/db');
const { benefitRevision } = require('../../services/rhBenefitsPersistence.service');
const TABLE = 'rh_planilla_liquidaciones';
const LABEL = 'Planilla de Liquidaciones';

const getLiquidaciones = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, año, mes } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT pl.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} pl
            JOIN rh_empleados e ON pl.empleado_id = e.id AND e.company_id = pl.company_id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE pl.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pl.periodo_año = ?`;
            params.push(parseInt(año));
        }
        if (mes) {
            query += ` AND pl.periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY pl.periodo_año DESC, pl.periodo_mes DESC, pl.id DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows.map(row => ({ ...row, revision: benefitRevision('liquidaciones', row) })), total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getLiquidacion = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT pl.*, 
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.sueldo_base,
                    e.cargo_id,
                    e.departamento_personal_id,
                    e.afp_id,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM ${TABLE} pl
             JOIN rh_empleados e ON pl.empleado_id = e.id AND e.company_id = pl.company_id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE pl.id = ? AND pl.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });
        res.json({ ...rows[0], revision: benefitRevision('liquidaciones', rows[0]) });
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

const getUltimaLiquidacion = async (req, res) => {
    try {
        const { empleado_id } = req.params;
        // Primero buscar la última liquidación que tuvo período de indemnización registrado
        const [rows] = await pool.query(
            `SELECT * FROM ${TABLE} 
             WHERE empleado_id = ? AND company_id = ? AND periodo_indemnizacion_hasta IS NOT NULL 
             ORDER BY periodo_indemnizacion_hasta DESC, id DESC LIMIT 1`,
            [empleado_id, req.company_id]
        );
        if (rows.length > 0) {
            return res.json(rows[0]);
        }
        // Si no hay con indemnización, buscar cualquier liquidación previa del empleado
        const [fallbackRows] = await pool.query(
            `SELECT * FROM ${TABLE} 
             WHERE empleado_id = ? AND company_id = ? 
             ORDER BY id DESC LIMIT 1`,
            [empleado_id, req.company_id]
        );
        res.json(fallbackRows.length > 0 ? fallbackRows[0] : null);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getLiquidaciones, getLiquidacion, getEmpleadoData, getUltimaLiquidacion };
