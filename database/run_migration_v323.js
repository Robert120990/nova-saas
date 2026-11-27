const runMigration = require('./migration_v323_sipe_admin_bank_sync_map');

runMigration()
    .then(() => {
        console.log('Migration v323 executed successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error running migration v323:', err);
        process.exit(1);
    });
