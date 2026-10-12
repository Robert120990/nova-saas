const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'migration_v269_restaurant_category_filter.js');
console.log(`Ejecutando ${scriptPath}...`);

try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log('Migración v269 ejecutada exitosamente.');
} catch (error) {
    console.error('Error al ejecutar la migración v269:', error);
    process.exit(1);
}
