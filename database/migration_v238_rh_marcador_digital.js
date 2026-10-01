const pool = require('../server/src/config/db');
const crypto = require('crypto');

async function runMigration() {
    console.log('[Migration v238] Creando tablas para Marcador Digital Biométrico en Recursos Humanos...');

    // 1. Tabla de Dispositivos Biométricos
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_biometric_devices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            branch_id INT NULL,
            nombre VARCHAR(100) NOT NULL DEFAULT 'Marcador Digital Principal',
            ip_address VARCHAR(45) NOT NULL DEFAULT '192.168.3.201',
            port INT NOT NULL DEFAULT 4370,
            comm_key INT NOT NULL DEFAULT 0,
            protocol ENUM('tcp', 'udp') NOT NULL DEFAULT 'tcp',
            agent_key VARCHAR(64) NOT NULL,
            status ENUM('online', 'offline', 'syncing', 'error') NOT NULL DEFAULT 'offline',
            last_sync DATETIME NULL,
            last_seen DATETIME NULL,
            device_info JSON NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_bio_comp (company_id),
            UNIQUE KEY uq_bio_agent_key (agent_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration v238] Tabla rh_biometric_devices verificada.');

    // 2. Columna codigo_biometrico en rh_empleados
    const [empCols] = await pool.query(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_empleados' AND COLUMN_NAME = 'codigo_biometrico'
    `);
    if (empCols.length === 0) {
        await pool.query(`
            ALTER TABLE rh_empleados
            ADD COLUMN codigo_biometrico VARCHAR(20) NULL AFTER codigo,
            ADD INDEX idx_emp_bio (company_id, codigo_biometrico)
        `);
        console.log('[Migration v238] Columna codigo_biometrico agregada a rh_empleados.');
    }

    // 3. Tabla de Marcaciones Biométricas
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_biometric_attendance_logs (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            device_id INT NULL,
            device_uid VARCHAR(50) NOT NULL,
            empleado_id INT NULL,
            punch_time DATETIME NOT NULL,
            punch_type ENUM('entrada', 'salida', 'salida_almuerzo', 'entrada_almuerzo', 'otro') NOT NULL DEFAULT 'entrada',
            punch_code INT NOT NULL DEFAULT 0,
            verify_type INT NOT NULL DEFAULT 1,
            verify_label VARCHAR(50) NOT NULL DEFAULT 'Huella Digital',
            source ENUM('biometric', 'manual', 'agent') NOT NULL DEFAULT 'agent',
            notas VARCHAR(255) NULL,
            raw_data JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_att_comp_time (company_id, punch_time),
            INDEX idx_att_emp_time (empleado_id, punch_time),
            UNIQUE KEY uq_punch (company_id, device_uid, punch_time),
            CONSTRAINT fk_att_dev FOREIGN KEY (device_id) REFERENCES rh_biometric_devices(id) ON DELETE SET NULL,
            CONSTRAINT fk_att_emp FOREIGN KEY (empleado_id) REFERENCES rh_empleados(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration v238] Tabla rh_biometric_attendance_logs verificada.');

    // 4. Configurar opción en menu_items
    const [rhMenu] = await pool.query(`
        SELECT id FROM menu_items
        WHERE label LIKE '%Recursos Humanos%' AND parent_id IS NULL
        LIMIT 1
    `);
    const rhParentId = rhMenu.length ? rhMenu[0].id : 94;

    const [existItem] = await pool.query(`SELECT id FROM menu_items WHERE path = '/rh/marcador-digital'`);
    if (existItem.length === 0) {
        await pool.query(`
            INSERT INTO menu_items (parent_id, label, path, icon, permission_key, is_active, hide_in_menu, sort_order)
            VALUES (?, 'Marcador Digital', '/rh/marcador-digital', 'Fingerprint', 'manage_rh_biometric_attendance', 1, 0, 110)
        `, [rhParentId]);
        console.log('[Migration v238] Ítem de menú Marcador Digital agregado.');
    }

    // 5. Asignar permiso a roles administradores y RRHH
    const permKey = 'manage_rh_biometric_attendance';
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    for (const role of roles) {
        let perms = [];
        try {
            perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : (role.permissions || []);
        } catch { perms = []; }

        const shouldHave = role.name === 'SuperAdmin' || role.name === 'Admin' ||
            perms.includes('manage_rh_empleados') || perms.includes('view_rh_empleados') ||
            perms.includes('human_resources') || perms.includes('manage_human_resources');

        if (shouldHave && !perms.includes(permKey)) {
            perms.push(permKey);
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
        }
    }
    console.log('[Migration v238] Permisos asignados a roles correspondientes.');

    // 6. Crear dispositivo inicial por defecto si la empresa no tiene uno (ej. empresa 9 o todas las existentes)
    const [companies] = await pool.query('SELECT id FROM companies');
    for (const comp of companies) {
        const [devs] = await pool.query('SELECT id FROM rh_biometric_devices WHERE company_id = ?', [comp.id]);
        if (devs.length === 0) {
            const agentKey = crypto.randomBytes(24).toString('hex');
            await pool.query(`
                INSERT INTO rh_biometric_devices
                (company_id, nombre, ip_address, port, comm_key, protocol, agent_key, status)
                VALUES (?, 'Marcador Digital ZKTeco', '192.168.3.201', 4370, 0, 'tcp', ?, 'offline')
            `, [comp.id, agentKey]);
        }
    }
    console.log('[Migration v238] Dispositivos biométricos por defecto configurados (IP: 192.168.3.201, Puerto: 4370).');
    console.log('[Migration v238] Finalizada con éxito.');
}

module.exports = { runMigration };
