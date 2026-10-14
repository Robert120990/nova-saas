require('dotenv').config({ path: '../server/.env' });
const migrate = require('./migration_v282_gas_closeout_reopen_requests');

(async () => {
    try {
        await migrate();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
