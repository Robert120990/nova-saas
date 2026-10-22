const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v303: Adding telegram_messages_json to support_tickets ---');
    const [cols] = await pool.query('SHOW COLUMNS FROM support_tickets');
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('telegram_messages_json')) {
        await pool.query('ALTER TABLE support_tickets ADD COLUMN telegram_messages_json JSON NULL AFTER telegram_notified');
        console.log('✅ Column telegram_messages_json added to support_tickets');
    } else {
        console.log('ℹ️ Column telegram_messages_json already exists in support_tickets');
    }
}

module.exports = migrate;
