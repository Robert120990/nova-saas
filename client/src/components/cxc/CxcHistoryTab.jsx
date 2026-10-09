import { Search, Eye, Printer, Mail, Trash2 } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

const metodoBadge = (m) => {
    const map = {
        Efectivo: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        Transferencia: 'bg-blue-50 text-blue-700 border-blue-100',
        Cheque: 'bg-violet-50 text-violet-700 border-violet-100',
        Tarjeta: 'bg-amber-50 text-amber-700 border-amber-100',
    };
    return map[m] || 'bg-slate-50 text-slate-600 border-slate-100';
};

const CxcHistoryTab = ({
    histData,
    histSearch,
    onHistSearchChange,
    onViewPayment,
    onPrintPDF,
    onSendEmail,
    onDeletePayment,
}) => {
    const payments = histData?.payments || [];

    return (
        <div className="space-y-4 animate-in slide-in-from-right-2 duration-200">
            {/* Barra de búsqueda */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="BUSCAR EN HISTORIAL POR NÚMERO DE RECIBO O DOCUMENTO..." 
                        value={histSearch} 
                        onChange={e => onHistSearchChange(e.target.value)} 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold uppercase tracking-wider outline-none transition-all placeholder:text-slate-400" 
                    />
                </div>
            </div>

            {/* Tabla de historial compacta */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto text-xs">
                <table className="w-full text-left table-cards">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-2.5">Recibo</th>
                            <th className="px-4 py-2.5">Fecha</th>
                            <th className="px-4 py-2.5 whitespace-nowrap">Documento Afectado</th>
                            <th className="px-4 py-2.5 text-right">Monto</th>
                            <th className="px-4 py-2.5 text-center">Método</th>
                            <th className="px-4 py-2.5 text-right pr-6">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {payments.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition-colors text-[11px]">
                                <td className="px-4 py-2 font-mono font-bold text-indigo-600 tracking-tight" data-label="Recibo">
                                    REC-{String(p.id).padStart(5, '0')}
                                </td>
                                <td className="px-4 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap" data-label="Fecha">
                                    {formatDate(p.fecha_pago)}
                                </td>
                                <td className="px-4 py-2" data-label="Documento">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 uppercase leading-tight">
                                            {p.documento_afectado || 'ABONO GENERAL'}
                                        </span>
                                        {p.notas && (
                                            <span className="text-[9px] text-slate-400 uppercase truncate max-w-[200px]" title={p.notas}>
                                                {p.notas}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right font-black text-slate-900" data-label="Monto">
                                    <Money value={p.monto || 0} />
                                </td>
                                <td className="px-4 py-2 text-center" data-label="Método">
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${metodoBadge(p.metodo_pago)}`}>
                                        {p.metodo_pago}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-right pr-6" data-label="Acciones">
                                    <div className="flex items-center justify-end gap-1">
                                        <button 
                                            type="button"
                                            onClick={() => onViewPayment(p.id)} 
                                            title="Ver Detalle" 
                                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => onPrintPDF(p.id)} 
                                            title="Descargar PDF" 
                                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors"
                                        >
                                            <Printer size={14} />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => onSendEmail(p.id)} 
                                            title="Enviar por Correo" 
                                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"
                                        >
                                            <Mail size={14} />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => onDeletePayment(p.id)} 
                                            title="Eliminar Abono" 
                                            className="p-1.5 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {payments.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-16 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                                    No se encontraron abonos registrados para este cliente
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CxcHistoryTab;
