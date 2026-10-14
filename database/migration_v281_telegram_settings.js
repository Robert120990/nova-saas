const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v281: Configuración de Bot de Telegram en Base de Datos ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            CREATE TABLE IF NOT EXISTS telegram_settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                bot_token VARCHAR(255) NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Seed initial bot token from environment if present
        const token = process.env.TELEGRAM_BOT_TOKEN || null;
        if (token) {
            await conn.query(`
                INSERT INTO telegram_settings (id, bot_token, is_active)
                VALUES (1, ?, 1)
                ON DUPLICATE KEY UPDATE bot_token = VALUES(bot_token), is_active = 1
            `, [token]);
        }

        await conn.commit();
        console.log('--- Migración v281 completada exitosamente: telegram_settings configurada ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v281:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
