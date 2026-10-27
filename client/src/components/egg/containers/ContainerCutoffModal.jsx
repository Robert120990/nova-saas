import { useState, useEffect, useMemo } from 'react';
import { X, Scissors, CalendarRange, CheckCircle2, Calculator } from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

export default function ContainerCutoffModal({
    open,
    onClose,
    onConfirm,
    containers = [],
    cutoffChain = {},
    periodStart = '',
    periodEnd = '',
    setPeriodStart,
    setPeriodEnd,
    customerName = '',
    setCustomerName,
    isSubmitting = false
}) {
    const [notes, setNotes] = useState('');
    const [keepActiveRunning, setKeepActiveRunning] = useState(true);
    const [localDays, setLocalDays] = useState({});

    const hasPrev = Boolean(cutoffChain?.has_previous_cutoff);

    useEffect(() => {
        if (!open) return;
        const map = {};
        (Array.isArray(containers) ? containers : []).forEach((c) => {
            map[c.id] = String(c.days_on ?? 0);
        });
        setLocalDays(map);
        setNotes('');
        setKeepActiveRunning(true);
    }, [open, containers]);

    const periodSpanDays = useMemo(() => {
        if (!periodStart || !periodEnd) return 0;
        const s = new Date(`${periodStart}T00:00:00`).getTime();
        const e = new Date(`${periodEnd}T00:00:00`).getTime();
        if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
        return Math.max(1, Math.round((e - s) / 86400000));
    }, [periodStart, periodEnd]);

    const computedRows = useMemo(() => {
        return (Array.isArray(containers) ? containers : []).map((c) => {
            const raw = localDays[c.id] !== undefined ? localDays[c.id] : c.days_on;
            const days = Math.max(0, parseFloat(raw) || 0);
            const rate = parseFloat(c.daily_rate || 195);
            const subtotal = +(days * rate).toFixed(2);
            const iva = +(subtotal * 0.13).toFixed(2);
            const total = +(subtotal + iva).toFixed(2);
            return {
                ...c,
                modal_days: days,
                modal_subtotal: subtotal,
                modal_iva: iva,
                modal_total: total
            };
        });
    }, [containers, localDays]);

    const totals = useMemo(() => {
        const totalDays = +computedRows.reduce((s, r) => s + r.modal_days, 0).toFixed(2);
        const subtotal = +computedRows.reduce((s, r) => s + r.modal_subtotal, 0).toFixed(2);
        const iva = +computedRows.reduce((s, r) => s + r.modal_iva, 0).toFixed(2);
        const total = +computedRows.reduce((s, r) => s + r.modal_total, 0).toFixed(2);
        const billedCount = computedRows.filter((r) => r.modal_days > 0).length;
        return { totalDays, subtotal, iva, total, billedCount };
    }, [computedRows]);

    if (!open) return null;

    const handleApplySpanToActive = () => {
        const next = { ...localDays };
        (Array.isArray(containers) ? containers : []).forEach((c) => {
            if (c.is_active_power) {
                next[c.id] = String(periodSpanDays);
            }
        });
        setLocalDays(next);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const items_override = computedRows.map((r) => ({
            container_id: r.id,
            days_on: r.modal_days
        }));
        onConfirm({
            period_start: periodStart,
            period_end: periodEnd,
            customer_name: customerName,
            notes,
            keep_active_running: keepActiveRunning,
            lock_to_last_cutoff: hasPrev,
            items_override
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Cabecera del Modal */}
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                            <Scissors size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">
                                Realizar Corte por Fechas y Emitir Estado de Cuenta
                            </h3>
                            <p className="text-[11px] text-slate-500">
                                {hasPrev
                                    ? `Este corte parte desde el último corte realizado (${cutoffChain.last_cutoff_code} • ${formatDate(cutoffChain.last_cutoff_date)})`
                                    : 'Primer corte por fechas registrado en el sistema'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Cuerpo del Modal */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Banner de continuidad desde el último corte */}
                    <div className="rounded-xl bg-indigo-50/90 border border-indigo-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-indigo-950 font-semibold">
                            <CalendarRange size={16} className="text-indigo-600 shrink-0" />
                            <span>
                                Período del Estado de Cuenta:{' '}
                                <strong className="font-black text-indigo-700">
                                    {formatDate(periodStart)}
                                </strong>{' '}
                                al{' '}
                                <strong className="font-black text-indigo-700">
                                    {formatDate(periodEnd)}
                                </strong>{' '}
                                ({periodSpanDays} {periodSpanDays === 1 ? 'día' : 'días'})
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleApplySpanToActive}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                            <Calculator size={12} />
                            <span>Asignar {periodSpanDays}d a encendidos</span>
                        </button>
                    </div>

                    {/* Fechas y Cliente */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Desde {hasPrev ? '(Último Corte)' : ''}
                            </label>
                            <input
                                type="date"
                                value={periodStart}
                                disabled={hasPrev}
                                onChange={(e) => setPeriodStart(e.target.value)}
                                className={`w-full px-3 py-2 border rounded-xl text-[13px] font-bold ${
                                    hasPrev
                                        ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-50 border-slate-300 text-slate-900'
                                }`}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Hasta (Fecha de este Corte)
                            </label>
                            <input
                                type="date"
                                min={periodStart}
                                value={periodEnd}
                                onChange={(e) => setPeriodEnd(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-slate-900"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Cliente / Destinatario
                            </label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Nombre del cliente..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium text-slate-900"
                            />
                        </div>
                    </div>

                    {/* Tabla rápida de revisión de días por contenedor para el Estado de Cuenta */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 uppercase">
                                Detalle de Contenedores en este Corte ({totals.billedCount} con cobro)
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                                Puede ajustar los días antes de confirmar el corte
                            </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase">
                                        <th className="py-2 px-3">Contenedor</th>
                                        <th className="py-2 px-3">Estado</th>
                                        <th className="py-2 px-3 text-center w-28">Días a Cobrar</th>
                                        <th className="py-2 px-3 text-right">Tarifa/Día</th>
                                        <th className="py-2 px-3 text-right">Subtotal</th>
                                        <th className="py-2 px-3 text-right">IVA 13%</th>
                                        <th className="py-2 px-3 text-right">Total + IVA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {computedRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className={row.modal_days > 0 ? 'bg-cyan-50/30' : 'hover:bg-slate-50'}
                                        >
                                            <td className="py-2 px-3 font-bold text-slate-900">
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 mr-1.5">
                                                    {row.code}
                                                </span>
                                                {row.name}
                                            </td>
                                            <td className="py-2 px-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        row.is_active_power
                                                            ? 'bg-cyan-100 text-cyan-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}
                                                >
                                                    {row.is_active_power ? 'Encendido' : 'Disponible'}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-3 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={localDays[row.id] ?? row.days_on}
                                                    onChange={(e) =>
                                                        setLocalDays((prev) => ({
                                                            ...prev,
                                                            [row.id]: e.target.value
                                                        }))
                                                    }
                                                    className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs font-black text-slate-900"
                                                />
                                            </td>
                                            <td className="py-2 px-3 text-right text-slate-600">
                                                <Money value={row.daily_rate} />
                                            </td>
                                            <td className="py-2 px-3 text-right font-semibold text-slate-800">
                                                <Money value={row.modal_subtotal} />
                                            </td>
                                            <td className="py-2 px-3 text-right text-amber-700">
                                                <Money value={row.modal_iva} />
                                            </td>
                                            <td className="py-2 px-3 text-right font-black text-emerald-700">
                                                <Money value={row.modal_total} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Observaciones y Continuidad del siguiente período */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                                Observaciones del Estado de Cuenta
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ej. Corte quincenal / mensual de almacenamiento..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
                            />
                        </div>

                        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={keepActiveRunning}
                                onChange={(e) => setKeepActiveRunning(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[11px] text-slate-700 font-medium leading-snug">
                                <strong className="font-bold text-slate-900 block">
                                    Mantener encendidos los contenedores en uso
                                </strong>
                                Los días se reiniciarán a 0 y el próximo corte partirá desde{' '}
                                <strong>{formatDate(periodEnd)}</strong>.
                            </span>
                        </label>
                    </div>

                    {/* Resumen Total del Corte */}
                    <div className="rounded-xl bg-slate-900 text-white p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-4 text-xs">
                            <div>
                                <span className="text-[10px] uppercase text-slate-400 block">Total Días</span>
                                <span className="text-sm font-black text-cyan-300">{totals.totalDays} días</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-slate-400 block">Subtotal</span>
                                <Money value={totals.subtotal} className="text-sm font-bold text-white" />
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-slate-400 block">IVA (13%)</span>
                                <Money value={totals.iva} className="text-sm font-bold text-amber-300" />
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-indigo-200 block">
                                Total Estado de Cuenta (+IVA)
                            </span>
                            <Money value={totals.total} className="text-lg font-black text-emerald-400" />
                        </div>
                    </div>

                    {/* Acciones */}
                    <div className="pt-1 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                            <CheckCircle2 size={15} />
                            <span>
                                {isSubmitting
                                    ? 'Generando Corte...'
                                    : 'Confirmar Corte y Emitir Estado de Cuenta'}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
