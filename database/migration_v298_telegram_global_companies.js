const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v298] Permitiendo empresas globales (NULL) en telegram_chat_bindings y telegram_invite_tokens...');

    // 1. Permitir company_id NULL en telegram_chat_bindings para administradores globales multi-empresa
    await pool.query('ALTER TABLE telegram_chat_bindings MODIFY company_id INT NULL');
    console.log('  → Columna company_id en telegram_chat_bindings modificada a INT NULL.');

    // 2. Permitir company_id NULL en telegram_invite_tokens
    await pool.query('ALTER TABLE telegram_invite_tokens MODIFY company_id INT NULL');
    console.log('  → Columna company_id en telegram_invite_tokens modificada a INT NULL.');

    // 3. Configurar acceso global multi-empresa (company_id = NULL) para los administradores globales ya vinculados
    // que tienen branch_id IS NULL y permisos de aprobación/reapertura
    await pool.query(`
        UPDATE telegram_chat_bindings
        SET company_id = NULL
        WHERE branch_id IS NULL
          AND (can_approve_entries = 1 OR receive_reopen_requests = 1)
    `);
    console.log('  → Administradores globales actualizados a company_id = NULL (Todas las Empresas).');

    console.log('[Migration v298] Migración v298 completada exitosamente.');
}

if (require.main === module) {
    up()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[Migration v298] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
