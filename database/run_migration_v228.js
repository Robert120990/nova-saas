const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v228: Optimización de Índices de Rendimiento para Workers y Ventas ---');

        // 1. Índices para transmission_queue
        const [tqIndexes] = await pool.query('SHOW INDEX FROM transmission_queue');
        const tqIndexNames = new Set(tqIndexes.map(i => i.Key_name));

        if (!tqIndexNames.has('idx_tq_status_next_attempts')) {
            console.log('  → Creando índice idx_tq_status_next_attempts en transmission_queue...');
            await pool.query('ALTER TABLE transmission_queue ADD INDEX idx_tq_status_next_attempts (status, next_attempt_at, attempts)');
            console.log('  ✓ Índice idx_tq_status_next_attempts creado.');
        } else {
            console.log('  ✓ Índice idx_tq_status_next_attempts ya existe.');
        }

        // 2. Índices para dte_contingency_documents
        const [cdIndexes] = await pool.query('SHOW INDEX FROM dte_contingency_documents');
        const cdIndexNames = new Set(cdIndexes.map(i => i.Key_name));

        if (!cdIndexNames.has('idx_contingency_estado_retry')) {
            console.log('  → Creando índice idx_contingency_estado_retry en dte_contingency_documents...');
            await pool.query('ALTER TABLE dte_contingency_documents ADD INDEX idx_contingency_estado_retry (estado_envio, retry_count, created_at)');
            console.log('  ✓ Índice idx_contingency_estado_retry creado.');
        } else {
            console.log('  ✓ Índice idx_contingency_estado_retry ya existe.');
        }

        // 3. Índices para sales_headers (Consultas de ventas filtradas por sucursal y fecha)
        const [salesIndexes] = await pool.query('SHOW INDEX FROM sales_headers');
        const salesIndexNames = new Set(salesIndexes.map(i => i.Key_name));

        if (!salesIndexNames.has('idx_sales_branch_fecha')) {
            console.log('  → Creando índice idx_sales_branch_fecha en sales_headers...');
            await pool.query('ALTER TABLE sales_headers ADD INDEX idx_sales_branch_fecha (branch_id, fecha_emision)');
            console.log('  ✓ Índice idx_sales_branch_fecha creado.');
        } else {
            console.log('  ✓ Índice idx_sales_branch_fecha ya existe.');
        }

        console.log('--- Migración v228 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v228:', error);
        process.exit(1);
    }
}

runMigration();
