import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Search, Receipt, CheckCircle2, RefreshCw, Egg, FileEdit } from 'lucide-react';
import Money from '../../ui/Money';
import { unwrapList } from '../../../utils/apiUtils';
import { formatDate } from '../../../utils/dateUtils';

export default function InvoicePickerSection({
    mode,
    setMode,
    selectedInvoice,
    onSelectInvoice,
    manualInvoice,
    setManualInvoice
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [onlyShellEggs, setOnlyShellEggs] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ['egg-writeoff-invoices', debouncedSearch, onlyShellEggs],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (onlyShellEggs) params.append('only_shell_eggs', 'true');
            params.append('limit', '25');
            const res = await axios.get(`/api/egg-industrial/tarima-writeoffs/invoices?${params.toString()}`);
            return unwrapList(res);
        },
        enabled: mode === 'system'
    });

    const safeInvoices = Array.isArray(invoices) ? invoices : [];

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Factura de Venta a Vincular
                </label>
                <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 self-start">
                    <button
                        type="button"
                        onClick={() => setMode('system')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                            mode === 'system'
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Receipt size={12} /> Factura del Sistema
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode('manual');
                            onSelectInvoice(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                            mode === 'manual'
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <FileEdit size={12} /> Referencia Manual
                    </button>
                </div>
            </div>

            {mode === 'manual' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Número de Factura / DTE *
                        </label>
                        <input
                            type="text"
                            value={manualInvoice.invoice_number}
                            onChange={(e) => setManualInvoice((prev) => ({ ...prev, invoice_number: e.target.value }))}
                            placeholder="Ej. DTE-03-M001P001-000000000002421"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Cliente / Destinatario
                        </label>
                        <input
                            type="text"
                            value={manualInvoice.customer_name}
                            onChange={(e) => setManualInvoice((prev) => ({ ...prev, customer_name: e.target.value }))}
                            placeholder="Nombre del cliente"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                    </div>
                </div>
            ) : selectedInvoice ? (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                            <CheckCircle2 size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-indigo-950 font-mono break-all">
                                        {selectedInvoice.invoice_label}
                                    </span>
                                    {selectedInvoice.dte_type && (
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                            DTE-{selectedInvoice.dte_type}
                                        </span>
                                    )}
                                    {selectedInvoice.is_shell_egg && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold inline-flex items-center gap-1">
                                            <Egg size={10} /> Huevo Cáscara
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                                    {selectedInvoice.customer_name} &bull; {formatDate(selectedInvoice.fecha_emision)} &bull;{' '}
                                    <Money value={selectedInvoice.total_pagar} className="font-black text-slate-900" />
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onSelectInvoice(null)}
                            className="px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors shrink-0 self-start sm:self-center"
                        >
                            Cambiar Factura
                        </button>
                    </div>
                    {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 && (
                        <div className="pt-2 border-t border-indigo-200/60 flex flex-wrap gap-1.5">
                            {selectedInvoice.items.map((it, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-lg bg-white border border-indigo-200/80 text-[11px] font-semibold text-slate-700"
                                >
                                    {it.cantidad}x {it.descripcion}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por N° control DTE, cliente o producto (ej. Huevo en cáscara)..."
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setOnlyShellEggs((v) => !v)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 shrink-0 ${
                                onlyShellEggs
                                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Egg size={14} /> Solo Huevo Cáscara
                        </button>
                    </div>

                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                        {isLoading ? (
                            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
                                <RefreshCw size={15} className="animate-spin text-indigo-500" /> Buscando facturas...
                            </div>
                        ) : safeInvoices.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No se encontraron facturas con los criterios indicados.
                            </div>
                        ) : (
                            safeInvoices.map((inv) => (
                                <button
                                    key={inv.id}
                                    type="button"
                                    onClick={() => onSelectInvoice(inv)}
                                    className="w-full text-left p-2.5 sm:p-3 hover:bg-indigo-50/50 transition-colors flex flex-col gap-1"
                                >
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                            <span className="text-xs font-bold font-mono text-slate-900 break-all">
                                                {inv.invoice_label}
                                            </span>
                                            {inv.is_shell_egg && (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                                    Cáscara
                                                </span>
                                            )}
                                            {inv.linked_boxes > 0 && (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                                    Ya vinculadas: {inv.linked_boxes} cjs
                                                </span>
                                            )}
                                        </div>
                                        <Money value={inv.total_pagar} className="text-xs font-black text-indigo-700 shrink-0" />
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                        <span className="font-semibold text-slate-700 truncate">{inv.customer_name}</span>
                                        <span className="shrink-0">{formatDate(inv.fecha_emision)}</span>
                                    </div>
                                    {Array.isArray(inv.items) && inv.items.length > 0 && (
                                        <p className="text-[11px] text-slate-500 truncate">
                                            {inv.items.map((it) => `${it.cantidad}x ${it.descripcion}`).join(' · ')}
                                        </p>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
