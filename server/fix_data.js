const mysql = require('mysql2/promise');
(async () => {
    try {
        const c = await mysql.createConnection({host:'207.244.251.167',user:'sysadmin',password:'QwErTy123',database:'db_sistema_saas'});
        
        // 1. Fix branch 1 distrito
        await c.execute("UPDATE branches SET distrito='13' WHERE id=1 AND company_id=1");
        console.log('Branch 1 distrito updated to 13');
        
        // 2. Fix branch 2 distrito (has "01", should be based on dept 12 San Miguel)
        // San Miguel city is district 17 in San Miguel department
        await c.execute("UPDATE branches SET distrito='17' WHERE id=2 AND company_id=1");
        console.log('Branch 2 distrito updated to 17');
        
        // 3. Fix customer distritos that are "01" (the old invalid default)
        // For customers with departamento 06 (San Salvador), set to 14 (San Salvador district)
        await c.execute("UPDATE customers SET distrito='14' WHERE company_id=1 AND (distrito IS NULL OR distrito='01' OR distrito='0' OR distrito='00-00') AND departamento='06'");
        console.log('Customers dept 06 distrito set to 14');
        
        // For customers with departamento 09 (Cabañas) - set to first district
        await c.execute("UPDATE customers SET distrito='1' WHERE company_id=1 AND (distrito IS NULL OR distrito='01' OR distrito='0' OR distrito='00-00') AND departamento='09'");
        console.log('Customers dept 09 distrito set to 1');
        
        // For customers with other dept or no dept, set to 1 as fallback
        await c.execute("UPDATE customers SET distrito='1' WHERE company_id=1 AND (distrito IS NULL OR distrito='01' OR distrito='0' OR distrito='00-00' OR distrito LIKE '%-%')");
        console.log('Other customers distrito set to 1');
        
        // 4. Verify
        const [b] = await c.execute("SELECT id, nombre, distrito FROM branches WHERE company_id=1");
        console.log('Branches:', JSON.stringify(b));
        
        const [ct] = await c.execute("SELECT COUNT(*) as cnt FROM customers WHERE company_id=1 AND (distrito IS NULL OR distrito='01' OR distrito='0' OR distrito LIKE '%-%')");
        console.log('Customers still with invalid distrito:', ct[0].cnt);
        
        await c.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
