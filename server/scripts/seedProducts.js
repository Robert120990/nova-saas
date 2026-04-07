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

async function seed() {
    const connection = await pool.getConnection();
    try {
        console.log('--- Starting Seeding Test Products ---');
        
        // 1. Get all companies
        const [companies] = await connection.query('SELECT id, razon_social FROM companies');
        console.log(`Found ${companies.length} companies.`);

        for (const company of companies) {
            console.log(`Seeding for company: ${company.razon_social} (ID: ${company.id})`);
            
            // 2. Get branches and POS for this company
            const [branches] = await connection.query('SELECT id FROM branches WHERE company_id = ?', [company.id]);
            const branchIds = branches.map(b => b.id);
            
            let posIds = [];
            if (branchIds.length > 0) {
                const [pos] = await connection.query('SELECT id FROM points_of_sale WHERE branch_id IN (?)', [branchIds]);
                posIds = pos.map(p => p.id);
            }

            // 3. Generate and insert 50 products
            for (let i = 1; i <= 50; i++) {
                const product = {
                    company_id: company.id,
                    codigo: `PROD-${company.id}-${String(i).padStart(3, '0')}`,
                    codigo_barra: `741${company.id}${String(i).padStart(6, '0')}`,
                    nombre: `Producto de Prueba ${i} - ${company.razon_social}`,
                    descripcion: `Descripción detallada para el producto de prueba número ${i}. Ideal para testing de catálogos y búsquedas.`,
                    precio_unitario: (Math.random() * 100 + 1).toFixed(4),
                    unidad_medida: '59', // Sétimo/Unidad? Generalmente es 59 o 77
                    tipo_item: 1, // Bien
                    tipo_operacion: 1, // Gravado
                    tipo_combustible: 0
                };

                const [result] = await connection.query('INSERT INTO products SET ?', [product]);
                const productId = result.insertId;

                // 4. Associations
                if (branchIds.length > 0) {
                    const values = branchIds.map(bid => [productId, bid]);
                    await connection.query('INSERT INTO product_branch (product_id, branch_id) VALUES ?', [values]);
                }

                if (posIds.length > 0) {
                    const values = posIds.map(pid => [productId, pid]);
                    await connection.query('INSERT INTO product_pos (product_id, pos_id) VALUES ?', [values]);
                }

                // Default tribute 01 (IVA)
                await connection.query('INSERT INTO product_tributes (product_id, tribute_code) VALUES (?, ?)', [productId, '01']);
            }
            console.log(`  Inserted 50 products for ${company.razon_social}`);
        }

        console.log('--- Seeding Completed Successfully ---');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    } finally {
        connection.release();
    }
}

seed();
