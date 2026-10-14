const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v287] Creando tabla de invitaciones de Telegram y columnas de permisos granulares...');

    // 1. Agregar columnas de permisos granulares a telegram_chat_bindings si no existen
    const [cols] = await pool.query("SHOW COLUMNS FROM telegram_chat_bindings");
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('allowed_agents')) {
        await pool.query(`
            ALTER TABLE telegram_chat_bindings 
            ADD COLUMN allowed_agents JSON NULL AFTER receive_reopen_requests
        `);
        console.log('[Migration v287] Columna allowed_agents agregada.');
    }

    if (!colNames.includes('can_approve_entries')) {
        await pool.query(`
            ALTER TABLE telegram_chat_bindings 
            ADD COLUMN can_approve_entries TINYINT(1) DEFAULT 0 AFTER allowed_agents
        `);
        console.log('[Migration v287] Columna can_approve_entries agregada.');
    }

    if (!colNames.includes('receive_inventory_alerts')) {
        await pool.query(`
            ALTER TABLE telegram_chat_bindings 
            ADD COLUMN receive_inventory_alerts TINYINT(1) DEFAULT 1 AFTER can_approve_entries
        `);
        console.log('[Migration v287] Columna receive_inventory_alerts agregada.');
    }

    if (!colNames.includes('receive_dte_alerts')) {
        await pool.query(`
            ALTER TABLE telegram_chat_bindings 
            ADD COLUMN receive_dte_alerts TINYINT(1) DEFAULT 1 AFTER receive_inventory_alerts
        `);
        console.log('[Migration v287] Columna receive_dte_alerts agregada.');
    }

    // 2. Crear tabla telegram_invite_tokens para Deep Linking y códigos QR
    await pool.query(`
        CREATE TABLE IF NOT EXISTS telegram_invite_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            token VARCHAR(64) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            branch_id INT NULL,
            assigned_name VARCHAR(100) NULL,
            permissions_template JSON NULL,
            created_by INT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP NULL,
            used_by_chat_id BIGINT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_invite_token (token),
            KEY idx_invite_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Establecer permisos por defecto para las vinculaciones existentes (todas las capacidades para administradores actuales)
    const allAgentsJson = JSON.stringify(['accounting', 'dte', 'sales', 'inventory', 'gas', 'operations']);
    await pool.query(`
        UPDATE telegram_chat_bindings 
        SET allowed_agents = ?, can_approve_entries = 1
        WHERE allowed_agents IS NULL
    `, [allAgentsJson]);

    console.log('[Migration v287] Migración v287 completada exitosamente.');
}

module.exports = { up };
