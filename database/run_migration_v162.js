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
        console.log('--- Iniciando Migración v162: Permisos de CRM y Calendario Industrial ---');

        // 1. Root group CRM must have permission_key = NULL to match all root groups
        await pool.query(`
            UPDATE menu_items 
            SET permission_key = NULL, is_active = 1, hide_in_menu = 0 
            WHERE label = 'CRM' AND parent_id IS NULL
        `);
        console.log("✓ Grupo 'CRM' actualizado con permission_key = NULL.");

        // 2. Asegurar que Acuerdos con Clientes y Calendario de Producción estén activos
        await pool.query(`
            UPDATE menu_items 
            SET is_active = 1, hide_in_menu = 0 
            WHERE path IN ('/crm/acuerdos', '/industrial/calendario')
        `);
        console.log("✓ Submenús '/crm/acuerdos' y '/industrial/calendario' activos.");

        // 3. Permisos a otorgar
        const crmPerms = ['view_crm', 'manage_customer_agreements'];
        const industrialPerms = ['manage_production', 'view_industrial_dashboard', 'manage_industrial_costs', 'manage_industrial_settings'];

        const rolesToUpdate = [
            { name: 'SuperAdmin', perms: [...crmPerms, ...industrialPerms] },
            { name: 'Admin', perms: [...crmPerms, ...industrialPerms] },
            { name: 'Gerencia', perms: [...crmPerms, ...industrialPerms] },
            { name: 'Supervisor', perms: [...crmPerms, 'manage_production', 'view_industrial_dashboard'] },
            { name: 'Contador', perms: [...crmPerms, 'manage_production', 'view_industrial_dashboard', 'manage_industrial_costs'] },
            { name: 'Operaciones', perms: [...crmPerms, ...industrialPerms] }
        ];

        for (const item of rolesToUpdate) {
            const [rows] = await pool.query('SELECT id, name, permissions FROM roles WHERE name = ?', [item.name]);
            for (const r of rows) {
                let perms = [];
                try {
                    perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
                    if (typeof perms === 'string') perms = JSON.parse(perms);
                } catch (e) {
                    perms = [];
                }
                if (!Array.isArray(perms)) perms = [];

                let changed = false;
                for (const p of item.perms) {
                    if (!perms.includes(p)) {
                        perms.push(p);
                        changed = true;
                    }
                }

                if (changed) {
                    await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), r.id]);
                    console.log(`✓ Rol '${r.name}' actualizado con nuevos permisos.`);
                } else {
                    console.log(`- Rol '${r.name}' ya tenía los permisos.`);
                }
            }
        }

        console.log('--- Migración v162 completada con éxito ---');
    } catch (error) {
        console.error('Error en migración v162:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
