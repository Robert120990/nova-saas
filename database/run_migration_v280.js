require('dotenv').config({ path: '../server/.env' });
const migrate = require('./migration_v280_impresion_partidas_menu');

(async () => {
    try {
        await migrate();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
