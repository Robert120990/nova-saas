const mysql = require('mysql2/promise');
require('dotenv').config();

const SOURCE_CONFIG = {
    host: 'localhost',
    user: 'sysadmin',
    password: 'QwErTy123',
    database: 'db_sipe_sanmartin',
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    decimalNumbers: true
};

const TARGET_POOL = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    decimalNumbers: true
});

const COMPANY_ID = 1;
const BATCH_SIZE = 500;

function cleanStr(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    return s === '' || s === '0' || s === '-' ? null : s;
}

function toBool(val) {
    if (val === null || val === undefined) return 0;
    const n = Number(val);
    return n > 0 ? 1 : 0;
}

function mapDocumentType(sourceDoc, dui, nit) {
    const tipoDoc = String(sourceDoc || '').trim();
    const hasDui = dui && String(dui).trim() !== '' && String(dui).trim() !== '-';
    const hasNit = nit && String(nit).trim() !== '' && String(nit).trim() !== '-'
        && String(nit).trim() !== '000000000000000' && String(nit).trim() !== '0';
    const isDuiFormat = hasDui && /^\d{8}-\d{1}$/.test(String(dui).trim());

    if (tipoDoc === '13') return 'DUI';
    if (tipoDoc === '36') return 'NIT';
    if (tipoDoc === '37') return 'NIT';
    if (tipoDoc === '4' || tipoDoc === '2') return 'DUI';

    if (isDuiFormat) return 'DUI';
    if (hasNit) return 'NIT';

    return null;
}

function mapPersonType(tipo, idTipoPer) {
    const t = String(tipo || '').trim();
    const p = String(idTipoPer || '').trim();
    if (p === '2' || t === '2') return '2';
    if (p === '1' || t === '1') return '1';
    if (t === '4') return '1';
    return '1';
}

function mapNumberDocument(dui, nit, docType) {
    if (docType === 'DUI') return cleanStr(dui);
    return null;
}

async function migrate() {
    let sourceConn;
    try {
        console.log('Conectando a base origen (localhost/db_sipe_sanmartin)...');
        sourceConn = await mysql.createConnection(SOURCE_CONFIG);

        console.log('Conectando a base destino...');
        const targetConn = TARGET_POOL;

        console.log('Cargando NIT/NRC existentes en destino para deteccion de duplicados...');
        const [existingRows] = await targetConn.execute(`
            SELECT nit, nrc FROM customers WHERE company_id = ?
        `, [COMPANY_ID]);
        const existingSet = new Set();
        existingRows.forEach(r => {
            if (r.nit) existingSet.add(`nit:${r.nit}`);
            if (r.nrc) existingSet.add(`nrc:${r.nrc}`);
        });
        console.log(`  ${existingRows.length} registros existentes cargados`);

        console.log('Leyendo clientes de origen...');
        const [rows] = await sourceConn.execute(`
            SELECT
                MIN(c.id) as id,
                c.codigo,
                c.nombre,
                c.nombre_comercial,
                c.direccion,
                c.id_depto,
                c.id_municipio,
                c.telefono,
                c.nrc,
                c.nit,
                c.dui,
                c.giro,
                c.id_giro,
                c.tipo,
                c.id_tipo_per,
                c.es_exento,
                c.es_exento_fovial,
                c.es_exento_cotrans,
                c.con_credito,
                c.id_pais,
                c.id_tipo_doc,
                c.id_empresa,
                c.correo as correo_directo,
                MAX(cc.correo) as correo_extra
            FROM clientes c
            LEFT JOIN clientes_correos cc ON cc.cod_cliente = c.codigo
            GROUP BY c.codigo
            ORDER BY c.codigo
        `);

        const total = rows.length;
        console.log(`Total clientes a procesar (dup. eliminados): ${total}`);

        let inserted = 0;
        let skippedExisting = 0;
        let errors = [];
        let batch = [];

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const codigo = String(r.codigo || '').trim();

            if ((i + 1) % 500 === 0 || i === 0) {
                console.log(`Procesando ${i + 1}/${total}...`);
            }

            const nitClean = cleanStr(r.nit);
            const nrcClean = cleanStr(r.nrc);

            if (nitClean && existingSet.has(`nit:${nitClean}`)) {
                skippedExisting++;
                continue;
            }
            if (nrcClean && existingSet.has(`nrc:${nrcClean}`)) {
                skippedExisting++;
                continue;
            }

            const tipoPersona = mapPersonType(r.tipo, r.id_tipo_per);
            const docType = mapDocumentType(r.id_tipo_doc, r.dui, r.nit);
            const numDoc = mapNumberDocument(r.dui, r.nit, docType);

            const correo = cleanStr(r.correo_extra) || cleanStr(r.correo_directo) || null;
            const pais = cleanStr(r.id_pais) || '9579';
            const departamento = cleanStr(r.id_depto) || null;
            const municipio = cleanStr(r.id_municipio) || null;

            batch.push([
                COMPANY_ID,
                tipoPersona,
                cleanStr(r.nombre) || 'S/N',
                cleanStr(r.nombre_comercial),
                docType,
                numDoc,
                nitClean,
                nrcClean,
                cleanStr(r.id_giro),
                pais,
                departamento,
                municipio,
                '001',
                cleanStr(r.direccion),
                cleanStr(r.telefono),
                correo,
                toBool(r.es_exento),
                toBool(r.es_exento_fovial),
                toBool(r.es_exento_cotrans),
                toBool(r.con_credito),
                'contribuyente',
                'local'
            ]);

            if (batch.length >= BATCH_SIZE) {
                try {
                    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
                    const flat = batch.flat();
                    await targetConn.execute(`
                        INSERT INTO customers (
                            company_id, tipo_persona, nombre, nombre_comercial,
                            tipo_documento, numero_documento, nit, nrc,
                            codigo_actividad, pais, departamento, municipio,
                            distrito, direccion, telefono, correo,
                            exento_iva, aplica_fovial, aplica_cotrans,
                            es_credito, condicion_fiscal, tipo_operacion
                        ) VALUES ${placeholders}
                    `, flat);
                    inserted += batch.length;
                } catch (err) {
                    for (const b of batch) {
                        errors.push({ codigo, nombre: b[2], error: err.message });
                    }
                    console.error(`Error en batch: ${err.message}`);
                }
                batch = [];
            }
        }

        if (batch.length > 0) {
            try {
                const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
                const flat = batch.flat();
                await targetConn.execute(`
                    INSERT INTO customers (
                        company_id, tipo_persona, nombre, nombre_comercial,
                        tipo_documento, numero_documento, nit, nrc,
                        codigo_actividad, pais, departamento, municipio,
                        distrito, direccion, telefono, correo,
                        exento_iva, aplica_fovial, aplica_cotrans,
                        es_credito, condicion_fiscal, tipo_operacion
                    ) VALUES ${placeholders}
                `, flat);
                inserted += batch.length;
            } catch (err) {
                for (const b of batch) {
                    errors.push({ codigo: '?', nombre: b[2], error: err.message });
                }
                console.error(`Error en batch final: ${err.message}`);
            }
        }

        console.log('\n========== RESUMEN DE MIGRACION ==========');
        console.log(`Total leidos:       ${total}`);
        console.log(`Insertados:         ${inserted}`);
        console.log(`Saltados (existentes por NIT/NRC): ${skippedExisting}`);
        console.log(`Errores:            ${errors.length}`);
        console.log('==========================================');

        if (errors.length > 0) {
            console.log('\nErrores:');
            const unique = new Set(errors.map(e => e.error));
            unique.forEach(u => console.log(`  - ${u}`));
        }

        process.exit(0);
    } catch (error) {
        console.error('Error fatal:', error);
        process.exit(1);
    } finally {
        if (sourceConn) await sourceConn.end();
        await TARGET_POOL.end();
    }
}

migrate();
