const { migrate } = require('./migration_v157_sync_customer_branch_dte_json');

async function run() {
    try {
        await migrate();
        console.log('Migration v157 completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration v157 failed:', error);
        process.exit(1);
    }
}

run();
