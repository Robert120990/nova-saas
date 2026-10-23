const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v304: Adding daily_briefing_last_sent_date to telegram_settings ---');
    const [cols] = await pool.query('SHOW COLUMNS FROM telegram_settings');
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('daily_briefing_last_sent_date')) {
        await pool.query('ALTER TABLE telegram_settings ADD COLUMN daily_briefing_last_sent_date DATE NULL AFTER daily_briefing_active');
        console.log('✅ Column daily_briefing_last_sent_date added to telegram_settings');
    } else {
        console.log('ℹ️ Column daily_briefing_last_sent_date already exists in telegram_settings');
    }
}

module.exports = migrate;
