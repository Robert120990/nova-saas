const { migrate } = require('./migration_v312_clean_rh_patrono_defaults');

migrate()
    .then(() => {
        console.log('Migration v312 executed successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error running migration v312:', err);
        process.exit(1);
    });

