/**
 * Preloader and Cache Manager for Official Hacienda DTE Catalogs
 * Sipe Web SaaS - Phase 3.1
 */

const pool = require('../config/db');
const cache = require('../config/cache');
const { logger } = require('../utils/logger');

const OFFICIAL_CATALOG_TABLES = [
    'cat_001_ambiente',
    'cat_002_tipo_dte',
    'cat_003_modelo_facturacion',
    'cat_004_tipo_transmision',
    'cat_005_tipo_contingencia',
    'cat_006_retencion_iva',
    'cat_007_tipo_generacion',
    'cat_008_distrito',
    'cat_009_tipo_establecimiento',
    'cat_011_tipo_item',
    'cat_012_departamento',
    'cat_013_municipio',
    'cat_014_unidad_medida',
    'cat_015_tributo',
    'cat_016_condicion_operacion',
    'cat_017_forma_pago',
    'cat_018_plazo',
    'cat_019_actividad_economica',
    'cat_020_pais',
    'cat_022_tipo_documento_receptor',
    'cat_023_documento_contingencia',
    'cat_024_tipo_invalidacion',
    'cat_029_tipo_persona',
    'cat_030_transporte',
    'cat_expense_types'
];

// TTL of 7 days (604,800 seconds) for official fixed catalogs
const CATALOG_TTL = 7 * 24 * 60 * 60;

let preloadStatus = {
    loaded: false,
    tableCount: 0,
    totalRecords: 0,
    lastLoadedAt: null
};

/**
 * Preload all official Hacienda catalogs into Redis / In-Memory cache
 */
async function preloadHaciendaCatalogs() {
    const startTime = Date.now();
    let loadedTables = 0;
    let totalRecords = 0;

    try {
        for (const tableName of OFFICIAL_CATALOG_TABLES) {
            try {
                const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` ORDER BY 1`);
                if (rows && rows.length > 0) {
                    await cache.set(`cat:generic:${tableName}`, rows, CATALOG_TTL);
                    loadedTables++;
                    totalRecords += rows.length;

                    // Also store specific friendly aliases for frequently queried endpoints
                    if (tableName === 'cat_012_departamento') {
                        await cache.set('cat:012:departamentos', rows, CATALOG_TTL);
                    } else if (tableName === 'cat_019_actividad_economica') {
                        await cache.set('cat:019:actividades', rows, CATALOG_TTL);
                    } else if (tableName === 'cat_008_distrito') {
                        await cache.set('cat:008:distritos:all', rows, CATALOG_TTL);
                    } else if (tableName === 'cat_013_municipio') {
                        await cache.set('cat:013:municipios:all', rows, CATALOG_TTL);
                    }
                }
            } catch (tableErr) {
                logger.warn({ table: tableName, err: tableErr.message }, '[CatalogCache] Omitiendo tabla de catálogo no disponible');
            }
        }

        const duration = Date.now() - startTime;
        preloadStatus = {
            loaded: true,
            tableCount: loadedTables,
            totalRecords: totalRecords,
            lastLoadedAt: new Date().toISOString()
        };

        logger.info(
            { durationMs: duration, tables: loadedTables, records: totalRecords },
            `[CatalogCache] ${loadedTables} catálogos oficiales de Hacienda pre-cargados exitosamente en caché (${totalRecords} registros)`
        );
    } catch (globalErr) {
        logger.error({ err: globalErr.message }, '[CatalogCache] Error durante la pre-carga de catálogos');
    }

    return preloadStatus;
}

function getPreloadStatus() {
    return { ...preloadStatus };
}

module.exports = {
    OFFICIAL_CATALOG_TABLES,
    preloadHaciendaCatalogs,
    getPreloadStatus
};
