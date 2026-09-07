/**
 * Backfill de lecturas de lubricantes para los cierres existentes de Shell Chalchuapa
 * (company_id=2, branch_id=3).
 *
 * Como los lubricantes no existían cuando se abrieron/cerraron los turnos 255 a 281,
 * este script:
 * 1. Lee los inventarios finales del último turno de SIPE (30/08/2026).
 * 2. Puebla gas_station_closeout_lubricant_readings para cada cierre en orden cronológico,
 *    encadenando la lectura inicial desde el turno anterior.
 * 3. Mantiene ventas=0 y total=0 en los turnos ya cerrados para no alterar diferencias financieras.
 * 4. Deja el turno 281 (abierto actualmente) listo con las lecturas iniciales reales.
 */

const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const EXT = { host: 'localhost', user: 'sysadmin', password: 'QwErTy123', database: 'db_sipe_chalchuapa' };
const ID_EMPRESA = '006';
const COMPANY_ID = 2;
const BRANCH_ID = 3;

async function runBackfill() {
    console.log(`=== Backfill de Lecturas de Lubricantes en Cierres de Turno (Empresa ${COMPANY_ID}, Sucursal ${BRANCH_ID}) ===\n`);

    const ext = await mysql.createConnection(EXT);
    const main = await mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    const conn = await main.getConnection();

    try {
        // 1. Obtener cierres de Shell Chalchuapa
        const [closeouts] = await conn.query(
            `SELECT id, fecha_turno, numero_turno, estado, created_at
             FROM gas_station_closeouts
             WHERE company_id = ? AND branch_id = ?
             ORDER BY id ASC`,
            [COMPANY_ID, BRANCH_ID]
        );
        console.log(`1. Total cierres encontrados para Shell Chalchuapa: ${closeouts.length}`);
        if (closeouts.length === 0) {
            console.log('No hay cierres para procesar.');
            return;
        }

        // 2. Obtener los 63 productos de lubricantes de la empresa
        const [settings] = await conn.query(
            `SELECT setting_value FROM gas_station_settings
             WHERE company_id = ? AND branch_id = ? AND setting_key = 'lubricant_category_id'`,
            [COMPANY_ID, BRANCH_ID]
        );
        const categoryId = settings[0]?.setting_value;
        if (!categoryId) {
            throw new Error('No se encontró lubricant_category_id en gas_station_settings para la sucursal');
        }

        const [products] = await conn.query(`
            SELECT p.id, p.codigo, p.nombre AS descripcion, COALESCE(pbp.precio_unitario, 0) as precio_unitario
            FROM products p
            JOIN product_branch pb ON p.id = pb.product_id AND pb.branch_id = ?
            LEFT JOIN product_branch_prices pbp ON p.id = pbp.product_id AND pbp.branch_id = ?
            WHERE p.company_id = ? AND p.category_id = ? AND p.status = 'activo'
            ORDER BY p.codigo ASC
        `, [BRANCH_ID, BRANCH_ID, COMPANY_ID, categoryId]);

        console.log(`2. Productos de lubricantes a sembrar: ${products.length} (Categoría ID: ${categoryId})`);

        // 3. Obtener stock final de SIPE del último turno (30/08/2026)
        const [sipeFinal] = await ext.query(`
            SELECT p.codigo, il.final
            FROM inventario_lubricantes il
            JOIN productos p ON il.id_producto = p.id AND il.id_empresa = p.id_empresa
            WHERE il.id_empresa = ? AND il.fecha_turno = '30/08/2026' AND il.turno = 1
        `, [ID_EMPRESA]);

        const sipeFinalMap = new Map();
        for (const sf of sipeFinal) {
            sipeFinalMap.set(`L${sf.codigo}`, parseFloat(sf.final) || 0);
        }
        console.log(`3. Registros de stock final extraídos de SIPE (30/08/2026): ${sipeFinalMap.size}`);

        await conn.beginTransaction();

        // 4. Procesar cierre por cierre
        let runningStockMap = new Map();
        for (const p of products) {
            runningStockMap.set(p.id, sipeFinalMap.get(p.codigo) || 0);
        }

        let totalInsertados = 0;
        let cierresProcesados = 0;

        for (const c of closeouts) {
            // Verificar si ya tiene lecturas
            const [existentes] = await conn.query(
                `SELECT count(*) as count FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`,
                [c.id]
            );

            if (existentes[0].count > 0) {
                console.log(`- Cierre #${c.id} (${c.estado}): ya tiene ${existentes[0].count} lecturas. Saltando.`);
                // Actualizar runningStockMap con las lecturas finales existentes
                const [existingRows] = await conn.query(
                    `SELECT producto_id, lectura_final FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ?`,
                    [c.id]
                );
                for (const row of existingRows) {
                    runningStockMap.set(row.producto_id, parseFloat(row.lectura_final) || 0);
                }
                continue;
            }

            const rowsToInsert = [];
            for (const p of products) {
                const stockInicial = runningStockMap.get(p.id) || 0;
                const recarga = 0;
                const stockFinal = stockInicial;
                const ventas = 0;
                const precio = parseFloat(p.precio_unitario) || 0;
                const total = 0;

                rowsToInsert.push([
                    c.id,
                    p.id,
                    p.codigo,
                    p.descripcion,
                    stockInicial,
                    recarga,
                    stockFinal,
                    ventas,
                    precio,
                    total
                ]);

                runningStockMap.set(p.id, stockFinal);
            }

            const placeholders = rowsToInsert.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const params = rowsToInsert.flat();

            await conn.query(`
                INSERT INTO gas_station_closeout_lubricant_readings
                (closeout_id, producto_id, producto_codigo, producto_descripcion, lectura_inicial, recarga, lectura_final, ventas, precio, total)
                VALUES ${placeholders}
            `, params);

            totalInsertados += rowsToInsert.length;
            cierresProcesados++;
            console.log(`- Cierre #${c.id} (${c.estado} - turno ${c.numero_turno}): agregadas ${rowsToInsert.length} lecturas de lubricantes.`);
        }

        await conn.commit();

        console.log(`\n=== RESUMEN BACKFILL ===`);
        console.log(`- Cierres procesados: ${cierresProcesados}`);
        console.log(`- Total lecturas de lubricantes insertadas: ${totalInsertados}`);

        // Verificación del turno actual abierto (id 281)
        const [sample281] = await conn.query(`
            SELECT producto_codigo, producto_descripcion, lectura_inicial, lectura_final, precio
            FROM gas_station_closeout_lubricant_readings
            WHERE closeout_id = 281 AND lectura_inicial > 0
            LIMIT 5
        `);
        console.log('\nMuestra de lecturas en turno actual (closeout 281 con stock > 0):');
        console.log(sample281);

        console.log('\n✅ Backfill completado con éxito.');
    } catch (error) {
        await conn.rollback();
        console.error('❌ Error en backfill:', error);
        process.exitCode = 1;
    } finally {
        conn.release();
        await ext.end();
        await main.end();
    }
}

runBackfill();
