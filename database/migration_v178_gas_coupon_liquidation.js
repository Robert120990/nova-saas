const pool = require('../server/src/config/db');

async function runMigration() {
    console.log('Running migration v178 - Gas Station Coupon Liquidation...');

    // 1. Create gas_station_coupon_liquidations table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS gas_station_coupon_liquidations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            branch_id INT NOT NULL,
            correlativo VARCHAR(50) NOT NULL,
            fecha DATE NOT NULL,
            distribuidora_id INT NULL,
            distribuidora_nombre VARCHAR(255) NULL,
            responsable VARCHAR(255) NULL,
            comentario TEXT NULL,
            total_cupones_sistema INT DEFAULT 0,
            total_monto_sistema DECIMAL(12,2) DEFAULT 0.00,
            total_cupones_fisicos INT DEFAULT 0,
            total_monto_fisico DECIMAL(12,2) DEFAULT 0.00,
            diferencia_monto DECIMAL(12,2) DEFAULT 0.00,
            estado ENUM('borrador', 'liquidado', 'anulado') DEFAULT 'liquidado',
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_company_branch (company_id, branch_id),
            INDEX idx_fecha (fecha),
            INDEX idx_correlativo (correlativo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  → Table gas_station_coupon_liquidations created/verified.');

    // 2. Create gas_station_coupon_liquidation_items table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS gas_station_coupon_liquidation_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            liquidation_id INT NOT NULL,
            closeout_cupon_id INT NULL,
            cupon VARCHAR(50) NOT NULL,
            distribuidora_id INT NULL,
            distribuidora_nombre VARCHAR(255) DEFAULT '',
            producto_codigo VARCHAR(50) DEFAULT '',
            producto_descripcion VARCHAR(255) DEFAULT '',
            despachador_id INT NULL,
            despachador_nombre VARCHAR(255) DEFAULT '',
            closeout_id INT NULL,
            fecha_turno DATE NULL,
            numero_turno VARCHAR(20) NULL,
            monto_sistema DECIMAL(12,2) DEFAULT 0.00,
            monto_fisico DECIMAL(12,2) DEFAULT 0.00,
            diferencia DECIMAL(12,2) DEFAULT 0.00,
            estado_conciliacion ENUM('conciliado', 'faltante', 'sobrante') NOT NULL DEFAULT 'conciliado',
            notas VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (liquidation_id) REFERENCES gas_station_coupon_liquidations(id) ON DELETE CASCADE,
            INDEX idx_liquidation_id (liquidation_id),
            INDEX idx_cupon (cupon),
            INDEX idx_closeout_cupon_id (closeout_cupon_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  → Table gas_station_coupon_liquidation_items created/verified.');

    // 3. Add liquidation_id and estado_liquidacion to gas_station_closeout_cupones if missing
    const [cols] = await pool.query('DESCRIBE gas_station_closeout_cupones');
    const hasLiquidationId = cols.some(c => c.Field === 'liquidation_id');
    const hasEstadoLiquidation = cols.some(c => c.Field === 'estado_liquidacion');

    if (!hasLiquidationId) {
        await pool.query(`
            ALTER TABLE gas_station_closeout_cupones 
            ADD COLUMN liquidation_id INT NULL AFTER despachador_id,
            ADD INDEX idx_liquidation_id (liquidation_id);
        `);
        console.log('  → Column liquidation_id added to gas_station_closeout_cupones.');
    }

    if (!hasEstadoLiquidation) {
        await pool.query(`
            ALTER TABLE gas_station_closeout_cupones 
            ADD COLUMN estado_liquidacion ENUM('pendiente', 'liquidado', 'faltante') NOT NULL DEFAULT 'pendiente' AFTER liquidation_id,
            ADD INDEX idx_estado_liquidacion (estado_liquidacion);
        `);
        console.log('  → Column estado_liquidacion added to gas_station_closeout_cupones.');
    }

    // 4. Insert menu item under Gasolinera (id 75)
    const [existingMenu] = await pool.query("SELECT id FROM menu_items WHERE path = '/gas-station/liquidacion-cupones' LIMIT 1");
    if (existingMenu.length === 0) {
        await pool.query(`
            INSERT INTO menu_items (parent_id, label, path, icon, permission_key, sort_order, is_active)
            VALUES (75, 'Liquidación de Cupones', '/gas-station/liquidacion-cupones', 'Ticket', 'manage_gas_coupon_liquidation', 6, TRUE)
        `);
        console.log('  → Menu item "Liquidación de Cupones" inserted.');
    } else {
        await pool.query(`
            UPDATE menu_items 
            SET label = 'Liquidación de Cupones', permission_key = 'manage_gas_coupon_liquidation', icon = 'Ticket'
            WHERE id = ?
        `, [existingMenu[0].id]);
        console.log('  → Menu item "Liquidación de Cupones" updated.');
    }

    // 5. Grant permission to roles that have access to gas station or are admin
    const PERMISSION_KEY = 'manage_gas_coupon_liquidation';
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    let rolesUpdated = 0;

    for (const role of roles) {
        let perms = role.permissions;
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch (e) { continue; }
        }
        if (!Array.isArray(perms)) continue;

        const roleLower = (role.name || '').toLowerCase();
        const shouldGrant = perms.includes('manage_gas_readings_closure') ||
                            perms.includes('manage_gas_remesa_delivery') ||
                            roleLower.includes('admin') ||
                            roleLower.includes('geren') ||
                            roleLower.includes('supervis') ||
                            roleLower.includes('jefe');

        if (shouldGrant && !perms.includes(PERMISSION_KEY)) {
            perms.push(PERMISSION_KEY);
            await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), role.id]);
            rolesUpdated++;
            console.log(`  → Role '${role.name}' (id=${role.id}) granted '${PERMISSION_KEY}'`);
        }
    }

    console.log(`  → Total roles updated: ${rolesUpdated}`);
    console.log('Migration v178 completed successfully.');
}

module.exports = runMigration;
