const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'migration_v266_add_compras_afectan_libro_compras.js');
console.log(`Ejecutando ${scriptPath}...`);

try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log('Migración v266 ejecutada exitosamente.');
} catch (error) {
    console.error('Error al ejecutar la migración v266:', error);
    process.exit(1);
}
