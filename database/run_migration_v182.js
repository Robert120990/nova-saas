const runMigration = require('./migration_v182_server_monitor_menu');

runMigration()
    .then(() => {
        console.log('Migration runner v182 finished.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration runner v182 failed:', err);
        process.exit(1);
    });
