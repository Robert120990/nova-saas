const { migrate } = require('./migration_v273_accounting_closeouts');

migrate()
    .then(() => {
        console.log('Migración v273 completada exitosamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error ejecutando migración v273:', err);
        process.exit(1);
    });
