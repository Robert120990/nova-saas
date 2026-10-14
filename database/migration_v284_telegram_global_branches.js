const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v284] Permitiendo sucursales globales (NULL) en telegram_chat_bindings...');

    // Permitir branch_id NULL en telegram_chat_bindings
    await pool.query('ALTER TABLE telegram_chat_bindings MODIFY branch_id INT NULL');

    // Actualizar vinculaciones existentes para administradores (como chat de Robert) a NULL (Acceso Global)
    await pool.query('UPDATE telegram_chat_bindings SET branch_id = NULL WHERE branch_id IS NOT NULL');

    console.log('[Migration v284] Migración v284 ejecutada exitosamente.');
}

module.exports = { up };
