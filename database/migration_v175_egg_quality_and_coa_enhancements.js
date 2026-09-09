const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('Running migration v175 - Egg Quality Parameters and Editable COA...');

        // 1. Crear tabla egg_quality_parameters
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_quality_parameters (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                category ENUM('microbiologico', 'fisicoquimico', 'organoleptico', 'otro') NOT NULL DEFAULT 'microbiologico',
                parameter_name VARCHAR(150) NOT NULL,
                specification VARCHAR(255) NOT NULL,
                default_value VARCHAR(100) NULL,
                unit VARCHAR(50) NULL,
                applicable_product VARCHAR(100) NOT NULL DEFAULT 'todos',
                expected_criterion VARCHAR(100) NOT NULL DEFAULT 'CONFORME',
                sort_order INT DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_eqp_comp (company_id),
                INDEX idx_eqp_cat (category),
                INDEX idx_eqp_prod (applicable_product)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla egg_quality_parameters creada o verificada.');

        // 2. Modificar tabla egg_lab_micro_logs para soportar cliente, presentación y parámetros dinámicos
        const [columns] = await pool.query('DESCRIBE egg_lab_micro_logs');
        const colNames = columns.map(c => c.Field);

        if (!colNames.includes('customer_id')) {
            await pool.query('ALTER TABLE egg_lab_micro_logs ADD COLUMN customer_id INT NULL AFTER batch_id');
            console.log('✓ Columna customer_id agregada a egg_lab_micro_logs.');
        }

        if (!colNames.includes('customer_name')) {
            await pool.query('ALTER TABLE egg_lab_micro_logs ADD COLUMN customer_name VARCHAR(255) NULL AFTER customer_id');
            console.log('✓ Columna customer_name agregada a egg_lab_micro_logs.');
        }

        if (!colNames.includes('presentation')) {
            await pool.query('ALTER TABLE egg_lab_micro_logs ADD COLUMN presentation VARCHAR(100) NULL DEFAULT "Cubeta 30 Lb" AFTER customer_name');
            console.log('✓ Columna presentation agregada a egg_lab_micro_logs.');
        }

        if (!colNames.includes('custom_parameters')) {
            await pool.query('ALTER TABLE egg_lab_micro_logs ADD COLUMN custom_parameters JSON NULL AFTER observations');
            console.log('✓ Columna custom_parameters agregada a egg_lab_micro_logs.');
        }

        // 3. Sembrar parámetros predeterminados para las empresas que procesan ovoproductos (e.g. company_id = 9 y todas las activas)
        const [companies] = await pool.query('SELECT id FROM companies WHERE id = 9 OR razon_social LIKE "%ANDELSA%" OR nombre_comercial LIKE "%ANDELSA%"');
        const targetCompanies = companies.length > 0 ? companies.map(c => c.id) : [9];

        const defaultParameters = [
            // Microbiológicos
            { category: 'microbiologico', name: 'Recuento Mesófilos Aerobios', spec: 'Máx 10,000 UFC/g', def: '< 1,000 UFC/g', unit: 'UFC/g', prod: 'todos', crit: 'CONFORME', order: 1 },
            { category: 'microbiologico', name: 'Coliformes Totales', spec: 'Máx 10 UFC/g', def: '< 10 UFC/g', unit: 'UFC/g', prod: 'todos', crit: 'CONFORME', order: 2 },
            { category: 'microbiologico', name: 'Escherichia coli', spec: 'Ausencia en 1g', def: 'Ausencia', unit: 'N/A', prod: 'todos', crit: 'CONFORME', order: 3 },
            { category: 'microbiologico', name: 'Salmonella spp.', spec: 'Ausencia en 25g (Crítico)', def: 'Ausencia en 25g', unit: 'N/A', prod: 'todos', crit: 'CONFORME', order: 4 },
            { category: 'microbiologico', name: 'Hongos y Levaduras', spec: 'Máx 100 UFC/g', def: '< 10 UFC/g', unit: 'UFC/g', prod: 'todos', crit: 'CONFORME', order: 5 },
            // Físico-Químicos
            { category: 'fisicoquimico', name: 'Porcentaje de Sólidos Totales', spec: '≥ 21.0% (Refractómetro)', def: '24.2%', unit: '%', prod: 'huevo entero', crit: 'DENTRO DE NORMA', order: 6 },
            { category: 'fisicoquimico', name: 'Porcentaje de Sólidos Totales', spec: '11.5% - 12.5%', def: '12.0%', unit: '%', prod: 'clara de huevo', crit: 'DENTRO DE NORMA', order: 7 },
            { category: 'fisicoquimico', name: 'Porcentaje de Sólidos Totales', spec: '43.0% - 45.0%', def: '44.0%', unit: '%', prod: 'yema de huevo', crit: 'DENTRO DE NORMA', order: 8 },
            { category: 'fisicoquimico', name: 'Potencial de Hidrógeno (pH)', spec: '7.20 - 7.80 pH', def: '7.40', unit: 'pH', prod: 'todos', crit: 'DENTRO DE NORMA', order: 9 },
            // Organolépticos
            { category: 'organoleptico', name: 'Olor, Color y Aspecto', spec: 'Característico, homogéneo, libre de olores extraños', def: 'Normal', unit: 'N/A', prod: 'todos', crit: 'CONFORME', order: 10 }
        ];

        for (const companyId of targetCompanies) {
            const [existing] = await pool.query('SELECT id FROM egg_quality_parameters WHERE company_id = ? LIMIT 1', [companyId]);
            if (existing.length === 0) {
                console.log(`Sembrando parámetros de calidad iniciales para empresa ${companyId}...`);
                for (const param of defaultParameters) {
                    await pool.query(`
                        INSERT INTO egg_quality_parameters (
                            company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    `, [companyId, param.category, param.name, param.spec, param.def, param.unit, param.prod, param.crit, param.order]);
                }
                console.log(`✓ ${defaultParameters.length} parámetros estándar sembrados para empresa ${companyId}.`);
            }
        }

        console.log('✓ Migración v175 completada exitosamente.');
    } catch (error) {
        console.error('Error en migración v175:', error);
        throw error;
    }
}

module.exports = runMigration;
