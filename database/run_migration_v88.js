const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('Running migration v88 dynamically...');

        // 1. Check and add columns to egg_lab_micro_logs
        const [labCols] = await pool.query('DESCRIBE egg_lab_micro_logs');
        const existingLab = new Set(labCols.map(c => c.Field));

        const labAdditions = [
            { col: 'temperature_c', def: 'ADD COLUMN temperature_c DECIMAL(4,1) NULL AFTER ph' },
            { col: 'salinity_pct', def: 'ADD COLUMN salinity_pct DECIMAL(5,2) NULL AFTER temperature_c' },
            { col: 'density', def: 'ADD COLUMN density DECIMAL(6,4) NULL AFTER salinity_pct' },
            { col: 'staph_aureus', def: "ADD COLUMN staph_aureus ENUM('negativo','positivo','ausencia','presencia') DEFAULT 'negativo' AFTER fungi_yeasts_cfu" },
            { col: 'fq_status', def: "ADD COLUMN fq_status ENUM('pendiente','aprobado','observacion','rechazado') DEFAULT 'pendiente' AFTER solids_percentage" },
            { col: 'mb_status', def: "ADD COLUMN mb_status ENUM('pendiente','en_incubacion','aprobado','rechazado') DEFAULT 'pendiente' AFTER fq_status" },
            { col: 'incubation_started_at', def: 'ADD COLUMN incubation_started_at DATETIME NULL AFTER mb_status' },
            { col: 'incubation_hours', def: 'ADD COLUMN incubation_hours INT DEFAULT 48 AFTER incubation_started_at' },
            { col: 'release_status', def: "ADD COLUMN release_status ENUM('cuarentena','liberado','bloqueado_haccp') DEFAULT 'cuarentena' AFTER mb_status" },
            { col: 'released_at', def: 'ADD COLUMN released_at DATETIME NULL AFTER release_status' },
            { col: 'released_by', def: 'ADD COLUMN released_by VARCHAR(100) NULL AFTER released_at' },
            { col: 'commercial_lot_code', def: 'ADD COLUMN commercial_lot_code VARCHAR(60) NULL AFTER batch_id' }
        ];

        for (const item of labAdditions) {
            if (!existingLab.has(item.col)) {
                console.log(`Adding column ${item.col} to egg_lab_micro_logs...`);
                await pool.query(`ALTER TABLE egg_lab_micro_logs ${item.def}`);
            }
        }

        // 2. Check and add quality_status to egg_packaging_records
        const [pkgCols] = await pool.query('DESCRIBE egg_packaging_records');
        const existingPkg = new Set(pkgCols.map(c => c.Field));
        if (!existingPkg.has('quality_status')) {
            console.log('Adding column quality_status to egg_packaging_records...');
            await pool.query("ALTER TABLE egg_packaging_records ADD COLUMN quality_status ENUM('cuarentena','liberado','bloqueado_haccp') DEFAULT 'cuarentena' AFTER product_state");
        }

        // 3. Populate default Mario quality profiles in egg_quality_parameters
        console.log('Populating quality parameters for egg products...');
        await pool.query(`
            INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
            SELECT c.id, 'fisicoquimico', 'pH (Acidez / Alcalinidad)', '7.00 - 8.00 (Nominal 7.50)', '7.50', 'pH', 'huevo entero', 'CONFORME', 1, 1
            FROM companies c
            WHERE NOT EXISTS (
                SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'pH%' AND q.applicable_product = 'huevo entero'
            )
        `);

        await pool.query(`
            INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
            SELECT c.id, 'fisicoquimico', 'Sólidos Totales (%)', '23.70% - 24.70% (Nominal 24.20%)', '24.20', '%', 'huevo entero', 'CONFORME', 2, 1
            FROM companies c
            WHERE NOT EXISTS (
                SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'Sólidos Totales%' AND q.applicable_product = 'huevo entero'
            )
        `);

        await pool.query(`
            INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
            SELECT c.id, 'fisicoquimico', 'Densidad', '0.115 - 0.145 (Nominal 0.130)', '0.130', 'g/ml', 'huevo entero', 'CONFORME', 3, 1
            FROM companies c
            WHERE NOT EXISTS (
                SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'Densidad%' AND q.applicable_product = 'huevo entero'
            )
        `);

        await pool.query(`
            INSERT INTO egg_quality_parameters (company_id, category, parameter_name, specification, default_value, unit, applicable_product, expected_criterion, sort_order, is_active)
            SELECT c.id, 'microbiologico', 'Staphylococcus Aureus', 'Negativo / Ausente', 'Negativo', 'UFC/g', 'todos', 'CONFORME', 6, 1
            FROM companies c
            WHERE NOT EXISTS (
                SELECT 1 FROM egg_quality_parameters q WHERE q.company_id = c.id AND q.parameter_name LIKE 'Staphylococcus%'
            )
        `);

        console.log('Migration v88 completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

runMigration();
