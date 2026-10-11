const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'migration_v267_add_aplica_pago_cuenta.js');
console.log(`Ejecutando ${scriptPath}...`);

try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log('Migración v267 ejecutada exitosamente.');
} catch (error) {
    console.error('Error al ejecutar la migración v267:', error);
    process.exit(1);
}
