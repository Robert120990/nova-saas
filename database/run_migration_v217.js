const runMigration = require('./migration_v217_gas_lubricants_comparison_report');

runMigration()
    .then(() => {
        console.log('Migración v217 ejecutada correctamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error al ejecutar migración v217:', err);
        process.exit(1);
    });
