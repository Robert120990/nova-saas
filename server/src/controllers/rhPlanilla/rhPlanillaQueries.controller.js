const { pool, TABLE, LABEL, parseIdList } = require('../../services/rhPayroll/shared');

const { payrollRevision } = require('../../services/rhPayroll/revision.service');
const { executePayrollMutation } = require('../../services/rhPayroll/transaction.service');
const getPlanillas = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, anio, mes, quincena, branch_ids, departamento_ids } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.sueldo_base as empleado_sueldo_base,
                   e.cuenta_planillera,
                   e.branch_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.company_id = ?
        `;
        let params = [req.company_id];

        if (anio) {
            query += ` AND p.periodo_anio = ?`;
            params.push(parseInt(anio));
        }
        if (mes) {
            query += ` AND p.periodo_mes = ?`;
            params.push(parseInt(mes));
        }
        if (quincena) {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        if (search) {
            query += ` AND (e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        const branchList = parseIdList(branch_ids);
        if (branchList.length > 0) {
            query += ` AND e.branch_id IN (?)`;
            params.push(branchList);
        }
        const deptoList = parseIdList(departamento_ids);
        if (deptoList.length > 0) {
            query += ` AND e.departamento_personal_id IN (?)`;
            params.push(deptoList);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY p.periodo_anio DESC, p.periodo_mes DESC, p.quincena, e.codigo ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPlanilla = async (req, res, pool) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT p.*, 
                    e.codigo as empleado_codigo,
                    e.nombres as empleado_nombres,
                    e.apellidos as empleado_apellidos,
                    e.sueldo_base as empleado_sueldo_base,
                    e.bonificacion_fija as empleado_bonificacion_fija,
                    e.num_dui,
                    e.num_nit,
                    e.fecha_ingreso,
                    e.afp_id,
                    e.es_jubilado,
                    e.cargo_id,
                    e.departamento_personal_id,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM ${TABLE} p
             JOIN rh_empleados e ON p.empleado_id = e.id
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE p.id = ? AND p.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrada` });

        const planilla = rows[0];

        const [detalles] = await pool.query(
            `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
            [id]
        );

        planilla.detalles = detalles;
        planilla.revision = payrollRevision(planilla, detalles);
        res.json(planilla);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getGruposPlanilla = async (req, res) => {
    try {
        const { anio, mes, quincena, page: pageQ, limit: limitQ } = req.query;
        const page = parseInt(pageQ) || 1;
        const limit = parseInt(limitQ) || 20;
        const offset = (page - 1) * limit;

        let where = 'WHERE p.company_id = ?';
        const params = [req.company_id];

        if (anio) { where += ' AND p.periodo_anio = ?'; params.push(anio); }
        if (mes) { where += ' AND p.periodo_mes = ?'; params.push(mes); }
        if (quincena) { where += ' AND p.quincena = ?'; params.push(quincena); }

        const [countRows] = await pool.query(
            `SELECT COUNT(DISTINCT CONCAT(p.periodo_anio, '-', p.periodo_mes, '-', p.quincena)) as total FROM ${TABLE} p ${where}`,
            params
        );
        const total = countRows[0].total;

        const [rows] = await pool.query(
            `SELECT p.periodo_anio, p.periodo_mes, p.quincena,
                    COUNT(*) as total_empleados,
                    ROUND(SUM(p.sueldo_base), 2) as total_sueldos,
                    ROUND(SUM((p.sueldo_base / 30) * COALESCE(p.dias_trabajados, 15)), 2) as total_sueldos_quincenal,
                    ROUND(GREATEST(0, SUM(p.total_percepciones) - SUM((p.sueldo_base / 30) * COALESCE(p.dias_trabajados, 15))), 2) as total_ingresos_adic,
                    ROUND(SUM(p.total_percepciones), 2) as total_percepciones,
                    ROUND(SUM(p.total_deducciones), 2) as total_deducciones,
                    ROUND(SUM(p.descuento_isss), 2) as total_isss,
                    ROUND(SUM(p.descuento_afp), 2) as total_afp,
                    ROUND(SUM(p.descuento_renta), 2) as total_renta,
                    ROUND(SUM(p.monto_recibir), 2) as total_neto,
                    MIN(p.estado) as estado_general
             FROM ${TABLE} p
             ${where}
             GROUP BY p.periodo_anio, p.periodo_mes, p.quincena
             ORDER BY p.periodo_anio DESC, p.periodo_mes DESC, FIELD(p.quincena, 'primera', 'segunda')
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const totalPages = Math.ceil(total / limit);
        res.json({ data: rows, total, page, totalPages });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPlanillasAbiertas = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.periodo_anio, p.periodo_mes, p.quincena, COUNT(*) as total_empleados
             FROM ${TABLE} p
             WHERE p.company_id = ? AND p.estado != 'pagada'
             GROUP BY p.periodo_anio, p.periodo_mes, p.quincena
             ORDER BY p.periodo_anio DESC, p.periodo_mes DESC, FIELD(p.quincena, 'primera', 'segunda')`,
            [req.company_id]
        );
        res.json({
            tiene_abiertas: rows.length > 0,
            total_abiertas: rows.length,
            planillas_abiertas: rows
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getCuentasActivas = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPlanillas, getGruposPlanilla, getPlanillasAbiertas, getCuentasActivas,
    getPlanilla: async (req, res) => {
        const result = await executePayrollMutation(getPlanilla, req);
        res.status(result.statusCode).json(result.body);
    }
};
