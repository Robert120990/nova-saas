/**
 * Extrae de forma segura un arreglo de cualquier respuesta de API,
 * soportando respuestas directas `[...]`, objetos Axios `res.data`,
 * o estructuras paginadas `{ data: [...], pagination: { ... } }`.
 * 
 * @param {any} res - Respuesta de axios o arreglo de datos
 * @returns {Array} Arreglo garantizado (vacío si no es válido)
 */
export const unwrapList = (res) => {
    if (!res) return [];
    // Si res es un arreglo directo
    if (Array.isArray(res)) return res;
    // Si res es la respuesta de Axios
    const payload = res.data !== undefined ? res.data : res;
    if (Array.isArray(payload)) return payload;
    // Si payload tiene propiedad data (formato de catálogo paginado)
    if (Array.isArray(payload?.data)) return payload.data;
    // Fallback defensivo
    return [];
};

/**
 * Extrae de forma segura la paginación de una respuesta de API.
 * 
 * @param {any} res - Respuesta de axios
 * @returns {object} { total, page, limit, totalPages }
 */
export const unwrapPagination = (res) => {
    const payload = res?.data !== undefined ? res.data : res;
    return payload?.pagination || {
        total: payload?.total || 0,
        page: payload?.page || 1,
        limit: payload?.limit || 15,
        totalPages: payload?.totalPages || 1
    };
};
