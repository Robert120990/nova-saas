const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v299] Configurando flujo Consola AGY y aprobación de planes por Telegram en support_tickets...');

    const [cols] = await pool.query('SHOW COLUMNS FROM support_tickets');
    const colNames = cols.map((c) => c.Field);

    const newColumns = [
        {
            name: 'agy_status',
            sql: "ADD COLUMN agy_status VARCHAR(40) NOT NULL DEFAULT 'idle' AFTER ai_notes"
        },
        {
            name: 'agy_model',
            sql: "ADD COLUMN agy_model VARCHAR(100) NULL DEFAULT 'gemini-4-argon-high' AFTER agy_status"
        },
        {
            name: 'agy_plan_markdown',
            sql: 'ADD COLUMN agy_plan_markdown LONGTEXT NULL AFTER agy_model'
        },
        {
            name: 'agy_plan_version',
            sql: 'ADD COLUMN agy_plan_version INT NOT NULL DEFAULT 0 AFTER agy_plan_markdown'
        },
        {
            name: 'agy_execution_log',
            sql: 'ADD COLUMN agy_execution_log LONGTEXT NULL AFTER agy_plan_version'
        },
        {
            name: 'agy_feedback_history',
            sql: 'ADD COLUMN agy_feedback_history JSON NULL AFTER agy_execution_log'
        },
        {
            name: 'agy_approved_by',
            sql: 'ADD COLUMN agy_approved_by VARCHAR(150) NULL AFTER agy_feedback_history'
        },
        {
            name: 'agy_updated_at',
            sql: 'ADD COLUMN agy_updated_at DATETIME NULL AFTER agy_approved_by'
        }
    ];

    for (const col of newColumns) {
        if (!colNames.includes(col.name)) {
            await pool.query(`ALTER TABLE support_tickets ${col.sql}`);
            console.log(`  → Columna ${col.name} agregada a support_tickets.`);
        }
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS agy_server_settings (
            id INT PRIMARY KEY DEFAULT 1,
            ssh_host VARCHAR(120) NOT NULL DEFAULT 'localhost',
            ssh_port INT NOT NULL DEFAULT 22,
            ssh_user VARCHAR(100) NOT NULL DEFAULT 'root',
            ssh_password VARCHAR(255) NULL,
            ssh_private_key_path VARCHAR(500) NULL,
            project_path VARCHAR(500) NOT NULL DEFAULT '/opt/nova-saas',
            agy_command VARCHAR(255) NOT NULL DEFAULT 'agy',
            default_model VARCHAR(100) NOT NULL DEFAULT 'gemini-4-argon-high',
            execution_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
        INSERT IGNORE INTO agy_server_settings
        (id, ssh_host, ssh_port, ssh_user, project_path, agy_command, default_model, execution_mode)
        VALUES (1, 'localhost', 22, 'root', '/opt/nova-saas', 'agy', 'gemini-4-argon-high', 'auto')
    `);

    console.log('[Migration v299] Migración v299 completada exitosamente.');
}

if (require.main === module) {
    up()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[Migration v299] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
