import { formatDate, computeMpJulianLot } from '../../utils/dateUtils';
import React, { useState, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import JsBarcode from 'jsbarcode';
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
 * Componente dedicado para renderizar el Código de Barras Code128 en React
 */
const BarcodeRenderer = ({
    value,
    width = 1.15,
    height = 30,
    fontSize = 9,
    className = ''
}) => {
    const svgRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current || !value) return;
        try {
            const cleanVal = String(value).trim();
            JsBarcode(svgRef.current, cleanVal, {
                format: 'CODE128',
                width: width,
                height: height,
                displayValue: true,
                fontSize: fontSize,
                font: 'monospace',
                fontOptions: 'bold',
                margin: 0,
                textMargin: 2
            });
        } catch (e) {
            console.warn('Error renderizando código de barras:', e);
        }
    }, [value, width, height, fontSize]);

    if (!value) return null;
    return <svg ref={svgRef} className={`max-w-full block mx-auto ${className}`}></svg>;
};

/**
 * Genera el Código de Barras Code128 como string SVG vectorial para impresión
 */
const generateBarcodeSvg = (value, options = {}) => {
    try {
        if (!value) return '';
        const cleanVal = String(value).trim();
        const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svgNode, cleanVal, {
            format: 'CODE128',
            width: options.width || 1.15,
            height: options.height || 30,
            displayValue: options.displayValue !== false,
            fontSize: options.fontSize || 9,
            font: 'monospace',
            fontOptions: 'bold',
            margin: 0,
            textMargin: 2,
            ...options
        });
        svgNode.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 0 auto;');
        return svgNode.outerHTML;
    } catch (e) {
        console.warn('Error generando código de barras SVG para impresión:', e);
        return '';
    }
};

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
 * Resuelve el lote interno de MP
 */
const resolveInternalLot = (recData, tItem) => {
    if (tItem?.internal_lot) return tItem.internal_lot;
    if (recData?.reception_lot) return recData.reception_lot;
    if (recData?.internal_lot) return recData.internal_lot;
    if (recData?.lote_interno) return recData.lote_interno;
    if (recData?.quality_lab_report_json) {
        try {
            const p = typeof recData.quality_lab_report_json === 'string'
                ? JSON.parse(recData.quality_lab_report_json)
                : recData.quality_lab_report_json;
            if (p?.reception_lot) return p.reception_lot;
        } catch (e) { }
    }
    return computeMpJulianLot(recData?.fecha || tItem?.created_at || new Date());
};

/**
 * Resuelve la descripción de ubicación de la tarima
 */
const resolveLocationText = (tItem, recData) => {
    const rawLoc = (tItem?.storage_location || recData?.storage_location || 'abajo').toLowerCase();
    if (rawLoc === 'arriba') return 'ARRIBA (RACK)';
    if (rawLoc.includes('cont')) return 'CONTENEDOR';
    if (rawLoc === 'abajo') return 'ABAJO (PISO)';
    return String(tItem?.storage_location || recData?.storage_location || 'ABAJO (PISO)').toUpperCase();
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
    // Formato 58mm predeterminado según requerimiento
    const [labelFormat, setLabelFormat] = useState('58mm'); // '58mm' (por defecto), '80mm', '4x6', 'half_letter'
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
    const totalTarimasCount = tarimasList.length || 1;

    // Resolver correlativo de la tarima
    const tarimaNum = currentTarima?.tarima_number || (currentIndex + 1);
    const lotCode = (receptionData.provider_lot || 'LOTE').trim().toUpperCase();
    const uniquePalletCode = `TAR-${lotCode}-${String(tarimaNum).padStart(2, '0')}`;
    const receptionFolio = receptionData.reception_id ? `REC-${String(receptionData.reception_id).padStart(5, '0')}` : 'ING-NUEVO';

    // Estimación y pesaje
    const boxesCount = parseInt(currentTarima?.boxes_count, 10) || 0;
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
    const eggColorOrSize = [
        receptionData.egg_color ? receptionData.egg_color.toUpperCase() : null,
        receptionData.egg_size ? receptionData.egg_size.toUpperCase() : null
    ].filter(Boolean).join(' • ');
    const receptionDate = formatDate(receptionData.fecha || new Date());
    const operator = receptionData.operator_name || 'CONTROL DE CALIDAD';

    // Datos específicos para formato 58mm
    const currentInternalLot = resolveInternalLot(receptionData, currentTarima);
    const currentLocationText = resolveLocationText(currentTarima, receptionData);
    const currentAvgBoxWeight = boxesCount > 0 && netWeight > 0
        ? `${(netWeight / boxesCount).toFixed(2)} LB/CJ`
        : (boxesCount > 0 && grossWeight > 0 ? `${(grossWeight / boxesCount).toFixed(2)} LB/CJ` : '---');

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
        if (labelFormat === '58mm') {
            pageCss = `
                @page { size: 58mm auto; margin: 1.5mm 1mm; }
                .label-card { width: 50mm; max-width: 50mm; padding: 1mm 0.5mm; box-sizing: border-box; margin: 0 auto; color: #000; }
                .tarima-wrapper { page-break-after: always; display: flex; justify-content: center; align-items: flex-start; padding: 1mm 0; }
                .tarima-wrapper:last-child { page-break-after: auto; }
            `;
        } else if (labelFormat === '4x6') {
            pageCss = `
                @page { size: 4in 6in; margin: 4mm; }
                .label-card { width: 3.8in; min-height: 5.7in; padding: 6mm; box-sizing: border-box; }
                .tarima-wrapper { page-break-after: always; display: flex; justify-content: center; align-items: flex-start; padding: 2mm; }
                .tarima-wrapper:last-child { page-break-after: auto; }
            `;
        } else if (labelFormat === '80mm') {
            pageCss = `
                @page { size: 80mm auto; margin: 2mm; }
                .label-card { width: 74mm; padding: 3mm; box-sizing: border-box; }
                .tarima-wrapper { page-break-after: always; display: flex; justify-content: center; align-items: flex-start; padding: 2mm; }
                .tarima-wrapper:last-child { page-break-after: auto; }
            `;
        } else {
            // Media carta (8.5 x 5.5 in) o Letter
            pageCss = `
                @page { size: letter portrait; margin: 10mm; }
                .label-card { width: 100%; max-width: 7in; padding: 8mm; box-sizing: border-box; border: 2px solid #0f172a; border-radius: 8px; }
                .tarima-wrapper { page-break-after: always; display: flex; justify-content: center; align-items: flex-start; padding: 2mm; }
                .tarima-wrapper:last-child { page-break-after: auto; }
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
                    .qr-footer-block { display: flex; align-items: center; justify-content: space-between; gap: 4mm; border-top: 2px solid #0f172a; padding-top: 2.5mm; }
                    .qr-box { border: 2px solid #0f172a; background: #fff; padding: 2mm; border-radius: 4px; text-align: center; flex-shrink: 0; }
                    .qr-box svg { display: block; margin: 0 auto; }
                    .footer-meta { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
                    .operator-seal { font-size: 7pt; color: #64748b; text-align: right; }
                </style>
            </head>
            <body>
                ${targetList.map((tItem, idx) => {
                    const tNum = tItem.tarima_number || (idx + 1);
                    const tGross = parseFloat(tItem.gross_weight_lbs || 0).toFixed(2);
                    const tTare = parseFloat(tItem.tare_weight_lbs || 0).toFixed(2);
                    const tNet = parseFloat(tItem.net_weight_lbs || (tGross - tTare > 0 ? tGross - tTare : 0)).toFixed(2);
                    const tBoxes = parseInt(tItem.boxes_count, 10) || 0;
                    const tEggs = (tBoxes * unitsPerBox).toLocaleString();
                    const tCode = `TAR-${lotCode}-${String(tNum).padStart(2, '0')}`;
                    const tPallet = parseFloat(tItem.tare_pallet_lbs || 0);
                    const tSep = parseFloat(tItem.tare_separador_lbs || 0);
                    const tCaja = parseFloat(tItem.tare_caja_lbs || 0);
                    const hasBox = tItem.has_caja !== undefined ? Boolean(tItem.has_caja) : hasCaja;

                    // Si es formato 58mm: FORMATO COMPACTO EXACTO CON SOLAMENTE LOS DATOS SOLICITADOS
                    if (labelFormat === '58mm') {
                        const internalLot = resolveInternalLot(receptionData, tItem);
                        const locText = resolveLocationText(tItem, receptionData);
                        const avgBoxWeight = tBoxes > 0 && parseFloat(tNet) > 0
                            ? `${(parseFloat(tNet) / tBoxes).toFixed(2)} LB/CJ`
                            : (tBoxes > 0 && parseFloat(tGross) > 0 ? `${(parseFloat(tGross) / tBoxes).toFixed(2)} LB/CJ` : '---');
                        const qrPayload = {
                            id: tCode,
                            lot: lotCode,
                            tarima: tNum,
                            net_lb: parseFloat(tNet),
                            boxes: tBoxes,
                            date: receptionDate
                        };

                        return `
                            <div class="tarima-wrapper">
                                <div class="label-card" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                                    
                                    <!-- 1. Tarima #xx de xx -->
                                    <div style="border: 2px solid #000; padding: 2mm 1mm; text-align: center; border-radius: 4px; margin-bottom: 2mm; background: #fff;">
                                        <div style="font-size: 12pt; font-weight: 900; letter-spacing: 0.5px; line-height: 1.1; text-transform: uppercase; color: #000;">
                                            TARIMA #${String(tNum).padStart(2, '0')} DE ${String(totalTarimasCount).padStart(2, '0')}
                                        </div>
                                    </div>

                                    <!-- 2. Lote Interno -->
                                    <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dashed #000; padding: 1.2mm 0;">
                                        <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">LOTE INTERNO:</span>
                                        <span style="font-size: 9.5pt; font-weight: 900; font-family: monospace; color: #000;">${internalLot}</span>
                                    </div>

                                    <!-- 3. Ubicación -->
                                    <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dashed #000; padding: 1.2mm 0;">
                                        <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">UBICACIÓN:</span>
                                        <span style="font-size: 8.5pt; font-weight: 900; color: #000;">${locText}</span>
                                    </div>

                                    <!-- 4. Folio de Ingreso / Fecha Recepción -->
                                    <div style="border-bottom: 1px dashed #000; padding: 1.2mm 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                            <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">FOLIO INGRESO:</span>
                                            <span style="font-size: 8.5pt; font-weight: 900; font-family: monospace; color: #000;">${receptionFolio}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.8mm;">
                                            <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">FECHA RECEP.:</span>
                                            <span style="font-size: 8.5pt; font-weight: 800; color: #000;">${receptionDate}</span>
                                        </div>
                                    </div>

                                    <!-- 5. Proveedor -->
                                    <div style="border-bottom: 1px dashed #000; padding: 1.2mm 0;">
                                        <span style="font-size: 6.5pt; font-weight: 800; text-transform: uppercase; display: block; color: #000;">PROVEEDOR:</span>
                                        <div style="font-size: 8pt; font-weight: 900; text-transform: uppercase; word-break: break-word; line-height: 1.15; color: #000;">${providerName}</div>
                                    </div>

                                    <!-- 6. Lote Proveedor / Tipo de Producto -->
                                    <div style="border-bottom: 1px dashed #000; padding: 1.2mm 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                            <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">LOTE PROV.:</span>
                                            <span style="font-size: 9pt; font-weight: 900; font-family: monospace; color: #000;">${lotCode}</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.8mm;">
                                            <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">PRODUCTO:</span>
                                            <span style="font-size: 7.5pt; font-weight: 800; text-align: right; text-transform: uppercase; color: #000;">${eggType}${eggColorOrSize ? ` (${eggColorOrSize})` : ''}</span>
                                        </div>
                                    </div>

                                    <!-- 7. Cajas de Tarima / Peso Promedio Caja -->
                                    <div style="border-bottom: 2px solid #000; padding: 1.2mm 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: baseline;">
                                            <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">CAJAS TARIMA:</span>
                                            <span style="font-size: 9.5pt; font-weight: 900; color: #000;">${tBoxes} CAJAS</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.8mm;">
                                            <span style="font-size: 7pt; font-weight: 800; text-transform: uppercase; color: #000;">PESO PROM. CAJA:</span>
                                            <span style="font-size: 9.5pt; font-weight: 900; color: #000;">${avgBoxWeight}</span>
                                        </div>
                                    </div>

                                    <!-- 8. Código de Barra y QR Legible -->
                                    <div style="text-align: center; margin-top: 2.5mm; margin-bottom: 1.5mm;">
                                        ${generateBarcodeSvg(tCode, { width: 1.15, height: 30, fontSize: 9 })}
                                    </div>
                                    <div style="text-align: center; margin-top: 1.5mm; margin-bottom: 1mm;">
                                        <div style="display: inline-block; padding: 1.5mm; border: 2px solid #000; border-radius: 4px; background: #fff;">
                                            ${generateQrSvg(qrPayload, 145)}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        `;
                    }

                    // Formatos estándar: 80mm, 4x6, media carta
                    const rawLoc = (tItem.storage_location || receptionData.storage_location || 'abajo').toLowerCase();
                    let locBg = '#eff6ff';
                    let locBorder = '#3b82f6';
                    let locColor = '#1e40af';
                    let locText = '⬇ ABAJO (NIVEL INFERIOR / PISO)';

                    if (rawLoc === 'arriba') {
                        locBg = '#fef3c7';
                        locBorder = '#f59e0b';
                        locColor = '#92400e';
                        locText = '⬆ ARRIBA (NIVEL RACK SUPERIOR)';
                    } else if (rawLoc === 'cont' || rawLoc.includes('cont')) {
                        locBg = '#ecfdf5';
                        locBorder = '#10b981';
                        locColor = '#065f46';
                        locText = '📦 CONTENEDOR (CAP. 10 TARIMAS)';
                    }

                    return `
                        <div class="tarima-wrapper">
                            <div class="label-card">
                                <div class="header-title">${companyName}</div>
                                <div class="header-sub">PLANTA INDUSTRIAL DE OVOPRODUCTOS • CONTROL DE MATERIA PRIMA</div>
                                
                                <div class="correlativo-banner">
                                    <div class="correlativo-title">TARIMA #${String(tNum).padStart(2, '0')} DE ${String(totalTarimasCount).padStart(2, '0')}</div>
                                    <div class="correlativo-code">${tCode}</div>
                                </div>

                                <div style="background: ${locBg}; border: 1.5px solid ${locBorder}; padding: 1.5mm 2mm; text-align: center; border-radius: 4px; margin-bottom: 2.5mm;">
                                    <span style="font-size: 8.5pt; font-weight: 900; color: ${locColor}; letter-spacing: 0.5px; text-transform: uppercase;">
                                        ESTIBA / UBICACIÓN: ${locText}
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

                                <!-- Código QR Agrandado y Código de Trazabilidad -->
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[94dvh] overflow-hidden my-auto">
                
                {/* Modal Header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                        <div className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm shrink-0">
                            <Boxes size={18} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                                <span>Ficha de Identificación</span>
                                <span className="text-[9px] sm:text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">
                                    #{tarimaNum}/{totalTarimasCount}
                                </span>
                            </h3>
                            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate sm:whitespace-normal">
                                Etiqueta oficial de pesaje y trazabilidad de materia prima
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors shrink-0"
                        title="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Toolbar Selector de Tarimas & Formato */}
                <div className="px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    {/* Navegación entre tarimas si hay más de 1 */}
                    <div className="flex items-center gap-1.5">
                        {totalTarimasCount > 1 && (
                            <>
                                <button
                                    type="button"
                                    disabled={currentIndex <= 0}
                                    onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                    className="p-1 sm:p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Tarima anterior"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="font-bold text-slate-700 px-1 text-[11px]">
                                    {currentIndex + 1}/{totalTarimasCount}
                                </span>
                                <button
                                    type="button"
                                    disabled={currentIndex >= totalTarimasCount - 1}
                                    onClick={() => setCurrentIndex(prev => Math.min(totalTarimasCount - 1, prev + 1))}
                                    className="p-1 sm:p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-30 transition-colors"
                                    title="Tarima siguiente"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </>
                        )}
                        <span className="font-bold text-indigo-700 font-mono text-[11px] sm:text-xs bg-indigo-50 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-indigo-100 truncate max-w-[140px] sm:max-w-none">
                            {uniquePalletCode}
                        </span>
                    </div>

                    {/* Selector de formato: 58mm predeterminado */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-none">
                        <button
                            type="button"
                            onClick={() => setLabelFormat('58mm')}
                            className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                                labelFormat === '58mm' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            58mm (Predet.)
                        </button>
                        <button
                            type="button"
                            onClick={() => setLabelFormat('80mm')}
                            className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                                labelFormat === '80mm' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            80mm
                        </button>
                        <button
                            type="button"
                            onClick={() => setLabelFormat('4x6')}
                            className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                                labelFormat === '4x6' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            4" × 6"
                        </button>
                        <button
                            type="button"
                            onClick={() => setLabelFormat('half_letter')}
                            className={`px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                                labelFormat === 'half_letter' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Media Carta
                        </button>
                    </div>
                </div>

                {/* Modal Body: Vista Previa Visual de la Tarima */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 flex justify-center items-start">
                    {labelFormat === '58mm' ? (
                        /* VISTA PREVIA FORMATO 58MM (SOLO LOS DATOS SOLICITADOS) */
                        <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-xl p-4 text-slate-900 w-[270px]">
                            {/* 1. Tarima #xx de xx */}
                            <div className="border-2 border-slate-900 bg-white text-slate-900 rounded-xl p-2.5 text-center shadow-xs mb-2.5">
                                <div className="text-base font-black tracking-wide uppercase text-slate-900">
                                    Tarima #{String(tarimaNum).padStart(2, '0')} de {String(totalTarimasCount).padStart(2, '0')}
                                </div>
                            </div>

                            {/* 2. Lote Interno */}
                            <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-300 text-xs">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Lote Interno</span>
                                <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {currentInternalLot}
                                </span>
                            </div>

                            {/* 3. Ubicación */}
                            <div className="flex items-center justify-between py-1.5 border-b border-dashed border-slate-300 text-xs">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Ubicación</span>
                                <span className="font-black text-xs text-slate-900">
                                    {currentLocationText}
                                </span>
                            </div>

                            {/* 4. Folio de Ingreso / Fecha Recepción */}
                            <div className="py-1.5 border-b border-dashed border-slate-300 space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Folio Ingreso</span>
                                    <span className="font-mono font-black text-indigo-700">{receptionFolio}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Fecha Recep.</span>
                                    <span className="font-bold text-slate-800">{receptionDate}</span>
                                </div>
                            </div>

                            {/* 5. Proveedor */}
                            <div className="py-1.5 border-b border-dashed border-slate-300 text-xs">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-0.5">Proveedor</span>
                                <span className="font-black text-xs text-slate-900 uppercase block truncate">{providerName}</span>
                            </div>

                            {/* 6. Lote Proveedor / Tipo de Producto */}
                            <div className="py-1.5 border-b border-dashed border-slate-300 space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Lote Prov.</span>
                                    <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        {lotCode}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Producto</span>
                                    <span className="font-bold text-[11px] text-slate-800 text-right uppercase">
                                        {eggType}{eggColorOrSize ? ` (${eggColorOrSize})` : ''}
                                    </span>
                                </div>
                            </div>

                            {/* 7. Cajas de Tarima / Peso Promedio Caja */}
                            <div className="py-1.5 border-b-2 border-slate-900 space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Cajas Tarima</span>
                                    <span className="font-black text-xs text-slate-900">{boxesCount} Cajas</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Peso Prom. Caja</span>
                                    <span className="font-black text-xs text-emerald-800">{currentAvgBoxWeight}</span>
                                </div>
                            </div>

                            {/* 8. Código de Barra y QR Legible */}
                            <div className="pt-2 text-center">
                                <div className="my-1.5">
                                    <BarcodeRenderer value={uniquePalletCode} width={1.15} height={30} fontSize={9} />
                                </div>
                                <div className="p-2 bg-white border-2 border-slate-900 rounded-2xl inline-block mt-1 shadow-xs">
                                    <QRCodeSVG
                                        value={JSON.stringify({
                                            id: uniquePalletCode,
                                            lot: lotCode,
                                            tarima: tarimaNum,
                                            net_lb: netWeight,
                                            boxes: boxesCount,
                                            date: receptionDate
                                        })}
                                        size={168}
                                        level="M"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* VISTA PREVIA 80mm / 4x6 / MEDIA CARTA */
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

                            {/* Banner Correlativo */}
                            <div className="my-3 border-2 border-slate-900 bg-white text-slate-900 rounded-xl p-3 text-center shadow-xs">
                                <div className="text-lg font-black tracking-wide uppercase text-slate-900">
                                    Tarima #{String(tarimaNum).padStart(2, '0')} de {String(totalTarimasCount).padStart(2, '0')}
                                </div>
                                <div className="text-xs font-bold text-slate-600 font-mono tracking-widest mt-0.5">
                                    {uniquePalletCode}
                                </div>
                            </div>

                            {/* Ubicación / Estiba en Almacén */}
                            {(() => {
                                const curLoc = (currentTarima?.storage_location || receptionData?.storage_location || 'abajo').toLowerCase();
                                const isArriba = curLoc === 'arriba';
                                const isCont = curLoc === 'cont' || curLoc.includes('cont');
                                return (
                                    <div className={`mb-3 py-1.5 px-3 rounded-xl border text-center font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-2xs ${
                                        isArriba
                                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                                            : (isCont
                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                                : 'bg-blue-50 border-blue-300 text-blue-800')
                                    }`}>
                                        <span>
                                            {isArriba
                                                ? '⬆ Estiba / Ubicación: Arriba (Rack Superior)'
                                                : (isCont
                                                    ? '📦 Estiba / Ubicación: Contenedor (Cap. 10)'
                                                    : '⬇ Estiba / Ubicación: Abajo (Nivel Piso)')}
                                        </span>
                                    </div>
                                );
                            })()}

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

                            {/* Modo de Empaque y Operador */}
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

                            {/* Código QR Agrandado y Código de Trazabilidad */}
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
                    )}
                </div>

                {/* Modal Footer: Botones de Acción */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-[10px] sm:text-[11px] text-slate-500 font-semibold flex items-center gap-1.5 self-start sm:self-center">
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        <span>
                            {labelFormat === '58mm'
                                ? 'Optimizado para ticket de 58mm'
                                : 'Listo para impresión térmica o láser'}
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {totalTarimasCount > 1 && (
                            <button
                                type="button"
                                onClick={() => handlePrint(true)}
                                className="w-full sm:w-auto px-4 py-2 sm:py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs border border-slate-200 text-center"
                            >
                                <Layers size={14} className="text-indigo-600" />
                                <span>Imprimir Todas ({totalTarimasCount})</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => handlePrint(false)}
                            className="w-full sm:w-auto px-5 py-2 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/20 text-center"
                        >
                            <Printer size={15} />
                            <span>Imprimir Tarima #{tarimaNum}</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
