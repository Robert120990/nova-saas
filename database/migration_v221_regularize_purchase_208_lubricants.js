const pool = require('../server/src/config/db');

async function runMigration() {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const purchaseId = 208;
        const branchId = 1; // Puma San Martin II
        const companyId = 1;
        const purchaseDate = '2026-09-14 22:01:48';

        // 1. Revertir movimientos antiguos de la compra 208 en inventory_movements (que estaban asignados a 8938 y 8932)
        const [oldMovs] = await conn.query(
            "SELECT product_id, cantidad FROM inventory_movements WHERE tipo_documento = 'COMPRA' AND documento_id = ?",
            [purchaseId]
        );
        for (const om of oldMovs) {
            await conn.query(
                "UPDATE inventory SET stock = stock - ? WHERE company_id = ? AND branch_id = ? AND product_id = ?",
                [om.cantidad, companyId, branchId, om.product_id]
            );
        }
        await conn.query(
            "DELETE FROM inventory_movements WHERE tipo_documento = 'COMPRA' AND documento_id = ?",
            [purchaseId]
        );

        // 2. Definir los 9 ítems de lubricantes en unidades con su mapeo de producto correcto
        const updatedItems = [
            { id: 2446, product_id: 9605, codigo: '101', desc: 'Puma Super XP 20W-50, 1QT (PUMA HD SAE 20W50)', qty: 36, price: 5.75, total: 207.00 },
            { id: 2447, product_id: 9618, codigo: '229', desc: 'PUMA ATF DEX MERC, 1QT (PUMA ATF MULTIVEHICLE)', qty: 12, price: 6.104167, total: 73.25 },
            { id: 2448, product_id: 188,  codigo: '105', desc: 'PUMA SUPER 4T 20W50 (PUMA URBAN 20W50 4T)', qty: 24, price: 5.6225, total: 134.94 },
            { id: 2449, product_id: 9604, codigo: '100', desc: 'PUMA SUPER HD 40, 1QT (PUMA SUPER HD 40 1/4)', qty: 12, price: 5.666667, total: 68.00 },
            { id: 2450, product_id: 9620, codigo: '233', desc: 'PUMA HD POWER 5 15W40, 1AG (PUMA HD ULTRA 15W40 1G)', qty: 6, price: 21.666667, total: 130.00 },
            { id: 2451, product_id: 9617, codigo: '226', desc: 'PUMA SUPER HD 50, 1QT (PUMA SUPER HD 50 1/4)', qty: 12, price: 5.50, total: 66.00 },
            { id: 2452, product_id: 1510, codigo: '140', desc: 'REFRIGERANTE XP 4.1L (FREFRIGERANTE xp GALON)', qty: 24, price: 3.241667, total: 77.80 },
            { id: 2453, product_id: 9612, codigo: '212', desc: 'PUMA HD COOLANT 50 50, 1QT (PUMA HD 50/50 1/4 REFRIGERANTE)', qty: 12, price: 4.00, total: 48.00 },
            { id: 2454, product_id: 9609, codigo: '106', desc: 'Puma Advanced XP 5W-20, 1QT (PUMA ADVANCE 5W20 1/4)', qty: 12, price: 7.416667, total: 89.00 }
        ];

        // 3. Actualizar purchase_items y registrar en inventory / inventory_movements
        for (const item of updatedItems) {
            // Actualizar fila de compra
            await conn.query(
                `UPDATE purchase_items 
                 SET product_id = ?, descripcion = ?, cantidad = ?, precio_unitario = ?, total = ?
                 WHERE id = ?`,
                [item.product_id, item.desc, item.qty, item.price, item.total, item.id]
            );

            // Insertar movimiento de entrada en Kárdex
            await conn.query(
                `INSERT INTO inventory_movements 
                 (company_id, branch_id, product_id, tipo_movimiento, cantidad, costo, precio_venta, tipo_documento, documento_id, created_at)
                 VALUES (?, ?, ?, 'ENTRADA', ?, ?, 0, 'COMPRA', ?, ?)`,
                [companyId, branchId, item.product_id, item.qty, item.price, purchaseId, purchaseDate]
            );

            // Actualizar stock en tabla inventory
            const [stockRows] = await conn.query(
                "SELECT id FROM inventory WHERE company_id = ? AND branch_id = ? AND product_id = ?",
                [companyId, branchId, item.product_id]
            );
            if (stockRows.length > 0) {
                await conn.query("UPDATE inventory SET stock = stock + ? WHERE id = ?", [item.qty, stockRows[0].id]);
            } else {
                await conn.query(
                    "INSERT INTO inventory (company_id, branch_id, product_id, stock) VALUES (?, ?, ?, ?)",
                    [companyId, branchId, item.product_id, item.qty]
                );
            }

            // Actualizar costo de referencia y proveedor en el producto
            await conn.query(
                "UPDATE products SET costo = ?, provider_id = 42 WHERE id = ? AND company_id = ?",
                [item.price, item.product_id, companyId]
            );
        }

        await conn.commit();
        console.log('Migración v221: Compra #208 regularizada exitosamente con sus 9 productos de lubricantes.');
    } catch (e) {
        await conn.rollback();
        console.error('Error en migración v221:', e);
        throw e;
    } finally {
        conn.release();
    }
}

module.exports = { runMigration };
