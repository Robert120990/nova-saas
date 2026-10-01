const pool = require('../server/src/config/db');

async function run() {
    console.log('[Migration v241] Creando tablas para Sistema Energético (Growatt + GESS SolarWeb)...');

    // 1. Tabla de credenciales y configuración del sistema energético
    await pool.query(`
        CREATE TABLE IF NOT EXISTS energy_credentials (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            growatt_url VARCHAR(255) NOT NULL DEFAULT 'https://server.growatt.com/',
            growatt_username VARCHAR(100) NOT NULL DEFAULT 'Raul_Sosa',
            growatt_password VARCHAR(255) NOT NULL DEFAULT '1234567',
            growatt_enabled TINYINT(1) NOT NULL DEFAULT 1,
            gess_url VARCHAR(255) NOT NULL DEFAULT 'http://gess.net.cn/SolarWeb/',
            gess_username VARCHAR(100) NOT NULL DEFAULT 'proyectos',
            gess_password VARCHAR(255) NOT NULL DEFAULT '123456',
            gess_plant_id INT NOT NULL DEFAULT 218,
            gess_enabled TINYINT(1) NOT NULL DEFAULT 1,
            sync_interval_hours INT NOT NULL DEFAULT 4,
            peak_start_time TIME NOT NULL DEFAULT '18:00:00',
            peak_end_time TIME NOT NULL DEFAULT '22:00:00',
            peak_kwh_rate DECIMAL(10,4) NOT NULL DEFAULT 0.2200,
            offpeak_kwh_rate DECIMAL(10,4) NOT NULL DEFAULT 0.1400,
            solar_kwh_value DECIMAL(10,4) NOT NULL DEFAULT 0.1700,
            last_sync_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_energy_cred_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration v241] Tabla energy_credentials verificada.');

    // 2. Tabla de lecturas / snapshots energéticos periódicos
    await pool.query(`
        CREATE TABLE IF NOT EXISTS energy_readings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            reading_time DATETIME NOT NULL,
            source ENUM('auto', 'manual', 'live') NOT NULL DEFAULT 'auto',
            growatt_pac_kw DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            growatt_today_kwh DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            growatt_total_kwh DECIMAL(14,2) NOT NULL DEFAULT 0.00,
            growatt_plants_data JSON NULL,
            gess_soc_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            gess_battery_power_kw DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            gess_grid_power_kw DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            gess_pv_power_kw DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            gess_load_power_kw DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            gess_day_charged_kwh DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            gess_day_discharged_kwh DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            gess_total_charged_kwh DECIMAL(14,2) NOT NULL DEFAULT 0.00,
            gess_total_discharged_kwh DECIMAL(14,2) NOT NULL DEFAULT 0.00,
            is_peak_hour TINYINT(1) NOT NULL DEFAULT 0,
            estimated_savings_today_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status_notes VARCHAR(255) NULL,
            raw_data JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_energy_readings_comp_time (company_id, reading_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration v241] Tabla energy_readings verificada.');

    // 3. Tabla de resúmenes diarios analíticos
    await pool.query(`
        CREATE TABLE IF NOT EXISTS energy_daily_summaries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            summary_date DATE NOT NULL,
            solar_generated_kwh DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            battery_charged_kwh DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            battery_discharged_kwh DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            battery_efficiency_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            peak_savings_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            solar_savings_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            total_savings_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            co2_avoided_kg DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            max_solar_power_kw DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            max_load_power_kw DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            min_battery_soc DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            max_battery_soc DECIMAL(5,2) NOT NULL DEFAULT 0.00,
            details JSON NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_energy_daily_comp_date (company_id, summary_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[Migration v241] Tabla energy_daily_summaries verificada.');

    // 4. Sembrar configuración inicial para empresas existentes
    const [companies] = await pool.query('SELECT id FROM companies');
    for (const comp of companies) {
        const [existing] = await pool.query(
            'SELECT id FROM energy_credentials WHERE company_id = ? LIMIT 1',
            [comp.id]
        );
        if (existing.length === 0) {
            await pool.query(`
                INSERT INTO energy_credentials 
                (company_id, growatt_url, growatt_username, growatt_password, growatt_enabled,
                 gess_url, gess_username, gess_password, gess_plant_id, gess_enabled,
                 sync_interval_hours, peak_start_time, peak_end_time, peak_kwh_rate, offpeak_kwh_rate, solar_kwh_value)
                VALUES (?, 'https://server.growatt.com/', 'Raul_Sosa', '1234567', 1,
                        'http://gess.net.cn/SolarWeb/', 'proyectos', '123456', 218, 1,
                        4, '18:00:00', '22:00:00', 0.2200, 0.1400, 0.1700)
            `, [comp.id]);
            console.log(`[Migration v241] Configuración energética sembrada para empresa ${comp.id}.`);
        }
    }

    // 5. Agregar opción al menú
    const [existingMenu] = await pool.query(`SELECT id FROM menu_items WHERE path = '/sistema-energetico'`);
    if (existingMenu.length === 0) {
        await pool.query(`
            INSERT INTO menu_items (parent_id, label, path, icon, permission_key, is_active, hide_in_menu, sort_order)
            VALUES (NULL, 'Sistema Energético', '/sistema-energetico', 'Zap', 'manage_energy_system', 1, 0, 105)
        `);
        console.log('[Migration v241] Opción Sistema Energético agregada a menu_items.');
    }

    // 6. Asignar permiso a roles administrativos
    const permKey = 'manage_energy_system';
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    for (const role of roles) {
        let perms = [];
        try {
            perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions || '[]') : (role.permissions || []);
        } catch { perms = []; }

        const shouldHave = role.name === 'SuperAdmin' || role.name === 'Admin' ||
            perms.includes('view_dashboard') || perms.includes('manage_company');

        if (shouldHave && !perms.includes(permKey)) {
            perms.push(permKey);
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            console.log(`[Migration v241] Permiso '${permKey}' asignado al rol '${role.name}'.`);
        }
    }

    console.log('[Migration v241] Migración completada con éxito.');
}

module.exports = run;
