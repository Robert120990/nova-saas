const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
    const creds = {
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123'
    };

    let log = '';

    try {
        const connSource = await mysql.createConnection({...creds, database: 'db_sipe_chalchuapa'});
        const targetTables = ['tipos_linea', 'tipos_sublinea'];
        for (const table of targetTables) {
            try {
                const [columns] = await connSource.query(`DESCRIBE ${table}`);
                log += `\nStructure of source.${table}:\n`;
                columns.forEach(c => log += `${c.Field} (${c.Type})\n`);
            } catch (e) {
                log += `\nTable source.${table} not found or error: ${e.message}\n`;
            }
        }
        await connSource.end();

        const connTarget = await mysql.createConnection({...creds, database: 'db_sistema_saas'});
        const [columnsCat] = await connTarget.query(`DESCRIBE product_categories`);
        log += `\nStructure of target.product_categories:\n`;
        columnsCat.forEach(c => log += `${c.Field} (${c.Type})\n`);
        await connTarget.end();

        fs.appendFileSync('server/scripts/db_schemas.txt', log);
        console.log('Category schemas appended to server/scripts/db_schemas.txt');

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
