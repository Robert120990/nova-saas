const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const REPORTS = [
    { label: 'Libro Diario', path: '/contabilidad/reportes/libro-diario', icon: 'FileText', perm: 'view_accounting_libro_diario' },
    { label: 'Libro Diario Mayor', path: '/contabilidad/reportes/libro-diario-mayor', icon: 'FileText', perm: 'view_accounting_libro_diario_mayor' },
    { label: 'Libro Mayor', path: '/contabilidad/reportes/libro-mayor', icon: 'FileText', perm: 'view_accounting_libro_mayor' },
    { label: 'Balance de Comprobación', path: '/contabilidad/reportes/balance-comprobacion', icon: 'FileText', perm: 'view_accounting_balance_comprobacion' },
    { label: 'Estado de Resultados', path: '/contabilidad/reportes/estado-resultados', icon: 'BarChart3', perm: 'view_accounting_estado_resultados' },
    { label: 'Balance General', path: '/contabilidad/reportes/balance-general', icon: 'BarChart3', perm: 'view_accounting_balance_general' },
    { label: 'Anexo de Balance', path: '/contabilidad/reportes/anexo-balance', icon: 'FileText', perm: 'view_accounting_anexo_balance' },
    { label: 'Balance Comparativo', path: '/contabilidad/reportes/balance-comparativo', icon: 'BarChart3', perm: 'view_accounting_balance_comparativo' },
    { label: 'Cambios en el Patrimonio', path: '/contabilidad/reportes/cambios-patrimonio', icon: 'BarChart3', perm: 'view_accounting_cambios_patrimonio' },
    { label: 'Flujo de Efectivo', path: '/contabilidad/reportes/flujo-efectivo', icon: 'BarChart3', perm: 'view_accounting_flujo_efectivo' },
    { label: 'Auxiliar de Operaciones', path: '/contabilidad/reportes/auxiliar-operaciones', icon: 'FileText', perm: 'view_accounting_auxiliar_operaciones' },
    { label: 'Listado de Partidas', path: '/contabilidad/reportes/listado-partidas', icon: 'FileText', perm: 'view_accounting_listado_partidas' },
    { label: 'Cédula de Auditoría', path: '/contabilidad/reportes/cedula-auditoria', icon: 'FileText', perm: 'view_accounting_cedula_auditoria' },
    { label: 'Retenciones', path: '/contabilidad/reportes/retenciones', icon: 'FileText', perm: 'view_accounting_retenciones' },
];

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Running migration v143 - accounting reports menu...');

        const [[accounting]] = await pool.query(
            `SELECT id FROM menu_items WHERE label = 'Contabilidad' AND parent_id IS NULL LIMIT 1`
        );
        if (!accounting) {
            console.error('ERROR: No se encontró el grupo "Contabilidad". Ejecute primero migration_v102_menu_items.js');
            process.exit(1);
        }

        let [[reportsParent]] = await pool.query(
            `SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = ? LIMIT 1`,
            [accounting.id]
        );
        if (!reportsParent) {
            const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [accounting.id]);
            const nextOrder = (maxOrder[0]?.max_o || 0) + 1;
            const [result] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, icon, permission_key, sort_order, is_active)
                 VALUES (?, ?, ?, NULL, ?, TRUE)`,
                [accounting.id, 'Reportes', 'BarChart3', nextOrder]
            );
            reportsParent = { id: result.insertId };
            console.log(`  → Submenú "Reportes" creado (id=${reportsParent.id})`);
        } else {
            console.log(`  → Submenú "Reportes" ya existe (id=${reportsParent.id})`);
        }

        let insertedCount = 0;
        for (const report of REPORTS) {
            const [existing] = await pool.query('SELECT id FROM menu_items WHERE path = ? LIMIT 1', [report.path]);
            if (existing.length > 0) {
                console.log(`  → "${report.label}" ya existe, saltando.`);
                continue;
            }
            const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [reportsParent.id]);
            const nextOrder = (maxOrder[0]?.max_o || 0) + 1;
            await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
                [reportsParent.id, report.label, report.path, report.icon, report.perm, nextOrder]
            );
            console.log(`  → Insertado "${report.label}" → ${report.path}`);
            insertedCount++;
        }

        const [roles] = await pool.query(`SELECT id, name, permissions FROM roles WHERE name = 'SuperAdmin'`);
        let rolesUpdated = 0;
        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) continue;
            const missing = REPORTS.map(r => r.perm).filter(p => !perms.includes(p));
            if (missing.length === 0) continue;
            perms.push(...missing);
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            console.log(`  → Role "${role.name}" (id=${role.id}): agregados ${missing.length} permisos`);
            rolesUpdated++;
        }

        console.log(`Migration v143 completed: ${insertedCount} items insertados, ${rolesUpdated} roles actualizados`);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();