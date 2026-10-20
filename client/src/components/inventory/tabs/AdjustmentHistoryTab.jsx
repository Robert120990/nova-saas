import {
    Search,
    FileSpreadsheet,
    FileText as FilePdf,
    Eye,
    Edit2,
    XCircle
} from 'lucide-react';
import Table from '../../ui/Table';
import Pagination from '../../ui/Pagination';
import { formatDateDMY } from '../../../utils/dateUtils';

const AdjustmentHistoryTab = ({
    historySearch,
    setHistorySearch,
    historyPage,
    setHistoryPage,
    adjustmentsData,
    loadingAdjustments,
    onExportExcel,
    onOpenPdfModal,
    onViewAdjustment,
    onEditAdjustment,
    onVoidAdjustment
}) => {
    const rows = Array.isArray(adjustmentsData?.data) ? adjustmentsData.data : [];

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-[180px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => {
                            setHistorySearch(e.target.value.toUpperCase());
                            setHistoryPage(1);
                        }}
                        placeholder="Buscar por número, sucursal u observaciones..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all text-sm font-bold"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onExportExcel}
                        className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all"
                    >
                        <FileSpreadsheet size={14} />
                        Excel
                    </button>
                    <button
                        onClick={onOpenPdfModal}
                        className="px-4 py-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-rose-100 transition-all"
                    >
                        <FilePdf size={14} />
                        PDF
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Documento', 'Fecha', 'Sucursal', 'Motivo', 'Tipo', 'Items', 'Estado', 'Acciones']}
                    data={rows}
                    isLoading={loadingAdjustments}
                    renderRow={(a) => (
                        <tr key={a.id} className={`hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 ${a.status === 'ANULADO' ? 'opacity-50 grayscale select-none' : ''}`}>
                            <td className="px-3 py-2">
                                <span className="text-xs font-mono font-black text-indigo-600 whitespace-nowrap">
                                    AJ-{String(a.id).padStart(6, '0')}
                                    {a.numero && (
                                        <>
                                            <span className="text-slate-400 font-normal ml-1 mr-1">/</span>
                                            {a.numero}
                                        </>
                                    )}
                                </span>
                            </td>
                            <td className="px-3 py-2">
                                <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                                    {formatDateDMY(a.fecha)}
                                </span>
                            </td>
                            <td className="px-3 py-2">
                                <span className="text-xs font-bold text-slate-700 truncate block max-w-[120px]">{a.branch_name}</span>
                            </td>
                            <td className="px-3 py-2">
                                <span className="text-xs font-medium text-slate-500 truncate block max-w-[200px]">{a.motivo_name}</span>
                            </td>
                            <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-wider ${a.tipo === 'ENTRADA' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                    {a.tipo}
                                </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                                <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-xs font-bold text-slate-600">{a.items_count}</span>
                            </td>
                            <td className="px-2 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter uppercase ${a.status === 'ANULADO' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {a.status || 'COMPLETADO'}
                                </span>
                            </td>
                            <td className="px-2 py-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => onViewAdjustment(a)}
                                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        <Eye size={14} />
                                    </button>
                                    {a.status !== 'ANULADO' && (
                                        <>
                                            <button
                                                onClick={() => onEditAdjustment(a)}
                                                className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => onVoidAdjustment(a.id)}
                                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <XCircle size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                />
                <Pagination
                    currentPage={historyPage}
                    totalPages={adjustmentsData?.totalPages || 0}
                    totalItems={adjustmentsData?.totalItems || 0}
                    onPageChange={setHistoryPage}
                    itemsOnPage={rows.length}
                    isLoading={loadingAdjustments}
                />
            </div>
        </div>
    );
};

export default AdjustmentHistoryTab;
