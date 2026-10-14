const { up } = require('./migration_v288_ai_agent_tasks');

(async () => {
    try {
        await up();
        console.log('Migration v288 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v288:', err);
        process.exit(1);
    }
})();
