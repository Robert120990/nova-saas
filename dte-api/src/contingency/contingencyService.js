/**
 * DTE Contingency Service
 */

const pool = require('../../config/db');

async function startContingency(payload) {
    const { motivo } = payload;
    const now = new Date();

    const [result] = await pool.query(
        'INSERT INTO dte_contingencies (fecha_inicio, motivo, estado) VALUES (?, ?, ?)',
        [now, motivo, 'OPEN']
    );

    return {
        success: true,
        contingencyId: result.insertId,
        message: 'Modo contingencia activado'
    };
}

async function stopContingency(contingencyId) {
    const now = new Date();

    await pool.query(
        'UPDATE dte_contingencies SET fecha_fin = ?, estado = ? WHERE id = ?',
        [now, 'CLOSED', contingencyId]
    );

    // Trigger background process (optional, or just wait for the cron)
    return {
        success: true,
        message: 'Modo contingencia desactivado. Iniciando reenvío de documentos.'
    };
}

async function addToContingencyQueue(payload) {
    const { codigoGeneracion, tipoDocumento, jsonDte, jsonFirmado } = payload;
    const now = new Date();

    await pool.query(
        'INSERT INTO dte_contingency_documents (codigo_generacion, tipo_documento, json_dte, json_firmado, estado_envio, fecha_generacion) VALUES (?, ?, ?, ?, ?, ?)',
        [codigoGeneracion, tipoDocumento, JSON.stringify(jsonDte), jsonFirmado, 'PENDING', now]
    );

    // Also update the original DTE if it exists
    await pool.query(
        'UPDATE dtes SET status = "CONTINGENCIA_PENDIENTE" WHERE codigo_generacion = ?',
        [codigoGeneracion]
    );

    return { success: true };
}

async function getContingencyStatus() {
    const [rows] = await pool.query(
        'SELECT * FROM dte_contingencies ORDER BY created_at DESC LIMIT 5'
    );
    
    const [stats] = await pool.query(
        'SELECT estado_envio, COUNT(*) as count FROM dte_contingency_documents GROUP BY estado_envio'
    );

    return {
        success: true,
        history: rows,
        stats: stats
    };
}

module.exports = { startContingency, stopContingency, addToContingencyQueue, getContingencyStatus };
