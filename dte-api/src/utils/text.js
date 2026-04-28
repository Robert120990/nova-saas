/**
 * Text utilities for DTE Sanitization
 */

/**
 * Clean text to comply with Hacienda rules (no accents, no weird characters)
 * @param {string} text Text to clean
 * @returns {string} Cleaned text
 */
function sanitizeText(text) {
    if (!text || typeof text !== 'string') return text || '';
    
    return text
        .normalize("NFD") // Decompose accents
        .replace(/[\u0300-\u036f]/g, "") // Remove accent marks
        .replace(/[^a-zA-Z0-9\s.,-]/g, "") // Keep only alphanumeric, spaces, dots, commas and dashes
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
}

/**
 * Remove dashes from numbers (NIT, NRC, Phone)
 * @param {string} value Value to clean
 * @returns {string} Cleaned value
 */
function cleanNumbers(value) {
    if (!value || typeof value !== 'string') return value || null;
    return value.replace(/-/g, '').trim();
}

module.exports = {
    sanitizeText,
    cleanNumbers
};
