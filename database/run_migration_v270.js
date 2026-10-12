const { execSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'migration_v270_modifier_group_targeting.js');
console.log(`Ejecutando ${scriptPath}...`);

try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log('Migración v270 ejecutada exitosamente.');
} catch (error) {
    console.error('Error al ejecutar la migración v270:', error);
    process.exit(1);
}
