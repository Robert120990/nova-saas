const mysql = require('mysql2/promise');

async function getDocumentNumbers() {
    try {
        const pool = mysql.createPool({
            host: '207.244.251.167',
            user: 'sysadmin',
            password: 'QwErTy123',
            database: 'db_sistema_saas'
        });
        const [rows] = await pool.query('SELECT id, numero_control, codigo_generacion FROM sales_headers WHERE numero_control IS NOT NULL LIMIT 15');
        console.log('Document Numbers from sales_headers:');
        rows.forEach(r => {
            console.log(`ID: ${r.id}, control: "${r.numero_control}" (${r.numero_control.length} chars), gen: "${r.codigo_generacion}"`);
        });
        await pool.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

getDocumentNumbers();
