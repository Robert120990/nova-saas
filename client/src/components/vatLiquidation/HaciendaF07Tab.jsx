import { useState } from 'react';
import { Copy, Check, Info, Coins, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import Money from '../ui/Money';

const HaciendaF07Tab = ({ data }) => {
    const [copiedKey, setCopiedKey] = useState(null);

    const pc = data?.pago_cuenta || {};
    const totales = pc.totales || {};
    const meta = data?.meta || {};
    const isPersonaNatural = Boolean(meta.isPersonaNatural);
    const aplicaPagoCuenta = Boolean(meta.aplica_pago_cuenta);

    const handleCopy = (value, key, label) => {
        const valStr = typeof value === 'number' ? value.toFixed(2) : String(value || '0.00');
        navigator.clipboard.writeText(valStr);
        setCopiedKey(key);
        toast.success(`Copiado al portapapeles: $${valStr} (${label})`);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="space-y-4">
            {/* Aviso normativo de Pago a Cuenta */}
            {!aplicaPagoCuenta ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                    <Info size={17} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold block text-amber-950">
                            Exención Legal de Pago a Cuenta Mensual (Art. 151 inc. 2 CT)
                        </span>
                        <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                            Contribuyente clasificado como persona natural en servicios profesionales. No está obligado al anticipo mensual de Renta en el F-07. Se declara en $0.00 y liquida en la declaración anual de Renta (F-11 / Renta Anual).
                        </span>
                    </div>
                </div>
            ) : (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900">
                    <ShieldCheck size={17} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold text-indigo-950 block">
                            Declaración Mensual de Pago a Cuenta (Formulario F-07)
                        </span>
                        <span className="text-[11px] text-indigo-800 leading-relaxed block mt-0.5">
                            {isPersonaNatural
                                ? 'Persona Natural con actividad mercantil: Venta de combustibles exenta (0.00%), otros productos y servicios tributan al 1.75%.'
                                : 'Persona Jurídica (Sociedad): Venta de combustibles tributa al 0.75%, comercio general y servicios al 1.75%.'}
                        </span>
                    </div>
                </div>
            )}

            {/* Tabla de Casillas del F-07: Anticipo a Cuenta */}
            <div className="bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                        <Coins size={14} className="text-indigo-600" />
                        Sección I: Anticipo a Cuenta de Renta (Bases e Impuesto)
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">Formulario F-07 DGII</span>
                </div>

                <div className="divide-y divide-slate-200 text-xs">
                    {/* Fila 1: Comercio General / Tienda / Servicios */}
                    <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px] rounded">
                                    Casilla 10
                                </span>
                                <span className="font-bold text-slate-800">
                                    Ingresos Brutos de Actividades Comerciales y Servicios (1.75%)
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Ventas netas gravadas y exentas de productos generales, tienda o servicios.
                            </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 font-semibold uppercase">Base Imponible</div>
                                <div className="font-bold text-slate-800 text-sm">
                                    <Money value={pc.otros?.ingreso_bruto_neto || 0} />
                                </div>
                            </div>
                            <div className="text-right pl-3 border-l border-slate-200">
                                <div className="text-[10px] text-indigo-600 font-semibold uppercase">Anticipo (1.75%)</div>
                                <div className="font-black text-indigo-700 text-sm">
                                    <Money value={pc.otros?.cuota_calculada || 0} />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleCopy(pc.otros?.ingreso_bruto_neto || 0, 'f07_base_otros', 'Base Comercio 1.75%')}
                                className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                                title="Copiar base imponible"
                            >
                                {copiedKey === 'f07_base_otros' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    {/* Fila 2: Combustibles (si aplica) */}
                    {(pc.combustibles?.ingreso_bruto_neto > 0 || meta.company?.codigo_actividad === '47300') && (
                        <div className="p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white transition-colors">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 font-mono font-bold text-[10px] rounded">
                                        Casilla 15
                                    </span>
                                    <span className="font-bold text-slate-800">
                                        Ingresos Brutos por Venta de Combustibles ({meta.fuelRate}%)
                                    </span>
                                    <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                                        {isPersonaNatural ? '0.00% PN Exenta' : '0.75% PJ'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Ventas netas de gasolina y diésel (excluye FOVIAL y COTRANS por ley).
                                </p>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Base Imponible</div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        <Money value={pc.combustibles?.ingreso_bruto_neto || 0} />
                                    </div>
                                </div>
                                <div className="text-right pl-3 border-l border-slate-200">
                                    <div className="text-[10px] text-purple-600 font-semibold uppercase">Anticipo ({meta.fuelRate}%)</div>
                                    <div className="font-black text-purple-700 text-sm">
                                        <Money value={pc.combustibles?.cuota_calculada || 0} />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleCopy(pc.combustibles?.ingreso_bruto_neto || 0, 'f07_base_fuel', 'Base Combustible')}
                                    className="p-1.5 hover:bg-purple-50 text-slate-400 hover:text-purple-600 rounded-lg transition-colors cursor-pointer"
                                    title="Copiar base imponible"
                                >
                                    {copiedKey === 'f07_base_fuel' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Fila 3: Total Ingresos Brutos y Anticipo Determinado */}
                    <div className="p-3 sm:px-4 bg-slate-100/60 flex items-center justify-between gap-2 font-bold text-slate-900">
                        <span>Total Anticipo a Cuenta Determinado</span>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-900">
                                <Money value={totales.subtotal_pago_cuenta || 0} />
                            </span>
                            <button
                                type="button"
                                onClick={() => handleCopy(totales.subtotal_pago_cuenta || 0, 'f07_subtotal', 'Anticipo Determinado')}
                                className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors cursor-pointer"
                                title="Copiar anticipo determinado"
                            >
                                {copiedKey === 'f07_subtotal' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sección II: Acreditaciones contra Pago a Cuenta */}
            <div className="bg-slate-50/60 rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200">
                    <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">
                        Sección II: Menos Acreditaciones de Renta del Período
                    </span>
                </div>

                <div className="divide-y divide-slate-200 text-xs">
                    <div className="p-3 sm:px-4 flex items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div>
                            <span className="font-bold text-slate-800 block">
                                Retenciones de Renta que le practicaron a la empresa (Art. 156 / 156-A CT)
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Clientes que le efectuaron retención de Renta en el período.
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-sm">
                                <Money value={totales.retenciones_renta_sufridas || 0} />
                            </span>
                            <button
                                type="button"
                                onClick={() => handleCopy(totales.retenciones_renta_sufridas || 0, 'f07_ret_renta', 'Retenciones Renta Sufridas')}
                                className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f07_ret_renta' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="p-3 sm:px-4 flex items-center justify-between gap-2 hover:bg-white transition-colors">
                        <div>
                            <span className="font-bold text-slate-800 block">
                                Anticipo a Cuenta retenido en Comprobantes de Liquidación (DTE 07/08)
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Liquidaciones de gastos / tarjetas con anticipo acreditado.
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-sm">
                                <Money value={totales.anticipo_cuenta_liquidaciones || 0} />
                            </span>
                            <button
                                type="button"
                                onClick={() => handleCopy(totales.anticipo_cuenta_liquidaciones || 0, 'f07_anticipo_liq', 'Anticipo en Liquidaciones')}
                                className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            >
                                {copiedKey === 'f07_anticipo_liq' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="p-3 sm:px-4 bg-slate-100/60 flex items-center justify-between gap-2 font-bold text-slate-900">
                        <span>Total Acreditaciones de Renta</span>
                        <span className="text-sm font-black text-slate-900">
                            <Money value={totales.total_acreditaciones_renta || 0} />
                        </span>
                    </div>
                </div>
            </div>

            {/* Resultado Final F-07 */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-purple-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <span className="text-[11px] font-black uppercase text-indigo-900 tracking-wider block">
                        Mandamiento de Pago Formulario F-07
                    </span>
                    <span className="text-xs text-slate-600">
                        {totales.pago_cuenta_a_pagar > 0
                            ? 'Monto neto resultante a pagar en concepto de Pago a Cuenta de Renta.'
                            : 'El contribuyente tiene remanente a favor para el siguiente período.'}
                    </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">
                            {totales.pago_cuenta_a_pagar > 0 ? 'Total a Pagar F-07' : 'Remanente a Favor'}
                        </div>
                        <div className="text-xl font-black text-indigo-700">
                            <Money value={totales.pago_cuenta_a_pagar > 0 ? totales.pago_cuenta_a_pagar : totales.remanente_pago_cuenta} />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleCopy(totales.pago_cuenta_a_pagar || 0, 'f07_total', 'Total Pago a Cuenta F-07')}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        {copiedKey === 'f07_total' ? <Check size={14} /> : <Copy size={14} />}
                        <span>Copiar Total</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HaciendaF07Tab;
