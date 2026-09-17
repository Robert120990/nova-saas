const runMigration = require('./migration_v201_egg_industrial_product_mapping_catalogs');

runMigration()
    .then(() => {
        console.log('Migration v201 execution finished.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration v201 execution failed:', error);
        process.exit(1);
    });
