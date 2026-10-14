const { up } = require('./migration_v286_ai_multiagent');

async function run() {
    try {
        await up();
        console.log('Migration v286 ejecutada exitosamente.');
        process.exit(0);
    } catch (err) {
        console.error('Error ejecutando migration v286:', err);
        process.exit(1);
    }
}

run();
