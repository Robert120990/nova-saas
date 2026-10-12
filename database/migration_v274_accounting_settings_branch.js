const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v274: Soporte de Cuentas Contables por Sucursal ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Verificar si existe la columna branch_id en accounting_settings
        const [columns] = await conn.query("SHOW COLUMNS FROM accounting_settings LIKE 'branch_id'");
        if (columns.length === 0) {
            await conn.query('ALTER TABLE accounting_settings ADD COLUMN branch_id INT NOT NULL DEFAULT 0 AFTER company_id');
            console.log('Columna branch_id agregada a accounting_settings.');
        } else {
            console.log('Columna branch_id ya existía en accounting_settings.');
        }

        // 2. Ajustar índices para permitir unique por (company_id, branch_id, setting_key)
        const [indexes] = await conn.query('SHOW INDEX FROM accounting_settings');
        const hasCompanyBranchIndex = indexes.some(idx => idx.Key_name === 'idx_company_branch_key');
        const hasCompanyIndex = indexes.some(idx => idx.Key_name === 'idx_company_id');
        const hasOldCompanyKeyIndex = indexes.some(idx => idx.Key_name === 'idx_company_key');

        if (!hasCompanyIndex) {
            await conn.query('ALTER TABLE accounting_settings ADD INDEX idx_company_id (company_id)');
            console.log('Índice idx_company_id creado para soportar la FK de companies.');
        }

        if (!hasCompanyBranchIndex) {
            await conn.query('ALTER TABLE accounting_settings ADD UNIQUE KEY idx_company_branch_key (company_id, branch_id, setting_key)');
            await conn.query('ALTER TABLE accounting_settings ADD INDEX idx_accounting_settings_branch (branch_id)');
            console.log('Índices idx_company_branch_key e idx_accounting_settings_branch creados.');
        }

        if (hasOldCompanyKeyIndex) {
            await conn.query('ALTER TABLE accounting_settings DROP INDEX idx_company_key');
            console.log('Índice anterior idx_company_key eliminado.');
        }

        // 3. Asignar configuración actual de empresa 8 a la sucursal Puma Miraflores (ID: 4)
        const [mirafloresBranch] = await conn.query(
            "SELECT id FROM branches WHERE company_id = 8 AND (nombre LIKE '%MIRAFLORES%' OR codigo = '001') LIMIT 1"
        );
        const mirafloresId = mirafloresBranch[0]?.id || 4;

        const [updateRes] = await conn.query(
            "UPDATE accounting_settings SET branch_id = ? WHERE company_id = 8 AND setting_key LIKE 'CUENTA_%' AND branch_id = 0",
            [mirafloresId]
        );
        console.log(`Se actualizaron ${updateRes.affectedRows} cuentas por defecto asignándolas a la sucursal Puma Miraflores (ID: ${mirafloresId}).`);

        await conn.commit();
        console.log('--- Migración v274 completada con éxito ---');
    } catch (e) {
        await conn.rollback();
        console.error('Error durante la migración v274:', e);
        throw e;
    } finally {
        conn.release();
    }
}

module.exports = { migrate };
