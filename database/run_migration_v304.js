const migrate = require('./migration_v304_daily_briefing_distributed_lock');

(async () => {
    try {
        await migrate();
        console.log('Migration v304 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v304 failed:', err);
        process.exit(1);
    }
})();
