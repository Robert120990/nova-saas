import { useState } from 'react';
import { Copy, Check, TrendingUp, TrendingDown, Scale, Building2, Info } from 'lucide-react';
import { toast } from 'sonner';
import Money from '../ui/Money';

const HaciendaF11Tab = ({ data }) => {
    const [copiedKey, setCopiedKey] = useState(null);

    const debito = data?.debito_fiscal || {};
    const credito = data?.credito_fiscal || {};
    const liq = data?.liquidacion_iva || {};
    const meta = data?.meta || {};
    const company = meta?.company || {};
    const isGranContribuyente = company?.tipo_contribuyente === 'Grande' || company?.tipo_contribuyente?.toLowerCase() === 'grande';

    const handleCopy = (value, key, label) => {
        const valStr = typeof value === 'number' ? value.toFixed(2) : String(value || '0.00');
        navigator.clipboard.writeText(valStr);
        setCopiedKey(key);
        toast.success(`Copiado al portapapeles: $${valStr} (${label})`);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Aviso de Clasificación de Contribuyente */}
            {isGranContribuyente ? (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-2.5 text-xs text-purple-900">
                    <Building2 size={17} className="text-purple-600 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold text-purple-950 block">
                            Contribuyente Clasificado como: GRAN CONTRIBUYENTE (Agente de Retención y Percepción)
                        </span>
                        <span className="text-[11px] text-purple-800 leading-relaxed block mt-0.5">
                            Como Gran Contribuyente, estás obligado a retener el 1% en compras a medianos/otros y percibir el 1% en ventas. Dichos valores se reportan en las casillas de terceros del F-11. No sufres retención del 1% por parte de otros contribuyentes.
                        </span>
                    </div>
                </div>
            ) : (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
                    <Info size={17} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold text-emerald-950 block">
                            Contribuyente Clasificado como: {company?.tipo_contribuyente || 'Mediano / Otros'}
                        </span>
                        <span className="text-[11px] text-emerald-800 leading-relaxed block mt-0.5">
                            Las retenciones del 1% practicadas por Grandes Contribuyentes y percepciones del 1% soportadas en compras constituyen <strong>acreditaciones directas</strong> a tu favor contra el débito fiscal en la Sección III.
                        </span>
                    </div>
                </div>
            )}

            {/* SECCIÓN I: Débito Fiscal (Ventas) */}
            <div className="bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wider flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-indigo-600" />
                        Sección I: Débito Fiscal del Mes (Ventas y Prestación de Servicios)
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600">F-11 DGII</span>
                </div>

                <div className="divide-y divide-slate-200 text-xs">
                    {/* Casilla 01: CCF */}
                    <div className="p-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px] rounded">
                                    [01]
                                </span>
                                <span className="font-bold text-slate-800">
                                    Ventas Internas Gravadas con Comprobante de Crédito Fiscal (CCF)
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 font-semibold uppercase">Base Imponible</div>
                                <div className="font-bold text-slate-800 text-xs sm:text-sm">
                                    <Money value={debito.ccf?.gravado || 0} />
                                </div>
                            </div>
                            <div className="text-right pl-3 border-l border-slate-200">
                                <div className="text-[10px] text-indigo-600 font-semibold uppercase">Débito Fiscal (13%)</div>
                                <div className="font-black text-indigo-700 text-xs sm:text-sm">
                                    <Money value={debito.ccf?.iva || 0} />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(debito.ccf?.gravado || 0, 'f11_base_ccf', 'Ventas Gravadas CCF')}
                                className="p-1 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                                title="Copiar base gravada CCF"
                            >
                                {copiedKey === 'f11_base_ccf' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Casilla 02: FCF */}
                    <div className="p-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px] rounded">
                                    [02]
                                </span>
                                <span className="font-bold text-slate-800">
                                    Ventas Internas Gravadas a Consumidores Finales (FCF / Tickets)
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 font-semibold uppercase">Base Imponible</div>
                                <div className="font-bold text-slate-800 text-xs sm:text-sm">
                                    <Money value={debito.fcf?.gravado || 0} />
                                </div>
                            </div>
                            <div className="text-right pl-3 border-l border-slate-200">
                                <div className="text-[10px] text-indigo-600 font-semibold uppercase">Débito Fiscal (13%)</div>
                                <div className="font-black text-indigo-700 text-xs sm:text-sm">
                                    <Money value={debito.fcf?.iva || 0} />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(debito.fcf?.gravado || 0, 'f11_base_fcf', 'Ventas FCF')}
                                className="p-1 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_base_fcf' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Casilla 03 y 04: Exentas y No Sujetas */}
                    <div className="p-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 font-mono font-bold text-[10px] rounded">
                                    [03/04]
                                </span>
                                <span className="font-bold text-slate-800">
                                    Ventas Internas Exentas y No Sujetas
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 font-semibold uppercase">Monto Total Exento / No Sujeto</div>
                                <div className="font-bold text-slate-800 text-xs sm:text-sm">
                                    <Money value={(debito.totales?.ventas_exentas_netas || 0) + (debito.totales?.ventas_nosujetas_netas || 0)} />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy((debito.totales?.ventas_exentas_netas || 0) + (debito.totales?.ventas_nosujetas_netas || 0), 'f11_exentas_ventas', 'Ventas Exentas')}
                                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_exentas_ventas' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Total Débito Fiscal */}
                    <div className="p-2.5 sm:px-4 bg-indigo-50/50 flex items-center justify-between gap-2 font-bold text-indigo-950">
                        <span>Total Débito Fiscal del Período (Neto de NC)</span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-indigo-700">
                                <Money value={debito.totales?.neto || 0} />
                            </span>
                            <button
                                type="button"
                                onClick={() => handleCopy(debito.totales?.neto || 0, 'f11_debito_total', 'Total Débito Fiscal')}
                                className="p-1 hover:bg-indigo-100 text-indigo-600 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_debito_total' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN II: Crédito Fiscal (Compras y Gastos) */}
            <div className="bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                        <TrendingDown size={14} className="text-emerald-600" />
                        Sección II: Crédito Fiscal del Mes (Compras Internas e Importaciones)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600">F-11 DGII</span>
                </div>

                <div className="divide-y divide-slate-200 text-xs">
                    {/* Casilla 10: Compras Gravadas con CCF */}
                    <div className="p-2.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] rounded">
                                    [10]
                                </span>
                                <span className="font-bold text-slate-800">
                                    Compras Internas Gravadas con Comprobante de Crédito Fiscal
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 font-semibold uppercase">Base Imponible</div>
                                <div className="font-bold text-slate-800 text-xs sm:text-sm">
                                    <Money value={credito.totales?.compras_gravadas_netas || 0} />
                                </div>
                            </div>
                            <div className="text-right pl-3 border-l border-slate-200">
                                <div className="text-[10px] text-emerald-600 font-semibold uppercase">Crédito Fiscal (13%)</div>
                                <div className="font-black text-emerald-700 text-xs sm:text-sm">
                                    <Money value={credito.totales?.neto || 0} />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(credito.totales?.neto || 0, 'f11_credito_iva', 'Crédito Fiscal Compras')}
                                className="p-1 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_credito_iva' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Casilla 11: Compras Exentas */}
                    <div className="p-2.5 sm:px-4 flex items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 font-mono font-bold text-[10px] rounded">
                                    [11]
                                </span>
                                <span className="font-bold text-slate-800">
                                    Compras Internas Exentas y No Sujetas (incluye FOVIAL/COTRANS)
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                <Money value={(credito.totales?.compras_exentas_netas || 0) + (credito.totales?.compras_nosujetas_netas || 0)} />
                            </span>
                            <button
                                type="button"
                                onClick={() => handleCopy((credito.totales?.compras_exentas_netas || 0) + (credito.totales?.compras_nosujetas_netas || 0), 'f11_compras_exentas', 'Compras Exentas')}
                                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_compras_exentas' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Total Crédito Fiscal */}
                    <div className="p-2.5 sm:px-4 bg-emerald-50/50 flex items-center justify-between gap-2 font-bold text-emerald-950">
                        <span>Total Crédito Fiscal del Período (Neto de NC)</span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-emerald-700">
                                <Money value={credito.totales?.neto || 0} />
                            </span>
                            <button
                                type="button"
                                onClick={() => handleCopy(credito.totales?.neto || 0, 'f11_credito_total', 'Total Crédito Fiscal')}
                                className="p-1 hover:bg-emerald-100 text-emerald-600 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_credito_total' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCIÓN III: Liquidación de IVA y Acreditaciones */}
            <div className="bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                        <Scale size={14} className="text-amber-600" />
                        Sección III: Determinación del Impuesto y Acreditaciones
                    </span>
                    <span className="text-[10px] font-bold text-amber-700">F-11 DGII</span>
                </div>

                <div className="divide-y divide-slate-200 text-xs">
                    {/* Impuesto Determinado / Remanente */}
                    <div className="p-2.5 sm:px-4 flex items-center justify-between gap-2 bg-white">
                        <span className="font-bold text-slate-800">
                            {liq.impuesto_determinado > 0 ? 'Impuesto IVA Determinado (Débito > Crédito)' : 'Remanente de Crédito Fiscal del Mes'}
                        </span>
                        <span className={`text-sm font-black ${liq.impuesto_determinado > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                            <Money value={liq.impuesto_determinado > 0 ? liq.impuesto_determinado : liq.remanente_credito_mes} />
                        </span>
                    </div>

                    {/* Remanente Anterior */}
                    <div className="p-2.5 sm:px-4 flex items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 font-mono font-bold text-[10px] rounded">[20]</span>
                            <span className="text-slate-700 font-medium">Remanente de Crédito Fiscal de Meses Anteriores</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800"><Money value={liq.remanente_anterior || 0} /></span>
                            <button
                                type="button"
                                onClick={() => handleCopy(liq.remanente_anterior || 0, 'f11_rem_ant', 'Remanente Anterior')}
                                className="p-1 hover:bg-slate-200 text-slate-400 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_rem_ant' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Retenciones Sufridas */}
                    <div className="p-2.5 sm:px-4 flex items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 font-mono font-bold text-[10px] rounded">[21]</span>
                            <span className="text-slate-700 font-medium">Retenciones de IVA 1% que le fueron practicadas (Sufridas)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800"><Money value={liq.retenciones_iva_sufridas || 0} /></span>
                            <button
                                type="button"
                                onClick={() => handleCopy(liq.retenciones_iva_sufridas || 0, 'f11_ret_sufr', 'Retenciones IVA Sufridas')}
                                className="p-1 hover:bg-slate-200 text-slate-400 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_ret_sufr' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Percepciones Soportadas */}
                    <div className="p-2.5 sm:px-4 flex items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 font-mono font-bold text-[10px] rounded">[22]</span>
                            <span className="text-slate-700 font-medium">Percepciones de IVA 1% soportadas en compras</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800"><Money value={liq.percepciones_iva_soportadas || 0} /></span>
                            <button
                                type="button"
                                onClick={() => handleCopy(liq.percepciones_iva_soportadas || 0, 'f11_perc_sop', 'Percepciones IVA Soportadas')}
                                className="p-1 hover:bg-slate-200 text-slate-400 rounded transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f11_perc_sop' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Total Acreditaciones */}
                    <div className="p-2.5 sm:px-4 bg-slate-100/70 flex items-center justify-between gap-2 font-bold text-slate-900">
                        <span>Total de Acreditaciones</span>
                        <span className="text-xs sm:text-sm font-black text-slate-800"><Money value={liq.total_acreditaciones || 0} /></span>
                    </div>

                    {/* Retenciones Sujetos Excluidos */}
                    {liq.retenciones_sujetos_excluidos > 0 && (
                        <div className="p-2.5 sm:px-4 flex items-center justify-between gap-2 bg-amber-50/50">
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 font-mono font-bold text-[10px] rounded">[40]</span>
                                <span className="text-amber-950 font-bold">IVA Retenido a Sujetos Excluidos (FSE - a enterar)</span>
                            </div>
                            <span className="font-black text-amber-800"><Money value={liq.retenciones_sujetos_excluidos} /></span>
                        </div>
                    )}
                </div>
            </div>

            {/* Resultado Final F-11 */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <span className="text-[11px] font-black uppercase text-emerald-950 tracking-wider block">
                        Mandamiento de Pago Formulario F-11 (IVA)
                    </span>
                    <span className="text-xs text-slate-600">
                        {liq.total_iva_a_enterar > 0
                            ? 'Monto total a pagar por operaciones propias y retenciones a enterar.'
                            : `Sin impuesto a pagar. Nuevo remanente de crédito a favor: $${(liq.nuevo_remanente_credito || 0).toFixed(2)}`}
                    </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">
                            {liq.total_iva_a_enterar > 0 ? 'Total a Pagar F-11' : 'Nuevo Remanente'}
                        </div>
                        <div className="text-xl font-black text-emerald-700">
                            <Money value={liq.total_iva_a_enterar > 0 ? liq.total_iva_a_enterar : liq.nuevo_remanente_credito} />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleCopy(liq.total_iva_a_enterar || 0, 'f11_total', 'Total IVA F-11')}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        {copiedKey === 'f11_total' ? <Check size={14} /> : <Copy size={14} />}
                        <span>Copiar Total</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HaciendaF11Tab;
