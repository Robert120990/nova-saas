const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v302] Creando tabla sys_idempotency_keys para soporte de peticiones idempotentes...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sys_idempotency_keys (
            id INT AUTO_INCREMENT PRIMARY KEY,
            idempotency_key VARCHAR(64) NOT NULL,
            company_id INT NOT NULL,
            user_id INT NULL,
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(10) NOT NULL,
            status_code INT NOT NULL,
            response_body LONGTEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_key_company (idempotency_key, company_id),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[Migration v302] Tabla sys_idempotency_keys creada o verificada con éxito.');
}

if (require.main === module) {
    up()
        .then(() => {
            console.log('[Migration v302] Completada con éxito.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration v302] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
