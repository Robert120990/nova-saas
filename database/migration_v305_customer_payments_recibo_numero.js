const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v305: Adding recibo_numero to customer_payments and backfilling batches ---');
    const [cols] = await pool.query("SHOW COLUMNS FROM customer_payments LIKE 'recibo_numero'");
    if (cols.length === 0) {
        await pool.query("ALTER TABLE customer_payments ADD COLUMN recibo_numero BIGINT NULL AFTER id");
        await pool.query("ALTER TABLE customer_payments ADD INDEX idx_cp_recibo_numero (recibo_numero)");
        console.log('✅ Column recibo_numero and index added to customer_payments');
    } else {
        console.log('ℹ️ Column recibo_numero already exists in customer_payments');
    }

    // Backfill any NULL recibo_numero
    await pool.query(`
        UPDATE customer_payments cp
        JOIN (
            SELECT MIN(id) as first_id,
                   company_id, branch_id, customer_id, fecha_pago, metodo_pago, referencia,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as created_minute
            FROM customer_payments
            GROUP BY company_id, branch_id, customer_id, fecha_pago, metodo_pago, referencia, created_minute
        ) b ON cp.company_id = b.company_id 
           AND cp.branch_id = b.branch_id 
           AND cp.customer_id = b.customer_id 
           AND cp.fecha_pago = b.fecha_pago 
           AND cp.metodo_pago = b.metodo_pago 
           AND (cp.referencia = b.referencia OR (cp.referencia IS NULL AND b.referencia IS NULL))
           AND DATE_FORMAT(cp.created_at, '%Y-%m-%d %H:%i') = b.created_minute
        SET cp.recibo_numero = b.first_id
        WHERE cp.recibo_numero IS NULL
    `);

    await pool.query(`UPDATE customer_payments SET recibo_numero = id WHERE recibo_numero IS NULL`);
    console.log('✅ Backfilled recibo_numero for all customer_payments');
}

module.exports = migrate;
