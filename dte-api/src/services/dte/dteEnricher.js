/**
 * DTE Enricher Service
 * 
 * Enriches DTE JSON post-acceptance with Ministerio de Hacienda's reception seal
 * and cryptographic JWS signature, matching the official SVFE standard (Infile pattern).
 */

/**
 * Enriches a DTE JSON object or string with reception stamp and digital signature.
 * 
 * @param {object|string} dteJson - Original DTE JSON
 * @param {string|null} jwsString - Cryptographic JWS signature
 * @param {string|null} selloRecepcion - Reception seal from Hacienda
 * @returns {object} Enriched DTE object
 */
function enrichAcceptedDTE(dteJson, jwsString = null, selloRecepcion = null) {
    if (!dteJson) return null;

    let base;
    if (typeof dteJson === 'string') {
        try {
            base = JSON.parse(dteJson);
        } catch (e) {
            console.warn('[dteEnricher] Error parsing dteJson:', e.message);
            return null;
        }
    } else {
        base = { ...dteJson };
    }

    if (!base || typeof base !== 'object') return base;

    const sello = selloRecepcion || base.selloRecibido || base.selloRecepcion;
    if (sello && !base.selloRecibido) {
        base.selloRecibido = String(sello).trim();
    }

    const firma = jwsString || base.firmaElectronica || base.firma;
    if (firma && !base.firmaElectronica) {
        const cleanFirma = typeof firma === 'string' ? firma.replace(/^"|"$/g, '').trim() : JSON.stringify(firma);
        base.firmaElectronica = cleanFirma;
    }

    return base;
}

module.exports = {
    enrichAcceptedDTE
};
