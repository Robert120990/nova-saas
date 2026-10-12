require('dotenv').config({ path: '../server/.env' });
const { migrate } = require('./migration_v274_accounting_settings_branch');

(async () => {
    try {
        await migrate();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
