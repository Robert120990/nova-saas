import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Boxes,
    Truck,
    PackageCheck,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Printer,
    FileDown,
    RefreshCw,
    Droplets,
    Sparkles,
    ShieldAlert,
    FlaskConical,
    Clock,
    Plus,
    Trash2,
    Building2,
    TrendingUp,
    BarChart3,
    ShoppingCart,
    Lightbulb,
    Zap,
    History
} from 'lucide-react';

const RawMaterialPlannerModal = ({ isOpen, onClose, initialDate = new Date() }) => {
    const [year, setYear] = useState(initialDate.getFullYear());
    const [month, setMonth] = useState(initialDate.getMonth() + 1);
    const [activeTab, setActiveTab] = useState('egg');
    const [loading, setLoading] = useState(true);
    const [plannerData, setPlannerData] = useState(null);

    // Estado para distribución multi-proveedor con contenedores de diferente capacidad (ej. 900 vs 600)
    const [providerAllocations, setProviderAllocations] = useState([
        { id: 1, provider_id: '', provider_name: 'Avícola La Granja', container_capacity: 900, shipments_count: 1 },
        { id: 2, provider_id: '', provider_name: 'Agropecuaria Central', container_capacity: 600, shipments_count: 1 }
    ]);

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const fetchPlannerData = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/egg-industrial/raw-materials/planner', {
                params: { year, month }
            });
            setPlannerData(res.data);
        } catch (error) {
            console.error('Error al cargar planificador de materia prima:', error);
            toast.error('Error al cargar planificador de materia prima.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchPlannerData();
        }
    }, [isOpen, year, month]);

    // Sincronizar catálogo de proveedores en la distribución
    useEffect(() => {
        if (plannerData?.providers_catalog && plannerData.providers_catalog.length > 0) {
            setProviderAllocations(prev => {
                if (prev.length === 2 && !prev[0].provider_id) {
                    const p1 = plannerData.providers_catalog[0];
                    const p2 = plannerData.providers_catalog[1] || plannerData.providers_catalog[0];
                    return [
                        { id: 1, provider_id: String(p1.id), provider_name: p1.nombre, container_capacity: 900, shipments_count: 1 },
                        { id: 2, provider_id: String(p2.id), provider_name: p2.nombre, container_capacity: 600, shipments_count: 1 }
                    ];
                }
                return prev;
            });
        }
    }, [plannerData]);

    const addProviderAllocation = () => {
        const pCatalog = plannerData?.providers_catalog || [];
        const nextProv = pCatalog[providerAllocations.length % pCatalog.length] || {};
        setProviderAllocations([
            ...providerAllocations,
            {
                id: Date.now(),
                provider_id: String(nextProv.id || ''),
                provider_name: nextProv.nombre || 'Nuevo Proveedor',
                container_capacity: 600,
                shipments_count: 1
            }
        ]);
    };

    const removeProviderAllocation = (id) => {
        if (providerAllocations.length <= 1) {
            toast.warning('Debe haber al menos un proveedor configurado.');
            return;
        }
        setProviderAllocations(providerAllocations.filter(p => p.id !== id));
    };

    const updateProviderAllocation = (id, field, value) => {
        setProviderAllocations(providerAllocations.map(p => {
            if (p.id !== id) return p;
            if (field === 'provider_id') {
                const provObj = (plannerData?.providers_catalog || []).find(cp => String(cp.id) === String(value));
                return {
                    ...p,
                    provider_id: value,
                    provider_name: provObj?.nombre || p.provider_name
                };
            }
            return { ...p, [field]: value };
        }));
    };

    const applySuggestedOrder = (type) => {
        const salesDemand = plannerData?.sales_demand_suggestion || {};
        const eggBal = plannerData?.raw_egg_balance || {};
        const histComp = plannerData?.historical_comparison || {};

        let targetBoxes = 0;
        let label = '';
        if (type === 'sales') {
            targetBoxes = salesDemand.suggested_boxes_to_order || salesDemand.suggested_boxes_from_sales || 0;
            label = 'según promedio de ventas comerciales';
        } else if (type === 'schedule') {
            targetBoxes = salesDemand.suggested_boxes_from_schedule || eggBal.boxes_to_purchase || 0;
            label = 'según plan de producción agendado';
        } else if (type === 'history') {
            targetBoxes = salesDemand.suggested_boxes_from_history || Math.max(0, (histComp.average_monthly_boxes || 0) - (eggBal.current_stock_boxes || 0));
            label = 'según histórico multianual';
        }

        if (targetBoxes <= 0) {
            toast.info(`No se requiere compra adicional ${label}. El stock actual en bodega (${(eggBal.current_stock_boxes || 0).toLocaleString()} cajas) cubre la necesidad estimada.`);
            return;
        }

        if (!providerAllocations || providerAllocations.length === 0) {
            toast.warning('Debe haber al menos un proveedor configurado en la lista.');
            return;
        }

        const updated = providerAllocations.map(p => ({ ...p, shipments_count: 0 }));
        let allocated = 0;
        let iter = 0;
        const maxIter = 100;

        while (allocated < targetBoxes && iter < maxIter) {
            const currentProv = updated[iter % updated.length];
            const cap = parseInt(currentProv.container_capacity, 10) || 600;
            currentProv.shipments_count += 1;
            allocated += cap;
            iter++;
        }

        setProviderAllocations(updated);
        const totalShipments = updated.reduce((sum, p) => sum + (parseInt(p.shipments_count, 10) || 0), 0);
        toast.success(`Sugerencia aplicada: ${allocated.toLocaleString()} cajas distribuidas en ${totalShipments} contenedor(es) ${label}.`);
    };

    const buildMrpPdfDoc = () => {
        if (!plannerData) {
            toast.error('No hay datos de planificación disponibles para exportar.');
            return null;
        }

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'letter'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const eggBal = plannerData?.raw_egg_balance || {};
        const ingBal = plannerData?.ingredients_balance || {};
        const packBal = plannerData?.packaging_balance || {};
        const isDeficit = (eggBal.net_balance_boxes || 0) < 0;
        const currentPeriod = `${monthNames[month - 1]} ${year}`;
        const emissionDate = new Date().toLocaleDateString('es-SV', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const mainProvider = plannerData?.trucks_schedule?.[0]?.suggested_provider || 'AVICOLA SALVADOREÑA, S.A. DE C.V.';

        // 1. Header Corporativo Superior
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, pageWidth, 26, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('ANDELSA, S.A. DE C.V.', 14, 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(203, 213, 225); // slate-300
        doc.text('PLANTA INDUSTRIAL DE PASTEURIZACIÓN Y QUEBRADO DE HUEVO LÍQUIDO', 14, 16);
        doc.text('SISTEMA DE PLANIFICACIÓN DE REQUERIMIENTOS DE MATERIALES (MRP)', 14, 21);

        // Etiqueta a la derecha
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(56, 189, 248); // sky-400
        doc.text('PROGRAMA DE ABASTECIMIENTO', pageWidth - 14, 12, { align: 'right' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.text(`PERIODO: ${currentPeriod.toUpperCase()}`, pageWidth - 14, 18, { align: 'right' });

        // 2. Título de Documento y Metadatos de Emisión
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('ORDEN CONSOLIDADA Y CRONOGRAMA DE ENTREGA DE MATERIA PRIMA', 14, 34);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Documento Oficial de Programación | Fecha de Emisión: ${emissionDate} | Planta ANDELSA El Salvador`, 14, 39);

        // 3. Tabla de Metadatos y Balance General
        autoTable(doc, {
            startY: 43,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 2 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 55 },
                1: { fontStyle: 'bold', cellWidth: 50 },
                2: { cellWidth: 83 }
            },
            head: [['Parámetro de Planificación', 'Valor Calculado', 'Detalle Logístico / Justificación']],
            body: [
                ['Proveedor Principal:', mainProvider, 'Proveedor preferente para suministro de huevo cáscara'],
                ['Periodo de Cobertura:', currentPeriod, `${plannerData?.scheduled_productions_count || 0} corridas programadas / ${plannerData?.customer_orders_count || 0} pedidos CRM`],
                ['Requerimiento Total Bruto:', `${(eggBal.total_boxes_needed || 0).toLocaleString()} cajas (~${(eggBal.total_liquid_lbs_needed || 0).toLocaleString()} Lbs)`, 'Demanda calculada para cubrir el programa de pasteurización'],
                ['Stock Aprobado en Cuarto Frío:', `${(eggBal.current_stock_boxes || 0).toLocaleString()} cajas (${(eggBal.current_stock_lbs || 0).toLocaleString()} Lbs)`, 'Inventario disponible bajo cadena de frío 2°C - 6°C'],
                ['Balance Neto Mensual:', `${isDeficit ? '-' : '+'}${Math.abs(eggBal.net_balance_boxes || 0).toLocaleString()} cajas`, isDeficit ? 'Déficit mensual: Requiere compra y despacho de camiones' : 'Superávit en inventario'],
                ['Promedio Histórico Periodo:', `${(plannerData?.historical_comparison?.average_monthly_boxes || 0).toLocaleString()} cajas (~${(plannerData?.historical_comparison?.average_monthly_lbs || 0).toLocaleString()} Lbs)`, 'Referencia multianual de consumo en este rango de fecha'],
                ['VOLUMEN TOTAL A COMPRAR:', `${(eggBal.boxes_to_purchase || 0).toLocaleString()} CAJAS (~${(eggBal.estimated_purchase_cost_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, 'Distribuido en despachos semanales para rotación óptima']
            ]
        });

        // 3.1 Tabla de Distribución por Contenedores Multi-Proveedor
        const provAllocRows = providerAllocations.map(p => {
            const boxes = (parseInt(p.container_capacity) || 0) * (parseInt(p.shipments_count) || 0);
            const lbs = Math.round(boxes * 36.1);
            return [
                p.provider_name,
                `${p.container_capacity} cajas / contenedor`,
                `${p.shipments_count} contenedor(es)`,
                `${boxes.toLocaleString()} cajas`,
                `~${lbs.toLocaleString()} Lbs`,
                `$${(boxes * 38.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ];
        });

        const totalAllocatedPdfBoxes = providerAllocations.reduce((s, p) => s + (parseInt(p.container_capacity) || 0) * (parseInt(p.shipments_count) || 0), 0);

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 5,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2 },
            head: [['Proveedor Asignado', 'Capacidad Contenedor', 'N° Contenedores', 'Total Cajas', 'Volumen Estimado', 'Costo Est. USD']],
            body: provAllocRows,
            foot: [[
                'TOTAL PROGRAMADO MULTI-PROVEEDOR',
                '-',
                `${providerAllocations.reduce((s, p) => s + (parseInt(p.shipments_count) || 0), 0)} contenedores`,
                `${totalAllocatedPdfBoxes.toLocaleString()} cajas`,
                `~${Math.round(totalAllocatedPdfBoxes * 36.1).toLocaleString()} Lbs`,
                `$${(totalAllocatedPdfBoxes * 38.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]],
            footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 }
        });

        // 4. Tabla de Cronograma Semanal de Camiones Refrigerados
        const truckRows = (plannerData?.trucks_schedule || []).map(t => [
            t.week_label || 'Semana',
            t.suggested_delivery_date || 'A coordinar',
            `${t.boxes_count || 0} cajas`,
            `~${(t.weight_lbs || 0).toLocaleString()} Lbs`,
            t.suggested_provider || mainProvider,
            '4.0°C a 8.0°C',
            'Muestreo LAB-004'
        ]);

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 5,
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 2 },
            head: [['Entrega', 'Fecha Arribo', 'Carga Solicitada', 'Peso Est.', 'Proveedor', 'Temp. Furgón', 'Control Recepción']],
            body: truckRows
        });

        // 5. Tabla de Consolidado de Insumos y Empaques
        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 5,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59], cellPadding: 2 },
            head: [['Material / Insumo Requerido', 'Cantidad Mensual', 'Presentación Sugerida', 'Aplicación en Planta']],
            body: [
                ['Huevo Cáscara Grado A', `${(eggBal.boxes_to_purchase || 0).toLocaleString()} cajas`, 'Cajas de 360 uds (12 cartones)', 'Materia prima base de quebrado y pasteurización'],
                ['Agua Desmineralizada Purificada', `${ingBal.purified_water?.bottles_5gal || 0} garrafas (~${(ingBal.purified_water?.lbs || 0).toLocaleString()} Lbs)`, 'Garrafas 5 galones grado alimentario', 'Estandarización de sólidos totales según ficha técnica'],
                ['Ácido Cítrico Grado Alimentario', `${ingBal.citric_acid?.lbs || 0} Lbs (${ingBal.citric_acid?.kg || 0} Kg)`, 'Sacos de 25 Kg anhidro USP', 'Regulador de pH y conservante inocuo de lote'],
                ['Cubetas Plásticas 30 Lbs', `${(packBal.buckets_30lb || 0).toLocaleString()} unidades`, 'Pallets de 250 cubetas vírgenes', 'Envasado primario estandarizado para clientes'],
                ['Tapaderas Herméticas con Anillo', `${(packBal.lids || 0).toLocaleString()} unidades`, 'Cajas de tapaderas precintadas', 'Cierre hermético con sello de seguridad inviolable'],
                ['Bolsas / Liners Grado Alimento', `${(packBal.food_grade_liners || 0).toLocaleString()} unidades`, 'Fardos sellados (+2% merma)', 'Recubrimiento interno sanitario de cubeta']
            ]
        });

        // 6. Directrices Técnicas de Calidad e Inocuidad para el Proveedor
        let specY = doc.lastAutoTable.finalY + 5;
        if (specY > pageHeight - 55) {
            doc.addPage();
            specY = 16;
        }

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, specY, pageWidth - 28, 28, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text('ESPECIFICACIONES TÉCNICAS Y POLÍTICA DE RECEPCIÓN EN PLANTA:', 17, specY + 4.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(71, 85, 105);
        doc.text('1. Cadena de Frío: El transporte debe realizarse en furgón refrigerado a temperatura controlada de 4.0°C a 8.0°C con termógrafo legible.', 17, specY + 9);
        doc.text('2. Frescura de Postura: El huevo cáscara debe contar con un máximo de 5 días post-postura para garantizar viscosidad y rendimiento de quebrado.', 17, specY + 13.5);
        doc.text('3. Higiene y Embalaje: Las cajas y cartones deben ser de primer uso o tarimas plásticas desinfectadas, libres de humedad y suciedad externa.', 17, specY + 18);
        doc.text('4. Muestreo HACCP LAB-004: La descarga está sujeta a verificación de temperatura, lote, ausencia de olor extraño y prueba de cámara fría.', 17, specY + 22.5);

        // 7. Bloque de Firmas
        let signY = specY + 40;
        if (signY > pageHeight - 20) {
            doc.addPage();
            signY = 30;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);

        const colWidth = (pageWidth - 28) / 3;
        const x1 = 14 + colWidth * 0.1;
        const x2 = 14 + colWidth + colWidth * 0.1;
        const x3 = 14 + colWidth * 2 + colWidth * 0.1;
        const lineW = colWidth * 0.8;

        doc.line(x1, signY, x1 + lineW, signY);
        doc.text('Planificación y Producción', x1 + lineW / 2, signY + 3.5, { align: 'center' });
        doc.text('ANDELSA Planta Industrial', x1 + lineW / 2, signY + 7, { align: 'center' });

        doc.line(x2, signY, x2 + lineW, signY);
        doc.text('Gerencia de Operaciones / Planta', x2 + lineW / 2, signY + 3.5, { align: 'center' });
        doc.text('Aprobación de Abastecimiento', x2 + lineW / 2, signY + 7, { align: 'center' });

        doc.line(x3, signY, x3 + lineW, signY);
        doc.text('Recibido y Aceptado', x3 + lineW / 2, signY + 3.5, { align: 'center' });
        doc.text(mainProvider.slice(0, 26), x3 + lineW / 2, signY + 7, { align: 'center' });

        // Pie de página con numeración
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(
                `Planta Pasteurizadora ANDELSA — Documento Oficial MRP — Página ${i} de ${totalPages}`,
                pageWidth / 2,
                pageHeight - 6,
                { align: 'center' }
            );
        }

        return doc;
    };

    const handleDownloadPdf = () => {
        try {
            const doc = buildMrpPdfDoc();
            if (!doc) return;
            const filename = `Orden_Abastecimiento_MRP_${monthNames[month - 1]}_${year}.pdf`;
            doc.save(filename);
            toast.success(`Orden de abastecimiento MRP descargada: ${filename}`);
        } catch (err) {
            console.error('Error generando PDF de MRP:', err);
            toast.error('Error al generar el PDF de abastecimiento.');
        }
    };

    const handlePrintPdf = () => {
        try {
            const doc = buildMrpPdfDoc();
            if (!doc) return;
            doc.autoPrint();
            const blobUrl = doc.output('bloburl');
            window.open(blobUrl, '_blank');
        } catch (err) {
            console.error('Error imprimiendo PDF de MRP:', err);
            toast.error('Error al preparar impresión del PDF.');
        }
    };

    if (!isOpen) return null;

    const eggBal = plannerData?.raw_egg_balance || {};
    const ingBal = plannerData?.ingredients_balance || {};
    const packBal = plannerData?.packaging_balance || {};
    const isDeficit = (eggBal.net_balance_boxes || 0) < 0;

    const histComp = plannerData?.historical_comparison || {};
    const salesDemand = plannerData?.sales_demand_suggestion || {};
    const totalAllocatedBoxes = providerAllocations.reduce((acc, p) => acc + (parseInt(p.container_capacity) || 0) * (parseInt(p.shipments_count) || 0), 0);
    const targetDemandBoxes = eggBal.boxes_to_purchase > 0 ? eggBal.boxes_to_purchase : (eggBal.total_boxes_needed || 0);
    const coveragePercent = targetDemandBoxes > 0 ? Math.min(200, Math.round((totalAllocatedBoxes / targetDemandBoxes) * 100)) : 100;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Planificador de Materia Prima e Insumos (MRP) - Planta ANDELSA"
            maxWidth="max-w-5xl"
        >
            <div className="space-y-4 sm:space-y-5">
                {/* BARRA SUPERIOR DE SELECTOR DE MES Y ACCIONES */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                            <span>Periodo Planificado:</span>
                        </div>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                            className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            {monthNames.map((name, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value, 10))}
                            className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            {[year - 1, year, year + 1].map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={fetchPlannerData}
                            disabled={loading}
                            className="p-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors shadow-sm disabled:opacity-50"
                            title="Recalcular Planificador"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                            title="Descargar Orden Formal de Abastecimiento en PDF para proveedores"
                        >
                            <FileDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Descargar PDF Formal</span>
                            <span className="sm:hidden">PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={handlePrintPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                            title="Imprimir documento oficial en PDF limpio"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir</span>
                        </button>
                    </div>
                </div>

                {/* INDICADORES DE ORIGEN DE DEMANDA (CRM / CALENDARIO) */}
                {plannerData && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold px-1">
                        {plannerData.scheduled_productions_count > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                                <CheckCircle2 size={12} className="text-indigo-600" />
                                {plannerData.scheduled_productions_count} producciones programadas en el mes
                            </span>
                        )}
                        {plannerData.customer_orders_count > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                <Sparkles size={12} className="text-emerald-600" />
                                {plannerData.customer_orders_count} pedidos de clientes (CRM) enlazados
                            </span>
                        )}
                        {plannerData.is_simulation && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                                <AlertTriangle size={12} className="text-amber-600" />
                                Proyección estándar de planta (sin corridas programadas para este mes)
                            </span>
                        )}
                    </div>
                )}

                {/* TARJETAS EJECUTIVAS KPI */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                            Requerimiento Mensual
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-lg sm:text-xl font-black text-slate-900">
                                {eggBal.total_boxes_needed?.toLocaleString() || 0}
                            </span>
                            <span className="text-[11px] text-slate-500 font-semibold">cajas</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            ~{(eggBal.total_liquid_lbs_needed || 0).toLocaleString()} Lbs útiles
                        </span>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                            Stock Aprobado Bodega
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-lg sm:text-xl font-black text-indigo-600">
                                {eggBal.current_stock_boxes?.toLocaleString() || 0}
                            </span>
                            <span className="text-[11px] text-slate-500 font-semibold">cajas</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            {(eggBal.current_stock_lbs || 0).toLocaleString()} Lbs en cámara fría
                        </span>
                    </div>

                    <div className={`border rounded-xl p-3 shadow-sm ${isDeficit ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'
                        }`}>
                        <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDeficit ? 'text-amber-800' : 'text-emerald-800'
                                }`}>
                                Balance Neto MP
                            </span>
                            {isDeficit ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                        </div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className={`text-lg sm:text-xl font-black ${isDeficit ? 'text-amber-700' : 'text-emerald-700'
                                }`}>
                                {isDeficit ? '' : '+'}{eggBal.net_balance_boxes?.toLocaleString() || 0}
                            </span>
                            <span className={`text-[11px] font-semibold ${isDeficit ? 'text-amber-700' : 'text-emerald-700'
                                }`}>
                                cajas
                            </span>
                        </div>
                        <span className={`text-[10px] font-semibold block mt-0.5 ${isDeficit ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                            {isDeficit ? 'Déficit para cubrir el mes' : 'Stock suficiente para el mes'}
                        </span>
                    </div>

                    <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">
                            Cajas a Comprar
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-lg sm:text-xl font-black text-rose-600">
                                {eggBal.boxes_to_purchase?.toLocaleString() || 0}
                            </span>
                            <span className="text-[11px] text-slate-500 font-semibold">cajas</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                            Est: <Money value={eggBal.estimated_purchase_cost_usd || 0} />
                        </span>
                    </div>
                </div>

                {/* TABS DE NAVEGACIÓN */}
                <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-0.5">
                    <button
                        type="button"
                        onClick={() => setActiveTab('egg')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'egg'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        <Boxes className="w-4 h-4" />
                        <span>Huevo Cáscara & Camiones</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('ingredients')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'ingredients'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        <Droplets className="w-4 h-4" />
                        <span>Insumos & Aditivos (H2O / Ácido)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('packaging')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'packaging'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        <PackageCheck className="w-4 h-4" />
                        <span>Cubetas & Empaques</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'orders'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                    >
                        <Printer className="w-4 h-4" />
                        <span>Orden Consolidada de Abastecimiento</span>
                    </button>
                </div>

                {/* CONTENIDO DE TABS */}
                {loading ? (
                    <div className="py-12 text-center text-slate-400 font-medium text-xs">
                        Calculando requerimientos y balances de materia prima...
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* TAB 1: HUEVO CÁSCARA Y CRONOGRAMA DE CAMIONES */}
                        {activeTab === 'egg' && (
                            <div className="space-y-4">
                                {/* SECCIÓN 1: COMPARATIVA HISTÓRICA & PROMEDIO MULTIANUAL */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                                                <BarChart3 size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                                    Comparativa Histórica y Promedio Multianual
                                                </h3>
                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    Datos de consumo en el mismo rango de fecha ({monthNames[month - 1]}) de años anteriores y meses recientes
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                                            <TrendingUp size={14} className="text-emerald-600" />
                                            <span className="text-[11px] text-slate-600 font-medium">Promedio Mensual Calculado:</span>
                                            <strong className="text-xs font-black text-indigo-700">
                                                {histComp.average_monthly_boxes?.toLocaleString() || 0} cajas
                                            </strong>
                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                (~{histComp.average_monthly_lbs?.toLocaleString() || 0} Lbs)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Muestreo de años anteriores y meses previos */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* Años Anteriores (Mismo Mes) */}
                                        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-2">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                                Mismo Mes ({monthNames[month - 1]}) en Años Anteriores
                                            </span>
                                            {Array.isArray(histComp.same_month_prior_years) && histComp.same_month_prior_years.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {histComp.same_month_prior_years.map((h, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                                                            <span className="font-bold text-slate-800">{monthNames[h.month - 1]} {h.year}</span>
                                                            <span className="font-black text-indigo-700">{parseFloat(h.total_boxes || 0).toLocaleString()} cajas</span>
                                                            <span className="text-slate-500 font-medium text-[11px]">~{parseFloat(h.total_weight_lbs || 0).toLocaleString()} Lbs</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-slate-400 italic py-1">
                                                    No hay recepciones registradas en {monthNames[month - 1]} de años previos.
                                                </p>
                                            )}
                                        </div>

                                        {/* Meses Recientes */}
                                        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-2">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                                                Consumo en Meses Anteriores Recientes
                                            </span>
                                            {Array.isArray(histComp.recent_prior_months) && histComp.recent_prior_months.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {histComp.recent_prior_months.map((h, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                                                            <span className="font-bold text-slate-800">{monthNames[h.month - 1]} {h.year}</span>
                                                            <span className="font-black text-indigo-700">{parseFloat(h.total_boxes || 0).toLocaleString()} cajas</span>
                                                            <span className="text-slate-500 font-medium text-[11px]">~{parseFloat(h.total_weight_lbs || 0).toLocaleString()} Lbs</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-slate-400 italic py-1">
                                                    No hay historial previo registrado para comparar.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* SECCIÓN 2: SUGERENCIA INTELIGENTE DE PEDIDO SEGÚN VENTAS, PLANIFICACIÓN E HISTÓRICO */}
                                <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-indigo-500/20 space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                                                <Sparkles size={20} className="animate-pulse text-amber-300" />
                                            </div>
                                            <div>
                                                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-white">
                                                    Sugerencia Inteligente de Pedido de Materia Prima
                                                </h3>
                                                <p className="text-[11px] text-slate-300 font-medium">
                                                    Calcula y distribuye automáticamente los contenedores entre tus proveedores según la fuente que elijas
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-xl text-[11px] font-semibold text-indigo-200 border border-white/10 self-start sm:self-auto">
                                            <Lightbulb size={13} className="text-amber-300 shrink-0" />
                                            <span>Aplica automáticamente a los contenedores:</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {/* Opción A: Según Ventas Comerciales (Últimos 6 Meses) */}
                                        <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                                        <ShoppingCart size={13} /> Según Ventas Reales
                                                    </span>
                                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-400/30">
                                                        Demanda Comercial
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-xl font-black text-white">
                                                        {(salesDemand.suggested_boxes_to_order || salesDemand.suggested_boxes_from_sales || 0).toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-slate-300 font-semibold">cajas sugeridas</span>
                                                </div>
                                                <div className="text-[11px] text-slate-300 space-y-0.5">
                                                    <p>• Promedio mensual: <strong className="text-white">{(salesDemand.monthly_sales_avg_boxes || 0).toLocaleString()} cjs</strong> (~{(salesDemand.monthly_sales_avg_lbs || 0).toLocaleString()} Lbs)</p>
                                                    <p>• Stock actual bodega: <strong className="text-emerald-300">{(eggBal.current_stock_boxes || 0).toLocaleString()} cjs</strong></p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => applySuggestedOrder('sales')}
                                                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                                                title="Distribuir automáticamente las cajas calculadas por promedio de ventas en los contenedores de los proveedores"
                                            >
                                                <Zap size={14} />
                                                <span>Sugerir según Ventas</span>
                                            </button>
                                        </div>

                                        {/* Opción B: Según Plan de Producción del Mes */}
                                        <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                                                        <Boxes size={13} /> Según Plan de Lotes
                                                    </span>
                                                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold border border-indigo-400/30">
                                                        {plannerData?.scheduled_productions_count || 0} Lotes
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-xl font-black text-white">
                                                        {(salesDemand.suggested_boxes_from_schedule || eggBal.boxes_to_purchase || 0).toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-slate-300 font-semibold">cajas sugeridas</span>
                                                </div>
                                                <div className="text-[11px] text-slate-300 space-y-0.5">
                                                    <p>• Demanda programada: <strong className="text-white">{(eggBal.total_boxes_needed || 0).toLocaleString()} cjs</strong></p>
                                                    <p>• Balance con stock: <strong className={isDeficit ? 'text-amber-300' : 'text-emerald-300'}>{(eggBal.net_balance_boxes || 0).toLocaleString()} cjs</strong></p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => applySuggestedOrder('schedule')}
                                                className="w-full py-2 px-3 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                                                title="Distribuir automáticamente las cajas requeridas para cubrir las producciones programadas en los contenedores"
                                            >
                                                <Zap size={14} />
                                                <span>Sugerir según Plan</span>
                                            </button>
                                        </div>

                                        {/* Opción C: Según Historial Multianual */}
                                        <div className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                                        <History size={13} /> Según Histórico {monthNames[month - 1]}
                                                    </span>
                                                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-400/30">
                                                        Años Previos
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-xl font-black text-white">
                                                        {(salesDemand.suggested_boxes_from_history || Math.max(0, (histComp.average_monthly_boxes || 0) - (eggBal.current_stock_boxes || 0))).toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-slate-300 font-semibold">cajas sugeridas</span>
                                                </div>
                                                <div className="text-[11px] text-slate-300 space-y-0.5">
                                                    <p>• Promedio histórico: <strong className="text-white">{(histComp.average_monthly_boxes || 0).toLocaleString()} cjs</strong></p>
                                                    <p>• Descontando stock: <strong className="text-slate-300">{(eggBal.current_stock_boxes || 0).toLocaleString()} cjs en bodega</strong></p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => applySuggestedOrder('history')}
                                                className="w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                                                title="Distribuir automáticamente las cajas según el consumo multianual histórico de este mes"
                                            >
                                                <Zap size={14} />
                                                <span>Sugerir según Histórico</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* SECCIÓN 3: ASIGNACIÓN DE CONTENEDORES POR PROVEEDOR (CAPACIDADES VARIABLES: 900 vs 600) */}
                                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-sky-50 text-sky-700 rounded-xl">
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                                    Planificación de Contenedores y Selección Multi-Proveedor
                                                </h3>
                                                <p className="text-[11px] text-slate-500 font-medium">
                                                    Selecciona más de un proveedor y configura la capacidad de cada contenedor (ej. 900 cajas vs 600 cajas)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                                            <div className="hidden lg:flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl text-[10px] font-bold text-slate-600">
                                                <span>Sugerir:</span>
                                                <button
                                                    type="button"
                                                    onClick={() => applySuggestedOrder('sales')}
                                                    className="px-2 py-0.5 bg-white hover:bg-amber-50 hover:text-amber-800 rounded-lg border border-slate-200 transition-colors"
                                                    title="Sugerir según Promedio de Ventas"
                                                >
                                                    🛒 Ventas ({(salesDemand.suggested_boxes_to_order || salesDemand.suggested_boxes_from_sales || 0).toLocaleString()} cjs)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => applySuggestedOrder('schedule')}
                                                    className="px-2 py-0.5 bg-white hover:bg-indigo-50 hover:text-indigo-800 rounded-lg border border-slate-200 transition-colors"
                                                    title="Sugerir según Plan de Lotes"
                                                >
                                                    📦 Plan ({(salesDemand.suggested_boxes_from_schedule || eggBal.boxes_to_purchase || 0).toLocaleString()} cjs)
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={addProviderAllocation}
                                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 transition-colors flex items-center gap-1.5 shadow-2xs"
                                            >
                                                <Plus size={14} />
                                                <span>Agregar Proveedor</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista de Proveedores Asignados */}
                                    <div className="space-y-2.5">
                                        {providerAllocations.map((alloc, aIdx) => {
                                            const subtotalBoxes = (parseInt(alloc.container_capacity) || 0) * (parseInt(alloc.shipments_count) || 0);
                                            const subtotalLbs = Math.round(subtotalBoxes * 36.1);

                                            return (
                                                <div key={alloc.id || aIdx} className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                                                    {/* Selector de Proveedor */}
                                                    <div className="flex-1 space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                                            Proveedor #{aIdx + 1}
                                                        </label>
                                                        <select
                                                            value={alloc.provider_id}
                                                            onChange={(e) => updateProviderAllocation(alloc.id, 'provider_id', e.target.value)}
                                                            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar del catálogo...</option>
                                                            {(plannerData?.providers_catalog || []).map((prov) => (
                                                                <option key={prov.id} value={prov.id}>
                                                                    {prov.nombre}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Capacidad del Contenedor con Presets */}
                                                    <div className="w-full md:w-56 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                                                Capacidad Contenedor
                                                            </label>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateProviderAllocation(alloc.id, 'container_capacity', 900)}
                                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${parseInt(alloc.container_capacity) === 900
                                                                            ? 'bg-indigo-600 text-white'
                                                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                >
                                                                    900 cjs
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateProviderAllocation(alloc.id, 'container_capacity', 600)}
                                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${parseInt(alloc.container_capacity) === 600
                                                                            ? 'bg-indigo-600 text-white'
                                                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                                        }`}
                                                                >
                                                                    600 cjs
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={alloc.container_capacity}
                                                                onChange={(e) => updateProviderAllocation(alloc.id, 'container_capacity', parseInt(e.target.value) || 0)}
                                                                className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 pr-12 shadow-2xs"
                                                                placeholder="Ej: 900 o 600"
                                                            />
                                                            <span className="absolute right-2.5 top-1.5 text-[10px] font-bold text-slate-400">cajas</span>
                                                        </div>
                                                    </div>

                                                    {/* Cantidad de Envíos / Contenedores */}
                                                    <div className="w-full md:w-36 space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                                            N° Contenedores
                                                        </label>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateProviderAllocation(alloc.id, 'shipments_count', Math.max(1, (parseInt(alloc.shipments_count) || 1) - 1))}
                                                                className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs"
                                                            >
                                                                -
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={alloc.shipments_count}
                                                                onChange={(e) => updateProviderAllocation(alloc.id, 'shipments_count', Math.max(1, parseInt(e.target.value) || 1))}
                                                                className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-center text-slate-900"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => updateProviderAllocation(alloc.id, 'shipments_count', (parseInt(alloc.shipments_count) || 1) + 1)}
                                                                className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Subtotal Calculado */}
                                                    <div className="w-full md:w-44 text-right space-y-0.5 pt-1 md:pt-0">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                                            Subtotal Aportado
                                                        </span>
                                                        <div className="text-sm font-black text-indigo-700">
                                                            {subtotalBoxes.toLocaleString()} cajas
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-medium block">
                                                            ~{subtotalLbs.toLocaleString()} Lbs útiles
                                                        </span>
                                                    </div>

                                                    {/* Botón Eliminar */}
                                                    {providerAllocations.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeProviderAllocation(alloc.id)}
                                                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors self-end md:self-center"
                                                            title="Eliminar este proveedor"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Resumen de Cobertura Multi-Proveedor */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700">Total Contenedores Programados:</span>
                                                <strong className="text-slate-900">
                                                    {providerAllocations.reduce((s, p) => s + (parseInt(p.shipments_count) || 0), 0)} unidades
                                                </strong>
                                                <span className="text-slate-300">|</span>
                                                <strong className="text-indigo-700">{totalAllocatedBoxes.toLocaleString()} cajas</strong>
                                                <span className="text-slate-400">(~{Math.round(totalAllocatedBoxes * 36.1).toLocaleString()} Lbs)</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 font-medium">Meta Requerida:</span>
                                                <strong className="text-slate-800">{targetDemandBoxes.toLocaleString()} cjs</strong>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${totalAllocatedBoxes >= targetDemandBoxes
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {coveragePercent}% Cubierto
                                                </span>
                                            </div>
                                        </div>

                                        {/* Barra de Progreso */}
                                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full transition-all rounded-full ${totalAllocatedBoxes >= targetDemandBoxes ? 'bg-emerald-600' : 'bg-indigo-600'
                                                    }`}
                                                style={{ width: `${Math.min(100, coveragePercent)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-3">
                                    <Truck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                                    <div className="text-xs text-indigo-950 leading-relaxed">
                                        <strong>Logística Escalonada de Recepción:</strong> Para evitar saturar la capacidad de cuarto frío (máx. 1,200 cajas) y mantener huevo fresco (&lt; 5 días post-postura), el planificador distribuye el abastecimiento en <strong>4 entregas semanales de camiones refrigerados</strong>.
                                    </div>
                                </div>

                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-500" />
                                    Cronograma Semanal Sugerido de Camiones
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(plannerData?.trucks_schedule || []).map((truck, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-all shadow-sm space-y-2.5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                                                    {truck.week_label}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                    {truck.suggested_delivery_date}
                                                </span>
                                            </div>

                                            <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                                                        Carga Sugerida
                                                    </span>
                                                    <span className="text-base font-black text-slate-900">
                                                        {truck.boxes_count} cajas
                                                    </span>
                                                    <span className="text-[11px] text-slate-500 font-medium ml-1">
                                                        (~{truck.weight_lbs?.toLocaleString()} Lbs)
                                                    </span>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                                                        Proveedor
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {truck.suggested_provider}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-600 space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                                    <span><strong>Temperatura de Furgón:</strong> {truck.cold_chain_requirements}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                                    <span><strong>HACCP:</strong> {truck.haccp_status}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: INSUMOS DE FORMULACIÓN Y ADITIVOS */}
                        {activeTab === 'ingredients' && (
                            <div className="space-y-4">
                                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3">
                                    <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div className="text-xs text-emerald-950 leading-relaxed">
                                        <strong>Insumos Críticos de Formulación:</strong> Necesarios para estandarizar el huevo formulado por separación (reincorporación de yema con H2O purificada) y mezclas institucionales de yema dulce/salada.
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {/* liquido a */}
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800">Agua Desmineralizada H2O</span>
                                            <Droplets className="w-4 h-4 text-cyan-600" />
                                        </div>
                                        <div className="text-lg font-black text-cyan-700">
                                            {ingBal.purified_water?.lbs?.toLocaleString() || 0} Lbs
                                        </div>
                                        <div className="text-xs font-bold text-slate-600">
                                            {ingBal.purified_water?.bottles_5gal || 0} garrafas (5 galones)
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {ingBal.purified_water?.description}
                                        </p>
                                    </div>

                                    {/* Ácido Cítrico */}
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800">Ácido Cítrico Anhidro</span>
                                            <FlaskConical className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="text-lg font-black text-emerald-700">
                                            {ingBal.citric_acid?.lbs || 0} Lbs ({ingBal.citric_acid?.kg || 0} Kg)
                                        </div>
                                        <div className="text-xs font-bold text-slate-600">
                                            Estabilizador de pH grado alimentario
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {ingBal.citric_acid?.description}
                                        </p>
                                    </div>

                                    {/* Azúcar */}
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800">Azúcar para Yema</span>
                                            <Boxes className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div className="text-lg font-black text-amber-700">
                                            {ingBal.sugar?.lbs?.toLocaleString() || 0} Lbs
                                        </div>
                                        <div className="text-xs font-bold text-slate-600">
                                            {ingBal.sugar?.sacks_50kg || 0} sacos de 50 Kg
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {ingBal.sugar?.description}
                                        </p>
                                    </div>

                                    {/* Sal */}
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800">Sal Desyodada</span>
                                            <Boxes className="w-4 h-4 text-slate-600" />
                                        </div>
                                        <div className="text-lg font-black text-slate-700">
                                            {ingBal.salt?.lbs?.toLocaleString() || 0} Lbs
                                        </div>
                                        <div className="text-xs font-bold text-slate-600">
                                            {ingBal.salt?.sacks_50kg || 0} sacos de 50 Kg
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {ingBal.salt?.description}
                                        </p>
                                    </div>

                                    {/* Leche en Polvo */}
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800">Leche en Polvo</span>
                                            <Boxes className="w-4 h-4 text-indigo-600" />
                                        </div>
                                        <div className="text-lg font-black text-indigo-700">
                                            {ingBal.milk_powder?.lbs?.toLocaleString() || 0} Lbs
                                        </div>
                                        <div className="text-xs font-bold text-slate-600">
                                            {ingBal.milk_powder?.sacks_25kg || 0} sacos de 25 Kg
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {ingBal.milk_powder?.description}
                                        </p>
                                    </div>

                                    {/* Químicos CIP */}
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-800">Químicos Sanitización CIP</span>
                                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                                        </div>
                                        <div className="text-xs font-bold text-slate-700">
                                            Ácido Peracético: <span className="font-black text-rose-700">{ingBal.cip_chemicals?.peracetic_acid_liters || 0} L</span>
                                        </div>
                                        <div className="text-xs font-bold text-slate-700">
                                            Soda Cáustica: <span className="font-black text-rose-700">{ingBal.cip_chemicals?.caustic_soda_liters || 0} L</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            {ingBal.cip_chemicals?.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: CUBETAS Y EMPAQUES */}
                        {activeTab === 'packaging' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Cubetas 30 Lb</span>
                                        <div className="text-xl font-black text-slate-900">
                                            {packBal.buckets_30lb?.toLocaleString() || 0}
                                        </div>
                                        <span className="text-[11px] text-slate-500">Unidades grado alimentario</span>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tapaderas Herméticas</span>
                                        <div className="text-xl font-black text-slate-900">
                                            {packBal.lids?.toLocaleString() || 0}
                                        </div>
                                        <span className="text-[11px] text-slate-500">Con anillo de seguridad</span>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Liners Alimentarios</span>
                                        <div className="text-xl font-black text-slate-900">
                                            {packBal.food_grade_liners?.toLocaleString() || 0}
                                        </div>
                                        <span className="text-[11px] text-slate-500">Bolsas polietileno virgen (+2%)</span>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Etiquetas Lote Juliano</span>
                                        <div className="text-xl font-black text-indigo-600">
                                            {packBal.julian_traceability_labels?.toLocaleString() || 0}
                                        </div>
                                        <span className="text-[11px] text-slate-500">Térmicas con QR HACCP (+5%)</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: ORDEN CONSOLIDADA DE ABASTECIMIENTO (IMPRIMIBLE) */}
                        {activeTab === 'orders' && (
                            <div className="space-y-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <div className="border-b border-slate-200 pb-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-base font-bold text-slate-900">
                                                Plan Consolidado de Abastecimiento de Materia Prima
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Planta Pasteurizadora ANDELSA — Periodo: {monthNames[month - 1]} {year}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 mr-1">
                                                {eggBal.status === 'suficiente' ? 'Stock Cubierto' : 'Compra Requerida'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleDownloadPdf}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                            >
                                                <FileDown className="w-3.5 h-3.5" />
                                                <span>Descargar PDF</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handlePrintPdf}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                                <span>Imprimir</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                            <th className="p-2.5">Concepto / Material</th>
                                            <th className="p-2.5 text-right">Consumo Mensual</th>
                                            <th className="p-2.5 text-right">Stock Actual</th>
                                            <th className="p-2.5 text-right">Requerimiento Neto</th>
                                            <th className="p-2.5 text-right">Presentación Sugerida</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="p-2.5 font-bold text-slate-900">Huevo Cáscara Grado A</td>
                                            <td className="p-2.5 text-right font-medium">
                                                {eggBal.total_boxes_needed?.toLocaleString()} cajas
                                            </td>
                                            <td className="p-2.5 text-right font-medium">
                                                {eggBal.current_stock_boxes?.toLocaleString()} cajas
                                            </td>
                                            <td className={`p-2.5 text-right font-black ${isDeficit ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                {eggBal.boxes_to_purchase?.toLocaleString()} cajas
                                            </td>
                                            <td className="p-2.5 text-right text-slate-500">
                                                Camiones de 350-500 cajas
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-slate-900">Agua Purificada Desmineralizada</td>
                                            <td className="p-2.5 text-right font-medium">
                                                {ingBal.purified_water?.lbs?.toLocaleString()} Lbs
                                            </td>
                                            <td className="p-2.5 text-right font-medium">N/A</td>
                                            <td className="p-2.5 text-right font-bold text-cyan-700">
                                                {ingBal.purified_water?.bottles_5gal} garrafas
                                            </td>
                                            <td className="p-2.5 text-right text-slate-500">Garrafas 5 galones</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-slate-900">Ácido Cítrico Grado Alimentario</td>
                                            <td className="p-2.5 text-right font-medium">{ingBal.citric_acid?.lbs} Lbs</td>
                                            <td className="p-2.5 text-right font-medium">N/A</td>
                                            <td className="p-2.5 text-right font-bold text-emerald-700">
                                                {ingBal.citric_acid?.kg} Kg
                                            </td>
                                            <td className="p-2.5 text-right text-slate-500">Sacos 25 Kg</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-slate-900">Cubetas 30 Lb con Tapadera y Liner</td>
                                            <td className="p-2.5 text-right font-medium">
                                                {packBal.buckets_30lb?.toLocaleString()} sets
                                            </td>
                                            <td className="p-2.5 text-right font-medium">N/A</td>
                                            <td className="p-2.5 text-right font-bold text-slate-900">
                                                {packBal.buckets_30lb?.toLocaleString()} sets
                                            </td>
                                            <td className="p-2.5 text-right text-slate-500">Pallet de 250 cubetas</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3">
                                    Nota: Los pedidos a proveedores deben emitirse con al menos 48 horas de anticipación a la fecha de arribo del camión para coordinar inspección sanitaria de recepción y desinfección en cámara de recepción.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* BOTÓN CERRAR */}
                <div className="flex justify-end pt-3 border-t border-slate-200/80">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                        Cerrar Planificador
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default RawMaterialPlannerModal;
