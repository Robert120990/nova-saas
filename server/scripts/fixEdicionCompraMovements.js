const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'sysadmin',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_sistema_saas',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    decimalNumbers: true
});

// Corrección de movimientos fantasma de EDICION_COMPRA.
// El flujo anterior insertaba un movimiento EDICION_COMPRA con la cantidad NUEVA sin
// eliminar el movimiento COMPRA original, inflando el ledger. Aquí se registra el
// DELTA real por producto/documento: delta=0 se elimina el movimiento fantasma,
// delta!=0 se convierte en un movimiento de ajuste con la magnitud del delta.
// Regla general (soporta múltiples ediciones): para cada par (documento_id, product_id, branch_id),
// prev_effect = efecto del movimiento COMPRA original; por cada EDICION en orden: delta = effect_edicion - prev_effect.

const sign = (mov) => (mov.tipo_movimiento === 'ENTRADA' ? mov.cantidad : -mov.cantidad);

async function main() {
    const connection = await pool.getConnection();
    const log = [];
    try {
        await connection.beginTransaction();

        const [ediciones] = await connection.query(`
            SELECT id, company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, documento_id, created_at
            FROM inventory_movements
            WHERE tipo_documento = 'EDICION_COMPRA'
            ORDER BY documento_id, product_id, branch_id, id
        `);
        console.log(`EDICION_COMPRA encontradas: ${ediciones.length}`);

        for (const ed of ediciones) {
            const [originals] = await connection.query(
                `SELECT id, tipo_movimiento, cantidad, created_at
                 FROM inventory_movements
                 WHERE documento_id = ? AND product_id = ? AND branch_id = ? AND tipo_documento = 'COMPRA'
                 ORDER BY id`,
                [ed.documento_id, ed.product_id, ed.branch_id]
            );
            const prevEffect = originals.length > 0 ? sign(originals[originals.length - 1]) : 0;
            const edEffect = sign(ed);
            const delta = edEffect - prevEffect;

            if (delta === 0) {
                await connection.query('DELETE FROM inventory_movements WHERE id = ?', [ed.id]);
                log.push({ action: 'DELETE', id: ed.id, documento_id: ed.documento_id, product_id: ed.product_id, branch_id: ed.branch_id, antes: edEffect, delta: 0 });
                console.log(`DELETE  id=${ed.id} doc=${ed.documento_id} prod=${ed.product_id} (delta 0, fantasma)`);
            } else {
                const nuevoTipo = delta > 0 ? 'ENTRADA' : 'SALIDA';
                const nuevaCantidad = Math.abs(delta);
                await connection.query(
                    'UPDATE inventory_movements SET tipo_movimiento = ?, cantidad = ? WHERE id = ?',
                    [nuevoTipo, nuevaCantidad, ed.id]
                );
                log.push({ action: 'UPDATE', id: ed.id, documento_id: ed.documento_id, product_id: ed.product_id, branch_id: ed.branch_id, antes: edEffect, delta, nuevoTipo, nuevaCantidad });
                console.log(`UPDATE  id=${ed.id} doc=${ed.documento_id} prod=${ed.product_id}: efecto ${edEffect} -> delta ${delta} (${nuevoTipo} ${nuevaCantidad})`);
            }
        }

        const [inv] = await connection.query(`
            SELECT i.product_id, i.branch_id, i.stock,
                COALESCE(l.ledger, 0) AS ledger
            FROM inventory i
            LEFT JOIN (
                SELECT product_id, branch_id,
                    SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END) AS ledger
                FROM inventory_movements
                GROUP BY product_id, branch_id
            ) l ON l.product_id = i.product_id AND l.branch_id = i.branch_id
            WHERE ROUND(COALESCE(l.ledger, 0) - i.stock, 6) <> 0
        `);
        console.log(`\nDivergencias ledger vs inventory.stock restantes: ${inv.length}`);
        if (inv.length > 0) console.log(JSON.stringify(inv, null, 2));

        await connection.commit();
        console.log('\nTransacción confirmada. Resumen:');
        console.log(JSON.stringify(log, null, 2));
        process.exit(0);
    } catch (error) {
        await connection.rollback();
        console.error('Corrección fallida, rollback aplicado:', error.message);
        process.exit(1);
    } finally {
        connection.release();
    }
}

main();
