const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'view_sales_top_products_category_report';

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- Migration v225: Menú y permiso para Reporte de Top Productos por Categoría ---');

        // 1. Obtener item padre 'Reportes' bajo 'Ventas'
        const [[parent]] = await pool.query(`
            SELECT id FROM menu_items 
            WHERE label = 'Reportes' AND parent_id = (
                SELECT id FROM menu_items WHERE label = 'Ventas' AND parent_id IS NULL LIMIT 1
            ) LIMIT 1
        `);

        if (!parent) {
            throw new Error('No se encontró el nodo padre "Reportes" bajo "Ventas" en menu_items.');
        }

        const parentId = parent.id;
        console.log(`  ✓ Contenedor padre "Reportes" encontrado (id=${parentId})`);

        // 2. Verificar o insertar el item en menu_items
        const [existing] = await pool.query(
            'SELECT id FROM menu_items WHERE path = ? LIMIT 1',
            ['/ventas/reportes/top-productos-categoria']
        );

        if (existing.length > 0) {
            console.log('  → El item "/ventas/reportes/top-productos-categoria" ya existe en menu_items.');
            await pool.query(`
                UPDATE menu_items 
                SET parent_id = ?, label = 'Top Productos por Categoría', icon = 'Award', permission_key = ?, is_active = 1
                WHERE id = ?
            `, [parentId, PERMISSION_KEY, existing[0].id]);
        } else {
            const [maxOrder] = await pool.query(
                'SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?',
                [parentId]
            );
            const nextOrder = (maxOrder[0]?.max_o || 0) + 1;
            await pool.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
                VALUES (?, 'Top Productos por Categoría', '/ventas/reportes/top-productos-categoria', 'Award', ?, ?, 1)
            `, [parentId, PERMISSION_KEY, nextOrder]);
            console.log(`  ✓ Item insertado con sort_order=${nextOrder}`);
        }

        // 3. Asignar permiso a roles que ya tengan view_sales_report o roles administrativos
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        let updatedCount = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) continue;

            const roleName = (role.name || '').toLowerCase();
            const isAdminRole = roleName.includes('admin') || roleName.includes('super');
            const hasSalesReport = perms.includes('view_sales_report') || perms.includes('manage_sales');

            if ((isAdminRole || hasSalesReport) && !perms.includes(PERMISSION_KEY)) {
                perms.push(PERMISSION_KEY);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [
                    JSON.stringify(perms),
                    role.id
                ]);
                console.log(`  ✓ Permiso añadido al rol "${role.name}" (id=${role.id})`);
                updatedCount++;
            }
        }

        console.log(`--- Migración v225 completada: ${updatedCount} roles actualizados con ${PERMISSION_KEY} ---`);
    } catch (error) {
        console.error('Error durante la migración v225:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = { runMigration };

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
