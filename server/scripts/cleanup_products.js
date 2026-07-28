const mysql = require('mysql2/promise');
const readline = require('readline');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const BATCH_SIZE = 1000;

const USAGE_TABLES = [
    { table: 'sales_items', column: 'product_id' },
    { table: 'purchase_items', column: 'product_id' },
    { table: 'inventory_movements', column: 'product_id' },
    { table: 'inventory_adjustment_items', column: 'product_id' },
    { table: 'product_combo_items', column: 'product_id' },
];

async function confirm(message) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(`${message} (s/n): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 's');
        });
    });
}

function chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

async function batchCheckUsage(conn, ids) {
    const usedSet = new Set();
    const chunks = chunk(ids, BATCH_SIZE);

    for (const chunkIds of chunks) {
        const placeholders = chunkIds.map(() => '?').join(',');

        const unionQueries = USAGE_TABLES.map(
            (t) => `SELECT DISTINCT ${t.column} AS pid FROM ${t.table} WHERE ${t.column} IN (${placeholders})`
        ).join(' UNION ');

        const [rows] = await conn.query(`(${unionQueries})`, [
            ...chunkIds, ...chunkIds, ...chunkIds, ...chunkIds, ...chunkIds,
        ]);

        rows.forEach((r) => usedSet.add(r.pid));
    }

    return usedSet;
}

async function batchCheckReferences(conn, ids) {
    const refSet = new Set();
    const chunks = chunk(ids, BATCH_SIZE);

    for (const chunkIds of chunks) {
        const placeholders = chunkIds.map(() => '?').join(',');
        const [rows] = await conn.query(
            `SELECT DISTINCT discount_from_id AS pid FROM products WHERE discount_from_id IN (${placeholders}) AND discount_from_id IS NOT NULL`,
            chunkIds
        );
        rows.forEach((r) => refSet.add(r.pid));
    }

    return refSet;
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        decimalNumbers: true,
    });

    try {
        const [companies] = await conn.query('SELECT id, nombre_comercial FROM companies ORDER BY id');
        console.log(`\nEmpresas encontradas: ${companies.length}`);

        let totalDeleted = 0;
        let totalSkippedUsage = 0;
        let totalSkippedReference = 0;

        for (const company of companies) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Empresa: ${company.nombre_comercial} (ID: ${company.id})`);
            console.log('='.repeat(60));

            const [keepCats] = await conn.query(
                `SELECT id, name FROM product_categories
                 WHERE company_id = ? AND (name LIKE '%combustibles%' OR name LIKE '%lubricantes%')`,
                [company.id]
            );

            if (keepCats.length === 0) {
                console.log('  No se encontraron categorías "Combustibles" ni "Lubricantes". Saltando...');
                continue;
            }

            const keepCatIds = keepCats.map((c) => c.id);
            console.log(`  Categorías a conservar: ${keepCats.map((c) => `${c.name} (ID: ${c.id})`).join(', ')}`);

            const catPlaceholders = keepCatIds.map(() => '?').join(',');
            const [candidates] = await conn.query(
                `SELECT p.id, p.codigo, p.descripcion, p.category_id, p.tipo_combustible,
                        pc.name AS categoria_nombre
                 FROM products p
                 LEFT JOIN product_categories pc ON pc.id = p.category_id
                 WHERE p.company_id = ?
                 AND p.tipo_combustible = 0
                 AND (p.category_id NOT IN (${catPlaceholders}) OR p.category_id IS NULL)
                 ORDER BY p.codigo`,
                [company.id, ...keepCatIds]
            );

            if (candidates.length === 0) {
                console.log('  No hay productos candidatos a eliminar.');
                continue;
            }

            console.log(`  Productos candidatos a eliminar: ${candidates.length}`);
            process.stdout.write('  Verificando uso en tablas... ');

            const allIds = candidates.map((p) => p.id);
            const usedSet = await batchCheckUsage(conn, allIds);
            const refSet = await batchCheckReferences(conn, allIds);

            console.log('listo');

            const toDelete = candidates.filter((p) => !usedSet.has(p.id) && !refSet.has(p.id));
            const skippedUsage = candidates.filter((p) => usedSet.has(p.id));
            const skippedRef = candidates.filter((p) => !usedSet.has(p.id) && refSet.has(p.id));

            if (toDelete.length === 0) {
                console.log('  Ningún producto califica para eliminación (todos tienen uso o referencias).');
                totalSkippedUsage += skippedUsage.length;
                totalSkippedReference += skippedRef.length;
                continue;
            }

            if (toDelete.length <= 50) {
                console.log(`\n  ${'─'.repeat(56)}`);
                console.log(`  ID | Codigo     | Descripcion                    | Categoria`);
                console.log(`  ${'─'.repeat(56)}`);
                for (const p of toDelete) {
                    const cat = p.categoria_nombre || 'Sin categoría';
                    const desc = p.descripcion.length > 30 ? p.descripcion.substring(0, 27) + '...' : p.descripcion;
                    const cod = (p.codigo || '').substring(0, 10).padEnd(10);
                    console.log(`  ${String(p.id).padStart(3)} | ${cod} | ${desc.padEnd(30)} | ${cat}`);
                }
                console.log(`  ${'─'.repeat(56)}`);
            } else {
                console.log(`\n  (Tabla omitida por ser mayor a 50 productos)`);
            }

            console.log(`  A eliminar: ${toDelete.length} | Saltados (uso): ${skippedUsage.length} | Saltados (refs): ${skippedRef.length}`);

            const proceed = await confirm(`\n  ¿Eliminar ${toDelete.length} productos de "${company.nombre_comercial}"?`);
            if (!proceed) {
                console.log('  Saltando esta empresa.');
                continue;
            }

            const deleteIds = toDelete.map((p) => p.id);
            const delChunks = chunk(deleteIds, BATCH_SIZE);
            let affectedRows = 0;

            for (const chunkIds of delChunks) {
                const delPlaceholders = chunkIds.map(() => '?').join(',');
                const [result] = await conn.query(
                    `DELETE FROM products WHERE id IN (${delPlaceholders})`,
                    chunkIds
                );
                affectedRows += result.affectedRows;
            }

            console.log(`  ✓ Eliminados: ${affectedRows} productos`);
            totalDeleted += affectedRows;
            totalSkippedUsage += skippedUsage.length;
            totalSkippedReference += skippedRef.length;
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log('RESUMEN FINAL');
        console.log('='.repeat(60));
        console.log(`  Total eliminados:            ${totalDeleted}`);
        console.log(`  Saltados (con uso):          ${totalSkippedUsage}`);
        console.log(`  Saltados (con referencias):  ${totalSkippedReference}`);
        console.log('='.repeat(60));

    } finally {
        await conn.end();
    }
}

main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
