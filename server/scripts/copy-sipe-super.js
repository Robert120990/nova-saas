require('dotenv').config();
const mysql = require('mysql2/promise');

const SRC_CONFIG = {
    host: process.env.SIPE_DB_HOST || 'localhost',
    user: process.env.SIPE_DB_USER || 'sysadmin',
    password: process.env.SIPE_DB_PASSWORD,
    database: process.env.SIPE_DB_NAME || 'db_sipe_super'
};

const TARGET_CONFIG = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

const COMPANY_ID = 2;
const BRANCH_NAME = 'Super El Pedregal';
const SRC_EMPRESA = '009';
const TIPO_PRECIO = '02';
const BATCH_SIZE = 500;

const norm = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const orNull = (v) => {
    const s = norm(v);
    return s === '' ? null : s;
};
const trunc = (v, n) => {
    const s = orNull(v);
    return s === null ? null : s.slice(0, n);
};
const num = (v) => (v == null || isNaN(Number(v)) ? 0 : Number(v));

async function main() {
    if (!SRC_CONFIG.password) {
        throw new Error('Define SIPE_DB_PASSWORD (y opcionalmente SIPE_DB_HOST/USER/NAME) en server/.env para conectar a la BD origen');
    }
    const src = await mysql.createConnection({ ...SRC_CONFIG, multipleStatements: false });
    const dst = await mysql.createConnection(TARGET_CONFIG);
    console.log('Conexiones establecidas');

    const [[branch]] = await dst.query(
        'SELECT id, nombre FROM branches WHERE company_id = ? AND nombre = ?',
        [COMPANY_ID, BRANCH_NAME]
    );
    if (!branch) throw new Error(`No existe la sucursal "${BRANCH_NAME}" en la empresa ${COMPANY_ID}`);
    const BRANCH_ID = branch.id;
    console.log(`Sucursal destino: ${branch.nombre} (id=${BRANCH_ID})`);

    async function runSection(label, fn) {
        await dst.beginTransaction();
        try {
            const result = await fn();
            await dst.commit();
            console.log(`[OK] ${label}`, result ?? '');
        } catch (error) {
            await dst.rollback();
            throw new Error(`${label} falló: ${error.message}`);
        }
    }

    async function batchInsert(sql, rows) {
        let affected = 0;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const [res] = await dst.query(sql, [rows.slice(i, i + BATCH_SIZE)]);
            affected += res.affectedRows;
        }
        return affected;
    }

    const summary = {};

    const [[srcClientes], [srcProveedores], [srcLineas], [srcProductos], [srcPrecios]] = await Promise.all([
        src.query('SELECT * FROM clientes'),
        src.query('SELECT * FROM proveedores ORDER BY id'),
        src.query('SELECT * FROM tipos_linea WHERE id_empresa = ? ORDER BY id', [SRC_EMPRESA]),
        src.query('SELECT * FROM productos ORDER BY id'),
        src.query('SELECT id_producto, precio_con_iva FROM precios WHERE id_tipo_precio = ? AND id_empresa = ?', [TIPO_PRECIO, SRC_EMPRESA])
    ]);
    console.log(`Origen: ${srcClientes.length} clientes, ${srcProveedores.length} proveedores, ${srcLineas.length} lineas, ${srcProductos.length} productos, ${srcPrecios.length} precios tipo ${TIPO_PRECIO}`);

    const precioPorProducto = new Map(srcPrecios.map(r => [r.id_producto, num(r.precio_con_iva)]));

    const entityKey = (row) => {
        const nit = norm(row.nit).toLowerCase();
        const nrc = norm(row.nrc).toLowerCase();
        const nombre = norm(row.nombre).toLowerCase();
        if (!nit && !nrc && !nombre) return null;
        return `${nit}|${nrc}|${nombre}`;
    };

    const [dstClientes] = await dst.query('SELECT nit, nrc, nombre FROM customers WHERE company_id = ?', [COMPANY_ID]);
    const clientesExistentes = new Set(dstClientes.map(entityKey).filter(Boolean));
    const clientesNuevos = [];
    let clientesOmitidos = 0;
    for (const c of srcClientes) {
        const key = entityKey(c);
        if (key && clientesExistentes.has(key)) { clientesOmitidos++; continue; }
        if (key) clientesExistentes.add(key);
        clientesNuevos.push([
            COMPANY_ID,
            trunc(c.nombre, 255),
            trunc(c.nombre_comercial, 255),
            orNull(c.nit),
            trunc(c.nrc, 10),
            orNull(norm(c.nit) || c.dui),
            trunc(c.telefono, 20),
            trunc(c.correo, 100),
            orNull(c.direccion)
        ]);
    }
    await runSection('clientes', async () => {
        const n = await batchInsert(
            'INSERT INTO customers (company_id, nombre, nombre_comercial, nit, nrc, numero_documento, telefono, correo, direccion) VALUES ?',
            clientesNuevos
        );
        return { insertados: n, omitidos: clientesOmitidos };
    });
    summary.clientes = { enviados: clientesNuevos.length, omitidos: clientesOmitidos };

    const [dstProveedores] = await dst.query('SELECT id, nit, nrc, nombre FROM providers WHERE company_id = ?', [COMPANY_ID]);
    const proveedorIdPorKey = new Map(dstProveedores.map(p => [entityKey(p), p.id]).filter(([k]) => k));
    const proveedorCodigosVistos = new Set();
    const proveedorIdPorCodigo = new Map();
    const proveedoresNuevos = [];
    let proveedoresOmitidos = 0;
    for (const p of srcProveedores) {
        const codigo = norm(p.codigo);
        if (codigo && proveedorCodigosVistos.has(codigo)) continue;
        if (codigo) proveedorCodigosVistos.add(codigo);
        const key = entityKey(p);
        if (key && proveedorIdPorKey.has(key)) {
            proveedorIdPorCodigo.set(codigo, proveedorIdPorKey.get(key));
            proveedoresOmitidos++;
            continue;
        }
        proveedoresNuevos.push({ codigo, row: [
            COMPANY_ID,
            trunc(p.nombre, 255),
            trunc(p.nombre_comercial, 255),
            orNull(p.nit),
            trunc(p.nrc, 10),
            orNull(norm(p.nit) || norm(p.nrc)),
            trunc(p.telefono, 20),
            trunc(p.correo, 100),
            orNull(p.direccion)
        ], key });
    }
    await runSection('proveedores', async () => {
        const n = await batchInsert(
            'INSERT INTO providers (company_id, nombre, nombre_comercial, nit, nrc, numero_documento, telefono, correo, direccion) VALUES ?',
            proveedoresNuevos.map(x => x.row)
        );
        return { insertados: n, omitidos: proveedoresOmitidos };
    });
    const [dstProveedoresFinal] = await dst.query('SELECT id, nit, nrc, nombre FROM providers WHERE company_id = ?', [COMPANY_ID]);
    const proveedorIdPorKeyFinal = new Map(dstProveedoresFinal.map(p => [entityKey(p), p.id]).filter(([k]) => k));
    for (const x of proveedoresNuevos) proveedorIdPorCodigo.set(x.codigo, proveedorIdPorKeyFinal.get(x.key));
    summary.proveedores = { nuevos: proveedoresNuevos.length, omitidos: proveedoresOmitidos, mapeados: proveedorIdPorCodigo.size };

    const [dstCategorias] = await dst.query('SELECT id, name FROM product_categories WHERE company_id = ?', [COMPANY_ID]);
    const categoriaIdPorNombre = new Map(dstCategorias.map(c => [norm(c.name).toUpperCase(), c.id]));
    const categoriasNuevas = [];
    const categoriaIdPorLinea = new Map();
    let categoriasOmitidas = 0;
    for (const l of srcLineas) {
        const name = norm(l.descripcion).toUpperCase().slice(0, 100);
        if (!name) continue;
        let catId = categoriaIdPorNombre.get(name);
        if (!catId) {
            categoriasNuevas.push([name, COMPANY_ID]);
        } else {
            categoriasOmitidas++;
        }
        categoriaIdPorLinea.set(norm(l.id), { name, catId });
    }
    await runSection('categorias', async () => {
        const n = await batchInsert('INSERT INTO product_categories (name, company_id) VALUES ?', categoriasNuevas);
        return { insertados: n, omitidos: categoriasOmitidas };
    });
    if (categoriasNuevas.length > 0) {
        const [dstCategoriasFinal] = await dst.query('SELECT id, name FROM product_categories WHERE company_id = ?', [COMPANY_ID]);
        for (const c of dstCategoriasFinal) categoriaIdPorNombre.set(norm(c.name).toUpperCase(), c.id);
    }
    for (const [, ref] of categoriaIdPorLinea) ref.catId = categoriaIdPorNombre.get(ref.name);
    summary.categorias = { nuevas: categoriasNuevas.length, omitidas: categoriasOmitidas };

    const [dstProductosPrevios] = await dst.query('SELECT codigo FROM products WHERE company_id = ?', [COMPANY_ID]);
    const codigosUsados = new Set(dstProductosPrevios.map(p => norm(p.codigo)));
    const productosRefs = [];
    let productosYaExistian = 0;
    const productosNuevosRows = [];
    for (const p of srcProductos) {
        let codigo = norm(p.codigo) || '';
        if (codigo === '') codigo = 'SIN-CODIGO';
        let finalCodigo = codigo;
        let sufijo = 2;
        while (codigosUsados.has(finalCodigo)) {
            finalCodigo = `${codigo}-${sufijo++}`;
        }
        codigosUsados.add(finalCodigo);
        productosRefs.push({
            srcId: p.id,
            finalCodigo,
            precio: precioPorProducto.has(p.id) ? precioPorProducto.get(p.id) : null,
            esNuevo: true
        });
        productosNuevosRows.push([
            COMPANY_ID,
            finalCodigo.slice(0, 50),
            trunc(p.descripcion, 255) || finalCodigo,
            trunc(p.descripcion, 255),
            trunc(p.barra, 50),
            num(p.es_exento) ? 1 : 0,
            num(p.costo),
            '59',
            'bien',
            categoriaIdPorLinea.get(norm(p.id_linea))?.catId ?? null,
            proveedorIdPorCodigo.get(norm(p.cod_proveedor)) ?? null,
            'activo',
            1
        ]);
    }
    await runSection('productos', async () => {
        const n = await batchInsert(
            'INSERT INTO products (company_id, codigo, nombre, descripcion, codigo_barra, es_exento, costo, unidad_medida, tipo_item, category_id, provider_id, status, afecta_inventario) VALUES ?',
            productosNuevosRows
        );
        return { insertados: n };
    });
    summary.productos = { copiados: productosNuevosRows.length };

    const [dstProductosTodos] = await dst.query('SELECT id, codigo FROM products WHERE company_id = ?', [COMPANY_ID]);
    const productoIdPorCodigo = new Map(dstProductosTodos.map(p => [norm(p.codigo), p.id]));
    const vinculos = [];
    const preciosFilas = [];
    let sinPrecio = 0;
    for (const ref of productosRefs) {
        const productId = productoIdPorCodigo.get(ref.finalCodigo);
        if (!productId) { sinPrecio++; continue; }
        vinculos.push([productId, BRANCH_ID]);
        if (ref.precio !== null) {
            preciosFilas.push([productId, BRANCH_ID, ref.precio]);
        } else {
            sinPrecio++;
        }
    }

    await runSection('vinculo sucursal', async () => {
        const n = await batchInsert('INSERT IGNORE INTO product_branch (product_id, branch_id) VALUES ?', vinculos);
        return { filas: vinculos.length, afectadas: n };
    });

    await runSection('precios tipo 02', async () => {
        const n = await batchInsert(
            'INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES ? ON DUPLICATE KEY UPDATE precio_unitario = VALUES(precio_unitario)',
            preciosFilas
        );
        return { filas: preciosFilas.length, afectadas: n };
    });
    summary.precios = { aplicados: preciosFilas.length, sin_precio: sinPrecio };

    const [[vc]] = await dst.query('SELECT COUNT(*) c FROM products WHERE company_id = ?', [COMPANY_ID]);
    const [[vpb]] = await dst.query('SELECT COUNT(*) c FROM product_branch pb JOIN products p ON p.id = pb.product_id WHERE p.company_id = ? AND pb.branch_id = ?', [COMPANY_ID, BRANCH_ID]);
    const [[vpr]] = await dst.query('SELECT COUNT(*) c FROM product_branch_prices pbp JOIN products p ON p.id = pbp.product_id WHERE p.company_id = ? AND pbp.branch_id = ?', [COMPANY_ID, BRANCH_ID]);
    const [[vprov]] = await dst.query('SELECT COUNT(*) c FROM providers WHERE company_id = ?', [COMPANY_ID]);
    const [[vcli]] = await dst.query('SELECT COUNT(*) c FROM customers WHERE company_id = ?', [COMPANY_ID]);
    const [[vcat]] = await dst.query('SELECT COUNT(*) c FROM product_categories WHERE company_id = ?', [COMPANY_ID]);

    console.log('\n===== RESUMEN =====');
    console.log(JSON.stringify(summary, null, 2));
    console.log('\n===== VERIFICACION DESTINO (empresa', COMPANY_ID, ') =====');
    console.log(JSON.stringify({
        products: vc.c,
        product_branch_sucursal: vpb.c,
        precios_sucursal: vpr.c,
        providers: vprov.c,
        customers: vcli.c,
        categorias: vcat.c
    }, null, 2));

    await src.end();
    await dst.end();
    console.log('\nCopia completada');
}

main().catch(e => {
    console.error('ERROR FATAL:', e.message);
    process.exit(1);
});
