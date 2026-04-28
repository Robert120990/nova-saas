const { sanitizeText, cleanNumbers } = require('../src/utils/text');

const sampleData = {
    nombre: "Roberto Peña-Nuñez",
    direccion: "Colonia Las Glorias, Pasaje Ñ, Casa #123",
    telefono: "2222-3333",
    nit: "0614-010180-101-1"
};

console.log("Original Name:", sampleData.nombre);
console.log("Sanitized Name:", sanitizeText(sampleData.nombre));

console.log("Original Address:", sampleData.direccion);
console.log("Sanitized Address:", sanitizeText(sampleData.direccion));

console.log("Original Phone:", sampleData.telefono);
console.log("Cleaned Phone:", cleanNumbers(sampleData.telefono));

console.log("Original NIT:", sampleData.nit);
console.log("Cleaned NIT:", cleanNumbers(sampleData.nit));
