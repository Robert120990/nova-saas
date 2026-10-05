const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Running migration v251: rh_biometric_cortes and overtime editing...');

        // 1. Tabla rh_biometric_cortes (Cortes / Congelamientos por fechas)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rh_biometric_cortes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                nombre VARCHAR(150) NOT NULL COMMENT 'Ej: 1ª Quincena Septiembre 2026',
                fecha_inicio DATE NOT NULL,
                fecha_fin DATE NOT NULL,
                estado ENUM('congelado', 'abierto') DEFAULT 'congelado',
                total_empleados INT DEFAULT 0,
                total_horas_trabajadas DECIMAL(10,2) DEFAULT 0.00,
                total_horas_extra DECIMAL(10,2) DEFAULT 0.00,
                total_horas_extra_aprobadas DECIMAL(10,2) DEFAULT 0.00,
                observaciones TEXT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_comp_fechas (company_id, fecha_inicio, fecha_fin),
                INDEX idx_comp_estado (company_id, estado),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla rh_biometric_cortes creada / verificada.');

        // 2. Tabla rh_biometric_daily_overtime (Registro diario y edición de horas extra por empleado)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rh_biometric_daily_overtime (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                corte_id INT NULL,
                empleado_id INT NULL,
                device_uid VARCHAR(50) NOT NULL,
                fecha DATE NOT NULL,
                entrada TIME NULL,
                salida TIME NULL,
                horas_trabajadas DECIMAL(6,2) DEFAULT 0.00,
                minutos_tardanza INT DEFAULT 0,
                horas_extra_calculadas DECIMAL(6,2) DEFAULT 0.00,
                horas_extra_aprobadas DECIMAL(6,2) DEFAULT 0.00,
                es_editado TINYINT(1) DEFAULT 0,
                observacion VARCHAR(255) NULL,
                congelado TINYINT(1) DEFAULT 0,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_comp_uid_fecha (company_id, device_uid, fecha),
                INDEX idx_corte (corte_id),
                INDEX idx_comp_fecha (company_id, fecha),
                INDEX idx_empleado (empleado_id),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                FOREIGN KEY (corte_id) REFERENCES rh_biometric_cortes(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla rh_biometric_daily_overtime creada / verificada.');

        // 3. Columnas congelado y corte_id en rh_biometric_attendance_logs
        const [logCols] = await pool.query("SHOW COLUMNS FROM rh_biometric_attendance_logs LIKE 'congelado'");
        if (logCols.length === 0) {
            await pool.query(`
                ALTER TABLE rh_biometric_attendance_logs
                ADD COLUMN congelado TINYINT(1) DEFAULT 0,
                ADD COLUMN corte_id INT NULL,
                ADD INDEX idx_congelado_corte (company_id, congelado, corte_id)
            `);
            console.log('✓ Columnas congelado y corte_id agregadas a rh_biometric_attendance_logs.');
        } else {
            console.log('✓ Columnas en rh_biometric_attendance_logs ya existen.');
        }

        console.log('Migration v250 completed successfully.');
    } catch (error) {
        console.error('Migration v250 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
