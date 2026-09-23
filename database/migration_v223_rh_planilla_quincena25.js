const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Iniciando migración v223 - Planilla 25 (Quincena 25)...');

        // 1. Crear tabla rh_planilla_quincena25
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rh_planilla_quincena25 (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                empleado_id INT NOT NULL,
                departamento_personal_id INT NULL,
                branch_id INT NULL,
                filtro_departamento_id INT NULL,
                periodo_anio INT NOT NULL,
                sueldo_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                fecha_ingreso DATE NULL,
                fecha_base DATE NULL,
                dias_laborados_anio INT NOT NULL DEFAULT 0,
                es_proporcional TINYINT(1) NOT NULL DEFAULT 0,
                monto_quincena25 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                ajuste DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                monto_recibir DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                observaciones TEXT NULL,
                estado ENUM('borrador', 'pagada', 'anulada') NOT NULL DEFAULT 'borrador',
                fecha_pago DATE NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE CASCADE,
                UNIQUE KEY uq_q25_emp_periodo (empleado_id, periodo_anio, company_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('  ✓ Tabla rh_planilla_quincena25 creada o verificada.');

        // 2. Encontrar grupo padre "Recursos Humanos"
        const [[rhGroup]] = await pool.query(
            `SELECT id FROM menu_items WHERE label = 'Recursos Humanos' AND parent_id IS NULL LIMIT 1`
        );
        if (!rhGroup) {
            console.error('ERROR: No se encontró el grupo "Recursos Humanos" en menu_items.');
            process.exit(1);
        }

        // 3. Insertar o actualizar item de menú
        const [existingItem] = await pool.query(
            `SELECT id FROM menu_items WHERE path = '/rh/quincena25' LIMIT 1`
        );

        if (existingItem.length === 0) {
            const [maxOrder] = await pool.query(
                `SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?`,
                [rhGroup.id]
            );
            const nextOrder = (maxOrder[0]?.max_o || 10) + 1;

            await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Quincena 25', '/rh/quincena25', 'Sparkles', 'manage_rh_quincena25', ?, TRUE, FALSE)`,
                [rhGroup.id, nextOrder]
            );
            console.log('  ✓ Item de menú /rh/quincena25 creado.');
        } else {
            await pool.query(
                `UPDATE menu_items 
                 SET parent_id = ?, label = 'Quincena 25', icon = 'Sparkles', permission_key = 'manage_rh_quincena25', is_active = TRUE
                 WHERE id = ?`,
                [rhGroup.id, existingItem[0].id]
            );
            console.log('  ✓ Item de menú /rh/quincena25 actualizado.');
        }

        // 4. Actualizar roles para heredar el permiso manage_rh_quincena25
        const [roles] = await pool.query(`SELECT id, name, permissions FROM roles`);
        let updatedRoles = 0;

        for (const role of roles) {
            let perms = [];
            try {
                perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : (role.permissions || []);
            } catch (_) {
                perms = [];
            }

            const isAdminOrSuper = role.name === 'SuperAdmin' || role.name === 'Admin';
            const hasRhPlanillas = perms.includes('manage_rh_planillas') || perms.includes('manage_rh_planilla_aguinaldos');

            if ((isAdminOrSuper || hasRhPlanillas) && !perms.includes('manage_rh_quincena25')) {
                perms.push('manage_rh_quincena25');
                await pool.query(`UPDATE roles SET permissions = ? WHERE id = ?`, [JSON.stringify(perms), role.id]);
                updatedRoles++;
            }
        }
        console.log(`  ✓ Permiso manage_rh_quincena25 asignado a ${updatedRoles} roles.`);

        console.log('Migración v223 completada con éxito.');
    } catch (error) {
        console.error('Error en migración v223:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = { runMigration };
