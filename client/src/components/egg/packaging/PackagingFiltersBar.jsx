import {
    Plus,
    Barcode,
    QrCode,
    Calendar,
    User,
    Snowflake,
    Boxes,
    Search,
    Printer,
    Pencil,
    Trash2,
    Lock,
    FlaskConical
} from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';




export default function PackagingFiltersBar({ model }) {
    const { batches, loading, searchTerm, setSearchTerm, setIsNewPackagingModalOpen, setPackagingForm, setSelectedLabel, setQualityModal, canClosePackaging, canEditLots, setCloseBatchModal, handleReopenBatchPackaging, handlePrintLabel, filteredPackaging, handleEdit, handleDelete } = model;

    return (<div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-indigo-600" />
                        Historial de Unidades Empacadas
                    </h2>
                    <div className="relative w-full md:w-72">
                        <input
                            type="text"
                            placeholder="Buscar por lote, producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                        />
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    </div>
                </div>

                {/* Stock de Producto Terminado */}
                {batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado').length > 0 && (() => {
                    const stockByProduct = {};
                    batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado').forEach(b => {
                        const key = b.product_type || 'otro';
                        if (!stockByProduct[key]) stockByProduct[key] = 0;
                        stockByProduct[key] += Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0));
                    });
                    const entries = Object.entries(stockByProduct);
                    return (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                            {(Array.isArray(entries) ? entries : []).map(([product, lbs]) => (
                                <div key={product} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">{product}</span>
                                    <span className={`text-sm font-bold ${lbs > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                                        {lbs.toLocaleString(undefined, { maximumFractionDigits: 0 })} Lbs
                                    </span>
                                    <span className="text-[9px] text-slate-400 block font-medium">disponible</span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* Control de Lotes en Etapa de Envasado (Cerrar / Reabrir) */}
                {batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad').length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                        <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Boxes size={14} className="text-purple-600" />
                                Lotes en Etapa de Envasado ({batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad').length})
                            </h3>
                            <span className="text-[10px] text-slate-500 font-medium">
                                Control de cierre técnico y reapertura de empaque
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-white text-slate-500 font-bold uppercase text-[10px]">
                                        <th className="px-3 py-2">Lote</th>
                                        <th className="px-3 py-2">Producto</th>
                                        <th className="px-3 py-2 text-right">Rendimiento Líq.</th>
                                        <th className="px-3 py-2 text-right">Envasado</th>
                                        <th className="px-3 py-2 text-right">Saldo Disp.</th>
                                        <th className="px-3 py-2 text-center">Estado Empaque</th>
                                        <th className="px-3 py-2 text-center">Calidad FQ/MB</th>
                                        <th className="px-3 py-2 text-center">Eficiencia</th>
                                        <th className="px-3 py-2 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
                                    {(Array.isArray(batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad')) ? batches.filter(b => b.status === 'pasteurizado' || b.status === 'empaquetado' || b.status === 'aprobado_calidad') : []).map(b => {
                                        const packaged = parseFloat(b.packaged_weight_lbs || 0);
                                        const yieldLbs = parseFloat(b.yield_liquid_lbs || 0);
                                        const pending = Math.max(0, yieldLbs - packaged);
                                        const isClosed = b.packaging_status === 'cerrado';

                                        return (
                                            <tr key={b.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 font-mono font-bold text-slate-900">
                                                    {b.batch_code_display || b.batch_uuid}
                                                </td>
                                                <td className="px-3 py-2 capitalize font-medium text-slate-700">
                                                    {b.product_type}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-teal-700">
                                                    {yieldLbs.toLocaleString()} Lbs
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-indigo-700">
                                                    {packaged.toLocaleString()} Lbs
                                                </td>
                                                <td className="px-3 py-2 text-right font-black">
                                                    <span className={pending > 0 ? 'text-amber-600' : 'text-slate-400'}>
                                                        {pending.toLocaleString()} Lbs
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        isClosed
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {isClosed ? 'Cerrado' : 'Abierto'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setQualityModal({ isOpen: true, batch: b })}
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                            b.status === 'aprobado_calidad'
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : b.status === 'bloqueado_haccp'
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}
                                                        title="Ver o evaluar control de calidad FQ / MB"
                                                    >
                                                        {b.status === 'aprobado_calidad' ? 'Liberado' : b.status === 'bloqueado_haccp' ? 'Bloqueado' : 'Cuarentena'}
                                                    </button>
                                                </td>
                                                <td className="px-3 py-2 text-center font-bold text-slate-700">
                                                    {b.packaging_efficiency_pct ? `${b.packaging_efficiency_pct}%` : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {!isClosed ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPackagingForm(prev => ({
                                                                            ...prev,
                                                                            batch_id: String(b.id),
                                                                            product_type: (b.product_type || 'huevo entero').toLowerCase()
                                                                        }));
                                                                        setIsNewPackagingModalOpen(true);
                                                                    }}
                                                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                >
                                                                    <Plus size={11} />
                                                                    Envasar
                                                                </button>
                                                                {canClosePackaging && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setCloseBatchModal({ isOpen: true, batch: b, notes: '', isSubmitting: false })}
                                                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                        title="Cerrar Envasado y Computar Mermas Técnicas"
                                                                    >
                                                                        <Lock size={11} />
                                                                        Cerrar
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReopenBatchPackaging(b)}
                                                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs flex items-center gap-1"
                                                                title="Reabrir Envasado para agregar más cubetas o corregir"
                                                            >
                                                                <Lock size={11} className="text-purple-600" />
                                                                Reabrir
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="h-px bg-slate-100" />

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 text-xs font-medium animate-pulse">
                            Cargando empaques finalizados...
                        </div>
                    ) : filteredPackaging.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 text-xs font-medium">
                            No se han registrado envasados todavía.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="p-3">Código Lote / Barra</th>
                                    <th className="p-3">Producto</th>
                                    <th className="p-3">Presentación</th>
                                    <th className="p-3">Estado / Zona</th>
                                    <th className="p-3 text-right">Cant. Envasada</th>
                                    <th className="p-3 text-right">Peso Total</th>
                                    <th className="p-3 text-center">Calidad FQ/MB</th>
                                    <th className="p-3">Vencimiento</th>
                                    <th className="p-3">Operador</th>
                                    <th className="p-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {(Array.isArray(filteredPackaging) ? filteredPackaging : []).map(p => {
                                    const relatedBatch = batches.find(b => b.id === p.batch_id);
                                    const qStatus = p.quality_status || (relatedBatch?.status === 'aprobado_calidad' ? 'liberado' : relatedBatch?.status === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'cuarentena');
                                    return (
                                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold text-slate-900 text-xs">{p.lot_code}</span>
                                                <span className="text-[10px] text-indigo-600 font-medium tracking-wide flex items-center gap-1">
                                                    <Barcode size={11} />
                                                    {p.barcode}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 font-bold text-slate-900 capitalize text-xs">{p.product_type}</td>
                                        <td className="p-3 font-medium text-slate-600 text-xs">{p.presentation}</td>
                                        <td className="p-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase w-fit flex items-center gap-1 ${
                                                    p.product_state === 'congelado'
                                                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {p.product_state === 'congelado' && <Snowflake size={10} />}
                                                    {p.product_state || 'líquido'}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    Zona: <span className="text-slate-800 font-bold">{p.warehouse_zone || 'COOLER'}</span>
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right text-slate-900 font-bold text-xs">{p.units_packaged} Uds</td>
                                        <td className="p-3 text-right text-teal-700 font-bold text-xs">
                                            {parseFloat(p.total_batch_weight_lbs).toLocaleString()} Lbs
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => setQualityModal({
                                                    isOpen: true,
                                                    batch: relatedBatch || {
                                                        id: p.batch_id,
                                                        batch_uuid: p.lot_code,
                                                        batch_code_display: p.lot_code,
                                                        product_type: p.product_type,
                                                        status: qStatus === 'liberado' ? 'aprobado_calidad' : qStatus === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'empaquetado'
                                                    }
                                                })}
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                                                    qStatus === 'liberado'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : qStatus === 'bloqueado_haccp'
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}
                                                title="Ver o evaluar control de calidad FQ / MB"
                                            >
                                                {qStatus === 'liberado' ? 'Liberado' : qStatus === 'bloqueado_haccp' ? 'Bloqueado' : 'Cuarentena'}
                                            </button>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-slate-600 flex items-center gap-1 text-xs font-medium">
                                                <Calendar size={12} className="text-slate-400" />
                                                {formatDate(p.expiry_date)}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600">
                                            <span className="flex items-center gap-1 text-xs font-medium">
                                                <User size={12} className="text-slate-400" />
                                                {p.operator_name}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setQualityModal({
                                                        isOpen: true,
                                                        batch: relatedBatch || {
                                                            id: p.batch_id,
                                                            batch_uuid: p.lot_code,
                                                            batch_code_display: p.lot_code,
                                                            product_type: p.product_type,
                                                            status: qStatus === 'liberado' ? 'aprobado_calidad' : qStatus === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'empaquetado'
                                                        }
                                                    })}
                                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors"
                                                    title="Calidad FQ / MB (LAB-004)"
                                                >
                                                    <FlaskConical size={12} />
                                                </button>
                                                <button
                                                    onClick={() => setSelectedLabel(p)}
                                                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                    title="Ver Etiqueta QR"
                                                >
                                                    <QrCode size={11} />
                                                    QR
                                                </button>
                                                <button
                                                    onClick={() => handlePrintLabel(p)}
                                                    className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 transition-colors"
                                                    title="Imprimir Etiqueta PDF"
                                                >
                                                    <Printer size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(p)}
                                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                {canEditLots && batches.find(b => b.id === p.batch_id)?.packaging_status === 'cerrado' && (
                                                    <button
                                                        onClick={() => handleReopenBatchPackaging(batches.find(b => b.id === p.batch_id))}
                                                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 transition-colors"
                                                        title="Reabrir Envasado de este Lote"
                                                    >
                                                        <Lock size={12} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(p.id)}
                                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
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
