const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const MENU_ITEM_UPDATES = [
    // Recursos Humanos
    { path: '/rh/acciones-personal', newKey: 'manage_rh_acciones_personal' },
    { path: '/rh/reportes/isss', newKey: 'view_rh_isss_report' },
    { path: '/rh/reportes/afp', newKey: 'view_rh_afp_report' },
    { path: '/rh/reportes/insaforp', newKey: 'view_rh_insaforp_report' },
    { path: '/rh/reportes/costo-laboral', newKey: 'view_rh_costo_laboral_report' },
    { path: '/rh/reportes/renta', newKey: 'view_rh_renta_report' },
    { path: '/rh/reportes/descuentos-terceros', newKey: 'view_rh_descuentos_terceros_report' },
    { path: '/rh/reportes/horas-extras', newKey: 'view_rh_horas_extras_report' },
    { path: '/rh/reportes/acciones-personal', newKey: 'view_rh_acciones_personal_report' },
    { path: '/rh/reportes/pasivos-laborales', newKey: 'view_rh_pasivos_laborales_report' },
    { path: '/rh/reportes/control-vacaciones', newKey: 'view_rh_control_vacaciones_report' },
    { path: '/rh/reportes/rotacion-personal', newKey: 'view_rh_rotacion_personal_report' },
    { path: '/rh/reportes/constancia-sueldo', newKey: 'view_rh_constancia_sueldo' },
    { path: '/rh/reportes/carta-renta', newKey: 'view_rh_carta_renta' },
    { path: '/rh/reportes/empleados', newKey: 'view_rh_empleados_report' },

    // Contabilidad
    { path: '/contabilidad/contabilizar', newKey: 'manage_accounting_contabilizar_ventas_compras' },
    { path: '/contabilidad/contabilizar/cxc-cxp', newKey: 'manage_accounting_contabilizar_cxc_cxp' },
    { path: '/contabilidad/correlativos', newKey: 'manage_accounting_correlativos' },

    // Compras
    { path: '/compras/reportes/chq-contado', newKey: 'view_purchase_checks_report' },
    { path: '/compras/reportes/quedan', newKey: 'view_purchase_quedan_report' },

    // Inventario
    { path: '/inventario/reportes/valorizacion', newKey: 'view_inventory_valuation_report' },
    { path: '/inventario/reportes/rotacion', newKey: 'view_inventory_turnover_report' },

    // Huevo Industrial
    { path: '/industrial/costeo-libra', newKey: 'manage_industrial_costeo_libra' },
];

const INHERITANCE_RULES = {
    manage_rh_planillas: [
        'view_rh_isss_report',
        'view_rh_afp_report',
        'view_rh_insaforp_report',
        'view_rh_costo_laboral_report',
        'view_rh_renta_report',
        'view_rh_descuentos_terceros_report',
        'view_rh_horas_extras_report',
        'view_rh_pasivos_laborales_report',
        'view_rh_control_vacaciones_report',
        'view_rh_carta_renta'
    ],
    manage_rh_empleados: [
        'manage_rh_acciones_personal',
        'view_rh_acciones_personal_report',
        'view_rh_rotacion_personal_report',
        'view_rh_constancia_sueldo',
        'view_rh_empleados_report'
    ],
    manage_accounting_entries: [
        'manage_accounting_contabilizar_ventas_compras',
        'manage_accounting_contabilizar_cxc_cxp',
        'manage_accounting_correlativos'
    ],
    manage_purchase_checks: [
        'view_purchase_checks_report'
    ],
    manage_purchase_quedan: [
        'view_purchase_quedan_report'
    ],
    view_stock_report: [
        'view_inventory_valuation_report',
        'view_inventory_turnover_report'
    ],
    manage_industrial_costs: [
        'manage_industrial_costeo_libra'
    ]
};

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- MIGRACIÓN V187: CLAVES DE PERMISO GRANULARES Y DEDICADAS ---');

        // 1. Actualizar menu_items
        let updatedItems = 0;
        for (const item of MENU_ITEM_UPDATES) {
            const [result] = await pool.query(
                'UPDATE menu_items SET permission_key = ? WHERE path = ?',
                [item.newKey, item.path]
            );
            if (result.affectedRows > 0) {
                console.log(`  ✓ Menú actualizado: ${item.path} -> ${item.newKey}`);
                updatedItems++;
            } else {
                console.log(`  - No se encontró ruta (o ya tenía la clave): ${item.path}`);
            }
        }
        console.log(`Total de opciones de menú actualizadas: ${updatedItems}`);

        // 2. Actualizar roles existentes para retrocompatibilidad
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        let updatedRoles = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { perms = []; }
                if (typeof perms === 'string') {
                    try { perms = JSON.parse(perms); } catch (e) {}
                }
            }
            if (!Array.isArray(perms)) perms = [];

            const permsSet = new Set(perms);
            let modified = false;

            // Si es SuperAdmin o Admin, asegurar que tenga todas las nuevas claves
            const isAdminRole = role.name === 'SuperAdmin' || role.name === 'Admin';

            for (const [sourceKey, inheritedKeys] of Object.entries(INHERITANCE_RULES)) {
                if (permsSet.has(sourceKey) || isAdminRole) {
                    for (const newKey of inheritedKeys) {
                        if (!permsSet.has(newKey)) {
                            permsSet.add(newKey);
                            modified = true;
                        }
                    }
                }
            }

            if (modified) {
                const newPermsArray = Array.from(permsSet);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [
                    JSON.stringify(newPermsArray),
                    role.id
                ]);
                console.log(`  ✓ Rol "${role.name}" (id=${role.id}) actualizado con ${newPermsArray.length} permisos.`);
                updatedRoles++;
            } else {
                console.log(`  - Rol "${role.name}" (id=${role.id}) no requirió cambios.`);
            }
        }

        console.log(`\nMigración v187 completada exitosamente. Roles actualizados: ${updatedRoles}.`);
    } catch (error) {
        console.error('Error en migración v187:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
