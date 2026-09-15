const { run } = require('./migration_v197_fix_cabanas_muni_distrito');

run()
    .then(() => {
        console.log('Migration v197 ejecutada con éxito.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error al ejecutar migration v197:', err);
        process.exit(1);
    });
