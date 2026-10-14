const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v285] Agregando configuración para solicitudes de reapertura en telegram_settings y telegram_chat_bindings...');

    // 1. Agregar reopen_requests_active a telegram_settings si no existe
    const [colsSettings] = await pool.query(
        "SHOW COLUMNS FROM telegram_settings LIKE 'reopen_requests_active'"
    );
    if (colsSettings.length === 0) {
        await pool.query(
            "ALTER TABLE telegram_settings ADD COLUMN reopen_requests_active TINYINT(1) DEFAULT 1 AFTER daily_briefing_active"
        );
        console.log('[Migration v285] Columna reopen_requests_active agregada a telegram_settings.');
    }

    // 2. Agregar receive_reopen_requests a telegram_chat_bindings si no existe
    const [colsBindings] = await pool.query(
        "SHOW COLUMNS FROM telegram_chat_bindings LIKE 'receive_reopen_requests'"
    );
    if (colsBindings.length === 0) {
        await pool.query(
            "ALTER TABLE telegram_chat_bindings ADD COLUMN receive_reopen_requests TINYINT(1) DEFAULT 1 AFTER receive_alerts"
        );
        console.log('[Migration v285] Columna receive_reopen_requests agregada a telegram_chat_bindings.');
    }

    console.log('[Migration v285] Migración v285 ejecutada exitosamente.');
}

module.exports = { up };
