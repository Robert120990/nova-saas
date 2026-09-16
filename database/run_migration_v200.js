const runMigration = require('./migration_v200_server_terminal_menu');

runMigration()
    .then(() => {
        console.log('Migration v200 execution finished.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v200 execution failed:', err);
        process.exit(1);
    });
