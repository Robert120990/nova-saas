const pool = require('../server/src/config/db');

async function up() {
    console.log('[v318] Agregando columna omitir_marcador_digital en rh_empleados...');
    const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_empleados' AND COLUMN_NAME = 'omitir_marcador_digital'`
    );
    if (cols.length === 0) {
        await pool.query(
            `ALTER TABLE rh_empleados
             ADD COLUMN omitir_marcador_digital TINYINT(1) NOT NULL DEFAULT 0
             COMMENT 'Omitir empleado del control de marcador digital (fuera de planta / sin horario fijo)'
             AFTER exento_horas_extras`
        );
        console.log('[v318] Columna omitir_marcador_digital creada correctamente.');
    } else {
        console.log('[v318] Columna omitir_marcador_digital ya existe, omitiendo ALTER.');
    }
}

module.exports = { up };
