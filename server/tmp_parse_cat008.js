const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '../cumplientoDTE/2026/Catálogos - Facturación Electrónica.xlsx'));
const sheet = workbook.Sheets['Hoja1'];
const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Parse CAT-008 section from Excel
// Format: per-department sequential codes that repeat across departments
// Starting at row 56
let i = 56;
console.log('Header:', JSON.stringify(json[i])); // CAT-008 Distrito
console.log('Columns:', JSON.stringify(json[++i])); // Código, Valores
i++; // move to data rows

const cat008 = []; // { code, description }
const departments = [
  '00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'
];
let depIdx = 0;

// Collect all rows until next CAT section (empty row followed by CAT-)
while (i < json.length) {
  const row = json[i];
  if (!row || row.length === 0) { i++; continue; }
  // Check if this is a new CAT section
  if (typeof row[0] === 'string' && row[0].startsWith('CAT-') && row[0] !== 'CAT-008 Distrito') {
    break;
  }
  if (row[0] === 'CAT-008 Distrito') { i++; continue; }
  if (row[0] === 'Código' && row[1] === 'Valores') { i++; continue; }
  
  if (row.length >= 2 && row[0] !== undefined && row[1] !== undefined) {
    cat008.push({ code: String(row[0]), description: row[1] });
  }
  i++;
}

console.log(`\nTotal CAT-008 entries: ${cat008.length}`);

// Build per-department mapping
let entryIdx = 0;
const depMapping = {};
for (const dep of departments) {
  const entries = [];
  // Each department has entries until the next department starts
  // The codes restart (1, 2, 3...) for each department
  // We know the department boundaries from the original v31 data
  // Let me just display what we got
}

// Show all entries grouped by when code resets
console.log('\n=== CAT-008 Official Entries ===');
let prevCode = -1;
let groupNum = 0;
for (const entry of cat008) {
  const code = parseInt(entry.code);
  if (code <= prevCode) {
    groupNum++;
    console.log(`\n--- Department group ${groupNum} ---`);
  }
  console.log(`  code=${entry.code.padStart(4)} desc="${entry.description}"`);
  prevCode = code;
}

// Now let me also look at what the oficial catalog says about "distrito" field format
// Search for any mention of distrito or address format in the Normativa PDF
