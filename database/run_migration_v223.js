const { runMigration } = require('./migration_v223_rh_planilla_quincena25');

async function main() {
    try {
        await runMigration();
        process.exit(0);
    } catch (e) {
        console.error('Fallo al ejecutar migración v223:', e);
        process.exit(1);
    }
}

main();
