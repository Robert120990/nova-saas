const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v307: Adding date cutoffs (Estados de Cuenta) for egg_storage_containers ---');

    // 1. Agregar columnas de seguimiento del último corte en egg_storage_containers
    const [cols] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'egg_storage_containers'
          AND COLUMN_NAME IN ('last_cutoff_date', 'last_cutoff_id')
    `);
    const existingCols = new Set(cols.map(c => c.COLUMN_NAME));

    if (!existingCols.has('last_cutoff_date')) {
        await pool.query('ALTER TABLE egg_storage_containers ADD COLUMN last_cutoff_date DATE NULL AFTER turned_off_at');
        console.log('✅ Columna last_cutoff_date agregada a egg_storage_containers');
    }
    if (!existingCols.has('last_cutoff_id')) {
        await pool.query('ALTER TABLE egg_storage_containers ADD COLUMN last_cutoff_id INT NULL AFTER last_cutoff_date');
        console.log('✅ Columna last_cutoff_id agregada a egg_storage_containers');
    }

    // 2. Ampliar action_type en egg_storage_container_logs a VARCHAR(40) para permitir corte_fechas y reversion_corte
    await pool.query(`
        ALTER TABLE egg_storage_container_logs
        MODIFY COLUMN action_type VARCHAR(40) NOT NULL DEFAULT 'ajuste_dias'
    `);
    console.log('✅ Columna action_type ampliada en egg_storage_container_logs');

    // 3. Crear tabla maestra de Cortes por Fecha / Estados de Cuenta (egg_storage_container_cutoffs)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_storage_container_cutoffs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            cutoff_number INT NOT NULL,
            cutoff_code VARCHAR(30) NOT NULL,
            customer_id INT NULL,
            customer_name VARCHAR(180) NULL,
            previous_cutoff_id INT NULL,
            previous_cutoff_date DATE NULL,
            period_start DATE NOT NULL,
            period_end DATE NOT NULL,
            total_containers INT NOT NULL DEFAULT 10,
            billed_containers_count INT NOT NULL DEFAULT 0,
            active_containers_count INT NOT NULL DEFAULT 0,
            total_days_on DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            daily_rate DECIMAL(12, 2) NOT NULL DEFAULT 195.00,
            subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            iva_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            total_with_iva DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            keep_active_running TINYINT(1) NOT NULL DEFAULT 1,
            status VARCHAR(20) NOT NULL DEFAULT 'aplicado',
            notes VARCHAR(255) NULL,
            user_id INT NULL,
            user_name VARCHAR(150) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_egg_container_cutoff_num (company_id, cutoff_number),
            KEY idx_egg_container_cutoffs_company (company_id, period_end, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla egg_storage_container_cutoffs creada/verificada');

    // 4. Crear tabla detalle por contenedor de cada Estado de Cuenta (egg_storage_container_cutoff_items)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_storage_container_cutoff_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cutoff_id INT NOT NULL,
            company_id INT NOT NULL,
            container_id INT NOT NULL,
            container_number INT NOT NULL,
            container_code VARCHAR(30) NOT NULL,
            container_name VARCHAR(120) NOT NULL,
            was_active_power TINYINT(1) NOT NULL DEFAULT 0,
            turned_on_at DATETIME NULL,
            turned_off_at DATETIME NULL,
            days_on DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
            daily_rate DECIMAL(12, 2) NOT NULL DEFAULT 195.00,
            subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            iva_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            total_with_iva DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            notes VARCHAR(255) NULL,
            KEY idx_egg_cutoff_items_cutoff (cutoff_id),
            KEY idx_egg_cutoff_items_company (company_id, container_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla egg_storage_container_cutoff_items creada/verificada');
}

module.exports = migrate;
