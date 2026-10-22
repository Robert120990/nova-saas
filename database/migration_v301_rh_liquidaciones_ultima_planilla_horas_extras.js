const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v301] Verificando columnas pago_ultima_planilla y pago_horas_extras en rh_planilla_liquidaciones...');

    const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'rh_planilla_liquidaciones' 
          AND COLUMN_NAME IN ('pago_ultima_planilla', 'pago_horas_extras')
    `);

    const existingColumns = columns.map(c => c.COLUMN_NAME);

    if (!existingColumns.includes('pago_ultima_planilla')) {
        await pool.query(`
            ALTER TABLE rh_planilla_liquidaciones 
            ADD COLUMN pago_ultima_planilla DECIMAL(10,2) NOT NULL DEFAULT 0.00 
                COMMENT 'Monto por pago de última planilla pendiente'
            AFTER pago_ultimos_dias
        `);
        console.log('[Migration v301] Columna pago_ultima_planilla agregada con éxito.');
    } else {
        console.log('[Migration v301] Columna pago_ultima_planilla ya existe.');
    }

    if (!existingColumns.includes('pago_horas_extras')) {
        await pool.query(`
            ALTER TABLE rh_planilla_liquidaciones 
            ADD COLUMN pago_horas_extras DECIMAL(10,2) NOT NULL DEFAULT 0.00 
                COMMENT 'Monto por remuneración de horas extras laboradas'
            AFTER pago_ultima_planilla
        `);
        console.log('[Migration v301] Columna pago_horas_extras agregada con éxito.');
    } else {
        console.log('[Migration v301] Columna pago_horas_extras ya existe.');
    }
}

if (require.main === module) {
    up()
        .then(() => {
            console.log('[Migration v301] Completada con éxito.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration v301] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
