const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v233: Trazabilidad de Cubetas 30 LB y 32 LB ---');

        const [movCols] = await pool.query('DESCRIBE egg_returnable_movements');
        const movColNames = movCols.map(c => c.Field);

        if (!movColNames.includes('cubetas_30lb_qty')) {
            await pool.query('ALTER TABLE egg_returnable_movements ADD COLUMN cubetas_30lb_qty INT NOT NULL DEFAULT 0 AFTER cubetas_qty');
            console.log('  → Columna cubetas_30lb_qty agregada a egg_returnable_movements.');
        }

        if (!movColNames.includes('cubetas_32lb_qty')) {
            await pool.query('ALTER TABLE egg_returnable_movements ADD COLUMN cubetas_32lb_qty INT NOT NULL DEFAULT 0 AFTER cubetas_30lb_qty');
            console.log('  → Columna cubetas_32lb_qty agregada a egg_returnable_movements.');
        }

        // Backfill de movimientos existentes según descripción en sales_items o notas
        console.log('  → Clasificando movimientos existentes entre 30 LB y 32 LB...');
        const [existingMovements] = await pool.query(
            `SELECT id, sale_id, cubetas_qty, notes 
             FROM egg_returnable_movements 
             WHERE cubetas_30lb_qty = 0 AND cubetas_32lb_qty = 0 AND cubetas_qty > 0`
        );

        let count30 = 0;
        let count32 = 0;

        for (const mov of existingMovements) {
            let is32 = false;
            let is30 = false;

            if (mov.notes && /32\s*lb/i.test(mov.notes)) {
                is32 = true;
            } else if (mov.notes && /30\s*lb/i.test(mov.notes)) {
                is30 = true;
            }

            if (mov.sale_id && !is32 && !is30) {
                const [items] = await pool.query(
                    'SELECT descripcion FROM sales_items WHERE sale_id = ?',
                    [mov.sale_id]
                );
                for (const it of items) {
                    if (/32\s*lb/i.test(it.descripcion || '')) is32 = true;
                    if (/30\s*lb/i.test(it.descripcion || '')) is30 = true;
                }
            }

            if (is32) {
                await pool.query(
                    'UPDATE egg_returnable_movements SET cubetas_32lb_qty = ? WHERE id = ?',
                    [mov.cubetas_qty, mov.id]
                );
                count32++;
            } else {
                // Por defecto la presentación estándar de cubeta es 30 LB
                await pool.query(
                    'UPDATE egg_returnable_movements SET cubetas_30lb_qty = ? WHERE id = ?',
                    [mov.cubetas_qty, mov.id]
                );
                count30++;
            }
        }

        console.log(`  → Clasificados: ${count30} movimientos como 30 LB, ${count32} como 32 LB.`);
        console.log('--- Migración v233 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v233:', error);
        process.exit(1);
    }
}

runMigration();
