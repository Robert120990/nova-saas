const { runMigration } = require('./migration_v237_fix_batch_24_pasteurization');

runMigration()
    .then(() => {
        console.log('✓ Migration v237 completada exitosamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('✗ Migration v237 falló:', err);
        process.exit(1);
    });
