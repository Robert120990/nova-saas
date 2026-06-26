const XLSX = require('xlsx');
const path = require('path');

const workbook = XLSX.readFile(path.join(__dirname, '../cumplientoDTE/2026/Catálogos - Facturación Electrónica.xlsx'));
const sheet = workbook.Sheets['Hoja1'];
const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

// Search for distrito-related content
for (let i = 0; i < json.length; i++) {
  const row = json[i];
  if (!row || row.length === 0) continue;
  const rowStr = JSON.stringify(row).toLowerCase();
  if (rowStr.includes('distrito') || rowStr.includes('cat-008') || rowStr.includes('cat-01')) {
    console.log(`Row ${i}:`, JSON.stringify(row));
    // Print surrounding rows for context
    for (let j = Math.max(0, i-1); j <= Math.min(json.length-1, i+30); j++) {
      console.log(`  ${j}: ${JSON.stringify(json[j])}`);
    }
    console.log('---');
  }
}
