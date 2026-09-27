// Ejecutada únicamente por run_migration_v234.js; nunca al cargar controladores.
const newPermissions = [
    ['manage_egg_quality', 'Calidad y liberación industrial', 'manage_traceability'],
    ['manage_egg_cip_exception', 'Autorizar excepción CIP', 'manage_egg_production_lots'],
    ['manage_egg_commissions', 'Comisiones industriales', 'manage_industrial_costeo_libra'],
    ['manage_egg_returnables', 'Retornables industriales', 'manage_traceability'],
    ['manage_egg_telemetry_simulation', 'Simulación industrial', 'view_industrial_dashboard']
];
async function migrate(pool) {
    const { ensureLegacyEggSchema } = require('./migration_v234_egg_legacy_schema');
    await ensureLegacyEggSchema(pool);
    await pool.query(`CREATE TABLE IF NOT EXISTS egg_dispatch_emissions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY, company_id INT NOT NULL, sale_id INT NOT NULL,
        payload_json JSON NOT NULL, result_json JSON NULL,
        status ENUM('pending','sending','accepted','review') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_egg_emission_sale (company_id, sale_id)) ENGINE=InnoDB`);
    const [columns] = await pool.query('SHOW COLUMNS FROM egg_packaging_records');
    const names = new Set(columns.map(column => column.Field));
    if (!names.has('dispatched_units')) await pool.query('ALTER TABLE egg_packaging_records ADD COLUMN dispatched_units DECIMAL(14,3) NULL DEFAULT NULL');
    if (!names.has('dispatched_weight_lbs')) await pool.query('ALTER TABLE egg_packaging_records ADD COLUMN dispatched_weight_lbs DECIMAL(14,3) NOT NULL DEFAULT 0');
    await pool.query(`CREATE TABLE IF NOT EXISTS egg_packaging_movements (
        id BIGINT AUTO_INCREMENT PRIMARY KEY, company_id INT NOT NULL, packaging_id INT NOT NULL,
        sale_id INT NOT NULL, units DECIMAL(14,3) NOT NULL, weight_lbs DECIMAL(14,3) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_egg_movement_sale (company_id, packaging_id, sale_id),
        INDEX idx_egg_movement_packaging (company_id, packaging_id)) ENGINE=InnoDB`);
    // Recuperar solo salidas documentadas. El marcador NULL hace el backfill reanudable e idempotente.
    const [records] = await pool.query('SELECT id, company_id FROM egg_packaging_records WHERE dispatched_units IS NULL');
    for (const record of records) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [locked] = await connection.query('SELECT dispatched_units FROM egg_packaging_records WHERE id = ? AND company_id = ? FOR UPDATE', [record.id, record.company_id]);
            if (locked[0].dispatched_units !== null) { await connection.rollback(); continue; }
            const [events] = await connection.query(`SELECT payload FROM egg_industrial_events WHERE company_id = ?
                AND event_type = 'DESPACHO_SALIDA_LOTE' AND JSON_VALID(payload)
                AND JSON_EXTRACT(payload, '$.packaging_id') = ?`, [record.company_id, record.id]);
            let units = 0; let pounds = 0;
            const sales = new Map();
            for (const event of events) {
                const data = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
                if (!data.sale_id || !Number.isFinite(Number(data.units_deducted)) || !Number.isFinite(Number(data.lbs_deducted)) || Number(data.units_deducted) < 0 || Number(data.lbs_deducted) < 0) throw new Error(`Evento inválido del empaque ${record.id}; requiere conciliación.`);
                units += Number(data.units_deducted); pounds += Number(data.lbs_deducted);
                const sale = sales.get(data.sale_id) || { units: 0, pounds: 0 };
                sale.units += Number(data.units_deducted); sale.pounds += Number(data.lbs_deducted); sales.set(data.sale_id, sale);
            }
            for (const [saleId, sale] of sales) await connection.query('INSERT IGNORE INTO egg_packaging_movements (company_id, packaging_id, sale_id, units, weight_lbs) VALUES (?, ?, ?, ?, ?)', [record.company_id, record.id, saleId, sale.units, sale.pounds]);
            await connection.query(`UPDATE egg_packaging_records SET units_packaged = units_packaged + ?, total_batch_weight_lbs = total_batch_weight_lbs + ?,
                dispatched_units = ?, dispatched_weight_lbs = ? WHERE id = ? AND company_id = ?`, [units, pounds, units, pounds, record.id, record.company_id]);
            await connection.commit();
        } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    }
    await pool.query('ALTER TABLE egg_packaging_records MODIFY COLUMN dispatched_units DECIMAL(14,3) NOT NULL DEFAULT 0');
    const [parents] = await pool.query("SELECT id FROM menu_items WHERE path = '/industrial/planta' LIMIT 1");
    for (const [key, label] of newPermissions) {
        const [existing] = await pool.query('SELECT id FROM menu_items WHERE permission_key = ?', [key]);
        if (!existing.length) await pool.query(`INSERT INTO menu_items (label, permission_key, parent_id, icon, sort_order, is_active, hide_in_menu)
            VALUES (?, ?, ?, 'ShieldCheck', 99, 1, 1)`, [label, key, parents[0]?.id || null]);
    }
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    for (const role of roles) {
        let permissions = role.permissions;
        for (let i = 0; i < 2 && typeof permissions === 'string'; i++) permissions = JSON.parse(permissions);
        if (permissions == null) permissions = [];
        if (!Array.isArray(permissions)) throw new Error(`Permisos inválidos en rol ${role.id}`);
        const next = new Set(permissions);
        for (const [key, , parent] of newPermissions) if (['SuperAdmin', 'Admin'].includes(role.name) || next.has(parent)) next.add(key);
        await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify([...next]), role.id]);
    }
}
module.exports = { migrate, newPermissions };
