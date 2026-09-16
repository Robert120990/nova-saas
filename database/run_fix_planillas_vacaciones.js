const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

/**
 * Fix: Poner a cero todas las planillas ABIERTAS de empleados
 * marcados como en_vacaciones = 1 o incapacitado = 1.
 *
 * Afecta:
 *   - rh_planilla_detalles: valor_base = 0, valor_ingresado = 0
 *   - rh_planillas (cabecera): dias_trabajados = 0, total_percepciones = 0,
 *                               total_deducciones = 0, descuento_isss = 0,
 *                               descuento_afp = 0, descuento_renta = 0,
 *                               monto_recibir = 0
 *
 * Solo toca planillas en estado != 'pagada' (períodos abiertos).
 */
async function run() {
    console.log('Using DB_HOST:', process.env.DB_HOST);
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        // 1. Buscar planillas abiertas de empleados en vacaciones o incapacitados
        const [planillas] = await pool.query(`
            SELECT p.id, p.empleado_id, p.estado, p.periodo_anio, p.periodo_mes, p.quincena,
                   e.nombres, e.apellidos, e.en_vacaciones, e.incapacitado
            FROM rh_planillas p
            JOIN rh_empleados e ON p.empleado_id = e.id
            WHERE p.estado != 'pagada'
              AND (e.en_vacaciones = 1 OR e.incapacitado = 1)
            ORDER BY p.company_id, p.periodo_anio DESC, p.periodo_mes DESC
        `);

        console.log(`\nEncontradas ${planillas.length} planilla(s) abiertas de empleados en vacaciones/incapacidad:`);

        if (planillas.length === 0) {
            console.log('No hay planillas que corregir.');
            return;
        }

        // Mostrar resumen de lo que se va a corregir
        for (const p of planillas) {
            const estado = p.en_vacaciones ? 'VACACIÓN' : 'INCAPACITADO';
            console.log(`  - ID ${p.id} | ${p.nombres} ${p.apellidos} [${estado}] | ${p.periodo_mes}/${p.periodo_anio} ${p.quincena}`);
        }

        const ids = planillas.map(p => p.id);

        // 2. Poner a cero TODOS los detalles (percepciones y deducciones)
        const [detResult] = await pool.query(`
            UPDATE rh_planilla_detalles
            SET valor_base = 0, valor_ingresado = 0
            WHERE planilla_id IN (?)
        `, [ids]);

        console.log(`\nDetalles actualizados: ${detResult.affectedRows} filas`);

        // 3. Poner a cero la cabecera de cada planilla
        const [cabResult] = await pool.query(`
            UPDATE rh_planillas
            SET dias_trabajados   = 0,
                total_percepciones = 0,
                total_deducciones  = 0,
                descuento_isss     = 0,
                descuento_afp      = 0,
                descuento_renta    = 0,
                monto_recibir      = 0
            WHERE id IN (?)
        `, [ids]);

        console.log(`Cabeceras actualizadas: ${cabResult.affectedRows} filas`);
        console.log(`\n✓ Fix completado. ${planillas.length} planilla(s) puestas a cero.`);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
