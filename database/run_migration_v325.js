const migrate = require('./migration_v325_biometric_corte_payroll_link');

migrate()
    .then(() => {
        console.log('Migration v325 finished.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v325 failed:', err);
        process.exit(1);
    });
