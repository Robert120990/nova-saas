require('dotenv').config({ path: '../server/.env' });
const migrate = require('./migration_v283_daily_briefing_setting');

(async () => {
    try {
        await migrate();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
