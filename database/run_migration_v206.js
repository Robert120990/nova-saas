const pool = require('../server/src/config/db');

async function runMigration() {
    try {
        console.log('--- Migración v206: Optimización de Índices para Customers y Providers ---');

        // 1. Índices para customers
        const [custIndexes] = await pool.query('SHOW INDEX FROM customers');
        const custIndexNames = new Set(custIndexes.map(i => i.Key_name));

        if (!custIndexNames.has('idx_customers_company_nombre')) {
            console.log('  → Creando índice idx_customers_company_nombre...');
            await pool.query('ALTER TABLE customers ADD INDEX idx_customers_company_nombre (company_id, nombre)');
            console.log('  ✓ Índice idx_customers_company_nombre creado.');
        } else {
            console.log('  ✓ Índice idx_customers_company_nombre ya existe.');
        }

        if (!custIndexNames.has('idx_customers_company_nit')) {
            console.log('  → Creando índice idx_customers_company_nit...');
            await pool.query('ALTER TABLE customers ADD INDEX idx_customers_company_nit (company_id, nit)');
            console.log('  ✓ Índice idx_customers_company_nit creado.');
        } else {
            console.log('  ✓ Índice idx_customers_company_nit ya existe.');
        }

        if (!custIndexNames.has('idx_customers_company_nrc')) {
            console.log('  → Creando índice idx_customers_company_nrc...');
            await pool.query('ALTER TABLE customers ADD INDEX idx_customers_company_nrc (company_id, nrc)');
            console.log('  ✓ Índice idx_customers_company_nrc creado.');
        } else {
            console.log('  ✓ Índice idx_customers_company_nrc ya existe.');
        }

        if (!custIndexNames.has('idx_customers_company_numdoc')) {
            console.log('  → Creando índice idx_customers_company_numdoc...');
            await pool.query('ALTER TABLE customers ADD INDEX idx_customers_company_numdoc (company_id, numero_documento)');
            console.log('  ✓ Índice idx_customers_company_numdoc creado.');
        } else {
            console.log('  ✓ Índice idx_customers_company_numdoc ya existe.');
        }

        // 2. Índices para providers
        const [provIndexes] = await pool.query('SHOW INDEX FROM providers');
        const provIndexNames = new Set(provIndexes.map(i => i.Key_name));

        if (!provIndexNames.has('idx_providers_company_nombre')) {
            console.log('  → Creando índice idx_providers_company_nombre...');
            await pool.query('ALTER TABLE providers ADD INDEX idx_providers_company_nombre (company_id, nombre)');
            console.log('  ✓ Índice idx_providers_company_nombre creado.');
        } else {
            console.log('  ✓ Índice idx_providers_company_nombre ya existe.');
        }

        if (!provIndexNames.has('idx_providers_company_nit')) {
            console.log('  → Creando índice idx_providers_company_nit...');
            await pool.query('ALTER TABLE providers ADD INDEX idx_providers_company_nit (company_id, nit)');
            console.log('  ✓ Índice idx_providers_company_nit creado.');
        } else {
            console.log('  ✓ Índice idx_providers_company_nit ya existe.');
        }

        if (!provIndexNames.has('idx_providers_company_nrc')) {
            console.log('  → Creando índice idx_providers_company_nrc...');
            await pool.query('ALTER TABLE providers ADD INDEX idx_providers_company_nrc (company_id, nrc)');
            console.log('  ✓ Índice idx_providers_company_nrc creado.');
        } else {
            console.log('  ✓ Índice idx_providers_company_nrc ya existe.');
        }

        console.log('--- Migración v206 completada exitosamente. ---');
        process.exit(0);
    } catch (error) {
        console.error('Error en migración v206:', error);
        process.exit(1);
    }
}

runMigration();
