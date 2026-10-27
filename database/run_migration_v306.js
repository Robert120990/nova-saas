const migrate = require('./migration_v306_industrial_containers');

(async () => {
    try {
        await migrate();
        console.log('Migration v306 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v306 failed:', err);
        process.exit(1);
    }
})();
