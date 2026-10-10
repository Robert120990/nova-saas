const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(pool) {
    console.log('[Migration v262] Creando tabla pos_shift_tarjetas...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS pos_shift_tarjetas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            shift_id INT NOT NULL,
            num_tarjeta VARCHAR(20) NOT NULL DEFAULT '',
            num_autorizacion VARCHAR(50) NOT NULL DEFAULT '',
            description VARCHAR(255) NOT NULL DEFAULT '',
            amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_shift_tarjetas_shift (shift_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[Migration v262] Verificando columna total_tarjetas en pos_shifts...');
    const [cols] = await pool.query("SHOW COLUMNS FROM pos_shifts LIKE 'total_tarjetas'");
    if (cols.length === 0) {
        await pool.query("ALTER TABLE pos_shifts ADD COLUMN total_tarjetas DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total_puntos");
        console.log('[Migration v262] Columna total_tarjetas agregada a pos_shifts.');
    } else {
        console.log('[Migration v262] Columna total_tarjetas ya existe en pos_shifts.');
    }

    console.log('[Migration v262] Migración v262 completada exitosamente.');
}

if (require.main === module) {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    migrate(pool)
        .then(() => pool.end())
        .catch((err) => {
            console.error('[Migration v262] Error:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { migrate };
