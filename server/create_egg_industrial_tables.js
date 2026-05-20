require('dotenv').config();
const pool = require('./src/config/db');

async function main() {
    try {
        console.log('Iniciando creación de tablas de Procesamiento Industrial de Huevo Líquido...');

        // 1. Recepción de Materia Prima
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_raw_materials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                provider_id INT NOT NULL,
                egg_type ENUM('huevo cáscara', 'huevo líquido', 'clara', 'yema') NOT NULL,
                egg_color ENUM('blanco', 'marrón', 'mixto', 'N/A') DEFAULT 'N/A',
                egg_size ENUM('S', 'M', 'L', 'XL', 'N/A') DEFAULT 'N/A',
                fecha DATE NOT NULL,
                weight_lbs DECIMAL(12,2) NOT NULL,
                temperature_c DECIMAL(5,2) NOT NULL,
                provider_lot VARCHAR(100) NOT NULL,
                certificate_urls TEXT,
                operator_name VARCHAR(100) NOT NULL,
                status ENUM('aprobado', 'cuarentena', 'rechazado', 'anulado') DEFAULT 'aprobado',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_raw_materials creada o verificada');
        // Ensure 'anulado' status is supported in existing tables
        await pool.query(`ALTER TABLE egg_raw_materials MODIFY COLUMN status ENUM('aprobado', 'cuarentena', 'rechazado', 'anulado') DEFAULT 'aprobado'`).catch(() => {});
        console.log('- Columna status de egg_raw_materials verificada (anulado).');
        const [fechaCol] = await pool.query("SHOW COLUMNS FROM egg_raw_materials LIKE 'fecha'");
        if (!fechaCol.length) {
            await pool.query("ALTER TABLE egg_raw_materials ADD COLUMN fecha DATE NOT NULL DEFAULT (CURDATE())").catch(async () => {
                await pool.query("ALTER TABLE egg_raw_materials ADD COLUMN fecha DATE NOT NULL");
            });
        }
        console.log('- Columna fecha de egg_raw_materials verificada.');
        const [stockCol] = await pool.query("SHOW COLUMNS FROM egg_raw_materials LIKE 'stock_lbs'");
        if (!stockCol.length) {
            await pool.query("ALTER TABLE egg_raw_materials ADD COLUMN stock_lbs DECIMAL(12,2) NOT NULL DEFAULT 0");
            await pool.query("UPDATE egg_raw_materials SET stock_lbs = weight_lbs WHERE status = 'aprobado' AND stock_lbs = 0");
        }
        console.log('- Columna stock_lbs de egg_raw_materials verificada.');

        // 2. Registro de Sanitización y Limpieza CIP (Clean In Place)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_cip_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                equipment_name VARCHAR(100) NOT NULL,
                chemical_used VARCHAR(100) NOT NULL,
                temperature_c DECIMAL(5,2) NOT NULL,
                duration_minutes INT NOT NULL,
                operator_name VARCHAR(100) NOT NULL,
                validation_status ENUM('completado', 'fallido', 'pendiente') NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_cip_logs creada o verificada');

        // 3. Lotes de Producción Industrial
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_production_batches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                batch_uuid VARCHAR(36) NOT NULL UNIQUE,
                product_type ENUM('huevo entero', 'clara', 'yema salada', 'yema azucarada', 'fórmula especial') NOT NULL,
                presentation ENUM('cubeta 32LB', 'galón 8LB', 'medio galón 4LB', 'litro 2LB') NOT NULL,
                status ENUM('en_proceso', 'pasteurizado', 'empaquetado', 'congelado', 'bloqueado_haccp', 'aprobado_calidad') DEFAULT 'en_proceso',
                raw_material_id INT,
                input_weight_lbs DECIMAL(12,2) NOT NULL,
                yield_liquid_lbs DECIMAL(12,2) DEFAULT 0.00,
                waste_shell_lbs DECIMAL(12,2) DEFAULT 0.00,
                waste_loss_lbs DECIMAL(12,2) DEFAULT 0.00,
                operator_name VARCHAR(100) NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL
            )
        `);
        console.log('- Tabla egg_production_batches creada o verificada');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS batch_raw_materials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                batch_id INT NOT NULL,
                raw_material_id INT NOT NULL,
                quantity_lbs DECIMAL(12,2) NOT NULL,
                FOREIGN KEY (batch_id) REFERENCES egg_production_batches(id) ON DELETE CASCADE,
                FOREIGN KEY (raw_material_id) REFERENCES egg_raw_materials(id)
            )
        `);
        console.log('- Tabla batch_raw_materials creada o verificada');

        // 4. Parámetros Críticos de Pasteurización (HACCP PCC)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_pasteurization_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                batch_id INT NOT NULL,
                temperature_c DECIMAL(5,2) NOT NULL,
                holding_time_seconds INT NOT NULL,
                pressure_psi DECIMAL(5,2) NOT NULL,
                flow_rate_gpm DECIMAL(5,2) NOT NULL,
                haccp_compliant BOOLEAN NOT NULL,
                deviation_description VARCHAR(255) NULL,
                operator_name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_pasteurization_logs creada o verificada');

        // 5. Holding & Cadena de Frío
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_holding_temperatures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                tank_id VARCHAR(50) NOT NULL,
                temperature_c DECIMAL(5,2) NOT NULL,
                humidity_percentage DECIMAL(5,2) NULL,
                alarm_triggered BOOLEAN DEFAULT FALSE,
                alarm_reason VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_holding_temperatures creada o verificada');

        // 6. Empaque Final y Salida
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_packaging_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                batch_id INT NOT NULL,
                units_packaged INT NOT NULL,
                weight_per_unit_lbs DECIMAL(8,2) NOT NULL,
                total_batch_weight_lbs DECIMAL(12,2) NOT NULL,
                lot_code VARCHAR(100) NOT NULL UNIQUE,
                barcode VARCHAR(100) NOT NULL,
                qr_code_payload TEXT NOT NULL,
                expiry_date DATE NOT NULL,
                operator_name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_packaging_records creada o verificada');

        // 7. Blast Freezer
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_blast_freezer_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                packaging_id INT NOT NULL,
                freezer_location VARCHAR(50) NOT NULL,
                core_temperature_c DECIMAL(5,2) NOT NULL,
                freezing_duration_hours DECIMAL(5,2) NOT NULL,
                status ENUM('congelando', 'congelado_ok', 'alarma_tiempo') DEFAULT 'congelando',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_blast_freezer_logs creada o verificada');

        // 8. Mantenimiento de Maquinaria
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_machinery_maintenance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                equipment_name VARCHAR(100) NOT NULL,
                maintenance_type ENUM('preventivo', 'correctivo') NOT NULL,
                description TEXT NOT NULL,
                spare_parts_used TEXT,
                usage_hours_count INT NOT NULL,
                technician_name VARCHAR(100) NOT NULL,
                cost DECIMAL(12,2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_machinery_maintenance creada o verificada');

        // 9. Costos Industriales
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_industrial_costs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                batch_id INT NOT NULL,
                diesel_cost DECIMAL(10,2) DEFAULT 0.00,
                electricity_cost DECIMAL(10,2) DEFAULT 0.00,
                water_cost DECIMAL(10,2) DEFAULT 0.00,
                labor_cost DECIMAL(10,2) DEFAULT 0.00,
                packaging_materials_cost DECIMAL(10,2) DEFAULT 0.00,
                chemicals_cip_cost DECIMAL(10,2) DEFAULT 0.00,
                quality_tests_cost DECIMAL(10,2) DEFAULT 0.00,
                total_cost DECIMAL(12,2) GENERATED ALWAYS AS (
                    diesel_cost + electricity_cost + water_cost + labor_cost + 
                    packaging_materials_cost + chemicals_cip_cost + quality_tests_cost
                ) STORED,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_industrial_costs creada o verificada');

        // 10. Eventos Industriales
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_industrial_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                severity ENUM('info', 'warning', 'critical') DEFAULT 'info',
                description TEXT NOT NULL,
                payload JSON,
                operator_name VARCHAR(100) DEFAULT 'Sistema',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('- Tabla egg_industrial_events creada o verificada');

        // ------------------ SEEDING DATA ------------------
        console.log('Insertando datos de prueba...');

        // 1. Obtener una sucursal y una empresa válidas
        const [companies] = await pool.query('SELECT id FROM companies LIMIT 1');
        const companyId = companies.length > 0 ? companies[0].id : 1;

        const [branches] = await pool.query('SELECT id FROM branches WHERE company_id = ? LIMIT 1', [companyId]);
        const branchId = branches.length > 0 ? branches[0].id : 1;

        // 2. Obtener o crear proveedor
        const [providers] = await pool.query('SELECT id FROM providers WHERE company_id = ? LIMIT 1', [companyId]);
        let providerId;
        if (providers.length > 0) {
            providerId = providers[0].id;
        } else {
            const [result] = await pool.query(
                `INSERT INTO providers (company_id, nombre, nombre_comercial, tipo_documento, numero_documento, nit, nrc, direccion, departamento, municipio, telefono, correo) 
                 VALUES (?, 'Avícola La Granja S.A.', 'La Granja Industrial', 'NIT', '0614-050595-102-1', '0614-050595-102-1', '987654-3', 'Carretera a Santa Ana Km 34', 'La Libertad', 'Colón', '2555-4444', 'pedidos@avicolalagranja.com')`,
                [companyId]
            );
            providerId = result.insertId;
            console.log('+ Proveedor de prueba creado:', providerId);
        }

        // Limpiar datos existentes en cascada lógica si es necesario
        await pool.query('DELETE FROM egg_industrial_events WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_industrial_costs WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_machinery_maintenance WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_blast_freezer_logs WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_packaging_records WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_holding_temperatures WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_pasteurization_logs WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_production_batches WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_cip_logs WHERE company_id = ?', [companyId]);
        await pool.query('DELETE FROM egg_raw_materials WHERE company_id = ?', [companyId]);

        // 3. Insertar materias primas
        const [rmResult1] = await pool.query(
            `INSERT INTO egg_raw_materials (company_id, branch_id, provider_id, egg_type, egg_color, egg_size, weight_lbs, temperature_c, provider_lot, certificate_urls, operator_name, status) 
             VALUES (?, ?, ?, 'huevo cáscara', 'blanco', 'L', 12000.00, 4.2, 'LOTE-AV-991A', '["https://quality.avicolalagranja.com/cert/991A.pdf"]', 'Carlos Mendoza', 'aprobado')`,
            [companyId, branchId, providerId]
        );
        const [rmResult2] = await pool.query(
            `INSERT INTO egg_raw_materials (company_id, branch_id, provider_id, egg_type, egg_color, egg_size, weight_lbs, temperature_c, provider_lot, certificate_urls, operator_name, status) 
             VALUES (?, ?, ?, 'huevo cáscara', 'marrón', 'M', 8500.00, 4.8, 'LOTE-AV-992B', '["https://quality.avicolalagranja.com/cert/992B.pdf"]', 'Carlos Mendoza', 'aprobado')`,
            [companyId, branchId, providerId]
        );
        const [rmResult3] = await pool.query(
            `INSERT INTO egg_raw_materials (company_id, branch_id, provider_id, egg_type, egg_color, egg_size, weight_lbs, temperature_c, provider_lot, certificate_urls, operator_name, status) 
             VALUES (?, ?, ?, 'clara', 'N/A', 'N/A', 4000.00, 3.8, 'LOTE-CL-104X', '["https://quality.avicolalagranja.com/cert/104X.pdf"]', 'Sofía Rivas', 'aprobado')`,
            [companyId, branchId, providerId]
        );
        console.log('+ Materias primas de prueba insertadas');

        // 4. Insertar CIP de Sanitización
        await pool.query(
            `INSERT INTO egg_cip_logs (company_id, equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes) 
             VALUES (?, 'pasteurizador', 'Ácido Peracético 1.5%', 78.5, 45, 'Marlon Torres', 'completado', 'Sanitización CIP programada de arranque de turno. Todo en regla.')`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_cip_logs (company_id, equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes) 
             VALUES (?, 'quebradora', 'Sosa Cáustica 2%', 82.0, 30, 'Marlon Torres', 'completado', 'Limpieza post-quiebre. Remoción total de residuos.')`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_cip_logs (company_id, equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes) 
             VALUES (?, 'tanque holding 1', 'Sanitizante Clorado 200ppm', 22.0, 20, 'Marlon Torres', 'completado', 'Enjuague y sanitización de tanque de holding previo a llenado.')`,
            [companyId]
        );
        console.log('+ Registros CIP de prueba insertados');

        // 5. Lote de producción 1: Huevo entero pasteurizado (Completado)
        const batchUuid1 = 'e573a4b0-c081-42e8-967a-113bd8e461a2';
        const [batchResult1] = await pool.query(
            `INSERT INTO egg_production_batches (company_id, branch_id, batch_uuid, product_type, presentation, status, raw_material_id, input_weight_lbs, yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs, operator_name, started_at, completed_at) 
             VALUES (?, ?, ?, 'huevo entero', 'cubeta 32LB', 'aprobado_calidad', ?, 12000.00, 10320.00, 1440.00, 240.00, 'Sofía Rivas', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 22 HOUR)`,
            [companyId, branchId, batchUuid1, rmResult1.insertId]
        );
        const batchId1 = batchResult1.insertId;

        // 6. Lote de producción 2: Clara pasteurizada (Completado)
        const batchUuid2 = 'd7d242ef-0ef0-466d-8b01-381c81cf2607';
        const [batchResult2] = await pool.query(
            `INSERT INTO egg_production_batches (company_id, branch_id, batch_uuid, product_type, presentation, status, raw_material_id, input_weight_lbs, yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs, operator_name, started_at, completed_at) 
             VALUES (?, ?, ?, 'clara', 'galón 8LB', 'congelado', ?, 4000.00, 3920.00, 0.00, 80.00, 'Sofía Rivas', NOW() - INTERVAL 12 HOUR, NOW() - INTERVAL 10 HOUR)`,
            [companyId, branchId, batchUuid2, rmResult3.insertId]
        );
        const batchId2 = batchResult2.insertId;

        // 7. Lote de producción 3: Yema salada (En proceso / Simulación)
        const batchUuid3 = '3b92f4ad-981f-4b07-9b2f-37dbf25d911b';
        const [batchResult3] = await pool.query(
            `INSERT INTO egg_production_batches (company_id, branch_id, batch_uuid, product_type, presentation, status, raw_material_id, input_weight_lbs, yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs, operator_name, started_at, completed_at) 
             VALUES (?, ?, ?, 'yema salada', 'cubeta 32LB', 'en_proceso', ?, 8500.00, 0.00, 0.00, 0.00, 'Marlon Torres', NOW() - INTERVAL 1 HOUR, NULL)`,
            [companyId, branchId, batchUuid3, rmResult2.insertId]
        );
        const batchId3 = batchResult3.insertId;
        console.log('+ Lotes de producción de prueba insertados');

        // 8. Logs de pasteurización
        await pool.query(
            `INSERT INTO egg_pasteurization_logs (company_id, batch_id, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, haccp_compliant, deviation_description, operator_name) 
             VALUES (?, ?, 64.5, 210, 48.2, 12.5, true, NULL, 'Sofía Rivas')`,
            [companyId, batchId1]
        );
        await pool.query(
            `INSERT INTO egg_pasteurization_logs (company_id, batch_id, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, haccp_compliant, deviation_description, operator_name) 
             VALUES (?, ?, 57.2, 210, 45.0, 10.2, true, NULL, 'Sofía Rivas')`,
            [companyId, batchId2]
        );
        console.log('+ Logs de pasteurización insertados');

        // 9. Temperaturas de holding
        await pool.query(
            `INSERT INTO egg_holding_temperatures (company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason) 
             VALUES (?, 'Tanque Pulmón 1', 3.8, 45.0, false, NULL)`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_holding_temperatures (company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason) 
             VALUES (?, 'Tanque Pulmón 2', 4.1, 48.0, false, NULL)`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_holding_temperatures (company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason) 
             VALUES (?, 'Silo Almacén Crudo 1', 4.5, 52.0, false, NULL)`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_holding_temperatures (company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason) 
             VALUES (?, 'Cámara Fría 1 (Líquido)', 2.5, 60.0, false, NULL)`,
            [companyId]
        );
        console.log('+ Logs de temperaturas de holding insertados');

        // 10. Empaque final
        const [pkgResult1] = await pool.query(
            `INSERT INTO egg_packaging_records (company_id, batch_id, units_packaged, weight_per_unit_lbs, total_batch_weight_lbs, lot_code, barcode, qr_code_payload, expiry_date, operator_name) 
             VALUES (?, ?, 322, 32.00, 10304.00, 'LOTE-260519-ENTERO', '7412589630147', '{"lote": "LOTE-260519-ENTERO", "producto": "Huevo Entero Pasteurizado", "fecha_empaque": "2026-05-19", "uuid": "e573a4b0-c081-42e8-967a-113bd8e461a2", "origen_materia_prima": "LOTE-AV-991A", "pasteurizacion_temp": "64.5C"}', DATE_ADD(CURDATE(), INTERVAL 28 DAY), 'Sofía Rivas')`,
            [companyId, batchId1]
        );
        const pkgId1 = pkgResult1.insertId;

        const [pkgResult2] = await pool.query(
            `INSERT INTO egg_packaging_records (company_id, batch_id, units_packaged, weight_per_unit_lbs, total_batch_weight_lbs, lot_code, barcode, qr_code_payload, expiry_date, operator_name) 
             VALUES (?, ?, 490, 8.00, 3920.00, 'LOTE-260519-CLARA', '7412589630253', '{"lote": "LOTE-260519-CLARA", "producto": "Clara Pasteurizada", "fecha_empaque": "2026-05-19", "uuid": "d7d242ef-0ef0-466d-8b01-381c81cf2607", "origen_materia_prima": "LOTE-CL-104X", "pasteurizacion_temp": "57.2C"}', DATE_ADD(CURDATE(), INTERVAL 28 DAY), 'Sofía Rivas')`,
            [companyId, batchId2]
        );
        const pkgId2 = pkgResult2.insertId;
        console.log('+ Empaques de prueba creados');

        // 11. Blast Freezer
        await pool.query(
            `INSERT INTO egg_blast_freezer_logs (company_id, packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status) 
             VALUES (?, ?, 'Túnel A - Posición 1', -18.2, 4.0, 'congelado_ok')`,
            [companyId, pkgId1]
        );
        await pool.query(
            `INSERT INTO egg_blast_freezer_logs (company_id, packaging_id, freezer_location, core_temperature_c, freezing_duration_hours, status) 
             VALUES (?, ?, 'Túnel B - Posición 3', -12.5, 2.5, 'congelando')`,
            [companyId, pkgId2]
        );
        console.log('+ Blast Freezer logs insertados');

        // 12. Mantenimiento de Maquinaria
        await pool.query(
            `INSERT INTO egg_machinery_maintenance (company_id, equipment_name, maintenance_type, description, spare_parts_used, usage_hours_count, technician_name, cost) 
             VALUES (?, 'pasteurizador', 'preventivo', 'Calibración de termómetro de PCC, cambio de juntas de placas del intercambiador y revisión de válvula desviadora.', 'Juntas de goma NBR, termopar PT100', 480, 'Ing. Hugo Martínez (Alfa Service)', 1250.00)`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_machinery_maintenance (company_id, equipment_name, maintenance_type, description, spare_parts_used, usage_hours_count, technician_name, cost) 
             VALUES (?, 'quebradora', 'correctivo', 'Reemplazo de resortes de golpeadores en cabezales 3 y 4 por fatiga de material.', 'Resortes golpeadores de acero inox', 1230, 'Roberto Gómez', 180.00)`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_machinery_maintenance (company_id, equipment_name, maintenance_type, description, spare_parts_used, usage_hours_count, technician_name, cost) 
             VALUES (?, 'caldera', 'preventivo', 'Limpieza de hollín en tubos de humo y análisis de gases de combustión.', 'Empaquetaduras de puerta caldera', 2450, 'Ing. Carlos Peralta', 420.00)`,
            [companyId]
        );
        console.log('+ Bitácoras de mantenimiento de maquinaria insertadas');

        // 13. Costos industriales
        await pool.query(
            `INSERT INTO egg_industrial_costs (company_id, batch_id, diesel_cost, electricity_cost, water_cost, labor_cost, packaging_materials_cost, chemicals_cip_cost, quality_tests_cost) 
             VALUES (?, ?, 180.00, 320.00, 45.00, 240.00, 680.00, 35.00, 75.00)`,
            [companyId, batchId1]
        );
        await pool.query(
            `INSERT INTO egg_industrial_costs (company_id, batch_id, diesel_cost, electricity_cost, water_cost, labor_cost, packaging_materials_cost, chemicals_cip_cost, quality_tests_cost) 
             VALUES (?, ?, 60.00, 110.00, 15.00, 120.00, 245.00, 12.00, 40.00)`,
            [companyId, batchId2]
        );
        console.log('+ Costos industriales cargados a lotes');

        // 14. Eventos industriales
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name) 
             VALUES (?, 'production.started', 'info', 'Iniciado lote de Huevo Entero Pasteurizado e573a4b0-c081-42e8-967a-113bd8e461a2.', '{"batch_uuid": "e573a4b0-c081-42e8-967a-113bd8e461a2", "input_weight": 12000.0}', 'Sofía Rivas')`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name) 
             VALUES (?, 'production.completed', 'info', 'Lote de Huevo Entero Pasteurizado finalizado con rendimiento del 86%.', '{"batch_uuid": "e573a4b0-c081-42e8-967a-113bd8e461a2", "yield": 10320.0}', 'Sofía Rivas')`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name) 
             VALUES (?, 'haccp.failure', 'critical', 'ALERTA PCC: Temperatura de pasteurización inferior a 64C (Lectura: 61.2C) en lote 3b92f4ad-981f-4b07-9b2f-37dbf25d911b. Válvula desviadora activada.', '{"temperature_c": 61.2, "limit_c": 64.0, "batch_uuid": "3b92f4ad-981f-4b07-9b2f-37dbf25d911b"}', 'Sistema (IoT)')`,
            [companyId]
        );
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name) 
             VALUES (?, 'temperature.alert', 'warning', 'Holding Tank 2 temperatura subió a 6.8C (límite superior 6C). Alarma notificada.', '{"tank_id": "Tanque Pulmón 2", "temperature_c": 6.8, "limit_c": 6.0}', 'Sistema (IoT)')`,
            [companyId]
        );
        console.log('+ Eventos y alertas de auditoría insertados');

        console.log('Creación de tablas e inserción de datos de prueba completado con ÉXITO.');
        process.exit(0);
    } catch (error) {
        console.error('ERROR CRÍTICO AL CREAR TABLAS O INSERTAR DATOS:', error);
        process.exit(1);
    }
}

main();
