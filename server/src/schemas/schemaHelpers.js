/**
 * Standard Zod Schema Helpers & Sanitizers
 * Prevents "Invalid input: expected string, received number" and similar type mismatch errors
 * when data arrives from HTML form inputs, JSON bodies, or query params.
 */
const { z } = require('zod');

/**
 * Preprocessor that converts undefined, null, or empty string to null,
 * and coerces numbers or any other primitive to trimmed string.
 */
const emptyToNull = z.preprocess(
    val => {
        if (val === undefined || val === null) return null;
        const str = String(val).trim();
        return str === '' ? null : str;
    },
    z.string().nullable().optional()
);

/**
 * Preprocessor that accepts string or number, coerces to string, trims it,
 * and enforces min(1).
 */
const requiredString = (message = 'El campo es obligatorio') => z.preprocess(
    val => (val === undefined || val === null ? '' : String(val).trim()),
    z.string({ error: message }).min(1, message)
);

/**
 * Optional string that coerces numbers or strings safely to null if empty, or trimmed string.
 */
const optionalString = z.preprocess(
    val => {
        if (val === undefined || val === null) return null;
        const str = String(val).trim();
        return str === '' ? null : str;
    },
    z.string().nullable().optional()
);

/**
 * Numeric ID helper: converts empty strings, 0, '0', or null to null,
 * and coerces valid numeric IDs to positive integers.
 */
const emptyToNullId = z.preprocess(
    val => {
        if (val === '' || val === undefined || val === null || val === 0 || val === '0') return null;
        const num = Number(val);
        return Number.isNaN(num) ? null : num;
    },
    z.coerce.number().int().positive().nullable().optional()
);

/**
 * Safe numeric helper that handles NaN and empty strings gracefully.
 */
const safeNumber = (defaultValue = 0) => z.preprocess(
    val => (val === '' || val === null || val === undefined || (typeof val === 'number' && Number.isNaN(val)) ? defaultValue : Number(val)),
    z.number().optional().default(defaultValue)
);

module.exports = {
    emptyToNull,
    requiredString,
    optionalString,
    emptyToNullId,
    safeNumber
};
