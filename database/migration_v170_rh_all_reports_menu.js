const pool = require('../server/src/config/db');

const ALL_RH_REPORTS = [
    { label: 'Planilla de ISSS', path: '/rh/reportes/isss', icon: 'FileText', perm: 'manage_rh_planillas' },
    { label: 'Planilla de AFP', path: '/rh/reportes/afp', icon: 'Building2', perm: 'manage_rh_planillas' },
    { label: 'Aportes INSAFORP / INCAF', path: '/rh/reportes/insaforp', icon: 'GraduationCap', perm: 'manage_rh_planillas' },
    { label: 'Costo Laboral Patronal', path: '/rh/reportes/costo-laboral', icon: 'Calculator', perm: 'manage_rh_planillas' },
    { label: 'Informe Mensual de Renta', path: '/rh/reportes/renta', icon: 'Receipt', perm: 'manage_rh_planillas' },
    { label: 'Retenciones a Terceros', path: '/rh/reportes/descuentos-terceros', icon: 'CreditCard', perm: 'manage_rh_planillas' },
    { label: 'Control de Horas Extras', path: '/rh/reportes/horas-extras', icon: 'Clock', perm: 'manage_rh_planillas' },
    { label: 'Historial Acciones de Personal', path: '/rh/reportes/acciones-personal', icon: 'ClipboardList', perm: 'manage_rh_empleados' },
    { label: 'Pasivos Laborales', path: '/rh/reportes/pasivos-laborales', icon: 'Scale', perm: 'manage_rh_planillas' },
    { label: 'Control de Vacaciones', path: '/rh/reportes/control-vacaciones', icon: 'Palmtree', perm: 'manage_rh_planillas' },
    { label: 'Rotación de Personal', path: '/rh/reportes/rotacion-personal', icon: 'ArrowLeftRight', perm: 'manage_rh_empleados' },
    { label: 'Constancia de Sueldo', path: '/rh/reportes/constancia-sueldo', icon: 'FileCheck', perm: 'manage_rh_empleados' },
    { label: 'Carta de Renta', path: '/rh/reportes/carta-renta', icon: 'FileCheck', perm: 'manage_rh_planillas' },
    { label: 'Listado de Empleados', path: '/rh/reportes/empleados', icon: 'Users', perm: 'manage_rh_empleados' },
];

async function runMigration() {
    try {
        console.log('Running migration v170 - Complete RH reports menu...');

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
            console.log(`  → Submenú "Reportes" localizado (id=${reportsParent.id})`);
        }

        let insertedCount = 0;
        let updatedCount = 0;
        let sortOrder = 1;

        for (const report of ALL_RH_REPORTS) {
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
                updatedCount++;
                console.log(`  ~ Actualizado: ${report.label}`);
            }
            sortOrder++;
        }

        console.log(`Migración v170 completada: ${insertedCount} insertados, ${updatedCount} actualizados.`);
    } catch (e) {
        console.error('Error en migración v170:', e);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

runMigration();
