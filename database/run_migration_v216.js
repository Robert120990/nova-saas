const runMigration = require('./migration_v216_gas_advances_payment_breakdown');

runMigration()
    .then(() => {
        console.log('Migration v216 finished.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v216 failed:', err);
        process.exit(1);
    });
