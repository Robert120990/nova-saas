const { up } = require('./migration_v284_telegram_global_branches');

async function run() {
    try {
        await up();
        console.log('Migration v284 completada.');
        process.exit(0);
    } catch (err) {
        console.error('Error ejecutando migration v284:', err);
        process.exit(1);
    }
}

run();
