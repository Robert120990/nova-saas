import { Eye, FilterX, RotateCcw, CheckCheck } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money, { MoneyInput } from '../ui/Money';

const getTipoBadge = (tipo = '') => {
    const t = tipo.toUpperCase();
    if (t.includes('CRÉDITO FISCAL') || t.includes('CCF') || t === '03') {
        return { label: 'CCF', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    if (t.includes('FACTURA') || t.includes('CMP') || t === '01') {
        return { label: 'FCF', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (t.includes('NOTA DE CRÉDITO') || t === '05') {
        return { label: 'NC', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    if (t.includes('VALE') || t.includes('TURNO') || t.includes('CRÉDITO TURNO')) {
        return { label: 'VALE', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'DOC', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
};

const CxcPendingDocumentsTable = ({
    docRows = [],
    onAbonoChange,
    onAbonoBlur,
    onFillAllSaldo,
    onClearAllAbonos,
    onViewDetails,
}) => {
    const totalSaldoPendiente = docRows.reduce(
        (acc, r) => acc + (parseFloat(r.originalSaldo || r.saldo_pendiente || 0) || 0),
        0
    );

    const totalAbonado = docRows.reduce(
        (acc, r) => acc + (parseFloat(r.abono || 0) || 0),
        0
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
            {/* Barra superior de estado / resumen compacto */}
            <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                        Documentos: <strong className="text-slate-800 text-xs font-black">{docRows.length}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                        Saldo Pendiente: <strong className="text-slate-900 text-xs font-black"><Money value={totalSaldoPendiente} /></strong>
                    </span>
                    {totalAbonado > 0 && (
                        <>
                            <span className="text-slate-300">|</span>
                            <span className="font-bold text-indigo-600 uppercase text-[10px] tracking-wider">
                                Total Asignado: <strong className="text-indigo-700 text-xs font-black"><Money value={totalAbonado} /></strong>
                            </span>
                        </>
                    )}
                </div>

                {docRows.some(r => parseFloat(r.abono || 0) > 0) && (
                    <button
                        type="button"
                        onClick={onClearAllAbonos}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-all shadow-2xs"
                        title="Limpiar todos los abonos asignados"
                    >
                        <RotateCcw size={12} />
                        Limpiar Abonos
                    </button>
                )}
            </div>

            {/* Contenedor scrolleable con cabecera sticky y densidad compacta */}
            <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs table-cards">
                    <thead className="bg-slate-100/90 backdrop-blur sticky top-0 z-10 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                            <th className="px-3.5 py-2.5">Documento</th>
                            <th className="px-3 py-2.5">Fecha</th>
                            <th className="px-3 py-2.5 text-right whitespace-nowrap">Monto Orig.</th>
                            <th className="px-3 py-2.5 text-right whitespace-nowrap">Saldo Pendiente</th>
                            <th className="px-3 py-2.5 text-right pr-6">Abono</th>
                            <th className="px-2 py-2.5 text-center w-10">Info</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {docRows.map((d, i) => {
                            const badge = getTipoBadge(d.tipo);
                            const saldo = Math.round(parseFloat(d.originalSaldo || d.saldo_pendiente || 0) * 100) / 100;
                            const isPaid = parseFloat(d.abono || 0) > 0 && Math.abs(parseFloat(d.abono) - saldo) < 0.001;

                            return (
                                <tr 
                                    key={d.id} 
                                    className={`transition-colors text-[11px] ${
                                        isPaid 
                                            ? 'bg-emerald-50/30 hover:bg-emerald-50/50' 
                                            : parseFloat(d.abono || 0) > 0
                                                ? 'bg-indigo-50/20 hover:bg-indigo-50/40'
                                                : 'hover:bg-slate-50/70'
                                    }`}
                                >
                                    {/* Documento con badge compacto y número */}
                                    <td className="px-3.5 py-2" data-label="Documento">
                                        <div className="flex items-center gap-2">
                                            <span 
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${badge.cls}`}
                                                title={d.tipo}
                                            >
                                                {badge.label}
                                            </span>
                                            <span className="font-bold text-slate-800 font-mono tracking-tight">
                                                #{d.documento || d.id}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Fecha emisión */}
                                    <td className="px-3 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap" data-label="Fecha">
                                        {formatDate(d.fecha)}
                                    </td>

                                    {/* Monto Original */}
                                    <td className="px-3 py-2 text-right text-slate-500 font-medium whitespace-nowrap" data-label="Monto Orig.">
                                        <Money value={d.total_original || 0} />
                                    </td>

                                    {/* Saldo Pendiente (Clickable para pagar completo) */}
                                    <td className="px-3 py-2 text-right whitespace-nowrap" data-label="Saldo Pendiente">
                                        <button
                                            type="button"
                                            onClick={() => onFillAllSaldo && onFillAllSaldo(i, saldo)}
                                            className="group/btn inline-flex items-center gap-1 font-black text-slate-900 hover:text-indigo-600 transition-colors"
                                            title="Clic para abonar el saldo completo de este documento"
                                        >
                                            <Money value={saldo} />
                                            <CheckCheck size={11} className="opacity-0 group-hover/btn:opacity-100 text-indigo-500 transition-opacity" />
                                        </button>
                                    </td>

                                    {/* Input de Abono con soporte decimal exacto */}
                                    <td className="px-3 py-1.5 text-right pr-6" data-label="Abono">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="text-[10px] font-bold text-slate-300">$</span>
                                            <MoneyInput 
                                                type="text"
                                                inputMode="decimal"
                                                value={d.abono || ''} 
                                                onChange={e => onAbonoChange(i, e.target.value)} 
                                                onBlur={() => onAbonoBlur && onAbonoBlur(i)}
                                                placeholder="0.00"
                                                className="w-28 px-2.5 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg text-right font-black text-xs text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all" 
                                            />
                                        </div>
                                    </td>

                                    {/* Botón de detalle */}
                                    <td className="px-2 py-1.5 text-center" data-label="">
                                        <button 
                                            type="button"
                                            onClick={() => onViewDetails(d)} 
                                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Ver detalles completos"
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {docRows.length === 0 && (
                            <tr>
                                <td colSpan="6" className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <FilterX size={36} className="text-slate-300" />
                                        <p className="text-xs font-bold uppercase tracking-wider">Sin documentos pendientes</p>
                                        <p className="text-[10px] text-slate-400">Seleccione una sucursal y un cliente para cargar sus cuentas por cobrar.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CxcPendingDocumentsTable;
