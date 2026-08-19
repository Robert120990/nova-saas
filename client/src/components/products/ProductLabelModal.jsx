import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Printer,
    Download,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Barcode as BarcodeIcon,
    Tag,
    Building2,
    DollarSign,
    Layers,
    Copy,
    Sliders,
    Eye,
    X,
    Sparkles,
    FileText,
    Store
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';

const PRESET_SIZES = [
    { id: '50x30', name: '50 × 30 mm', width: 50, height: 30, desc: 'Estándar Góndola / Retail' },
    { id: '50x25', name: '50 × 25 mm', width: 50, height: 25, desc: 'Joyería / Farmacia / Compacto' },
    { id: '40x30', name: '40 × 30 mm', width: 40, height: 30, desc: 'Frascos / Bolsas pequeñas' },
    { id: '30x20', name: '30 × 20 mm', width: 30, height: 20, desc: 'Mini / Accesorios' },
    { id: '60x40', name: '60 × 40 mm', width: 60, height: 40, desc: 'Mediano / Caja producto' },
    { id: '80x50', name: '80 × 50 mm', width: 80, height: 50, desc: 'Grande / Bulto / Trazabilidad' },
    { id: '100x50', name: '100 × 50 mm', width: 100, height: 50, desc: 'Almacén / Logística' },
    { id: 'custom', name: 'Personalizado', width: 50, height: 30, desc: 'Definir ancho y alto en mm' },
];

/**
 * Dedicated subcomponent to ensure barcode SVG renders reliably on every mount and prop change
 */
const BarcodeRenderer = ({
    value,
    format = 'CODE128',
    width = 1.6,
    height = 28,
    displayValue = true,
    className = ''
}) => {
    const svgRef = useRef(null);

    useEffect(() => {
        if (!svgRef.current || !value) return;

        const cleanVal = String(value).trim();
        if (!cleanVal) return;

        const renderBarcode = (fmt) => {
            JsBarcode(svgRef.current, cleanVal, {
                format: fmt,
                lineColor: '#000000',
                width: width,
                height: height,
                displayValue: displayValue,
                fontSize: 10,
                font: 'monospace',
                textMargin: 1,
                margin: 0,
                valid: () => {}
            });
        };

        try {
            renderBarcode(format || 'CODE128');
        } catch (e) {
            console.warn(`JsBarcode fallback for format ${format}:`, e);
            try {
                renderBarcode('CODE128');
            } catch (err) {
                console.error('JsBarcode render failed:', err);
            }
        }
    }, [value, format, width, height, displayValue]);

    if (!value) return null;

    return <svg ref={svgRef} className={`max-w-full ${className}`}></svg>;
};

const ProductLabelModal = ({
    isOpen,
    onClose,
    product,
    products = [],
    branches = [],
    onSelectProduct
}) => {
    const { user } = useAuth();

    // Active tab in mobile view: 'settings' or 'preview'
    const [mobileTab, setMobileTab] = useState('settings');

    // Selected product & branch price
    const [currentProduct, setCurrentProduct] = useState(product || null);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [customPrice, setCustomPrice] = useState('');

    // Label dimensions & orientation
    const [sizePreset, setSizePreset] = useState('50x30');
    const [widthMm, setWidthMm] = useState(50);
    const [heightMm, setHeightMm] = useState(30);
    const [orientation, setOrientation] = useState('horizontal'); // 'horizontal' | 'vertical'

    // Fields to print
    const [showCompany, setShowCompany] = useState(true);
    const [companyName, setCompanyName] = useState(user?.company_name || 'MI EMPRESA');

    const [showProductName, setShowProductName] = useState(true);
    const [productNameSize, setProductNameSize] = useState('sm'); // 'xs' | 'sm' | 'base' | 'lg'
    const [productNameBold, setProductNameBold] = useState(true);

    const [showInternalCode, setShowInternalCode] = useState(true);
    const [internalCodePrefix, setInternalCodePrefix] = useState('COD: ');

    const [showBarcode, setShowBarcode] = useState(true);
    const [barcodeType, setBarcodeType] = useState('CODE128'); // 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'QR' | 'NONE'
    const [barcodeValue, setBarcodeValue] = useState('');
    const [showBarcodeText, setShowBarcodeText] = useState(true);

    const [showPrice, setShowPrice] = useState(true);
    const [pricePrefix, setPricePrefix] = useState('$'); // '$' | 'PVP: $' | 'PRECIO: $' | 'OFERTA: $'
    const [priceSize, setPriceSize] = useState('large'); // 'normal' | 'large' | 'xlarge'

    const [showCategory, setShowCategory] = useState(false);
    const [showUnit, setShowUnit] = useState(false);

    const [showCustomNote, setShowCustomNote] = useState(false);
    const [customNoteText, setCustomNoteText] = useState('IVA Incluido');

    const [showBorder, setShowBorder] = useState(false);
    const [textAlignment, setTextAlignment] = useState('center'); // 'center' | 'left'

    // Copies
    const [copies, setCopies] = useState(1);

    // Zoom state (for visual preview)
    const [zoomLevel, setZoomLevel] = useState(120);

    // Ref for preview DOM
    const previewLabelRef = useRef(null);

    // Sync product data whenever the modal opens or product changes
    useEffect(() => {
        if (!isOpen) return;

        const activeProd = product || (products.length > 0 ? products[0] : null);
        if (activeProd) {
            setCurrentProduct(activeProd);

            // Auto select branch and price
            if (activeProd.branches && activeProd.branches.length > 0) {
                const firstBranch = activeProd.branches[0];
                setSelectedBranchId(String(firstBranch));
                const price = activeProd.branchPrices?.[firstBranch] ?? activeProd.precio_unitario ?? activeProd.costo ?? 0;
                setCustomPrice(Number(price).toFixed(2));
            } else {
                setSelectedBranchId('');
                const price = activeProd.precio_unitario ?? activeProd.costo ?? 0;
                setCustomPrice(Number(price).toFixed(2));
            }

            // Barcode value defaults to codigo_barra or internal code
            const code = activeProd.codigo_barra || activeProd.codigo || '';
            setBarcodeValue(code);

            // Auto detect suitable barcode type
            if (/^\d{13}$/.test(code)) {
                setBarcodeType('EAN13');
            } else if (/^\d{8}$/.test(code)) {
                setBarcodeType('EAN8');
            } else if (/^\d{12}$/.test(code)) {
                setBarcodeType('UPC');
            } else {
                setBarcodeType('CODE128');
            }
        }
    }, [isOpen, product, products]);

    useEffect(() => {
        if (user?.company_name && !companyName) {
            setCompanyName(user.company_name);
        }
    }, [user]);

    // Handle preset size changes
    const handleSizePresetChange = (presetId) => {
        setSizePreset(presetId);
        const found = PRESET_SIZES.find(p => p.id === presetId);
        if (found && presetId !== 'custom') {
            setWidthMm(found.width);
            setHeightMm(found.height);
        }
    };

    // Calculate effective width & height based on orientation
    const effectiveWidth = useMemo(() => {
        if (orientation === 'vertical' && widthMm > heightMm) {
            return heightMm;
        }
        if (orientation === 'horizontal' && heightMm > widthMm) {
            return heightMm;
        }
        return widthMm;
    }, [widthMm, heightMm, orientation]);

    const effectiveHeight = useMemo(() => {
        if (orientation === 'vertical' && widthMm > heightMm) {
            return widthMm;
        }
        if (orientation === 'horizontal' && heightMm > widthMm) {
            return widthMm;
        }
        return heightMm;
    }, [widthMm, heightMm, orientation]);

    // Format current price
    const formattedPrice = useMemo(() => {
        const num = parseFloat(customPrice);
        if (isNaN(num)) return '0.00';
        return num.toFixed(2);
    }, [customPrice]);

    if (!isOpen) return null;

    // Direct Thermal Print Function (Isolated Iframe)
    const handlePrintDirect = () => {
        if (!currentProduct) {
            toast.error('Seleccione un producto para imprimir');
            return;
        }

        const labelElement = previewLabelRef.current;
        if (!labelElement) return;

        // Clone the rendered label HTML
        const labelHtml = labelElement.outerHTML;

        // Create hidden print iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;

        // Generate N copies
        let pagesHtml = '';
        for (let i = 0; i < Math.max(1, copies); i++) {
            pagesHtml += `<div class="label-page">${labelHtml}</div>`;
        }

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Etiqueta - ${currentProduct.nombre || 'Producto'}</title>
                <style>
                    @page {
                        size: ${effectiveWidth}mm ${effectiveHeight}mm;
                        margin: 0;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    html, body {
                        width: ${effectiveWidth}mm;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .label-page {
                        width: ${effectiveWidth}mm;
                        height: ${effectiveHeight}mm;
                        page-break-after: always;
                        break-after: page;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .label-page > div {
                        width: ${effectiveWidth}mm !important;
                        height: ${effectiveHeight}mm !important;
                        max-width: ${effectiveWidth}mm !important;
                        max-height: ${effectiveHeight}mm !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        transform: none !important;
                    }
                    svg {
                        max-width: 100%;
                        height: auto;
                    }
                </style>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body>
                ${pagesHtml}
            </body>
            </html>
        `);
        doc.close();

        // Trigger print after iframe renders
        iframe.contentWindow.focus();
        setTimeout(() => {
            try {
                iframe.contentWindow.print();
            } catch (err) {
                console.error('Error al imprimir etiqueta:', err);
                toast.error('No se pudo abrir el cuadro de impresión');
            } finally {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 1000);
            }
        }, 400);
    };

    // Download PDF with exact millimeter page sizes matching live preview
    const handleDownloadPdf = async () => {
        if (!currentProduct) return;

        try {
            const doc = new jsPDF({
                unit: 'mm',
                format: [effectiveWidth, effectiveHeight],
                orientation: effectiveWidth >= effectiveHeight ? 'landscape' : 'portrait'
            });

            // If barcode is present, convert SVG to image via high-res canvas and capture natural aspect ratio
            let barcodeDataUrl = null;
            let imgAspect = 2.5;

            if (showBarcode && barcodeType !== 'NONE') {
                const svgEl = previewLabelRef.current?.querySelector('svg');
                if (svgEl) {
                    const svgString = new XMLSerializer().serializeToString(svgEl);
                    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                    const URL = window.URL || window.webkitURL || window;
                    const blobURL = URL.createObjectURL(svgBlob);
                    
                    const img = new Image();
                    await new Promise((resolve) => {
                        img.onload = () => {
                            const naturalW = img.naturalWidth || img.width || 300;
                            const naturalH = img.naturalHeight || img.height || 100;
                            imgAspect = naturalH > 0 ? (naturalW / naturalH) : 2.5;

                            const canvas = document.createElement('canvas');
                            const scale = 4; // High DPI for crystal clear barcode in PDF
                            canvas.width = naturalW * scale;
                            canvas.height = naturalH * scale;
                            const ctx = canvas.getContext('2d');
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            barcodeDataUrl = canvas.toDataURL('image/png', 1.0);
                            URL.revokeObjectURL(blobURL);
                            resolve();
                        };
                        img.onerror = () => {
                            URL.revokeObjectURL(blobURL);
                            resolve();
                        };
                        img.src = blobURL;
                    });
                }
            }

            const drawLabel = (isFirstPage) => {
                if (!isFirstPage) {
                    doc.addPage([effectiveWidth, effectiveHeight], effectiveWidth >= effectiveHeight ? 'landscape' : 'portrait');
                }

                const centerX = effectiveWidth / 2;
                const marginX = Math.max(1.5, effectiveWidth * 0.04);

                // Optional outer border
                if (showBorder) {
                    doc.setLineWidth(0.2);
                    doc.rect(0.5, 0.5, effectiveWidth - 1, effectiveHeight - 1);
                }

                // 1. Top Section: Header, Product Name, and Category/SKU
                let topY = 2.8;

                // Company Name
                if (showCompany && companyName) {
                    doc.setFont('helvetica', 'bold');
                    const compFontSize = effectiveWidth < 45 ? 6 : 7.5;
                    doc.setFontSize(compFontSize);
                    const compText = companyName.toUpperCase();
                    if (textAlignment === 'center') {
                        doc.text(compText, centerX, topY, { align: 'center' });
                    } else {
                        doc.text(compText, marginX, topY);
                    }
                    topY += (effectiveWidth < 45 ? 2.4 : 3.0);
                }

                // Product Name
                if (showProductName && currentProduct.nombre) {
                    doc.setFont('helvetica', productNameBold ? 'bold' : 'normal');
                    const pFontSize = productNameSize === 'lg' ? 9 : productNameSize === 'base' ? 8 : productNameSize === 'sm' ? 7 : 6;
                    doc.setFontSize(pFontSize);
                    const maxTextW = effectiveWidth - (marginX * 2);
                    const splitName = doc.splitTextToSize(currentProduct.nombre, maxTextW);
                    const lines = splitName.slice(0, 2);
                    if (textAlignment === 'center') {
                        doc.text(lines, centerX, topY, { align: 'center' });
                    } else {
                        doc.text(lines, marginX, topY);
                    }
                    topY += (lines.length * (pFontSize * 0.38) + 0.4);
                }

                // Internal Code, Category, and Unit Sub-badges
                const subInfos = [];
                if (showInternalCode && currentProduct.codigo) subInfos.push(`${internalCodePrefix}${currentProduct.codigo}`);
                if (showCategory && currentProduct.category_name) subInfos.push(currentProduct.category_name);
                if (showUnit && currentProduct.unidad_medida) subInfos.push(currentProduct.unidad_medida);

                if (subInfos.length > 0) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(5.5);
                    const subText = subInfos.join(' • ');
                    if (textAlignment === 'center') {
                        doc.text(subText, centerX, topY, { align: 'center' });
                    } else {
                        doc.text(subText, marginX, topY);
                    }
                    topY += 2.4;
                }

                // 2. Bottom Section: Anchored Footer Note & Price
                let bottomY = effectiveHeight - 1.5;

                // Custom Note / Footer Legend
                if (showCustomNote && customNoteText) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(5);
                    if (textAlignment === 'center') {
                        doc.text(customNoteText, centerX, bottomY, { align: 'center' });
                    } else {
                        doc.text(customNoteText, marginX, bottomY);
                    }
                    bottomY -= 2.2;
                }

                // Price (Anchored at the bottom above footer)
                if (showPrice) {
                    doc.setFont('helvetica', 'bold');
                    const pSize = priceSize === 'xlarge' ? 12 : priceSize === 'large' ? 10 : 8;
                    doc.setFontSize(pSize);
                    const pText = `${pricePrefix}${formattedPrice}`;
                    if (textAlignment === 'center') {
                        doc.text(pText, centerX, bottomY, { align: 'center' });
                    } else {
                        doc.text(pText, marginX, bottomY);
                    }
                    bottomY -= (pSize * 0.36 + 1.2);
                }

                // 3. Middle Section: Barcode or QR Code (Fills middle without distortion or overlap)
                if (barcodeDataUrl && showBarcode && barcodeType !== 'NONE') {
                    const availableH = Math.max(4, bottomY - topY - 1.0);
                    const availableW = Math.max(10, effectiveWidth - (marginX * 2));

                    if (barcodeType === 'QR') {
                        const qrSize = Math.min(availableH, availableW, effectiveHeight * 0.45);
                        const qrX = (effectiveWidth - qrSize) / 2;
                        const qrY = topY + 0.5 + (availableH - qrSize) / 2;
                        doc.addImage(barcodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
                    } else {
                        // 1D Barcode with preserved aspect ratio
                        const aspect = imgAspect > 0 ? imgAspect : 2.5;
                        let bcH = availableH;
                        let bcW = bcH * aspect;
                        if (bcW > availableW) {
                            bcW = availableW;
                            bcH = bcW / aspect;
                        }
                        const bcX = (effectiveWidth - bcW) / 2;
                        const bcY = topY + 0.5 + (availableH - bcH) / 2;
                        doc.addImage(barcodeDataUrl, 'PNG', bcX, bcY, bcW, bcH);
                    }
                }
            };

            const numCopies = Math.max(1, copies);
            for (let i = 0; i < numCopies; i++) {
                drawLabel(i === 0);
            }

            const cleanFileName = (currentProduct.nombre || 'etiqueta')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase();
            doc.save(`etiqueta_${cleanFileName}_${effectiveWidth}x${effectiveHeight}mm.pdf`);
            toast.success(`PDF generado con ${numCopies} etiqueta(s)`);
        } catch (err) {
            console.error('Error al generar PDF de etiqueta:', err);
            toast.error('Error al generar archivo PDF');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[95vh] max-h-[920px] flex flex-col overflow-hidden border border-slate-100">
                
                {/* Modal Header */}
                <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                            <Tag size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                                Impresión de Etiquetas de Producto
                                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-semibold px-2 py-0.5 rounded-full border border-indigo-400/20">
                                    Térmica / PDF
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-400 hidden sm:block">
                                Diseñe y personalice etiquetas adhesivas para góndola, código de barras y precios
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Mobile Tab Switcher */}
                        <div className="flex lg:hidden bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setMobileTab('settings')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                    mobileTab === 'settings'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Sliders size={12} />
                                Ajustes
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileTab('preview')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                    mobileTab === 'preview'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Eye size={12} />
                                Vista Previa
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-1.5 sm:p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-50/50 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                    
                    {/* LEFT COLUMN: Controls & Settings (7 cols) */}
                    <div className={`lg:col-span-7 overflow-y-auto p-4 sm:p-6 space-y-6 ${mobileTab !== 'settings' ? 'hidden lg:block' : 'block'}`}>
                        
                        {/* 1. Product Selection & Branch Price */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles size={14} className="text-indigo-600" />
                                    1. Producto y Precio
                                </h4>
                                {currentProduct && (
                                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                        {currentProduct.codigo}
                                    </span>
                                )}
                            </div>

                            {/* Product Select (if multiple products provided) */}
                            {products.length > 1 && (
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                        Seleccionar Producto
                                    </label>
                                    <select
                                        value={currentProduct?.id || ''}
                                        onChange={(e) => {
                                            const p = products.find(prod => String(prod.id) === e.target.value);
                                            if (p) {
                                                setCurrentProduct(p);
                                                if (onSelectProduct) onSelectProduct(p);
                                            }
                                        }}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    >
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.codigo} - {p.nombre} {p.category_name ? `(${p.category_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Branch price selector */}
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                        Precio de Sucursal
                                    </label>
                                    <select
                                        value={selectedBranchId}
                                        onChange={(e) => {
                                            const bId = e.target.value;
                                            setSelectedBranchId(bId);
                                            if (bId && currentProduct?.branchPrices?.[bId] != null) {
                                                setCustomPrice(Number(currentProduct.branchPrices[bId]).toFixed(2));
                                            }
                                        }}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="">Precio Base / General</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.nombre} {currentProduct?.branchPrices?.[b.id] != null ? `($${Number(currentProduct.branchPrices[b.id]).toFixed(2)})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Custom / active price input */}
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                        Monto a Imprimir ($)
                                    </label>
                                    <div className="relative">
                                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={customPrice}
                                            onChange={(e) => setCustomPrice(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Size & Orientation Selector */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Layers size={14} className="text-indigo-600" />
                                    2. Tamaño de Etiqueta
                                </h4>
                                <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                                    {effectiveWidth} × {effectiveHeight} mm
                                </span>
                            </div>

                            {/* Preset chips */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {PRESET_SIZES.map(preset => {
                                    const isSelected = sizePreset === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => handleSizePresetChange(preset.id)}
                                            className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                                                isSelected
                                                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                                                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="text-xs font-bold text-slate-900">{preset.name}</div>
                                            <div className="text-[9px] text-slate-500 truncate mt-0.5">{preset.desc}</div>
                                            {isSelected && (
                                                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Custom dimensions if custom selected */}
                            {sizePreset === 'custom' && (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200 animate-in fade-in">
                                    <div>
                                        <label className="text-[10px] font-bold text-amber-800 uppercase block mb-1">
                                            Ancho (mm)
                                        </label>
                                        <input
                                            type="number"
                                            min="15"
                                            max="200"
                                            value={widthMm}
                                            onChange={(e) => setWidthMm(Math.max(10, parseInt(e.target.value) || 10))}
                                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-amber-800 uppercase block mb-1">
                                            Alto (mm)
                                        </label>
                                        <input
                                            type="number"
                                            min="10"
                                            max="200"
                                            value={heightMm}
                                            onChange={(e) => setHeightMm(Math.max(10, parseInt(e.target.value) || 10))}
                                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Orientation Selector */}
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] font-bold text-slate-500 uppercase">Orientación</span>
                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('horizontal')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                            orientation === 'horizontal' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'
                                        }`}
                                    >
                                        Horizontal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOrientation('vertical')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                            orientation === 'vertical' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600'
                                        }`}
                                    >
                                        Vertical
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Product Options / Fields to Print */}
                        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Sliders size={14} className="text-indigo-600" />
                                    3. Opciones y Campos a Imprimir
                                </h4>
                                <span className="text-[10px] text-slate-400 font-medium">Personalización</span>
                            </div>

                            <div className="space-y-3 divide-y divide-slate-100">
                                
                                {/* Company Name Option */}
                                <div className="pt-2 flex flex-col gap-2">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showCompany}
                                            onChange={(e) => setShowCompany(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <Building2 size={13} className="text-slate-400" />
                                            Nombre de Empresa / Encabezado
                                        </span>
                                    </label>
                                    {showCompany && (
                                        <input
                                            type="text"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                            placeholder="Nombre de su negocio"
                                            className="ml-6 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    )}
                                </div>

                                {/* Product Name Option */}
                                <div className="pt-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showProductName}
                                                onChange={(e) => setShowProductName(e.target.checked)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                            />
                                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <Store size={13} className="text-slate-400" />
                                                Nombre del Producto
                                            </span>
                                        </label>
                                        {showProductName && (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={productNameSize}
                                                    onChange={(e) => setProductNameSize(e.target.value)}
                                                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700"
                                                >
                                                    <option value="xs">Texto Pequeño</option>
                                                    <option value="sm">Texto Normal</option>
                                                    <option value="base">Texto Grande</option>
                                                    <option value="lg">Texto Extra Grande</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => setProductNameBold(!productNameBold)}
                                                    className={`px-2 py-0.5 rounded text-[11px] font-black border transition-all ${
                                                        productNameBold ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'
                                                    }`}
                                                >
                                                    B
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Internal Code Option */}
                                <div className="pt-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showInternalCode}
                                                onChange={(e) => setShowInternalCode(e.target.checked)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                            />
                                            <span className="text-xs font-bold text-slate-800">
                                                Código Interno (SKU)
                                            </span>
                                        </label>
                                        {showInternalCode && (
                                            <input
                                                type="text"
                                                value={internalCodePrefix}
                                                onChange={(e) => setInternalCodePrefix(e.target.value)}
                                                placeholder="Prefijo (ej: COD: )"
                                                className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Barcode / QR Option */}
                                <div className="pt-3 flex flex-col gap-2.5">
                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showBarcode}
                                            onChange={(e) => setShowBarcode(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                            <BarcodeIcon size={14} className="text-slate-400" />
                                            Código de Barras / Código QR
                                        </span>
                                    </label>

                                    {showBarcode && (
                                        <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Formato</label>
                                                <select
                                                    value={barcodeType}
                                                    onChange={(e) => setBarcodeType(e.target.value)}
                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                                                >
                                                    <option value="CODE128">Código de Barras (Code 128 - Universal)</option>
                                                    <option value="EAN13">EAN-13 (13 dígitos)</option>
                                                    <option value="EAN8">EAN-8 (8 dígitos)</option>
                                                    <option value="UPC">UPC-A (12 dígitos)</option>
                                                    <option value="QR">Código QR</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Valor a Codificar</label>
                                                <input
                                                    type="text"
                                                    value={barcodeValue}
                                                    onChange={(e) => setBarcodeValue(e.target.value)}
                                                    placeholder="Código de barras..."
                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                                                />
                                            </div>

                                            {barcodeType !== 'QR' && (
                                                <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                                                    <input
                                                        type="checkbox"
                                                        id="showBcText"
                                                        checked={showBarcodeText}
                                                        onChange={(e) => setShowBarcodeText(e.target.checked)}
                                                        className="w-3.5 h-3.5 rounded text-indigo-600"
                                                    />
                                                    <label htmlFor="showBcText" className="text-[11px] font-medium text-slate-600 cursor-pointer">
                                                        Mostrar texto numérico debajo de las barras
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Price Option */}
                                <div className="pt-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showPrice}
                                                onChange={(e) => setShowPrice(e.target.checked)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                            />
                                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <DollarSign size={13} className="text-slate-400" />
                                                Precio de Venta
                                            </span>
                                        </label>

                                        {showPrice && (
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={pricePrefix}
                                                    onChange={(e) => setPricePrefix(e.target.value)}
                                                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700"
                                                >
                                                    <option value="$">$ (Solo símbolo)</option>
                                                    <option value="PVP: $">PVP: $</option>
                                                    <option value="PRECIO: $">PRECIO: $</option>
                                                    <option value="OFERTA: $">OFERTA: $</option>
                                                    <option value="">Sin símbolo</option>
                                                </select>
                                                <select
                                                    value={priceSize}
                                                    onChange={(e) => setPriceSize(e.target.value)}
                                                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-700"
                                                >
                                                    <option value="normal">Normal</option>
                                                    <option value="large">Grande</option>
                                                    <option value="xlarge">Destacado XL</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Category & Unit Option */}
                                <div className="pt-3 flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showCategory}
                                            onChange={(e) => setShowCategory(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="text-xs font-medium text-slate-700">Mostrar Categoría</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showUnit}
                                            onChange={(e) => setShowUnit(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="text-xs font-medium text-slate-700">Mostrar Unidad</span>
                                    </label>
                                </div>

                                {/* Custom Note / Footer Text */}
                                <div className="pt-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showCustomNote}
                                                onChange={(e) => setShowCustomNote(e.target.checked)}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                            />
                                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                                <FileText size={13} className="text-slate-400" />
                                                Leyenda / Texto Adicional
                                            </span>
                                        </label>
                                    </div>
                                    {showCustomNote && (
                                        <input
                                            type="text"
                                            value={customNoteText}
                                            onChange={(e) => setCustomNoteText(e.target.value)}
                                            placeholder="Ej: IVA Incluido / Hecho en El Salvador"
                                            className="ml-6 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                                        />
                                    )}
                                </div>

                                {/* Alignment & Border */}
                                <div className="pt-3 flex items-center justify-between">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showBorder}
                                            onChange={(e) => setShowBorder(e.target.checked)}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        />
                                        <span className="text-xs font-medium text-slate-700">Borde exterior de corte</span>
                                    </label>

                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setTextAlignment('center')}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                textAlignment === 'center' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
                                            }`}
                                        >
                                            Centrado
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTextAlignment('left')}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                textAlignment === 'left' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
                                            }`}
                                        >
                                            Izquierda
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Live Preview & Action Buttons (5 cols) */}
                    <div className={`lg:col-span-5 flex flex-col justify-between p-4 sm:p-6 bg-slate-100/70 overflow-y-auto ${mobileTab !== 'preview' ? 'hidden lg:flex' : 'flex'}`}>
                        
                        {/* Preview Top Bar */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Eye size={15} className="text-indigo-600" />
                                    Vista Previa en Vivo
                                </h4>

                                {/* Zoom Controls */}
                                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => setZoomLevel(prev => Math.max(60, prev - 20))}
                                        className="p-1 text-slate-500 hover:text-indigo-600"
                                        title="Reducir Zoom"
                                    >
                                        <ZoomOut size={13} />
                                    </button>
                                    <span className="text-[11px] font-mono font-bold text-slate-700 min-w-[38px] text-center">
                                        {zoomLevel}%
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setZoomLevel(prev => Math.min(250, prev + 20))}
                                        className="p-1 text-slate-500 hover:text-indigo-600"
                                        title="Aumentar Zoom"
                                    >
                                        <ZoomIn size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setZoomLevel(120)}
                                        className="p-1 text-slate-400 hover:text-slate-600"
                                        title="Restablecer"
                                    >
                                        <RotateCcw size={11} />
                                    </button>
                                </div>
                            </div>

                            {/* Canvas / Paper Simulation Box */}
                            <div className="flex items-center justify-center p-4 sm:p-6 bg-slate-900/5 rounded-3xl border-2 border-dashed border-slate-300 min-h-[300px] overflow-hidden">
                                
                                {/* Label Container (Proportional mm scaled) */}
                                <div
                                    ref={previewLabelRef}
                                    style={{
                                        width: `${effectiveWidth * 3.7795}px`,
                                        minHeight: `${effectiveHeight * 3.7795}px`,
                                        transform: `scale(${zoomLevel / 100})`,
                                        transformOrigin: 'center center',
                                    }}
                                    className={`bg-white text-slate-900 p-2.5 shadow-xl transition-transform flex flex-col justify-between overflow-hidden select-none ${
                                        showBorder ? 'border border-slate-900' : 'border border-slate-200'
                                    } ${textAlignment === 'center' ? 'text-center items-center' : 'text-left items-start'}`}
                                >
                                    
                                    {/* 1. Header: Company Name */}
                                    {showCompany && companyName && (
                                        <div className="w-full text-[10px] font-black uppercase tracking-tight text-slate-800 leading-tight truncate">
                                            {companyName}
                                        </div>
                                    )}

                                    {/* 2. Product Name */}
                                    {showProductName && currentProduct && (
                                        <div className={`w-full text-slate-950 leading-tight my-0.5 line-clamp-2 ${
                                            productNameBold ? 'font-black' : 'font-semibold'
                                        } ${
                                            productNameSize === 'lg' ? 'text-xs' : productNameSize === 'base' ? 'text-[11px]' : productNameSize === 'sm' ? 'text-[10px]' : 'text-[9px]'
                                        }`}>
                                            {currentProduct.nombre}
                                        </div>
                                    )}

                                    {/* 3. Internal Code, Category, Unit badges */}
                                    <div className={`w-full flex flex-wrap gap-1 text-[8px] font-mono text-slate-600 ${
                                        textAlignment === 'center' ? 'justify-center' : 'justify-start'
                                    }`}>
                                        {showInternalCode && currentProduct?.codigo && (
                                            <span className="font-bold">{internalCodePrefix}{currentProduct.codigo}</span>
                                        )}
                                        {showCategory && currentProduct?.category_name && (
                                            <span>• {currentProduct.category_name}</span>
                                        )}
                                        {showUnit && currentProduct?.unidad_medida && (
                                            <span>• {currentProduct.unidad_medida}</span>
                                        )}
                                    </div>

                                    {/* 4. Barcode / QR Section */}
                                    {showBarcode && barcodeType !== 'NONE' && (
                                        <div className="w-full flex flex-col items-center justify-center my-1 shrink-0 overflow-hidden">
                                            {barcodeType === 'QR' ? (
                                                <div className="p-0.5 bg-white">
                                                    <QRCodeSVG
                                                        value={barcodeValue || currentProduct?.codigo || '0000'}
                                                        size={Math.max(48, Math.min(90, effectiveHeight * 2))}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center w-full max-w-full overflow-hidden">
                                                    <BarcodeRenderer
                                                        value={barcodeValue || currentProduct?.codigo || ''}
                                                        format={barcodeType}
                                                        width={effectiveWidth < 40 ? 1.2 : 1.6}
                                                        height={Math.max(16, Math.min(36, effectiveHeight * 0.32))}
                                                        displayValue={showBarcodeText}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 5. Price Section */}
                                    {showPrice && (
                                        <div className={`w-full font-black text-slate-950 tracking-tight leading-tight ${
                                            priceSize === 'xlarge'
                                                ? 'text-base font-black text-indigo-950'
                                                : priceSize === 'large'
                                                ? 'text-sm font-black'
                                                : 'text-xs font-bold'
                                        }`}>
                                            <span>{pricePrefix}</span>
                                            <span>{formattedPrice}</span>
                                        </div>
                                    )}

                                    {/* 6. Custom Note / Footer */}
                                    {showCustomNote && customNoteText && (
                                        <div className="w-full text-[7.5px] font-semibold text-slate-500 uppercase tracking-tighter truncate mt-0.5">
                                            {customNoteText}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>

                        {/* Bottom Actions: Copies, Print & Download Buttons */}
                        <div className="space-y-3 pt-4 border-t border-slate-200 shrink-0">
                            
                            {/* Copies selector */}
                            <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Copy size={16} className="text-indigo-600" />
                                    <div>
                                        <span className="text-xs font-bold text-slate-800 block">Número de Copias</span>
                                        <span className="text-[10px] text-slate-400">Cantidad de etiquetas a imprimir</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm active:scale-95 transition-all"
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        value={copies}
                                        onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-14 text-center py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setCopies(prev => Math.min(500, prev + 1))}
                                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm active:scale-95 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Quick copy chips */}
                            <div className="flex items-center gap-1.5 justify-end text-[10px] font-bold text-slate-500">
                                <span>Rápido:</span>
                                {[1, 5, 10, 20, 50].map(cnt => (
                                    <button
                                        key={cnt}
                                        type="button"
                                        onClick={() => setCopies(cnt)}
                                        className={`px-2 py-0.5 rounded-lg border transition-all ${
                                            copies === cnt
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        {cnt}
                                    </button>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={handleDownloadPdf}
                                    className="py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-98"
                                >
                                    <Download size={16} className="text-slate-600" />
                                    Descargar PDF
                                </button>

                                <button
                                    type="button"
                                    onClick={handlePrintDirect}
                                    className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-98"
                                >
                                    <Printer size={16} />
                                    Imprimir Etiquetas ({copies})
                                </button>
                            </div>

                        </div>

                    </div>

                </div>

            </div>
        </div>
    );
};

export default ProductLabelModal;
