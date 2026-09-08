const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
        multipleStatements: true
    });

    try {
        console.log('Running migration v106: rh_acciones_personal...');

        const sql = fs.readFileSync(path.join(__dirname, 'migration_v106_rh_acciones_personal.sql'), 'utf-8');
        await pool.query(sql);
        console.log('Created table rh_acciones_personal successfully.');

        // Find Recursos Humanos parent in menu_items
        const [rhParent] = await pool.query(
            `SELECT id FROM menu_items WHERE label = 'Recursos Humanos' AND parent_id IS NULL LIMIT 1`
        );
        const parentId = rhParent.length > 0 ? rhParent[0].id : 94;

        // Check if menu item already exists
        const [existing] = await pool.query(
            `SELECT id FROM menu_items WHERE path = '/rh/acciones-personal'`
        );

        if (existing.length === 0) {
            await pool.query(
                `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                 VALUES (?, 'Acciones de Personal', '/rh/acciones-personal', 'FileSignature', 'manage_rh_empleados', 3, 1, 0)`,
                [parentId]
            );
            console.log('Added Acciones de Personal to menu_items.');
        } else {
            console.log('Acciones de Personal menu item already exists.');
        }

        console.log('Migration v106 completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('Migration v106 failed:', e);
        process.exit(1);
    }
}

runMigration();
