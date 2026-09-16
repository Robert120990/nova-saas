const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'manage_server_terminal';

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- Migration v200: Terminal del Servidor y SSH en Menú Configuración y Roles ---');

        // 1. Buscar nodo de Configuración
        const [configRows] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Configuración' AND parent_id IS NULL LIMIT 1"
        );

        let parentId = null;
        if (configRows.length > 0) {
            parentId = configRows[0].id;
        } else {
            console.log('  ⚠️ No se encontró nodo padre Configuración, buscando por path /configuracion...');
            const [fallbackRows] = await pool.query(
                "SELECT id FROM menu_items WHERE path LIKE '%/configuracion%' LIMIT 1"
            );
            if (fallbackRows.length > 0) {
                parentId = fallbackRows[0].parent_id || fallbackRows[0].id;
            }
        }

        // 2. Verificar o insertar el ítem de menú
        const [existing] = await pool.query(
            "SELECT id FROM menu_items WHERE permission_key = ? OR path = '/configuracion/terminal' LIMIT 1",
            [PERMISSION_KEY]
        );

        if (existing.length > 0) {
            console.log(`  → El ítem de menú para ${PERMISSION_KEY} ya existe (id=${existing[0].id}). Actualizando datos...`);
            await pool.query(
                `UPDATE menu_items 
                 SET label = 'Terminal del Servidor',
                     path = '/configuracion/terminal',
                     icon = 'Terminal',
                     permission_key = ?,
                     is_active = 1,
                     hide_in_menu = 0
                 WHERE id = ?`,
                [PERMISSION_KEY, existing[0].id]
            );
        } else {
            let nextOrder = 10;
            if (parentId) {
                const [maxOrder] = await pool.query(
                    'SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?',
                    [parentId]
                );
                nextOrder = (maxOrder[0]?.max_o || 0) + 1;
            }

            const [insertResult] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Terminal del Servidor', '/configuracion/terminal', 'Terminal', ?, ?, 1, 0)`,
                [parentId, PERMISSION_KEY, nextOrder]
            );
            console.log(`  ✓ Menú "Terminal del Servidor" insertado con id=${insertResult.insertId}, sort_order=${nextOrder}`);
        }

        // 3. Asignar permiso a roles administrativos y de sistemas
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        let updatedCount = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) perms = [];

            const roleName = (role.name || '').toLowerCase();
            const isAdminOrTech = 
                roleName.includes('superadmin') || 
                roleName === 'admin' || 
                roleName === 'administrador' || 
                roleName.includes('gerencia') ||
                roleName.includes('sistema') ||
                roleName.includes('soporte') ||
                perms.includes('view_server_metrics') ||
                perms.includes('manage_system_settings');

            if (isAdminOrTech && !perms.includes(PERMISSION_KEY)) {
                perms.push(PERMISSION_KEY);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [
                    JSON.stringify(perms),
                    role.id
                ]);
                console.log(`  ✓ Permiso "${PERMISSION_KEY}" asignado al rol "${role.name}" (id=${role.id})`);
                updatedCount++;
            }
        }

        console.log(`\n--- Migración v200 completada exitosamente (${updatedCount} roles actualizados) ---`);
    } catch (error) {
        console.error('Migration v200 failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
