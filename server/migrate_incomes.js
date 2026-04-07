const pool = require('./src/config/db');

async function migrateIncomes() {
    try {
        console.log('Iniciando migración para ingresos de caja...');
        
        // 1. Añadir columna total_incomes a pos_shifts if not exists
        const [columns] = await pool.query('SHOW COLUMNS FROM pos_shifts LIKE "total_incomes"');
        if (columns.length === 0) {
            await pool.query('ALTER TABLE pos_shifts ADD COLUMN total_incomes DECIMAL(10,2) DEFAULT 0 AFTER total_expenses');
            console.log('Columna total_incomes añadida a pos_shifts.');
        } else {
            console.log('La columna total_incomes ya existe.');
        }

        // 2. Crear tabla pos_shift_incomes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pos_shift_incomes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(2) NOT NULL DEFAULT '01',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES pos_shifts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Tabla pos_shift_incomes asegurada.');

        console.log('Migración completada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('Error durante la migración:', error);
        process.exit(1);
    }
}

migrateIncomes();
