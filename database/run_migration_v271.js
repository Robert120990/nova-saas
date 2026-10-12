const { migrate } = require('./migration_v271_restaurant_station_categories');

(async () => {
    try {
        await migrate();
        console.log('Migración v271 ejecutada correctamente.');
        process.exit(0);
    } catch (err) {
        console.error('Fallo en migración v271:', err);
        process.exit(1);
    }
})();
