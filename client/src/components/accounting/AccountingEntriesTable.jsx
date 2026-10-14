import { useState, useEffect } from 'react';
import { Eye, Edit, Ban, Printer } from 'lucide-react';
import Table from '../ui/Table';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';
import { useConfirm } from '../../context/ConfirmContext';

const tableHeaders = [
    { label: 'Número', className: 'w-28 px-3' },
    { label: 'Fecha', className: 'w-24 px-2' },
    { label: 'Tipo', className: 'w-32 px-2' },
    { label: 'Descripción', className: 'px-2' },
    { label: 'Débito', className: 'w-28 px-2 text-right' },
    { label: 'Crédito', className: 'w-28 px-2 text-right' },
    { label: 'Estado', className: 'w-24 px-2 text-center' },
    { label: '', className: 'w-24 px-2 text-right' },
];

const AccountingEntriesTable = ({
    entries,
    isLoading,
    onView,
    onEdit,
    onVoid,
    onPrint
}) => {
    const confirm = useConfirm();
    const [printDropdownId, setPrintDropdownId] = useState(null);

    useEffect(() => {
        if (!printDropdownId) return;
        const handleClick = () => setPrintDropdownId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [printDropdownId]);

    const handleConfirmVoid = async (entry) => {
        const ok = await confirm({
            title: 'Anular Partida',
            message: `¿Está seguro de anular la partida #${entry.number || ''}?`,
            confirmLabel: 'Anular'
        });
        if (ok) onVoid(entry);
    };

    return (
        <Table
            headers={tableHeaders}
            data={entries}
            isLoading={isLoading}
            compact
            noHorizontalScroll
            tableClassName="table-fixed w-full"
            renderCard={(e) => (
                <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{e.number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            e.status === 'posted'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : e.status === 'voided'
                                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                            {e.status === 'posted' ? 'Contabilizado' : e.status === 'voided' ? 'Anulado' : 'Borrador'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{formatDate(e.date)}</span>
                        <span className="font-medium text-slate-700">{e.entry_type_name}</span>
                    </div>
                    {e.description && (
                        <p className="text-slate-600 text-[11px] line-clamp-2" title={e.description}>{e.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 font-mono text-[11px]">
                        <span className="text-emerald-600 font-bold">Débito: <Money value={e.total_debit} /></span>
                        <span className="text-rose-600 font-bold">Crédito: <Money value={e.total_credit} /></span>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 flex-wrap">
                        <button onClick={() => onView(e)} className="p-1 text-slate-500 hover:text-indigo-600 text-[11px] flex items-center gap-1 font-semibold">
                            <Eye size={13} /> Ver
                        </button>
                        <button onClick={() => onPrint(e, 'normal')} className="p-1 text-slate-500 hover:text-indigo-600 text-[11px] flex items-center gap-1 font-semibold">
                            <Printer size={13} /> Normal
                        </button>
                        <button onClick={() => onPrint(e, 'mayorizada')} className="p-1 text-slate-500 hover:text-indigo-600 text-[11px] flex items-center gap-1 font-semibold">
                            <Printer size={13} /> Mayorizada
                        </button>
                        <button onClick={() => onEdit(e)} className="p-1 text-slate-500 hover:text-amber-600 text-[11px] flex items-center gap-1 font-semibold">
                            <Edit size={13} /> Editar
                        </button>
                        {e.status === 'posted' && (
                            <button
                                onClick={() => handleConfirmVoid(e)}
                                className="p-1 text-slate-500 hover:text-rose-600 text-[11px] flex items-center gap-1 font-semibold"
                            >
                                <Ban size={13} /> Anular
                            </button>
                        )}
                    </div>
                </div>
            )}
            renderRow={(e) => (
                <tr key={e.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-3 py-1 font-mono font-bold text-[11px] text-slate-900 truncate" title={e.number}>{e.number}</td>
                    <td className="px-2 py-1 text-[11px] text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-2 py-1 text-[11px] font-semibold text-slate-700 truncate" title={e.entry_type_name}>{e.entry_type_name}</td>
                    <td className="px-2 py-1 text-[11px] text-slate-600 truncate" title={e.description}>{e.description}</td>
                    <td className="px-2 py-1 font-bold text-[11px] text-emerald-600 font-mono text-right whitespace-nowrap"><Money value={e.total_debit} /></td>
                    <td className="px-2 py-1 font-bold text-[11px] text-rose-600 font-mono text-right whitespace-nowrap"><Money value={e.total_credit} /></td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            e.status === 'posted'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : e.status === 'voided'
                                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                            {e.status === 'posted' ? 'Contabilizado' : e.status === 'voided' ? 'Anulado' : 'Borrador'}
                        </span>
                    </td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-0.5 relative">
                            <button aria-label="Ver partida" onClick={() => onView(e)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Ver partida">
                                <Eye size={13} />
                            </button>
                            <div className="relative inline-block">
                                <button
                                    type="button"
                                    aria-label="Imprimir póliza"
                                    onClick={(evt) => {
                                        evt.stopPropagation();
                                        setPrintDropdownId(printDropdownId === e.id ? null : e.id);
                                    }}
                                    className={`p-1 rounded transition-colors ${printDropdownId === e.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    title="Imprimir póliza"
                                >
                                    <Printer size={13} />
                                </button>
                                {printDropdownId === e.id && (
                                    <div
                                        onClick={(evt) => evt.stopPropagation()}
                                        className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-left animate-in fade-in zoom-in-95"
                                    >
                                        <div className="px-3 py-1 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 mb-1">
                                            Modalidad
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPrintDropdownId(null);
                                                onPrint(e, 'normal');
                                            }}
                                            className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-bold flex items-center gap-2"
                                        >
                                            <span>Normal (Detallada)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPrintDropdownId(null);
                                                onPrint(e, 'mayorizada');
                                            }}
                                            className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-bold flex items-center gap-2"
                                        >
                                            <span>Mayorizada (4 Dígitos)</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button aria-label="Editar partida" onClick={() => onEdit(e)} className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Editar partida">
                                <Edit size={13} />
                            </button>
                            {e.status === 'posted' && (
                                <button
                                    onClick={() => handleConfirmVoid(e)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                    title="Anular partida"
                                >
                                    <Ban size={13} />
                                </button>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        />
    );
};

export default AccountingEntriesTable;
