const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(pool) {
    console.log('[Migration v255] Modificando egg_raw_materials.egg_size a VARCHAR(50)...');

    const [cols] = await pool.query(`
        SELECT DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'egg_raw_materials' 
          AND COLUMN_NAME = 'egg_size'
    `);

    if (cols.length > 0 && cols[0].DATA_TYPE !== 'varchar') {
        await pool.query(`
            ALTER TABLE egg_raw_materials 
            MODIFY COLUMN egg_size VARCHAR(50) NULL DEFAULT 'L'
        `);
        console.log('[Migration v255] Columna egg_size convertida a VARCHAR(50) DEFAULT "L" con éxito.');
    } else {
        console.log('[Migration v255] Columna egg_size ya es VARCHAR(50).');
    }

    console.log('[Migration v255] Migración completada.');
}

if (require.main === module) {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    migrate(pool)
        .then(() => pool.end())
        .catch((err) => {
            console.error('[Migration v255] Error:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { migrate };
