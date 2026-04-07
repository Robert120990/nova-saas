const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    decimalNumbers: true
});

async function migrate() {
    try {
        console.log('Connecting to database...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_payments (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                customer_id INT NOT NULL,
                sale_id BIGINT DEFAULT NULL,
                monto DECIMAL(12,2) NOT NULL,
                fecha_pago DATE NOT NULL,
                metodo_pago VARCHAR(50) NOT NULL,
                referencia VARCHAR(255) DEFAULT NULL,
                notas TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cxc_company_branch_customer (company_id, branch_id, customer_id),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (sale_id) REFERENCES sales_headers(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('Migration completed: customer_payments table created with BIGINT support');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
