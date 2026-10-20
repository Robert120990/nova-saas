const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v300] Agregando columna procuraduria a tabla rh_planilla_aguinaldos...');

    const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'rh_planilla_aguinaldos' 
          AND COLUMN_NAME = 'procuraduria'
    `);

    if (columns.length === 0) {
        await pool.query(`
            ALTER TABLE rh_planilla_aguinaldos 
            ADD COLUMN procuraduria DECIMAL(12,2) NOT NULL DEFAULT 0.00 
                COMMENT 'Retención adicional 30% PGR sobre aguinaldo (Decreto Legislativo N° 140)'
            AFTER renta
        `);
        console.log('[Migration v300] Columna procuraduria agregada con éxito a rh_planilla_aguinaldos.');
    } else {
        console.log('[Migration v300] Columna procuraduria ya existe en rh_planilla_aguinaldos.');
    }

    // Actualizar registros existentes en rh_planilla_aguinaldos para empleados con descuento activo de Procuraduría
    const [updated] = await pool.query(`
        UPDATE rh_planilla_aguinaldos pa
        JOIN (
            SELECT DISTINCT ed.company_id, ed.empleado_id
            FROM rh_empleado_descuentos ed
            JOIN rh_descuentos_programados dp ON ed.descuento_id = dp.id
            LEFT JOIN rh_cuentas_planillas cp ON dp.cuenta_id = cp.id
            WHERE ed.activo = 1
              AND (ed.cuotas_restantes IS NULL OR ed.cuotas_restantes > 0)
              AND (
                  UPPER(dp.descripcion) LIKE '%PROCURADUR%'
                  OR UPPER(dp.descripcion) LIKE '%PGR%'
                  OR UPPER(dp.codigo) = 'PGR'
                  OR UPPER(COALESCE(cp.descripcion, '')) LIKE '%PROCURADUR%'
                  OR UPPER(COALESCE(cp.descripcion, '')) LIKE '%PGR%'
              )
        ) pgr ON pa.company_id = pgr.company_id AND pa.empleado_id = pgr.empleado_id
        SET pa.procuraduria = ROUND(pa.aguinaldo_calculado * 0.30, 2),
            pa.monto_recibir = ROUND(GREATEST(0, pa.aguinaldo_calculado - pa.renta - ROUND(pa.aguinaldo_calculado * 0.30, 2)), 2)
    `);
    console.log(`[Migration v300] Registros de aguinaldo actualizados con retención 30% PGR: ${updated.affectedRows}`);
}

if (require.main === module) {
    up()
        .then(() => {
            console.log('[Migration v300] Completada con éxito.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration v300] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
