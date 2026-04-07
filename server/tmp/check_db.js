const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'sysadmin',
    password: 'QwErTy123',
    database: 'db_sistema_saas'
});

async function run() {
    try {
        const [colsCompanies] = await pool.query("SHOW COLUMNS FROM companies");
        console.log('COMPANIES_COLUMNS:', colsCompanies.map(c => c.Field).join(', '));
        
        try {
            const [colsCertificates] = await pool.query("SHOW COLUMNS FROM certificates");
            console.log('CERTIFICATES_COLUMNS:', colsCertificates.map(c => c.Field).join(', '));
            
            const [certData] = await pool.query("SELECT id, company_id, nit FROM certificates");
            console.log('CERTIFICATES_DATA:', JSON.stringify(certData));
        } catch (e) {
            console.log('CERTIFICATES_TABLE: NOT_FOUND');
        }

        const [compData] = await pool.query("SELECT id, razon_social, certificado_digital, clave_privada FROM companies");
        console.log('COMPANIES_DATA:', JSON.stringify(compData));

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}
run();
