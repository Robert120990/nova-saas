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
        console.log('=== Iniciando Migración v218: Inventario Inicial y Regularización de Ajustes ===');

        // 1. Agregar motivo 'INVENTARIO INICIAL' para todas las empresas si no existe
        const [companies] = await pool.query('SELECT id FROM companies');
        for (const comp of companies) {
            const [existing] = await pool.query(
                "SELECT id FROM inventory_adjustment_motivos WHERE company_id = ? AND nombre = 'INVENTARIO INICIAL' LIMIT 1",
                [comp.id]
            );
            if (existing.length === 0) {
                await pool.query(
                    "INSERT INTO inventory_adjustment_motivos (company_id, nombre, tipo) VALUES (?, 'INVENTARIO INICIAL', 'ENTRADA')",
                    [comp.id]
                );
                console.log(`  → Motivo 'INVENTARIO INICIAL' creado para empresa ID ${comp.id}`);
            } else {
                console.log(`  → Motivo 'INVENTARIO INICIAL' ya existe para empresa ID ${comp.id}`);
            }
        }

        // 2. Obtener el ID del motivo INVENTARIO INICIAL para empresa 1
        const [motivoInicial] = await pool.query(
            "SELECT id FROM inventory_adjustment_motivos WHERE company_id = 1 AND nombre = 'INVENTARIO INICIAL' LIMIT 1"
        );
        const motivoId = motivoInicial.length > 0 ? motivoInicial[0].id : 6;

        // 3. Regularizar Ajuste #15 (Inventario inicial de lubricantes al 01/08/2026 en Puma San Martín II)
        console.log('  → Regularizando Ajuste #15 como INVENTARIO INICIAL...');
        await pool.query(
            `UPDATE inventory_adjustment_headers 
             SET motivo_id = ?, observaciones = 'INVENTARIO INICIAL AL 01/08/2026' 
             WHERE id = 15`,
            [motivoId]
        );

        // Actualizar los movimientos de Kardex del Ajuste #15 para que queden como inventario inicial
        // al corte de apertura (2026-07-31 23:59:59) y con company_id y tipo_documento correspondientes
        const [updResult] = await pool.query(`
            UPDATE inventory_movements 
            SET created_at = '2026-07-31 23:59:59',
                company_id = 1,
                tipo_documento = 'INVENTARIO_INICIAL',
                costo = COALESCE((SELECT costo FROM products WHERE id = inventory_movements.product_id), 0)
            WHERE documento_id = 15 AND tipo_documento IN ('AJUSTE', 'INVENTARIO_INICIAL')
        `);
        console.log(`  → ${updResult.affectedRows} movimientos de Kardex actualizados para Ajuste #15.`);

        // 4. Limpiar movimientos huérfanos de prueba de Mayo 2026 (IDs 320 y 324) del producto 118
        // Estos movimientos provenían de DTE-11 de prueba rechazados sin cabecera de venta
        const [delOrphan] = await pool.query(`
            DELETE FROM inventory_movements 
            WHERE id IN (320, 324) 
              AND product_id = 1501 
              AND tipo_documento = 'DTE-11'
        `);
        console.log(`  → ${delOrphan.affectedRows} movimientos huérfanos de prueba de mayo eliminados para producto 118.`);

        console.log('=== Migración v218 completada exitosamente ===');
    } catch (error) {
        console.error('Error durante la migración v218:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runMigration().catch(() => process.exit(1));
}

module.exports = { runMigration };
