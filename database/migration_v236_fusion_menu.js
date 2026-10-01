const pool = require('../server/src/config/db');

const PERMISSION_KEY = 'manage_fusion_settings';

async function runMigration() {
    try {
        console.log('--- Migration v236: Menú Configuración Fusion FFC y Roles ---');

        // 1. Buscar nodo padre de Configuración
        const [configRows] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'Configuración' AND parent_id IS NULL LIMIT 1"
        );

        let parentId = null;
        if (configRows.length > 0) {
            parentId = configRows[0].id;
        } else {
            const [fallbackRows] = await pool.query(
                "SELECT id FROM menu_items WHERE path LIKE '%/configuracion%' LIMIT 1"
            );
            if (fallbackRows.length > 0) {
                parentId = fallbackRows[0].parent_id || fallbackRows[0].id;
            }
        }

        // 2. Verificar o insertar el ítem de menú
        const [existing] = await pool.query(
            "SELECT id FROM menu_items WHERE permission_key = ? OR path = '/configuracion/fusion-ffc' LIMIT 1",
            [PERMISSION_KEY]
        );

        if (existing.length > 0) {
            console.log(`  → El ítem de menú para ${PERMISSION_KEY} ya existe (id=${existing[0].id}). Actualizando datos...`);
            await pool.query(
                `UPDATE menu_items 
                 SET parent_id = ?,
                     label = 'Controladores Fusion FFC',
                     path = '/configuracion/fusion-ffc',
                     icon = 'Cpu',
                     permission_key = ?,
                     is_active = 1,
                     hide_in_menu = 0
                 WHERE id = ?`,
                [parentId, PERMISSION_KEY, existing[0].id]
            );
        } else {
            let nextOrder = 8;
            if (parentId) {
                const [maxOrder] = await pool.query(
                    'SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?',
                    [parentId]
                );
                nextOrder = (maxOrder[0]?.max_o || 0) + 1;
            }

            const [insertResult] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Controladores Fusion FFC', '/configuracion/fusion-ffc', 'Cpu', ?, ?, 1, 0)`,
                [parentId, PERMISSION_KEY, nextOrder]
            );
            console.log(`  ✓ Menú "Controladores Fusion FFC" insertado con id=${insertResult.insertId}, sort_order=${nextOrder}`);
        }

        // 3. Asignar permiso a roles administrativos y de gasolinera
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        let updatedCount = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) perms = [];

            const roleName = (role.name || '').toLowerCase();
            const shouldHaveAccess = 
                roleName.includes('superadmin') || 
                roleName === 'admin' || 
                roleName === 'administrador' || 
                roleName.includes('gerencia') ||
                perms.includes('manage_gas_settings') ||
                perms.includes('manage_system_settings');

            if (shouldHaveAccess && !perms.includes(PERMISSION_KEY)) {
                perms.push(PERMISSION_KEY);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [
                    JSON.stringify(perms),
                    role.id
                ]);
                console.log(`  ✓ Permiso "${PERMISSION_KEY}" asignado al rol "${role.name}" (id=${role.id})`);
                updatedCount++;
            }
        }

        console.log(`\n--- Migración v236 completada exitosamente (${updatedCount} roles actualizados) ---`);
    } catch (error) {
        console.error('Migration v236 failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = { runMigration };

if (require.main === module) {
    runMigration().catch(err => {
        console.error('Error fatal en migración v236:', err);
        process.exit(1);
    });
}
