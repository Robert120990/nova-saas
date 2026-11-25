const migrate = require('./migration_v320_tutorials_menu');

migrate()
    .then(() => {
        console.log('Migration v320 finished successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v320 failed:', err);
        process.exit(1);
    });
