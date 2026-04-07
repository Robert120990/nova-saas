/**
 * Safe Control Number Service (v2)
 * Implementation using dte_correlativos table with SELECT FOR UPDATE concurrency lock.
 */

const pool = require('../../config/db');

/**
 * Generates a safe control number for DTE.
 * @param {string} tipoDte DTE type code (e.g. '01')
 * @param {number} companyId Company ID
 * @param {number} branchId Branch ID
 * @param {string} posCode Point of Sale code (e.g. '001')
 * @returns {Promise<Object>} Object with numero_control, serie, correlativo and anio
 */
async function generateControlNumber(tipoDte, companyId, branchId, posCode) {
    const connection = await pool.getConnection();
    const year = new Date().getFullYear();
    const cleanPosCode = posCode.padStart(3, '0');
    const serie = `S001P${cleanPosCode}`;

    try {
        // STEP 2: Use Transactions
        await connection.beginTransaction();

        // Lock the correlativo row using SELECT FOR UPDATE
        const [rows] = await connection.query(
            'SELECT current_number FROM dte_correlativos WHERE company_id = ? AND branch_id = ? AND tipo_dte = ? AND year = ? FOR UPDATE',
            [companyId, branchId, tipoDte, year]
        );

        let nextCorrelativo;

        if (rows.length === 0) {
            // STEP 4: Reset every year (if no record for this year, start at 1)
            nextCorrelativo = 1;
            await connection.query(
                'INSERT INTO dte_correlativos (company_id, branch_id, tipo_dte, year, current_number) VALUES (?, ?, ?, ?, ?)',
                [companyId, branchId, tipoDte, year, nextCorrelativo]
            );
        } else {
            // Increment existing correlativo
            nextCorrelativo = rows[0].current_number + 1;
            await connection.query(
                'UPDATE dte_correlativos SET current_number = ? WHERE company_id = ? AND branch_id = ? AND tipo_dte = ? AND year = ?',
                [nextCorrelativo, companyId, branchId, tipoDte, year]
            );
        }

        await connection.commit();

        // STEP 3: Build Control Number Format
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
