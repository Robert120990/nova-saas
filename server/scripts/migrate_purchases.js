const pool = require('../src/config/db');

async function migrate() {
    try {
        console.log('--- Comienzo de migración de Compras ---');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS purchase_headers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                usuario_id INT NOT NULL,
                provider_id INT NOT NULL,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                numero_documento VARCHAR(50),
                tipo_documento_id VARCHAR(10),
                condicion_operacion_id VARCHAR(10),
                observaciones TEXT,
                total_nosujeta DECIMAL(12,2) DEFAULT 0,
                total_exenta DECIMAL(12,2) DEFAULT 0,
                total_gravada DECIMAL(12,2) DEFAULT 0,
                iva DECIMAL(12,2) DEFAULT 0,
                retencion DECIMAL(12,2) DEFAULT 0,
                percepcion DECIMAL(12,2) DEFAULT 0,
                monto_total DECIMAL(12,2) DEFAULT 0,
                status ENUM('COMPLETADO', 'ANULADO') DEFAULT 'COMPLETADO',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX (company_id),
                INDEX (branch_id),
                INDEX (provider_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Tabla purchase_headers creada o ya existente.');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS purchase_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                purchase_id INT NOT NULL,
                product_id INT NOT NULL,
                cantidad DECIMAL(12,4) NOT NULL,
                precio_unitario DECIMAL(12,4) NOT NULL,
                total DECIMAL(12,4) NOT NULL,
                INDEX (purchase_id),
                INDEX (product_id),
                CONSTRAINT fk_purchase FOREIGN KEY (purchase_id) REFERENCES purchase_headers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('Tabla purchase_items creada o ya existente.');

        console.log('--- Migración de Compras finalizada con éxito ---');
        process.exit(0);
    } catch (err) {
        console.error('Error en la migración:', err);
        process.exit(1);
    }
}

migrate();
