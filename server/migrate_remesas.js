const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    decimalNumbers: true
});

async function migrate() {
    try {
        console.log('Creando tabla pos_shift_remesas...');
        await connection.promise().execute(`
            CREATE TABLE IF NOT EXISTS pos_shift_remesas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL,
                numero INT NOT NULL DEFAULT 1,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES pos_shifts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('Agregando columna total_remesas a pos_shifts...');
        try {
            await connection.promise().execute(`
                ALTER TABLE pos_shifts ADD COLUMN total_remesas DECIMAL(10,2) DEFAULT 0 AFTER total_incomes
            `);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('  columna total_remesas ya existe');
            } else {
                throw err;
            }
        }

        console.log('Migracion completada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('Error en migracion:', error);
        process.exit(1);
    }
}

migrate();
