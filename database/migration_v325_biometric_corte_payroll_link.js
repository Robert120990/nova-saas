const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Migration v325: Link rh_biometric_cortes with rh_planillas ---');

    const [cols] = await pool.query('SHOW COLUMNS FROM rh_biometric_cortes');
    const colNames = new Set(cols.map(c => c.Field));

    const toAdd = [
        { name: 'planilla_anio', ddl: 'ADD COLUMN planilla_anio SMALLINT NULL AFTER observaciones' },
        { name: 'planilla_mes', ddl: 'ADD COLUMN planilla_mes TINYINT NULL AFTER planilla_anio' },
        { name: 'planilla_quincena', ddl: "ADD COLUMN planilla_quincena VARCHAR(20) NULL AFTER planilla_mes" },
        { name: 'aplicado_planilla_at', ddl: 'ADD COLUMN aplicado_planilla_at DATETIME NULL AFTER planilla_quincena' },
        { name: 'aplicado_planilla_by', ddl: 'ADD COLUMN aplicado_planilla_by INT NULL AFTER aplicado_planilla_at' }
    ];

    for (const col of toAdd) {
        if (!colNames.has(col.name)) {
            await pool.query(`ALTER TABLE rh_biometric_cortes ${col.ddl}`);
            console.log(`✅ Columna ${col.name} agregada a rh_biometric_cortes.`);
        } else {
            console.log(`ℹ️ Columna ${col.name} ya existe en rh_biometric_cortes.`);
        }
    }

    const [indexes] = await pool.query(
        "SHOW INDEX FROM rh_biometric_cortes WHERE Key_name = 'idx_biometric_cortes_planilla_period'"
    );
    if (indexes.length === 0) {
        await pool.query(
            'CREATE INDEX idx_biometric_cortes_planilla_period ON rh_biometric_cortes (company_id, planilla_anio, planilla_mes, planilla_quincena)'
        );
        console.log('✅ Índice idx_biometric_cortes_planilla_period creado.');
    } else {
        console.log('ℹ️ Índice idx_biometric_cortes_planilla_period ya existe.');
    }

    console.log('✅ Migration v325 completada.');
}

module.exports = migrate;
