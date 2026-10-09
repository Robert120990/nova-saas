const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(pool) {
    console.log('[Migration v257] Creando tabla gas_station_closeout_cheques...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS gas_station_closeout_cheques (
            id INT AUTO_INCREMENT PRIMARY KEY,
            closeout_id INT NOT NULL,
            numero_cheque VARCHAR(50) NOT NULL DEFAULT '',
            banco VARCHAR(100) NOT NULL DEFAULT '',
            despachador_id INT DEFAULT NULL,
            tipo_operacion ENUM('venta_combustible', 'recuperacion_credito') NOT NULL DEFAULT 'venta_combustible',
            monto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cheques_closeout (closeout_id),
            CONSTRAINT fk_closeout_cheques_closeout FOREIGN KEY (closeout_id) REFERENCES gas_station_closeouts(id) ON DELETE CASCADE,
            CONSTRAINT fk_closeout_cheques_despachador FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[Migration v257] Tabla gas_station_closeout_cheques creada o ya existente.');
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
            console.error('[Migration v257] Error:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { migrate };
