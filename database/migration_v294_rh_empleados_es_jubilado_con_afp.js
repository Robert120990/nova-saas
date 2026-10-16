const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v294] Agregando columna es_jubilado_con_afp a tabla rh_empleados...');

    const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'rh_empleados' 
          AND COLUMN_NAME = 'es_jubilado_con_afp'
    `);

    if (columns.length === 0) {
        await pool.query(`
            ALTER TABLE rh_empleados 
            ADD COLUMN es_jubilado_con_afp TINYINT(1) NOT NULL DEFAULT 0 
                COMMENT '1 si es jubilado pero cotiza AFP (no ISSS, si AFP, renta 10%), 0 si no'
            AFTER es_jubilado
        `);
        console.log('[Migration v294] Columna es_jubilado_con_afp agregada con éxito a rh_empleados.');
    } else {
        console.log('[Migration v294] Columna es_jubilado_con_afp ya existe en rh_empleados.');
    }
}

if (require.main === module) {
    up()
        .then(() => {
            console.log('[Migration v294] Completada con éxito.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration v294] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
