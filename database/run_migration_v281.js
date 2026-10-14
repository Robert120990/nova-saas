require('dotenv').config({ path: '../server/.env' });
const migrate = require('./migration_v281_telegram_settings');

(async () => {
    try {
        await migrate();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
