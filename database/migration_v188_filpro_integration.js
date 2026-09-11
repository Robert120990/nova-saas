const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'manage_filpro_sync';

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('--- Running Migration v188: FilPro Integration ---');

        // 1. Create table filpro_connections
        console.log('1. Creating table filpro_connections...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS filpro_connections (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                portal_url VARCHAR(255) DEFAULT 'https://api-filpro-service.apiconsumofel.com/api',
                filpro_email VARCHAR(255) NOT NULL,
                filpro_password TEXT NOT NULL,
                filpro_company_id INT NULL,
                filpro_establishment_code VARCHAR(50) NULL,
                auto_sync BOOLEAN DEFAULT FALSE,
                filpro_token TEXT NULL,
                filpro_refresh_token TEXT NULL,
                filpro_token_expires_at BIGINT NULL,
                last_sync_date DATE NULL,
                last_sync_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_filpro_company_branch (company_id, branch_id),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('  → filpro_connections ready');

        // 2. Create table filpro_sync_logs
        console.log('2. Creating table filpro_sync_logs...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS filpro_sync_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                sync_date DATE NOT NULL,
                total_found INT DEFAULT 0,
                total_imported INT DEFAULT 0,
                total_skipped INT DEFAULT 0,
                total_errors INT DEFAULT 0,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('  → filpro_sync_logs ready');

        // 3. Register menu item under 'Sistema'
        console.log('3. Adding menu item under Sistema: Sincronización FilPro...');
        const [existingItem] = await pool.query("SELECT id FROM menu_items WHERE path = '/sistema/filpro' OR permission_key = ? LIMIT 1", [PERMISSION_KEY]);
        if (existingItem.length > 0) {
            console.log('  → Menu item already exists, skipping insert');
        } else {
            const [sistemaRows] = await pool.query("SELECT id FROM menu_items WHERE label = 'Sistema' AND parent_id IS NULL LIMIT 1");
            if (sistemaRows.length === 0) {
                console.log('  → Sistema root node not found, skipping menu insert');
            } else {
                const parentId = sistemaRows[0].id;
                const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [parentId]);
                const nextOrder = (maxOrder[0]?.max_o || 0) + 1;

                const [res] = await pool.query(
                    `INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                     VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
                    [parentId, 'Sincronización FilPro', '/sistema/filpro', 'RefreshCw', PERMISSION_KEY, nextOrder]
                );
                console.log(`  → Inserted menu item with id=${res?.insertId}, sort_order=${nextOrder}`);
            }
        }

        // 4. Update roles with the new permission key
        console.log('4. Assigning permission to administrative roles...');
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        let updatedCount = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) continue;

            const isSuperAdmin = role.name === 'SuperAdmin';

            if (isSuperAdmin) {
                if (!perms.includes(PERMISSION_KEY)) {
                    perms.push(PERMISSION_KEY);
                    await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                    console.log(`  → Role "${role.name}" (id=${role.id}): added ${PERMISSION_KEY}`);
                    updatedCount++;
                }
            }
        }

        console.log(`\nMigration v188 complete: ${updatedCount} roles updated`);
    } catch (error) {
        console.error('Migration v188 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
