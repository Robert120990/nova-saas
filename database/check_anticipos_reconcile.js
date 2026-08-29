const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

/**
 * Reconciliación de saldo de anticipos de cliente.
 *
 * El CxC (estado de cuenta de anticipos) calcula el saldo en vivo como:
 *     saldo_cxc  = SUM(gas_station_advances.monto)
 *                  - SUM(gas_station_closeout_anticipos_despachados.monto)
 *
 * El cierre de lecturas lee el campo desnormalizado:
 *     saldo_cierre = SUM(gas_station_advances.monto_disponible)  (monto_disponible > 0)
 *
 * Por un bug en restoreAdvanceByFIFO (tope = monto_disponible en vez de
 * monto - monto_disponible), el monto_disponible puede haberse desviado.
 * Este script detecta los clientes donde ambas visiones difieren.
 *
 * Uso:
 *     node database/check_anticipos_reconcile.js            # solo reporta
 *     node database/check_anticipos_reconcile.js --fix      # corrige monto_disponible a saldo_cxc
 */
async function run() {
    const fix = process.argv.includes('--fix');
    const pool = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });

    const [rows] = await pool.query(`
        SELECT
            ga.company_id,
            ga.cliente_id,
            COALESCE(c.nombre, ga.cliente_nombre) AS cliente_nombre,
            COALESCE(SUM(ga.monto), 0) - COALESCE((
                SELECT SUM(ad.monto)
                FROM gas_station_closeout_anticipos_despachados ad
                WHERE ad.cliente_id = ga.cliente_id
                AND EXISTS (
                    SELECT 1 FROM gas_station_closeouts cc
                    WHERE cc.id = ad.closeout_id AND cc.company_id = ga.company_id
                )
            ), 0) AS saldo_cxc,
            COALESCE(SUM(ga.monto_disponible), 0) AS saldo_cierre
        FROM gas_station_advances ga
        LEFT JOIN customers c ON ga.cliente_id = c.id
        GROUP BY ga.company_id, ga.cliente_id, c.nombre, ga.cliente_nombre
        HAVING ROUND(saldo_cxc, 2) <> ROUND(saldo_cierre, 2)
        ORDER BY ROUND(ABS(saldo_cxc - saldo_cierre), 2) DESC
    `);

    if (rows.length === 0) {
        console.log('✅ No hay discrepancias: saldo CxC == saldo cierre para todos los clientes.');
        await pool.end();
        return;
    }

    console.log(`Encontradas ${rows.length} discrepancias:\n`);
    console.log('company_id | cliente_id | cliente_nombre | saldo_cxc | saldo_cierre | diferencia');
    for (const r of rows) {
        const diff = (parseFloat(r.saldo_cxc) - parseFloat(r.saldo_cierre)).toFixed(2);
        console.log(`${r.company_id} | ${r.cliente_id} | ${r.cliente_nombre} | ${r.saldo_cxc} | ${r.saldo_cierre} | ${diff}`);
    }

    if (fix) {
        console.log('\n--- CORRIGIENDO montos_disponibles ---');
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            for (const r of rows) {
                // Reajusta el monto_disponible del/los anticipo(s) más reciente(s)
                // hasta dejarlos alineados con el saldo que ve CxC.
                let diff = parseFloat(r.saldo_cxc) - parseFloat(r.saldo_cierre);
                const [advances] = await connection.query(
                    `SELECT id, monto, monto_disponible
                     FROM gas_station_advances
                     WHERE company_id = ? AND cliente_id = ?
                     ORDER BY fecha DESC, id DESC`,
                    [r.company_id, r.cliente_id]
                );

                for (const adv of advances) {
                    if (Math.abs(diff) <= 0.005) break;
                    const maxRestore = parseFloat(adv.monto) - parseFloat(adv.monto_disponible);
                    let adjust;
                    if (diff > 0) {
                        adjust = Math.min(diff, maxRestore);
                    } else {
                        adjust = -Math.min(-diff, parseFloat(adv.monto_disponible));
                    }
                    await connection.query(
                        `UPDATE gas_station_advances SET monto_disponible = monto_disponible + ? WHERE id = ?`,
                        [adjust, adv.id]
                    );
                    diff -= adjust;
                }

                if (Math.abs(diff) > 0.005) {
                    console.log(`   ⚠️ No fue posible ajustar por completo cliente ${r.cliente_id} (quedan ${diff.toFixed(2)} sin aplicar).`);
                } else {
                    console.log(`   ✅ Cliente ${r.cliente_id} ajustado a saldo CxC (${r.saldo_cxc})`);
                }
            }

            await connection.commit();
            console.log('\n--- CORRECCIÓN COMPLETADA ---');
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
