const { pool, broadcastToCompany } = require('./shared');

const reopenBatchPackaging = (req, res) => require('../eggPackaging.controller').reopenBatchPackaging(req, res);

const getHoldingTemperatures = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM egg_holding_temperatures WHERE company_id = ? ORDER BY created_at DESC LIMIT 50`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

const createHoldingTemperature = async (req, res) => {
    try {
        const { tank_id, temperature_c, humidity_percentage } = req.body;
        const company_id = req.company_id;

        // Regla: Cadena de frío debe estar entre 2.0 y 6.0 grados Celsius
        let alarm_triggered = false;
        let alarm_reason = null;

        if (temperature_c < 2.0 || temperature_c > 6.0) {
            alarm_triggered = true;
            alarm_reason = `Temperatura de ${temperature_c}C fuera del rango crítico industrial de 2.0C a 6.0C.`;
        }

        const [result] = await pool.query(
            `INSERT INTO egg_holding_temperatures (company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason]
        );

        if (alarm_triggered) {
            // Registrar evento de advertencia
            await pool.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload)
                 VALUES (?, 'temperature.alert', 'warning', ?, ?)`,
                [company_id, `Desviación en cadena de frío: ${tank_id} reporta ${temperature_c}C.`, JSON.stringify({ tank_id, temperature_c, limit: '2.0C a 6.0C' })]
            );

            // Broadcast websocket
            broadcastToCompany(company_id, 'tank_alert', {
                tankId: tank_id,
                temp: temperature_c,
                message: `ALERTA DE TEMPERATURA: El tanque ${tank_id} ha registrado ${temperature_c}°C, saliendo del límite establecido.`
            });
        }

        res.status(201).json({ id: result.insertId, alarm_triggered, alarm_reason });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};
module.exports = { reopenBatchPackaging, getHoldingTemperatures, createHoldingTemperature };
