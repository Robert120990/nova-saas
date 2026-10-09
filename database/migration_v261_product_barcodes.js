const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(pool) {
    console.log('[Migration v261] Creando tabla product_barcodes...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS product_barcodes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            product_id INT NOT NULL,
            barcode VARCHAR(100) NOT NULL,
            description VARCHAR(150) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prod_barcodes_lookup (company_id, barcode),
            INDEX idx_prod_barcodes_product (product_id),
            CONSTRAINT fk_product_barcodes_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
            CONSTRAINT fk_product_barcodes_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE KEY uq_company_product_barcode (company_id, barcode)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[Migration v261] Tabla product_barcodes creada o ya existente exitosamente.');
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
            console.error('[Migration v258] Error:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { migrate };
