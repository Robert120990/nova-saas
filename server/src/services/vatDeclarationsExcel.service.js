const excelService = require('./excel.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

const formatDate = (date) => reportPdfHelper.formatDate(date);
const num = (v) => parseFloat(v) || 0;

/**
 * Genera el archivo Excel para cualquiera de los 4 anexos de declaraciones
 */
async function generateDeclarationsExcel(type, items, summary, meta) {
    let sheetName = 'Declaración';
    let title = 'ANEXO DE DECLARACIÓN DE IVA';
    let columns = [];
    let rows = [];

    const companyName = (meta.company?.razon_social || meta.company?.nombre_comercial || 'EMPRESA').toUpperCase();
    const periodText = meta.periodText || '';
    const subtitle = meta.branchName ? `SUCURSAL: ${meta.branchName.toUpperCase()}` : 'CONSOLIDADO';

    if (type === 'anticipo') {
        sheetName = 'Anticipo 2%';
        title = `${companyName} - ANEXO DE ANTICIPO A CUENTA 2% (TARJETAS) - ${periodText} (${subtitle})`;
        columns = [
            { header: '#', key: 'corr', width: 6 },
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'Agente / Proveedor', key: 'proveedor', width: 36 },
            { header: 'NIT', key: 'nit', width: 18 },
            { header: 'NRC', key: 'nrc', width: 12 },
            { header: 'No. Documento', key: 'num_doc', width: 18 },
            { header: 'Código Generación', key: 'cod_gen', width: 32 },
            { header: 'Sucursal', key: 'branch', width: 20 },
            { header: 'Monto Sujeto ($)', key: 'monto_sujeto', width: 16 },
            { header: 'Anticipo 2% ($)', key: 'anticipo_cuenta', width: 16 },
            { header: 'Total ($)', key: 'monto_total', width: 16 }
        ];
        rows = items.map(item => ({
            corr: item.corr,
            fecha: formatDate(item.fecha),
            proveedor: item.proveedor_nombre,
            nit: item.proveedor_nit || '',
            nrc: item.proveedor_nrc || '',
            num_doc: item.numero_documento,
            cod_gen: item.codigo_generacion || '',
            branch: item.branch_name,
            monto_sujeto: num(item.monto_sujeto),
            anticipo_cuenta: num(item.anticipo_cuenta),
            monto_total: num(item.monto_total)
        }));
        // Fila de totales
        rows.push({
            corr: '',
            fecha: '',
            proveedor: 'TOTALES GENERALES',
            nit: '',
            nrc: '',
            num_doc: '',
            cod_gen: '',
            branch: '',
            monto_sujeto: num(summary.total_monto_sujeto),
            anticipo_cuenta: num(summary.total_anticipo),
            monto_total: num(summary.total_monto)
        });
    } else if (type === 'retenciones_emitidas') {
        sheetName = 'Retenciones Emitidas';
        title = `${companyName} - ANEXO DE RETENCIONES DE IVA 1% EMITIDAS - ${periodText} (${subtitle})`;
        columns = [
            { header: '#', key: 'corr', width: 6 },
            { header: 'Origen', key: 'origen', width: 12 },
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'Sujeto Retenido (Proveedor)', key: 'proveedor', width: 36 },
            { header: 'NIT', key: 'nit', width: 18 },
            { header: 'NRC', key: 'nrc', width: 12 },
            { header: 'Doc. Retención / DTE-07', key: 'doc_retencion', width: 28 },
            { header: 'Doc. Origen', key: 'doc_origen', width: 22 },
            { header: 'Sucursal', key: 'branch', width: 20 },
            { header: 'Monto Sujeto ($)', key: 'monto_sujeto', width: 16 },
            { header: 'Retención 1% ($)', key: 'retencion', width: 16 },
            { header: 'IVA ($)', key: 'iva', width: 14 },
            { header: 'Total ($)', key: 'monto_total', width: 16 }
        ];
        rows = items.map(item => ({
            corr: item.corr,
            origen: item.origen.toUpperCase(),
            fecha: formatDate(item.fecha),
            proveedor: item.proveedor_nombre,
            nit: item.proveedor_nit || '',
            nrc: item.proveedor_nrc || '',
            doc_retencion: item.doc_retencion,
            doc_origen: item.doc_origen,
            branch: item.branch_name,
            monto_sujeto: num(item.monto_sujeto),
            retencion: num(item.monto_retencion),
            iva: num(item.iva),
            monto_total: num(item.monto_total)
        }));
        rows.push({
            corr: '',
            origen: '',
            fecha: '',
            proveedor: 'TOTALES GENERALES',
            nit: '',
            nrc: '',
            doc_retencion: '',
            doc_origen: '',
            branch: '',
            monto_sujeto: num(summary.total_monto_sujeto),
            retencion: num(summary.total_retencion),
            iva: '',
            monto_total: num(summary.total_monto)
        });
    } else if (type === 'retenciones_recibidas') {
        sheetName = 'Retenciones Recibidas';
        title = `${companyName} - ANEXO DE RETENCIONES DE IVA 1% RECIBIDAS (VENTAS) - ${periodText} (${subtitle})`;
        columns = [
            { header: '#', key: 'corr', width: 6 },
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'Agente de Retención (Cliente)', key: 'cliente', width: 36 },
            { header: 'NIT', key: 'nit', width: 18 },
            { header: 'NRC', key: 'nrc', width: 12 },
            { header: 'Tipo Doc', key: 'tipo_doc', width: 18 },
            { header: 'No. Control DTE', key: 'num_ctrl', width: 28 },
            { header: 'Código Generación', key: 'cod_gen', width: 32 },
            { header: 'Sucursal', key: 'branch', width: 20 },
            { header: 'Venta Gravada ($)', key: 'monto_sujeto', width: 16 },
            { header: 'Débito Fiscal ($)', key: 'total_iva', width: 16 },
            { header: 'Retención 1% ($)', key: 'retencion', width: 16 },
            { header: 'Total Venta ($)', key: 'total_pagar', width: 16 }
        ];
        rows = items.map(item => ({
            corr: item.corr,
            fecha: formatDate(item.fecha),
            cliente: item.cliente_nombre,
            nit: item.cliente_nit || '',
            nrc: item.cliente_nrc || '',
            tipo_doc: item.tipo_doc_nombre,
            num_ctrl: item.numero_control,
            cod_gen: item.codigo_generacion,
            branch: item.branch_name,
            monto_sujeto: num(item.monto_sujeto),
            total_iva: num(item.total_iva),
            retencion: num(item.monto_retencion),
            total_pagar: num(item.total_pagar)
        }));
        rows.push({
            corr: '',
            fecha: '',
            cliente: 'TOTALES GENERALES',
            nit: '',
            nrc: '',
            tipo_doc: '',
            num_ctrl: '',
            cod_gen: '',
            branch: '',
            monto_sujeto: num(summary.total_monto_sujeto),
            total_iva: num(summary.total_iva),
            retencion: num(summary.total_retencion),
            total_pagar: num(summary.total_monto)
        });
    } else if (type === 'percepciones') {
        sheetName = 'Percepciones 1%';
        title = `${companyName} - ANEXO DE PERCEPCIONES DE IVA 1% SOPORTADAS - ${periodText} (${subtitle})`;
        columns = [
            { header: '#', key: 'corr', width: 6 },
            { header: 'Origen', key: 'origen', width: 12 },
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'Agente de Percepción (Proveedor)', key: 'proveedor', width: 36 },
            { header: 'NIT', key: 'nit', width: 18 },
            { header: 'NRC', key: 'nrc', width: 12 },
            { header: 'Tipo Doc', key: 'tipo_doc', width: 18 },
            { header: 'No. Documento', key: 'num_doc', width: 18 },
            { header: 'Código Generación', key: 'cod_gen', width: 32 },
            { header: 'Sucursal', key: 'branch', width: 20 },
            { header: 'Monto Gravado ($)', key: 'monto_sujeto', width: 16 },
            { header: 'Crédito Fiscal ($)', key: 'iva', width: 16 },
            { header: 'Percepción 1% ($)', key: 'percepcion', width: 16 },
            { header: 'Total Factura ($)', key: 'monto_total', width: 16 }
        ];
        rows = items.map(item => ({
            corr: item.corr,
            origen: item.origen.toUpperCase(),
            fecha: formatDate(item.fecha),
            proveedor: item.proveedor_nombre,
            nit: item.proveedor_nit || '',
            nrc: item.proveedor_nrc || '',
            tipo_doc: item.tipo_doc_nombre,
            num_doc: item.numero_documento,
            cod_gen: item.codigo_generacion || item.numero_control || '',
            branch: item.branch_name,
            monto_sujeto: num(item.monto_sujeto),
            iva: num(item.iva),
            percepcion: num(item.monto_percepcion),
            monto_total: num(item.monto_total)
        }));
        rows.push({
            corr: '',
            origen: '',
            fecha: '',
            proveedor: 'TOTALES GENERALES',
            nit: '',
            nrc: '',
            tipo_doc: '',
            num_doc: '',
            cod_gen: '',
            branch: '',
            monto_sujeto: num(summary.total_monto_sujeto),
            iva: num(summary.total_iva),
            percepcion: num(summary.total_percepcion),
            monto_total: num(summary.total_monto)
        });
    } else if (type === 'compras') {
        sheetName = 'Libro de Compras';
        title = `${companyName} - LIBRO DE COMPRAS (I.V.A.) - ${periodText} (${subtitle})`;
        columns = [
            { header: '#', key: 'corr', width: 6 },
            { header: 'Fecha', key: 'fecha', width: 14 },
            { header: 'Tipo Doc', key: 'tipo_doc', width: 16 },
            { header: 'No. Documento', key: 'num_doc', width: 20 },
            { header: 'Código Generación', key: 'cod_gen', width: 34 },
            { header: 'Proveedor', key: 'proveedor', width: 36 },
            { header: 'NIT', key: 'nit', width: 18 },
            { header: 'NRC', key: 'nrc', width: 12 },
            { header: 'Sucursal', key: 'branch', width: 20 },
            { header: 'Compras Exentas ($)', key: 'exenta', width: 18 },
            { header: 'Compras No Sujetas ($)', key: 'nosujeta', width: 18 },
            { header: 'Compras Gravadas ($)', key: 'gravada', width: 18 },
            { header: 'Crédito Fiscal IVA ($)', key: 'iva', width: 18 },
            { header: 'Retención / Percepción ($)', key: 'ret_per', width: 18 },
            { header: 'Anticipo Cuenta 2% ($)', key: 'anticipo', width: 18 },
            { header: 'Total Compras ($)', key: 'total', width: 18 },
            { header: 'Operación', key: 'tipo_operacion', width: 14 },
            { header: 'Clasificación', key: 'tipo_clasificacion', width: 14 },
            { header: 'Sector', key: 'tipo_sector', width: 14 },
            { header: 'Tipo Costo', key: 'tipo_costo', width: 14 }
        ];
        rows = items.map(item => ({
            corr: item.corr,
            fecha: formatDate(item.fecha),
            tipo_doc: item.tipo_doc_nombre,
            num_doc: item.numero_documento,
            cod_gen: item.codigo_generacion || '',
            proveedor: item.proveedor_nombre,
            nit: item.proveedor_nit || '',
            nrc: item.proveedor_nrc || '',
            branch: item.branch_name,
            exenta: num(item.total_exenta),
            nosujeta: num(item.total_nosujeta),
            gravada: num(item.total_gravada),
            iva: num(item.iva),
            ret_per: num(item.retencion) + num(item.percepcion),
            anticipo: num(item.anticipo_cuenta),
            total: num(item.monto_total),
            tipo_operacion: reportPdfHelper.extractF07Code(item.tipo_operacion, '1'),
            tipo_clasificacion: reportPdfHelper.extractF07Code(item.tipo_clasificacion, item.source_type === 'gasto' ? '2' : '1'),
            tipo_sector: reportPdfHelper.extractF07Code(item.tipo_sector, '2'),
            tipo_costo: reportPdfHelper.extractF07Code(item.tipo_costo, '5')
        }));
        rows.push({
            corr: '',
            fecha: '',
            tipo_doc: '',
            num_doc: '',
            cod_gen: '',
            proveedor: 'TOTALES GENERALES',
            nit: '',
            nrc: '',
            branch: '',
            exenta: num(summary.total_exenta),
            nosujeta: num(summary.total_nosujeta),
            gravada: num(summary.total_gravada),
            iva: num(summary.total_iva),
            ret_per: num(summary.total_retencion) + num(summary.total_percepcion),
            anticipo: num(summary.total_anticipo),
            total: num(summary.total_compras),
            tipo_operacion: '',
            tipo_clasificacion: '',
            tipo_sector: '',
            tipo_costo: ''
        });
    }

    const sheets = [{ name: sheetName, columns, data: rows }];
    return excelService.createExcelBuffer({ sheets, title });
}

module.exports = {
    generateDeclarationsExcel
};
