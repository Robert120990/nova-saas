const pool = require('../server/src/config/db');

async function runMigration() {
    console.log('--- Running Migration v252: FilPro Sync Range Support ---');
    try {
        console.log('1. Modifying filpro_sync_logs.sync_date to VARCHAR(100)...');
        await pool.query('ALTER TABLE filpro_sync_logs MODIFY sync_date VARCHAR(100) NOT NULL');

        console.log('2. Modifying filpro_connections.last_sync_date to VARCHAR(100)...');
        await pool.query('ALTER TABLE filpro_connections MODIFY last_sync_date VARCHAR(100) NULL');

        console.log('✔ Migration v252 completed successfully.');
    } catch (error) {
        console.error('Error running migration v252:', error);
        throw error;
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
