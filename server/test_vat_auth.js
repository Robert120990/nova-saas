const pool = require('./src/config/db');
const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

async function test() {
    try {
        // Get a real user
        const [users] = await pool.query('SELECT id, username, nombre, email FROM users LIMIT 1');
        const user = users[0];
        console.log('User:', user.id, user.username);

        // Get company/branch using the same query as auth.controller
        const [roles] = await pool.query(
            'SELECT r.name FROM roles r JOIN usuario_empresa ue ON r.id = ue.role_id WHERE ue.usuario_id = ?',
            [user.id]
        );
        const isSuperAdmin = roles.some(r => r.name === 'SuperAdmin');
        console.log('Is SuperAdmin:', isSuperAdmin);

        const [companies] = await pool.query('SELECT id FROM companies LIMIT 1');
        const companyId = companies[0].id;
        const [branches] = await pool.query('SELECT id FROM branches WHERE company_id = ? LIMIT 1', [companyId]);
        const branchId = branches[0].id;
        console.log('Company:', companyId, 'Branch:', branchId);

        // Create JWT token EXACTLY as auth.controller does
        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                company_id: companyId,
                branch_id: branchId,
                role: 'SuperAdmin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );
        console.log('Token created');

        // Make request
        const url = `http://127.0.0.1:4000/api/vat-books/purchases-pdf?year=2025&month=3&branch_id=all`;
        console.log('Requesting:', url);

        const req = http.request(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
            console.log('=== RESPONSE ===');
            console.log('STATUS:', res.statusCode);
            console.log('CONTENT-TYPE:', res.headers['content-type']);
            
            let data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                if (res.statusCode === 200 && (res.headers['content-type'] || '').includes('pdf')) {
                    console.log('SUCCESS! PDF received:', buffer.length, 'bytes');
                } else {
                    console.log('FAILED! Body:', buffer.toString('utf8').substring(0, 1000));
                }
                pool.end().then(() => process.exit());
            });
        });

        req.on('error', (e) => {
            console.error('Request error:', e.message);
            pool.end().then(() => process.exit(1));
        });

        req.end();
    } catch(e) {
        console.error('Test error:', e);
        pool.end().then(() => process.exit(1));
    }
}

test();
