const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v292] Iniciando creación de tabla de configuración de formatos bancarios por sucursal y departamento...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS rh_banco_formatos_config (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            sucursal_id INT NULL,
            departamento_id INT NULL,
            formato_banco VARCHAR(20) NOT NULL DEFAULT 'promerica',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_rh_banco_sd (company_id, sucursal_id, departamento_id),
            INDEX idx_rh_banco_comp (company_id),
            INDEX idx_rh_banco_suc (sucursal_id),
            INDEX idx_rh_banco_dep (departamento_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[Migration v292] Tabla rh_banco_formatos_config creada/verificada exitosamente.');
}

if (require.main === module) {
    up()
        .then(() => {
            console.log('[Migration v292] Completada con éxito.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration v292] Error:', err);
            process.exit(1);
        });
}

module.exports = { up };
