const mysql = require('mysql2/promise');

async function main() {
    const creds = {
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123'
    };
    
    try {
        const connSrc = await mysql.createConnection({...creds, database: 'db_sipe_chalchuapa'});
        const connTgt = await mysql.createConnection({...creds, database: 'db_sistema_saas'});
        
        const [fuels] = await connSrc.query('SELECT codigo FROM productos WHERE es_combustible = 1');
        console.log(`Fuels found in source: ${fuels.length}`);
        
        for (const f of fuels) {
            await connTgt.query("UPDATE products SET tipo_combustible = 1, tipo_item = '3' WHERE codigo = ? AND company_id = 1", [f.codigo]);
        }
        
        console.log('Fixed fuel data in target DB.');
        
        await connSrc.end();
        await connTgt.end();
    } catch (err) {
        console.error(err);
    }
}

main();
