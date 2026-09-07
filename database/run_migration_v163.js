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
        console.log('--- Iniciando Migración v163: Módulos por Empresa y Limpieza de Huevo/CRM ---');

        // 1. Agregar columna enabled_modules a companies si no existe
        const [cols] = await pool.query('DESCRIBE companies');
        const hasModulesCol = cols.some(c => c.Field === 'enabled_modules');
        if (!hasModulesCol) {
            await pool.query('ALTER TABLE companies ADD COLUMN enabled_modules JSON NULL AFTER dte_active');
            console.log("✓ Columna 'enabled_modules' agregada a companies.");
        } else {
            console.log("- Columna 'enabled_modules' ya existía en companies.");
        }

        // 2. Limpieza de datos de CRM y Huevo Industrial en empresas que no sean ANDELSA (id != 9)
        const eggTables = [
            'egg_costing_customer_agreements',
            'egg_costing_configurations',
            'egg_costing_cip_items',
            'egg_costing_packaging',
            'egg_costing_scenarios',
            'egg_raw_materials',
            'egg_production_batches',
            'egg_cip_logs',
            'egg_industrial_costs',
            'egg_batch_variable_costs',
            'egg_packaging_records',
            'egg_pasteurization_logs',
            'egg_blast_freezer_logs',
            'egg_industrial_events',
            'egg_lab_micro_logs',
            'egg_returnable_packaging',
            'egg_returnable_movements',
            'egg_scheduled_productions',
            'egg_scheduled_tasks',
            'egg_customer_orders',
            'egg_product_config'
        ];

        for (const tbl of eggTables) {
            try {
                const [res] = await pool.query(`DELETE FROM \`${tbl}\` WHERE company_id != 9`);
                if (res.affectedRows > 0) {
                    console.log(`✓ Limpieza en '${tbl}': ${res.affectedRows} registros demo eliminados de empresas != 9.`);
                }
            } catch (err) {
                // Table may be empty or not present
            }
        }

        // 3. Configuración inicial de módulos por empresa
        // Gasolineras (1, 2, 8):
        await pool.query(`
            UPDATE companies 
            SET enabled_modules = JSON_ARRAY('sales', 'purchases', 'inventory', 'gas_station', 'accounting', 'human_resources')
            WHERE id IN (1, 2, 8)
        `);
        console.log("✓ Módulos de Gasolineras asignados para empresas 1, 2 y 8.");

        // ANDELSA (9):
        await pool.query(`
            UPDATE companies 
            SET enabled_modules = JSON_ARRAY('sales', 'purchases', 'inventory', 'egg_industrial', 'crm', 'accounting', 'human_resources')
            WHERE id = 9
        `);
        console.log("✓ Módulos avícolas y CRM asignados para ANDELSA (empresa 9).");

        // Cualquier otra empresa:
        await pool.query(`
            UPDATE companies 
            SET enabled_modules = JSON_ARRAY('sales', 'purchases', 'inventory', 'accounting', 'human_resources')
            WHERE enabled_modules IS NULL
        `);

        // 4. Registrar ítem de menú en Sistema (parent_id: 2)
        const [existingMenu] = await pool.query("SELECT id FROM menu_items WHERE path = '/configuracion/modulos-empresa'");
        if (existingMenu.length === 0) {
            await pool.query(`
                INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                VALUES (2, 'Módulos por Empresa', '/configuracion/modulos-empresa', 'Layers', 'manage_company_modules', 4, 1, 0)
            `);
            console.log("✓ Menú 'Módulos por Empresa' registrado.");
        } else {
            await pool.query(`
                UPDATE menu_items 
                SET parent_id = 2, label = 'Módulos por Empresa', icon = 'Layers', permission_key = 'manage_company_modules', is_active = 1, hide_in_menu = 0
                WHERE id = ?
            `, [existingMenu[0].id]);
            console.log("✓ Menú 'Módulos por Empresa' actualizado.");
        }

        // 5. Asignar permiso manage_company_modules a SuperAdmin y Admin
        const rolesToUpdate = ['SuperAdmin', 'Admin'];
        for (const roleName of rolesToUpdate) {
            const [rows] = await pool.query('SELECT id, name, permissions FROM roles WHERE name = ?', [roleName]);
            for (const r of rows) {
                let perms = [];
                try {
                    perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
                    if (typeof perms === 'string') perms = JSON.parse(perms);
                } catch (e) { perms = []; }
                if (!Array.isArray(perms)) perms = [];

                if (!perms.includes('manage_company_modules')) {
                    perms.push('manage_company_modules');
                    await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), r.id]);
                    console.log(`✓ Permiso 'manage_company_modules' otorgado al rol '${roleName}'.`);
                }
            }
        }

        console.log('--- Migración v163 finalizada exitosamente ---');
    } catch (error) {
        console.error('Error en migración v163:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
