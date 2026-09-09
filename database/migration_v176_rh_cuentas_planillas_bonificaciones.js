const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('Running migration v176 - Normalizing cuenta 02 as "BONIFICACIONES"...');

        // 1. Normalizar descripción en rh_cuentas_planillas para todas las empresas
        const [resCuentas] = await pool.query(
            "UPDATE rh_cuentas_planillas SET descripcion = 'BONIFICACIONES' WHERE codigo = '02'"
        );
        console.log(`  → Cuentas de planilla con código 02 actualizadas a 'BONIFICACIONES': ${resCuentas.affectedRows} filas.`);

        // 2. Normalizar descripción en rh_planilla_detalles donde decía VIATICOS
        const [resDetalles] = await pool.query(
            "UPDATE rh_planilla_detalles SET descripcion = 'BONIFICACIONES' WHERE codigo = '02' AND descripcion = 'VIATICOS'"
        );
        console.log(`  → Detalles de planilla existentes actualizados a 'BONIFICACIONES': ${resDetalles.affectedRows} filas.`);

        console.log('Migration v176 completed successfully.');
    } catch (error) {
        console.error('Error in migration v176:', error);
        throw error;
    }
}

module.exports = runMigration;
