const run = require('./migration_v242_energy_company_isolation');

run()
    .then(() => {
        console.log('Migration v242 executed successfully.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration v242 failed:', err);
        process.exit(1);
    });
