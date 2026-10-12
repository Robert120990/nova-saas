const pool = require('../../config/db');
const reportPdfHelper = require('../../utils/reportPdfHelper');
const pdfService = require('../../services/pdf');
const excelService = require('../../services/excel.service');
const storeShiftService = require('../../services/salesTiendaShift.service');
const storeShiftComparisonService = require('../../services/salesTiendaShiftComparison.service');

/**
 * Controller: Returns JSON data of store sales grouped by shift (or comparative analysis).
 */
const getStoreSalesByShift = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, shift_id, comparative } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        if (comparative === 'true' || comparative === '1') {
            const compData = await storeShiftComparisonService.fetchStoreSalesComparison(
                companyId, branch_id, start_date, end_date, shift_id
            );
            return res.json(compData);
        }

        const data = await storeShiftService.fetchStoreSalesByShiftData(companyId, branch_id, start_date, end_date, shift_id);
        res.json(data);
    } catch (error) {
        console.error('Error in getStoreSalesByShift:', error);
        res.status(500).json({ message: 'Error al consultar ventas de tienda por turno' });
    }
};

/**
 * Controller: Exports PDF or Excel for Store Sales by Shift (or Comparative mode).
 */
const exportStoreSalesByShiftPDF = async (req, res) => {
    try {
        const { start_date, end_date, branch_id, shift_id, format, comparative } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        if (!companyId) return res.status(401).json({ message: 'No autorizado' });

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let branchName = 'Todas las sucursales';
        if (branch_id && branch_id !== 'all') {
            const [bRows] = await pool.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            if (bRows.length > 0) branchName = bRows[0].nombre;
        }

        const isComparative = comparative === 'true' || comparative === '1';

        // 1. COMPARATIVE MODE
        if (isComparative) {
            const compReportData = await storeShiftComparisonService.fetchStoreSalesComparison(
                companyId, branch_id, start_date, end_date, shift_id
            );

            const fullCompData = {
                company_id: companyId,
                company,
                branch_name: branchName,
                startDate: start_date,
                endDate: end_date,
                posGroups: compReportData.posGroups,
                totals: compReportData.totals,
                comparison: compReportData.comparison
            };

            if (format === 'excel') {
                const comp = compReportData.comparison || {};
                const buffer = await excelService.createExcelBuffer({
                    sheets: [
                        {
                            name: 'Comparativo Diario',
                            columns: [
                                { header: 'Fecha', key: 'fecha', width: 14 },
                                { header: 'Arqueo Caja ($)', key: 'total_arqueo', width: 16 },
                                { header: 'Total DTEs ($)', key: 'total_dtes', width: 16 },
                                { header: 'DTE Contado ($)', key: 'total_contado', width: 16 },
                                { header: 'DTE Crédito ($)', key: 'total_credito', width: 16 },
                                { header: 'Diferencia ($)', key: 'difference', width: 16 },
                                { header: 'Diagnóstico', key: 'match_status', width: 22 },
                                { header: 'Cant. Turnos', key: 'shifts_count', width: 14 },
                                { header: 'Cant. DTEs', key: 'dtes_count', width: 14 }
                            ],
                            data: (comp.days || []).map(d => ({
                                fecha: reportPdfHelper.formatDate(d.fecha),
                                total_arqueo: parseFloat(d.total_arqueo || 0).toFixed(2),
                                total_dtes: parseFloat(d.total_dtes || 0).toFixed(2),
                                total_contado: parseFloat(d.total_contado || 0).toFixed(2),
                                total_credito: parseFloat(d.total_credito || 0).toFixed(2),
                                difference: parseFloat(d.difference || 0).toFixed(2),
                                match_status: Math.abs(d.difference || 0) < 0.01 
                                    ? 'EXACTO AL CENTAVO' 
                                    : (d.difference > 0 ? 'SOBRANTE EN CAJA (S/DTE)' : 'EXCESO DE DTE'),
                                shifts_count: d.shifts_count,
                                dtes_count: d.dtes_count
                            }))
                        },
                        {
                            name: 'Comparativo por Turno',
                            columns: [
                                { header: 'Fecha Turno', key: 'fecha', width: 14 },
                                { header: 'Terminal POS', key: 'pos_name', width: 18 },
                                { header: 'Turno', key: 'shift_number', width: 12 },
                                { header: 'Cajero / Vendedor', key: 'seller_name', width: 22 },
                                { header: 'Estado', key: 'status', width: 12 },
                                { header: 'Arqueo Caja ($)', key: 'arqueo_sales', width: 16 },
                                { header: 'Total DTEs ($)', key: 'dte_sales', width: 16 },
                                { header: 'Diferencia ($)', key: 'difference', width: 16 },
                                { header: 'Diagnóstico', key: 'match_status', width: 22 }
                            ],
                            data: (comp.shifts || []).map(s => ({
                                fecha: reportPdfHelper.formatDate(s.fecha_str),
                                pos_name: s.pos_name,
                                shift_number: `#${s.shift_number}`,
                                seller_name: s.seller_name,
                                status: (s.status || '').toUpperCase(),
                                arqueo_sales: parseFloat(s.arqueo_sales || 0).toFixed(2),
                                dte_sales: parseFloat(s.dte_sales || 0).toFixed(2),
                                difference: parseFloat(s.difference || 0).toFixed(2),
                                match_status: Math.abs(s.difference || 0) < 0.01 
                                    ? 'EXACTO' 
                                    : (s.difference > 0 ? 'SOBRANTE (S/DTE)' : 'EXCESO DTE')
                            }))
                        }
                    ]
                });
                return excelService.sendExcelResponse(res, buffer, `Comparativo_Arqueos_vs_DTEs_${start_date || 'periodo'}.xlsx`);
            }

            const pdfBuffer = await pdfService.generateStoreSalesComparisonPDF(fullCompData);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=Comparativo_Arqueos_vs_DTEs_${start_date || 'periodo'}.pdf`);
            return res.send(pdfBuffer);
        }

        // 2. STANDARD DETAILED MODE
        const reportData = await storeShiftService.fetchStoreSalesByShiftData(companyId, branch_id, start_date, end_date, shift_id);

        const fullData = {
            company_id: companyId,
            company,
            branch_name: branchName,
            startDate: start_date,
            endDate: end_date,
            posGroups: reportData.posGroups,
            totals: reportData.totals
        };

        if (format === 'excel') {
            const flatSales = [];
            const shiftSummaries = [];

            (reportData.posGroups || []).forEach(pos => {
                (pos.shifts || []).forEach(shift => {
                    const shiftDate = reportPdfHelper.formatDate(shift.shift_date || shift.start_time);
                    shiftSummaries.push({
                        pos_name: pos.pos_name,
                        shift_number: `#${shift.shift_number || shift.shift_id}`,
                        shift_date: shiftDate,
                        seller_name: shift.seller_name || 'Sin Asignar',
                        status: (shift.status || '').toUpperCase(),
                        sales_count: shift.sales_count || 0,
                        total_contado: parseFloat(shift.total_contado || 0).toFixed(2),
                        total_credito: parseFloat(shift.total_credito || 0).toFixed(2),
                        total_shift: parseFloat(shift.total_shift || 0).toFixed(2)
                    });

                    (shift.sales || []).forEach(s => {
                        flatSales.push({
                            pos_name: pos.pos_name,
                            shift_number: `#${shift.shift_number || shift.shift_id}`,
                            fecha_turno: shiftDate,
                            fecha_emision: reportPdfHelper.formatDate(s.fecha_emision),
                            hora_emision: s.hora_emision || '',
                            tipo_doc: s.tipo_documento,
                            numero_control: s.numero_control || '',
                            condicion: s.condicion_operacion === 1 ? 'Contado' : 'Crédito',
                            cliente_nombre: s.cliente_nombre,
                            cliente_nit_nrc: `${s.cliente_nit || ''} ${s.cliente_nrc || ''}`.trim(),
                            vendedor_nombre: s.vendedor_nombre || shift.seller_name || '',
                            total_gravado: parseFloat(s.total_gravado || 0).toFixed(2),
                            total_iva: parseFloat(s.total_iva || 0).toFixed(2),
                            total_pagar: parseFloat(s.total_pagar || 0).toFixed(2)
                        });
                    });
                });
            });

            const buffer = await excelService.createExcelBuffer({
                sheets: [
                    {
                        name: 'Detalle Ventas',
                        columns: [
                            { header: 'POS', key: 'pos_name', width: 18 },
                            { header: 'Turno', key: 'shift_number', width: 10 },
                            { header: 'Fecha Turno', key: 'fecha_turno', width: 13 },
                            { header: 'Fecha Emisión', key: 'fecha_emision', width: 13 },
                            { header: 'Hora', key: 'hora_emision', width: 10 },
                            { header: 'Tipo Doc', key: 'tipo_doc', width: 10 },
                            { header: 'No. Control', key: 'numero_control', width: 22 },
                            { header: 'Condición', key: 'condicion', width: 12 },
                            { header: 'Cliente', key: 'cliente_nombre', width: 28 },
                            { header: 'NIT/NRC', key: 'cliente_nit_nrc', width: 18 },
                            { header: 'Cajero / Vendedor', key: 'vendedor_nombre', width: 20 },
                            { header: 'Gravado', key: 'total_gravado', width: 14 },
                            { header: 'IVA', key: 'total_iva', width: 12 },
                            { header: 'Total', key: 'total_pagar', width: 15 }
                        ],
                        data: flatSales
                    },
                    {
                        name: 'Resumen por Turno',
                        columns: [
                            { header: 'POS', key: 'pos_name', width: 18 },
                            { header: 'Turno', key: 'shift_number', width: 10 },
                            { header: 'Fecha Turno', key: 'shift_date', width: 14 },
                            { header: 'Cajero', key: 'seller_name', width: 22 },
                            { header: 'Estado', key: 'status', width: 12 },
                            { header: 'Cant. DTEs', key: 'sales_count', width: 12 },
                            { header: 'Contado', key: 'total_contado', width: 14 },
                            { header: 'Crédito', key: 'total_credito', width: 14 },
                            { header: 'Total Turno', key: 'total_shift', width: 16 }
                        ],
                        data: shiftSummaries
                    }
                ]
            });

            return excelService.sendExcelResponse(res, buffer, `Ventas_Tienda_Turno_${start_date || 'periodo'}.xlsx`);
        }

        const pdfBuffer = await pdfService.generateStoreSalesByShiftPDF(fullData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Ventas_Tienda_Turno_${start_date || 'periodo'}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportStoreSalesByShiftPDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de ventas de tienda por turno' });
    }
};

module.exports = {
    getPuntosVentaTienda: storeShiftService.getPuntosVentaTienda,
    getStoreSalesByShift,
    exportStoreSalesByShiftPDF
};
