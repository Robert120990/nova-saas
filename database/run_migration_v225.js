const { runMigration } = require('./migration_v225_top_products_by_category_report_menu');

async function main() {
    try {
        await runMigration();
        process.exit(0);
    } catch (e) {
        console.error('Fallo al ejecutar migración v225:', e);
        process.exit(1);
    }
}

main();
