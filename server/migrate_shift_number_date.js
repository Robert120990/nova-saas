const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./src/config/db');

async function migrate() {
    console.log('--- INICIANDO MIGRACIÓN: shift_date y shift_number ---');
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Agregar columna shift_date
        console.log('1. Agregando columna shift_date...');
        try {
            await connection.query(`
                ALTER TABLE pos_shifts 
                ADD COLUMN shift_date DATE DEFAULT NULL AFTER id
            `);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('   (La columna shift_date ya existe)');
            } else {
                throw e;
            }
        }

        // 2. Agregar columna shift_number
        console.log('2. Agregando columna shift_number...');
        try {
            await connection.query(`
                ALTER TABLE pos_shifts 
                ADD COLUMN shift_number INT DEFAULT NULL AFTER shift_date
            `);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('   (La columna shift_number ya existe)');
            } else {
                throw e;
            }
        }

        // 3. Backfill: shift_date = DATE(start_time) para registros existentes
        console.log('3. Backfill shift_date desde start_time...');
        const [result] = await connection.query(`
            UPDATE pos_shifts SET shift_date = DATE(start_time) WHERE shift_date IS NULL
        `);
        console.log(`   Registros actualizados: ${result.affectedRows}`);

        // 4. Backfill: asignar números correlativos por fecha para registros existentes
        console.log('4. Backfill shift_number correlativo por fecha...');
        const [dates] = await connection.query(`
            SELECT DISTINCT shift_date, company_id FROM pos_shifts WHERE shift_number IS NULL ORDER BY shift_date
        `);
        for (const d of dates) {
            const [shifts] = await connection.query(`
                SELECT id FROM pos_shifts 
                WHERE shift_date = ? AND company_id = ? 
                ORDER BY start_time ASC
            `, [d.shift_date, d.company_id]);
            for (let i = 0; i < shifts.length; i++) {
                await connection.query(`
                    UPDATE pos_shifts SET shift_number = ? WHERE id = ?
                `, [i + 1, shifts[i].id]);
            }
            console.log(`   Fecha ${d.shift_date}: ${shifts.length} turnos numerados`);
        }

        await connection.commit();
        console.log('--- MIGRACIÓN COMPLETADA EXITOSAMENTE ---');
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('--- ERROR EN LA MIGRACIÓN ---');
        console.error(error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

migrate();
