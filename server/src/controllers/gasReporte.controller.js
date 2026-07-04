const pool = require('../config/db');

exports.getReporteVentas = async (req, res) => {
    try {
        const { fecha, turno } = req.query;
        const company_id = req.company_id;
        const branch_id = req.query.branch_id || req.user?.branch_id;

        if (!fecha) {
            return res.status(400).json({ message: 'La fecha es obligatoria' });
        }

        const turnoNum = parseInt(turno, 10) || 0;

        const query = `
            SELECT 
                p.codigo AS codigo_producto,
                p.descripcion AS descripcion_producto,
                COALESCE(l.precio, v.precio, p.precio_unitario, 0) AS precio,
                COALESCE(l.lectura_galones, 0) AS lectura_galones,
                COALESCE(l.lectura_monto, 0) AS lectura_monto,
                COALESCE(v.venta_galones, 0) AS venta_galones,
                COALESCE(v.venta_monto, 0) AS venta_monto,
                COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0) AS diferencia_galones,
                (COALESCE(l.lectura_galones, 0) - COALESCE(v.venta_galones, 0)) * COALESCE(l.precio, v.precio, p.precio_unitario, 0) AS diferencia_monto
            FROM products p
            LEFT JOIN (
                SELECT 
                    r.product_id,
                    AVG(r.precio) AS precio,
                    SUM(r.lectura_actual) AS lectura_galones,
                    ROUND(SUM(r.lectura_actual * r.precio), 2) AS lectura_monto
                FROM gas_station_closeout_readings r
                JOIN gas_station_closeouts c ON r.closeout_id = c.id
                WHERE c.company_id = ? AND c.fecha_turno = ? AND c.branch_id = ?
                  AND (? = 0 OR c.numero_turno = ?)
                GROUP BY r.product_id
            ) l ON p.id = l.product_id
            LEFT JOIN (
                SELECT 
                    si.product_id,
                    AVG(si.precio_unitario) AS precio,
                    SUM(si.cantidad) AS venta_galones,
                    ROUND(SUM(si.cantidad * si.precio_unitario), 2) AS venta_monto
                FROM sales_items si
                JOIN sales_headers sh ON si.sale_id = sh.id
                WHERE sh.company_id = ? AND DATE(sh.created_at) = ? AND sh.branch_id = ?
                  AND sh.estado != 'anulado'
                GROUP BY si.product_id
            ) v ON p.id = v.product_id
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            ORDER BY p.codigo
        `;

        const params = [
            company_id, fecha, branch_id, turnoNum, String(turnoNum),
            company_id, fecha, branch_id,
            company_id
        ];

        const [rows] = await pool.query(query, params);

        const totales = {
            lectura_galones: 0,
            lectura_monto: 0,
            venta_galones: 0,
            venta_monto: 0,
            diferencia_galones: 0,
            diferencia_monto: 0,
        };

        for (const row of rows) {
            totales.lectura_galones += parseFloat(row.lectura_galones) || 0;
            totales.lectura_monto += parseFloat(row.lectura_monto) || 0;
            totales.venta_galones += parseFloat(row.venta_galones) || 0;
            totales.venta_monto += parseFloat(row.venta_monto) || 0;
            totales.diferencia_galones += parseFloat(row.diferencia_galones) || 0;
            totales.diferencia_monto += parseFloat(row.diferencia_monto) || 0;
        }

        res.json({ data: rows, totales });
    } catch (error) {
        console.error('Error en getReporteVentas:', error);
        res.status(500).json({ message: 'Error al obtener reporte de ventas' });
    }
};
