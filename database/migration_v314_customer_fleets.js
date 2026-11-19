const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(externalPool) {
    const pool = externalPool || mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('[Migration v314] Creating customer_fleets table and linking sales_headers.customer_fleet_id...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_fleets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                company_id INT NOT NULL,
                placa VARCHAR(20) NOT NULL,
                motorista VARCHAR(150) NULL,
                documento_motorista VARCHAR(30) NULL,
                telefono_motorista VARCHAR(25) NULL,
                codigo_interno VARCHAR(40) NULL,
                tipo_vehiculo VARCHAR(60) NULL,
                marca VARCHAR(80) NULL,
                modelo VARCHAR(80) NULL,
                anio SMALLINT UNSIGNED NULL,
                color VARCHAR(40) NULL,
                tipo_combustible VARCHAR(40) NULL,
                observaciones TEXT NULL,
                activo TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_customer_fleets_company_customer (company_id, customer_id),
                UNIQUE KEY uq_customer_fleet_plate (company_id, customer_id, placa),
                CONSTRAINT fk_customer_fleets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                CONSTRAINT fk_customer_fleets_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('[Migration v314] Table customer_fleets verified.');

        const [saleCols] = await pool.query('DESCRIBE sales_headers');
        const saleColNames = saleCols.map(c => c.Field);
        if (!saleColNames.includes('customer_fleet_id')) {
            await pool.query(
                'ALTER TABLE sales_headers ADD COLUMN customer_fleet_id INT NULL AFTER customer_branch_id'
            );
            console.log('[Migration v314] Added customer_fleet_id column to sales_headers.');
        } else {
            console.log('[Migration v314] Column customer_fleet_id already exists on sales_headers.');
        }

        const [statRows] = await pool.query(
            `SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_headers' AND INDEX_NAME = 'idx_sales_headers_customer_fleet'`
        );
        if (statRows.length === 0) {
            await pool.query(
                'ALTER TABLE sales_headers ADD INDEX idx_sales_headers_customer_fleet (customer_fleet_id)'
            );
            console.log('[Migration v314] Added idx_sales_headers_customer_fleet index on sales_headers.');
        }

        const [fkRows] = await pool.query(
            `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales_headers'
               AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'fk_sales_headers_customer_fleet'`
        );
        if (fkRows.length === 0) {
            await pool.query(
                'ALTER TABLE sales_headers ADD CONSTRAINT fk_sales_headers_customer_fleet FOREIGN KEY (customer_fleet_id) REFERENCES customer_fleets(id) ON DELETE SET NULL'
            );
            console.log('[Migration v314] Added fk_sales_headers_customer_fleet constraint on sales_headers.');
        }

        console.log('[Migration v314] Completed successfully.');
    } finally {
        if (!externalPool) {
            await pool.end();
        }
    }
}

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[Migration v314] Failed:', err);
            process.exit(1);
        });
}

module.exports = { migrate };
