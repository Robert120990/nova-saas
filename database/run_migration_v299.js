const { up } = require('./migration_v299_tickets_agy_flow');

(async () => {
    try {
        await up();
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración v299:', error);
        process.exit(1);
    }
})();
