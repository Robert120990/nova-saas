/**
 * Migración de lubricantes de db_sipe_chalchuapa (empresa 006 = RAUL RAFAEL SOSA CASTELLANOS)
 * hacia SaaS company_id=2, sucursal 3 "Shell Chalchuapa".
 *
 * Requisitos:
 * - Migrar los 63 productos de la categoría 'LUBRICANTES' (línea '02' en SIPE).
 * - Agregar prefijo 'L' a todos los códigos para evitar colisiones con códigos de otras sucursales.
 * - Crear y asignar la categoría 'LUBRICANTES' en company_id=2.
 * - Asignar permiso a sucursal 3 (product_branch).
 * - Asignar precio con IVA de pista/tienda a sucursal 3 (product_branch_prices).
 * - NO activar en ningún punto de venta (0 inserciones en product_pos).
 */

const mysql = require(require('path').join(__dirname, '../server/node_modules/mysql2/promise'));
const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const EXT = { host: 'localhost', user: 'sysadmin', password: 'QwErTy123', database: 'db_sipe_chalchuapa' };
const ID_EMPRESA = '006';
const COMPANY_ID = 2;
const BRANCH_ID = 3;
const PREFIX = 'L';
const CHUNK = 500;

const clean = (v) => {
    const s = String(v ?? '').trim();
    return s === '' || s === '-' ? '' : s;
};

async function runMigration() {
    console.log(`=== Migrando Lubricantes SIPE CHALCHUAPA (empresa ${ID_EMPRESA}) → SaaS (company_id=${COMPANY_ID}, branch_id=${BRANCH_ID}) ===\n`);

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
        // 1. Obtener candidatos de lubricantes (línea 02, no combustibles)
        const candidatos = await qe(
            `SELECT p.id, p.codigo, p.barra, p.descripcion, p.factor, p.id_unidades, p.es_exento,
                    p.precio_sugerido, p.costo, p.id_linea, p.id_sublinea, p.iva
             FROM productos p
             WHERE p.id_empresa = ? AND p.es_combustible = 0 AND p.id_linea = '02'
             ORDER BY p.codigo`,
            [ID_EMPRESA]
        );
        console.log(`1. Productos lubricantes encontrados en SIPE: ${candidatos.length}`);
        if (candidatos.length === 0) {
            console.log('No se encontraron productos en línea 02 para migrar.');
            return;
        }

        // 2. Precios de origen (tipo 02 -> 01 -> 03 -> precio_sugerido)
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

        // 3. Crear o asegurar categoría 'LUBRICANTES' en la empresa
        let [catRows] = await conn.query(
            'SELECT id FROM product_categories WHERE company_id = ? AND UPPER(name) = ?',
            [COMPANY_ID, 'LUBRICANTES']
        );
        let categoryId;
        if (catRows.length > 0) {
            categoryId = catRows[0].id;
            console.log(`2. Categoría LUBRICANTES ya existía con id: ${categoryId}`);
        } else {
            const [catRes] = await conn.query(
                'INSERT INTO product_categories (company_id, name, description) VALUES (?, ?, ?)',
                [COMPANY_ID, 'LUBRICANTES', 'Lubricantes y aceites de motor']
            );
            categoryId = catRes.insertId;
            console.log(`2. Categoría LUBRICANTES creada con id: ${categoryId}`);
        }

        // 4. Preparar datos a insertar
        const [existentesEnSaas] = await conn.query(
            'SELECT id, codigo FROM products WHERE company_id = ?',
            [COMPANY_ID]
        );
        const saasCodigos = new Map(existentesEnSaas.map(p => [p.codigo, p.id]));

        const nuevosProductos = [];
        const yaPermiso = new Set((await conn.query('SELECT product_id FROM product_branch WHERE branch_id = ?', [BRANCH_ID]))[0].map(r => r.product_id));
        const yaPrecio = new Set((await conn.query('SELECT product_id FROM product_branch_prices WHERE branch_id = ?', [BRANCH_ID]))[0].map(r => r.product_id));

        const permisos = [];
        const preciosRows = [];

        for (const p of candidatos) {
            const rawCodigo = clean(p.codigo);
            if (!rawCodigo) continue;

            const finalCodigo = `${PREFIX}${rawCodigo}`;
            const precio = precioDe(p);
            const nombre = clean(p.descripcion) || finalCodigo;

            let productId = saasCodigos.get(finalCodigo) || null;

            if (!productId) {
                nuevosProductos.push({
                    codigo: finalCodigo,
                    nombre,
                    barra: clean(p.barra) || null,
                    unidad: clean(p.id_unidades) || '59',
                    esExento: p.es_exento ? 1 : 0,
                    tipoOperacion: p.es_exento ? 2 : 1,
                    categoriaId: categoryId,
                    costo: parseFloat(p.costo) || 0,
                    precio
                });
            } else {
                if (!yaPermiso.has(productId)) { permisos.push(productId); yaPermiso.add(productId); }
                if (!yaPrecio.has(productId)) { preciosRows.push([productId, precio]); yaPrecio.add(productId); }
            }
        }

        console.log(`3. Productos a insertar: ${nuevosProductos.length}`);

        // 5. Insertar productos nuevos
        const PRODUCT_COLS = 'company_id, codigo, nombre, codigo_barra, descripcion, unidad_medida, tipo_item, provider_id, es_exento, tipo_operacion, tipo_combustible, category_id, status, afecta_inventario, costo, stock_minimo, permitir_existencia_negativa';
        for (let i = 0; i < nuevosProductos.length; i += CHUNK) {
            const chunk = nuevosProductos.slice(i, i + CHUNK);
            const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, \'bien\', NULL, ?, ?, 0, ?, \'activo\', 1, ?, 0, 1)').join(', ');
            const params = [];
            chunk.forEach(np => params.push(COMPANY_ID, np.codigo, np.nombre, np.barra, np.nombre, np.unidad, np.esExento, np.tipoOperacion, np.categoriaId, np.costo));
            const [res] = await conn.query(`INSERT INTO products (${PRODUCT_COLS}) VALUES ${placeholders}`, params);

            let firstId = res.insertId;
            chunk.forEach(np => {
                const currentId = firstId++;
                if (!yaPermiso.has(currentId)) { permisos.push(currentId); yaPermiso.add(currentId); }
                if (!yaPrecio.has(currentId)) { preciosRows.push([currentId, np.precio]); yaPrecio.add(currentId); }
            });
        }

        // 6. Insertar permisos en product_branch para branch 3
        console.log(`4. Permisos de sucursal a registrar: ${permisos.length}`);
        for (let i = 0; i < permisos.length; i += CHUNK) {
            const chunk = permisos.slice(i, i + CHUNK);
            const ph = chunk.map(() => '(?, ?)').join(', ');
            const params = [];
            chunk.forEach(pid => params.push(pid, BRANCH_ID));
            await conn.query(`INSERT INTO product_branch (product_id, branch_id) VALUES ${ph}`, params);
        }

        // 7. Insertar precios en product_branch_prices para branch 3
        console.log(`5. Precios de sucursal a registrar: ${preciosRows.length}`);
        for (let i = 0; i < preciosRows.length; i += CHUNK) {
            const chunk = preciosRows.slice(i, i + CHUNK);
            const ph = chunk.map(() => '(?, ?, ?)').join(', ');
            const params = [];
            chunk.forEach(([pid, precio]) => params.push(pid, BRANCH_ID, precio));
            await conn.query(`INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES ${ph}`, params);
        }

        // 8. Confirmar que NO se inserta nada en product_pos
        console.log('6. Validación POS: 0 registros agregados a product_pos (ningún punto de venta activado).');

        await conn.commit();

        // 9. Verificación posterior
        const creadosVerif = await qm(
            `SELECT p.id, p.codigo, p.nombre, pbp.precio_unitario,
                    (SELECT COUNT(*) FROM product_pos pos WHERE pos.product_id = p.id) as en_pos
             FROM products p
             JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
             JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
             WHERE p.company_id = ? AND p.category_id = ?
             ORDER BY p.codigo`,
            [BRANCH_ID, BRANCH_ID, COMPANY_ID, categoryId]
        );

        console.log('\n=== RESUMEN DE MIGRACIÓN ===');
        console.log(`- Total lubricantes registrados: ${creadosVerif.length}`);
        console.log(`- Total en product_branch (sucursal ${BRANCH_ID}): ${creadosVerif.length}`);
        console.log(`- Total con precio en product_branch_prices: ${creadosVerif.length}`);
        const conPOS = creadosVerif.filter(p => p.en_pos > 0);
        console.log(`- Total activos en POS: ${conPOS.length} (debe ser 0)`);
        console.log('\nMuestra de 5 productos migrados:');
        console.log(creadosVerif.slice(0, 5).map(p => ({
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            precio: p.precio_unitario,
            en_pos: p.en_pos
        })));

        console.log('\n✅ Migración de lubricantes ejecutada con éxito.');
    } catch (error) {
        await conn.rollback();
        console.error('❌ Error en migración de lubricantes:', error);
        process.exitCode = 1;
    } finally {
        conn.release();
        await ext.end();
        await main.end();
    }
}

runMigration();
