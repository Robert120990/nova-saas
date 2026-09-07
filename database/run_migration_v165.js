const { migrate } = require('./migration_v165_sync_customer_branch_dte_json');

async function run() {
    try {
        await migrate();
        console.log('Migration v165 completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration v165 failed:', error);
        process.exit(1);
    }
}

run();
