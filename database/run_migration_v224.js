const { runMigration } = require('./migration_v224_sales_discounts_report_menu');

async function main() {
    try {
        await runMigration();
        process.exit(0);
    } catch (e) {
        console.error('Fallo al ejecutar migración v224:', e);
        process.exit(1);
    }
}

main();
