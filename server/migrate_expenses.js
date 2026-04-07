const pool = require('./src/config/db');

async function migrateExpenses() {
    try {
        console.log('Iniciando migración para gastos de caja...');
        
        // 1. Añadir columna total_expenses a pos_shifts if not exists
        const [columns] = await pool.query('SHOW COLUMNS FROM pos_shifts LIKE "total_expenses"');
        if (columns.length === 0) {
            await pool.query('ALTER TABLE pos_shifts ADD COLUMN total_expenses DECIMAL(10,2) DEFAULT 0 AFTER opening_balance');
            console.log('Columna total_expenses añadida a pos_shifts.');
        } else {
            console.log('La columna total_expenses ya existe.');
        }

        // 2. Crear tabla pos_shift_expenses
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pos_shift_expenses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES pos_shifts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Tabla pos_shift_expenses asegurada.');

        console.log('Migración completada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('Error durante la migración:', error);
        process.exit(1);
    }
}

migrateExpenses();
