const pool = require('../config/db');
const pdfService = require('../services/pdf.service');

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
                    SUM(COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) AS lectura_galones,
                    ROUND(SUM((COALESCE(r.lectura_actual, 0) - COALESCE(r.lectura_anterior, 0) - COALESCE(r.calibracion, 0)) * r.precio), 2) AS lectura_monto
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
                  AND (? = 0 OR sh.shift_id IN (
                      SELECT id FROM pos_shifts
                      WHERE company_id = ? AND branch_id = ? AND shift_date = ? AND shift_number = ?
                  ))
                GROUP BY si.product_id
            ) v ON p.id = v.product_id
            WHERE p.company_id = ? AND p.tipo_combustible > 0 AND p.status = 'activo'
            ORDER BY p.codigo
        `;

        const params = [
            company_id, fecha, branch_id, turnoNum, turnoNum,
            company_id, fecha, branch_id, turnoNum,
            company_id, branch_id, fecha, turnoNum,
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

const tipoNombres = {
    remesas: 'Remesas',
    gastos: 'Gastos',
    creditos: 'Créditos',
    cupones: 'Cupones',
    descuentos: 'Descuentos',
    adelantos: 'Adelantos',
    tarjetas: 'Tarjetas',
    vales: 'Vales',
    anticipos_desp: 'Anticipos Despachados',
    lubricantes: 'Lubricantes'
};

exports.getCloseoutDetailPDF = async (req, res) => {
    const { start_date, end_date, tipo_reporte, branch_id } = req.query;
    const companyId = req.company_id;

    try {
        if (!companyId) return res.status(401).json({ message: 'No session' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        if (!tipo_reporte || !tipoNombres[tipo_reporte]) return res.status(400).json({ message: 'Tipo de reporte inválido' });

        const [companyRows] = await pool.query('SELECT razon_social FROM companies WHERE id = ?', [companyId]);
        const companyInfo = companyRows[0] || { razon_social: 'Empresa' };

        let branchName = 'Todas';
        if (branch_id && branch_id !== 'all') {
            const [br] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (br.length > 0) branchName = br[0].nombre;
        }

        const branchFilter = branch_id && branch_id !== 'all' ? 'AND g.branch_id = ?' : '';
        const branchParams = branch_id && branch_id !== 'all' ? [branch_id] : [];

        let sql, params, columns;

        switch (tipo_reporte) {
            case 'remesas': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, r.documento, 
                           COALESCE(d.descripcion, '—') as despachador, r.tipo_operacion, r.monto
                    FROM gas_station_closeout_remesas r
                    JOIN gas_station_closeouts g ON r.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, r.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Documento', w: 120, accessor: 'documento' },
                    { label: 'Despachador', w: 150, accessor: 'despachador' },
                    { label: 'Tipo Operación', w: 170, accessor: 'tipo_operacion' },
                    { label: 'Monto', w: 100, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'gastos': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, 
                           e.rubro as rubro_nombre,
                           e.documento, COALESCE(d.descripcion, '—') as despachador, e.valor
                    FROM gas_station_closeout_expenses e
                    JOIN gas_station_closeouts g ON e.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, e.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Rubro', w: 160, accessor: 'rubro_nombre' },
                    { label: 'Documento', w: 180, accessor: 'documento' },
                    { label: 'Despachador', w: 160, accessor: 'despachador' },
                    { label: 'Valor', w: 90, accessor: 'valor', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'creditos': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, c.cliente_nombre as cliente,
                           COALESCE(d.descripcion, '—') as despachador, c.monto
                    FROM gas_station_closeout_creditos c
                    JOIN gas_station_closeouts g ON c.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, c.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Cliente', w: 250, accessor: 'cliente' },
                    { label: 'Despachador', w: 200, accessor: 'despachador' },
                    { label: 'Monto', w: 100, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'cupones': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, c.cupon, c.distribuidora_nombre as distribuidora,
                           c.producto_descripcion as producto, COALESCE(d.descripcion, '—') as despachador, c.monto
                    FROM gas_station_closeout_cupones c
                    JOIN gas_station_closeouts g ON c.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, c.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 45, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 70, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Cupón', w: 100, accessor: 'cupon' },
                    { label: 'Distribuidora', w: 150, accessor: 'distribuidora' },
                    { label: 'Producto', w: 140, accessor: 'producto' },
                    { label: 'Despachador', w: 130, accessor: 'despachador' },
                    { label: 'Monto', w: 80, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'descuentos': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, d.cliente_nombre as cliente,
                           COALESCE(desp.descripcion, '—') as despachador, d.total
                    FROM gas_station_closeout_descuentos d
                    JOIN gas_station_closeouts g ON d.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, d.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Cliente', w: 280, accessor: 'cliente' },
                    { label: 'Despachador', w: 200, accessor: 'despachador' },
                    { label: 'Total', w: 100, accessor: 'total', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'adelantos':
            case 'tarjetas':
            case 'vales':
            case 'anticipos_desp': {
                const tableMap = {
                    adelantos: { table: 'gas_station_closeout_adelantos', montoField: 'monto' },
                    tarjetas: { table: 'gas_station_closeout_tarjetas', montoField: 'monto' },
                    vales: { table: 'gas_station_closeout_vales', montoField: 'monto' },
                    anticipos_desp: { table: 'gas_station_closeout_anticipos_despachados', montoField: 'monto' }
                };
                const cfg = tableMap[tipo_reporte];
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, COALESCE(d.descripcion, '—') as despachador, r.${cfg.montoField} as monto
                    FROM ${cfg.table} r
                    JOIN gas_station_closeouts g ON r.closeout_id = g.id
                    LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, r.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 80, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 120, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Despachador', w: 300, accessor: 'despachador' },
                    { label: 'Monto', w: 120, accessor: 'monto', format: 'money', align: 'right' }
                ];
                break;
            }
            case 'lubricantes': {
                sql = `
                    SELECT g.fecha_turno, g.numero_turno, l.producto_descripcion as producto,
                           l.cantidad, l.precio, l.total
                    FROM gas_station_closeout_lubricant_readings l
                    JOIN gas_station_closeouts g ON l.closeout_id = g.id
                    WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
                    ORDER BY g.fecha_turno, g.numero_turno, l.id
                `;
                params = [companyId, start_date, end_date, ...branchParams];
                columns = [
                    { label: 'Turno', w: 50, accessor: 'numero_turno', align: 'center' },
                    { label: 'Fecha', w: 80, accessor: 'fecha_turno', format: 'date', align: 'center' },
                    { label: 'Producto', w: 260, accessor: 'producto' },
                    { label: 'Cantidad', w: 90, accessor: 'cantidad', align: 'right' },
                    { label: 'Precio', w: 90, accessor: 'precio', format: 'money', align: 'right' },
                    { label: 'Total', w: 90, accessor: 'total', format: 'money', align: 'right' }
                ];
                break;
            }
            default:
                return res.status(400).json({ message: 'Tipo de reporte no implementado' });
        }

        const [rows] = await pool.query(sql, params);

        const reportData = {
            company: companyInfo,
            company_name: companyInfo.razon_social,
            branch_name: branchName,
            start_date,
            end_date,
            tipo_reporte,
            tipo_nombre: tipoNombres[tipo_reporte],
            columns,
            rows
        };

        const pdfBuffer = await pdfService.generateCloseoutDetailPDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Detalle_Cierre_${tipo_reporte}_${start_date}.pdf`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en getCloseoutDetailPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte detalle de cierre' });
    }
};
