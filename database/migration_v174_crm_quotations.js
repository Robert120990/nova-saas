const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('Running migration v174 - Creating CRM Quotations tables and menus...');

        // 1. Crear tabla crm_quotations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_quotations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                quote_number VARCHAR(50) NOT NULL,
                customer_id INT NULL,
                customer_name VARCHAR(200) NOT NULL,
                customer_contact VARCHAR(150) NULL,
                customer_email VARCHAR(150) NULL,
                customer_phone VARCHAR(50) NULL,
                customer_address VARCHAR(255) NULL,
                customer_nrc VARCHAR(30) NULL,
                customer_nit VARCHAR(30) NULL,
                date DATE NOT NULL,
                validity_days INT NOT NULL DEFAULT 30,
                expiration_date DATE NOT NULL,
                payment_terms VARCHAR(100) DEFAULT 'Contado',
                delivery_time VARCHAR(100) DEFAULT 'Entrega inmediata / según programación',
                currency VARCHAR(10) DEFAULT 'USD',
                subtotal DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                tax_amount DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                total DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                total_cost DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                overall_margin_pct DECIMAL(7, 2) NOT NULL DEFAULT 0.00,
                is_delicate TINYINT(1) NOT NULL DEFAULT 0,
                delicate_reason VARCHAR(255) NULL,
                status ENUM('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida') NOT NULL DEFAULT 'borrador',
                our_commitments TEXT NULL,
                notes TEXT NULL,
                signature_data LONGTEXT NULL,
                signature_author_name VARCHAR(150) NULL,
                signature_author_title VARCHAR(150) NULL,
                signature_author_phone VARCHAR(50) NULL,
                signature_date DATETIME NULL,
                converted_agreement_id INT NULL,
                created_by INT NULL,
                created_by_name VARCHAR(150) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_cq_comp (company_id),
                INDEX idx_cq_cust (customer_id),
                INDEX idx_cq_num (quote_number),
                INDEX idx_cq_status (status),
                INDEX idx_cq_date (date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla crm_quotations creada o verificada.');

        // 2. Crear tabla crm_quotation_items
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_quotation_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quotation_id INT NOT NULL,
                product_id INT NULL,
                product_code VARCHAR(50) NULL,
                product_name VARCHAR(200) NOT NULL,
                presentation VARCHAR(100) NOT NULL,
                quantity DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
                unit_measure VARCHAR(50) DEFAULT 'LB',
                current_cost DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                unit_price DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                suggested_price DECIMAL(14, 4) NULL,
                margin_pct DECIMAL(7, 2) NOT NULL DEFAULT 0.00,
                is_delicate TINYINT(1) NOT NULL DEFAULT 0,
                discount_amount DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                notes VARCHAR(255) NULL,
                subtotal DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                total DECIMAL(14, 4) NOT NULL DEFAULT 0.0000,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cqi_quot (quotation_id),
                INDEX idx_cqi_prod (product_id),
                CONSTRAINT fk_cqi_quot FOREIGN KEY (quotation_id) REFERENCES crm_quotations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Tabla crm_quotation_items creada o verificada.');

        // 3. Añadir columnas de firma y teléfono a users si no existen
        const [userCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'signature_data'");
        if (userCols.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN signature_data LONGTEXT NULL");
            console.log('✓ Columna signature_data agregada a users.');
        }

        const [titleCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'signature_title'");
        if (titleCols.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN signature_title VARCHAR(150) NULL");
            console.log('✓ Columna signature_title agregada a users.');
        }

        const [phoneCols] = await pool.query("SHOW COLUMNS FROM users LIKE 'phone'");
        if (phoneCols.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN phone VARCHAR(50) NULL");
            console.log('✓ Columna phone agregada a users.');
        }

        // 4. Agregar permisos en tabla permissions si existe
        try {
            await pool.query(`
                INSERT IGNORE INTO permissions (id, name, description, module)
                VALUES 
                    ('manage_crm_quotes', 'Gestionar Cotizaciones', 'Crear, editar, aprobar y generar PDF de cotizaciones', 'crm'),
                    ('view_crm_quotes', 'Ver Cotizaciones', 'Consultar cotizaciones comerciales', 'crm')
            `);
            console.log('✓ Permisos de cotizaciones registrados.');
        } catch (pErr) {
            console.warn('Nota en permisos:', pErr.message);
        }

        // 5. Vincular menú en menu_items
        const [[crmParent]] = await pool.query(
            "SELECT id FROM menu_items WHERE label = 'CRM' AND parent_id IS NULL LIMIT 1"
        );

        let crmParentId = crmParent ? crmParent.id : null;
        if (!crmParentId) {
            const [resParent] = await pool.query(`
                INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order)
                VALUES ('CRM', '/crm/cotizaciones', 'Handshake', 'manage_crm_quotes', NULL, 6)
            `);
            crmParentId = resParent.insertId;
            console.log('✓ Grupo CRM raíz creado (id=' + crmParentId + ').');
        }

        const [[existingMenuItem]] = await pool.query(
            "SELECT id FROM menu_items WHERE path = '/crm/cotizaciones' LIMIT 1"
        );

        if (!existingMenuItem) {
            await pool.query(`
                INSERT INTO menu_items (label, path, icon, permission_key, parent_id, sort_order)
                VALUES ('Cotizador Comercial', '/crm/cotizaciones', 'FileText', 'manage_crm_quotes', ?, 1)
            `, [crmParentId]);
            console.log('✓ Menú "Cotizador Comercial" insertado.');
        } else {
            await pool.query(`
                UPDATE menu_items 
                SET label = 'Cotizador Comercial', icon = 'FileText', permission_key = 'manage_crm_quotes', sort_order = 1
                WHERE id = ?
            `, [existingMenuItem.id]);
            console.log('✓ Menú "Cotizador Comercial" actualizado.');
        }

        console.log('Migration v174 completed successfully.');
    } catch (err) {
        console.error('Error en migración v174:', err);
        throw err;
    }
}

module.exports = runMigration;
