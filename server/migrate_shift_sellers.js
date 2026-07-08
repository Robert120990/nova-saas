const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./src/config/db');

async function migrate() {
    console.log('--- INICIANDO MIGRACIÓN DE VENDEDORES POR TURNO ---');
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        console.log('1. Creando tabla pos_shift_sellers...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS pos_shift_sellers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL,
                seller_id INT NOT NULL,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_shift_seller (shift_id, seller_id),
                FOREIGN KEY (shift_id) REFERENCES pos_shifts(id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES sellers(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Poblar con los responsables actuales
        console.log('2. Poblando vendedores responsables en turnos abiertos...');
        await connection.query(`
            INSERT IGNORE INTO pos_shift_sellers (shift_id, seller_id)
            SELECT id, seller_id FROM pos_shifts WHERE status = 'open'
        `);
        console.log('   (Registros insertados para turnos abiertos)');

        console.log('3. Poblando vendedores responsables en turnos cerrados...');
        await connection.query(`
            INSERT IGNORE INTO pos_shift_sellers (shift_id, seller_id)
            SELECT id, seller_id FROM pos_shifts WHERE status = 'closed'
        `);
        console.log('   (Registros insertados para turnos cerrados)');

        await connection.commit();
        console.log('--- MIGRACIÓN COMPLETADA EXITOSAMENTE ---');
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('--- ERROR EN LA MIGRACIÓN ---');
        console.error(error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

migrate();
