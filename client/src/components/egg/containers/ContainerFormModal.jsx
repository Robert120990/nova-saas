import { useState, useEffect } from 'react';
import Modal from '../../ui/Modal';
import Money, { MoneyInput } from '../../ui/Money';

export default function ContainerFormModal({
    open,
    onClose,
    onSave,
    mode = 'add',
    container = null,
    defaultDailyRate = 195,
    nextContainerNumber = 11,
    isSubmitting = false
}) {
    const [form, setForm] = useState({
        quantity: 1,
        name: '',
        code: '',
        days_on: 0,
        daily_rate: 195,
        is_active_power: false,
        notes: ''
    });

    useEffect(() => {
        if (!open) return;
        if (mode === 'edit' && container) {
            setForm({
                quantity: 1,
                name: container.name || '',
                code: container.code || '',
                days_on: container.days_on ?? 0,
                daily_rate: container.daily_rate ?? defaultDailyRate,
                is_active_power: Boolean(container.is_active_power),
                notes: container.notes || ''
            });
        } else if (mode === 'rate') {
            setForm(prev => ({
                ...prev,
                daily_rate: defaultDailyRate ?? 195
            }));
        } else {
            setForm({
                quantity: 1,
                name: `Contenedor #${nextContainerNumber}`,
                code: `CONT-${String(nextContainerNumber).padStart(2, '0')}`,
                days_on: 0,
                daily_rate: defaultDailyRate ?? 195,
                is_active_power: false,
                notes: ''
            });
        }
    }, [open, mode, container, defaultDailyRate, nextContainerNumber]);

    if (!open) return null;

    const rateNum = Math.max(0, parseFloat(form.daily_rate) || 0);
    const rateIva = +(rateNum * 0.13).toFixed(2);
    const rateWithIva = +(rateNum + rateIva).toFixed(2);
    const daysNum = Math.max(0, parseFloat(form.days_on) || 0);
    const previewSubtotal = +(daysNum * rateNum).toFixed(2);
    const previewIva = +(previewSubtotal * 0.13).toFixed(2);
    const previewTotal = +(previewSubtotal + previewIva).toFixed(2);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    const modalTitle =
        mode === 'rate'
            ? 'Configurar Tarifa Diaria de Contenedores ($ + IVA)'
            : mode === 'edit'
            ? `Editar ${container?.name || 'Contenedor'}`
            : 'Adicionar Nuevo(s) Contenedor(es)';

    return (
        <Modal isOpen={open} onClose={onClose} title={modalTitle} maxWidth="max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'rate' ? (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                Cobro Base por Día (Sin IVA)
                            </label>
                            <MoneyInput
                                value={form.daily_rate}
                                onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>

                        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                            <div className="flex justify-between font-semibold text-slate-700">
                                <span>Tarifa Diaria Base:</span>
                                <Money value={rateNum} className="font-bold text-slate-900" />
                            </div>
                            <div className="flex justify-between font-semibold text-slate-700">
                                <span>IVA (13%) por Día:</span>
                                <Money value={rateIva} className="font-bold text-amber-700" />
                            </div>
                            <div className="pt-1.5 border-t border-indigo-200 flex justify-between font-extrabold text-indigo-900">
                                <span>Total por Día (IVA Incluido):</span>
                                <Money value={rateWithIva} className="text-sm font-black text-indigo-700" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {mode === 'add' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                        Cantidad a Adicionar
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={form.quantity}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                quantity: Math.max(1, parseInt(e.target.value, 10) || 1)
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                        Estado Inicial
                                    </label>
                                    <select
                                        value={form.is_active_power ? '1' : '0'}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                is_active_power: e.target.value === '1',
                                                days_on:
                                                    e.target.value === '1' && Number(form.days_on) === 0
                                                        ? 1
                                                        : form.days_on
                                            })
                                        }
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="0">Apagado (Disponible)</option>
                                        <option value="1">Encendido (Almacenando)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {(mode === 'edit' || Number(form.quantity) === 1) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                        Nombre del Contenedor
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                        Código Identificador
                                    </label>
                                    <input
                                        type="text"
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                        required
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                    Días Encendido
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={form.days_on}
                                    onChange={(e) => setForm({ ...form, days_on: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                    Cobro por Día (Sin IVA)
                                </label>
                                <MoneyInput
                                    value={form.daily_rate}
                                    onChange={(e) => setForm({ ...form, daily_rate: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase block">
                                Nota / Producto Almacenado (Opcional)
                            </label>
                            <input
                                type="text"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Ej: Lote ovoproducto pasteurizado / Huevo líquido..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        {/* Resumen de Cobro en Vivo */}
                        <div className="bg-slate-900 text-white rounded-xl p-3.5 space-y-1 text-xs">
                            <div className="flex justify-between text-slate-300">
                                <span>Subtotal ({daysNum} días × <Money value={rateNum} />):</span>
                                <Money value={previewSubtotal} className="font-bold text-white" />
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <span>IVA (13%):</span>
                                <Money value={previewIva} className="font-bold text-amber-300" />
                            </div>
                            <div className="pt-1 border-t border-white/15 flex justify-between font-extrabold text-cyan-300">
                                <span>Total a Cobrar (+ IVA):</span>
                                <Money value={previewTotal} className="text-sm font-black text-emerald-400" />
                            </div>
                        </div>
                    </>
                )}

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
