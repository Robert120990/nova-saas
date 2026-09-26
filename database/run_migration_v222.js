const { runMigration } = require('./migration_v222_cleanup_duplicate_descuentos_menu');

(async () => {
    try {
        await runMigration();
        process.exit(0);
    } catch (e) {
        console.error('Error ejecutando migración v222:', e);
        process.exit(1);
    }
})();
