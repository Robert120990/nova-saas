const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('=== Iniciando Migración v219: Sincronización de Stock en Tabla Inventory con Kardex ===');

        const [res] = await pool.query(`
            INSERT INTO inventory (company_id, product_id, branch_id, stock)
            SELECT 
                p.company_id,
                pb.product_id,
                pb.branch_id,
                COALESCE(
                    (SELECT SUM(CASE WHEN tipo_movimiento = 'ENTRADA' THEN cantidad ELSE -cantidad END)
                     FROM inventory_movements
                     WHERE product_id = pb.product_id AND branch_id = pb.branch_id),
                    0
                ) as stock
            FROM product_branch pb
            JOIN products p ON pb.product_id = p.id
            WHERE (
                SELECT COUNT(*) 
                FROM inventory_movements 
                WHERE product_id = pb.product_id AND branch_id = pb.branch_id
            ) > 0
            ON DUPLICATE KEY UPDATE 
                stock = VALUES(stock),
                company_id = VALUES(company_id)
        `);

        console.log(`  → Sincronizados ${res.affectedRows} registros de inventario con los movimientos del Kardex.`);
        console.log('=== Migración v219 completada exitosamente ===');
    } catch (error) {
        console.error('Error en migración v219:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

module.exports = { runMigration };

if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
