// Regresiones de la auditoría: ejecuta las expectativas del comportamiento corregido.
// Dependencias simuladas: no conecta a MySQL, no emite DTE ni envía correos.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', path.resolve(__dirname, '../../server/tests/unit/eggIndustrial.test.js')], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
