import {
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
import PackagingStockCards from './PackagingStockCards';
import PackagingActiveBatchesTable from './PackagingActiveBatchesTable';




export default function PackagingFiltersBar({ model }) {
    const { batches, loading, searchTerm, setSearchTerm, setIsNewPackagingModalOpen, setPackagingForm, setSelectedLabel, setQualityModal, canClosePackaging, canEditLots, setCloseBatchModal, handleReopenBatchPackaging, handlePrintLabel, filteredPackaging, handleEdit, handleDelete } = model;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-indigo-600 shrink-0" />
                    Historial de Unidades Empacadas
                </h2>
                <div className="relative w-full sm:w-72">
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
                <PackagingStockCards batches={batches} />

                {/* Control de Lotes en Etapa de Envasado (Cerrar / Reabrir) */}
                <PackagingActiveBatchesTable
                    batches={batches}
                    canClosePackaging={canClosePackaging}
                    setPackagingForm={setPackagingForm}
                    setIsNewPackagingModalOpen={setIsNewPackagingModalOpen}
                    setCloseBatchModal={setCloseBatchModal}
                    setQualityModal={setQualityModal}
                    handleReopenBatchPackaging={handleReopenBatchPackaging}
                />

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
                        <table className="w-full min-w-[840px] text-left text-xs border-collapse">
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
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-slate-900 text-xs">{p.lot_code}</span>
                                                    {relatedBatch?.is_coproduct ? (
                                                        <span className="px-1.5 py-0.2 text-[8px] bg-purple-100 text-purple-700 font-bold rounded border border-purple-200" title="Co-producto derivado">
                                                            🔗 Co-Prod
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <span className="text-[10px] text-indigo-600 font-medium tracking-wide flex items-center gap-1">
                                                    <Barcode size={11} />
                                                    {p.barcode}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 capitalize text-xs">{p.product_type}</span>
                                                {p.catalog_product_code ? (
                                                    <span className="text-[10px] text-indigo-700 font-semibold flex items-center gap-1 mt-0.5" title={p.catalog_product_name}>
                                                        <span className="px-1 py-0.2 bg-indigo-50 border border-indigo-200 rounded font-bold text-[9px]">
                                                            {p.catalog_product_code}
                                                        </span>
                                                        <span className="truncate max-w-[130px]">
                                                            {p.catalog_product_name}
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] text-amber-600 font-medium">Sin catálogo asignado</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-700 text-xs">{p.presentation}</span>
                                                {p.current_inventory_stock !== null && p.current_inventory_stock !== undefined ? (
                                                    <span className="text-[9px] text-emerald-700 font-bold flex items-center gap-0.5 mt-0.5" title="Existencia actual en inventario comercial">
                                                        ✓ Stock: {Number(p.current_inventory_stock).toFixed(0)} Uds
                                                    </span>
                                                ) : null}
                                            </div>
                                        </td>
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
