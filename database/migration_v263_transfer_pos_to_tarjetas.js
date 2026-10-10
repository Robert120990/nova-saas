const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(pool) {
    console.log('[Migration v263] Iniciando traslado de registros POS/Tarjetas desde remesas y gastos...');

    // 1. Obtener gastos a trasladar
    const [expRows] = await pool.query(`
        SELECT id, shift_id, description, amount, created_at 
        FROM pos_shift_expenses 
        WHERE (UPPER(description) LIKE '%POS%' OR UPPER(description) LIKE '%TARJETA%' OR UPPER(description) LIKE '%CREDOMATIC%' OR UPPER(description) LIKE '%VOUCHER%')
          AND UPPER(description) NOT LIKE '%PUNTOS%'
    `);
    console.log(`[Migration v263] Gastos encontrados para trasladar: ${expRows.length}`);

    // 2. Obtener remesas a trasladar
    const [remRows] = await pool.query(`
        SELECT id, shift_id, description, amount, created_at 
        FROM pos_shift_remesas 
        WHERE (UPPER(description) LIKE '%POS%' OR UPPER(description) LIKE '%TARJETA%' OR UPPER(description) LIKE '%CREDOMATIC%' OR UPPER(description) LIKE '%VOUCHER%' OR UPPER(TRIM(description)) = 'BAC')
    `);
    console.log(`[Migration v263] Remesas encontradas para trasladar: ${remRows.length}`);

    const affectedShiftIds = [...new Set([...expRows.map(e => e.shift_id), ...remRows.map(r => r.shift_id)])];
    console.log(`[Migration v263] Turnos afectados: ${affectedShiftIds.length}`);

    // 3. Insertar en pos_shift_tarjetas
    const allItemsToInsert = [
        ...expRows.map(e => [e.shift_id, '', '', e.description.trim(), e.amount, e.created_at]),
        ...remRows.map(r => [r.shift_id, '', '', r.description.trim(), r.amount, r.created_at])
    ];

    if (allItemsToInsert.length > 0) {
        await pool.query(`
            INSERT INTO pos_shift_tarjetas (shift_id, num_tarjeta, num_autorizacion, description, amount, created_at)
            VALUES ?
        `, [allItemsToInsert]);
        console.log(`[Migration v263] ${allItemsToInsert.length} registros insertados en pos_shift_tarjetas.`);
    }

    // 4. Eliminar de pos_shift_expenses y pos_shift_remesas
    if (expRows.length > 0) {
        const expIds = expRows.map(e => e.id);
        await pool.query(`DELETE FROM pos_shift_expenses WHERE id IN (?)`, [expIds]);
        console.log(`[Migration v263] ${expRows.length} registros eliminados de pos_shift_expenses.`);
    }

    if (remRows.length > 0) {
        const remIds = remRows.map(r => r.id);
        await pool.query(`DELETE FROM pos_shift_remesas WHERE id IN (?)`, [remIds]);
        console.log(`[Migration v263] ${remRows.length} registros eliminados de pos_shift_remesas.`);
    }

    // 5. Actualizar pos_shifts consolidado
    if (affectedShiftIds.length > 0) {
        await pool.query(`
            UPDATE pos_shifts s
            LEFT JOIN (
                SELECT shift_id, COALESCE(SUM(amount), 0) as total FROM pos_shift_expenses GROUP BY shift_id
            ) e ON e.shift_id = s.id
            LEFT JOIN (
                SELECT shift_id, COALESCE(SUM(amount), 0) as total FROM pos_shift_remesas GROUP BY shift_id
            ) r ON r.shift_id = s.id
            LEFT JOIN (
                SELECT shift_id, COALESCE(SUM(amount), 0) as total FROM pos_shift_tarjetas GROUP BY shift_id
            ) t ON t.shift_id = s.id
            SET 
                s.total_expenses = COALESCE(e.total, 0),
                s.total_remesas = COALESCE(r.total, 0),
                s.total_tarjetas = COALESCE(t.total, 0)
            WHERE s.id IN (?)
        `, [affectedShiftIds]);
        console.log(`[Migration v263] ${affectedShiftIds.length} turnos actualizados con nuevos totales.`);
    }

    console.log('[Migration v263] Migración v263 completada exitosamente.');
}

if (require.main === module) {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    migrate(pool)
        .then(() => pool.end())
        .catch((err) => {
            console.error('[Migration v263] Error:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { migrate };
