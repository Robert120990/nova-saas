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
        const [tablesSource] = await connSource.query('SHOW TABLES');
        log += 'Tables in source (db_sipe_chalchuapa):\n';
        const srcTables = tablesSource.map(t => Object.values(t)[0]);
        log += srcTables.join(', ') + '\n';

        for (const table of srcTables) {
            if (['prod', 'clie', 'prov', 'item', 'supp'].some(r => table.toLowerCase().includes(r))) {
                const [columns] = await connSource.query(`DESCRIBE ${table}`);
                log += `\nStructure of source.${table}:\n`;
                columns.forEach(c => log += `${c.Field} (${c.Type})\n`);
            }
        }
        await connSource.end();

        const connTarget = await mysql.createConnection({...creds, database: 'db_sistema_saas'});
        const [tablesTarget] = await connTarget.query('SHOW TABLES');
        log += '\nTables in target (db_sistema_saas):\n';
        const tgtTables = tablesTarget.map(t => Object.values(t)[0]);
        log += tgtTables.join(', ') + '\n';

        const targets = ['products', 'customers', 'providers'];
        for (const table of targets) {
            if (tgtTables.includes(table)) {
                const [columns] = await connTarget.query(`DESCRIBE ${table}`);
                log += `\nStructure of target.${table}:\n`;
                columns.forEach(c => log += `${c.Field} (${c.Type})\n`);
            }
        }
        await connTarget.end();

        fs.writeFileSync('server/scripts/db_schemas.txt', log);
        console.log('Schemas written to server/scripts/db_schemas.txt');

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
