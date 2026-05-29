/**
 * Mapeo de versión de esquema según Normativa V2.0 (2026)
 * Cada tipo de DTE tiene una versión específica del schema JSON.
 */
const schemaVersions = {
    '01': 2,  // Factura
    '03': 4,  // CCF
    '04': 4,  // Nota de Remisión
    '05': 4,  // Nota de Crédito
    '06': 4,  // Nota de Débito
    '07': 2,  // Comprobante de Retención
    '08': 2,  // Comprobante de Liquidación
    '09': 2,  // DCLE
    '11': 3,  // FEX
    '14': 2,  // FSE
    '15': 2,  // CD
    '16': 3,  // Invalidación
    '17': 1,  // EOP (Evento Operaciones Especiales)
    '18': 1,  // ERET (Evento de Retorno)
};

function getSchemaVersion(tipoDte) {
    return schemaVersions[tipoDte] || 3;
}

module.exports = { getSchemaVersion, schemaVersions };
