const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function migrate(pool) {
    console.log('[Migration v311] Verificando columna closing_balance en pos_shifts...');
    const [cols] = await pool.query("SHOW COLUMNS FROM pos_shifts LIKE 'closing_balance'");
    if (cols.length === 0) {
        await pool.query(
            "ALTER TABLE pos_shifts ADD COLUMN closing_balance DECIMAL(12,4) NOT NULL DEFAULT 0.0000 AFTER opening_balance"
        );
        console.log('[Migration v311] Columna closing_balance agregada a pos_shifts.');
    } else {
        console.log('[Migration v311] Columna closing_balance ya existe en pos_shifts.');
    }

    const [idxs] = await pool.query("SHOW INDEX FROM pos_shifts WHERE Key_name = 'idx_pos_shifts_company_branch_start'");
    if (idxs.length === 0) {
        await pool.query(
            "ALTER TABLE pos_shifts ADD INDEX idx_pos_shifts_company_branch_start (company_id, branch_id, start_time)"
        );
        console.log('[Migration v311] Índice idx_pos_shifts_company_branch_start agregado a pos_shifts.');
    }

    console.log('[Migration v311] Migración v311 completada exitosamente.');
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
            console.error('[Migration v311] Error:', err);
            pool.end();
            process.exit(1);
        });
}

module.exports = { migrate };

