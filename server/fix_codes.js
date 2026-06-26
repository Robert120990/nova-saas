const mysql = require('mysql2/promise');
(async () => {
    try {
        const c = await mysql.createConnection({
            host: '207.244.251.167',
            user: 'sysadmin',
            password: 'QwErTy123',
            database: 'db_sistema_saas'
        });
        
        await c.execute("UPDATE branches SET distrito='192' WHERE id=1 AND company_id=1");
        console.log('Branch 1 -> 192 (San Martin)');
        
        await c.execute("UPDATE branches SET distrito='175' WHERE id=2 AND company_id=1");
        console.log('Branch 2 -> 175 (San Miguel)');
        
        await c.execute("UPDATE customers SET distrito='056' WHERE id=433");
        console.log('Customer 433 -> 056 (Cojutepeque)');
        
        const [b] = await c.execute("SELECT id, nombre, distrito FROM branches WHERE company_id=1");
        console.log('Branches:', JSON.stringify(b));
        
        const [c2] = await c.execute("SELECT id, nombre, distrito FROM customers WHERE id=433");
        console.log('Customer:', JSON.stringify(c2[0]));
        
        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
