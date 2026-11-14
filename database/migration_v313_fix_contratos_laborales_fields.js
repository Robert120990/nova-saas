const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(externalPool) {
    const pool = externalPool || mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('[Migration v313] Normalizing contract fields and fixing orthography defaults in rh_contratos_laborales...');

        // 1. Fix column default typo on forma_pago
        await pool.query(`
            ALTER TABLE rh_contratos_laborales
                MODIFY COLUMN forma_pago VARCHAR(120) NULL DEFAULT 'TRANSFERENCIA BANCARIA'
        `);

        // 2. Fix stored 'TRANFERENCIA BANCARIA' typo
        const [fpRes] = await pool.query(`
            UPDATE rh_contratos_laborales
            SET forma_pago = REPLACE(forma_pago, 'TRANFERENCIA', 'TRANSFERENCIA')
            WHERE forma_pago LIKE '%TRANFERENCIA%'
        `);
        console.log(`[Migration v313] Updated forma_pago in ${fpRes.affectedRows} row(s).`);

        // 3. Fix stored typos in otras_estipulaciones
        const [oeRes] = await pool.query(`
            UPDATE rh_contratos_laborales
            SET otras_estipulaciones = REPLACE(
                REPLACE(otras_estipulaciones, 'TENGA QUE EL TRABAJAR', 'TENGA QUE TRABAJAR'),
                'DESCANDO SEMANAL',
                'DESCANSO SEMANAL'
            )
            WHERE otras_estipulaciones LIKE '%TENGA QUE EL TRABAJAR%'
               OR otras_estipulaciones LIKE '%DESCANDO SEMANAL%'
        `);
        console.log(`[Migration v313] Updated otras_estipulaciones in ${oeRes.affectedRows} row(s).`);

        // 4. Replace dummy zero-mask worker NIT (0000-000000-000-0) with homologated DUI when available
        const [nitRes] = await pool.query(`
            UPDATE rh_contratos_laborales
            SET num_nit = TRIM(num_dui)
            WHERE TRIM(COALESCE(num_nit, '')) = '0000-000000-000-0'
              AND TRIM(COALESCE(num_dui, '')) != ''
        `);
        console.log(`[Migration v313] Replaced placeholder worker NIT with homologated DUI in ${nitRes.affectedRows} row(s).`);

        // 5. Ensure feminine agreement ('SALVADOREÑA') on corporate patrono rows without natural representative
        const [nacRes] = await pool.query(`
            UPDATE rh_contratos_laborales cl
            INNER JOIN companies c ON c.id = cl.company_id
            SET cl.patrono_nacionalidad = 'SALVADOREÑA'
            WHERE c.tipo_persona = '2'
              AND TRIM(COALESCE(cl.patrono_dui, '')) = ''
              AND UPPER(TRIM(COALESCE(cl.patrono_nacionalidad, ''))) = 'SALVADOREÑO'
        `);
        console.log(`[Migration v313] Fixed corporate patrono_nacionalidad in ${nacRes.affectedRows} row(s).`);

        console.log('[Migration v313] Completed successfully.');
    } finally {
        if (!externalPool) {
            await pool.end();
        }
    }
}

if (require.main === module) {
    migrate()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[Migration v313] Failed:', err);
            process.exit(1);
        });
}

module.exports = { migrate };

