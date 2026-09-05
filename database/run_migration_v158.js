const { migrate } = require('./migration_v158_pad_cat_019_and_customers_actividad');

async function run() {
    try {
        await migrate();
        console.log('Migration v158 completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration v158 failed:', error);
        process.exit(1);
    }
}

run();
