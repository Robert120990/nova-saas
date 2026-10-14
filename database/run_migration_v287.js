const { up } = require('./migration_v287_telegram_invites_and_permissions');

async function run() {
    try {
        await up();
        console.log('Migration v287 ejecutada exitosamente.');
        process.exit(0);
    } catch (err) {
        console.error('Error ejecutando migration v287:', err);
        process.exit(1);
    }
}

run();
