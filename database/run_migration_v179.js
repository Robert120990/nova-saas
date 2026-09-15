/**
 * Runner para la migración v179
 */

const migrate = require('./migration_v179_fix_superseded_dtes_and_regenerate_perm');

async function run() {
    try {
        await migrate();
        console.log('Migración v179 finalizada con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración v179:', error);
        process.exit(1);
    }
}

run();
