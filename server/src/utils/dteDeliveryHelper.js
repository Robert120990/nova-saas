/**
 * DTE Delivery Helper
 * 
 * Standardizes DTE JSON for delivery to receptors, downloads, and email attachments,
 * ensuring both the reception seal (selloRecibido) and digital signature (firmaElectronica)
 * are included at the root level, matching the official SVFE standard (Infile/Filpro pattern).
 */

/**
 * Formats a DTE JSON object for delivery/download.
 * Injects selloRecibido and firmaElectronica if present in database columns but absent in jsonOriginal.
 *
 * @param {object|string} jsonOriginal - Raw pre-transmission or stored DTE JSON
 * @param {string|null} jsonFirmado - Cryptographic signature (JWS token)
 * @param {string|null} selloRecepcion - Official reception stamp from Ministerio de Hacienda
 * @returns {object|null} Enriched DTE JSON object
 */
function formatDeliveryDteJson(jsonOriginal, jsonFirmado = null, selloRecepcion = null) {
    if (!jsonOriginal) return null;

    let base;
    if (typeof jsonOriginal === 'string') {
        try {
            base = JSON.parse(jsonOriginal);
        } catch (e) {
            console.warn('[dteDeliveryHelper] Error parsing jsonOriginal:', e.message);
            return null;
        }
    } else {
        base = { ...jsonOriginal };
    }

    if (!base || typeof base !== 'object') return base;

    // Inject selloRecibido if available and missing
    const sello = selloRecepcion || base.selloRecibido || base.selloRecepcion;
    if (sello && !base.selloRecibido) {
        base.selloRecibido = String(sello).trim();
    }

    // Inject firmaElectronica (JWS) if available and missing
    const firma = jsonFirmado || base.firmaElectronica || base.firma;
    if (firma && !base.firmaElectronica) {
        const cleanFirma = typeof firma === 'string' ? firma.replace(/^"|"$/g, '').trim() : JSON.stringify(firma);
        base.firmaElectronica = cleanFirma;
    }

    return base;
}

/**
 * Formats a DTE JSON into an indented string ready for file attachment or download.
 *
 * @param {object|string} jsonOriginal
 * @param {string|null} jsonFirmado
 * @param {string|null} selloRecepcion
 * @param {number} space
 * @returns {string} Formatted JSON string
 */
function formatDeliveryDteJsonString(jsonOriginal, jsonFirmado = null, selloRecepcion = null, space = 2) {
    const enriched = formatDeliveryDteJson(jsonOriginal, jsonFirmado, selloRecepcion);
    if (!enriched) return '{}';
    return JSON.stringify(enriched, null, space);
}

module.exports = {
    formatDeliveryDteJson,
    formatDeliveryDteJsonString
};
