const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v309: Backfilling missing NITs in providers table ---');

    // 1. Fill providers.nit from other records with the same NRC that have a valid NIT
    const [resNrc] = await pool.query(`
        UPDATE providers p1
        JOIN (
            SELECT nrc, MIN(nit) as found_nit
            FROM providers
            WHERE nit IS NOT NULL AND TRIM(nit) != '' AND nrc IS NOT NULL AND TRIM(nrc) != ''
            GROUP BY nrc
        ) p2 ON p1.nrc = p2.nrc
        SET p1.nit = p2.found_nit
        WHERE (p1.nit IS NULL OR TRIM(p1.nit) = '')
    `);
    console.log(`✅ Backfilled NIT from matching NRC: ${resNrc.affectedRows} provider rows updated.`);

    // 2. Fill providers.nit from numero_documento if formatted as a 14-digit NIT
    const [resNumDoc] = await pool.query(`
        UPDATE providers
        SET nit = numero_documento
        WHERE (nit IS NULL OR TRIM(nit) = '')
          AND numero_documento REGEXP '^[0-9]{4}-?[0-9]{6}-?[0-9]{3}-?[0-9]{1}$'
    `);
    console.log(`✅ Backfilled NIT from numero_documento: ${resNumDoc.affectedRows} provider rows updated.`);

    console.log('--- Migration v309 completed successfully ---');
}

module.exports = migrate;
