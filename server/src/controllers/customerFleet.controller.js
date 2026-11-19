const pool = require('../config/db');

/**
 * List fleet vehicles for a customer within the active company.
 */
const getFleets = async (req, res) => {
    const { customer_id, only_active } = req.query;
    if (!customer_id) {
        return res.status(400).json({ message: 'customer_id es requerido' });
    }
    try {
        let sql = 'SELECT * FROM customer_fleets WHERE customer_id = ? AND company_id = ?';
        const params = [customer_id, req.company_id];

        if (only_active === '1' || only_active === 'true') {
            sql += ' AND activo = 1';
        }
        sql += ' ORDER BY activo DESC, placa ASC';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener flotas del cliente:', error);
        res.status(500).json({ message: 'Error al obtener flotas del cliente' });
    }
};

/**
 * Create a new fleet vehicle for a customer.
 */
const createFleet = async (req, res) => {
    const {
        customer_id,
        placa,
        motorista,
        documento_motorista,
        telefono_motorista,
        codigo_interno,
        tipo_vehiculo,
        marca,
        modelo,
        anio,
        color,
        tipo_combustible,
        observaciones,
        activo = 1
    } = req.body;

    const normalizedPlate = String(placa || '').trim().toUpperCase();
    if (!customer_id || !normalizedPlate) {
        return res.status(400).json({ message: 'El cliente y la placa son requeridos' });
    }

    try {
        const [custRows] = await pool.query(
            'SELECT id FROM customers WHERE id = ? AND company_id = ?',
            [customer_id, req.company_id]
        );
        if (!custRows.length) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }

        const [result] = await pool.query(
            `INSERT INTO customer_fleets (
                customer_id, company_id, placa, motorista, documento_motorista, telefono_motorista,
                codigo_interno, tipo_vehiculo, marca, modelo, anio, color, tipo_combustible,
                observaciones, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customer_id,
                req.company_id,
                normalizedPlate,
                motorista || null,
                documento_motorista || null,
                telefono_motorista || null,
                codigo_interno || null,
                tipo_vehiculo || null,
                marca || null,
                modelo || null,
                anio || null,
                color || null,
                tipo_combustible || null,
                observaciones || null,
                activo ? 1 : 0
            ]
        );

        const [rows] = await pool.query(
            'SELECT * FROM customer_fleets WHERE id = ? AND company_id = ?',
            [result.insertId, req.company_id]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'Ya existe un vehículo con esa placa registrado para este cliente'
            });
        }
        console.error('Error al crear vehículo de flota:', error);
        res.status(500).json({ message: 'Error al registrar vehículo en la flota' });
    }
};

/**
 * Update an existing fleet vehicle scoped by company_id.
 */
const updateFleet = async (req, res) => {
    const { id } = req.params;
    const {
        placa,
        motorista,
        documento_motorista,
        telefono_motorista,
        codigo_interno,
        tipo_vehiculo,
        marca,
        modelo,
        anio,
        color,
        tipo_combustible,
        observaciones,
        activo = 1
    } = req.body;

    const normalizedPlate = String(placa || '').trim().toUpperCase();
    if (!normalizedPlate) {
        return res.status(400).json({ message: 'La placa del vehículo es requerida' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE customer_fleets
             SET placa = ?, motorista = ?, documento_motorista = ?, telefono_motorista = ?,
                 codigo_interno = ?, tipo_vehiculo = ?, marca = ?, modelo = ?, anio = ?,
                 color = ?, tipo_combustible = ?, observaciones = ?, activo = ?
             WHERE id = ? AND company_id = ?`,
            [
                normalizedPlate,
                motorista || null,
                documento_motorista || null,
                telefono_motorista || null,
                codigo_interno || null,
                tipo_vehiculo || null,
                marca || null,
                modelo || null,
                anio || null,
                color || null,
                tipo_combustible || null,
                observaciones || null,
                activo ? 1 : 0,
                id,
                req.company_id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Vehículo de flota no encontrado' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM customer_fleets WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        res.json(rows[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'Ya existe otro vehículo con esa placa registrado para este cliente'
            });
        }
        console.error('Error al actualizar vehículo de flota:', error);
        res.status(500).json({ message: 'Error al actualizar vehículo de flota' });
    }
};

/**
 * Delete a fleet vehicle scoped by company_id.
 */
const deleteFleet = async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.query(
            'DELETE FROM customer_fleets WHERE id = ? AND company_id = ?',
            [id, req.company_id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Vehículo de flota no encontrado' });
        }
        res.json({ message: 'Vehículo de flota eliminado' });
    } catch (error) {
        console.error('Error al eliminar vehículo de flota:', error);
        res.status(500).json({ message: 'Error al eliminar vehículo de flota' });
    }
};

module.exports = {
    getFleets,
    createFleet,
    updateFleet,
    deleteFleet
};
