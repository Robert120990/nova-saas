const runMigration = require('./migration_v171_copy_rh_catalogs_to_all_companies');

runMigration()
    .then(() => {
        console.log('Migration v171 execution complete.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v171 failed:', err);
        process.exit(1);
    });
