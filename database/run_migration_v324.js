const migrate = require('./migration_v324_backfill_sales_linked_documents');

migrate()
    .then(() => {
        console.log('Migration v324 finished.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v324 failed:', err);
        process.exit(1);
    });
