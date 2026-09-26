const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const PERMISSION_KEY = 'view_gas_advances_report';

async function runMigration() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas',
    });

    try {
        console.log('=== Iniciando Migración v216: Desglose de Pagos en Anticipos ===');

        // 1. Verificar y agregar columnas en gas_station_advances
        const [columns] = await pool.query('DESCRIBE gas_station_advances');
        const colNames = columns.map(c => c.Field);

        const columnsToAdd = [
            { name: 'efectivo', query: 'ALTER TABLE gas_station_advances ADD COLUMN efectivo DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER notas' },
            { name: 'tarjeta', query: 'ALTER TABLE gas_station_advances ADD COLUMN tarjeta DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER efectivo' },
            { name: 'tarjeta_referencia', query: 'ALTER TABLE gas_station_advances ADD COLUMN tarjeta_referencia VARCHAR(100) NULL AFTER tarjeta' },
            { name: 'cheque', query: 'ALTER TABLE gas_station_advances ADD COLUMN cheque DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER tarjeta_referencia' },
            { name: 'cheque_referencia', query: 'ALTER TABLE gas_station_advances ADD COLUMN cheque_referencia VARCHAR(100) NULL AFTER cheque' },
            { name: 'transferencia', query: 'ALTER TABLE gas_station_advances ADD COLUMN transferencia DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER cheque_referencia' },
            { name: 'transferencia_referencia', query: 'ALTER TABLE gas_station_advances ADD COLUMN transferencia_referencia VARCHAR(100) NULL AFTER transferencia' }
        ];

        for (const col of columnsToAdd) {
            if (!colNames.includes(col.name)) {
                console.log(`  → Agregando columna: ${col.name}`);
                await pool.query(col.query);
            } else {
                console.log(`  → Columna ya existe: ${col.name}`);
            }
        }

        // 2. Backfill de registros existentes para asignar monto a efectivo
        console.log('  → Actualizando registros existentes (efectivo = monto)...');
        const [updateResult] = await pool.query(`
            UPDATE gas_station_advances 
            SET efectivo = monto 
            WHERE (efectivo = 0 OR efectivo IS NULL) 
              AND (tarjeta = 0 OR tarjeta IS NULL) 
              AND (cheque = 0 OR cheque IS NULL) 
              AND (transferencia = 0 OR transferencia IS NULL)
              AND monto > 0
        `);
        console.log(`  → Registros actualizados a efectivo: ${updateResult.affectedRows}`);

        // 3. Registrar ítem en menu_items: Gasolinera > Reportes > Pagos Anticipados
        console.log('  → Verificando ítem de menú para Pagos Anticipados...');
        const [existingMenu] = await pool.query(
            "SELECT id FROM menu_items WHERE permission_key = ? OR path = '/gas-station/reporte-anticipos' LIMIT 1",
            [PERMISSION_KEY]
        );

        if (existingMenu.length > 0) {
            console.log('  → El ítem de menú ya existe, omitiendo inserción');
        } else {
            // Buscar nodo padre: Reportes bajo Gasolinera
            const [gasolineraRows] = await pool.query("SELECT id FROM menu_items WHERE label = 'Gasolinera' AND parent_id IS NULL LIMIT 1");
            if (gasolineraRows.length === 0) {
                console.log('  ⚠ Nodo Gasolinera no encontrado');
            } else {
                const gasolineraId = gasolineraRows[0].id;
                const [reportesRows] = await pool.query("SELECT id FROM menu_items WHERE label = 'Reportes' AND parent_id = ? LIMIT 1", [gasolineraId]);
                
                if (reportesRows.length === 0) {
                    console.log('  ⚠ Subnodo Reportes de Gasolinera no encontrado');
                } else {
                    const parentId = reportesRows[0].id;
                    const [maxOrder] = await pool.query('SELECT MAX(sort_order) AS max_o FROM menu_items WHERE parent_id = ?', [parentId]);
                    const nextOrder = (maxOrder[0]?.max_o || 0) + 1;

                    const [insertResult] = await pool.query(`
                        INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active, hide_in_menu)
                        VALUES (?, 'Pagos Anticipados', '/gas-station/reporte-anticipos', 'Receipt', ?, ?, 1, 0)
                    `, [parentId, PERMISSION_KEY, nextOrder]);

                    console.log(`  → Menú insertado con ID ${insertResult.insertId}, orden: ${nextOrder}`);
                }
            }
        }

        // 4. Actualizar roles para heredar la clave de permiso
        console.log('  → Actualizando permisos en roles...');
        const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
        let updatedRoles = 0;

        for (const role of roles) {
            let perms = role.permissions;
            if (typeof perms === 'string') {
                try { perms = JSON.parse(perms); } catch (e) { continue; }
            }
            if (!Array.isArray(perms)) continue;

            const isAdminRole = ['superadmin', 'admin', 'administrador'].includes(role.name.toLowerCase());
            const hasGasAccess = perms.includes('manage_gas_advances') || perms.includes('view_gas_fuel_sales_report') || perms.includes('view_gas_closeout_detail');

            if ((isAdminRole || hasGasAccess) && !perms.includes(PERMISSION_KEY)) {
                perms.push(PERMISSION_KEY);
                await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
                updatedRoles++;
            }
        }
        console.log(`  → ${updatedRoles} roles actualizados con el permiso: ${PERMISSION_KEY}`);

        console.log('=== Migración v216 completada con éxito ===');
    } catch (error) {
        console.error('Error ejecutando migración v216:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = runMigration;
