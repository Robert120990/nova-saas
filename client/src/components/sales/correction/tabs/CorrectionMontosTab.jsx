import { useState } from 'react';
import { Calculator, CheckCircle2, Sparkles, RefreshCcw, AlertTriangle } from 'lucide-react';
import Money, { MoneyInput } from '../../../ui/Money';

const inputClass = 'w-full text-[13px] font-medium px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none';
const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase mb-1';

export default function CorrectionMontosTab({
    dteType,
    items,
    header,
    payments,
    preview,
    adjustments,
    recalculating,
    recalcRetPerc,
    onToggleRetPerc,
    onChangeItems,
    onChangeHeader,
    onChangePayments,
    onRunRecalculate
}) {
    const [showAdjustments, setShowAdjustments] = useState(true);

    const handleItemChange = (idx, field, rawVal) => {
        const next = (Array.isArray(items) ? items : []).map((it, i) => {
            if (i !== idx) return it;
            const val = field === 'exento'
                ? Boolean(rawVal)
                : (field === 'descripcion' ? rawVal : (rawVal === '' ? '' : Number(rawVal)));
            return { ...it, [field]: val };
        });
        onChangeItems(next);
    };

    const handlePaymentChange = (idx, field, val) => {
        const next = (Array.isArray(payments) ? payments : []).map((p, i) => {
            if (i !== idx) return p;
            return { ...p, [field]: field === 'monto' ? (val === '' ? '' : Number(val)) : val };
        });
        onChangePayments(next);
    };

    const handleBalancePayments = () => {
        const targetTotal = Number(preview?.totalPagar ?? header?.total_pagar ?? 0);
        const list = Array.isArray(payments) ? [...payments] : [];
        if (list.length === 0) {
            onChangePayments([{ metodo_pago: header?.condicion_operacion == 2 ? '13' : '01', monto: targetTotal, referencia: '' }]);
            return;
        }
        if (list.length === 1) {
            onChangePayments([{ ...list[0], monto: targetTotal }]);
            return;
        }
        let sumOthers = 0;
        for (let i = 0; i < list.length - 1; i++) {
            sumOthers += Number(list[i].monto || 0);
        }
        list[list.length - 1] = {
            ...list[list.length - 1],
            monto: Number(Math.max(0, targetTotal - sumOthers).toFixed(2))
        };
        onChangePayments(list);
    };

    const isBalanced = preview ? preview.isBalanced : true;

    return (
        <div className="space-y-4">
            {/* Barra superior de recálculo automático */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-900 text-xs font-extrabold uppercase tracking-wide">
                        <Calculator size={15} className="text-indigo-600" />
                        <span>Cuadre de Aproximación, IVA y Totales MH</span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                        <input
                            type="checkbox"
                            checked={recalcRetPerc}
                            onChange={(e) => onToggleRetPerc(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600"
                        />
                        <span>Recalcular Retención / Percepción 1% según perfil fiscal actual</span>
                    </label>
                </div>

                <button
                    type="button"
                    onClick={() => onRunRecalculate()}
                    disabled={recalculating}
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                    {recalculating ? <RefreshCcw size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-300" />}
                    <span>Recalcular y Cuadrar Automáticamente</span>
                </button>
            </div>

            {showAdjustments && Array.isArray(adjustments) && adjustments.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            Ajustes detectados / aplicados para cuadre exacto ({adjustments.length}):
                        </span>
                        <button type="button" onClick={() => setShowAdjustments(false)} className="text-[11px] font-bold text-emerald-700 hover:underline">
                            Ocultar
                        </button>
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11.5px]">
                        {adjustments.map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                </div>
            )}

            {/* Tabla editable de ítems */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[640px]">
                        <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                            <tr>
                                <th className="px-3 py-2">#</th>
                                <th className="px-3 py-2">Descripción</th>
                                <th className="px-2 py-2 w-24 text-right">Cantidad</th>
                                <th className="px-2 py-2 w-28 text-right">Precio Unit.</th>
                                <th className="px-2 py-2 w-24 text-right">Descuento</th>
                                {String(dteType) !== '11' && <th className="px-2 py-2 w-16 text-center">Exento</th>}
                                <th className="px-3 py-2 w-28 text-right">Total Línea</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {(Array.isArray(items) ? items : []).map((it, idx) => {
                                const qty = Number(it.cantidad || 0);
                                const price = Number(it.precio_unitario || 0);
                                const desc = Number(it.monto_descuento || 0);
                                const lineFallback = Math.max(0, (qty * price) - desc);
                                const lineTotal = it.exento
                                    ? (Number(it.venta_exenta || 0) || lineFallback)
                                    : (Number(it.venta_gravada || 0) || lineFallback);
                                return (
                                    <tr key={it.id || idx} className="hover:bg-slate-50/70">
                                        <td className="px-3 py-2 font-mono text-slate-400">{idx + 1}</td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="text"
                                                value={it.descripcion || ''}
                                                onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                                                className={inputClass}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <input
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                value={it.cantidad ?? ''}
                                                onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                                                className={`${inputClass} text-right font-mono`}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <MoneyInput
                                                step="0.0001"
                                                value={it.precio_unitario ?? ''}
                                                onChange={(e) => handleItemChange(idx, 'precio_unitario', e.target.value)}
                                                className={`${inputClass} text-right font-mono`}
                                            />
                                        </td>
                                        <td className="px-2 py-2">
                                            <MoneyInput
                                                step="0.0001"
                                                value={it.monto_descuento ?? 0}
                                                onChange={(e) => handleItemChange(idx, 'monto_descuento', e.target.value)}
                                                className={`${inputClass} text-right font-mono`}
                                            />
                                        </td>
                                        {String(dteType) !== '11' && (
                                            <td className="px-2 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(it.exento)}
                                                    onChange={(e) => handleItemChange(idx, 'exento', e.target.checked)}
                                                    className="rounded border-slate-300 text-indigo-600"
                                                />
                                            </td>
                                        )}
                                        <td className="px-3 py-2 text-right font-bold text-slate-800">
                                            <Money value={lineTotal} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cabecera fiscal editable y resumen calculado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-600">Parámetros Fiscales y Pagos</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Condición Operación</label>
                            <select
                                value={String(header?.condicion_operacion || 1)}
                                onChange={(e) => onChangeHeader({ ...header, condicion_operacion: Number(e.target.value) })}
                                className={inputClass}
                            >
                                <option value="1">1 - Contado</option>
                                <option value="2">2 - Crédito</option>
                                <option value="3">3 - Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Descuento General ($)</label>
                            <MoneyInput
                                value={header?.descuento_general ?? 0}
                                onChange={(e) => onChangeHeader({ ...header, descuento_general: e.target.value === '' ? 0 : Number(e.target.value) })}
                                className={`${inputClass} text-right font-mono`}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>IVA Retenido 1% ($)</label>
                            <MoneyInput
                                value={header?.iva_retenido ?? 0}
                                onChange={(e) => onChangeHeader({ ...header, iva_retenido: e.target.value === '' ? 0 : Number(e.target.value) })}
                                className={`${inputClass} text-right font-mono`}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>IVA Percibido 1% ($)</label>
                            <MoneyInput
                                value={header?.iva_percibido ?? 0}
                                onChange={(e) => onChangeHeader({ ...header, iva_percibido: e.target.value === '' ? 0 : Number(e.target.value) })}
                                className={`${inputClass} text-right font-mono`}
                            />
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Formas de Pago</span>
                            <button
                                type="button"
                                onClick={handleBalancePayments}
                                className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                            >
                                Cuadrar Pagos al Total
                            </button>
                        </div>
                        {(Array.isArray(payments) ? payments : []).map((p, idx) => (
                            <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select
                                    value={String(p.metodo_pago || '01').padStart(2, '0')}
                                    onChange={(e) => handlePaymentChange(idx, 'metodo_pago', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="01">01 - Efectivo / Billete</option>
                                    <option value="02">02 - Tarjeta Débito</option>
                                    <option value="03">03 - Tarjeta Crédito</option>
                                    <option value="05">05 - Transferencia</option>
                                    <option value="13">13 - Cuentas por Cobrar</option>
                                </select>
                                <MoneyInput
                                    value={p.monto ?? 0}
                                    onChange={(e) => handlePaymentChange(idx, 'monto', e.target.value)}
                                    className={`${inputClass} text-right font-mono`}
                                />
                                <input
                                    type="text"
                                    value={p.referencia || ''}
                                    onChange={(e) => handlePaymentChange(idx, 'referencia', e.target.value)}
                                    placeholder="Referencia..."
                                    className={inputClass}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Resumen DTE calculado */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="font-bold uppercase text-slate-600">Resumen Fiscal Proyectado</h4>
                        {!isBalanced ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                <AlertTriangle size={11} /> Pagos descuadrados
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                <CheckCircle2 size={11} /> Cuadre exacto
                            </span>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between"><span>Gravado Neto:</span><Money value={preview?.totalGravadoNetoHeader ?? header?.total_gravado} className="font-bold" /></div>
                        <div className="flex justify-between"><span>Venta Exenta:</span><Money value={preview?.totalExenta ?? header?.total_exento} className="font-bold" /></div>
                        <div className="flex justify-between"><span>IVA (13%):</span><Money value={preview?.totalIva ?? header?.total_iva} className="font-bold" /></div>
                        {(Number(preview?.fovial || 0) > 0 || Number(preview?.cotrans || 0) > 0) && (
                            <div className="flex justify-between text-slate-600">
                                <span>FOVIAL + COTRANS:</span>
                                <Money value={(Number(preview?.fovial || 0) + Number(preview?.cotrans || 0))} className="font-bold" />
                            </div>
                        )}
                        <div className="flex justify-between text-rose-700"><span>(-) IVA Retenido 1%:</span><Money value={preview?.ivaRete ?? header?.iva_retenido} className="font-bold" /></div>
                        <div className="flex justify-between text-indigo-700"><span>(+) IVA Percibido 1%:</span><Money value={preview?.ivaPerci ?? header?.iva_percibido} className="font-bold" /></div>
                        <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
                            <span>TOTAL A PAGAR DTE:</span>
                            <Money value={preview?.totalPagar ?? header?.total_pagar} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
