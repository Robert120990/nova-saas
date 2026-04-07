const mysql = require('mysql2/promise');
async function run() {
    try {
        const c = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'QwErTy123',
            database: 'db_sistema_saas'
        });
        
        await c.query(`
            CREATE TABLE IF NOT EXISTS sellers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                company_id INT NOT NULL,
                branch_id INT NOT NULL,
                pos_id INT,
                nombre VARCHAR(100) NOT NULL,
                password VARCHAR(255) NOT NULL,
                status ENUM('activo', 'inactivo') DEFAULT 'activo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_seller_pass (branch_id, password),
                FOREIGN KEY (company_id) REFERENCES companies(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (pos_id) REFERENCES points_of_sale(id)
            ) ENGINE=InnoDB
        `);
        
        console.log('Tabla sellers creada exitosamente');
        await c.end();
    } catch (error) {
        console.error('Error creando tabla:', error);
        process.exit(1);
    }
}
run();
