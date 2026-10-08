import { useState } from 'react';
import { formatDate } from '../../../utils/dateUtils';
import {
    FileText,
    User,
    Calendar,
    Boxes,
    Search,
    Pencil,
    Ban,
    Printer,
    Eye,
    ShieldCheck,
    Trash2,
    FlaskConical,
    Loader2,
    ChevronDown,
    Check
} from 'lucide-react';


export default function ReceptionFiltersBar({ model }) {
    const [printMenuPos, setPrintMenuPos] = useState(null);
    const { user, loading, searchTerm, setSearchTerm, setViewingReception, setVoidConfirmId, canDeleteReception, setDeleteConfirmRm, getQualityBadgeClass, printingPdfId, openPrintMenuId, setOpenPrintMenuId, handlePrintLab001, handleDownloadLab001Docx, handlePrintOriginCert, handleDownloadOriginCertDocx, handleOpenQualityModal, handleOpenPrintTarima, handleEdit, handlePrintReceptionSummary, filteredMaterials, getStatusBadge, getStatusIcon, getStatusLabel, handleQuickApprove } = model;

    return (<div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-600" />
                            Historial de Ingresos de Materia Prima
                        </h2>

                        <div className="relative w-full md:w-80">
                            <input
                                type="text"
                                placeholder="Buscar por proveedor, lote o tipo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                            />
                            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Cargando historial de recepciones...
                            </div>
                        ) : filteredMaterials.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                                No se encontraron registros de materia prima.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-3 py-2.5">Fecha</th>
                                        <th className="px-3 py-2.5">Proveedor / Lote</th>
                                        <th className="px-3 py-2.5">Tipo / Presentación</th>
                                        <th className="px-3 py-2.5 text-right">Cajas</th>
                                        <th className="px-3 py-2.5 text-right">Peso (Lbs)</th>
                                        <th className="px-3 py-2.5 text-right">Peso Prom. / Cj</th>
                                        <th className="px-3 py-2.5 text-right">Stock (Lbs)</th>
                                        <th className="px-3 py-2.5 text-center">Temp Huevo</th>
                                        <th className="px-3 py-2.5 text-center">Estatus</th>
                                        <th className="px-3 py-2.5 text-center">Calidad / Grado</th>
                                        <th className="px-3 py-2.5">Operador</th>
                                        <th className="px-3 py-2.5 text-center w-12">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {(Array.isArray(filteredMaterials) ? filteredMaterials : []).map(rm => {
                                        let certs = [];
                                        try {
                                            certs = JSON.parse(rm.certificate_urls || '[]');
                                        } catch (e) {
                                            certs = [];
                                        }

                                        let originalTarimas = [];
                                        try {
                                            originalTarimas = typeof rm.tarimas_json === 'string' ? JSON.parse(rm.tarimas_json || '[]') : (rm.tarimas_json || []);
                                        } catch (e) {
                                            originalTarimas = [];
                                        }
                                        const tarimaBoxes = Array.isArray(originalTarimas) && originalTarimas.length > 0
                                            ? originalTarimas.reduce((acc, t) => acc + (parseInt(t.boxes_count) || 0), 0)
                                            : 0;
                                        const initialBoxes = rm.initial_boxes || tarimaBoxes || parseInt(rm.total_boxes || 0);
                                        const stockBoxes = rm.stock_boxes !== undefined ? rm.stock_boxes : parseInt(rm.total_boxes || 0);
                                        const weight = parseFloat(rm.weight_lbs || 0);
                                        const avgWeightPerBox = rm.avg_weight_per_box !== undefined && rm.avg_weight_per_box !== null
                                            ? rm.avg_weight_per_box
                                            : (initialBoxes > 0 && weight > 0 ? (weight / initialBoxes) : null);

                                        return (
                                            <tr key={rm.id} className="hover:bg-slate-50/75 transition-colors">
                                                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                                                    <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                                                        <Calendar size={13} className="text-slate-400" />
                                                        {formatDate(rm.fecha || rm.created_at)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{rm.provider_name}</span>
                                                        <span className="bg-slate-100 border border-slate-200 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit mt-0.5">
                                                            {rm.provider_lot}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 capitalize">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-900 text-xs font-bold">{rm.egg_type}</span>
                                                        {rm.egg_type === 'huevo cáscara' && (
                                                            <span className="text-[10px] text-slate-500">Color: {rm.egg_color} | Talla: {rm.egg_size}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-800 text-xs">
                                                    {initialBoxes ? (
                                                        <div className="flex flex-col items-end">
                                                            <span>{initialBoxes} cjs</span>
                                                            {stockBoxes < initialBoxes && (
                                                                <span className={`text-[10px] font-bold ${stockBoxes <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                                    Stock: {stockBoxes} cjs
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-black text-slate-900 text-xs">
                                                    {parseFloat(rm.weight_lbs).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-slate-800 text-xs whitespace-nowrap">
                                                    {avgWeightPerBox !== null ? (
                                                        <span className="inline-flex items-baseline gap-1 text-slate-900 font-extrabold">
                                                            {avgWeightPerBox.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            <span className="text-[10px] text-slate-400 font-medium">lb/cj</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-normal">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-xs">
                                                    <span className={parseFloat(rm.stock_lbs || 0) <= 0 ? 'text-rose-600' : parseFloat(rm.stock_lbs) < 1000 ? 'text-amber-600' : 'text-emerald-700'}>
                                                        {parseFloat(rm.stock_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    {rm.temperature_c !== null && rm.temperature_c !== undefined && rm.temperature_c !== '' ? (
                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                                            parseFloat(rm.temperature_c) > 6.0
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}>
                                                            {rm.temperature_c}°C
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-medium text-[10px] italic">
                                                            N/R
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight">
                                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${getStatusBadge(rm.status)}`}>
                                                            {getStatusIcon(rm.status)}
                                                            {getStatusLabel(rm.status)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    {rm.quality_inspector_name ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenQualityModal(rm)}
                                                            className="inline-flex flex-col items-center p-1 hover:bg-amber-50/70 rounded-lg transition-colors group cursor-pointer"
                                                            title="Dictamen de calidad registrado. Haz clic para ver o editar."
                                                        >
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getQualityBadgeClass(rm.quality_status, rm.egg_classification)}`}>
                                                                <ShieldCheck size={11} className="shrink-0" />
                                                                <span>
                                                                    {rm.quality_status === 'rechazado' || (rm.egg_classification || '').toLowerCase().includes('no conforme')
                                                                        ? 'NO CONFORME'
                                                                        : (rm.egg_classification || 'Grado A')}
                                                                </span>
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 group-hover:text-amber-700 font-semibold mt-0.5 truncate max-w-[85px]">
                                                                {rm.quality_inspector_name}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenQualityModal(rm)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors shadow-2xs"
                                                            title="Pendiente de evaluación de calidad por personal técnico. Haz clic para evaluar."
                                                        >
                                                            <ShieldCheck size={11} className="text-amber-600 shrink-0" />
                                                            <span>Pendiente Calidad</span>
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-600 flex items-center gap-1 text-[10px]">
                                                            <User size={11} className="text-slate-400" />
                                                            {rm.operator_name}
                                                        </span>
                                                        {certs.length > 0 && (
                                                            <div className="flex gap-1 mt-0.5">
                                                                {(Array.isArray(certs) ? certs : []).map((url, idx) => (
                                                                    <a
                                                                        key={idx}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-indigo-600 hover:text-indigo-800 text-[10px] underline font-bold flex items-center gap-0.5"
                                                                    >
                                                                        <FileText size={10} />
                                                                        Cert #{idx + 1}
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {/* 1. Ver Detalle y Tarimas */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewingReception(rm)}
                                                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-xs"
                                                            title="Ver Detalle y Tarimas"
                                                        >
                                                            <Eye size={13} />
                                                        </button>

                                                        {/* 2. Menú Desplegable de Impresión */}
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    if (openPrintMenuId === rm.id) {
                                                                        setOpenPrintMenuId(null);
                                                                        setPrintMenuPos(null);
                                                                    } else {
                                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                                        const spaceBelow = window.innerHeight - rect.bottom;
                                                                        const spaceAbove = rect.top;
                                                                        const dir = spaceBelow < 280 && spaceAbove > spaceBelow ? 'up' : 'down';
                                                                        const right = Math.max(8, document.documentElement.clientWidth - rect.right);
                                                                        const top = dir === 'down' ? rect.bottom + 4 : undefined;
                                                                        const bottom = dir === 'up' ? window.innerHeight - rect.top + 4 : undefined;
                                                                        setPrintMenuPos({ top, bottom, right, dir });
                                                                        setOpenPrintMenuId(rm.id);
                                                                    }
                                                                }}
                                                                disabled={printingPdfId === rm.id}
                                                                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg border transition-all shadow-xs ${
                                                                    openPrintMenuId === rm.id
                                                                        ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/20'
                                                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                                                                } disabled:opacity-50`}
                                                                title="Formatos de Impresión (LOG-004, LAB-001, Tarimas)"
                                                            >
                                                                {printingPdfId === rm.id ? (
                                                                    <Loader2 className="animate-spin" size={12} />
                                                                ) : (
                                                                    <Printer size={12} className={openPrintMenuId === rm.id ? 'text-white' : 'text-slate-500'} />
                                                                )}
                                                                <span>Imprimir</span>
                                                                <ChevronDown size={10} className={`transition-transform duration-150 ${openPrintMenuId === rm.id ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {openPrintMenuId === rm.id && printMenuPos && (
                                                                <>
                                                                    {/* Overlay transparente para cerrar al hacer clic afuera */}
                                                                    <div
                                                                        className="fixed inset-0 z-40"
                                                                        onClick={() => { setOpenPrintMenuId(null); setPrintMenuPos(null); }}
                                                                    />

                                                                    {/* Menú Desplegable */}
                                                                    <div 
                                                                        className={`fixed z-50 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 text-left divide-y divide-slate-100 animate-in fade-in-50 ${
                                                                            printMenuPos.dir === 'up' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
                                                                        }`}
                                                                        style={{
                                                                            right: `${printMenuPos.right}px`,
                                                                            ...(printMenuPos.dir === 'up' ? { bottom: `${printMenuPos.bottom}px` } : { top: `${printMenuPos.top}px` })
                                                                        }}
                                                                    >
                                                                        <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                                            Formatos Oficiales
                                                                        </div>
                                                                        <div className="py-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handlePrintReceptionSummary(rm);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FileText size={15} className="text-emerald-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Resumen Recepción (LOG-004)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Boleta de ingreso y báscula en PDF</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handlePrintLab001(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FlaskConical size={15} className="text-amber-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Dictamen de Calidad (LAB-001)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Reporte técnico oficial en PDF</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handleDownloadLab001Docx(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FileText size={15} className="text-indigo-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Dictamen Word (LAB-001)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Descargar documento editable (.docx)</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handlePrintOriginCert(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left border-t border-slate-100"
                                                                            >
                                                                                <ShieldCheck size={15} className="text-teal-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Certificado Calidad Origen (PDF)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Formato oficial proveedor / ANDELSA</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    handleDownloadOriginCertDocx(rm.id, rm.provider_lot);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <FileText size={15} className="text-teal-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Certificado Origen Word (.docx)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Descargar formato editable oficial</span>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenPrintMenuId(null);
                                                                                    let parsedTarimas = [];
                                                                                    try {
                                                                                        parsedTarimas = typeof rm.tarimas_json === 'string'
                                                                                            ? JSON.parse(rm.tarimas_json || '[]')
                                                                                            : (rm.tarimas_json || []);
                                                                                    } catch (e) {
                                                                                        parsedTarimas = [];
                                                                                    }
                                                                                    if (!Array.isArray(parsedTarimas) || parsedTarimas.length === 0) {
                                                                                        parsedTarimas = [{
                                                                                            tarima_number: 1,
                                                                                            boxes_count: rm.total_boxes || 0,
                                                                                            gross_weight_lbs: rm.weight_lbs || 0,
                                                                                            tare_weight_lbs: 0,
                                                                                            net_weight_lbs: rm.weight_lbs || 0
                                                                                        }];
                                                                                    }
                                                                                    const recData = {
                                                                                        reception_id: rm.id,
                                                                                        provider_name: rm.provider_name,
                                                                                        provider_lot: rm.provider_lot,
                                                                                        fecha: rm.fecha || rm.created_at,
                                                                                        egg_type: rm.egg_type,
                                                                                        egg_color: rm.egg_color,
                                                                                        egg_size: rm.egg_size,
                                                                                        temperature_c: rm.temperature_c,
                                                                                        truck_temperature_c: rm.truck_temperature_c,
                                                                                        truck_plate: rm.truck_plate,
                                                                                        driver_name: rm.driver_name,
                                                                                        operator_name: rm.operator_name,
                                                                                        company_name: user?.company_name || 'ANDELSA, S.A. DE C.V.'
                                                                                    };
                                                                                    handleOpenPrintTarima(parsedTarimas[0], parsedTarimas, recData);
                                                                                }}
                                                                                className="w-full px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 transition text-left"
                                                                            >
                                                                                <Boxes size={15} className="text-sky-600 shrink-0" />
                                                                                <div>
                                                                                    <span className="font-bold block text-slate-900">Etiquetas de Tarimas (QR)</span>
                                                                                    <span className="text-[10px] text-slate-400 block font-normal">Fichas de identificación para estibas</span>
                                                                                </div>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Botón Rápido de Aprobación para Producción */}
                                                        {['pendiente_aprobacion', 'cuarentena'].includes(rm.status) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuickApprove(rm)}
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-300 transition-colors shadow-xs"
                                                                title="Aprobar Lote para Producción"
                                                            >
                                                                <Check size={13} />
                                                            </button>
                                                        )}

                                                        {/* 3. Editar Recepción */}
                                                        {rm.status !== 'anulado' && (
                                                            <button
                                                                onClick={() => handleEdit(rm)}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-colors shadow-xs"
                                                                title="Editar Recepción"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                        )}

                                                        {/* 4. Anular */}
                                                        {rm.status !== 'anulado' && parseFloat(rm.stock_lbs || 0) >= parseFloat(rm.weight_lbs || 0) && (
                                                            <button
                                                                onClick={() => setVoidConfirmId(rm.id)}
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                                title="Anular Recepción"
                                                            >
                                                                <Ban size={13} />
                                                            </button>
                                                        )}

                                                        {/* 5. Eliminar */}
                                                        {canDeleteReception && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteConfirmRm(rm)}
                                                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors shadow-xs"
                                                                title="Eliminar Recepción Permanentemente"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}

                                                        {rm.status === 'anulado' && (
                                                            <span className="text-[10px] text-slate-400 font-semibold italic">Anulado</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>);
}
