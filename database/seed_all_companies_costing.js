const path = require('path');
const mysql = require(path.join(__dirname, '../server/node_modules/mysql2/promise'));
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });

async function seedAllCompanies() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  try {
    const [companies] = await pool.query('SELECT id, razon_social FROM companies');
    console.log('Found companies:', companies.map(c => c.id + ': ' + c.razon_social));

    for (const comp of companies) {
      const compId = comp.id;
      
      // 1. Configs
      const [existingConf] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_configurations WHERE company_id = ?', [compId]);
      if (existingConf[0].c === 0) {
        console.log('Seeding configurations for company', compId);
        await pool.query(`
          INSERT INTO egg_costing_configurations (company_id, setting_key, setting_label, setting_value, unit_label, category)
          VALUES 
            (?, 'monthly_gif_total', 'Gastos Indirectos de Fabricación (GIF) Mensual', 24537.0000, 'USD/mes', 'gif'),
            (?, 'monthly_projected_lbs', 'Volumen Base Mensual Proyectado', 100000.0000, 'LBS', 'gif'),
            (?, 'boiler_diesel_gal_batch', 'Consumo Diesel Caldera por Batch', 20.8400, 'Galones', 'boiler'),
            (?, 'boiler_diesel_price_gal', 'Precio Diesel por Galón', 4.1400, 'USD/Gal', 'boiler'),
            (?, 'boiler_kwh_cost_batch', 'Costo Electricidad Pasteurizador/Caldera', 386.0000, 'USD/batch', 'boiler'),
            (?, 'boiler_water_cost_batch', 'Costo Agua Suavizada Caldera', 17.3400, 'USD/batch', 'boiler'),
            (?, 'mod_cost_per_lb', 'Mano de Obra Directa (MOD) por Libra', 0.0500, 'USD/LB', 'labor'),
            (?, 'he_plus_citric_acid_pct', 'Dosis Ácido Cítrico HE Plus', 0.0010, '% p/p', 'additive'),
            (?, 'yolk_sugar_pct', 'Porcentaje Azúcar Yema Azucarada', 0.0400, '% p/p', 'additive'),
            (?, 'standard_batch_weight_lbs', 'Peso Batch Estándar', 12000.0000, 'LBS', 'production')
        `, [compId, compId, compId, compId, compId, compId, compId, compId, compId, compId]);
      }

      // 2. CIP Items
      const [existingCip] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_cip_items WHERE company_id = ?', [compId]);
      if (existingCip[0].c === 0) {
        console.log('Seeding CIP items for company', compId);
        await pool.query(`
          INSERT INTO egg_costing_cip_items (company_id, item_name, presentation_qty, presentation_unit, presentation_cost, dose_per_batch, dose_unit)
          VALUES
            (?, 'Soda Cáustica (Hidróxido de Sodio)', 250.00, 'kg', 262.50, 15.000, 'kg'),
            (?, 'Hipoclorito de Sodio 13%', 55.00, 'gal', 66.00, 3.500, 'gal'),
            (?, 'Ácido Fosfórico / Nítrico (Desincrustante)', 60.00, 'kg', 145.00, 4.000, 'kg'),
            (?, 'Detergente Espumante Clean Foam', 20.00, 'kg', 55.00, 2.000, 'kg')
        `, [compId, compId, compId, compId]);
      }

      // 3. Packaging Items
      const [existingPack] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_packaging WHERE company_id = ?', [compId]);
      if (existingPack[0].c === 0) {
        console.log('Seeding Packaging for company', compId);
        await pool.query(`
          INSERT INTO egg_costing_packaging (company_id, item_code, item_name, unit_cost, category)
          VALUES
            (?, 'CUBETA-30LB', 'Cubeta Plástica Blanca 30 LBS Grado Alimenticio', 2.4000, 'recipiente'),
            (?, 'TAPA-30LB', 'Tapadera Hermética para Cubeta 30 LBS', 0.6500, 'tapadera'),
            (?, 'LINER-30LB', 'Bolsa Plástica Liner Polietileno Virgen', 0.3000, 'liner'),
            (?, 'ETIQ-4X2', 'Etiqueta Térmica Polipropileno 4x2 Pulgadas', 0.0350, 'etiqueta'),
            (?, 'ETIQ-4X4', 'Etiqueta Térmica de Lote y Trazabilidad 4x4 Pulgadas', 0.0500, 'etiqueta'),
            (?, 'GALON-8LB', 'Envase Plástico Galón 8 LBS con Asa', 0.8500, 'recipiente'),
            (?, 'TAPA-GALON', 'Tapa con Sello de Seguridad para Galón', 0.1500, 'tapadera')
        `, [compId, compId, compId, compId, compId, compId, compId]);
      }

      // 4. Customer Agreements
      const [existingAgr] = await pool.query('SELECT COUNT(*) as c FROM egg_costing_customer_agreements WHERE company_id = ?', [compId]);
      if (existingAgr[0].c === 0) {
        console.log('Seeding Agreements for company', compId);
        await pool.query(`
          INSERT INTO egg_costing_customer_agreements (company_id, customer_name, product_type, presentation, agreed_price_per_lb, monthly_volume_lbs, target_margin_pct, notes)
          VALUES
            (?, 'PriceSmart El Salvador', 'Huevo Entero Pasteurizado', 'cubeta 30LB', 1.1900, 35000.00, 22.00, 'Contrato corporativo, entrega refrigerada en centros de distribución'),
            (?, 'Panadería y Pastelería Lorena', 'Huevo Entero Plus', 'cubeta 30LB', 1.0500, 20000.00, 18.00, 'Despacho semanal, devolución de cubetas'),
            (?, 'Cocina de Vuelos (Gate Gourmet)', 'Huevo con Leche Pasteurizado', 'galón 8LB', 1.2000, 15000.00, 25.00, 'Especificación de vuelo, empaque galón con sello'),
            (?, 'Denny\\'s El Salvador', 'Clara de Huevo Pasteurizada', 'galón 8LB', 1.5000, 10000.00, 28.00, 'Menú fit / desayunos proteicos'),
            (?, 'Denny\\'s El Salvador', 'Huevo Entero Pasteurizado', 'cubeta 30LB', 1.3500, 12000.00, 24.00, 'Consumo cocina central'),
            (?, 'Panadería La Francesa', 'Yema Azucarada', 'cubeta 30LB', 1.1500, 8000.00, 20.00, 'Uso repostería fina')
        `, [compId, compId, compId, compId, compId, compId]);
      }
    }

    console.log('✅ All companies seeded successfully!');
  } finally {
    await pool.end();
  }
}

seedAllCompanies().catch(err => {
  console.error('❌ Error seeding companies:', err);
  process.exit(1);
});
