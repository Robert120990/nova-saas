const pool = require('../config/db');
const pdfService = require('./pdf.service');
const excelService = require('./excel.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * Genera el reporte Detalle de Cierre consolidando todos los anexos operativos
 * para un rango de fechas y sucursal, imprimiendo cada anexo por página.
 */
async function handleCloseoutDetailTodos(req, res) {
    const { start_date, end_date, branch_id } = req.query;
    const companyId = req.company_id;

    const [companyRows] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
    const companyInfo = companyRows[0] || { razon_social: 'Empresa', nit: '', nrc: '' };

    let branchName = 'Todas';
    if (branch_id && branch_id !== 'all') {
        const [br] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
        if (br.length > 0) branchName = br[0].nombre;
    }

    const branchFilter = branch_id && branch_id !== 'all' ? 'AND g.branch_id = ?' : '';
    const branchParams = branch_id && branch_id !== 'all' ? [branch_id] : [];
    const queryParams = [companyId, start_date, end_date, ...branchParams];

    const [
        [remesas],
        [gastos],
        [creditos],
        [cupones],
        [descuentos],
        [adelantos],
        [tarjetas],
        [cheques],
        [vales],
        [anticiposDesp],
        [lubricantes]
    ] = await Promise.all([
        pool.query(`
            SELECT g.fecha_turno, g.numero_turno, r.documento, 
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, r.tipo_operacion, r.monto
            FROM gas_station_closeout_remesas r
            JOIN gas_station_closeouts g ON r.closeout_id = g.id
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, r.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno, e.rubro as rubro_nombre, e.documento,
                   COALESCE(p.nombre, e.proveedor, '—') as proveedor,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, e.valor, e.comentario
            FROM gas_station_closeout_expenses e
            JOIN gas_station_closeouts g ON e.closeout_id = g.id
            LEFT JOIN providers p ON e.provider_id = p.id
            LEFT JOIN gas_station_despachadores d ON e.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = e.closeout_id AND cd.despachador_id = e.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, e.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno,
                   COALESCE(NULLIF(c.documento, ''), '—') as documento,
                   COALESCE(c.cliente_nombre, '—') as cliente,
                   COALESCE(c.producto_descripcion, c.producto_codigo, '—') as producto,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador,
                   COALESCE(c.cantidad, 0) as cantidad,
                   COALESCE(c.precio, 0) as precio,
                   COALESCE(c.monto, 0) as monto
            FROM gas_station_closeout_creditos c
            JOIN gas_station_closeouts g ON c.closeout_id = g.id
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, c.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno, c.cupon,
                   COALESCE(c.distribuidora_nombre, '—') as distribuidora,
                   COALESCE(c.producto_descripcion, c.producto_codigo, '—') as producto,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador,
                   c.monto
            FROM gas_station_closeout_cupones c
            JOIN gas_station_closeouts g ON c.closeout_id = g.id
            LEFT JOIN gas_station_despachadores d ON c.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = c.closeout_id AND cd.despachador_id = c.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, c.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno,
                   COALESCE(NULLIF(d.documento, ''), '—') as documento,
                   COALESCE(d.cliente_nombre, '—') as cliente,
                   COALESCE(d.producto_descripcion, d.producto_codigo, '—') as producto,
                   COALESCE(NULLIF(cd.nombre, ''), desp.descripcion, desp.codigo, '—') as despachador,
                   COALESCE(d.cantidad, 0) as cantidad,
                   COALESCE(d.valor, 0) as valor,
                   COALESCE(d.total, 0) as total
            FROM gas_station_closeout_descuentos d
            JOIN gas_station_closeouts g ON d.closeout_id = g.id
            LEFT JOIN gas_station_despachadores desp ON d.despachador_id = desp.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = d.closeout_id AND cd.despachador_id = d.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, d.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno, 
                   COALESCE(r.empleado, '—') as empleado,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador, 
                   r.monto as monto
            FROM gas_station_closeout_adelantos r
            JOIN gas_station_closeouts g ON r.closeout_id = g.id
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, r.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno,
                   COALESCE(pt.nombre, 'SIN TIPO') as tipo_pos,
                   COALESCE(NULLIF(t.num_tarjeta, ''), '—') as num_tarjeta,
                   COALESCE(NULLIF(t.num_autorizacion, ''), '—') as num_autorizacion,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador,
                   t.monto
            FROM gas_station_closeout_tarjetas t
            JOIN gas_station_closeouts g ON t.closeout_id = g.id
            LEFT JOIN gas_station_despachadores d ON t.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = t.closeout_id AND cd.despachador_id = t.despachador_id
            LEFT JOIN gas_station_pos_types pt ON t.pos_type_id = pt.id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY tipo_pos, g.fecha_turno, g.numero_turno, t.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno,
                   COALESCE(NULLIF(ch.numero_cheque, ''), '—') as numero_cheque,
                   COALESCE(NULLIF(ch.banco, ''), '—') as banco,
                   ch.tipo_operacion,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador,
                   ch.monto
            FROM gas_station_closeout_cheques ch
            JOIN gas_station_closeouts g ON ch.closeout_id = g.id
            LEFT JOIN gas_station_despachadores d ON ch.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = ch.closeout_id AND cd.despachador_id = ch.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, ch.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno, 
                   COALESCE(NULLIF(r.documento, ''), '—') as documento,
                   COALESCE(NULLIF(r.cliente_nombre, ''), NULLIF(c.nombre, ''), '—') as cliente,
                   COALESCE(NULLIF(r.producto_descripcion, ''), NULLIF(r.producto_codigo, ''), '—') as producto,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador,
                   COALESCE(NULLIF(r.placa, ''), '—') as placa,
                   COALESCE(r.cantidad, 0) as cantidad,
                   COALESCE(r.precio, 0) as precio,
                   COALESCE(r.monto, 0) as monto
            FROM gas_station_closeout_vales r
            JOIN gas_station_closeouts g ON r.closeout_id = g.id
            LEFT JOIN customers c ON r.cliente_id = c.id
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, r.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno, 
                   COALESCE(NULLIF(r.documento, ''), '—') as documento,
                   COALESCE(NULLIF(r.cliente_nombre, ''), NULLIF(c.nombre, ''), '—') as cliente,
                   COALESCE(NULLIF(r.producto_descripcion, ''), NULLIF(r.producto_codigo, ''), '—') as producto,
                   COALESCE(NULLIF(cd.nombre, ''), d.descripcion, d.codigo, '—') as despachador,
                   COALESCE(NULLIF(r.placa, ''), '—') as placa,
                   COALESCE(r.cantidad, 0) as cantidad,
                   COALESCE(r.precio, 0) as precio,
                   COALESCE(r.monto, 0) as monto
            FROM gas_station_closeout_anticipos_despachados r
            JOIN gas_station_closeouts g ON r.closeout_id = g.id
            LEFT JOIN customers c ON r.cliente_id = c.id
            LEFT JOIN gas_station_despachadores d ON r.despachador_id = d.id
            LEFT JOIN gas_station_closeout_despachadores cd ON cd.closeout_id = r.closeout_id AND cd.despachador_id = r.despachador_id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ? ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, r.id
        `, queryParams),

        pool.query(`
            SELECT g.fecha_turno, g.numero_turno,
                   COALESCE(l.producto_codigo, '—') as codigo,
                   COALESCE(l.producto_descripcion, '—') as producto,
                   COALESCE(l.lectura_inicial, 0) as stock_inicial,
                   COALESCE(l.recarga, 0) as recarga,
                   COALESCE(l.lectura_final, 0) as stock_final,
                   COALESCE(l.ventas, 0) as cantidad,
                   COALESCE(l.precio, 0) as precio,
                   COALESCE(l.total, 0) as total
            FROM gas_station_closeout_lubricant_readings l
            JOIN gas_station_closeouts g ON l.closeout_id = g.id
            WHERE g.company_id = ? AND g.fecha_turno BETWEEN ? AND ?
              AND (COALESCE(l.lectura_final, 0) > 0 OR COALESCE(l.ventas, 0) > 0)
              ${branchFilter}
            ORDER BY g.fecha_turno, g.numero_turno, l.id
        `, queryParams)
    ]);

    if (req.query.format === 'excel') {
        const sheets = [];
        const addSheet = (name, rows, cols) => {
            sheets.push({
                name,
                columns: cols.map(c => ({ header: c.label, key: c.key, width: c.w || 15 })),
                data: rows.map(r => {
                    const rowObj = {};
                    cols.forEach(c => { rowObj[c.key] = r[c.key] ?? ''; });
                    return rowObj;
                })
            });
        };

        addSheet('Remesas', remesas, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Documento', key: 'documento', w: 15 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Tipo Operación', key: 'tipo_operacion', w: 20 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Gastos', gastos, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Rubro', key: 'rubro_nombre', w: 15 },
            { label: 'Documento', key: 'documento', w: 15 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Valor', key: 'valor', w: 12 },
            { label: 'Comentario', key: 'comentario', w: 25 }
        ]);
        addSheet('Créditos', creditos, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Cliente', key: 'cliente', w: 25 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Cupones', cupones, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Cupón', key: 'cupon', w: 15 },
            { label: 'Distribuidora', key: 'distribuidora', w: 20 },
            { label: 'Producto', key: 'producto', w: 20 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Descuentos', descuentos, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Cliente', key: 'cliente', w: 25 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Cantidad', key: 'cantidad', w: 12 },
            { label: 'Desc. Galón', key: 'valor', w: 12 },
            { label: 'Total', key: 'total', w: 12 }
        ]);
        addSheet('Adelantos', adelantos, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Empleado', key: 'empleado', w: 25 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Tarjetas', tarjetas, [
            { label: 'Tipo POS', key: 'tipo_pos', w: 15 },
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Cheques', cheques, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'No. Cheque', key: 'numero_cheque', w: 15 },
            { label: 'Banco', key: 'banco', w: 20 },
            { label: 'Tipo Operación', key: 'tipo_operacion', w: 20 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Vales', vales, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Documento', key: 'documento', w: 12 },
            { label: 'Cliente', key: 'cliente', w: 25 },
            { label: 'Producto', key: 'producto', w: 15 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Cantidad', key: 'cantidad', w: 10 },
            { label: 'Precio', key: 'precio', w: 10 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Anticipos', anticiposDesp, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Documento', key: 'documento', w: 12 },
            { label: 'Cliente', key: 'cliente', w: 25 },
            { label: 'Producto', key: 'producto', w: 15 },
            { label: 'Despachador', key: 'despachador', w: 20 },
            { label: 'Cantidad', key: 'cantidad', w: 10 },
            { label: 'Precio', key: 'precio', w: 10 },
            { label: 'Monto', key: 'monto', w: 12 }
        ]);
        addSheet('Lubricantes', lubricantes, [
            { label: 'Turno', key: 'numero_turno', w: 10 },
            { label: 'Fecha', key: 'fecha_turno', w: 12 },
            { label: 'Producto', key: 'producto', w: 25 },
            { label: 'Stock Inicial', key: 'stock_inicial', w: 12 },
            { label: 'Recarga', key: 'recarga', w: 10 },
            { label: 'Stock Final', key: 'stock_final', w: 12 },
            { label: 'Cantidad', key: 'cantidad', w: 10 },
            { label: 'Precio', key: 'precio', w: 10 },
            { label: 'Total', key: 'total', w: 12 }
        ]);

        const buffer = await excelService.createExcelBuffer({ sheets });
        return excelService.sendExcelResponse(res, buffer, `Detalle_Cierre_Todos_${start_date}.xlsx`);
    }

    const periodLabel = start_date === end_date
        ? `FECHA: ${reportPdfHelper.formatDate(start_date)}`
        : `DEL ${reportPdfHelper.formatDate(start_date)} AL ${reportPdfHelper.formatDate(end_date)}`;

    const pdfBuffer = await pdfService.generateCloseoutConsolidatedAnnexesPDF({
        closeout: {
            fecha_turno: start_date,
            numero_turno: start_date === end_date ? 'TODOS' : 'PERÍODO',
            branch_name: branchName,
            seller_name: 'CONSOLIDADO GENERAL'
        },
        company: companyInfo,
        periodTextOverride: periodLabel,
        remesas,
        gastos,
        creditos,
        cupones,
        descuentos,
        adelantos,
        tarjetas,
        cheques,
        vales,
        anticipos_desp: anticiposDesp,
        lubricantes
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Detalle_Cierre_Todos_${start_date}.pdf"`);
    return res.send(pdfBuffer);
}

module.exports = {
    handleCloseoutDetailTodos
};
