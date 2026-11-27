const pool = require('../server/src/config/db');

/**
 * Create local mapping table to track bank movements and cheques
 * synchronized from Nova-SaaS into db_sipe_admin.
 */
async function runMigration() {
    try {
        console.log('Running migration v323 - Creating sipe_admin_bank_sync_map table...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sipe_admin_bank_sync_map (
                id INT NOT NULL AUTO_INCREMENT,
                source_type ENUM('gas_remesa', 'gas_remesa_extra', 'sales_remesa', 'gas_order_transfer', 'gas_order_cheque') NOT NULL,
                source_id VARCHAR(64) NOT NULL,
                parent_id VARCHAR(64) DEFAULT NULL,
                company_id INT DEFAULT NULL,
                sipe_admin_table ENUM('movimientos_bancarios', 'cheques') NOT NULL,
                sipe_admin_id INT NOT NULL,
                cuenta_bancaria_id INT DEFAULT NULL,
                documento VARCHAR(100) DEFAULT NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_source (source_type, source_id),
                KEY idx_parent (source_type, parent_id),
                KEY idx_sipe_admin_row (sipe_admin_table, sipe_admin_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('Migration v323 completed successfully.');
    } catch (error) {
        console.error('Error in migration v323:', error);
        throw error;
    }
}

module.exports = runMigration;
