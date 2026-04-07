const mysql = require('mysql2/promise');

async function migrate() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123',
        database: 'db_sistema_saas'
    });

    try {
        console.log('Starting migration...');

        // Add columns if they don't exist
        const columns = [
            { name: 'status', definition: "ENUM('activo', 'inactivo') DEFAULT 'activo'" },
            { name: 'afecta_inventario', definition: "BOOLEAN DEFAULT TRUE" },
            { name: 'costo', definition: "DECIMAL(18, 6) DEFAULT 0" },
            { name: 'stock_minimo', definition: "DECIMAL(18, 6) DEFAULT 0" },
            { name: 'permitir_existencia_negativa', definition: "BOOLEAN DEFAULT TRUE" },
            { name: 'tipo_operacion', definition: "INT DEFAULT 1" },
            { name: 'tipo_combustible', definition: "INT DEFAULT 0" }
        ];

        for (const col of columns) {
            const [check] = await connection.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.columns 
                WHERE table_schema = 'db_sistema_saas' 
                AND table_name = 'products' 
                AND column_name = ?
            `, [col.name]);

            if (check[0].count === 0) {
                console.log(`Adding column ${col.name}...`);
                await connection.query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.definition}`);
            } else {
                console.log(`Column ${col.name} already exists.`);
            }
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
