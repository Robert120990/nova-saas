const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../server/.env' });

async function fixPurchases() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        decimalNumbers: true
    });

    try {
        console.log('Iniciando corrección de IVA y retención en compras...');
        await connection.beginTransaction();

        // 1. Mostrar estado previo de los registros a corregir
        const targetIds = [126, 125, 98, 26, 20];
        const [beforeRows] = await connection.query(`
            SELECT id, numero_documento, total_gravada, iva, retencion, monto_total 
            FROM purchase_headers 
            WHERE id IN (?)
            ORDER BY id DESC
        `, [targetIds]);
        console.log('\n--- ESTADO ANTES DE LA CORRECCIÓN ---');
        console.table(beforeRows);

        // 2. Aplicar corrección individual por registro
        const fixes = [
            { id: 126, iva: 23.29, retencion: 0, monto_total: 202.42 },
            { id: 125, iva: 68.61, retencion: 0, monto_total: 596.41 },
            { id: 98,  iva: 57.03, retencion: 0, monto_total: 495.71 },
            { id: 26,  iva: 68.01, retencion: 0, monto_total: 591.17 },
            { id: 20,  iva: 129.30, retencion: 0, monto_total: 1123.89 }
        ];

        for (const f of fixes) {
            await connection.query(`
                UPDATE purchase_headers 
                SET iva = ?, retencion = ?, monto_total = ?
                WHERE id = ?
            `, [f.iva, f.retencion, f.monto_total, f.id]);
        }

        // 3. Mostrar estado posterior a la corrección
        const [afterRows] = await connection.query(`
            SELECT id, numero_documento, total_gravada, iva, retencion, monto_total 
            FROM purchase_headers 
            WHERE id IN (?)
            ORDER BY id DESC
        `, [targetIds]);
        console.log('\n--- ESTADO DESPUÉS DE LA CORRECCIÓN ---');
        console.table(afterRows);

        // 4. Verificación general en TODAS las compras
        const [auditCheck] = await connection.query(`
            SELECT id, numero_documento, total_gravada, iva, 
                   ROUND(total_gravada * 0.13, 2) as iva_calc,
                   ROUND(total_gravada * 0.13 - iva, 2) as diff_iva
            FROM purchase_headers 
            WHERE tipo_documento_id = '03'
            HAVING ABS(diff_iva) > 0.05
        `);
        console.log(`\nVerificación final: Compras con discrepancia de IVA: ${auditCheck.length}`);

        const [retCheck] = await connection.query(`
            SELECT id, numero_documento, retencion 
            FROM purchase_headers 
            WHERE retencion > 0 AND retencion <= 0.05
        `);
        console.log(`Verificación final: Compras con retención accidental (<= 0.05): ${retCheck.length}`);

        if (auditCheck.length === 0 && retCheck.length === 0) {
            await connection.commit();
            console.log('\n¡TODAS LAS COMPRAS FUERON CORREGIDAS CON ÉXITO! Transacción confirmada.');
        } else {
            await connection.rollback();
            console.error('\nAtención: La verificación falló, se revirtió la transacción.');
        }

    } catch (error) {
        await connection.rollback();
        console.error('Error durante la corrección:', error);
    } finally {
        await connection.end();
    }
}

fixPurchases();
