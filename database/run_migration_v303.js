const migrate = require('./migration_v303_support_ticket_telegram_messages');

(async () => {
    try {
        await migrate();
        console.log('Migration v303 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v303 failed:', err);
        process.exit(1);
    }
})();
