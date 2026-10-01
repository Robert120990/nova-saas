const { runMigration } = require('./migration_v238_rh_marcador_digital');

runMigration()
    .then(() => {
        console.log('✓ Migration v238 completada exitosamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('✗ Migration v238 falló:', err);
        process.exit(1);
    });
