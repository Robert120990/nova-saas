const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 5
    });

    try {
        console.log('--- Iniciando Migración v161: CRM Acuerdos de Precios con Clientes ---');

        // 1. Agregar columnas product_id y agreed_unit_price a egg_costing_customer_agreements si no existen
        const [cols] = await pool.query('DESCRIBE egg_costing_customer_agreements');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('product_id')) {
            await pool.query(`
                ALTER TABLE egg_costing_customer_agreements 
                ADD COLUMN product_id INT NULL AFTER customer_id,
                ADD CONSTRAINT fk_ecca_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
            `);
            console.log('✓ Columna product_id agregada con FK a products.');
        } else {
            console.log('✓ Columna product_id ya existe.');
        }

        if (!colNames.includes('agreed_unit_price')) {
            await pool.query(`
                ALTER TABLE egg_costing_customer_agreements 
                ADD COLUMN agreed_unit_price DECIMAL(10,4) NULL AFTER agreed_price_per_lb
            `);
            console.log('✓ Columna agreed_unit_price agregada.');
        } else {
            console.log('✓ Columna agreed_unit_price ya existe.');
        }

        // 2. Vincular clientes y calcular precios unitarios iniciales para acuerdos existentes
        // Heurística de peso de presentación para calcular agreed_unit_price si está en NULL
        await pool.query(`
            UPDATE egg_costing_customer_agreements
            SET agreed_unit_price = CASE
                WHEN presentation LIKE '%30LB%' OR presentation LIKE '%30 LB%' THEN ROUND(agreed_price_per_lb * 30, 4)
                WHEN presentation LIKE '%32LB%' OR presentation LIKE '%32 LB%' THEN ROUND(agreed_price_per_lb * 32, 4)
                WHEN presentation LIKE '%8LB%' OR presentation LIKE '%8 LB%' OR presentation LIKE '%galón%' OR presentation LIKE '%galon%' THEN ROUND(agreed_price_per_lb * 8, 4)
                WHEN presentation LIKE '%4LB%' OR presentation LIKE '%4 LB%' OR presentation LIKE '%medio galón%' THEN ROUND(agreed_price_per_lb * 4, 4)
                WHEN presentation LIKE '%2LB%' OR presentation LIKE '%2 LB%' OR presentation LIKE '%litro%' THEN ROUND(agreed_price_per_lb * 2, 4)
                ELSE ROUND(agreed_price_per_lb, 4)
            END
            WHERE agreed_unit_price IS NULL OR agreed_unit_price = 0
        `);
        console.log('✓ Precios unitarios base calculados para acuerdos existentes.');

        // Vincular PriceSmart (customer_id = 11279) y producto HEC30 (id = 9704)
        await pool.query(`
            UPDATE egg_costing_customer_agreements
            SET customer_id = 11279,
                customer_name = 'PRICESMART EL SALVADOR. S.A DE C.V',
                product_id = 9704,
                agreed_unit_price = 35.7000
            WHERE company_id = 9 AND (customer_name LIKE '%PriceSmart%' OR customer_name LIKE '%PRICESMART%')
        `);
        console.log('✓ Acuerdo de PriceSmart vinculado a cliente 11279 y producto 9704.');

        // Vincular Cocina de Vuelos (customer_id = 11287)
        await pool.query(`
            UPDATE egg_costing_customer_agreements
            SET customer_id = 11287,
                customer_name = 'COCINA DE VUELOS, S.A. DE C.V.',
                product_id = 9725,
                agreed_unit_price = 9.6000
            WHERE company_id = 9 AND (customer_name LIKE '%Cocina de Vuelos%' OR customer_name LIKE '%Gate Gourmet%')
        `);
        console.log('✓ Acuerdo de Cocina de Vuelos vinculado a cliente 11287.');

        // 3. Registrar Menú CRM en menu_items
        const [crmParent] = await pool.query("SELECT id FROM menu_items WHERE label = 'CRM' AND parent_id IS NULL LIMIT 1");
        let crmParentId;
        if (crmParent.length === 0) {
            const [res] = await pool.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (NULL, 'CRM', NULL, 'Handshake', 'view_crm', 35, 1, 0)
            `);
            crmParentId = res.insertId;
            console.log(`✓ Grupo de menú 'CRM' creado con id=${crmParentId}.`);
        } else {
            crmParentId = crmParent[0].id;
            console.log(`✓ Grupo de menú 'CRM' ya existía con id=${crmParentId}.`);
        }

        // Submenú 'Acuerdos con Clientes'
        const [subItem] = await pool.query("SELECT id FROM menu_items WHERE path = '/crm/acuerdos' LIMIT 1");
        if (subItem.length === 0) {
            await pool.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (?, 'Acuerdos con Clientes', '/crm/acuerdos', 'FileSignature', 'manage_customer_agreements', 1, 1, 0)
            `, [crmParentId]);
            console.log("✓ Submenú 'Acuerdos con Clientes' creado bajo CRM.");
        } else {
            await pool.query("UPDATE menu_items SET parent_id = ? WHERE id = ?", [crmParentId, subItem[0].id]);
            console.log("✓ Submenú 'Acuerdos con Clientes' ya existía, actualizado.");
        }

        // 4. Asignar permiso manage_customer_agreements y view_crm a SuperAdmin y Administrador
        const [adminRoles] = await pool.query("SELECT id, name, permissions FROM roles WHERE name IN ('SuperAdmin', 'Administrador')");
        for (const r of adminRoles) {
            let perms = [];
            try {
                perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
            } catch (e) {
                perms = [];
            }
            let updated = false;
            if (!perms.includes('view_crm')) {
                perms.push('view_crm');
                updated = true;
            }
            if (!perms.includes('manage_customer_agreements')) {
                perms.push('manage_customer_agreements');
                updated = true;
            }
            if (updated) {
                await pool.query("UPDATE roles SET permissions = ? WHERE id = ?", [JSON.stringify(perms), r.id]);
                console.log(`✓ Permisos de CRM agregados al rol ${r.name}.`);
            }
        }

        console.log('--- Migración v161 completada con éxito ---');
    } catch (error) {
        console.error('Error en migración v161:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
