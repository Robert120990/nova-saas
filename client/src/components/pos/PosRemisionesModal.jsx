import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Truck, X, Search, Check, FileText, ChevronDown, ChevronUp,
    Package, RefreshCw, AlertCircle
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

const PosRemisionesModal = ({
    isOpen,
    onClose,
    currentCustomerId,
    onLoadRemisiones
}) => {
    const [search, setSearch] = useState('');
    const [filterByCustomer, setFilterByCustomer] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [expandedIds, setExpandedIds] = useState(new Set());

    const {
        data: remisiones = [],
        isLoading,
        isFetching,
        refetch
    } = useQuery({
        queryKey: ['pos-pending-remisiones', currentCustomerId, filterByCustomer, search],
        queryFn: async () => {
            const res = await axios.get('/api/sales/remisiones/pending', {
                params: {
                    customer_id: (filterByCustomer && currentCustomerId) ? currentCustomerId : undefined,
                    search: search.trim() || undefined
                }
            });
            return res.data?.data || [];
        },
        enabled: isOpen
    });

    // Reset selección al abrir
    const handleClose = () => {
        setSelectedIds(new Set());
        setExpandedIds(new Set());
        setSearch('');
        onClose();
    };

    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === remisiones.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(remisiones.map(r => r.id)));
        }
    };

    const toggleExpand = (id, e) => {
        e.stopPropagation();
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const selectedRemisiones = useMemo(() => {
        return remisiones.filter(r => selectedIds.has(r.id));
    }, [remisiones, selectedIds]);

    const totalSelectedAmount = useMemo(() => {
        return selectedRemisiones.reduce((sum, r) => sum + parseFloat(r.total_pagar || 0), 0);
    }, [selectedRemisiones]);

    const totalSelectedItems = useMemo(() => {
        return selectedRemisiones.reduce((sum, r) => sum + (r.items?.length || 0), 0);
    }, [selectedRemisiones]);

    const handleConfirm = () => {
        if (selectedRemisiones.length === 0) return;
        onLoadRemisiones(selectedRemisiones);
        handleClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs">
                            <Truck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800 tracking-tight">
                                Notas de Remisión Pendientes de Facturar
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Seleccione las notas de remisión (DTE-04) para cargar sus partidas a la venta actual
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Recargar remisiones"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            placeholder="Buscar por cliente, control, código gen..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full text-xs font-medium border border-slate-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        {currentCustomerId && (
                            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 font-bold">
                                <input
                                    type="checkbox"
                                    checked={filterByCustomer}
                                    onChange={(e) => setFilterByCustomer(e.target.checked)}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                />
                                <span>Solo del cliente actual en POS</span>
                            </label>
                        )}

                        {remisiones.length > 0 && (
                            <button
                                type="button"
                                onClick={toggleSelectAll}
                                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
                            >
                                {selectedIds.size === remisiones.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                            </button>
                        )}
                    </div>
                </div>

                {/* List / Table */}
                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {isLoading ? (
                        <div className="py-16 text-center text-slate-400 text-xs">
                            Cargando notas de remisión pendientes...
                        </div>
                    ) : remisiones.length === 0 ? (
                        <div className="py-16 text-center space-y-2">
                            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="text-xs font-bold text-slate-600">
                                No hay notas de remisión pendientes de facturar.
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                                Todas las notas de remisión emitidas ya han sido facturadas o no coinciden con los filtros de búsqueda.
                            </p>
                        </div>
                    ) : (
                        remisiones.map((rem) => {
                            const isSelected = selectedIds.has(rem.id);
                            const isExpanded = expandedIds.has(rem.id);
                            const items = rem.items || [];

                            return (
                                <div
                                    key={rem.id}
                                    onClick={() => toggleSelect(rem.id)}
                                    className={`rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                                        isSelected
                                            ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500'
                                            : 'border-slate-200/80 bg-white hover:border-slate-300'
                                    }`}
                                >
                                    <div className="p-3.5 sm:p-4 flex items-start gap-3 justify-between">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {}} // Manejado por onClick del contenedor
                                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
                                            />
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-xs text-slate-800">
                                                        {rem.customer_name}
                                                    </span>
                                                    {rem.customer_nrc && (
                                                        <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                                                            NRC: {rem.customer_nrc}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                                        {rem.numero_control || 'Sin control'}
                                                    </span>
                                                </div>

                                                <p className="text-[11px] text-slate-500 font-mono">
                                                    Fecha: <strong>{formatDate(rem.fecha_emision)}</strong> • Cód. Gen: {rem.codigo_generacion?.slice(0, 18)}...
                                                </p>

                                                {rem.observaciones && (
                                                    <p className="text-[11px] text-slate-400 italic">
                                                        {rem.observaciones}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total</span>
                                                <span className="text-sm font-black text-slate-900 font-mono">
                                                    <Money value={rem.total_pagar || 0} />
                                                </span>
                                                <span className="text-[10px] text-slate-400 block">
                                                    {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => toggleExpand(rem.id, e)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                                                title="Ver detalle de productos"
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Detalle desplegable de partidas */}
                                    {isExpanded && (
                                        <div className="bg-slate-50 p-3 border-t border-slate-100 text-xs space-y-1.5">
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                                Partidas de la Remisión:
                                            </span>
                                            <div className="divide-y divide-slate-200/60 max-h-40 overflow-y-auto">
                                                {items.map((it, idx) => (
                                                    <div key={idx} className="py-1.5 flex items-center justify-between text-[11px]">
                                                        <div className="flex items-center gap-2">
                                                            <Package className="w-3.5 h-3.5 text-slate-400" />
                                                            <span className="font-bold text-slate-700">{it.descripcion || it.producto_nombre}</span>
                                                            {it.codigo && <span className="text-[10px] text-slate-400 font-mono">[{it.codigo}]</span>}
                                                        </div>
                                                        <div className="flex items-center gap-3 font-mono">
                                                            <span className="font-semibold text-slate-600">Cant: {parseFloat(it.cantidad || 0)}</span>
                                                            <span className="text-slate-500">P.U: <Money value={it.precio_unitario || 0} /></span>
                                                            <span className="font-bold text-slate-800"><Money value={it.venta_gravada || it.venta_exenta || (it.cantidad * it.precio_unitario) || 0} /></span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
                    <div className="text-xs text-slate-600">
                        {selectedIds.size > 0 ? (
                            <span>
                                Seleccionadas: <strong>{selectedIds.size}</strong> remisión(es) • <strong>{totalSelectedItems}</strong> productos • Total: <strong><Money value={totalSelectedAmount} /></strong>
                            </span>
                        ) : (
                            <span className="text-slate-400">Seleccione al menos una nota de remisión para facturar</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            disabled={selectedIds.size === 0}
                            onClick={handleConfirm}
                            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            <span>Cargar a Facturación ({selectedIds.size})</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PosRemisionesModal;
