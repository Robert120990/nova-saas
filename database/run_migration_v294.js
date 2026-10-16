const { up } = require('./migration_v294_rh_empleados_es_jubilado_con_afp');

(async () => {
    try {
        await up();
        console.log('Migration v294 finished successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error running migration v294:', err);
        process.exit(1);
    }
})();
