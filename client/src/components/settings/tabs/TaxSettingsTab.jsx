import { Save, Calculator, BookOpen, AlertCircle, CheckCircle2, Coins, ShieldCheck, Info } from 'lucide-react';

const TaxSettingsTab = ({
    taxes,
    onChange,
    onSubmit,
    isPending
}) => {
    const isComprasAfectan = Boolean(taxes.compras_afectan_libro_compras);
    const isAplicaPagoCuenta = taxes.aplica_pago_cuenta !== undefined ? Boolean(taxes.aplica_pago_cuenta) : true;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <form onSubmit={onSubmit}>
                <div className="p-8 space-y-8">
                    {/* Parámetros Fiscales Principales */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                            <Calculator size={20} className="text-indigo-600" />
                            <span>Parámetros Fiscales Generales</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* IVA */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">IVA (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number" step="0.01" min="0" 
                                        name="iva_rate"
                                        value={taxes.iva_rate}
                                        onChange={onChange}
                                        className="w-full px-5 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 font-bold">%</div>
                                </div>
                                <p className="text-xs text-slate-400 ml-1">Impuesto al Valor Agregado</p>
                            </div>

                            {/* FOVIAL */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">FOVIAL ($ por Galón)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-bold">$</div>
                                    <input 
                                        type="number" step="0.01" min="0" 
                                        name="fovial_rate"
                                        value={taxes.fovial_rate}
                                        onChange={onChange}
                                        className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-slate-400 ml-1">Aplica solo a combustibles marcados</p>
                            </div>

                            {/* COTRANS */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">COTRANS ($ por Galón)</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 font-bold">$</div>
                                    <input 
                                        type="number" step="0.01" min="0" 
                                        name="cotrans_rate"
                                        value={taxes.cotrans_rate}
                                        onChange={onChange}
                                        className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                        required
                                    />
                                </div>
                                <p className="text-xs text-slate-400 ml-1">Aplica solo a combustibles marcados</p>
                            </div>

                            {/* RETENCIÓN */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tasa de Retención (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number" step="0.01" min="0" 
                                        name="retencion_rate"
                                        value={taxes.retencion_rate}
                                        onChange={onChange}
                                        className="w-full px-5 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 font-bold">%</div>
                                </div>
                                <p className="text-xs text-slate-400 ml-1">Para grandes contribuyentes (habitual: 1%)</p>
                            </div>

                            {/* PERCEPCIÓN */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tasa de Percepción (%)</label>
                                <div className="relative">
                                    <input 
                                        type="number" step="0.01" min="0" 
                                        name="percepcion_rate"
                                        value={taxes.percepcion_rate}
                                        onChange={onChange}
                                        className="w-full px-5 py-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 font-bold">%</div>
                                </div>
                                <p className="text-xs text-slate-400 ml-1">Para grandes contribuyentes (habitual: 1%)</p>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN LIBRO DE COMPRAS E IVA */}
                    <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <BookOpen size={20} className="text-indigo-600" />
                            <span>Libro de Compras e IVA</span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 transition-all hover:border-slate-300">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                                <div className="space-y-2 max-w-2xl">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="text-sm font-bold text-slate-800">
                                            Afectación de Compras en Libro de Compras y Liquidación de IVA
                                        </span>
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border transition-all ${
                                            isComprasAfectan
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {isComprasAfectan ? 'Compras y Gastos' : 'Solo Gastos (Por defecto)'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Determina si las compras de mercadería e inventario registradas en el módulo de Compras deben alimentar el Libro de Compras y el Crédito Fiscal de la Liquidación de IVA (F-07) y Pago a Cuenta para esta empresa.
                                    </p>
                                    
                                    <div className="mt-3 p-3.5 bg-white rounded-xl border border-slate-200/70 space-y-2 text-xs">
                                        <div className="flex items-start gap-2 text-slate-600">
                                            <div className={`mt-0.5 rounded-full p-0.5 ${!isComprasAfectan ? 'text-amber-600 bg-amber-50' : 'text-slate-400'}`}>
                                                <AlertCircle size={13} />
                                            </div>
                                            <span>
                                                <strong>Desactivada:</strong> Funciona en modo tradicional donde únicamente los <em>Gastos Operativos</em> afectan el Libro de Compras y el Crédito Fiscal de IVA.
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2 text-slate-600">
                                            <div className={`mt-0.5 rounded-full p-0.5 ${isComprasAfectan ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'}`}>
                                                <CheckCircle2 size={13} />
                                            </div>
                                            <span>
                                                <strong>Activada:</strong> Tanto las <em>Compras de Inventario</em> como los <em>Gastos Operativos</em> afectan y se consolidan en el Libro de Compras y en la pantalla de Liquidación de IVA (F-07) y Pago a Cuenta.
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Switch Toggle Compras */}
                                <div 
                                    onClick={() => onChange({ target: { name: 'compras_afectan_libro_compras', type: 'checkbox', checked: !isComprasAfectan } })}
                                    className="shrink-0 flex flex-col items-center sm:items-end justify-center gap-2 min-w-[105px] cursor-pointer select-none group"
                                    title={isComprasAfectan ? 'Haga clic para desactivar' : 'Haga clic para activar'}
                                >
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isComprasAfectan}
                                        className={`relative inline-flex h-7 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-95 ${
                                            isComprasAfectan ? 'bg-indigo-600 shadow-sm shadow-indigo-600/30' : 'bg-slate-200 group-hover:bg-slate-300'
                                        }`}
                                    >
                                        <span className="sr-only">Afectar Libro de Compras</span>
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                                isComprasAfectan ? 'translate-x-7' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border transition-all whitespace-nowrap ${
                                        isComprasAfectan 
                                            ? 'text-indigo-700 bg-indigo-50 border-indigo-200' 
                                            : 'text-slate-500 bg-slate-100 border-slate-200'
                                    }`}>
                                        {isComprasAfectan ? 'Activado' : 'Desactivado'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN PAGO A CUENTA (ART. 151 CÓDIGO TRIBUTARIO) */}
                    <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 font-bold">
                            <Coins size={20} className="text-purple-600" />
                            <span>Régimen de Pago a Cuenta de Renta (Art. 151 CT)</span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 transition-all hover:border-slate-300">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
                                <div className="space-y-2 max-w-2xl">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="text-sm font-bold text-slate-800">
                                            Obligación de Entero Mensual de Pago a Cuenta (F-07)
                                        </span>
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border transition-all ${
                                            isAplicaPagoCuenta
                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}>
                                            {isAplicaPagoCuenta ? 'Aplica Pago a Cuenta' : 'No Aplica / Exento (Art. 151 inc. 2 CT)'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Configure si esta empresa está legalmente obligada a declarar y enterar el anticipo a cuenta del Impuesto sobre la Renta (1.75% general o 0.75% combustibles) en el Formulario F-07.
                                    </p>
                                    
                                    <div className="mt-3 p-3.5 bg-white rounded-xl border border-slate-200/70 space-y-2 text-xs">
                                        <div className="flex items-start gap-2 text-slate-600">
                                            <div className="mt-0.5 rounded-full p-0.5 text-indigo-600 bg-indigo-50">
                                                <Info size={13} />
                                            </div>
                                            <span>
                                                <strong>Art. 151 inc. 2 Código Tributario:</strong> Las personas naturales que obtengan rentas exclusivamente por la prestación de servicios de carácter profesional, técnico o de cualquier otra índole, no organizados en forma de empresa mercantil, <strong>NO están obligadas a enterar anticipo de pago a cuenta</strong>. Su impuesto sobre la renta se liquida anualmente en el Formulario F-11 mediante las retenciones que le efectúan sus clientes (Art. 156 CT).
                                            </span>
                                        </div>
                                        <div className="flex items-start gap-2 text-slate-600">
                                            <div className="mt-0.5 rounded-full p-0.5 text-emerald-600 bg-emerald-50">
                                                <ShieldCheck size={13} />
                                            </div>
                                            <span>
                                                <strong>Personas Jurídicas y Empresas Mercantiles:</strong> Las sociedades y personas naturales titulares de empresas mercantiles (comerciales, industriales o de distribución) deben mantener esta opción <strong>activada</strong> con la tasa mensual respectiva.
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Switch Toggle Pago a Cuenta */}
                                <div 
                                    onClick={() => onChange({ target: { name: 'aplica_pago_cuenta', type: 'checkbox', checked: !isAplicaPagoCuenta } })}
                                    className="shrink-0 flex flex-col items-center sm:items-end justify-center gap-2 min-w-[105px] cursor-pointer select-none group"
                                    title={isAplicaPagoCuenta ? 'Haga clic para desmarcar obligación' : 'Haga clic para aplicar pago a cuenta'}
                                >
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isAplicaPagoCuenta}
                                        className={`relative inline-flex h-7 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-purple-500/20 active:scale-95 ${
                                            isAplicaPagoCuenta ? 'bg-purple-600 shadow-sm shadow-purple-600/30' : 'bg-slate-200 group-hover:bg-slate-300'
                                        }`}
                                    >
                                        <span className="sr-only">Aplicar Pago a Cuenta</span>
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                                isAplicaPagoCuenta ? 'translate-x-7' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border transition-all whitespace-nowrap ${
                                        isAplicaPagoCuenta 
                                            ? 'text-purple-700 bg-purple-50 border-purple-200' 
                                            : 'text-slate-500 bg-slate-100 border-slate-200'
                                    }`}>
                                        {isAplicaPagoCuenta ? 'Aplica (1.75%)' : 'Exento (0.00%)'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t border-slate-100">
                    <button 
                        type="submit" 
                        disabled={isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {isPending ? 'Guardando...' : 'Guardar Impuestos'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TaxSettingsTab;
