import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    AlertTriangle,
    Building2,
    ChevronDown,
    ChevronUp,
    Download,
    FileSpreadsheet,
    GitBranch,
    Info,
    Landmark,
    Loader2,
    SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import {
    ANNEX_SECTIONS,
    F07_CLASSIFICATION_OPTIONS,
    F07_COST_TYPE_OPTIONS,
    F07_OPERATION_OPTIONS,
    F07_SECTOR_OPTIONS,
    INCOME_TYPE_OPTIONS
} from './haciendaAnexosConfig';

const parseFilenameFromHeader = (headerValue, fallbackName) => {
    if (!headerValue) return fallbackName;
    const match = /filename="?([^"]+)"?/i.exec(headerValue);
    return match?.[1] || fallbackName;
};

const HaciendaAnexosCsvModal = ({
    isOpen,
    onClose,
    year,
    month,
    branchId,
    branchName,
    periodText
}) => {
    const [onlyWithData, setOnlyWithData] = useState(false);
    const [showF07Config, setShowF07Config] = useState(false);
    const [incomeType, setIncomeType] = useState('3');
    const [clampFutureDates, setClampFutureDates] = useState(false);
    const [overrideF07, setOverrideF07] = useState(false);
    const [tipoOperacion, setTipoOperacion] = useState('1');
    const [tipoClasificacion, setTipoClasificacion] = useState('2');
    const [tipoSector, setTipoSector] = useState('4');
    const [tipoCosto, setTipoCosto] = useState('2');
    const [downloadingKey, setDownloadingKey] = useState(null);

    const { data: summaryResponse, isLoading } = useQuery({
        queryKey: ['vat-hacienda-anexos-summary', year, month, branchId],
        queryFn: async () => {
            const res = await axios.get('/api/vat-books/liquidation/anexos-hacienda/summary', {
                params: { year, month, branch_id: branchId }
            });
            return res.data;
        },
        enabled: isOpen,
        staleTime: 15 * 1000
    });

    if (!isOpen) return null;

    const summary = summaryResponse?.data || {};
    const paddedMonth = String(month).padStart(2, '0');
    const outOfPeriodCount = summary.compras?.out_of_period_count || 0;

    const allItems = ANNEX_SECTIONS.flatMap((section) => section.items);
    const activeItems = allItems.filter((item) => (summary[item.key]?.count || 0) > 0);

    const buildQueryParams = (annexKey) => {
        const params = { year, month, branch_id: branchId };
        if (annexKey === 'contribuyentes' || annexKey === 'consumidor') {
            params.tipo_ingreso = incomeType;
        }
        if (annexKey === 'compras') {
            params.clamp_future_dates = clampFutureDates;
        }
        if (annexKey === 'compras' || annexKey === 'sujetos_excluidos') {
            params.override_f07 = overrideF07;
            if (overrideF07) {
                params.tipo_operacion = tipoOperacion;
                params.tipo_clasificacion = tipoClasificacion;
                params.tipo_sector = tipoSector;
                params.tipo_costo = tipoCosto;
            }
        }
        return params;
    };

    const downloadCsvFile = async (item, silent = false) => {
        const endpoint = `/api/vat-books/liquidation/anexos-hacienda/${item.key}`;
        const fallbackFilename = `ANEXO_${item.annexNumber}_${year}_${paddedMonth}.csv`;

        try {
            const res = await axios.get(endpoint, {
                params: buildQueryParams(item.key),
                responseType: 'blob'
            });
            const filename = parseFilenameFromHeader(res.headers['content-disposition'], fallbackFilename);
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            if (!silent) {
                toast.success(`Anexo ${item.annexNumber} (${item.title}) descargado`);
            }
            return true;
        } catch (error) {
            let errorMessage = `Error al descargar Anexo ${item.annexNumber}`;
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const parsed = JSON.parse(text);
                    errorMessage = parsed.message || errorMessage;
                } catch {
                    errorMessage = `Error al descargar Anexo ${item.annexNumber}`;
                }
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            toast.error(errorMessage);
            return false;
        }
    };

    const handleSingleDownload = async (item) => {
        setDownloadingKey(item.key);
        await downloadCsvFile(item);
        setDownloadingKey(null);
    };

    const handleDownloadAllActive = async () => {
        if (activeItems.length === 0) {
            toast.error('No hay anexos con movimientos en este período');
            return;
        }

        setDownloadingKey('all');
        const downloadedNumbers = [];

        for (let i = 0; i < activeItems.length; i += 1) {
            if (i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 350));
            }
            const ok = await downloadCsvFile(activeItems[i], true);
            if (ok) {
                downloadedNumbers.push(`Anexo ${activeItems[i].annexNumber}`);
            }
        }

        if (downloadedNumbers.length > 0) {
            toast.success(`Descargados: ${downloadedNumbers.join(', ')}`);
        }
        setDownloadingKey(null);
    };

    const labelCls = 'text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1';
    const selectCls = 'w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-700';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-4xl"
            title={
                <div className="flex items-center gap-2.5 text-slate-900">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <FileSpreadsheet size={18} />
                    </div>
                    <div>
                        <span className="block leading-tight">Anexos F-07 para Ministerio de Hacienda</span>
                        <span className="text-[11px] font-medium text-slate-500 block">
                            Todos los formatos CSV oficiales listos para cargar en el portal DGII
                        </span>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                {/* Franja superior: Período, ámbito y filtro de visibilidad */}
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-[11px]">
                            {periodText || `${paddedMonth}/${year}`}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-[11px]">
                            {branchId === 'all' ? <Building2 size={13} className="text-indigo-600" /> : <GitBranch size={13} className="text-emerald-600" />}
                            <span>{branchName || 'Por Contribuyente'}</span>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[10px] font-bold">
                            {activeItems.length} de {allItems.length} con movimientos
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={onlyWithData}
                                onChange={(e) => setOnlyWithData(e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>Solo anexos con movimientos</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowF07Config((prev) => !prev)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                                showF07Config
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            <SlidersHorizontal size={12} />
                            <span>Configuración F-07</span>
                            {showF07Config ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                    </div>
                </div>

                {/* Alerta de fechas fuera de período en compras */}
                {outOfPeriodCount > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2 text-xs text-amber-900 font-semibold">
                            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <span>
                                Anexo 3 (Compras): {outOfPeriodCount} documento{outOfPeriodCount === 1 ? '' : 's'} con fecha posterior al cierre del mes.
                            </span>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 cursor-pointer select-none shrink-0">
                            <input
                                type="checkbox"
                                checked={clampFutureDates}
                                onChange={(e) => setClampFutureDates(e.target.checked)}
                                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span>Ajustar fechas al último día del mes</span>
                        </label>
                    </div>
                )}

                {/* Panel colapsable de configuración F-07 (Renta / Fechas) */}
                {showF07Config && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Tipo de Ingreso Renta (Anexos 1 y 2)</label>
                                <select
                                    value={incomeType}
                                    onChange={(e) => setIncomeType(e.target.value)}
                                    className={selectCls}
                                >
                                    {INCOME_TYPE_OPTIONS.map((opt) => (
                                        <option key={opt.code} value={opt.code}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={overrideF07}
                                        onChange={(e) => setOverrideF07(e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>Sobrescribir clasificación F-07 (Anexos 3 y 5)</span>
                                </label>
                            </div>
                        </div>

                        {overrideF07 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200/80">
                                <div>
                                    <label className={labelCls}>Operación</label>
                                    <select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value)} className={selectCls}>
                                        {F07_OPERATION_OPTIONS.map((o) => (
                                            <option key={o.code} value={o.code}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Clasificación</label>
                                    <select value={tipoClasificacion} onChange={(e) => setTipoClasificacion(e.target.value)} className={selectCls}>
                                        {F07_CLASSIFICATION_OPTIONS.map((o) => (
                                            <option key={o.code} value={o.code}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Sector</label>
                                    <select value={tipoSector} onChange={(e) => setTipoSector(e.target.value)} className={selectCls}>
                                        {F07_SECTOR_OPTIONS.map((o) => (
                                            <option key={o.code} value={o.code}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Tipo Costo / Gasto</label>
                                    <select value={tipoCosto} onChange={(e) => setTipoCosto(e.target.value)} className={selectCls}>
                                        {F07_COST_TYPE_OPTIONS.map((o) => (
                                            <option key={o.code} value={o.code}>{o.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Listado de anexos agrupados */}
                {isLoading ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 size={24} className="animate-spin text-indigo-600" />
                        <span className="text-xs font-semibold">Consultando anexos del período...</span>
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                        {ANNEX_SECTIONS.map((section) => {
                            const visibleItems = onlyWithData
                                ? section.items.filter((item) => (summary[item.key]?.count || 0) > 0)
                                : section.items;

                            if (visibleItems.length === 0) return null;

                            return (
                                <div key={section.id} className="space-y-2">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
                                        {section.title}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {visibleItems.map((item) => {
                                            const stats = summary[item.key] || { count: 0 };
                                            const hasRows = stats.count > 0;
                                            const countLabel = item.key === 'consumidor' && hasRows
                                                ? `${stats.count} día${stats.count === 1 ? '' : 's'} · ${stats.docs_count || 0} docs.`
                                                : `${stats.count} reg${stats.count === 1 ? '' : 's'}.`;

                                            return (
                                                <div
                                                    key={item.key}
                                                    className={`bg-white border rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition-opacity ${
                                                        hasRows ? 'border-slate-200 shadow-xs' : 'border-slate-100 opacity-70'
                                                    }`}
                                                >
                                                    <div className="space-y-2.5">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${item.badgeCls}`}>
                                                                        Anexo {item.annexNumber}
                                                                    </span>
                                                                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                                                                        {item.columnsCount} col.
                                                                    </span>
                                                                </div>
                                                                <h5 className="text-xs font-black text-slate-900 mt-1 truncate">
                                                                    {item.title}
                                                                </h5>
                                                                <p className="text-[10.5px] text-slate-500 font-medium truncate">
                                                                    {item.subtitle}
                                                                </p>
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0 ${
                                                                hasRows ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
                                                            }`}>
                                                                {countLabel}
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
                                                            {item.metrics.map((m) => (
                                                                <div key={m.field}>
                                                                    <span className="text-[9.5px] font-bold text-slate-400 uppercase block truncate">
                                                                        {m.label}
                                                                    </span>
                                                                    <span className={m.highlight ? 'font-black text-slate-900' : 'font-bold text-slate-700'}>
                                                                        <Money value={stats[m.field] || 0} />
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSingleDownload(item)}
                                                        disabled={!hasRows || downloadingKey !== null}
                                                        className={`w-full flex items-center justify-center gap-1.5 text-white px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 disabled:opacity-45 cursor-pointer ${item.btnCls}`}
                                                    >
                                                        {downloadingKey === item.key ? (
                                                            <Loader2 size={14} className="animate-spin" />
                                                        ) : (
                                                            <Download size={14} />
                                                        )}
                                                        <span>Descargar CSV</span>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {onlyWithData && activeItems.length === 0 && (
                            <div className="p-8 text-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-2xl border border-slate-200/70">
                                No hay anexos con movimientos en el período seleccionado.
                            </div>
                        )}
                    </div>
                )}

                {/* Nota técnica DGII */}
                <div className="p-2.5 bg-slate-50 border border-slate-200/70 rounded-xl flex items-start gap-2 text-[11px] text-slate-600">
                    <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                    <span>
                        Todos los archivos cumplen el estándar DGII F-07: CSV delimitado por punto y coma (;), sin fila de encabezados, fechas DD/MM/AAAA, identificaciones y códigos sin guiones, montos positivos y número de anexo en la columna final.
                    </span>
                </div>

                {/* Pie de acciones */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <button
                        type="button"
                        onClick={handleDownloadAllActive}
                        disabled={isLoading || activeItems.length === 0 || downloadingKey !== null}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        {downloadingKey === 'all' ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <Landmark size={15} />
                        )}
                        <span>Descargar Todos con Datos ({activeItems.length} .csv)</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default HaciendaAnexosCsvModal;
