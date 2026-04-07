const mysql = require('mysql2/promise');

async function main() {
    const creds = {
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123'
    };

    const company_id = 1;

    try {
        const sourceConn = await mysql.createConnection({...creds, database: 'db_sipe_chalchuapa'});
        const targetConn = await mysql.createConnection({...creds, database: 'db_sistema_saas'});

        console.log('--- Resumen de Migración ---');

        // 0. Obtener Sucursales y POS
        const [branches] = await targetConn.query('SELECT id FROM branches WHERE company_id = ?', [company_id]);
        const [pos_list] = await targetConn.query('SELECT id FROM points_of_sale WHERE company_id = ?', [company_id]);
        console.log(`Sucursales encontradas: ${branches.length}`);
        console.log(`Puntos de Venta encontrados: ${pos_list.length}`);

        // 1. Migrar Categorías (tipos_linea -> product_categories)
        console.log('\nMigrando Categorías...');
        const [lines] = await sourceConn.query('SELECT id, descripcion FROM tipos_linea');
        const categoryMap = new Map();

        for (const line of lines) {
            const [existing] = await targetConn.query('SELECT id FROM product_categories WHERE name = ? AND company_id = ?', [line.descripcion, company_id]);
            let catId;
            if (existing.length === 0) {
                const [result] = await targetConn.query('INSERT INTO product_categories (name, company_id) VALUES (?, ?)', [line.descripcion, company_id]);
                catId = result.insertId;
            } else {
                catId = existing[0].id;
            }
            categoryMap.set(line.id, catId);
        }
        console.log(`Categorías procesadas: ${lines.length}`);

        // 2. Migrar Proveedores
        console.log('\nMigrando Proveedores...');
        const [srcProviders] = await sourceConn.query('SELECT * FROM proveedores');
        let providersCount = 0;
        for (const p of srcProviders) {
            const [existing] = await targetConn.query('SELECT id FROM providers WHERE nit = ? AND company_id = ?', [p.nit, company_id]);
            if (existing.length === 0) {
                await targetConn.query(`
                    INSERT INTO providers (company_id, nit, nrc, nombre, nombre_comercial, direccion, telefono, correo, numero_documento)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [company_id, p.nit, p.nrc, p.nombre, p.nombre_comercial, p.direccion, p.telefono, p.correo, p.dui]);
                providersCount++;
            }
        }
        console.log(`Proveedores nuevos agregados: ${providersCount}`);

        // 3. Migrar Clientes
        console.log('\nMigrando Clientes...');
        const [srcCustomers] = await sourceConn.query('SELECT * FROM clientes');
        let customersCount = 0;
        for (const c of srcCustomers) {
            const [existing] = await targetConn.query('SELECT id FROM customers WHERE (nit = ? OR numero_documento = ?) AND company_id = ?', [c.nit, c.dui, company_id]);
            if (existing.length === 0) {
                await targetConn.query(`
                    INSERT INTO customers (company_id, nit, nrc, nombre, nombre_comercial, direccion, telefono, correo, numero_documento)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [company_id, c.nit, c.nrc, c.nombre, c.nombre_comercial, c.direccion, c.telefono, c.correo, c.dui]);
                customersCount++;
            }
        }
        console.log(`Clientes nuevos agregados: ${customersCount}`);

        // 4. Migrar Productos y Asignaciones
        console.log('\nMigrando Productos y Asignaciones...');
        const [srcProducts] = await sourceConn.query('SELECT * FROM productos');
        let productsCount = 0;
        for (const p of srcProducts) {
            const [existing] = await targetConn.query('SELECT id FROM products WHERE codigo = ? AND company_id = ?', [p.codigo, company_id]);
            let prodId;
            if (existing.length === 0) {
                const catId = categoryMap.get(p.id_linea) || null;
                const [result] = await targetConn.query(`
                    INSERT INTO products (company_id, codigo, nombre, codigo_barra, descripcion, precio_unitario, costo, es_exento, category_id, status, afecta_inventario)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', 1)
                `, [company_id, p.codigo, p.descripcion, p.barra, p.descripcion, p.precio_sugerido, p.costo, p.es_exento, catId]);
                prodId = result.insertId;
                productsCount++;

                // Asignar a Sucursales (product_branch) e Inventario (inicial 0)
                for (const b of branches) {
                    await targetConn.query('INSERT IGNORE INTO product_branch (product_id, branch_id) VALUES (?, ?)', [prodId, b.id]);
                    // Inicializar inventario
                    await targetConn.query('INSERT IGNORE INTO inventory (product_id, branch_id, stock) VALUES (?, ?, 0)', [prodId, b.id]);
                }

                // Asignar a Puntos de Venta (product_pos)
                for (const pos of pos_list) {
                    await targetConn.query('INSERT IGNORE INTO product_pos (product_id, pos_id) VALUES (?, ?)', [prodId, pos.id]);
                }
            }
        }
        console.log(`Productos nuevos agregados: ${productsCount}`);
        console.log(`Asignaciones completadas para ${productsCount} productos.`);

        await sourceConn.end();
        await targetConn.end();
        console.log('\n--- Migración Finalizada Exitosamente ---');

    } catch (err) {
        console.error('Error durante la migración:', err);
    }
}

main();
