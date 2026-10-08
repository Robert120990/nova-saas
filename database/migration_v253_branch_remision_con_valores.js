async function migrate(pool) {
    console.log('[Migration v253] Agregando columna remision_con_valores a tabla branches...');

    const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'branches' 
          AND COLUMN_NAME = 'remision_con_valores'
    `);

    if (columns.length === 0) {
        await pool.query(`
            ALTER TABLE branches 
            ADD COLUMN remision_con_valores TINYINT(1) NOT NULL DEFAULT 0 
            AFTER omitir_digito_verificador
        `);
        console.log('[Migration v253] Columna remision_con_valores agregada exitosamente con DEFAULT 0.');
    } else {
        console.log('[Migration v253] La columna remision_con_valores ya existe en branches.');
    }

    console.log('[Migration v253] Migración v253 completada con éxito.');
}

module.exports = { migrate };
