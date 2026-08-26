require('dotenv').config();
const mysql = require('mysql2/promise');

const COMPANY_ORIGEN = 1;
const COMPANY_DESTINO = 2;
const CAT_NAME = 'COMBUSTIBLES';
const BRANCH_ORIGEN_NAME = 'Puma San Martin II';
const BRANCH_DESTINO_NAME = 'Shell Chalchuapa';

async function main() {
    const dst = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const [[catO]] = await dst.query('SELECT id FROM product_categories WHERE company_id = ? AND name = ?', [COMPANY_ORIGEN, CAT_NAME]);
    const [[catD]] = await dst.query('SELECT id FROM product_categories WHERE company_id = ? AND name = ?', [COMPANY_DESTINO, CAT_NAME]);
    const [[bO]] = await dst.query('SELECT id, nombre FROM branches WHERE company_id = ? AND nombre = ?', [COMPANY_ORIGEN, BRANCH_ORIGEN_NAME]);
    const [[bD]] = await dst.query('SELECT id, nombre FROM branches WHERE company_id = ? AND nombre = ?', [COMPANY_DESTINO, BRANCH_DESTINO_NAME]);
    if (!catO || !catD || !bO || !bD) throw new Error(`Config no encontrada: catO=${!!catO} catD=${!!catD} bO=${!!bO} bD=${!!bD}`);
    console.log(`Origen: categoria ${CAT_NAME} (id=${catO.id}), sucursal "${bO.nombre}" (id=${bO.id})`);
    console.log(`Destino: empresa ${COMPANY_DESTINO}, categoria ${CAT_NAME} (id=${catD.id}), sucursal "${bD.nombre}" (id=${bD.id})`);

    const [productos] = await dst.query(
        'SELECT * FROM products WHERE company_id = ? AND category_id = ? AND status = ? ORDER BY codigo',
        [COMPANY_ORIGEN, catO.id, 'activo']
    );
    console.log(`Productos activos en origen: ${productos.length}`);

    const codigos = productos.map(p => p.codigo);
    const [colisiones] = await dst.query(
        `SELECT codigo, nombre FROM products WHERE company_id = ? AND codigo IN (?)`,
        [COMPANY_DESTINO, codigos]
    );
    if (colisiones.length > 0) {
        throw new Error(`Colisiones de codigo en empresa ${COMPANY_DESTINO}: ${JSON.stringify(colisiones)} — abortando`);
    }

    await dst.beginTransaction();
    try {
        let afectados = 0;
        for (let i = 0; i < productos.length; i += 200) {
            const lote = productos.slice(i, i + 200).map(p => [
                COMPANY_DESTINO,
                p.codigo,
                p.nombre,
                p.codigo_barra,
                p.descripcion,
                p.unidad_medida,
                p.tipo_item,
                null,
                p.es_exento,
                p.tipo_operacion,
                p.tipo_combustible,
                catD.id,
                p.status,
                p.afecta_inventario,
                p.costo,
                p.stock_minimo,
                p.permitir_existencia_negativa
            ]);
            const [r] = await dst.query(
                `INSERT INTO products (company_id, codigo, nombre, codigo_barra, descripcion, unidad_medida, tipo_item, provider_id,
                    es_exento, tipo_operacion, tipo_combustible, category_id, status, afecta_inventario, costo, stock_minimo, permitir_existencia_negativa)
                 VALUES ?`,
                [lote]
            );
            afectados += r.affectedRows;
        }
        console.log(`Productos insertados: ${afectados}`);

        const [nuevos] = await dst.query('SELECT id, codigo FROM products WHERE company_id = ?', [COMPANY_DESTINO]);
        const nuevoIdPorCodigo = new Map(nuevos.map(p => [p.codigo, p.id]));
        const nuevosIds = productos.map(p => nuevoIdPorCodigo.get(p.codigo)).filter(Boolean);

        const [pb] = await dst.query('INSERT IGNORE INTO product_branch (product_id, branch_id) VALUES ?', [nuevosIds.map(id => [id, bD.id])]);
        console.log(`Vinculos product_branch insertados: ${pb.affectedRows}`);

        const [precios] = await dst.query(
            'SELECT product_id, precio_unitario FROM product_branch_prices WHERE branch_id = ? AND product_id IN (?)',
            [bO.id, productos.map(p => p.id)]
        );
        const precioFilas = precios
            .map(pr => {
                const src = productos.find(p => p.id === pr.product_id);
                const newId = src ? nuevoIdPorCodigo.get(src.codigo) : null;
                return newId ? [newId, bD.id, pr.precio_unitario] : null;
            })
            .filter(Boolean);
        let preciosAfectados = 0;
        for (let i = 0; i < precioFilas.length; i += 200) {
            const [r] = await dst.query(
                'INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES ? ON DUPLICATE KEY UPDATE precio_unitario = VALUES(precio_unitario)',
                [precioFilas.slice(i, i + 200)]
            );
            preciosAfectados += r.affectedRows;
        }
        console.log(`Precios aplicados (${precioFilas.length} filas): ${preciosAfectados} filas afectadas`);

        await dst.commit();
        console.log('Commit OK');
    } catch (e) {
        await dst.rollback();
        throw e;
    }

    const [[vc]] = await dst.query(`SELECT COUNT(*) c FROM products WHERE company_id = ? AND category_id = ?`, [COMPANY_DESTINO, catD.id]);
    const [[vp]] = await dst.query(`SELECT COUNT(*) c FROM product_branch_prices pbp JOIN products p ON p.id = pbp.product_id WHERE p.company_id = ? AND pbp.branch_id = ?`, [COMPANY_DESTINO, bD.id]);
    const [muestra] = await dst.query(`SELECT p.codigo, p.nombre, p.tipo_combustible, p.costo, pbp.precio_unitario
        FROM products p LEFT JOIN product_branch_prices pbp ON pbp.product_id = p.id AND pbp.branch_id = ?
        WHERE p.company_id = ? AND p.category_id = ? ORDER BY p.codigo`, [bD.id, COMPANY_DESTINO, catD.id]);

    console.log('\n===== VERIFICACION =====');
    console.log(`Combustibles en empresa ${COMPANY_DESTINO}: ${vc.c}`);
    console.log(`Precios en ${bD.nombre}: ${vp.c}`);
    muestra.forEach(m => console.log(`  ${m.codigo.padEnd(10)} | ${(m.nombre || '').padEnd(22)} | tc=${m.tipo_combustible} | costo=${m.costo} | precio=${m.precio_unitario}`));

    await dst.end();
    console.log('\nCopia completada');
}

main().catch(e => { console.error('ERROR FATAL:', e.message); process.exit(1); });
