require('dotenv').config({ path: './server/.env' });
const pool = require('./src/config/db');

async function createTables() {
    try {
        console.log('Creando tablas de inventario físico...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS physical_inventories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                fecha DATE NOT NULL,
                responsable VARCHAR(255),
                observaciones TEXT,
                status ENUM('PENDIENTE', 'APLICADO', 'ANULADO') DEFAULT 'PENDIENTE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS physical_inventory_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                physical_inventory_id INT NOT NULL,
                product_id INT NOT NULL,
                stock_sistema DECIMAL(10,2) DEFAULT 0,
                stock_fisico DECIMAL(10,2) DEFAULT 0,
                diferencia DECIMAL(10,2) DEFAULT 0,
                costo DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) DEFAULT 0,
                FOREIGN KEY (physical_inventory_id) REFERENCES physical_inventories(id) ON DELETE CASCADE
            )
        `);

        console.log('Tablas creadas con éxito');
        process.exit(0);
    } catch (error) {
        console.error('Error al crear tablas:', error);
        process.exit(1);
    }
}

createTables();
