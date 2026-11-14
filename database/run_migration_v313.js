const { migrate } = require('./migration_v313_fix_contratos_laborales_fields');

migrate()
    .then(() => {
        console.log('Migration v313 executed successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error running migration v313:', err);
        process.exit(1);
    });

