const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'view_gas_orders';

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('--- Migración v164: Agregar Consulta de Pedidos en Menú Gasolinera ---');

        // 1. Obtener grupo Gasolinera
        const [[gasParent]] = await pool.query(`
            SELECT id FROM menu_items WHERE label = 'Gasolinera' AND parent_id IS NULL LIMIT 1
        `);

        if (!gasParent) {
            console.error('ERROR: No se encontró el grupo "Gasolinera" en menu_items.');
            process.exit(1);
        }

        const parentId = gasParent.id;

        // 2. Insertar o actualizar menu_item
        const [existing] = await pool.query(
            'SELECT id FROM menu_items WHERE path = ? LIMIT 1',
            ['/gas-station/pedidos']
        );

        if (existing.length > 0) {
            console.log('  → El item ya existe en menu_items.');
        } else {
            // Ubicar después de Trupput o Cierre Lecturas
            await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, ?, ?, ?, ?, ?, TRUE, FALSE)`,
                [parentId, 'Consulta de Pedidos', '/gas-station/pedidos', 'ClipboardList', PERMISSION_KEY, 4]
            );
            console.log('  → Item "Consulta de Pedidos" insertado en menu_items.');
        }

        // 3. Asignar permiso a roles SuperAdmin y Admin
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        for (const role of roles) {
            if (role.name !== 'SuperAdmin' && role.name !== 'Admin') continue;
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) perms = [];

            if (!perms.includes(PERMISSION_KEY)) {
                perms.push(PERMISSION_KEY);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                console.log(`  → Permiso ${PERMISSION_KEY} agregado a rol ${role.name}`);
            }
        }

        console.log('✅ Migración v164 completada con éxito.');
    } catch (err) {
        console.error('Error en migración v164:', err);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
