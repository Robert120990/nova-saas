const pool = require('../../config/db');
const nodemailer = require('nodemailer');
const { broadcastToCompany } = require('../../services/websocket.service');
const notificationService = require('../../services/notification.service');
const eggExportService = require('../../services/eggProductionExport.service');
const eggReportsExportService = require('../../services/eggReportsExport.service');
const eggQualityLetterExport = require('../../services/eggQualityLetterExport.service');
const eggRawMaterialLabReport = require('../../services/eggRawMaterialLabReport.service');
const eggOriginCertificate = require('../../services/eggOriginCertificate.service');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const excelService = require('../../services/excel.service');
const { resolveEggCatalogProduct } = require('../../utils/eggProductResolver');

// Helpers de sanitización numérica defensiva contra valores NaN / vacíos en MySQL
const safeNum = (val, fallback = 0) => {
    if (val === null || val === undefined || val === '') return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
};

const safeInt = (val, fallback = null) => {
    if (val === null || val === undefined || val === '') return fallback;
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : fallback;
};

// Helper oficial para cálculo de código de lote en Calendario Juliano: LOTE-[Año 2d][Día Juliano 3d]-[Corrida 2d] (ej. LOTE-26252-01)
const computeJulianLotCode = (productionDate, runNumber = 1) => {
    let d;
    if (!productionDate) {
        d = new Date();
    } else if (typeof productionDate === 'string') {
        const parts = productionDate.split('T')[0].split('-');
        if (parts.length === 3) {
            d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            d = new Date(productionDate);
        }
    } else {
        d = new Date(productionDate);
    }
    if (isNaN(d.getTime())) d = new Date();

    const yearFull = d.getFullYear();
    const year2Digit = String(yearFull).slice(-2);
    const startOfYear = new Date(yearFull, 0, 1);
    const diffMs = d.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    const dayOfYearStr = String(dayOfYear).padStart(3, '0');
    const runStr = String(runNumber || 1).padStart(2, '0');
    return `LOTE-${year2Digit}${dayOfYearStr}-${runStr}`;
};


// Auto-garantizar tablas y columnas requeridas en caliente para evitar ER_BAD_FIELD_ERROR / ER_NO_SUCH_TABLE
let schemaEnsured = false;
const ensureEggSchema = async () => {
    if (schemaEnsured) return;
    try {
        // Tablas auxiliares del calendario y pedidos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_scheduled_productions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NULL,
                production_date DATE NOT NULL,
                start_time TIME NOT NULL DEFAULT '06:00:00',
                end_time TIME NOT NULL DEFAULT '14:00:00',
                lot_code VARCHAR(100) NOT NULL,
                product_profile VARCHAR(100) NOT NULL DEFAULT 'Huevo Entero Pasteurizado',
                presentation VARCHAR(100) NOT NULL DEFAULT 'cubeta 30LB',
                target_quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 12000.00,
                target_solids_pct DECIMAL(5,2) NOT NULL DEFAULT 21.50,
                status ENUM('programado', 'en_preparacion', 'en_proceso', 'completado', 'cancelado') NOT NULL DEFAULT 'programado',
                priority ENUM('baja', 'media', 'alta', 'urgente') NOT NULL DEFAULT 'media',
                mix_formula_json JSON NULL,
                assigned_operator_id INT NULL,
                assigned_operator_name VARCHAR(150) NULL,
                batch_id INT NULL,
                suggestion_source VARCHAR(100) NOT NULL DEFAULT 'manual',
                notes TEXT NULL,
                created_by VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_esp_comp_date (company_id, production_date),
                INDEX idx_esp_status (company_id, status),
                INDEX idx_esp_lot (company_id, lot_code)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Columnas en egg_production_batches
        const [batchCodeCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'batch_code_display'"
        );
        if (batchCodeCols.length === 0) {
            await pool.query("ALTER TABLE egg_production_batches ADD COLUMN batch_code_display VARCHAR(100) NULL AFTER batch_uuid");
        }

        const [schedCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'scheduled_production_id'"
        );
        if (schedCols.length === 0) {
            await pool.query("ALTER TABLE egg_production_batches ADD COLUMN scheduled_production_id INT NULL AFTER batch_code_display");
            console.log("[EggIndustrial] Auto-migrated scheduled_production_id in egg_production_batches.");
        }

        // Columnas en batch_raw_materials
        const [tarimaCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batch_raw_materials' AND COLUMN_NAME = 'tarimas_json'"
        );
        if (tarimaCols.length === 0) {
            await pool.query("ALTER TABLE batch_raw_materials ADD COLUMN tarimas_json JSON NULL AFTER quantity_lbs");
        }

        const [boxesCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batch_raw_materials' AND COLUMN_NAME = 'boxes_count'"
        );
        if (boxesCols.length === 0) {
            await pool.query("ALTER TABLE batch_raw_materials ADD COLUMN boxes_count INT DEFAULT 0 AFTER tarimas_json");
        }

        // Columnas en egg_packaging_records para soportar empaque multiproducto y presentación independiente
        const [pkgCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_packaging_records' AND COLUMN_NAME = 'product_type'"
        );
        if (pkgCols.length === 0) {
            await pool.query("ALTER TABLE egg_packaging_records ADD COLUMN product_type VARCHAR(100) NULL AFTER batch_id, ADD COLUMN presentation VARCHAR(100) NULL AFTER product_type");
        }

        // Columnas de clasificación de calidad en egg_raw_materials
        const [qualityCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_raw_materials' AND COLUMN_NAME = 'egg_classification'"
        );
        if (qualityCols.length === 0) {
            await pool.query(`
                ALTER TABLE egg_raw_materials 
                ADD COLUMN egg_classification VARCHAR(50) DEFAULT 'Grado A' AFTER egg_size,
                ADD COLUMN quality_inspector_name VARCHAR(150) NULL AFTER operator_name,
                ADD COLUMN quality_status VARCHAR(50) DEFAULT 'pendiente' AFTER quality_inspector_name,
                ADD COLUMN quality_date DATETIME NULL AFTER quality_status,
                ADD COLUMN quality_notes TEXT NULL AFTER quality_date,
                ADD COLUMN quality_defect_broken_pct DECIMAL(5,2) DEFAULT 0.00 AFTER quality_notes,
                ADD COLUMN quality_defect_dirty_pct DECIMAL(5,2) DEFAULT 0.00 AFTER quality_defect_broken_pct,
                ADD COLUMN quality_brix DECIMAL(5,2) NULL AFTER quality_defect_dirty_pct
            `);
            console.log("[EggIndustrial] Auto-migrated quality classification columns in egg_raw_materials.");
        }

        // Columna storage_location en egg_raw_materials
        const [locCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_raw_materials' AND COLUMN_NAME = 'storage_location'"
        );
        if (locCols.length === 0) {
            await pool.query("ALTER TABLE egg_raw_materials ADD COLUMN storage_location VARCHAR(50) DEFAULT 'abajo' AFTER total_boxes");
            console.log("[EggIndustrial] Auto-migrated storage_location in egg_raw_materials.");
        }

        // Columna storage_location en egg_raw_material_tarimas
        const [locTarimaCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_raw_material_tarimas' AND COLUMN_NAME = 'storage_location'"
        );
        if (locTarimaCols.length === 0) {
            await pool.query("ALTER TABLE egg_raw_material_tarimas ADD COLUMN storage_location VARCHAR(50) DEFAULT 'abajo' AFTER boxes_count");
            console.log("[EggIndustrial] Auto-migrated storage_location in egg_raw_material_tarimas.");
        }

        // Tablas y columnas de mermas, remanentes y mapeos de códigos (Mejoras Integrales v199)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_batch_waste_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                batch_id INT NOT NULL,
                stage ENUM('quebraje', 'pasteurizacion', 'tuberias', 'envasado', 'almacenamiento', 'calidad', 'otro') NOT NULL DEFAULT 'quebraje',
                waste_type VARCHAR(100) NOT NULL DEFAULT 'merma_operativa',
                quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                reason TEXT NULL,
                operator_name VARCHAR(150) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ebw_comp_batch (company_id, batch_id),
                INDEX idx_ebw_stage (company_id, stage),
                INDEX idx_ebw_created (company_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_batch_remanentes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                batch_id INT NOT NULL,
                product_type VARCHAR(100) NOT NULL,
                remanente_type ENUM('pasteurizado', 'no_pasteurizado', 'reproceso', 'reutilizable') NOT NULL DEFAULT 'pasteurizado',
                quantity_lbs DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                storage_location VARCHAR(150) NULL,
                status ENUM('disponible', 'asignado_a_lote', 'descartado') NOT NULL DEFAULT 'disponible',
                target_batch_id INT NULL,
                notes TEXT NULL,
                operator_name VARCHAR(150) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ebr_comp_batch (company_id, batch_id),
                INDEX idx_ebr_status (company_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS egg_product_code_mappings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                catalog_product_id INT NULL,
                catalog_product_name VARCHAR(255) NULL,
                industrial_product_type VARCHAR(100) NOT NULL,
                presentation VARCHAR(100) NOT NULL,
                catalog_codes TEXT NOT NULL,
                unit_weight_lbs DECIMAL(10,2) NOT NULL DEFAULT 1.00,
                unit_weight_kg DECIMAL(10,2) NOT NULL DEFAULT 0.45,
                unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'lb',
                code_weights_json TEXT NULL,
                notes VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_epcm_comp_type (company_id, industrial_product_type),
                INDEX idx_epcm_catalog_product (company_id, catalog_product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Compatibilidad con instalaciones que ya tenían la tabla creada por v199.
        const mappingColumns = [
            {
                name: 'catalog_product_id',
                statement: 'ALTER TABLE egg_product_code_mappings ADD COLUMN catalog_product_id INT NULL AFTER company_id'
            },
            {
                name: 'catalog_product_name',
                statement: 'ALTER TABLE egg_product_code_mappings ADD COLUMN catalog_product_name VARCHAR(255) NULL AFTER catalog_product_id'
            },
            {
                name: 'unit_of_measure',
                statement: "ALTER TABLE egg_product_code_mappings ADD COLUMN unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'lb' AFTER unit_weight_kg"
            },
            {
                name: 'code_weights_json',
                statement: 'ALTER TABLE egg_product_code_mappings ADD COLUMN code_weights_json TEXT NULL AFTER catalog_codes'
            }
        ];
        for (const column of mappingColumns) {
            const [existingColumns] = await pool.query(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_product_code_mappings' AND COLUMN_NAME = ?",
                [column.name]
            );
            if (existingColumns.length === 0) {
                await pool.query(column.statement);
            }
        }

        const [bCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_production_batches' AND COLUMN_NAME = 'packaging_status'"
        );
        if (bCols.length === 0) {
            await pool.query("ALTER TABLE egg_production_batches ADD COLUMN packaging_status ENUM('pendiente', 'en_envasado', 'cerrado') NOT NULL DEFAULT 'pendiente' AFTER status, ADD COLUMN packaging_loss_lbs DECIMAL(12,2) DEFAULT 0.00 AFTER packaging_status, ADD COLUMN packaging_efficiency_pct DECIMAL(5,2) DEFAULT 0.00 AFTER packaging_loss_lbs, ADD COLUMN notes TEXT NULL AFTER packaging_efficiency_pct");
        }

        const [ecoCols] = await pool.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_customer_orders' AND COLUMN_NAME = 'items_json'"
        );
        if (ecoCols.length === 0) {
            await pool.query("ALTER TABLE egg_customer_orders ADD COLUMN items_json JSON NULL AFTER notes, ADD COLUMN batch_id INT NULL AFTER items_json, ADD COLUMN lot_code VARCHAR(100) NULL AFTER batch_id");
        }

        schemaEnsured = true;
    } catch (err) {
        console.warn("[EggIndustrial] ensureEggSchema notice:", err.message);
    }
};
ensureEggSchema().catch(() => { });


module.exports = {
    pool,
    nodemailer,
    broadcastToCompany,
    notificationService,
    eggExportService,
    eggReportsExportService,
    eggQualityLetterExport,
    eggRawMaterialLabReport,
    eggOriginCertificate,
    reportPdfHelper,
    excelService,
    resolveEggCatalogProduct,
    safeNum,
    safeInt,
    computeJulianLotCode,
    ensureEggSchema
};
