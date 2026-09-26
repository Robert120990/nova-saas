const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/config/db');
const { getRrsPool } = require('../src/config/rrsDb');
const { syncAllAdvancesToRrs } = require('../src/services/gasAdvanceRrs.service');

async function run() {
    try {
        console.log('========================================================');
        console.log('SINCRONIZANDO ANTICIPOS DE TODAS LAS EMPRESAS HACIA RRS');
        console.log('========================================================\n');

        // Check connection to SaaS DB and RRS DB
        const [companies] = await pool.query('SELECT id, razon_social FROM companies');
        console.log(`Empresas encontradas en Nova-SaaS: ${companies.length}`);

        const rrs = getRrsPool();
        const [rrsEmpresas] = await rrs.query('SELECT id, nombre FROM empresas');
        console.log(`Empresas encontradas en RRS: ${rrsEmpresas.length}\n`);

        const summary = await syncAllAdvancesToRrs();

        console.log('--------------------------------------------------------');
        console.log('RESUMEN DE SINCRONIZACIÓN:');
        console.log(`Total anticipos evaluados: ${summary.total}`);
        console.log(`Anticipos sincronizados con éxito a cabecera_cxc: ${summary.synced}`);
        console.log(`Anticipos omitidos (sin empresa RRS asignada): ${summary.skipped}`);
        console.log(`Errores: ${summary.errors}`);
        console.log('--------------------------------------------------------\n');

        // Inspect synchronized rows in RRS cabecera_cxc
        const [cxcRows] = await rrs.query(`
            SELECT id, id_empresa, id_cliente, codigo, nombre, fecha, documento, monto_total, fec_copia
            FROM cabecera_cxc
            WHERE id LIKE '%-ADV-%'
            ORDER BY fecha DESC, id DESC
        `);

        console.log(`Registros de anticipos en RRS cabecera_cxc actualmente (${cxcRows.length}):`);
        console.table(cxcRows.map(r => ({
            id: r.id,
            empresa: r.id_empresa,
            codigo_nrc: r.codigo,
            cliente: r.nombre.substring(0, 30),
            fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
            doc: r.documento,
            monto: r.monto_total
        })));

        process.exit(0);
    } catch (error) {
        console.error('Error fatal durante la sincronización:', error);
        process.exit(1);
    }
}

run();
