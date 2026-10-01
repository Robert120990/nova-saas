/**
 * Migración v243: Cifrado en reposo (AES-256-GCM) de credenciales energéticas
 * y creación del permiso granular 'manage_energy_config'
 */

const pool = require('../server/src/config/db');
const { encrypt } = require('../server/src/utils/crypto');

function isAlreadyEncrypted(str) {
    if (!str || typeof str !== 'string') return false;
    const parts = str.split(':');
    return parts.length === 3 && parts[0].length >= 10 && parts[1].length >= 10;
}

async function runMigration() {
    console.log('[Migración v243] Iniciando blindaje y cifrado de credenciales energéticas...');

    // 1. Ampliar tamaño de columnas de contraseñas a TEXT para soportar payload AES-256-GCM
    try {
        await pool.query(`
            ALTER TABLE energy_credentials
            MODIFY COLUMN growatt_password TEXT,
            MODIFY COLUMN gess_password TEXT
        `);
        console.log('✓ Columnas growatt_password y gess_password modificadas a TEXT.');
    } catch (e) {
        console.log('ℹ Nota alterando columnas:', e.message);
    }

    // 2. Cifrar contraseñas existentes en texto plano
    const [rows] = await pool.query('SELECT id, company_id, growatt_password, gess_password FROM energy_credentials');
    let encryptedCount = 0;

    for (const r of rows) {
        let needsUpdate = false;
        let newGrowattPass = r.growatt_password;
        let newGessPass = r.gess_password;

        if (r.growatt_password && !isAlreadyEncrypted(r.growatt_password)) {
            newGrowattPass = encrypt(r.growatt_password);
            needsUpdate = true;
        }

        if (r.gess_password && !isAlreadyEncrypted(r.gess_password)) {
            newGessPass = encrypt(r.gess_password);
            needsUpdate = true;
        }

        if (needsUpdate) {
            await pool.query(
                'UPDATE energy_credentials SET growatt_password = ?, gess_password = ? WHERE id = ?',
                [newGrowattPass, newGessPass, r.id]
            );
            encryptedCount++;
            console.log(`✓ Credenciales cifradas con éxito para empresa ID ${r.company_id}`);
        }
    }
    console.log(`✓ Total de empresas con contraseñas blindadas con AES-256-GCM: ${encryptedCount}`);

    // 3. Registrar permiso único manage_energy_config en menu_items
    const [parentMenu] = await pool.query(
        "SELECT id FROM menu_items WHERE permission_key = 'manage_energy_system' LIMIT 1"
    );
    const parentId = parentMenu[0]?.id || null;

    const [existingPerm] = await pool.query(
        "SELECT id FROM menu_items WHERE permission_key = 'manage_energy_config' LIMIT 1"
    );

    if (existingPerm.length === 0) {
        await pool.query(`
            INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order, is_active)
            VALUES ('Configuración de Credenciales Energéticas', '/sistema-energetico', 'Key', 'manage_energy_config', ?, 99, 1)
        `, [parentId]);
        console.log("✓ Permiso 'manage_energy_config' insertado en menu_items.");
    } else {
        console.log("ℹ Permiso 'manage_energy_config' ya existía en menu_items.");
    }

    // 4. Actualizar roles administrativos (SuperAdmin, Admin) para otorgar el nuevo permiso
    const [roles] = await pool.query(
        "SELECT id, name, permissions FROM roles WHERE name IN ('SuperAdmin', 'Admin')"
    );

    for (const role of roles) {
        let perms = [];
        try {
            perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : (role.permissions || []);
        } catch {
            perms = [];
        }

        if (!perms.includes('manage_energy_config')) {
            perms.push('manage_energy_config');
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [
                JSON.stringify(perms),
                role.id
            ]);
            console.log(`✓ Permiso 'manage_energy_config' asignado al rol '${role.name}'.`);
        }
    }

    console.log('[Migración v243] Completada exitosamente.');
}

module.exports = runMigration;

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[Migración v243 Error]:', err);
            process.exit(1);
        });
}
