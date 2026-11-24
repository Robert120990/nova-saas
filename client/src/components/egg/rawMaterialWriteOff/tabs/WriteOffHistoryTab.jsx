import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, RotateCcw, Receipt, Layers, CheckCircle2, Ban } from 'lucide-react';
import Table from '../../../ui/Table';
import Pagination from '../../../ui/Pagination';
import Money from '../../../ui/Money';
import { useConfirm } from '../../../../context/ConfirmContext';
import { REASON_OPTIONS, REASON_MAP, formatLbs, lbsToKg } from '../constants';
import { unwrapList, unwrapPagination, getApiErrorMessage } from '../../../../utils/apiUtils';
import { formatDate, formatDateTime } from '../../../../utils/dateUtils';

export default function WriteOffHistoryTab({ onDataChanged }) {
    const confirm = useConfirm();
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [reasonFilter, setReasonFilter] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(15);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const { data: queryResult, isLoading, refetch } = useQuery({
        queryKey: ['egg-tarima-writeoffs', debouncedSearch, statusFilter, reasonFilter, page, limit],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit)
            });
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (statusFilter) params.append('status', statusFilter);
            if (reasonFilter) params.append('reason_type', reasonFilter);
            const res = await axios.get(`/api/egg-industrial/tarima-writeoffs?${params.toString()}`);
            return {
                items: unwrapList(res),
                pagination: unwrapPagination(res)
            };
        }
    });

    const revertMutation = useMutation({
        mutationFn: async (id) => {
            const res = await axios.put(`/api/egg-industrial/tarima-writeoffs/${id}/revert`, {
                revert_reason: 'Reversión manual desde panel de baja de tarimas'
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Baja revertida: las tarimas, cajas y libras fueron restauradas al lote.');
            refetch();
            onDataChanged?.();
        },
        onError: (err) => {
            toast.error(getApiErrorMessage(err, 'No se pudo revertir la baja.'));
        }
    });

    const handleRevert = async (row) => {
        const ok = await confirm({
            title: '¿Revertir baja de tarimas?',
            message: `Se restaurarán ${row.boxes_count} cajas (${formatLbs(row.quantity_lbs)} lbs) al lote ${row.provider_lot || '#' + row.raw_material_id} y volverán a quedar disponibles para producción o facturación.`,
            confirmLabel: 'Sí, revertir baja',
            cancelLabel: 'Cancelar',
            variant: 'warning'
        });
        if (ok) revertMutation.mutate(row.id);
    };

    const rows = Array.isArray(queryResult?.items) ? queryResult.items : [];
    const pagination = queryResult?.pagination || { total: 0, page: 1, totalPages: 1 };

    const headers = [
        { label: 'Fecha / Hora', sortKey: 'created_at', sortType: 'date' },
        { label: 'Factura / Cliente', sortKey: 'invoice_number', sortType: 'text' },
        { label: 'Monto Factura', sortKey: 'invoice_total', sortType: 'number', className: 'text-right' },
        { label: 'Lote Huevo', sortKey: 'provider_lot', sortType: 'text' },
        { label: 'Tarimas / Cantidad', sortKey: 'boxes_count', sortType: 'number' },
        { label: 'Motivo', sortKey: 'reason_type', sortType: 'text' },
        { label: 'Estado', sortKey: 'status', sortType: 'text' },
        { label: 'Acciones', className: 'text-right' }
    ];

    const renderTarimaBadges = (tarimas) => {
        const list = Array.isArray(tarimas) ? tarimas : [];
        const visible = list.slice(0, 5);
        const remaining = list.length - visible.length;
        return (
            <div className="flex flex-wrap gap-1 mt-1">
                {visible.map((t, idx) => (
                    <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700"
                    >
                        #{String(t.tarima_number).padStart(2, '0')} ({t.boxes_count}c)
                    </span>
                ))}
                {remaining > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        +{remaining} más
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row gap-3 md:items-center justify-between">
                <div className="relative flex-1 min-w-0">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por factura DTE, cliente, lote proveedor u operador..."
                        className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={reasonFilter}
                        onChange={(e) => {
                            setReasonFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                    >
                        <option value="">Todos los motivos</option>
                        {REASON_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.shortLabel}</option>
                        ))}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                    >
                        <option value="">Todos los estados</option>
                        <option value="activo">Activos</option>
                        <option value="revertido">Revertidos</option>
                    </select>
                </div>
            </div>

            {/* Tabla Ordenable + Cards en Móvil */}
            <Table
                headers={headers}
                data={rows}
                isLoading={isLoading}
                emptyMessage="Aún no hay bajas de tarimas ni vinculaciones con facturas registradas."
                renderCard={(row) => {
                    const reasonInfo = REASON_MAP[row.reason_type] || REASON_MAP.otro;
                    const isActive = row.status === 'activo';
                    return (
                        <div className="space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 font-mono break-all">
                                        {row.invoice_number || 'Sin Factura'}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-600 truncate">
                                        {row.customer_name || 'Uso Interno / Ajuste'}
                                    </p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                    isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                    {isActive ? 'Activo' : 'Revertido'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>Lote: <strong className="text-slate-900">{row.provider_lot || `#${row.raw_material_id}`}</strong></span>
                                <Money value={row.invoice_total} className="font-black text-indigo-700" />
                            </div>
                            <div className="text-xs font-bold text-slate-800">
                                {row.tarimas_count} tar. · {row.boxes_count} cajas · {formatLbs(row.quantity_lbs)} lbs ({lbsToKg(row.quantity_lbs)} Kg)
                                {renderTarimaBadges(row.tarimas)}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 gap-2">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${reasonInfo.badgeClass}`}>
                                    {reasonInfo.shortLabel}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400">{formatDate(row.created_at)}</span>
                                    {isActive && (
                                        <button
                                            type="button"
                                            disabled={revertMutation.isPending}
                                            onClick={() => handleRevert(row)}
                                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1"
                                        >
                                            <RotateCcw size={12} /> Revertir
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }}
                renderRow={(row) => {
                    const reasonInfo = REASON_MAP[row.reason_type] || REASON_MAP.otro;
                    const isActive = row.status === 'activo';
                    return (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-xs font-bold text-slate-800">{formatDateTime(row.created_at)}</p>
                                <p className="text-[11px] text-slate-400">{row.operator_name || 'Operador'}</p>
                            </td>
                            <td className="px-4 py-3 max-w-[260px]">
                                {row.invoice_number ? (
                                    <div className="flex items-center gap-1.5">
                                        <Receipt size={13} className="text-indigo-500 shrink-0" />
                                        <span className="text-xs font-bold font-mono text-slate-900 truncate" title={row.invoice_number}>
                                            {row.invoice_number}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">Sin factura vinculada</span>
                                )}
                                <p className="text-[11px] font-medium text-slate-600 truncate mt-0.5">
                                    {row.customer_name || '—'}
                                    {row.invoice_date ? ` · ${formatDate(row.invoice_date)}` : ''}
                                </p>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                {row.invoice_number ? (
                                    <Money value={row.invoice_total} className="text-xs font-black text-slate-900" />
                                ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-xs font-black text-slate-900">{row.provider_lot || `Lote #${row.raw_material_id}`}</p>
                                <p className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                    {row.provider_name || 'Proveedor'} · <span className="capitalize">{row.egg_type || ''}</span>
                                </p>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 whitespace-nowrap">
                                    <Layers size={13} className="text-amber-600 shrink-0" />
                                    <span>{row.tarimas_count} tar. · {row.boxes_count} cjs · {formatLbs(row.quantity_lbs)} lbs</span>
                                </div>
                                <span className="text-[10px] text-slate-400 block">{lbsToKg(row.quantity_lbs)} Kg</span>
                                {renderTarimaBadges(row.tarimas)}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border whitespace-nowrap ${reasonInfo.badgeClass}`}>
                                    {reasonInfo.shortLabel}
                                </span>
                                {row.notes && (
                                    <p className="text-[11px] text-slate-500 mt-1 max-w-[180px] truncate" title={row.notes}>
                                        {row.notes}
                                    </p>
                                )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                {isActive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                        <CheckCircle2 size={11} /> Activo
                                    </span>
                                ) : (
                                    <div>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold">
                                            <Ban size={11} /> Revertido
                                        </span>
                                        {row.reverted_by_name && (
                                            <p className="text-[10px] text-slate-400 mt-0.5">por {row.reverted_by_name}</p>
                                        )}
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                {isActive ? (
                                    <button
                                        type="button"
                                        disabled={revertMutation.isPending}
                                        onClick={() => handleRevert(row)}
                                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                                        title="Revertir esta baja y devolver las tarimas al inventario"
                                    >
                                        <RotateCcw size={12} /> Revertir
                                    </button>
                                ) : (
                                    <span className="text-[11px] text-slate-300 font-medium">—</span>
                                )}
                            </td>
                        </tr>
                    );
                }}
            />

            <Pagination
                currentPage={pagination.page || page}
                totalPages={pagination.totalPages || 1}
                totalItems={pagination.total || 0}
                itemsOnPage={rows.length}
                limit={limit}
                onLimitChange={(nextLimit) => {
                    setLimit(nextLimit);
                    setPage(1);
                }}
                onPageChange={setPage}
                isLoading={isLoading}
            />
        </div>
    );
}
