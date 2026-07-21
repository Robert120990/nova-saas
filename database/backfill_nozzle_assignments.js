require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const mysql = require('mysql2/promise');

(async () => {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        const [closeouts] = await pool.query(`
            SELECT c.id, c.company_id, c.branch_id
            FROM gas_station_closeouts c
            WHERE EXISTS (
                SELECT 1 FROM gas_station_closeout_despachadores d WHERE d.closeout_id = c.id
            )
        `);

        let totalInserted = 0;
        let totalSkipped = 0;

        for (const c of closeouts) {
            // Despachadores que NO tienen asignaciones en este closeout
            const [missing] = await pool.query(`
                SELECT d.despachador_id
                FROM gas_station_closeout_despachadores d
                WHERE d.closeout_id = ?
                AND NOT EXISTS (
                    SELECT 1 FROM gas_station_closeout_despachador_nozzles n
                    WHERE n.closeout_id = d.closeout_id AND n.despachador_id = d.despachador_id
                )
            `, [c.id]);

            if (missing.length === 0) {
                totalSkipped++;
                continue;
            }

            const missingIds = missing.map(m => m.despachador_id);

            const [liveAssignments] = await pool.query(
                `SELECT despachador_id, nozzle_id FROM gas_station_despachador_nozzles
                 WHERE company_id = ? AND despachador_id IN (?)
                 AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))`,
                [c.company_id, missingIds, c.branch_id || null, c.branch_id || null]
            );

            if (liveAssignments.length === 0) {
                console.log(`Closeout ${c.id}: ${missing.length} despachador(es) sin asignaciones en live table`);
                continue;
            }

            for (const a of liveAssignments) {
                await pool.query(
                    `INSERT INTO gas_station_closeout_despachador_nozzles (closeout_id, despachador_id, nozzle_id)
                     VALUES (?, ?, ?)`,
                    [c.id, a.despachador_id, a.nozzle_id]
                );
                totalInserted++;
            }

            console.log(`Closeout ${c.id}: inserted ${liveAssignments.length} assignments for ${missing.length} despachador(es) faltantes`);
        }

        console.log(`\nDone. Inserted ${totalInserted} assignments across ${closeouts.length} closeouts (${totalSkipped} already complete).`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
})();
