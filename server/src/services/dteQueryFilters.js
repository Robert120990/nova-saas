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
 * Versión optimizada: la subconsulta correlacionada MAX(d.id) original hacía
 * full table scan de dtes por cada fila candidata (minutos de ejecución).
 * Ahora se usa una derived table del último intento por venta_id (usa
 * idx_dtes_venta_id) y un EXISTS directo por codigo_generacion (índice UNIQUE).
 */
const dteValidoExistsSql = (alias = 'h') => `(
    EXISTS (
        SELECT 1 FROM dtes dtx
        JOIN (
            SELECT d2x.venta_id AS vid, MAX(d2x.id) AS max_id
            FROM dtes d2x
            WHERE d2x.venta_id IS NOT NULL AND d2x.venta_id > 0
            GROUP BY d2x.venta_id
        ) dtx_latest ON dtx.id = dtx_latest.max_id
        WHERE dtx.venta_id = ${alias}.id
          AND dtx.status NOT IN (${DTE_STATUSES_INVALIDOS.join(', ')})
    )
    OR EXISTS (
        SELECT 1 FROM dtes dtx2
        WHERE ${alias}.codigo_generacion IS NOT NULL AND ${alias}.codigo_generacion != ''
          AND dtx2.codigo_generacion = ${alias}.codigo_generacion
          AND dtx2.status NOT IN (${DTE_STATUSES_INVALIDOS.join(', ')})
    )
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
