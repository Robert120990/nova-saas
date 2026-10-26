/**
 * Fragmentos SQL compartidos para filtrar ventas por estado de DTE.
 *
 * Regla aplicada en reportes/libros/anexos: solo se incluyen ventas cuyo DTE
 * más reciente (último intento por MAX(id)) tiene status válido
 * (NOT IN REJECTED, ERROR, INVALIDADO). Se excluyen ventas sin DTE (sin
 * código de generación), con DTE rechazado/error o anulado.
 */

const DTE_STATUSES_INVALIDOS = ["'REJECTED'", "'ERROR'", "'INVALIDADO'"];

/**
 * WHERE fragment: la venta (alias por defecto 'h') tiene al menos un DTE cuyo
 * último intento tiene status válido.
 *
 * Versión optimizada de alto rendimiento:
 * 1. Si la venta tiene codigo_generacion, se valida directamente contra el índice UNIQUE de dtes.
 * 2. Si no o alternativamente, se consulta por venta_id con MAX(id) correlacionado usando
 *    el índice idx_dtes_venta_id.
 * Esto erradica el GROUP BY sobre toda la tabla dtes completa que colapsaba la base de datos a 15-20s.
 */
const dteValidoExistsSql = (alias = 'h') => `(
    (${alias}.codigo_generacion IS NOT NULL AND ${alias}.codigo_generacion != '' AND EXISTS (
        SELECT 1 FROM dtes dtx2
        WHERE dtx2.codigo_generacion = ${alias}.codigo_generacion
          AND dtx2.status NOT IN (${DTE_STATUSES_INVALIDOS.join(', ')})
    ))
    OR EXISTS (
        SELECT 1 FROM dtes dtx
        WHERE dtx.venta_id = ${alias}.id
          AND dtx.status NOT IN (${DTE_STATUSES_INVALIDOS.join(', ')})
          AND dtx.id = (SELECT MAX(d2x.id) FROM dtes d2x WHERE d2x.venta_id = ${alias}.id)
    )
)`;

/**
 * Scalar subquery: columna del último intento del DTE de la venta
 * (ej: dteLatestColSql('h', 'numero_control')).
 * Utiliza de forma inmediata el valor directo de la cabecera si ya está disponible,
 * evitando subconsultas redundantes. En caso contrario resuelve por codigo_generacion (UNIQUE)
 * o por venta_id indexado.
 */
const dteLatestColSql = (alias, col) => `COALESCE(
    NULLIF(${alias}.${col}, ''),
    (
        SELECT d2.${col} FROM dtes d2
        WHERE ${alias}.codigo_generacion IS NOT NULL AND ${alias}.codigo_generacion != '' 
          AND d2.codigo_generacion = ${alias}.codigo_generacion
        LIMIT 1
    ),
    (
        SELECT d3.${col} FROM dtes d3
        WHERE d3.venta_id = ${alias}.id
        ORDER BY d3.id DESC LIMIT 1
    )
)`;

module.exports = { dteValidoExistsSql, dteLatestColSql };

