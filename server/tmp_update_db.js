const mysql = require('mysql2/promise');

async function updateDb() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123',
        database: 'db_sistema_saas'
    });

    console.log('Connected to database.');

    async function columnExists(table, column) {
        const [rows] = await connection.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.columns 
            WHERE table_schema = 'db_sistema_saas' 
            AND table_name = ? 
            AND column_name = ?
        `, [table, column]);
        return rows[0].count > 0;
    }

    async function addColumn(table, column, definition) {
        if (!(await columnExists(table, column))) {
            console.log(`Adding ${column} to ${table}...`);
            await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } else {
            console.log(`Column ${column} already exists in ${table}.`);
        }
    }

    try {
        // 1. Update sales_headers
        await addColumn('sales_headers', 'dte_type', 'VARCHAR(2) AFTER dte_id');
        await addColumn('sales_headers', 'payment_condition', 'INT DEFAULT 1');
        await addColumn('sales_headers', 'export_item_type', 'INT NULL');
        await addColumn('sales_headers', 'fiscal_enclosure', 'VARCHAR(2) NULL');
        await addColumn('sales_headers', 'export_regime', 'VARCHAR(2) NULL');
        await addColumn('sales_headers', 'dest_country_code', 'VARCHAR(4) NULL');
        await addColumn('sales_headers', 'remission_type', 'VARCHAR(2) NULL');
        await addColumn('sales_headers', 'transporter_name', 'VARCHAR(100) NULL');
        await addColumn('sales_headers', 'vehicle_plate', 'VARCHAR(20) NULL');

        // 2. Update sales_items
        await addColumn('sales_items', 'retention_type', 'VARCHAR(2) NULL');
        await addColumn('sales_items', 'retention_code', 'VARCHAR(10) NULL');
        await addColumn('sales_items', 'retention_amount', 'DECIMAL(16,2) DEFAULT 0.00');
        await addColumn('sales_items', 'retention_base', 'DECIMAL(16,2) DEFAULT 0.00');

        // 3. Create sales_linked_documents
        console.log('Creating sales_linked_documents table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sales_linked_documents (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                sale_id BIGINT NOT NULL,
                doc_type VARCHAR(2) NOT NULL,
                doc_number VARCHAR(36) NOT NULL,
                emission_date DATE NOT NULL,
                generation_type INT DEFAULT 2,
                FOREIGN KEY (sale_id) REFERENCES sales_headers(id) ON DELETE CASCADE
            );
        `);

        console.log('Database updated successfully.');
    } catch (error) {
        console.error('Error updating database:', error);
    } finally {
        await connection.end();
    }
}

updateDb();
