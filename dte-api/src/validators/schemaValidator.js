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

function translateError(err) {
    const pathStr = err.path || err.instancePath || '';
    const prop = pathStr ? pathStr.replace(/^.*\//, '') : '';
    const msg = err.message || '';
    const params = err.params || {};

    // Mapeo de mensajes AJV a español
    if (msg.includes('must have required property')) {
        const campo = params.missingProperty || '';
        return pathStr
            ? `El campo "${campo}" es requerido en ${pathStr}`
            : `El campo "${campo}" es requerido`;
    }
    if (msg.includes('must NOT have additional properties')) {
        const campo = params.additionalProperty || '';
        return pathStr
            ? `El campo "${campo}" no está permitido en ${pathStr}`
            : `El campo "${campo}" no está permitido`;
    }
    if (msg.includes('must be equal to constant')) {
        return `El campo "${prop}" en ${pathStr} debe ser exactamente "${params.allowedValue}"`;
    }
    if (msg.includes('must be equal to one of the allowed values')) {
        const values = (params.allowedValues || []).slice(0, 5).join(', ');
        const suffix = (params.allowedValues || []).length > 5 ? '...' : '';
        return `Valor no permitido en "${prop}" (${pathStr}). Valores válidos: ${values}${suffix}`;
    }
    if (msg.includes('must be integer')) {
        return `El campo "${prop}" en ${pathStr} debe ser un número entero`;
    }
    if (msg.includes('must be number')) {
        return `El campo "${prop}" en ${pathStr} debe ser un número`;
    }
    if (msg.includes('must be string')) {
        return `El campo "${prop}" en ${pathStr} debe ser texto`;
    }
    if (msg.includes('must be array')) {
        return `El campo "${prop}" en ${pathStr} debe ser un arreglo`;
    }
    if (msg.includes('must be null')) {
        return `El campo "${prop}" en ${pathStr} debe ser nulo`;
    }
    if (msg.includes('must NOT be valid')) {
        return `El campo "${prop}" en ${pathStr} tiene un valor no válido`;
    }
    if (msg.includes('must match pattern')) {
        return `El campo "${prop}" en ${pathStr} no cumple el formato requerido`;
    }
    if (msg.includes('must match "')) {
        const schema = msg.match(/must match "([^"]+)"/)?.[1] || '';
        return `El campo "${prop}" en ${pathStr} no cumple la condición "${schema}"`;
    }
    if (msg.includes('excessiveMaximum') || msg.includes('exceeds')) {
        return `El campo "${prop}" en ${pathStr} excede el valor máximo permitido`;
    }
    if (msg.includes('minimum')) {
        return `El campo "${prop}" en ${pathStr} está por debajo del valor mínimo`;
    }
    if (msg.includes('maxLength') || msg.includes('excede el tamaño')) {
        return `El campo "${prop}" en ${pathStr} excede la longitud máxima`;
    }
    if (msg.includes('minLength')) {
        return `El campo "${prop}" en ${pathStr} no alcanza la longitud mínima`;
    }

    // Fallback: devolver el mensaje original pero anteponiendo la ruta
    return msg.includes(pathStr) ? msg : `${pathStr}: ${msg}`;
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
                message: translateError(err),
                params: err.params
            }))
        };
    }

    return { success: true };
}

// Initialize on load
initValidators();

module.exports = { validateDTE, initValidators };
