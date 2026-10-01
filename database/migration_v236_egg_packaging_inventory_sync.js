const { resolveEggCatalogProduct } = require('../server/src/utils/eggProductResolver');

async function migrate(pool) {
    // 1. Asegurar columnas product_id y branch_id en egg_packaging_records
    const [prodCols] = await pool.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egg_packaging_records' AND COLUMN_NAME = 'product_id'"
    );
    if (prodCols.length === 0) {
        await pool.query(`
            ALTER TABLE egg_packaging_records
            ADD COLUMN product_id INT NULL DEFAULT NULL AFTER presentation,
            ADD COLUMN branch_id INT NULL DEFAULT NULL AFTER product_id,
            ADD INDEX idx_epr_prod_branch (company_id, branch_id, product_id)
        `);
        console.log('[Migration v236] Agregadas columnas product_id y branch_id a egg_packaging_records.');
    }

    // 2. Buscar registros de empaque existentes que no tengan movimiento ENTRADA / ENVASADO_INDUSTRIAL en inventory_movements
    const [records] = await pool.query(`
        SELECT pr.*, b.branch_id as batch_branch_id
        FROM egg_packaging_records pr
        LEFT JOIN egg_production_batches b ON pr.batch_id = b.id
        WHERE NOT EXISTS (
            SELECT 1 FROM inventory_movements im
            WHERE im.company_id = pr.company_id
              AND im.tipo_documento = 'ENVASADO_INDUSTRIAL'
              AND im.documento_id = pr.id
        )
        ORDER BY pr.id ASC
    `);

    console.log(`[Migration v236] Encontrados ${records.length} registros de empaque pendientes de sincronizar con inventario.`);

    let syncedCount = 0;
    for (const record of records) {
        const companyId = record.company_id;
        const units = Number(record.units_packaged || 0);
        if (units <= 0) continue;

        // Determinar sucursal efectiva
        let branchId = record.branch_id || record.batch_branch_id;
        if (branchId) {
            const [bCheck] = await pool.query('SELECT id FROM branches WHERE id = ? AND company_id = ?', [branchId, companyId]);
            if (bCheck.length === 0) branchId = null;
        }
        if (!branchId) {
            const [defBranch] = await pool.query('SELECT id FROM branches WHERE company_id = ? ORDER BY es_casa_matriz DESC, id ASC LIMIT 1', [companyId]);
            branchId = defBranch[0]?.id || null;
        }
        if (!branchId) {
            console.warn(`[Migration v236] No se encontró sucursal válida para empresa ${companyId}, empaque #${record.id}`);
            continue;
        }

        // Resolver producto de catálogo
        let productId = record.product_id;
        if (!productId) {
            const resolved = await resolveEggCatalogProduct(pool, companyId, record.product_type, record.presentation);
            productId = resolved?.catalog_product_id || null;
        }

        if (!productId) {
            console.warn(`[Migration v236] No se pudo resolver producto de catálogo para empaque #${record.id} (${record.product_type} - ${record.presentation})`);
            continue;
        }

        // 1. product_branch
        await pool.query('INSERT IGNORE INTO product_branch (product_id, branch_id) VALUES (?, ?)', [productId, branchId]);

        // 2. Incrementar stock en inventory
        await pool.query(
            `INSERT INTO inventory (company_id, branch_id, product_id, stock)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE stock = stock + ?`,
            [companyId, branchId, productId, units, units]
        );

        // 3. Registrar Kardex en inventory_movements
        await pool.query(
            `INSERT INTO inventory_movements (company_id, branch_id, product_id, tipo_movimiento, cantidad, tipo_documento, documento_id, created_at)
             VALUES (?, ?, ?, 'ENTRADA', ?, 'ENVASADO_INDUSTRIAL', ?, ?)`,
            [companyId, branchId, productId, units, record.id, record.created_at || new Date()]
        );

        // 4. Actualizar egg_packaging_records
        await pool.query(
            `UPDATE egg_packaging_records SET product_id = ?, branch_id = ? WHERE id = ?`,
            [productId, branchId, record.id]
        );

        syncedCount++;
        console.log(`[Migration v236] Empaque #${record.id} sincronizado: Producto ID ${productId}, Sucursal ${branchId}, ${units} unidades.`);
    }

    console.log(`[Migration v236] Migración finalizada. Registros sincronizados: ${syncedCount}/${records.length}.`);
}

module.exports = { migrate };
