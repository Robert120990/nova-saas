const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    let pool;
    try {
        pool = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'db_sistema_saas',
            waitForConnections: true,
            connectionLimit: 5
        });

        console.log('--- Iniciando Migración v169: Parametrización de Prefijos de Lote por Proveedor ---');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`egg_provider_lot_configurations\` (
                \`id\` INT AUTO_INCREMENT PRIMARY KEY,
                \`company_id\` INT NOT NULL,
                \`provider_id\` INT NOT NULL,
                \`lot_prefix\` VARCHAR(50) NOT NULL,
                \`format_pattern\` VARCHAR(50) NOT NULL DEFAULT 'PREFIX-DATE',
                \`next_correlative\` INT NOT NULL DEFAULT 1,
                \`notes\` VARCHAR(255) NULL,
                \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY \`uq_egg_prov_lot\` (\`company_id\`, \`provider_id\`),
                INDEX \`idx_egg_prov_lot_company\` (\`company_id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log("✓ Tabla 'egg_provider_lot_configurations' verificada/creada.");

        // Modificar columna temperature_c para permitir valores nulos/opcionales
        await pool.query("ALTER TABLE `egg_raw_materials` MODIFY COLUMN `temperature_c` DECIMAL(5,2) NULL DEFAULT NULL;");
        console.log("✓ Columna 'temperature_c' modificada a NULL DEFAULT NULL en egg_raw_materials.");

        // Sembrar prefijos iniciales para empresas con proveedores avícolas conocidos (como Don Héctor, Candy, Granja)
        const [providers] = await pool.query(`
            SELECT id, company_id, nombre, nombre_comercial 
            FROM providers 
            WHERE nombre LIKE '%hector%' OR nombre LIKE '%candy%' OR nombre LIKE '%granja%' OR nombre LIKE '%avicola%'
        `);

        for (const p of providers) {
            let prefix = 'LOTE-PROV';
            const full = (p.nombre + ' ' + (p.nombre_comercial || '')).toUpperCase();
            if (full.includes('HECTOR') || full.includes('HÉCTOR')) prefix = 'HD-25918';
            else if (full.includes('CANDY')) prefix = 'GC-CANDY';
            else if (full.includes('GRANJA') || full.includes('AVICOLA') || full.includes('AVÍCOLA')) prefix = 'LOTE-AV';

            await pool.query(`
                INSERT IGNORE INTO egg_provider_lot_configurations 
                (company_id, provider_id, lot_prefix, format_pattern, next_correlative, notes)
                VALUES (?, ?, ?, 'PREFIX-DATE', 1, 'Auto-sembrado inicial de planta')
            `, [p.company_id, p.id, prefix]);
        }
        console.log(`✓ Prefijos base vinculados para ${providers.length} proveedores avícolas detectados.`);

        console.log('--- Migración v169 completada exitosamente ---');
        process.exit(0);
    } catch (error) {
        console.error('Error durante migración v169:', error);
        process.exit(1);
    } finally {
        if (pool) await pool.end();
    }
}

runMigration();
