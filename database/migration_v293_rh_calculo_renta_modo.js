const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v293] Agregando columna calculo_renta_modo a tabla rh_config...');

    const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'rh_config' 
          AND COLUMN_NAME = 'calculo_renta_modo'
    `);

    if (columns.length === 0) {
        await pool.query(`
            ALTER TABLE rh_config 
            ADD COLUMN calculo_renta_modo VARCHAR(30) NOT NULL DEFAULT 'segunda_quincena' 
            AFTER notario_departamento
        `);
        console.log('[Migration v293] Columna calculo_renta_modo agregada con éxito.');
    } else {
        console.log('[Migration v293] Columna calculo_renta_modo ya existe.');
    }
}

if (require.main === module) {
    up()
        .then(() => {
            console.log('[Migration v293] Completada con éxito.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration v293] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
