import { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Layers, AlertCircle, Send } from 'lucide-react';
import InvoicePickerSection from './InvoicePickerSection';
import TarimaPickerSection from './TarimaPickerSection';
import { REASON_OPTIONS, formatLbs, lbsToKg } from './constants';
import { getApiErrorMessage } from '../../../utils/apiUtils';
import { formatDate } from '../../../utils/dateUtils';

export default function LinkInvoiceTarimasModal({
    open,
    onClose,
    onSuccess,
    lots = [],
    initialLot = null,
    initialTarimaNumber = null
}) {
    const [reasonType, setReasonType] = useState('venta_factura');
    const [invoiceMode, setInvoiceMode] = useState('system');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [manualInvoice, setManualInvoice] = useState({ invoice_number: '', customer_name: '' });
    const [selectedLotId, setSelectedLotId] = useState('');
    const [tarimaFilter, setTarimaFilter] = useState('');
    const [selectedTarimas, setSelectedTarimas] = useState({});
    const [notes, setNotes] = useState('');

    const availableLots = useMemo(() => {
        const list = Array.isArray(lots) ? lots : [];
        return list.filter(
            (l) => !l.is_depleted && !['anulado', 'cancelado'].includes(String(l.status || '').toLowerCase()) && parseFloat(l.stock_lbs || 0) > 0.01
        );
    }, [lots]);

    useEffect(() => {
        if (!open) return;
        setReasonType('venta_factura');
        setInvoiceMode('system');
        setSelectedInvoice(null);
        setManualInvoice({ invoice_number: '', customer_name: '' });
        setTarimaFilter('');
        setNotes('');

        const defaultLot = initialLot || availableLots[0] || null;
        if (defaultLot) {
            setSelectedLotId(String(defaultLot.id));
            if (initialTarimaNumber) {
                const list = Array.isArray(defaultLot.tarimas_available) ? defaultLot.tarimas_available : [];
                const target = list.find((t) => Number(t.tarima_number) === Number(initialTarimaNumber) && !t.is_depleted);
                if (target) {
                    setSelectedTarimas({
                        [target.tarima_number]: {
                            tarima_number: target.tarima_number,
                            boxes_count: target.available_boxes,
                            quantity_lbs: target.available_lbs
                        }
                    });
                    return;
                }
            }
        } else {
            setSelectedLotId('');
        }
        setSelectedTarimas({});
    }, [open, initialLot, initialTarimaNumber, availableLots]);

    const currentLot = useMemo(
        () => availableLots.find((l) => String(l.id) === String(selectedLotId)) || null,
        [availableLots, selectedLotId]
    );

    const availTarimas = useMemo(() => {
        if (!currentLot || !Array.isArray(currentLot.tarimas_available)) return [];
        const q = tarimaFilter.trim().toLowerCase();
        return currentLot.tarimas_available.filter((t) => {
            if (t.is_depleted) return false;
            if (!q) return true;
            return (
                String(t.tarima_number).includes(q) ||
                String(t.barcode || '').toLowerCase().includes(q) ||
                String(t.storage_location || '').toLowerCase().includes(q)
            );
        });
    }, [currentLot, tarimaFilter]);

    const handleLotChange = (nextLotId) => {
        setSelectedLotId(nextLotId);
        setSelectedTarimas({});
        setTarimaFilter('');
    };

    const toggleTarima = (t) => {
        setSelectedTarimas((prev) => {
            const next = { ...prev };
            if (next[t.tarima_number]) {
                delete next[t.tarima_number];
            } else {
                next[t.tarima_number] = {
                    tarima_number: t.tarima_number,
                    boxes_count: t.available_boxes,
                    quantity_lbs: t.available_lbs
                };
            }
            return next;
        });
    };

    const selectAllVisible = () => {
        const next = { ...selectedTarimas };
        availTarimas.forEach((t) => {
            next[t.tarima_number] = {
                tarima_number: t.tarima_number,
                boxes_count: t.available_boxes,
                quantity_lbs: t.available_lbs
            };
        });
        setSelectedTarimas(next);
    };

    const updateTarimaField = (t, field, rawVal) => {
        const numVal = rawVal === '' ? '' : Number(rawVal);
        setSelectedTarimas((prev) => {
            const existing = prev[t.tarima_number];
            if (!existing) return prev;
            if (field === 'boxes_count') {
                const boxes = numVal === '' ? '' : Math.max(0, Math.min(t.available_boxes, Math.floor(numVal)));
                let computedLbs = existing.quantity_lbs;
                if (boxes !== '' && t.available_boxes > 0) {
                    computedLbs = boxes === t.available_boxes
                        ? t.available_lbs
                        : Math.round(((t.available_lbs / t.available_boxes) * boxes) * 100) / 100;
                }
                return {
                    ...prev,
                    [t.tarima_number]: { ...existing, boxes_count: boxes, quantity_lbs: computedLbs }
                };
            }
            const lbs = numVal === '' ? '' : Math.max(0, Math.min(t.available_lbs, numVal));
            return {
                ...prev,
                [t.tarima_number]: { ...existing, quantity_lbs: lbs }
            };
        });
    };

    const selectedList = useMemo(() => Object.values(selectedTarimas), [selectedTarimas]);

    const totals = useMemo(() => {
        return selectedList.reduce(
            (acc, t) => ({
                tarimas: acc.tarimas + 1,
                boxes: acc.boxes + (parseInt(t.boxes_count, 10) || 0),
                lbs: Math.round((acc.lbs + (parseFloat(t.quantity_lbs) || 0)) * 100) / 100
            }),
            { tarimas: 0, boxes: 0, lbs: 0 }
        );
    }, [selectedList]);

    const createMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/egg-industrial/tarima-writeoffs', payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(
                `Baja registrada: ${data.tarimas_count} tarima(s) (${data.boxes_count} cajas / ${formatLbs(data.quantity_lbs)} lbs).`
            );
            onSuccess?.(data);
            onClose();
        },
        onError: (err) => {
            toast.error(getApiErrorMessage(err, 'No se pudo registrar la baja de tarimas.'));
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!currentLot) {
            toast.error('Seleccione un lote de huevo con existencias.');
            return;
        }
        if (selectedList.length === 0) {
            toast.error('Seleccione al menos una tarima para dar de baja.');
            return;
        }
        if (reasonType === 'venta_factura') {
            if (invoiceMode === 'system' && !selectedInvoice) {
                toast.error('Seleccione una factura del sistema o cambie a Referencia Manual.');
                return;
            }
            if (invoiceMode === 'manual' && !manualInvoice.invoice_number.trim()) {
                toast.error('Ingrese el número de factura o DTE.');
                return;
            }
        }

        const payload = {
            raw_material_id: currentLot.id,
            reason_type: reasonType,
            sale_id: reasonType === 'venta_factura' && invoiceMode === 'system' ? selectedInvoice?.id : null,
            invoice_number:
                reasonType === 'venta_factura' && invoiceMode === 'manual'
                    ? manualInvoice.invoice_number.trim()
                    : undefined,
            customer_name:
                reasonType === 'venta_factura' && invoiceMode === 'manual'
                    ? manualInvoice.customer_name.trim() || null
                    : undefined,
            tarimas: selectedList.map((t) => ({
                tarima_number: t.tarima_number,
                boxes_count: parseInt(t.boxes_count, 10) || 0,
                quantity_lbs: parseFloat(t.quantity_lbs) || 0
            })),
            notes: notes.trim() || null
        };

        createMutation.mutate(payload);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[93vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
                            <Layers size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                                Vincular Factura y Dar de Baja Tarimas
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Descuenta tarimas no utilizadas en producción del inventario de materia prima
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
                    {/* 1. Motivo */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            1. Tipo de Baja / Movimiento
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {REASON_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setReasonType(opt.value)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                        reasonType === opt.value
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. Factura */}
                    {reasonType === 'venta_factura' && (
                        <InvoicePickerSection
                            mode={invoiceMode}
                            setMode={setInvoiceMode}
                            selectedInvoice={selectedInvoice}
                            onSelectInvoice={setSelectedInvoice}
                            manualInvoice={manualInvoice}
                            setManualInvoice={setManualInvoice}
                        />
                    )}

                    {/* 3. Lote de Huevo */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            {reasonType === 'venta_factura' ? '2.' : '2.'} Lote de Huevo (Materia Prima)
                        </label>
                        {availableLots.length === 0 ? (
                            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={16} /> No hay lotes de materia prima con tarimas disponibles en este momento.
                            </div>
                        ) : (
                            <select
                                value={selectedLotId}
                                onChange={(e) => handleLotChange(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            >
                                {availableLots.map((lot) => (
                                    <option key={lot.id} value={lot.id}>
                                        {lot.provider_lot || `Lote #${lot.id}`} — {lot.provider_name || 'Proveedor'} ({lot.egg_type} {lot.egg_size || ''}) · {lot.available_tarimas_count ?? 0} tarimas · {lot.stock_boxes ?? lot.total_boxes} cjs · {formatLbs(lot.stock_lbs)} lbs ({formatDate(lot.fecha || lot.created_at)})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* 4. Selección de Tarimas */}
                    {currentLot && (
                        <TarimaPickerSection
                            availTarimas={availTarimas}
                            selectedTarimas={selectedTarimas}
                            tarimaFilter={tarimaFilter}
                            setTarimaFilter={setTarimaFilter}
                            onToggleTarima={toggleTarima}
                            onSelectAllVisible={selectAllVisible}
                            onClearSelection={() => setSelectedTarimas({})}
                            onUpdateTarimaField={updateTarimaField}
                        />
                    )}

                    {/* 5. Observaciones */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Observaciones / Comentario (Opcional)
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej. Venta directa en cáscara retirada por cliente / entrega en bodega..."
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                        />
                    </div>
                </div>

                {/* Sticky Footer */}
                <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 font-black">
                            {totals.tarimas} tarima(s)
                        </span>
                        <span className="font-bold text-slate-700">
                            {totals.boxes.toLocaleString('en-US')} cajas
                        </span>
                        <span className="font-bold text-slate-700">
                            {formatLbs(totals.lbs)} Lbs <span className="text-slate-400 font-medium">({lbsToKg(totals.lbs)} Kg)</span>
                        </span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || selectedList.length === 0}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5"
                        >
                            <Send size={14} />
                            {createMutation.isPending ? 'Registrando...' : 'Confirmar Baja de Tarimas'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
