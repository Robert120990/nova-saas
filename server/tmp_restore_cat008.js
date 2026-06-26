const XLSX = require('xlsx');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const workbook = XLSX.readFile(path.join(__dirname, '../cumplientoDTE/2026/Catálogos - Facturación Electrónica.xlsx'));
const sheet = workbook.Sheets['Hoja1'];
const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Parse official CAT-008 from Excel
const allEntries = [];
for (let r = 58; r < json.length; r++) {
  const row = json[r];
  if (!row || row.length === 0) continue;
  if (typeof row[0] === 'string' && row[0].startsWith('CAT-') && row[0] !== 'CAT-008 Distrito') break;
  if (row[0] === 'CAT-008 Distrito' || (row[0] === 'Código' && row[1] === 'Valores')) continue;
  allEntries.push({ code: String(row[0]), description: row[1] });
}

// Department boundaries
const deptCodes = {
  '00': { start: 0, name: 'Otro (Para extranjeros)' },
  '01': { start: 1, name: 'Ahuachapán' },
  '02': { start: 2, name: 'Santa Ana' },
  '03': { start: 3, name: 'Sonsonate' },
  '04': { start: 4, name: 'Chalatenango' },
  '05': { start: 5, name: 'La Libertad' },
  '06': { start: 6, name: 'San Salvador' },
  '07': { start: 7, name: 'Cuscatlán' },
  '08': { start: 8, name: 'La Paz' },
  '09': { start: 9, name: 'Cabañas' },
  '10': { start: 10, name: 'San Vicente' },
  '11': { start: 11, name: 'Usulután' },
  '12': { start: 12, name: 'San Miguel' },
  '13': { start: 13, name: 'Morazán' },
  '14': { start: 14, name: 'La Unión' },
};

// Group entries by department: '00' (Otro) first, then code reset to '1' marks new department
const depOrder = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14'];
const cat008 = {};
cat008['00'] = [{ code: '00', description: allEntries[0].description }];

// Remaining entries after '0' are grouped by code reset to '1'
const remaining = allEntries.slice(1);
let depIdx = 1; // start at '01'
let currentEntries = [];

  for (const entry of remaining) {
  const num = parseInt(entry.code);
  const padded = String(num).padStart(2, '0');
  const paddedEntry = { code: padded, description: entry.description };
  if (num === 1 && currentEntries.length > 0) {
    // Code reset to 1 means new department
    cat008[depOrder[depIdx]] = currentEntries;
    depIdx++;
    currentEntries = [paddedEntry];
  } else {
    currentEntries.push(paddedEntry);
  }
}
// Last department
if (currentEntries.length > 0) {
  cat008[depOrder[depIdx]] = currentEntries;
}

console.log('Official CAT-008 parsed:');
for (const [dep, entries] of Object.entries(cat008)) {
  console.log(`  dep ${dep} (${entries.length} districts): codes ${entries.map(e => e.code).join(', ')}`);
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // 1. Restore cat_008_distrito with official data
  console.log('\n1. Restoring cat_008_distrito with official CAT-008...');
  await pool.query('DELETE FROM cat_008_distrito');
  let total = 0;
  for (const [dep, entries] of Object.entries(cat008)) {
    for (const entry of entries) {
      await pool.query(
        'INSERT INTO cat_008_distrito (code, description, dep_code) VALUES (?, ?, ?)',
        [entry.code, entry.description, dep]
      );
      total++;
    }
  }
  console.log(`   Inserted ${total} districts`);

  // 2. Fix critical records
  console.log('\n2. Fixing critical records...');
  
  // Branch #1: '13' (San Martín) - already 2 digits, no change needed
  console.log('   Branch #1: kept distrito 13 (San Martín, San Salvador)');

  // Customer #433: was '2' (Cojutepeque), got changed to '117' → restore to '02'
  await pool.query("UPDATE customers SET distrito = '02' WHERE id = 433");
  console.log('   Customer #433: restored to 02 (Cojutepeque, Cuscatlán)');

  // 3. Fix padded defaults and ensure all distritos are 2-digit
  console.log('\n3. Normalizing all distritos to 2-digit format...');
  
  // First, fix '001' → '01' and other 3+ digit codes
  await pool.query(`
    UPDATE customers SET distrito = LPAD(CAST(distrito AS UNSIGNED), 2, '0')
    WHERE distrito IS NOT NULL AND distrito != '' AND LENGTH(distrito) != 2
  `);
  const [custResult] = await pool.query('SELECT ROW_COUNT() as affected');
  console.log(`   Normalized ${custResult[0].affected} customer distrito values`);

  // Branches
  await pool.query(`
    UPDATE branches SET distrito = LPAD(CAST(distrito AS UNSIGNED), 2, '0')
    WHERE distrito IS NOT NULL AND distrito != '' AND LENGTH(distrito) != 2
  `);
  const [brResult] = await pool.query('SELECT ROW_COUNT() as affected');
  console.log(`   Normalized ${brResult[0].affected} branch distrito values`);

  // Companies
  await pool.query(`
    UPDATE companies SET distrito = LPAD(CAST(distrito AS UNSIGNED), 2, '0')
    WHERE distrito IS NOT NULL AND distrito != '' AND LENGTH(distrito) != 2
  `);
  const [compResult] = await pool.query('SELECT ROW_COUNT() as affected');
  console.log(`   Normalized ${compResult[0].affected} company distrito values`);

  console.log('\n=== VERIFICATION ===');
  const [br] = await pool.query(`
    SELECT b.id, b.nombre, b.departamento, b.distrito, c.description
    FROM branches b LEFT JOIN cat_008_distrito c ON c.code = b.distrito AND c.dep_code = b.departamento
    WHERE b.id = 1
  `);
  console.log('Branch #1:', JSON.stringify(br[0]));

  const [cust] = await pool.query(`
    SELECT c.id, c.nombre, c.departamento, c.distrito, cat.description
    FROM customers c LEFT JOIN cat_008_distrito cat ON cat.code = c.distrito AND cat.dep_code = c.departamento
    WHERE c.id = 433
  `);
  console.log('Customer #433:', JSON.stringify(cust[0]));

  await pool.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
