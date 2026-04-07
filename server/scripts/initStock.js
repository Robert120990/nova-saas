const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'sysadmin',
    password: process.env.DB_PASSWORD || 'QwErTy123',
    database: process.env.DB_NAME || 'db_sistema_saas',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true
});

async function initStock() {
    const connection = await pool.getConnection();
    try {
        console.log('--- Initializing Stock for Testing ---');
        
        // 1. Get all products
        const [products] = await connection.query('SELECT id, company_id FROM products');
        console.log(`Found ${products.length} products.`);

        for (const product of products) {
            // 2. Get the first branch of the company
            const [branches] = await connection.query('SELECT id FROM branches WHERE company_id = ? LIMIT 1', [product.company_id]);
            if (branches.length === 0) continue;

            const branchId = branches[0].id;

            // 3. Insert or Update stock (100 units)
            const [existing] = await connection.query('SELECT id FROM inventory WHERE product_id = ? AND branch_id = ?', [product.id, branchId]);
            
            if (existing.length > 0) {
                await connection.query('UPDATE inventory SET stock = 100 WHERE id = ?', [existing[0].id]);
            } else {
                await connection.query('INSERT INTO inventory (product_id, branch_id, stock) VALUES (?, ?, ?)', [product.id, branchId, 100]);
            }

            // 4. Record ENTRADA movement for Kardex
            await connection.query(`
                INSERT INTO inventory_movements (product_id, branch_id, tipo_movimiento, cantidad, tipo_documento, documento_id)
                VALUES (?, ?, 'ENTRADA', 100, 'INICIALIZACION', 0)
            `, [product.id, branchId]);
        }

        console.log('--- Stock Initialization Completed ---');
        process.exit(0);
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    } finally {
        connection.release();
    }
}

initStock();
