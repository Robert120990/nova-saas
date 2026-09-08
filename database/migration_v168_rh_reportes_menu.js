const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const RH_REPORTS = [
    { label: 'Planilla de ISSS', path: '/rh/reportes/isss', icon: 'FileText', perm: 'manage_rh_planillas' },
    { label: 'Planilla de AFP', path: '/rh/reportes/afp', icon: 'FileText', perm: 'manage_rh_planillas' },
    { label: 'Informe Mensual de Renta', path: '/rh/reportes/renta', icon: 'FileText', perm: 'manage_rh_planillas' },
    { label: 'Constancia de Sueldo', path: '/rh/reportes/constancia-sueldo', icon: 'FileCheck', perm: 'manage_rh_empleados' },
    { label: 'Carta de Renta', path: '/rh/reportes/carta-renta', icon: 'FileCheck', perm: 'manage_rh_planillas' },
    { label: 'Listado de Empleados', path: '/rh/reportes/empleados', icon: 'Users', perm: 'manage_rh_empleados' },
];

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Running migration v168 - RH reports menu...');

        const [[rhGroup]] = await pool.query(
            `SELECT id FROM menu_items WHERE label = 'Recursos Humanos' AND parent_id IS NULL LIMIT 1`
        );
        if (!rhGroup) {
            console.error('ERROR: No se encontró el grupo "Recursos Humanos".');
            process.exit(1);
        }

        let [[reportsParent]] = await pool.query(
            `SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = ? LIMIT 1`,
            [rhGroup.id]
        );

        if (!reportsParent) {
            const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [rhGroup.id]);
            const nextOrder = (maxOrder[0]?.max_o || 0) + 1;
            const [result] = await pool.query(
                `INSERT INTO menu_items (parent_id, label, icon, permission_key, sort_order, is_active)
                 VALUES (?, 'Reportes', 'BarChart3', NULL, ?, TRUE)`,
                [rhGroup.id, nextOrder]
            );
            reportsParent = { id: result.insertId };
            console.log(`  → Submenú "Reportes" creado (id=${reportsParent.id})`);
        } else {
            console.log(`  → Submenú "Reportes" ya existe (id=${reportsParent.id})`);
        }

        let insertedCount = 0;
        let sortOrder = 1;
        for (const report of RH_REPORTS) {
            const [[existing]] = await pool.query(
                `SELECT id FROM menu_items WHERE path = ? LIMIT 1`,
                [report.path]
            );

            if (!existing) {
                await pool.query(
                    `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
                    [reportsParent.id, report.label, report.path, report.icon, report.perm, sortOrder]
                );
                insertedCount++;
                console.log(`  + Insertado: ${report.label} -> ${report.path}`);
            } else {
                await pool.query(
                    `UPDATE menu_items SET parent_id = ?, label = ?, icon = ?, permission_key = ?, sort_order = ?, is_active = TRUE
                     WHERE id = ?`,
                    [reportsParent.id, report.label, report.icon, report.perm, sortOrder, existing.id]
                );
                console.log(`  ~ Actualizado: ${report.label}`);
            }
            sortOrder++;
        }

        console.log(`Migración v168 completada. ${insertedCount} reportes de RH insertados.`);
    } catch (e) {
        console.error('Error en migración v168:', e);
        process.exit(1);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

runMigration();
