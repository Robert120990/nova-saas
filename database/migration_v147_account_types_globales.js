const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Convirtiendo account_types en tabla GLOBAL (elimina company_id)...');

    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_types' AND COLUMN_NAME = 'company_id'`
    );
    if (cols.length === 0) {
      console.log('  → La columna company_id ya no existe, saltando');
      await pool.end();
      return;
    }

    const [fks] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'account_types'
         AND COLUMN_NAME = 'company_id' AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    for (const fk of fks) {
      await pool.query(`ALTER TABLE account_types DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      console.log(`  → FK eliminada: ${fk.CONSTRAINT_NAME}`);
    }

    await pool.query('ALTER TABLE account_types DROP COLUMN company_id');
    console.log('  → Columna company_id eliminada');

    const [types] = await pool.query('SELECT id, code, name FROM account_types ORDER BY id');
    console.log(`  → Tipos globales actuales: ${types.map(t => `${t.id}=${t.name}`).join(', ') || 'NINGUNO'}`);
    console.log('\nMigración completa');
  } catch (error) {
    console.error('Migración falló:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
