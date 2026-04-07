const mysql = require('./server/node_modules/mysql2/promise');
const jwt = require('./server/node_modules/jsonwebtoken');

async function test() {
    const pool = mysql.createPool({host:'localhost',user:'sysadmin',password:'QwErTy123',database:'db_sistema_saas'});
    
    // Get user info
    const [users] = await pool.query('SELECT * FROM users LIMIT 1');
    const user = users[0];
    process.stdout.write('USER DATA: ' + JSON.stringify(user) + '\n---\n');
    
    // Simulate the exact backend query for getPaymentHistory
    const company_id = user.company_id;
    process.stdout.write('company_id to use: ' + company_id + '\n');
    
    const whereClauses = ['p.company_id = ?'];
    const queryParams = [company_id];
    const whereStr = whereClauses.join(' AND ');
    
    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) as total FROM customer_payments p LEFT JOIN customers c ON p.customer_id = c.id LEFT JOIN sales_headers h ON p.sale_id = h.id WHERE ${whereStr}`,
        queryParams
    );
    process.stdout.write('Total count: ' + total + '\n');
    
    const [rows] = await pool.query(
        `SELECT p.id, p.fecha_pago, p.monto, p.metodo_pago, c.nombre as cliente_nombre, b.nombre as sucursal_nombre FROM customer_payments p LEFT JOIN customers c ON p.customer_id = c.id LEFT JOIN branches b ON p.branch_id = b.id WHERE ${whereStr} ORDER BY p.fecha_pago DESC LIMIT 10 OFFSET 0`,
        queryParams
    );
    process.stdout.write('Rows returned: ' + rows.length + '\n');
    process.stdout.write('Data: ' + JSON.stringify(rows) + '\n');
    
    await pool.end();
    process.exit(0);
}
test().catch(e => { process.stdout.write('ERROR: ' + e.message + '\nSTACK:' + e.stack + '\n'); process.exit(1); });
