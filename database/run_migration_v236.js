const { runMigration } = require('./migration_v236_fusion_menu');

runMigration()
    .then(() => {
        console.log('✓ Migration v236 completada exitosamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('✗ Migration v236 falló:', err);
        process.exit(1);
    });
