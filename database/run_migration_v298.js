const { up } = require('./migration_v298_telegram_global_companies');

(async () => {
    try {
        await up();
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración v298:', error);
        process.exit(1);
    }
})();
