const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  try {
    const [branchRows] = await pool.query('SELECT id FROM branches ORDER BY id LIMIT 1');
    if (branchRows.length === 0) throw new Error('No branches found');
    const backfill = branchRows[0].id;
    console.log('Backfill branch ID:', backfill);

    // Helper: check if column exists
    const hasColumn = async (table, col) => {
      const [rows] = await pool.query(`DESCRIBE \`${table}\``);
      return rows.some(r => r.Field === col);
    };

    // Helper: check if index exists
    const hasIndex = async (table, idx) => {
      const [rows] = await pool.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [idx]);
      return rows.length > 0;
    };

    // Helper: check if FK constraint exists by name
    const hasFK = async (table, fk) => {
      const [rows] = await pool.query(`
        SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      `, [process.env.DB_NAME, table, fk]);
      return rows.length > 0;
    };

    // Helper: check if any FK exists on a column
    const hasFKOnColumn = async (table, column) => {
      const [rows] = await pool.query(`
        SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [process.env.DB_NAME, table, column]);
      return rows.length > 0;
    };

    const configs = [
      {
        table: 'gas_station_distributors',
        oldIndex: 'uq_distributor_company_code',
        newIndex: 'uq_distributor_company_branch_code',
        fkSelf1: 'gas_station_distributors_ibfk_1', // company_id
        fkSelf2: 'gas_station_distributors_ibfk_2', // branch_id (may exist from partial run)
        hasUniq: true
      },
      {
        table: 'gas_station_islands',
        oldIndex: 'uq_island_company_code',
        newIndex: 'uq_island_company_branch_code',
        fkSelf1: 'gas_station_islands_ibfk_1',
        fkSelf2: null,
        hasUniq: true
      },
      {
        table: 'gas_station_nozzles',
        oldIndex: 'uq_nozzle_company_code',
        newIndex: 'uq_nozzle_company_branch_code',
        fkSelf1: 'gas_station_nozzles_ibfk_1',
        fkSelf2: 'gas_station_nozzles_ibfk_2',
        fkSelf3: 'gas_station_nozzles_ibfk_3',
        hasUniq: true
      },
      {
        table: 'gas_station_tanks',
        oldIndex: 'uq_tank_company_code',
        newIndex: 'uq_tank_company_branch_code',
        fkSelf1: 'gas_station_tanks_ibfk_1',
        fkSelf2: null,
        hasUniq: true
      },
      {
        table: 'gas_station_expense_categories',
        oldIndex: null,
        newIndex: null,
        fkSelf1: 'gas_station_expense_categories_ibfk_1',
        fkSelf2: null,
        hasUniq: false
      },
      {
        table: 'gas_station_despachadores',
        oldIndex: 'uq_company_codigo',
        newIndex: 'uq_company_branch_codigo',
        fkSelf1: 'gas_station_despachadores_ibfk_1',
        fkSelf2: null,
        hasUniq: true
      },
      {
        table: 'gas_station_despachador_nozzles',
        oldIndex: null,
        newIndex: null,
        fkSelf1: 'gas_station_despachador_nozzles_ibfk_1',
        fkSelf2: 'gas_station_despachador_nozzles_ibfk_2',
        fkSelf3: 'gas_station_despachador_nozzles_ibfk_3',
        hasUniq: false
      },
      {
        table: 'gas_station_pos_types',
        oldIndex: 'uq_company_pos_type',
        newIndex: 'uq_company_branch_pos_type',
        fkSelf1: 'gas_station_pos_types_ibfk_1',
        fkSelf2: null,
        hasUniq: true
      }
    ];

    // Step 1: Drop all FK constraints that might block index changes
    console.log('\n--- Step 1: Dropping FK constraints ---');
    for (const c of configs) {
      for (const fk of [c.fkSelf1, c.fkSelf2, c.fkSelf3]) {
        if (fk && await hasFK(c.table, fk)) {
          await pool.query(`ALTER TABLE \`${c.table}\` DROP FOREIGN KEY \`${fk}\``);
          console.log(`  ${c.table}: DROP FOREIGN KEY ${fk}`);
        }
      }
    }

    // Step 2: Drop old unique indexes
    console.log('\n--- Step 2: Dropping old unique indexes ---');
    for (const c of configs) {
      if (c.oldIndex && await hasIndex(c.table, c.oldIndex)) {
        await pool.query(`ALTER TABLE \`${c.table}\` DROP INDEX \`${c.oldIndex}\``);
        console.log(`  ${c.table}: DROP INDEX ${c.oldIndex}`);
      }
    }

    // Step 3: Add branch_id column + backfill + FK + new unique key
    console.log('\n--- Step 3: Adding branch_id ---');
    for (const c of configs) {
      if (await hasColumn(c.table, 'branch_id')) {
        console.log(`  ${c.table}: branch_id already exists, skipping ADD COLUMN`);
      } else {
        await pool.query(`ALTER TABLE \`${c.table}\` ADD COLUMN branch_id INT NOT NULL AFTER company_id`);
        console.log(`  ${c.table}: ADD COLUMN branch_id`);
      }

      // Backfill
      await pool.query(`UPDATE \`${c.table}\` SET branch_id = ? WHERE branch_id = 0 OR branch_id IS NULL`, [backfill]);
      console.log(`  ${c.table}: backfilled to branch ${backfill}`);

      // Add FK to branches (if not already exists)
      if (!await hasFKOnColumn(c.table, 'branch_id')) {
        const fkName = `fk_${c.table}_branch`.replace(/[^a-zA-Z0-9_]/g, '_');
        await pool.query(`ALTER TABLE \`${c.table}\` ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT`);
        console.log(`  ${c.table}: ADD FK branch_id -> branches(id) as ${fkName}`);
      } else {
        console.log(`  ${c.table}: FK on branch_id already exists`);
      }

      // Add new unique key
      if (c.newIndex && !await hasIndex(c.table, c.newIndex)) {
        const cols = c.table === 'gas_station_pos_types' ? '(company_id, branch_id, nombre)' : '(company_id, branch_id, codigo)';
        await pool.query(`ALTER TABLE \`${c.table}\` ADD UNIQUE KEY \`${c.newIndex}\` ${cols}`);
        console.log(`  ${c.table}: ADD UNIQUE KEY ${c.newIndex} ${cols}`);
      }
    }

    // Step 4: Re-add all FK constraints
    console.log('\n--- Step 4: Re-adding FK constraints ---');
    for (const c of configs) {
      // Re-add FK on company_id
      if (!await hasFKOnColumn(c.table, 'company_id')) {
        const fk1Name = `fk_${c.table}_company`.replace(/[^a-zA-Z0-9_]/g, '_');
        await pool.query(`ALTER TABLE \`${c.table}\` ADD CONSTRAINT \`${fk1Name}\` FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`);
        console.log(`  ${c.table}: ADD FK company_id -> companies(id) as ${fk1Name}`);
      }

      // Re-add island_id FK for nozzles
      if (c.table === 'gas_station_nozzles') {
        await pool.query('ALTER TABLE gas_station_nozzles ADD FOREIGN KEY (island_id) REFERENCES gas_station_islands(id) ON DELETE RESTRICT');
        console.log('  gas_station_nozzles: ADD FK island_id -> gas_station_islands(id)');
        await pool.query('ALTER TABLE gas_station_nozzles ADD FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT');
        console.log('  gas_station_nozzles: ADD FK product_id -> products(id)');
      }

      // Re-add despachador_id and nozzle_id FKs for despachador_nozzles
      if (c.table === 'gas_station_despachador_nozzles') {
        await pool.query('ALTER TABLE gas_station_despachador_nozzles ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE CASCADE');
        console.log('  gas_station_despachador_nozzles: ADD FK despachador_id -> gas_station_despachadores(id)');
        await pool.query('ALTER TABLE gas_station_despachador_nozzles ADD FOREIGN KEY (nozzle_id) REFERENCES gas_station_nozzles(id) ON DELETE CASCADE');
        console.log('  gas_station_despachador_nozzles: ADD FK nozzle_id -> gas_station_nozzles(id)');
      }
    }

    // Step 5: Re-add child FK constraints (from gas_station_closeout_* tables)
    console.log('\n--- Step 5: Re-adding child FK constraints ---');
    const childFKs = [
      // References to gas_station_distributors
      'ALTER TABLE gas_station_closeout_cupones ADD FOREIGN KEY (distribuidora_id) REFERENCES gas_station_distributors(id) ON DELETE RESTRICT',

      // References to gas_station_despachadores
      'ALTER TABLE gas_station_closeout_adelantos ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_anticipos_despachados ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_creditos ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_cupones ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_descuentos ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_despachadores ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_expenses ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_remesas ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_tarjetas ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',
      'ALTER TABLE gas_station_closeout_vales ADD FOREIGN KEY (despachador_id) REFERENCES gas_station_despachadores(id) ON DELETE RESTRICT',

      // References to gas_station_nozzles
      'ALTER TABLE gas_station_closeout_readings ADD FOREIGN KEY (nozzle_id) REFERENCES gas_station_nozzles(id) ON DELETE RESTRICT',

      // References to gas_station_tanks
      'ALTER TABLE gas_station_closeout_tank_readings ADD FOREIGN KEY (tank_id) REFERENCES gas_station_tanks(id) ON DELETE RESTRICT',

      // References to gas_station_pos_types
      'ALTER TABLE gas_station_closeout_tarjetas ADD FOREIGN KEY (pos_type_id) REFERENCES gas_station_pos_types(id) ON DELETE RESTRICT',
    ];

    for (const stmt of childFKs) {
      try {
        await pool.query(stmt);
        console.log(`  ${stmt.slice(0, 80)}... OK`);
      } catch (e) {
        if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_FK_DUP_NAME') {
          console.log(`  ${stmt.slice(0, 80)}... already exists`);
        } else {
          console.log(`  ${stmt.slice(0, 80)}... ERROR: ${e.message}`);
        }
      }
    }

    console.log('\n=== Migration v63 completed successfully ===');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
