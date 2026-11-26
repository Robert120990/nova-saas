const { up } = require('./migration_v322_rh_biometric_overtime_rules');

up()
    .then(() => {
        console.log('Migration v322 finished successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v322 failed:', err);
        process.exit(1);
    });
