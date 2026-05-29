/**
 * Safe Control Number Service (v3 - Normativa V2.0)
 * Implementation using dte_correlativos table with SELECT FOR UPDATE concurrency lock.
 * El correlativo de 15 dígitos es único por empresa, tipo DTE y año (NO por punto de venta).
 * Formato: DTE-{tipoDte}-{letter}{codEstable}P{codPuntoVenta}-{correlativo15}
 */

const pool = require('../../config/db');

function getEstablecimientoLetter(tipoEstablecimiento) {
    switch (tipoEstablecimiento) {
        case '02': return 'M'; // Casa Matriz
        default: return 'S';   // Sucursal, Bodega, etc.
    }
}

/**
 * Generates a safe control number for DTE.
 * @param {string} tipoDte DTE type code (e.g. '01')
 * @param {number} companyId Company ID
 * @param {string} tipoEstablecimiento Branch establishment type ('01'=Sucursal, '02'=Matriz)
 * @param {string} codEstableMH MH-assigned establishment code (branch.codigo_mh or branch.codigo)
 * @param {string} codPuntoVentaMH MH-assigned point of sale code (points_of_sale.codigo)
 * @returns {Promise<Object>} Object with numero_control, serie, correlativo and anio
 */
async function generateControlNumber(tipoDte, companyId, tipoEstablecimiento, codEstableMH, codPuntoVentaMH) {
    const connection = await pool.getConnection();
    const year = new Date().getFullYear();
    const letter = getEstablecimientoLetter(tipoEstablecimiento);
    const estabCode = String(codEstableMH || '1').replace(/^[^\d]*/, '').slice(-3).padStart(3, '0');
    const posCode = String(codPuntoVentaMH || '1').replace(/^[^\d]*/, '').slice(-3).padStart(3, '0');
    const serie = `${letter}${estabCode}P${posCode}`;

    try {
        await connection.beginTransaction();

        // Correlativo único por empresa, tipo DTE y año (NO por sucursal/POS)
        const [rows] = await connection.query(
            'SELECT current_number FROM dte_correlativos WHERE company_id = ? AND tipo_dte = ? AND year = ? FOR UPDATE',
            [companyId, tipoDte, year]
        );

        let nextCorrelativo;

        if (rows.length === 0) {
            nextCorrelativo = 1;
            await connection.query(
                'INSERT INTO dte_correlativos (company_id, branch_id, tipo_dte, year, current_number) VALUES (?, ?, ?, ?, ?)',
                [companyId, 0, tipoDte, year, nextCorrelativo]
            );
        } else {
            nextCorrelativo = rows[0].current_number + 1;
            await connection.query(
                'UPDATE dte_correlativos SET current_number = ? WHERE company_id = ? AND tipo_dte = ? AND year = ?',
                [nextCorrelativo, companyId, tipoDte, year]
            );
        }

        await connection.commit();

        const correlativoStr = nextCorrelativo.toString().padStart(15, '0');
        const numero_control = `DTE-${tipoDte}-${serie}-${correlativoStr}`;

        console.log(`[SafeControl] Generated: ${numero_control} for Company: ${companyId}, Year: ${year}`);

        return {
            numero_control,
            serie,
            correlativo: nextCorrelativo,
            anio: year
        };

    } catch (error) {
        await connection.rollback();
        console.error('[SafeControl] Concurrency Error:', error.message);
        throw new Error(`Error fatal al generar correlativo DTE (Concurrencia): ${error.message}`);
    } finally {
        connection.release();
    }
}

module.exports = { generateControlNumber };
