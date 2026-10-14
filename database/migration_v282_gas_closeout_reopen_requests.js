const pool = require('../server/src/config/db');

async function migrate() {
    console.log('--- Iniciando Migración v282: Solicitudes de Reapertura de Cierres de Turno para Gasolineras ---');
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(`
            CREATE TABLE IF NOT EXISTS gas_station_closeout_reopen_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                closeout_id INT NOT NULL,
                requested_by INT NOT NULL,
                requested_by_name VARCHAR(255) NOT NULL,
                reason VARCHAR(500) DEFAULT NULL,
                status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                resolved_by VARCHAR(255) DEFAULT NULL,
                resolved_chat_id BIGINT DEFAULT NULL,
                resolved_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_closeout_status (closeout_id, status),
                INDEX idx_company_branch (company_id, branch_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await conn.commit();
        console.log('--- Migración v282 completada exitosamente: gas_station_closeout_reopen_requests creada ---');
    } catch (err) {
        await conn.rollback();
        console.error('Error en Migración v282:', err);
        throw err;
    } finally {
        conn.release();
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
