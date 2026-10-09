const { up } = require('./migration_v259_clean_future_punch_logs');

(async () => {
  try {
    await up();
    console.log('Migración v259 ejecutada exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar migración v258:', error);
    process.exit(1);
  }
})();
