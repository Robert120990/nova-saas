const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'view_gas_lubricants_comparison_report';

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('=== Iniciando Migración v217: Reporte Comparativo de Lubricantes (Gasolinera) ===');

        // 1. Verificar si ya existe el ítem de menú
        console.log('  → Verificando ítem de menú para Comparativo Lubricantes...');
        const [existingMenu] = await pool.query(
            "SELECT id FROM menu_items WHERE permission_key = ? OR path = '/gas-station/reporte-comparativo-lubricantes' LIMIT 1",
            [PERMISSION_KEY]
        );

        if (existingMenu.length > 0) {
            console.log(`  → El ítem de menú ya existe con ID ${existingMenu[0].id}, actualizando datos...`);
            await pool.query(`
                UPDATE menu_items 
                SET label = 'Comparativo Lubricantes',
                    path = '/gas-station/reporte-comparativo-lubricantes',
                    icon = 'GitCompare',
                    permission_key = ?,
                    sort_order = 11,
                    is_active = 1,
                    hide_in_menu = 0
                WHERE id = ?
            `, [PERMISSION_KEY, existingMenu[0].id]);
        } else {
            // Buscar nodo padre: Reportes bajo Gasolinera
            const [gasolineraRows] = await pool.query("SELECT id FROM menu_items WHERE label = 'Gasolinera' AND parent_id IS NULL LIMIT 1");
            if (gasolineraRows.length === 0) {
                console.log('  ⚠ Nodo Gasolinera no encontrado');
            } else {
                const gasolineraId = gasolineraRows[0].id;
                const [reportesRows] = await pool.query("SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = ? LIMIT 1", [gasolineraId]);
                
                if (reportesRows.length === 0) {
                    console.log('  ⚠ Subnodo Reportes de Gasolinera no encontrado');
                } else {
                    const parentId = reportesRows[0].id;
                    const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [parentId]);
                    const nextOrder = Math.max((maxOrder[0]?.max_o || 0) + 1, 11);

                    const [insertResult] = await pool.query(`
                        INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                        VALUES (?, 'Comparativo Lubricantes', '/gas-station/reporte-comparativo-lubricantes', 'GitCompare', ?, ?, 1, 0)
                    `, [parentId, PERMISSION_KEY, nextOrder]);

                    console.log(`  → Menú insertado con ID ${insertResult.insertId}, orden: ${nextOrder}`);
                }
            }
        }

        // 2. Actualizar roles para heredar la nueva clave de permiso única
        console.log('  → Actualizando permisos en roles...');
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        let updatedRoles = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) continue;

            const roleName = (role.name || '').toLowerCase();
            const isAdminRole = ['superadmin', 'admin', 'administrador'].includes(roleName);
            const hasGasAccess = perms.includes('view_gas_lubricants_report') || 
                                 perms.includes('view_gas_fuel_sales_report') || 
                                 perms.includes('view_gas_closeout_detail') ||
                                 perms.includes('view_gas_advances_report');

            if ((isAdminRole || hasGasAccess) && !perms.includes(PERMISSION_KEY)) {
                perms.push(PERMISSION_KEY);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                updatedRoles++;
            }
        }
        console.log(`  → ${updatedRoles} roles actualizados con el permiso: ${PERMISSION_KEY}`);

        console.log('=== Migración v217 completada con éxito ===');
    } catch (error) {
        console.error('Error ejecutando migración v217:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().catch(err => {
        console.error('Fallo en la migración v217:', err);
        process.exit(1);
    });
}
