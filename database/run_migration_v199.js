const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

/**
 * Migration v199: Limpiar descuento_renta de planillas de primera quincena.
 * 
 * La renta ya no se aplica en la primera quincena (solo en la segunda,
 * usando la tabla mensual). Todas las planillas de primera quincena
 * (abiertas y pagadas) deben tener descuento_renta = 0, y sus totales
 * deben recalcularse en consecuencia.
 */
async function runMigration() {
    console.log('Using DB_HOST:', process.env.DB_HOST);
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Running migration v199: Limpiar renta de primera quincena...');

        // Buscar planillas de primera quincena que tengan descuento_renta > 0
        const [rows] = await pool.query(
            `SELECT id, total_percepciones, total_deducciones, descuento_renta, monto_recibir
             FROM rh_planillas
             WHERE quincena = 'primera' AND descuento_renta > 0`
        );

        console.log(`Encontradas ${rows.length} planilla(s) de primera quincena con renta > 0`);

        if (rows.length === 0) {
            console.log('No hay planillas que corregir. Migración completada.');
            return;
        }

        let actualizadas = 0;
        for (const row of rows) {
            const descRenta = parseFloat(row.descuento_renta || 0);
            const totalDed = parseFloat(row.total_deducciones || 0);
            const montoRecibir = parseFloat(row.monto_recibir || 0);

            // Quitar la renta de las deducciones totales
            const nuevaDed = Math.round((totalDed - descRenta) * 100) / 100;
            // Recalcular monto a recibir (monto_recibir = total_percepciones - total_deducciones)
            const nuevoMonto = Math.round((montoRecibir + descRenta) * 100) / 100;

            await pool.query(
                `UPDATE rh_planillas 
                 SET descuento_renta = 0,
                     total_deducciones = ?,
                     monto_recibir = ?
                 WHERE id = ?`,
                [nuevaDed, nuevoMonto, row.id]
            );
            actualizadas++;
        }

        console.log(`Migration v199 completada. ${actualizadas} planilla(s) de primera quincena corregidas.`);
    } catch (error) {
        console.error('Migration v199 failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
