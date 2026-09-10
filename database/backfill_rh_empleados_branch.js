const pool = require('../server/src/config/db');

async function backfillBranches() {
    console.log('Backfilling branch_id for existing rh_empleados...');

    // 1. Assign casa matriz branch if available
    const [res1] = await pool.query(`
        UPDATE rh_empleados e
        JOIN (
            SELECT company_id, id AS branch_id
            FROM branches
            WHERE es_casa_matriz = 1
        ) b ON e.company_id = b.company_id
        SET e.branch_id = b.branch_id
        WHERE e.branch_id IS NULL
    `);
    console.log(`  → Assigned casa matriz branch to ${res1.affectedRows} employee(s).`);

    // 2. Fallback to first branch for any remaining employees without casa matriz
    const [res2] = await pool.query(`
        UPDATE rh_empleados e
        JOIN (
            SELECT company_id, MIN(id) AS branch_id
            FROM branches
            GROUP BY company_id
        ) b ON e.company_id = b.company_id
        SET e.branch_id = b.branch_id
        WHERE e.branch_id IS NULL
    `);
    console.log(`  → Fallback assigned branch to ${res2.affectedRows} employee(s).`);

    // Verify count of employees with and without branch
    const [[summary]] = await pool.query(`
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN branch_id IS NOT NULL THEN 1 ELSE 0 END) AS with_branch,
            SUM(CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END) AS without_branch
        FROM rh_empleados
    `);
    console.log('Summary:', summary);
    process.exit(0);
}

backfillBranches().catch(err => {
    console.error('Error backfilling branches:', err);
    process.exit(1);
});
