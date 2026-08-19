/**
 * Fragmentos SQL compartidos para filtrar ventas por estado de DTE.
 *
 * Regla aplicada en reportes/libros/anexos: solo se incluyen ventas cuyo DTE
 * más reciente (último intento por MAX(id)) tiene status válido
 * (NOT IN REJECTED, ERROR, INVALIDADO). Se excluyen ventas sin DTE (sin
 * código de generación), con DTE rechazado/error o anulado.
 */

const DTE_STATUSES_INVALIDOS = ["'REJECTED'", "'ERROR'", "'INVALIDADO'"];

const dteMatchSql = (alias) => `(
    d.venta_id = ${alias}.id
    OR (${alias}.codigo_generacion IS NOT NULL AND ${alias}.codigo_generacion != '' AND d.codigo_generacion = ${alias}.codigo_generacion)
)`;

const dteLatestIdSql = (alias) => `(
    SELECT MAX(d2.id) FROM dtes d2
    WHERE (d2.venta_id = ${alias}.id
           OR (${alias}.codigo_generacion IS NOT NULL AND ${alias}.codigo_generacion != '' AND d2.codigo_generacion = ${alias}.codigo_generacion))
)`;

/**
 * WHERE fragment: la venta (alias por defecto 'h') tiene al menos un DTE cuyo
 * último intento tiene status válido.
 */
const dteValidoExistsSql = (alias = 'h') => `EXISTS (
    SELECT 1 FROM dtes d
    WHERE ${dteMatchSql(alias)}
      AND d.id = ${dteLatestIdSql(alias)}
      AND d.status NOT IN (${DTE_STATUSES_INVALIDOS.join(', ')})
)`;

/**
 * Scalar subquery: columna del último intento del DTE de la venta
 * (ej: dteLatestColSql('h', 'numero_control')).
 */
const dteLatestColSql = (alias, col) => `(
    SELECT d2.${col} FROM dtes d2
    WHERE (d2.venta_id = ${alias}.id
           OR (${alias}.codigo_generacion IS NOT NULL AND ${alias}.codigo_generacion != '' AND d2.codigo_generacion = ${alias}.codigo_generacion))
    ORDER BY d2.id DESC LIMIT 1
)`;

module.exports = { dteValidoExistsSql, dteLatestColSql };
