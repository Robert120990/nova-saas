const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '../cumplientoDTE/2026/Catálogos - Facturación Electrónica.xlsx'));

console.log('=== Sheets ===');
workbook.SheetNames.forEach(name => console.log(`  "${name}"`));

// Find sheets related to distrito
const targetSheets = workbook.SheetNames.filter(n => 
  n.toLowerCase().includes('distrito') || 
  n.toLowerCase().includes('cat-008') ||
  n.toLowerCase().includes('cat008') ||
  n.toLowerCase().includes('municipio')
);
console.log('\n=== Target sheets ===', targetSheets);

// Dump first 5 sheets' content (first 30 rows)
for (const name of workbook.SheetNames.slice(0, 8)) {
  const sheet = workbook.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n=== Sheet: "${name}" (${json.length} rows) ===`);
  for (let i = 0; i < Math.min(json.length, 30); i++) {
    console.log(`  ${JSON.stringify(json[i])}`);
  }
}
