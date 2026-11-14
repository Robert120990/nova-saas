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
        console.log('[Migration v312] Removing hardcoded patrono SQL defaults and cleaning contaminated company records...');

        // 1. Remove hardcoded personal SQL column defaults from rh_config
        await pool.query(`
            ALTER TABLE rh_config
                MODIFY COLUMN patrono_nombre VARCHAR(200) NULL DEFAULT '',
                MODIFY COLUMN patrono_edad INT NULL DEFAULT NULL,
                MODIFY COLUMN patrono_sexo VARCHAR(30) NULL DEFAULT '',
                MODIFY COLUMN patrono_estado_civil VARCHAR(50) NULL DEFAULT '',
                MODIFY COLUMN patrono_profesion VARCHAR(150) NULL DEFAULT '',
                MODIFY COLUMN patrono_direccion VARCHAR(255) NULL DEFAULT '',
                MODIFY COLUMN patrono_nacionalidad VARCHAR(80) NULL DEFAULT 'SALVADOREÑA',
                MODIFY COLUMN patrono_dui VARCHAR(20) NULL DEFAULT '',
                MODIFY COLUMN patrono_dui_extendido VARCHAR(120) NULL DEFAULT '',
                MODIFY COLUMN patrono_nit VARCHAR(25) NULL DEFAULT ''
        `);

        // 2. Remove hardcoded personal SQL column defaults from rh_contratos_laborales
        await pool.query(`
            ALTER TABLE rh_contratos_laborales
                MODIFY COLUMN patrono_nombre VARCHAR(200) NULL DEFAULT NULL,
                MODIFY COLUMN patrono_edad INT NULL DEFAULT NULL,
                MODIFY COLUMN patrono_sexo VARCHAR(30) NULL DEFAULT '',
                MODIFY COLUMN patrono_estado_civil VARCHAR(50) NULL DEFAULT '',
                MODIFY COLUMN patrono_profesion VARCHAR(150) NULL DEFAULT '',
                MODIFY COLUMN patrono_direccion VARCHAR(255) NULL DEFAULT NULL,
                MODIFY COLUMN patrono_nacionalidad VARCHAR(80) NULL DEFAULT 'SALVADOREÑA',
                MODIFY COLUMN patrono_dui VARCHAR(20) NULL DEFAULT NULL,
                MODIFY COLUMN patrono_dui_extendido VARCHAR(120) NULL DEFAULT '',
                MODIFY COLUMN patrono_nit VARCHAR(25) NULL DEFAULT NULL
        `);

        // 3. Clean rh_config rows of companies other than NIT 0614-140268-004-3 that received the v310 seed
        const [cfgCleanRes] = await pool.query(`
            UPDATE rh_config rc
            INNER JOIN companies c ON c.id = rc.company_id
            SET rc.patrono_nombre = '',
                rc.patrono_edad = NULL,
                rc.patrono_sexo = '',
                rc.patrono_estado_civil = '',
                rc.patrono_profesion = '',
                rc.patrono_direccion = '',
                rc.patrono_nacionalidad = 'SALVADOREÑA',
                rc.patrono_dui = '',
                rc.patrono_dui_extendido = '',
                rc.patrono_nit = ''
            WHERE COALESCE(c.nit, '') != '0614-140268-004-3'
              AND (
                  rc.patrono_nit = '0614-140268-004-3'
                  OR (
                      UPPER(TRIM(COALESCE(rc.patrono_nombre, ''))) = 'RAUL RAFAEL SOSA CASTELLANOS'
                      AND TRIM(COALESCE(rc.patrono_dui, '')) = '00497414-6'
                  )
              )
        `);
        console.log(`[Migration v312] Cleaned ${cfgCleanRes.affectedRows} contaminated rh_config row(s).`);

        // 4. Clean residual column default values in rh_config rows where patrono_nombre is empty
        const [cfgEmptyRes] = await pool.query(`
            UPDATE rh_config
            SET patrono_edad = NULL,
                patrono_sexo = '',
                patrono_estado_civil = '',
                patrono_profesion = '',
                patrono_dui_extendido = ''
            WHERE TRIM(COALESCE(patrono_nombre, '')) = ''
        `);
        console.log(`[Migration v312] Reset residual column defaults in ${cfgEmptyRes.affectedRows} unconfigured rh_config row(s).`);

        // 5. Clean rh_contratos_laborales rows of companies other than NIT 0614-140268-004-3 that inherited the v310 seed
        const [ctCleanRes] = await pool.query(`
            UPDATE rh_contratos_laborales cl
            INNER JOIN companies c ON c.id = cl.company_id
            SET cl.patrono_nombre = NULL,
                cl.patrono_edad = NULL,
                cl.patrono_sexo = '',
                cl.patrono_estado_civil = '',
                cl.patrono_profesion = '',
                cl.patrono_direccion = NULL,
                cl.patrono_nacionalidad = 'SALVADOREÑA',
                cl.patrono_dui = NULL,
                cl.patrono_dui_extendido = '',
                cl.patrono_nit = NULL
            WHERE COALESCE(c.nit, '') != '0614-140268-004-3'
              AND (
                  cl.patrono_nit = '0614-140268-004-3'
                  OR (
                      UPPER(TRIM(COALESCE(cl.patrono_nombre, ''))) = 'RAUL RAFAEL SOSA CASTELLANOS'
                      AND TRIM(COALESCE(cl.patrono_dui, '')) = '00497414-6'
                  )
              )
        `);
        console.log(`[Migration v312] Cleaned ${ctCleanRes.affectedRows} contaminated rh_contratos_laborales row(s).`);

        console.log('[Migration v312] Completed successfully.');
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
            console.error('[Migration v312] Error:', err);
            process.exit(1);
        });
}

module.exports = { migrate };

