const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    let pool;
    try {
        pool = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'db_sistema_saas',
            waitForConnections: true,
            connectionLimit: 5
        });

        console.log('--- Iniciando Migración v166: Rango de Fechas e Histórico de Acuerdos de Clientes ---');

        // 1. Verificar columnas en egg_costing_customer_agreements
        const [tables] = await pool.query("SHOW TABLES LIKE 'egg_costing_customer_agreements'");
        if (tables.length > 0) {
            const [cols] = await pool.query('DESCRIBE egg_costing_customer_agreements');
            const colNames = cols.map(c => c.Field);

            if (!colNames.includes('valid_from')) {
                await pool.query('ALTER TABLE egg_costing_customer_agreements ADD COLUMN valid_from DATE NULL DEFAULT NULL AFTER target_margin_pct');
                console.log("✓ Columna 'valid_from' agregada a egg_costing_customer_agreements.");
            } else {
                console.log("- Columna 'valid_from' ya existe.");
            }

            if (!colNames.includes('valid_to')) {
                await pool.query('ALTER TABLE egg_costing_customer_agreements ADD COLUMN valid_to DATE NULL DEFAULT NULL AFTER valid_from');
                console.log("✓ Columna 'valid_to' agregada a egg_costing_customer_agreements.");
            } else {
                console.log("- Columna 'valid_to' ya existe.");
            }
        }

        // 2. Crear tabla egg_costing_agreement_history si no existe
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_costing_agreement_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                agreement_id INT NOT NULL,
                company_id INT NOT NULL,
                customer_id INT NULL,
                customer_name VARCHAR(150) NOT NULL,
                product_id INT NULL,
                product_type VARCHAR(100) NOT NULL,
                presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
                agreed_price_per_lb DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
                agreed_unit_price DECIMAL(10,4) NULL,
                monthly_volume_lbs DECIMAL(12,2) DEFAULT 0.00,
                target_margin_pct DECIMAL(5,2) DEFAULT 20.00,
                freight_cost_per_lb DECIMAL(8,4) DEFAULT 0.0000,
                payment_terms_days INT DEFAULT 30,
                valid_from DATE NULL,
                valid_to DATE NULL,
                change_reason VARCHAR(255) NULL,
                recorded_by VARCHAR(100) NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ecah_agr (agreement_id),
                INDEX idx_ecah_comp (company_id),
                INDEX idx_ecah_cust (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("✓ Tabla 'egg_costing_agreement_history' verificada/creada con éxito.");

        console.log('--- Migración v166 finalizada exitosamente ---');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración v166:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.end();
    }
}

runMigration();
