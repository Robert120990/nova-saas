const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v283: Configuración de Reporte Matutino Diario en Telegram ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Verificar si la columna ya existe
        const [cols] = await conn.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'telegram_settings'
              AND COLUMN_NAME = 'daily_briefing_active'
        `);

        if (cols.length === 0) {
            await conn.query(`
                ALTER TABLE telegram_settings
                ADD COLUMN daily_briefing_active TINYINT(1) NOT NULL DEFAULT 1
                AFTER is_active
            `);
            console.log('Columna daily_briefing_active agregada a telegram_settings.');
        } else {
            console.log('Columna daily_briefing_active ya existe en telegram_settings.');
        }

        await conn.commit();
        console.log('--- Migración v283 completada exitosamente ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v283:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
