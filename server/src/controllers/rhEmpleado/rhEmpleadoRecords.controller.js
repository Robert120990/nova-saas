const pool = require('../../config/db');
const TABLE = 'rh_empleados';
const LABEL = 'Empleado';

const getDescuentos = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT ed.*, d.codigo as descuento_codigo, d.descripcion as descuento_nombre,
                    d.cuenta_id, cp.codigo as cuenta_codigo, cp.descripcion as cuenta_descripcion
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados d ON ed.descuento_id = d.id
             LEFT JOIN rh_cuentas_planillas cp ON d.cuenta_id = cp.id
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
module.exports = { getDescuentos, createDescuento, updateDescuento, deleteDescuento, getIndemnizaciones, createIndemnizacion, deleteIndemnizacion, getAusencias, createAusencia, updateAusencia, deleteAusencia, getHistorialIndemnizaciones };
