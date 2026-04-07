const mysql = require('mysql2/promise');
const fs = require('fs');

async function main() {
    const creds = {
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123',
        database: 'db_sistema_saas'
    };

    let log = '';

    try {
        const connTarget = await mysql.createConnection(creds);
        
        const tables = ['product_branch', 'product_pos', 'branches', 'points_of_sale'];
        for (const table of tables) {
            const [columns] = await connTarget.query(`DESCRIBE ${table}`);
            log += `\nStructure of target.${table}:\n`;
            columns.forEach(c => log += `${c.Field} (${c.Type})\n`);
        }
        
        await connTarget.end();
        fs.appendFileSync('server/scripts/db_schemas.txt', log);
        console.log('Assignment schemas appended to server/scripts/db_schemas.txt');

    } catch (err) {
        console.error('Error:', err);
    }
}

main();
