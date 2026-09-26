/**
 * Knowledge Search Service (RAG Ultraligero para Novas AI)
 *
 * Indexa en memoria (< 1MB) los fragmentos oficiales del Manual Funcional V 2.0,
 * Normativa de Cumplimiento y Catálogos de Hacienda de El Salvador.
 *
 * Proporciona búsqueda híbrida (palabras clave + ponderación temática)
 * para inyectar citas exactas en las consultas de DeepSeek sin sobrecarga de servidor.
 */

const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');

// Caché en memoria de fragmentos estructurados
let knowledgeBase = null;

const STOP_WORDS = new Set([
    'a', 'al', 'algo', 'algunas', 'algunos', 'ante', 'antes', 'como', 'con', 'contra',
    'cual', 'cuando', 'de', 'del', 'desde', 'donde', 'durante', 'e', 'el', 'ella',
    'ellas', 'ellos', 'en', 'entre', 'era', 'erais', 'eran', 'eras', 'eres', 'es',
    'esa', 'esas', 'ese', 'eso', 'esos', 'esta', 'estaba', 'estado', 'estais', 'estamos',
    'estan', 'estar', 'estas', 'este', 'estos', 'estoy', 'ha', 'haber', 'habia', 'habian',
    'habiendo', 'habla', 'hace', 'hacen', 'hacer', 'hacia', 'hasta', 'hay', 'la', 'las',
    'le', 'les', 'lo', 'los', 'me', 'mi', 'mis', 'mucho', 'muchos', 'muy', 'nos',
    'nosotras', 'nosotros', 'o', 'os', 'otra', 'otras', 'otro', 'otros', 'para', 'pero',
    'poco', 'por', 'porque', 'que', 'quien', 'quienes', 'se', 'sea', 'segun', 'ser',
    'si', 'sido', 'siendo', 'sin', 'sobre', 'sois', 'somos', 'son', 'soy', 'su',
    'sus', 'suya', 'suyas', 'suyo', 'suyos', 'tambien', 'tanto', 'te', 'tenemos',
    'tener', 'tengo', 'ti', 'tiene', 'tienen', 'toda', 'todas', 'todo', 'todos',
    'tu', 'tus', 'un', 'una', 'unas', 'uno', 'unos', 'vosotras', 'vosotros', 'y', 'ya'
]);

function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
        .replace(/[^a-z0-9\s]/g, ' ')   // Solo letras y números
        .replace(/\s+/g, ' ')
        .trim();
}

function loadKnowledgeBase() {
    if (knowledgeBase) return knowledgeBase;

    knowledgeBase = [];
    try {
        const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const filePath = path.join(KNOWLEDGE_DIR, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const chunks = JSON.parse(content);
            if (Array.isArray(chunks)) {
                for (const chunk of chunks) {
                    // Pre-normalizar texto para búsquedas de alta velocidad
                    chunk._normalizedContent = normalizeText(chunk.contenido);
                    chunk._normalizedTitle = normalizeText((chunk.seccion || chunk.nombre || chunk.titulo || '') + ' ' + (chunk.capitulo || chunk.catalogo || ''));
                    chunk._normalizedTags = (chunk.tags || []).map(t => normalizeText(t));
                    knowledgeBase.push(chunk);
                }
            }
        }
        console.log(`[RAG Service] Base de conocimiento oficial cargada: ${knowledgeBase.length} fragmentos indexados.`);
    } catch (err) {
        console.error('[RAG Service] Error cargando base de conocimiento:', err.message);
    }
    return knowledgeBase;
}

/**
 * Busca los fragmentos normativos oficiales más relevantes para la consulta del usuario.
 * @param {string} query - Pregunta o texto del usuario
 * @param {{ limit?: number, minScore?: number }} options
 * @returns {Array<{ id: string, titulo: string, documento: string, pagina: number, contenido: string, score: number }>}
 */
function searchRelevantKnowledge(query, { limit = 3, minScore = 5 } = {}) {
    const kb = loadKnowledgeBase();
    if (!kb || kb.length === 0 || !query) return [];

    const normQuery = normalizeText(query);
    const words = normQuery.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));

    if (words.length === 0) return [];

    // Intenciones específicas con boost de relevancia
    const isInvalidacion = /invalid|anula|cancel/i.test(normQuery);
    const isPlazo = /plazo|tiempo|dia|dias|hora|mes|vence|caduca/i.test(normQuery);
    const isContingencia = /contingencia|falla|fuerza mayor|sin internet|caida/i.test(normQuery);
    const isCombustible = /gasolina|diesel|combustible|galon/i.test(normQuery);
    const isImpuesto = /iva|fovial|cotrans|retencion|tributo/i.test(normQuery);
    const isUnidad = /unidad|medida|quintal|kilo|litro|botella/i.test(normQuery);
    const is200 = /200|dolares|sin documento|cliente ocasional|ocasional/i.test(normQuery);
    const isCCF = /ccf|credito fiscal|fiscal/i.test(normQuery);
    const isFactura = /factura|consumidor final/i.test(normQuery);

    const scored = [];

    for (const chunk of kb) {
        let score = 0;

        // 1. Coincidencias en Tags (+6 por cada coincidencia)
        for (const tag of chunk._normalizedTags) {
            for (const w of words) {
                if (tag.includes(w)) {
                    score += 6;
                }
            }
        }

        // 2. Coincidencias en Título/Sección (+4 por cada palabra)
        for (const w of words) {
            if (chunk._normalizedTitle.includes(w)) {
                score += 4;
            }
        }

        // 3. Frecuencia de términos en el Contenido (+1 por palabra encontrada)
        for (const w of words) {
            if (chunk._normalizedContent.includes(w)) {
                score += 1.5;
            }
        }

        // 4. Boosts Temáticos de Intención
        if (isInvalidacion) {
            if (chunk.id.includes('invalidacion')) score += 12;
            if (isPlazo && chunk.id === 'mf2-invalidacion-plazos') score += 15;
            if (isCCF && chunk.id === 'mf2-invalidacion-ccf-vencido-nc') score += 10;
        }

        if (isContingencia) {
            if (chunk.id.includes('contingencia')) score += 15;
            if (isPlazo && chunk.id === 'mf2-contingencia-plazos') score += 15;
        }

        if (isCombustible && chunk.id === 'cat-014-unidades-medida') score += 12;
        if (isCombustible && chunk.id === 'cat-015-tributos-impuestos') score += 10;
        if (isUnidad && chunk.id === 'cat-014-unidades-medida') score += 15;
        if (isImpuesto && chunk.id === 'cat-015-tributos-impuestos') score += 12;
        if (is200 && chunk.id === 'val-fe-01-consumidor-final') score += 15;

        if (score >= minScore) {
            scored.push({
                id: chunk.id,
                titulo: chunk.seccion || chunk.nombre || chunk.titulo || chunk.capitulo || '',
                documento: chunk.documento,
                pagina: chunk.pagina,
                contenido: chunk.contenido,
                score
            });
        }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
}

module.exports = {
    loadKnowledgeBase,
    searchRelevantKnowledge
};
