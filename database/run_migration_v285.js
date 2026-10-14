const { up } = require('./migration_v285_telegram_reopen_setting');

async function run() {
    try {
        await up();
        console.log('Migration v285 completada.');
        process.exit(0);
    } catch (err) {
        console.error('Error ejecutando migration v285:', err);
        process.exit(1);
    }
}

run();
