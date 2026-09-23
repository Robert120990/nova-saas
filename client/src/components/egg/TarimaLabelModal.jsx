import React, { useState, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
    Printer,
    X,
    Calendar,
    User,
    Layers,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Package,
    Boxes
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

/**
 * Genera el Código QR como un string SVG vectorial independiente para impresión
 */
const generateQrSvg = (payloadObj, size = 68) => {
    try {
        const jsonStr = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
        return renderToStaticMarkup(
            React.createElement(QRCodeSVG, {
                value: jsonStr,
                size: size,
                level: 'M',
                includeMargin: false
            })
        );
    } catch (e) {
        console.warn('Error generando QR SVG:', e);
        return '';
    }
};

/**
 * Helper to format date to DD/MM/YYYY
 */
const formatDate = (d) => {
    if (!d) return '---';
    if (typeof d === 'string') {
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '---';
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
};

export default function TarimaLabelModal({
    isOpen,
    onClose,
    tarima,
    allTarimas = [],
    receptionData = {}
}) {
    // Normalizar la lista de tarimas
    const tarimasList = (allTarimas && allTarimas.length > 0)
        ? allTarimas
        : (tarima ? [tarima] : [{ tarima_number: 1, boxes_count: 24, gross_weight_lbs: 0, tare_weight_lbs: 60, net_weight_lbs: 0 }]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [labelFormat, setLabelFormat] = useState('80mm'); // '80mm' (por defecto según requerimiento), '4x6', 'half_letter'
    const unitsPerBox = 360; // Estándar industrial 360 huevos por caja (12 cartones x 30)

    useEffect(() => {
        if (tarima) {
            const idx = tarimasList.findIndex(t => t.tarima_number === tarima.tarima_number || (tarima.id && t.id === tarima.id));
            if (idx >= 0) setCurrentIndex(idx);
            else setCurrentIndex(0);
        } else {
            setCurrentIndex(0);
        }
    }, [tarima, allTarimas]);

    if (!isOpen) return null;

    const currentTarima = tarimasList[currentIndex] || tarimasList[0];
    const totalTarimasCount = tarimasList.length;

    // Resolver correlativo de la tarima
    const tarimaNum = currentTarima?.tarima_number || (currentIndex + 1);
    const lotCode = (receptionData.provider_lot || 'LOTE').trim().toUpperCase();
    const uniquePalletCode = `TAR-${lotCode}-${String(tarimaNum).padStart(2, '0')}`;
    const receptionFolio = receptionData.reception_id ? `REC-${String(receptionData.reception_id).padStart(5, '0')}` : 'ING-NUEVO';

    // Estimación de cantidad de huevo en unidades
    const boxesCount = parseInt(currentTarima?.boxes_count) || 0;
    const totalEggsUnits = boxesCount * unitsPerBox;

    const grossWeight = parseFloat(currentTarima?.gross_weight_lbs || 0);
    const tareWeight = parseFloat(currentTarima?.tare_weight_lbs || 0);
    const netWeight = parseFloat(currentTarima?.net_weight_lbs || (grossWeight - tareWeight > 0 ? grossWeight - tareWeight : 0));
    const hasCaja = currentTarima?.has_caja !== undefined ? Boolean(currentTarima.has_caja) : true;

    // Datos de la empresa y proveedor
    const companyName = (receptionData.company_name || 'ANDELSA, S.A. DE C.V.').toUpperCase();
    const providerName = (receptionData.provider_name || 'PROVEEDOR NO ESPECIFICADO').toUpperCase();
    const eggType = (receptionData.egg_type || 'HUEVO EN CÁSCARA').toUpperCase();
    const eggColor = receptionData.egg_color ? `COLOR: ${receptionData.egg_color.toUpperCase()}` : '';
    const eggSize = receptionData.egg_size ? `TALLA: ${receptionData.egg_size.toUpperCase()}` : '';
    const receptionDate = formatDate(receptionData.fecha || new Date());
    const operator = receptionData.operator_name || 'CONTROL DE CALIDAD';

    // Función para imprimir una o todas las tarimas en un iframe limpio
    const handlePrint = (printAll = false) => {
        const targetList = printAll ? tarimasList : [currentTarima];

        // Crear iframe oculto para impresión nativa sin popups
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;

        // Estilos según el formato elegido
        let pageCss = '';
        if (labelFormat === '4x6') {
            pageCss = `
                @page { size: 4in 6in; margin: 4mm; }
                .label-card { width: 3.8in; min-height: 5.7in; padding: 6mm; box-sizing: border-box; }
            `;
        } else if (labelFormat === '80mm') {
            pageCss = `
                @page { size: 80mm auto; margin: 2mm; }
                .label-card { width: 74mm; padding: 3mm; box-sizing: border-box; }
            `;
        } else {
            // Media carta (8.5 x 5.5 in) o Letter
            pageCss = `
                @page { size: letter portrait; margin: 10mm; }
                .label-card { width: 100%; max-width: 7in; padding: 8mm; box-sizing: border-box; border: 2px solid #0f172a; border-radius: 8px; }
            `;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Ficha de Tarima - ${lotCode}</title>
                <style>
                    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; }
                    ${pageCss}
                    .tarima-wrapper { page-break-after: always; display: flex; justify-content: center; align-items: flex-start; padding: 2mm; }
                    .tarima-wrapper:last-child { page-break-after: auto; }
                    .header-title { font-size: 11pt; font-weight: 900; text-align: center; text-transform: uppercase; margin: 0; color: #0f172a; letter-spacing: 0.5px; }
                    .header-sub { font-size: 7pt; font-weight: 700; text-align: center; text-transform: uppercase; color: #475569; margin-top: 1mm; margin-bottom: 2mm; letter-spacing: 1px; }
                    .correlativo-banner { background: #fff; color: #000; border: 2.5px solid #000; padding: 2.5mm 1mm; text-align: center; border-radius: 4px; margin-bottom: 2.5mm; }
                    .correlativo-title { font-size: 16pt; font-weight: 900; letter-spacing: 0.5px; color: #000; }
                    .correlativo-code { font-size: 10pt; font-weight: 900; color: #000; font-family: monospace; letter-spacing: 1.5px; margin-top: 1mm; }
                    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 2.5mm; font-size: 8pt; }
                    .info-grid td { padding: 1.5mm 1mm; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                    .info-label { font-weight: 800; color: #475569; text-transform: uppercase; font-size: 6.5pt; display: block; margin-bottom: 0.5mm; letter-spacing: 0.5px; }
                    .info-value { font-weight: 700; color: #0f172a; font-size: 8pt; }
                    .weight-box { border: 2px solid #0f172a; background: #f8fafc; border-radius: 4px; padding: 2.5mm; margin-bottom: 2.5mm; }
                    .weight-grid { width: 100%; border-collapse: collapse; }
                    .weight-grid td { text-align: center; padding: 1mm; }
                    .net-highlight { font-size: 15pt; font-weight: 900; color: #047857; letter-spacing: 0.5px; }
                    .footer-codes { display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #94a3b8; padding-top: 2.5mm; margin-top: 2mm; }
                    .operator-seal { font-size: 7pt; color: #64748b; text-align: right; }
                    .codes-section { border-top: 2px solid #0f172a; padding-top: 2.5mm; margin-top: 2.5mm; margin-bottom: 2mm; }
                    .qr-footer-block { display: flex; align-items: center; justify-content: space-between; gap: 4mm; border-top: 2px solid #0f172a; padding-top: 2.5mm; }
                    .qr-box { border: 2px solid #0f172a; background: #fff; padding: 2mm; border-radius: 4px; text-align: center; flex-shrink: 0; }
                    .qr-box svg { display: block; margin: 0 auto; }
                    .footer-meta { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
                </style>
            </head>
            <body>
                ${targetList.map((tItem, idx) => {
                    const tNum = tItem.tarima_number || (idx + 1);
                    const tGross = parseFloat(tItem.gross_weight_lbs || 0).toFixed(2);
                    const tTare = parseFloat(tItem.tare_weight_lbs || 0).toFixed(2);
                    const tNet = parseFloat(tItem.net_weight_lbs || (tGross - tTare > 0 ? tGross - tTare : 0)).toFixed(2);
                    const tBoxes = parseInt(tItem.boxes_count) || 0;
                    const tEggs = (tBoxes * unitsPerBox).toLocaleString();
                    const tCode = `TAR-${lotCode}-${String(tNum).padStart(2, '0')}`;
                    const tPallet = parseFloat(tItem.tare_pallet_lbs || 0);
                    const tSep = parseFloat(tItem.tare_separador_lbs || 0);
                    const tCaja = parseFloat(tItem.tare_caja_lbs || 0);
                    const hasBox = tItem.has_caja !== undefined ? Boolean(tItem.has_caja) : hasCaja;

                    return `
                        <div class="tarima-wrapper">
                            <div class="label-card">
                                <div class="header-title">${companyName}</div>
                                <div class="header-sub">PLANTA INDUSTRIAL DE OVOPRODUCTOS • CONTROL DE MATERIA PRIMA</div>
                                
                                <div class="correlativo-banner">
                                    <div class="correlativo-title">TARIMA #${String(tNum).padStart(2, '0')} DE ${String(targetList.length).padStart(2, '0')}</div>
                                    <div class="correlativo-code">${tCode}</div>
                                </div>

                                <div style="background: ${(tItem.storage_location || receptionData.storage_location || 'abajo') === 'arriba' ? '#fef3c7' : '#eff6ff'}; border: 1.5px solid ${(tItem.storage_location || receptionData.storage_location || 'abajo') === 'arriba' ? '#f59e0b' : '#3b82f6'}; padding: 1.5mm 2mm; text-align: center; border-radius: 4px; margin-bottom: 2.5mm;">
                                    <span style="font-size: 8.5pt; font-weight: 900; color: ${(tItem.storage_location || receptionData.storage_location || 'abajo') === 'arriba' ? '#92400e' : '#1e40af'}; letter-spacing: 0.5px; text-transform: uppercase;">
                                        ESTIBA / UBICACIÓN: ${(tItem.storage_location || receptionData.storage_location || 'abajo') === 'arriba' ? '⬆ ARRIBA (NIVEL RACK SUPERIOR)' : '⬇ ABAJO (NIVEL INFERIOR / PISO)'}
                                    </span>
                                </div>

                                <table class="info-grid">
                                    <tr>
                                        <td style="width: 50%;">
                                            <span class="info-label">INGRESO / FOLIO</span>
                                            <span class="info-value" style="color: #4338ca; font-weight: 900;">${receptionFolio}</span>
                                        </td>
                                        <td style="width: 50%;">
                                            <span class="info-label">FECHA RECEPCIÓN</span>
                                            <span class="info-value">${receptionDate}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td colspan="2">
                                            <span class="info-label">PROVEEDOR DE ORIGEN</span>
                                            <span class="info-value" style="font-size: 8.5pt;">${providerName}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="width: 50%;">
                                            <span class="info-label">LOTE DE PROVEEDOR</span>
                                            <span class="info-value" style="font-size: 10pt; font-weight: 900; font-family: monospace;">${lotCode}</span>
                                        </td>
                                        <td style="width: 50%;">
                                            <span class="info-label">TIPO / CLASIFICACIÓN</span>
                                            <span class="info-value">${eggType} ${eggColor ? `• ${eggColor}` : ''} ${eggSize ? `• ${eggSize}` : ''}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="width: 50%;">
                                            <span class="info-label">CANTIDAD DE CAJAS</span>
                                            <span class="info-value" style="font-size: 11pt; font-weight: 900;">${tBoxes} CAJAS</span>
                                        </td>
                                        <td style="width: 50%;">
                                            <span class="info-label">CANTIDAD HUEVOS (EST.)</span>
                                            <span class="info-value" style="font-size: 9.5pt; font-weight: 800;">${tEggs} UNIDADES</span>
                                        </td>
                                    </tr>
                                </table>

                                <div class="weight-box">
                                    <table class="weight-grid">
                                        <tr>
                                            <td style="width: 30%; border-right: 1px solid #cbd5e1;">
                                                <span class="info-label">PESO BRUTO</span>
                                                <div style="font-size: 10pt; font-weight: 800; color: #334155;">${tGross} lb</div>
                                            </td>
                                            <td style="width: 30%; border-right: 1px solid #cbd5e1;">
                                                <span class="info-label">TARA TARIMA</span>
                                                <div style="font-size: 10pt; font-weight: 800; color: #64748b;">${tTare} lb</div>
                                                ${(tPallet > 0 || tSep > 0) ? `<div style="font-size: 5.5pt; color: #64748b; margin-top: 1px;">${tPallet > 0 ? `Pallet: ${tPallet.toFixed(1)} + ` : ''}Sep: ${tSep.toFixed(1)}${hasBox ? ` + Caja: ${tCaja.toFixed(1)}` : ''}</div>` : ''}
                                            </td>
                                            <td style="width: 40%;">
                                                <span class="info-label" style="color: #047857; font-weight: 900;">PESO NETO HUEVO</span>
                                                <div class="net-highlight">${tNet} LB</div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <!-- Código QR Agrandado (2x) y Código de Trazabilidad -->
                                <div class="qr-footer-block">
                                    <div class="qr-box">
                                        ${generateQrSvg({
                                            id: tCode,
                                            lot: lotCode,
                                            tarima: tNum,
                                            net_lb: parseFloat(tNet),
                                            boxes: tBoxes,
                                            date: receptionDate
                                        }, labelFormat === '80mm' ? 128 : 152)}
                                    </div>
                                    <div class="footer-meta">
                                        <div>
                                            <span class="info-label">CÓDIGO DE TRAZABILIDAD</span>
                                            <div style="font-family: monospace; font-size: 10pt; font-weight: 900; letter-spacing: 1px; color: #000; border: 1.5px solid #000; padding: 1.5mm; text-align: center; border-radius: 4px; background: #fff;">
                                                *${tCode}*
                                            </div>
                                        </div>
                                        <div style="margin-top: 1.5mm;">
                                            <span class="info-label">MODO DE EMPAQUE</span>
                                            <div style="font-size: 8.5pt; font-weight: 800; color: #000;">
                                                ${hasBox ? 'CON CAJA / JABA' : 'A GRANEL (SOLO SEPARADOR)'}
                                            </div>
                                        </div>
                                        <div class="operator-seal" style="margin-top: 2mm;">
                                            <div><strong>RECIBIDO CONFORME:</strong> ${operator}</div>
                                            <div style="margin-top: 0.5mm; font-size: 6pt; color: #64748b;">SISTEMA SIPEWEB • CONTROL DE BÁSCULA</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </body>
            </html>
        `;

        try {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            iframe.contentWindow.focus();
            setTimeout(() => {
                try {
                    iframe.contentWindow.print();
                } catch (err) {
                    console.error('Error invocando impresión nativa:', err);
                    toast.error('Error al abrir diálogo de impresión.');
                } finally {
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 2000);
                }
            }, 350);
        } catch (err) {
            console.error('Error en proceso de impresión:', err);
            toast.error('Error al preparar impresión: ' + err.message);
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[94vh] overflow-hidden">
                
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                            <Boxes size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                Ficha de Identificación de Tarima
                                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                                    Tarima #{tarimaNum} de {totalTarimasCount}
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Etiqueta oficial de pesaje y trazabilidad de materia prima
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors"
                        title="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Toolbar Selector de Tarimas & Formato */}
                <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Navegación entre tarimas si hay más de 1 */}
                    <div className="flex items-center gap-2">
                        {totalTarimasCount > 1 && (
                            <>
                                <button
                                    type="button"
                                    disabled={currentIndex <= 0}
                                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Tarima anterior"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="font-bold text-slate-700 px-1">
                                    {currentIndex + 1} / {totalTarimasCount}
                                </span>
                                <button
                                    type="button"
                                    disabled={currentIndex >= totalTarimasCount - 1}
                                    onClick={() => setCurrentIndex(prev => Math.min(totalTarimasCount - 1, prev + 1))}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Tarima siguiente"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </>
                        )}
                        <span className="font-bold text-indigo-700 font-mono text-xs bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                            {uniquePalletCode}
                        </span>
                    </div>

                    {/* Selector de formato */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setLabelFormat('4x6')}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                labelFormat === '4x6' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            4" × 6" (Térmica)
                        </button>
                        <button
                            type="button"
                            onClick={() => setLabelFormat('half_letter')}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                labelFormat === 'half_letter' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Media Carta (Bond)
                        </button>
                        <button
                            type="button"
                            onClick={() => setLabelFormat('80mm')}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                labelFormat === '80mm' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Ticket 80mm
                        </button>
                    </div>
                </div>

                {/* Modal Body: Vista Previa Visual de la Tarima */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 flex justify-center items-start">
                    <div className={`bg-white border-2 border-slate-900 rounded-2xl shadow-xl p-5 text-slate-900 transition-all ${
                        labelFormat === '80mm' ? 'w-[320px]' : 'w-full max-w-[480px]'
                    }`}>
                        {/* Cabecera institucional */}
                        <div className="text-center pb-3 border-b border-slate-200">
                            <h4 className="text-xs font-black tracking-widest text-slate-900 uppercase">
                                {companyName}
                            </h4>
                            <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mt-0.5">
                                Control de Recepción & Trazabilidad de Materia Prima
                            </p>
                        </div>

                        {/* Banner Correlativo (Sin fondo oscuro, texto negro según requerimiento) */}
                        <div className="my-3 border-2 border-slate-900 bg-white text-slate-900 rounded-xl p-3 text-center shadow-xs">
                            <div className="text-lg font-black tracking-wide uppercase text-slate-900">
                                Tarima #{String(tarimaNum).padStart(2, '0')} de {String(totalTarimasCount).padStart(2, '0')}
                            </div>
                            <div className="text-xs font-bold text-slate-600 font-mono tracking-widest mt-0.5">
                                {uniquePalletCode}
                            </div>
                        </div>

                        {/* Ubicación / Estiba en Almacén */}
                        <div className={`mb-3 py-1.5 px-3 rounded-xl border text-center font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-2xs ${
                            (currentTarima?.storage_location || receptionData?.storage_location || 'abajo') === 'arriba'
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-blue-50 border-blue-300 text-blue-800'
                        }`}>
                            <span>{(currentTarima?.storage_location || receptionData?.storage_location || 'abajo') === 'arriba' ? '⬆ Estiba / Ubicación: Arriba (Rack Superior)' : '⬇ Estiba / Ubicación: Abajo (Nivel Piso)'}</span>
                        </div>

                        {/* Ficha técnica estructurada */}
                        <div className="grid grid-cols-2 gap-2 text-xs border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Folio Ingreso</span>
                                <span className="font-black text-indigo-700 font-mono">{receptionFolio}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Fecha Recepción</span>
                                <span className="font-bold text-slate-800 flex items-center gap-1">
                                    <Calendar size={11} className="text-slate-400" />
                                    {receptionDate}
                                </span>
                            </div>

                            <div className="col-span-2 pt-1 border-t border-slate-200">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Proveedor</span>
                                <span className="font-extrabold text-slate-900 truncate block">{providerName}</span>
                            </div>

                            <div className="pt-1 border-t border-slate-200">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Lote Proveedor</span>
                                <span className="font-black font-mono text-sm text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 inline-block">
                                    {lotCode}
                                </span>
                            </div>
                            <div className="pt-1 border-t border-slate-200">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Tipo Producto</span>
                                <span className="font-bold text-slate-800 block text-[11px] leading-tight">
                                    {eggType}
                                </span>
                                {(eggColor || eggSize) && (
                                    <span className="text-[10px] text-slate-500 block">
                                        {[eggColor, eggSize].filter(Boolean).join(' • ')}
                                    </span>
                                )}
                            </div>

                            <div className="pt-1 border-t border-slate-200">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Cajas en Tarima</span>
                                <span className="font-black text-slate-900 text-sm">{boxesCount} Cajas</span>
                            </div>
                            <div className="pt-1 border-t border-slate-200">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">Unidades Aprox.</span>
                                <span className="font-bold text-indigo-700 text-xs">{totalEggsUnits.toLocaleString()} Huevos</span>
                            </div>
                        </div>

                        {/* Bloque Destacado de Pesaje en Báscula */}
                        <div className="my-3 border-2 border-slate-900 rounded-xl p-3 bg-emerald-50/50">
                            <div className="grid grid-cols-3 gap-2 text-center items-center">
                                <div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide block">Peso Bruto</span>
                                    <span className="font-bold text-slate-700 text-xs">{grossWeight.toFixed(2)} lb</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wide block">Tara Tarima</span>
                                    <span className="font-bold text-slate-500 text-xs">{tareWeight.toFixed(2)} lb</span>
                                    {parseFloat(currentTarima?.tare_pallet_lbs || 0) > 0 && (
                                        <span className="text-[8px] text-slate-400 block font-mono mt-0.5">
                                            P:{parseFloat(currentTarima.tare_pallet_lbs || 0).toFixed(0)} S:{parseFloat(currentTarima.tare_separador_lbs || 0).toFixed(0)} C:{parseFloat(currentTarima.tare_caja_lbs || 0).toFixed(0)}
                                        </span>
                                    )}
                                </div>
                                <div className="bg-white border border-emerald-300 rounded-lg py-1 px-2 shadow-xs">
                                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wide block">PESO NETO</span>
                                    <span className="font-black text-emerald-700 text-base">{netWeight.toFixed(2)} LB</span>
                                </div>
                            </div>
                        </div>

                        {/* Modo de Empaque y Operador (Sin temp ni transporte) */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
                            <div className="flex items-center gap-1.5">
                                <Package size={13} className="text-indigo-600 shrink-0" />
                                <div>
                                    <span className="font-bold text-slate-800">Modo:</span> {hasCaja ? 'Con Caja / Jaba' : 'A Granel'}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <User size={13} className="text-slate-400 shrink-0" />
                                <div className="truncate">
                                    <span className="font-bold text-slate-800">Operador:</span> {operator}
                                </div>
                            </div>
                        </div>

                        {/* Código QR Agrandado (2x) y Código de Trazabilidad (Sin código de barras) */}
                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                            <div className="p-2 bg-white border-2 border-slate-900 rounded-xl shrink-0 flex items-center justify-center">
                                <QRCodeSVG
                                    value={JSON.stringify({
                                        id: uniquePalletCode,
                                        lot: lotCode,
                                        tarima: tarimaNum,
                                        net_lb: netWeight,
                                        boxes: boxesCount,
                                        date: receptionDate
                                    })}
                                    size={96}
                                />
                            </div>
                            <div className="flex-1 flex flex-col justify-between py-1">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                                        Código Trazabilidad
                                    </span>
                                    <div className="font-mono text-xs font-black text-slate-900 bg-white border-2 border-slate-900 rounded-lg px-2 py-1 text-center tracking-wider break-all">
                                        *{uniquePalletCode}*
                                    </div>
                                </div>
                                <div className="mt-2 text-[9px] font-semibold text-slate-500">
                                    <span className="text-slate-700 font-bold">EMPAQUE: </span>
                                    {hasCaja ? 'CON CAJA / JABA' : 'A GRANEL'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer: Botones de Acción */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        Listo para impresión directa a cualquier impresora térmica o láser
                    </div>

                    <div className="flex items-center gap-2">
                        {totalTarimasCount > 1 && (
                            <button
                                type="button"
                                onClick={() => handlePrint(true)}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs border border-slate-200"
                            >
                                <Layers size={14} className="text-indigo-600" />
                                Imprimir Todas ({totalTarimasCount})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => handlePrint(false)}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md hover:shadow-indigo-500/20"
                        >
                            <Printer size={15} />
                            Imprimir Tarima #{tarimaNum}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
