const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'migration_v268_restaurant_module.js');
console.log(`Ejecutando ${scriptPath}...`);

try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log('Migración v268 ejecutada exitosamente.');
} catch (error) {
    console.error('Error al ejecutar la migración v268:', error);
    process.exit(1);
}
