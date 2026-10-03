const pool = require('../../config/db');
const TABLE = 'rh_planilla_quincena25';

const calculationService = require('../../services/rhPayroll/rhQuincena25Calculation.service');
const getResumen = async (req, res) => {
    try {
        const { año } = req.query;
        let query = `
            SELECT pq.periodo_anio, pq.filtro_departamento_id,
                   d.descripcion as departamento_nombre,
                   COUNT(*) as total_empleados,
                   SUM(CASE WHEN pq.monto_recibir > 0 THEN 1 ELSE 0 END) as total_beneficiarios,
                   SUM(pq.monto_recibir) as total_monto,
                   MAX(pq.estado) as estado,
                   MAX(pq.fecha_pago) as fecha_pago
            FROM ${TABLE} pq
            LEFT JOIN rh_departamentos d ON pq.filtro_departamento_id = d.id
            WHERE pq.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pq.periodo_anio = ?`;
            params.push(parseInt(año));
        }

        query += ` GROUP BY pq.periodo_anio, pq.filtro_departamento_id, d.descripcion
                   ORDER BY pq.periodo_anio DESC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('[Quincena25 getResumen] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const getPlanilla = async (req, res) => {
    try {
        const { año, departamento_id, branch_id } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pq.*, 
                   e.codigo,
                   e.nombres,
                   e.apellidos,
                   e.num_dui,
                   e.num_nit,
                   e.cuenta_planillera,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   b.nombre as sucursal_nombre
            FROM ${TABLE} pq
            JOIN rh_empleados e ON pq.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE pq.company_id = ? AND pq.periodo_anio = ?
        `;
        let params = [req.company_id, parseInt(año)];

        if (departamento_id && departamento_id !== 'all' && departamento_id !== '0') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }
        if (branch_id && branch_id !== 'all' && branch_id !== '0') {
            query += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        query += ` ORDER BY e.codigo ASC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('[Quincena25 getPlanilla] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const calcular = async (req, res) => {
    try {
        res.json(await calculationService.calculate(req.query, req.company_id));
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { getResumen, getPlanilla, calcular };
