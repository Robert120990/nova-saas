const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- Running Migration v189: FilPro Product Mappings ---');

        // Create table filpro_product_mappings
        console.log('1. Creating table filpro_product_mappings...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS filpro_product_mappings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                filpro_code VARCHAR(100) NOT NULL,
                filpro_description VARCHAR(255) NULL,
                product_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_filpro_company_code (company_id, filpro_code),
                INDEX idx_filpro_company (company_id),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('  → filpro_product_mappings created successfully');

        console.log('--- Migration v189 Finished Successfully ---');
    } catch (error) {
        console.error('Migration v189 failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
