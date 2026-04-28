const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
// Esquemas actualizados (Fix whitespace) - 2026-04-10 01:08

const ajv = new Ajv({ 
    allErrors: true, 
    strict: false,
    multipleOfPrecision: 2 
});
addFormats(ajv);

const schemasDir = path.resolve(__dirname, process.env.SCHEMAS_PATH || '../../../cumplientoDTE/svfe-json-schemas');

// Mapping of DTE type to schema filename
const schemaMap = {
    '01': 'fe-fc-v1.json',   // Factura
    '03': 'fe-ccf-v3.json',  // Comprobante de Crédito Fiscal
    '04': 'fe-nr-v3.json',   // Nota de Remisión
    '05': 'fe-nc-v3.json',   // Nota de Crédito
    '06': 'fe-nd-v3.json',   // Nota de Débito
    '07': 'fe-cr-v1.json',   // Comprobante de Retención
    '08': 'fe-cl-v1.json',   // Comprobante de Liquidación
    '09': 'fe-dcl-v1.json',  // Documento Contable de Liquidación
    '11': 'fe-fex-v1.json',  // Factura de Exportación
    '14': 'fe-fse-v1.json',  // Sujeto Excluido
    '15': 'fe-cd-v1.json'    // Comprobante de Donación
};

const validators = {};

function initValidators() {
    Object.keys(schemaMap).forEach(type => {
        try {
            const schemaPath = path.join(schemasDir, schemaMap[type]);
            if (fs.existsSync(schemaPath)) {
                const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
                validators[type] = ajv.compile(schema);
                console.log(`Loaded validator for DTE type ${type}`);
            } else {
                console.warn(`Schema file not found for DTE type ${type}: ${schemaPath}`);
            }
        } catch (error) {
            console.error(`Error loading validator for DTE type ${type}:`, error.message);
        }
    });
}

function validateDTE(type, data) {
    const validator = validators[type];
    if (!validator) {
        throw new Error(`Validador no encontrado para el tipo de DTE: ${type}`);
    }

    const isValid = validator(data);
    if (!isValid) {
        return {
            success: false,
            errors: validator.errors.map(err => ({
                path: err.instancePath,
                message: err.message,
                params: err.params
            }))
        };
    }

    return { success: true };
}

// Initialize on load
initValidators();

module.exports = { validateDTE, initValidators };
