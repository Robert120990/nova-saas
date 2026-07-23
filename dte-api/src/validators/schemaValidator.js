const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
// Esquemas actualizados (Fix whitespace) - 2026-04-10 01:08

const ajv = new Ajv({ 
    allErrors: true, 
    strict: false,
    multipleOfPrecision: 2 
});
addFormats(ajv);

const schemasDir = path.resolve(__dirname, process.env.SCHEMAS_PATH || '../../../cumplientoDTE/svfe-json-schemas/svfe-json-schemas');

// Mapping of DTE type to schema filename (versioned 2026)
const schemaMap = {
    '01': 'v2/fe-f-v2.json',         // Factura
    '03': 'v4/fe-ccf-v4.json',       // Comprobante de Crédito Fiscal
    '04': 'v4/fe-nr-v4.json',        // Nota de Remisión
    '05': 'v4/fe-nc-v4.json',        // Nota de Crédito
    '06': 'v4/fe-nd-v4.json',        // Nota de Débito
    '07': 'v2/fe-cr-v2.json',        // Comprobante de Retención
    '08': 'v2/fe-cl-v2.json',        // Comprobante de Liquidación
    '09': 'v2/fe-dcl-v2.json',       // Documento Contable de Liquidación
    '11': 'v3/fe-fex-v3.json',       // Factura de Exportación
    '14': 'v2/fe-fse-v2.json',       // Sujeto Excluido
    '15': 'v2/fe-cd-v2.json',        // Comprobante de Donación
    '16': 'v3/invalidacion-schema-v3.json',  // Invalidación
    '17': 'v1/fe-eop-v1.json',       // Evento de Operaciones Especiales
    '18': 'v1/fe-eret-v1.json'       // Evento de Retorno
};

const validators = {};

function tryLoadSchema(type) {
    const relativePath = schemaMap[type];
    if (!relativePath) {
        console.warn(`No schema mapping for DTE type ${type}`);
        return false;
    }

    const searchPaths = [
        schemasDir,
        path.resolve(__dirname, '../../../cumplientoDTE/svfe-json-schemas/svfe-json-schemas'),
        path.resolve(__dirname, '../schemas'),
    ];

    for (const baseDir of searchPaths) {
        const schemaPath = path.join(baseDir, relativePath);
        if (fs.existsSync(schemaPath)) {
            try {
                const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
                validators[type] = ajv.compile(schema);
                console.log(`Loaded validator for DTE type ${type} from ${schemaPath}`);
                return true;
            } catch (error) {
                console.error(`Error compiling schema for type ${type} from ${schemaPath}:`, error.message);
            }
        }
    }

    return false;
}

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
    let validator = validators[type];
    if (!validator) {
        if (tryLoadSchema(type)) {
            validator = validators[type];
        } else {
            throw new Error(`Validador no encontrado para el tipo de DTE: ${type}`);
        }
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
