const { migrate } = require('./migration_v272_restaurant_discounts');

migrate()
    .then(() => {
        console.log('Migración v272 completada exitosamente.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error ejecutando migración v272:', err);
        process.exit(1);
    });
