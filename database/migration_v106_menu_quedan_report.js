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
        console.log('Running migration v106 - adding quedan report menu item...');
        
        const [[parent]] = await pool.query(`
            SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = (
                SELECT id FROM menu_items WHERE label = 'Compras'
            )
        `);

        if (!parent) {
            console.error('ERROR: No se encontró el item padre "Reportes" bajo "Compras". Ejecute primero migration_v102_menu_items.js');
            process.exit(1);
        }

        const parentId = parent.id;

        const [existing] = await pool.query(
            'SELECT id FROM menu_items WHERE label = ? AND parent_id = ?',
            ['Reporte de Quedanes', parentId]
        );

        if (existing.length > 0) {
            console.log('El item ya existe, saltando inserción.');
        } else {
            await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
                [parentId, 'Reporte de Quedanes', '/compras/reportes/quedan', 'FileText', 'manage_purchase_quedan', 3]
            );
            console.log('Menú item "Reporte de Quedanes" insertado correctamente.');
        }

        console.log('Migration v106 completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
