require('dotenv').config({ path: './server/.env' });
const pool = require('../server/src/config/db');

const setup = async () => {
    try {
        console.log('Creating pos_shifts table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pos_shifts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                pos_id INT NOT NULL,
                seller_id INT NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                opening_balance DECIMAL(18, 2) DEFAULT 0,
                expected_cash DECIMAL(18, 2) DEFAULT 0,
                actual_cash DECIMAL(18, 2) DEFAULT 0,
                difference DECIMAL(18, 2) DEFAULT 0,
                cash_sales DECIMAL(18, 2) DEFAULT 0,
                card_sales DECIMAL(18, 2) DEFAULT 0,
                transfer_sales DECIMAL(18, 2) DEFAULT 0,
                other_sales DECIMAL(18, 2) DEFAULT 0,
                total_sales DECIMAL(18, 2) DEFAULT 0,
                status ENUM('open', 'closed') DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
                FOREIGN KEY (pos_id) REFERENCES points_of_sale(id) ON DELETE CASCADE
            )
        `);

        console.log('Adding shift_id to sales_headers...');
        // Check if column exists first (optional but safer)
        const [columns] = await pool.query('SHOW COLUMNS FROM sales_headers LIKE "shift_id"');
        if (columns.length === 0) {
            await pool.query('ALTER TABLE sales_headers ADD COLUMN shift_id INT AFTER pos_id');
            await pool.query('ALTER TABLE sales_headers ADD FOREIGN KEY (shift_id) REFERENCES pos_shifts(id) ON DELETE SET NULL');
        }

        console.log('Setup completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error during setup:', error);
        process.exit(1);
    }
};

setup();
