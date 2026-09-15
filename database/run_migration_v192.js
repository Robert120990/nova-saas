const { run } = require('./migration_v192_clean_customer_invalid_emails');

run()
    .then(() => {
        console.log('Migration v192 ejecutada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error al ejecutar migration v192:', err);
        process.exit(1);
    });
