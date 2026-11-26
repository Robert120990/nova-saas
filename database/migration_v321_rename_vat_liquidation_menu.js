const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('Running migration v321 - Renaming VAT liquidation menu label...');

        const reportPath = '/iva/liquidacion';
        const newLabel = 'Liqui. Iva y Pago Cta';

        const [result] = await pool.query(
            'UPDATE menu_items SET label = ? WHERE path = ?',
            [newLabel, reportPath]
        );

        console.log(`Updated ${result.affectedRows} row(s) in menu_items to "${newLabel}".`);
    } catch (error) {
        console.error('Error in migration v321:', error);
        throw error;
    }
}

module.exports = runMigration;
