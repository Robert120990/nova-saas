const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v291] Iniciando congelamiento histórico de nómina (snapshots) y tabla de traslados...');

    // 1. Agregar columnas de snapshot en rh_planillas si no existen
    const [cols] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'rh_planillas' 
          AND COLUMN_NAME IN ('branch_id', 'departamento_personal_id', 'cargo_id')
    `);

    const existingCols = cols.map(c => c.COLUMN_NAME);

    if (!existingCols.includes('branch_id')) {
        await pool.query('ALTER TABLE rh_planillas ADD COLUMN branch_id INT NULL AFTER empleado_id, ADD INDEX idx_rp_branch (branch_id)');
        console.log('  → Columna branch_id agregada a rh_planillas.');
    }
    if (!existingCols.includes('departamento_personal_id')) {
        await pool.query('ALTER TABLE rh_planillas ADD COLUMN departamento_personal_id INT NULL AFTER branch_id, ADD INDEX idx_rp_depto (departamento_personal_id)');
        console.log('  → Columna departamento_personal_id agregada a rh_planillas.');
    }
    if (!existingCols.includes('cargo_id')) {
        await pool.query('ALTER TABLE rh_planillas ADD COLUMN cargo_id INT NULL AFTER departamento_personal_id, ADD INDEX idx_rp_cargo (cargo_id)');
        console.log('  → Columna cargo_id agregada a rh_planillas.');
    }

    // 2. Inicializar (backfill) el histórico existente de rh_planillas con la asignación previa de cada empleado
    const [backfill] = await pool.query(`
        UPDATE rh_planillas p
        JOIN rh_empleados e ON p.empleado_id = e.id
        SET p.branch_id = e.branch_id,
            p.departamento_personal_id = e.departamento_personal_id,
            p.cargo_id = e.cargo_id
        WHERE p.branch_id IS NULL OR p.departamento_personal_id IS NULL OR p.cargo_id IS NULL
    `);
    console.log(`  → Registros históricos de rh_planillas sellados con su sucursal, departamento y cargo: ${backfill.affectedRows} filas actualizadas.`);

    // 3. Crear tabla de historial de traslados y movimientos de personal
    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_empleado_traslados (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            empleado_id INT NOT NULL,
            fecha_efectiva DATE NOT NULL,
            branch_id_anterior INT NULL,
            branch_id_nuevo INT NULL,
            departamento_id_anterior INT NULL,
            departamento_id_nuevo INT NULL,
            cargo_id_anterior INT NULL,
            cargo_id_nuevo INT NULL,
            sueldo_anterior DECIMAL(10,2) NULL,
            sueldo_nuevo DECIMAL(10,2) NULL,
            motivo VARCHAR(255) NULL,
            observaciones TEXT NULL,
            usuario_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ret_emp (company_id, empleado_id),
            INDEX idx_ret_fecha (fecha_efectiva)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  → Tabla rh_empleado_traslados creada/verificada exitosamente.');

    console.log('[Migration v291] Migración completada con éxito.');
}

if (require.main === module) {
    up()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Error en migración v291:', err);
            process.exit(1);
        });
}

module.exports = { up };
