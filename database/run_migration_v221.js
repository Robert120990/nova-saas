const { runMigration } = require('./migration_v221_regularize_purchase_208_lubricants');

async function main() {
    try {
        console.log('Iniciando migración v221...');
        await runMigration();
        console.log('Migración v221 completada.');
        process.exit(0);
    } catch (e) {
        console.error('Error ejecutando migración v221:', e);
        process.exit(1);
    }
}

main();
