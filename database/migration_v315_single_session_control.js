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
        console.log('[Migration v315] Adding single-session control columns and indexes...');

        const [sessionCols] = await pool.query('DESCRIBE user_sessions');
        const sessionColNames = sessionCols.map(c => c.Field);

        if (!sessionColNames.includes('device_id')) {
            await pool.query(
                'ALTER TABLE user_sessions ADD COLUMN device_id VARCHAR(64) NULL AFTER user_agent'
            );
            console.log('[Migration v315] Added device_id to user_sessions.');
        } else {
            console.log('[Migration v315] Column device_id already exists on user_sessions.');
        }

        if (!sessionColNames.includes('terminated_reason')) {
            await pool.query(
                'ALTER TABLE user_sessions ADD COLUMN terminated_reason VARCHAR(40) NULL AFTER is_active'
            );
            console.log('[Migration v315] Added terminated_reason to user_sessions.');
        } else {
            console.log('[Migration v315] Column terminated_reason already exists on user_sessions.');
        }

        if (!sessionColNames.includes('terminated_at')) {
            await pool.query(
                'ALTER TABLE user_sessions ADD COLUMN terminated_at TIMESTAMP NULL AFTER terminated_reason'
            );
            console.log('[Migration v315] Added terminated_at to user_sessions.');
        } else {
            console.log('[Migration v315] Column terminated_at already exists on user_sessions.');
        }

        if (!sessionColNames.includes('replaced_by_session_id')) {
            await pool.query(
                'ALTER TABLE user_sessions ADD COLUMN replaced_by_session_id INT NULL AFTER terminated_at'
            );
            console.log('[Migration v315] Added replaced_by_session_id to user_sessions.');
        } else {
            console.log('[Migration v315] Column replaced_by_session_id already exists on user_sessions.');
        }

        const [statRows] = await pool.query(
            `SELECT INDEX_NAME FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_sessions'
               AND INDEX_NAME = 'idx_user_sessions_user_active_device'`
        );
        if (statRows.length === 0) {
            await pool.query(
                'ALTER TABLE user_sessions ADD INDEX idx_user_sessions_user_active_device (user_id, is_active, device_id)'
            );
            console.log('[Migration v315] Added idx_user_sessions_user_active_device index on user_sessions.');
        } else {
            console.log('[Migration v315] Index idx_user_sessions_user_active_device already exists on user_sessions.');
        }

        const [userCols] = await pool.query('DESCRIBE users');
        const userColNames = userCols.map(c => c.Field);
        if (!userColNames.includes('allow_concurrent_sessions')) {
            const afterClause = userColNames.includes('allowed_ips') ? 'AFTER allowed_ips' : '';
            await pool.query(
                `ALTER TABLE users ADD COLUMN allow_concurrent_sessions TINYINT(1) NOT NULL DEFAULT 0 ${afterClause}`
            );
            console.log('[Migration v315] Added allow_concurrent_sessions to users.');
        } else {
            console.log('[Migration v315] Column allow_concurrent_sessions already exists on users.');
        }

        console.log('[Migration v315] Completed successfully.');
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
            console.error('[Migration v315] Failed:', err);
            process.exit(1);
        });
}

module.exports = { migrate };
