/**
 * Migración v155: Productos no combustibles/lubricantes de db_sipe_chalchuapa
 * (empresa 006 = RAUL RAFAEL SOSA CASTELLANOS) → SaaS company_id=2,
 * sucursal 3 "Shell Chalchuapa".
 *
 * - Producto ya existente (mismo codigo): solo se agrega el permiso de venta
 *   (product_branch) y el precio de la base de origen (product_branch_prices).
 * - Producto nuevo: se inserta completo (mismo mapeo que v148) + permiso + precio.
 * - Precio de origen: precios.precio_con_iva con id_tipo_precio '02' (TIENDA,
 *   activo para el punto T01 de la empresa 006). Fallback: '01' → '03' →
 *   productos.precio_sugerido.
 * - Categorías: se reutilizan por nombre (con alias para equivalencias
 *   semánticas como CHICLES→CHICHLES); solo se crean las realmente nuevas.
 * - Inserts por lotes (multi-row) para ejecución rápida y transaccional.
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const EXT = { host: 'localhost', user: 'sysadmin', password: 'QwErTy123', database: 'db_sipe_chalchuapa' };
const ID_EMPRESA = '006';
const COMPANY_ID = 2;
const BRANCH_ID = 3;
const CHUNK = 500;

const clean = (v) => {
    const s = String(v ?? '').trim();
    return s === '' || s === '-' ? '' : s;
};

// Equivalencias semánticas entre líneas del origen y categorías existentes del destino
const CATEGORIA_ALIAS = {
    'COMIDA': 'COMIDA PREPARADA',
    'COMIDA RAPIDA': 'COMIDA PREPARADA',
    'CHICLES': 'CHICHLES',
    'BATERIAS': 'BETERIAS',
    'AGUA': 'AGUAS',
    'PAN': 'PANADERIA',
    'PAN E-MARKET': 'PANADERIA',
    'LECHES Y CHOCOLATINAS': 'LACTEOS',
    'QUESO PARTIDO': 'LACTEOS',
    'NEVERIA & SARITAS': 'SORBETES Y HELADOS',
    'TARJETAS TELEFONICAS': 'RECARGAS',
    'PAQUETES MOVILES': 'RECARGAS',
    'TIENDA': null, // línea genérica → sin categoría
};

async function runMigration() {
    const ext = await mysql.createConnection(EXT);
    const main = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    const qe = async (sql, params = []) => { const [r] = await ext.query(sql, params); return r; };
    const qm = async (sql, params = []) => { const [r] = await main.query(sql, params); return r; };

    const conn = await main.getConnection();

    try {
        console.log(`Migrando productos SIPE CHALCHUAPA (id_empresa=${ID_EMPRESA}) → SaaS (company_id=${COMPANY_ID}, branch_id=${BRANCH_ID})...`);

        // 1. Candidatos: no combustibles ni lubricantes
        const candidatos = await qe(
            `SELECT p.id, p.codigo, p.barra, p.descripcion, p.factor, p.id_unidades, p.es_exento,
                    p.precio_sugerido, p.costo, p.id_linea, p.id_sublinea, p.iva
             FROM productos p
             WHERE p.id_empresa = ? AND p.es_combustible = 0
               AND p.id_linea NOT IN ('01','02')
               AND p.codigo NOT IN (SELECT codigo FROM lubricantes)
             ORDER BY p.codigo`,
            [ID_EMPRESA]
        );
        console.log(`Candidatos origen: ${candidatos.length}`);

        // 2. Precios de origen por producto (tipo 02 → 01 → 03 → sugerido)
        const preciosExt = await qe(
            'SELECT id_producto, id_tipo_precio, precio_con_iva FROM precios WHERE id_empresa = ?',
            [ID_EMPRESA]
        );
        const preciosPorProducto = new Map();
        for (const pr of preciosExt) {
            if (!preciosPorProducto.has(pr.id_producto)) preciosPorProducto.set(pr.id_producto, {});
            preciosPorProducto.get(pr.id_producto)[pr.id_tipo_precio] = parseFloat(pr.precio_con_iva) || 0;
        }
        const precioDe = (p) => {
            const mapa = preciosPorProducto.get(p.id) || {};
            if (mapa['02'] > 0) return mapa['02'];
            if (mapa['01'] > 0) return mapa['01'];
            if (mapa['03'] > 0) return mapa['03'];
            return parseFloat(p.precio_sugerido) || 0;
        };

        await conn.beginTransaction();

        // 3. Categorías: reutilizar por nombre (con alias), crear solo las nuevas
        const lineasUsadas = [...new Set(candidatos.map(p => clean(p.id_linea)).filter(Boolean))];
        const lineasExt = await qe('SELECT id, descripcion FROM tipos_linea WHERE id_empresa = ?', [ID_EMPRESA]);
        const lineaNombre = new Map(lineasExt.map(l => [l.id, l.descripcion]));
        const categoriasExistentes = await conn.query('SELECT id, name FROM product_categories WHERE company_id = ?', [COMPANY_ID]);
        const idPorNombreCat = new Map(categoriasExistentes[0].map(c => [c.name.toUpperCase(), c.id]));
        const categoriaPorLinea = new Map();
        const categoriasNuevas = [];
        for (const linea of lineasUsadas) {
            const nombre = (lineaNombre.get(linea) || '').trim();
            if (!nombre) continue;
            const destino = Object.prototype.hasOwnProperty.call(CATEGORIA_ALIAS, nombre) ? CATEGORIA_ALIAS[nombre] : nombre;
            if (!destino) { categoriaPorLinea.set(linea, null); continue; }
            const existingId = idPorNombreCat.get(destino.toUpperCase());
            if (existingId) { categoriaPorLinea.set(linea, existingId); continue; }
            const res = await conn.query('INSERT INTO product_categories (company_id, name, description) VALUES (?, ?, ?)', [COMPANY_ID, destino, '']);
            const newId = res[0].insertId;
            idPorNombreCat.set(destino.toUpperCase(), newId);
            categoriaPorLinea.set(linea, newId);
            categoriasNuevas.push(newId);
        }
        console.log(`Categorías creadas: ${categoriasNuevas.length} (mapeadas: ${categoriaPorLinea.size}/${lineasUsadas.length})`);

        // 4. Estado actual en destino
        const productosDestino = await conn.query('SELECT id, codigo FROM products WHERE company_id = ?', [COMPANY_ID]);
        const idPorCodigo = new Map(productosDestino[0].map(p => [p.codigo, p.id]));
        const yaPermiso = new Set((await conn.query('SELECT product_id FROM product_branch WHERE branch_id = ?', [BRANCH_ID]))[0].map(r => r.product_id));
        const yaPrecio = new Set((await conn.query('SELECT product_id FROM product_branch_prices WHERE branch_id = ?', [BRANCH_ID]))[0].map(r => r.product_id));

        // 5. Preparar datos
        const nuevosProductos = [];   // { fila: [...], categoriaId }
        const permisos = [];          // [productId, ...]
        const preciosRows = [];       // [productId, precio]
        let existentes = 0, sinCodigo = 0;

        for (const p of candidatos) {
            const codigo = clean(p.codigo);
            if (!codigo) { sinCodigo++; continue; }
            const precio = precioDe(p);
            let productId = idPorCodigo.get(codigo) || null;

            if (!productId) {
                const nombre = clean(p.descripcion) || codigo;
                nuevosProductos.push({
                    codigo,
                    nombre,
                    barra: clean(p.barra) || null,
                    unidad: clean(p.id_unidades) || '59',
                    esExento: p.es_exento ? 1 : 0,
                    tipoOperacion: p.es_exento ? 2 : 1,
                    categoriaId: categoriaPorLinea.get(clean(p.id_linea)) || null,
                    costo: parseFloat(p.costo) || 0,
                    precio
                });
            } else {
                existentes++;
            }

            if (productId) {
                if (!yaPermiso.has(productId)) { permisos.push(productId); yaPermiso.add(productId); }
                if (!yaPrecio.has(productId)) { preciosRows.push([productId, precio]); yaPrecio.add(productId); }
            }
        }

        // 6. Insertar productos nuevos por lotes y enlazar permiso+precio
        const PRODUCT_COLS = 'company_id, codigo, nombre, codigo_barra, descripcion, unidad_medida, tipo_item, provider_id, es_exento, tipo_operacion, tipo_combustible, category_id, status, afecta_inventario, costo, stock_minimo, permitir_existencia_negativa';
        for (let i = 0; i < nuevosProductos.length; i += CHUNK) {
            const chunk = nuevosProductos.slice(i, i + CHUNK);
            const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, \'bien\', NULL, ?, ?, 0, ?, \'activo\', 1, ?, 0, 1)').join(', ');
            const params = [];
            chunk.forEach(np => params.push(COMPANY_ID, np.codigo, np.nombre, np.barra, np.nombre, np.unidad, np.esExento, np.tipoOperacion, np.categoriaId, np.costo));
            const res = await conn.query(`INSERT INTO products (${PRODUCT_COLS}) VALUES ${placeholders}`, params);
            let firstId = res[0].insertId;
            chunk.forEach(np => {
                if (!yaPermiso.has(firstId)) { permisos.push(firstId); yaPermiso.add(firstId); }
                if (!yaPrecio.has(firstId)) { preciosRows.push([firstId, np.precio]); yaPrecio.add(firstId); }
                idPorCodigo.set(np.codigo, firstId);
                firstId++;
            });
        }
        const creados = nuevosProductos.length;
        console.log(`Productos nuevos: ${creados}, ya existían: ${existentes}, sin código: ${sinCodigo}`);

        // 7. Insertar permisos y precios por lotes
        for (let i = 0; i < permisos.length; i += CHUNK) {
            const chunk = permisos.slice(i, i + CHUNK);
            const ph = chunk.map(() => '(?, ?)').join(', ');
            const params = [];
            chunk.forEach(pid => params.push(pid, BRANCH_ID));
            await conn.query(`INSERT INTO product_branch (product_id, branch_id) VALUES ${ph}`, params);
        }
        for (let i = 0; i < preciosRows.length; i += CHUNK) {
            const chunk = preciosRows.slice(i, i + CHUNK);
            const ph = chunk.map(() => '(?, ?, ?)').join(', ');
            const params = [];
            chunk.forEach(([pid, precio]) => params.push(pid, BRANCH_ID, precio));
            await conn.query(`INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES ${ph}`, params);
        }
        console.log(`Permisos branch 3: ${permisos.length}, precios branch 3: ${preciosRows.length}`);

        await conn.commit();

        const resumen = await qm(
            `SELECT (SELECT COUNT(*) FROM products WHERE company_id = ?) productos,
                    (SELECT COUNT(*) FROM product_branch WHERE branch_id = ?) permisos_branch3,
                    (SELECT COUNT(*) FROM product_branch_prices WHERE branch_id = ?) precios_branch3,
                    (SELECT COUNT(*) FROM product_categories WHERE company_id = ?) categorias`,
            [COMPANY_ID, BRANCH_ID, BRANCH_ID, COMPANY_ID]
        );
        console.log('\n== RESUMEN (company_id=2, branch_id=3) ==');
        console.log(JSON.stringify(resumen[0]));
        console.log('\nMigración completa');
    } catch (error) {
        await conn.rollback();
        console.error('Migración falló:', error);
        process.exitCode = 1;
    } finally {
        conn.release();
        await ext.end();
        await main.end();
    }
}

runMigration();
