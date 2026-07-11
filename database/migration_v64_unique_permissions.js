const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

// Map old shared permission IDs → new unique permission IDs
const EXPANSIONS = {
  manage_sales: [
    'manage_pos_terminal',
    'manage_fuel_prices',
    'manage_customer_discounts',
    'manage_discount_rules',
    'manage_dte_contingency',
    'manage_dte_return',
    'manage_cash_closure',
    'view_sales_report',
    'view_daily_sales_report',
    'view_sales_by_category',
    'view_sales_by_pos',
    'manage_account_chart',
    'manage_accounting_entries',
    'manage_annual_close',
    'manage_fiscal_year_open',
    'manage_accounting_adjustments',
    'manage_cxc_payments',
    'view_ccf_sales_ledger',
    'view_fac_sales_ledger',
  ],
  view_sales: [
    'view_sales_history',
    'view_customer_statement',
    'view_cxc_balances',
    'view_cxc_pending_docs',
  ],
  manage_purchases: [
    'manage_purchases_list',
    'manage_expenses',
    'view_purchases_report',
    'view_expenses_report',
    'view_provider_statement',
    'manage_cxp_payments',
    'view_cxp_balances',
    'view_cxp_pending_docs',
    'view_purchase_ledger',
    'manage_mp_reception',
    'manage_industrial_costs',
  ],
  manage_kardex: [
    'manage_kardex',
    'view_stock_report',
    'view_movement_report',
    'manage_traceability',
  ],
  manage_transfers: [
    'manage_transfers',
    'manage_production',
  ],
  manage_physical_inventory: [
    'manage_physical_inventory',
    'manage_packaging',
  ],
  manage_gas_station: [
    'manage_gas_distributors',
    'manage_gas_islands',
    'manage_gas_nozzles',
    'manage_gas_tanks',
    'manage_gas_expense_categories',
    'manage_gas_attendants',
    'manage_gas_attendant_nozzles',
    'manage_gas_pos_types',
    'manage_gas_readings_closure',
    'view_gas_readings_history',
    'manage_gas_advances',
    'manage_gas_settings',
    'manage_gas_remesa_delivery',
    'view_gas_reports',
  ],
  view_dashboard: [
    'view_dashboard',
    'view_industrial_dashboard',
  ],
  manage_system: [
    'manage_system',
    'manage_industrial_settings',
  ],
};

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Connected to database');

    // Read all roles
    const [roles] = await pool.query('SELECT id, name, permissions FROM roles');
    console.log(`Found ${roles.length} roles to process`);

    let updatedCount = 0;

    for (const role of roles) {
      let perms = role.permissions;
      if (typeof perms === 'string') {
        try {
          perms = JSON.parse(perms);
        } catch (e) {
          console.log(`  Role ${role.name} (id=${role.id}): cannot parse permissions, skipping`);
          continue;
        }
      }
      if (!Array.isArray(perms)) {
        console.log(`  Role ${role.name} (id=${role.id}): permissions is not an array, skipping`);
        continue;
      }

      const originalLength = perms.length;
      const newPerms = new Set();

      for (const perm of perms) {
        const expansion = EXPANSIONS[perm];
        if (expansion) {
          for (const np of expansion) {
            newPerms.add(np);
          }
        } else {
          newPerms.add(perm);
        }
      }

      const finalPerms = Array.from(newPerms);

      if (finalPerms.length !== originalLength) {
        await pool.query(
          'UPDATE roles SET permissions = ? WHERE id = ?',
          [JSON.stringify(finalPerms), role.id]
        );
        console.log(`  Role "${role.name}" (id=${role.id}): ${originalLength} → ${finalPerms.length} permissions`);
        updatedCount++;
      } else {
        console.log(`  Role "${role.name}" (id=${role.id}): no changes`);
      }
    }

    console.log(`\nMigration complete: ${updatedCount} roles updated`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
