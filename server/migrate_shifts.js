const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./src/config/db');

async function migrate() {
    console.log('--- INICIANDO MIGRACIÓN DE TURNOS DE CAJA ---');
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Crear tabla pos_shifts
        console.log('1. Creando tabla pos_shifts...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS pos_shifts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                pos_id INT NOT NULL,
                seller_id INT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME DEFAULT NULL,
                opening_balance DECIMAL(12,4) DEFAULT 0,
                expected_cash DECIMAL(12,4) DEFAULT 0,
                actual_cash DECIMAL(12,4) DEFAULT 0,
                difference DECIMAL(12,4) DEFAULT 0,
                cash_sales DECIMAL(12,4) DEFAULT 0,
                card_sales DECIMAL(12,4) DEFAULT 0,
                transfer_sales DECIMAL(12,4) DEFAULT 0,
                other_sales DECIMAL(12,4) DEFAULT 0,
                total_sales DECIMAL(12,4) DEFAULT 0,
                status ENUM('open', 'closed') DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (pos_id) REFERENCES points_of_sale(id),
                FOREIGN KEY (seller_id) REFERENCES sellers(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Añadir shift_id a sales_headers
        console.log('2. Añadiendo shift_id a sales_headers...');
        try {
            await connection.query(`
                ALTER TABLE sales_headers 
                ADD COLUMN shift_id INT DEFAULT NULL AFTER seller_id,
                ADD CONSTRAINT fk_sales_shift FOREIGN KEY (shift_id) REFERENCES pos_shifts(id);
            `);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_FK_DUP_NAME') {
                console.log('   (La columna shift_id o el constraint ya existen)');
            } else {
                console.warn('   (Aviso: ', e.message, ')');
            }
        }

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
