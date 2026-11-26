const runMigration = require('./migration_v321_rename_vat_liquidation_menu');

runMigration()
    .then(() => {
        console.log('Migration v321 executed successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error running migration v321:', err);
        process.exit(1);
    });
