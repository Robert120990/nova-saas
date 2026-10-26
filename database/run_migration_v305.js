const migrate = require('./migration_v305_customer_payments_recibo_numero');

(async () => {
    try {
        await migrate();
        console.log('Migration v305 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration v305 failed:', err);
        process.exit(1);
    }
})();
