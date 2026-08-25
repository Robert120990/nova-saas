const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const EXT = { host: '207.244.251.167', user: 'sysadmin', password: 'QwErTy123', database: 'db_sipe_andelsa' };
const ID_EMPRESA = '001';
const COMPANY_ID = 9;
const BRANCH_ID = 5;

const clean = (v) => {
    const s = String(v ?? '').trim();
    return s === '' || s === '-' ? '' : s;
};
const norm = (v) => clean(v).toUpperCase();
const orNull = (v) => clean(v) || null;

function resolveDoc(row) {
    const nit = clean(row.nit);
    const nrc = clean(row.nrc);
    const dui = clean(row.dui);
    const t = clean(row.id_tipo_doc);
    if (t === '13' && dui) return { tipo_documento: 'DUI', numero_documento: dui };
    if (t === '36' && nit) return { tipo_documento: 'NIT', numero_documento: nit };
    if (nit) return { tipo_documento: 'NIT', numero_documento: nit };
    if (dui) return { tipo_documento: 'DUI', numero_documento: dui };
    if (nrc) return { tipo_documento: 'NRC', numero_documento: nrc };
    return { tipo_documento: null, numero_documento: null };
}

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

    try {
        console.log(`Migrando catálogos SIPE ANDELSA (id_empresa=${ID_EMPRESA}) → SaaS (company_id=${COMPANY_ID}, branch_id=${BRANCH_ID})...`);

        const productosExt = await qe('SELECT * FROM productos WHERE id_empresa = ?', [ID_EMPRESA]);
        const proveedoresExt = await qe('SELECT * FROM proveedores WHERE id_empresa = ?', [ID_EMPRESA]);
        const clientesExt = await qe('SELECT * FROM clientes WHERE id_empresa = ? ORDER BY id', [ID_EMPRESA]);
        const preciosExt = await qe(
            `SELECT pr.id_producto, pr.precio_con_iva FROM precios pr
             JOIN productos p ON p.id = pr.id_producto
             WHERE pr.id_tipo_precio = '01' AND p.id_empresa = ?`, [ID_EMPRESA]);
        console.log(`Origen: ${productosExt.length} productos, ${proveedoresExt.length} proveedores, ${clientesExt.length} clientes, ${preciosExt.length} precios (tipo 01)`);

        const precioPorProducto = new Map(preciosExt.map(p => [p.id_producto, parseFloat(p.precio_con_iva) || 0]));

        console.log('\n[1/4] Categorías...');
        const lineasUsadas = [...new Set(productosExt.map(p => clean(p.id_linea)).filter(Boolean))];
        const lineasExt = await qe('SELECT id, descripcion FROM tipos_linea WHERE id_empresa = ?', [ID_EMPRESA]);
        const lineaNombre = new Map(lineasExt.map(l => [l.id, l.descripcion]));
        const categoriaPorLinea = new Map();
        let catsCreadas = 0;
        for (const linea of lineasUsadas) {
            const nombre = (lineaNombre.get(linea) || '').trim();
            if (!nombre) continue;
            const existing = await qm('SELECT id FROM product_categories WHERE company_id = ? AND UPPER(name) = ?', [COMPANY_ID, nombre.toUpperCase()]);
            if (existing.length > 0) {
                categoriaPorLinea.set(linea, existing[0].id);
                continue;
            }
            const res = await qm('INSERT INTO product_categories (company_id, name, description) VALUES (?, ?, ?)', [COMPANY_ID, nombre, '']);
            categoriaPorLinea.set(linea, res.insertId);
            catsCreadas++;
        }
        console.log(`  Categorías creadas: ${catsCreadas} (usadas: ${categoriaPorLinea.size}/${lineasUsadas.length})`);

        console.log('\n[2/4] Proveedores...');
        const providerKey = (p) => [norm(p.nit), norm(p.nrc), norm(p.nombre)].join('|');
        const providerKeysExistentes = new Set(
            (await qm('SELECT nit, nrc, nombre FROM providers WHERE company_id = ?', [COMPANY_ID]))
                .map(p => [norm(p.nit), norm(p.nrc), norm(p.nombre)].join('|'))
        );
        const providerIdPorCodigo = new Map();
        let provCreados = 0, provSaltados = 0;
        for (const p of proveedoresExt) {
            const key = providerKey(p);
            if (providerKeysExistentes.has(key)) { provSaltados++; continue; }
            const doc = resolveDoc(p);
            const res = await qm(
                `INSERT INTO providers (tipo_persona, pais, company_id, nit, nrc, nombre, nombre_comercial, direccion, telefono, correo,
                    numero_documento, codigo_actividad, municipio, distrito, tipo_documento, departamento, tipo_contribuyente,
                    es_gran_contribuyente, exento_iva, es_credito, dias_credito)
                 VALUES (?, '222', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '01', ?, ?, 'Otro', 0, ?, ?, 0)`,
                [orNull(p.id_tipo_per), COMPANY_ID, orNull(p.nit), orNull(p.nrc), clean(p.nombre) || 'SIN NOMBRE', orNull(p.nombre_comercial),
                 orNull(p.direccion), orNull(p.telefono), orNull(p.correo), doc.numero_documento, orNull(p.id_giro),
                 orNull(p.id_municipio), doc.tipo_documento, orNull(p.id_depto), p.es_exento ? 1 : 0, p.con_credito ? 1 : 0]
            );
            providerKeysExistentes.add(key);
            providerIdPorCodigo.set(clean(p.codigo), res.insertId);
            provCreados++;
        }
        console.log(`  Proveedores creados: ${provCreados}, ya existían: ${provSaltados}`);

        const providersDb = await qm('SELECT id, nit, nrc, nombre FROM providers WHERE company_id = ?', [COMPANY_ID]);
        const providerIdPorKey = new Map(providersDb.map(p => [providerKey(p), p.id]));
        for (const p of proveedoresExt) {
            const cod = clean(p.codigo);
            if (!cod || cod === 'S/N' || providerIdPorCodigo.has(cod)) continue;
            const idPorKey = providerIdPorKey.get(providerKey(p));
            if (idPorKey) providerIdPorCodigo.set(cod, idPorKey);
        }

        console.log('\n[3/4] Clientes (principal + sucursales)...');
        const customerKey = (c) => [norm(c.nit), norm(c.nrc), norm(c.nombre)].join('|');
        const customerKeysExistentes = new Set(
            (await qm('SELECT nit, nrc, nombre FROM customers WHERE company_id = ?', [COMPANY_ID]))
                .map(c => [norm(c.nit), norm(c.nrc), norm(c.nombre)].join('|'))
        );
        const gruposNit = new Map();
        for (const c of clientesExt) {
            const nit = norm(c.nit);
            if (!nit) continue;
            if (!gruposNit.has(nit)) gruposNit.set(nit, []);
            gruposNit.get(nit).push(c);
        }
        const nitsProcesados = new Set();
        const clavesSueltasProcesadas = new Set();
        let cliCreados = 0, cliSaltados = 0, sucCreadas = 0, sucSaltadas = 0;

        const insertarCliente = async (c) => {
            const doc = resolveDoc(c);
            const res = await qm(
                `INSERT INTO customers (company_id, tipo_documento, numero_documento, nit, nrc, nombre, nombre_comercial, codigo_actividad,
                    direccion, departamento, municipio, distrito, pais, telefono, correo, tipo_persona, condicion_fiscal, exento_iva,
                    aplica_fovial, aplica_cotrans, tipo_operacion, es_credito, es_anticipado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '01', ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, 0)`,
                [COMPANY_ID, doc.tipo_documento, doc.numero_documento, orNull(c.nit), orNull(c.nrc), clean(c.nombre) || 'SIN NOMBRE',
                 orNull(c.nombre_comercial), orNull(c.id_giro), orNull(c.direccion), orNull(c.id_depto), orNull(c.id_municipio),
                 orNull(c.id_pais) || '222', orNull(c.telefono), orNull(c.correo), orNull(c.id_tipo_per),
                 c.es_exento ? 'exento IVA' : 'contribuyente', c.es_exento ? 1 : 0,
                 c.es_exento_fovial ? 0 : 1, c.es_exento_fovial ? 0 : 1, c.con_credito ? 1 : 0]
            );
            return res.insertId;
        };

        const crearSucursales = async (customerId, grupo, principal) => {
            for (const suc of grupo) {
                if (suc === principal) continue;
                const nombreSuc = clean(suc.codigo) || clean(suc.nombre_comercial) || 'Sucursal';
                const dup = await qm('SELECT id FROM customer_branches WHERE customer_id = ? AND UPPER(nombre) = ?', [customerId, nombreSuc.toUpperCase()]);
                if (dup.length > 0) { sucSaltadas++; continue; }
                await qm(
                    `INSERT INTO customer_branches (customer_id, company_id, nombre, departamento, municipio, distrito, direccion, telefono)
                     VALUES (?, ?, ?, ?, ?, '01', ?, ?)`,
                    [customerId, COMPANY_ID, nombreSuc, orNull(suc.id_depto), orNull(suc.id_municipio), orNull(suc.direccion), orNull(suc.telefono)]
                );
                sucCreadas++;
            }
        };

        for (const c of clientesExt) {
            const nit = norm(c.nit);
            if (nit) {
                if (nitsProcesados.has(nit)) continue;
                nitsProcesados.add(nit);
                const grupo = gruposNit.get(nit);
                const principal = grupo.length > 1 ? (grupo.find(g => norm(g.codigo) === norm(g.nrc) && clean(g.nrc)) || grupo[0]) : grupo[0];
                let customerId = (await qm('SELECT id FROM customers WHERE company_id = ? AND nit = ? ORDER BY id LIMIT 1', [COMPANY_ID, nit]))[0]?.id;
                if (customerId) {
                    cliSaltados++;
                } else {
                    customerId = await insertarCliente(principal);
                    customerKeysExistentes.add(customerKey(principal));
                    cliCreados++;
                }
                if (grupo.length > 1) await crearSucursales(customerId, grupo, principal);
            } else {
                const key = customerKey(c);
                if (clavesSueltasProcesadas.has(key)) continue;
                clavesSueltasProcesadas.add(key);
                if (customerKeysExistentes.has(key)) { cliSaltados++; continue; }
                await insertarCliente(c);
                customerKeysExistentes.add(key);
                cliCreados++;
            }
        }
        console.log(`  Clientes creados: ${cliCreados}, ya existían: ${cliSaltados}, sucursales creadas: ${sucCreadas}, sucursales ya existían: ${sucSaltadas}`);

        console.log('\n[4/4] Productos + precios + sucursal...');
        const branchExiste = await qm('SELECT id FROM branches WHERE id = ? AND company_id = ?', [BRANCH_ID, COMPANY_ID]);
        if (branchExiste.length === 0) throw new Error(`La sucursal ${BRANCH_ID} no existe para la empresa ${COMPANY_ID}`);
        let prodCreados = 0, prodSaltados = 0, preciosCreados = 0;
        for (const p of productosExt) {
            const codigo = clean(p.codigo);
            if (!codigo) { prodSaltados++; continue; }
            const existing = await qm('SELECT id FROM products WHERE company_id = ? AND codigo = ?', [COMPANY_ID, codigo]);
            if (existing.length > 0) {
                const provId = providerIdPorCodigo.get(clean(p.cod_proveedor)) || null;
                if (provId) await qm('UPDATE products SET provider_id = ? WHERE id = ? AND provider_id IS NULL', [provId, existing[0].id]);
                prodSaltados++;
                continue;
            }
            const precio = precioPorProducto.has(p.id) ? precioPorProducto.get(p.id) : (parseFloat(p.precio_sugerido) || 0);
            const res = await qm(
                `INSERT INTO products (company_id, codigo, nombre, codigo_barra, descripcion, unidad_medida, tipo_item, provider_id,
                    es_exento, tipo_operacion, tipo_combustible, category_id, status, afecta_inventario, costo, stock_minimo,
                    permitir_existencia_negativa)
                 VALUES (?, ?, ?, ?, ?, ?, 'bien', ?, ?, ?, 0, ?, 'activo', 1, ?, 0, 1)`,
                [COMPANY_ID, codigo, clean(p.descripcion) || codigo, orNull(p.barra), clean(p.descripcion) || codigo,
                 orNull(p.id_unidades), providerIdPorCodigo.get(clean(p.cod_proveedor)) || null,
                 p.es_exento ? 1 : 0, p.es_exento ? 2 : 1, categoriaPorLinea.get(clean(p.id_linea)) || null,
                 parseFloat(p.costo) || 0]
            );
            const productId = res.insertId;
            await qm('INSERT INTO product_branch (product_id, branch_id) VALUES (?, ?)', [productId, BRANCH_ID]);
            await qm('INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES (?, ?, ?)', [productId, BRANCH_ID, precio]);
            preciosCreados++;
            prodCreados++;
        }
        console.log(`  Productos creados: ${prodCreados}, ya existían: ${prodSaltados}, precios creados: ${preciosCreados}`);

        const resumen = await qm('SELECT (SELECT COUNT(*) FROM products WHERE company_id = ?) productos, (SELECT COUNT(*) FROM providers WHERE company_id = ?) proveedores, (SELECT COUNT(*) FROM customers WHERE company_id = ?) clientes, (SELECT COUNT(*) FROM customer_branches WHERE company_id = ?) sucursales_cliente, (SELECT COUNT(*) FROM product_categories WHERE company_id = ?) categorias', [COMPANY_ID, COMPANY_ID, COMPANY_ID, COMPANY_ID, COMPANY_ID]);
        console.log('\n== RESUMEN FINAL (company_id=9) ==');
        console.log(JSON.stringify(resumen[0]));
        console.log('\nMigración completa');
    } catch (error) {
        console.error('Migración falló:', error);
        process.exitCode = 1;
    } finally {
        await ext.end();
        await main.end();
    }
}

runMigration();
