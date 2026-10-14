const { up } = require('./migration_v289_agent_task_output_types');

(async () => {
    try {
        await up();
        console.log('Migration v289 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v289:', err);
        process.exit(1);
    }
})();
