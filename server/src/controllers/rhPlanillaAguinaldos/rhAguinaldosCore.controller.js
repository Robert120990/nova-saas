const pool = require('../../config/db');
const TABLE = 'rh_planilla_aguinaldos';

const calculationService = require('../../services/rhPayroll/rhAguinaldosCalculation.service');
const { parseIdList } = require('../../services/rhPayroll/shared');

const getResumen = async (req, res) => {
    try {
        await calculationService.ensureAguinaldosSchema();
        const { año } = req.query;
        let query = `
            SELECT pa.periodo_año, pa.periodo_mes, pa.filtro_departamento_id,
                   d.descripcion as departamento_nombre,
                   COUNT(*) as total_empleados,
                   SUM(pa.monto_recibir) as total_monto
            FROM rh_planilla_aguinaldos pa
            LEFT JOIN rh_departamentos d ON pa.filtro_departamento_id = d.id
            WHERE pa.company_id = ?
        `;
        let params = [req.company_id];

        if (año) {
            query += ` AND pa.periodo_año = ?`;
            params.push(parseInt(año));
        }

        query += ` GROUP BY pa.periodo_año, pa.periodo_mes, pa.filtro_departamento_id, d.descripcion
                   ORDER BY pa.periodo_año DESC, pa.periodo_mes DESC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPlanilla = async (req, res) => {
    try {
        await calculationService.ensureAguinaldosSchema();
        const { año, mes, departamento_id, branch_ids, departamento_ids } = req.query;
        if (!año) return res.status(400).json({ message: 'año requerido' });

        let query = `
            SELECT pa.*, 
                   e.codigo,
                   e.nombres,
                   e.apellidos,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.num_nit,
                   e.cuenta_planillera,
                   e.aplica_renta,
                   e.es_jubilado,
                   e.es_jubilado_con_afp,
                   e.branch_id,
                   COALESCE(b.nombre, 'SIN SUCURSAL') as branch_nombre,
                   COALESCE(pa.departamento_personal_id, e.departamento_personal_id) as departamento_personal_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} pa
            JOIN rh_empleados e ON pa.empleado_id = e.id
            LEFT JOIN branches b ON e.branch_id = b.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON COALESCE(pa.departamento_personal_id, e.departamento_personal_id) = d.id
            WHERE pa.company_id = ? AND pa.periodo_año = ?
        `;
        let params = [req.company_id, parseInt(año)];

        if (mes) {
            query += ` AND pa.periodo_mes = ?`;
            params.push(parseInt(mes));
        }

        const branchList = parseIdList(branch_ids);
        if (branchList.length > 0) {
            query += ` AND e.branch_id IN (?)`;
            params.push(branchList);
        }

        const deptoList = parseIdList(departamento_ids);
        if (deptoList.length > 0) {
            query += ` AND COALESCE(pa.departamento_personal_id, e.departamento_personal_id) IN (?)`;
            params.push(deptoList);
        } else if (departamento_id && departamento_id !== '0') {
            query += ` AND (pa.filtro_departamento_id = ? OR COALESCE(pa.departamento_personal_id, e.departamento_personal_id) = ?)`;
            params.push(parseInt(departamento_id), parseInt(departamento_id));
        }

        query += ` ORDER BY e.codigo ASC`;
        const [rows] = await pool.query(query, params);
        const pgrEmployeeIds = await calculationService.getActivePgrEmployeeIds(req.company_id);

        const enriched = rows.map(row => ({
            ...row,
            procuraduria: parseFloat(row.procuraduria || 0),
            aplica_procuraduria: (parseFloat(row.procuraduria || 0) > 0 || pgrEmployeeIds.has(Number(row.empleado_id))) ? 1 : 0
        }));

        res.json(enriched);
    } catch (error) {
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
