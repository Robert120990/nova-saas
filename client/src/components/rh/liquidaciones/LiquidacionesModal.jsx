import { CalculatedBenefitMoney } from '../benefits';
import { formatDate } from '../../../utils/dateUtils';
import Modal from '../../ui/Modal';
import { Search, Users, User, Loader2, Wallet, CheckCircle2, Calendar, TrendingUp, TrendingDown, AlertCircle, ShieldCheck } from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';

const LiquidacionesModal = ({ open, onClose, onSubmit, model }) => {
    const { calcDays, calculando, calculationError, calculationReady, calculo, codigoInput, cuotas, diasAguinaldo, diasIndemnizacion, diasUltimos, diasVacaciones, empleadoData, empleadoId, employeeError, fieldCls, handleCodigoSearch, labelCls, loadingEmployee, months, montoDeducciones, montoRecibir, mutation, otrosDescuentos, pagoCuotas, pagoPorCuota, pagoUltimosDias, periodoAguinaldo, periodoAño, periodoIndemnizacion, periodoMes, periodoVacaciones, retryCalculation, roCls, selected, setCodigoInput, setCuotas, setDiasAguinaldo, setDiasIndemnizacion, setDiasUltimos, setDiasVacaciones, setIsEmpModalOpen, setOtrosDescuentos, setPagoCuotas, setPeriodoAguinaldo, setPeriodoAño, setPeriodoIndemnizacion, setPeriodoMes, setPeriodoVacaciones, sueldo, totalAguinaldo, totalDeducciones, totalDevengado, totalIndemnizacion, totalVacaciones, ultimaIndemnizacion, years } = model;
    if (!open) return null;
    const calculationStatus = calculationError || employeeError ? 'Cálculo no disponible' : 'Retenciones pendientes';
    return (<Modal isOpen={open} onClose={onClose}
                title={selected ? 'Editar Liquidacion' : 'Nueva Liquidacion'} maxWidth="max-w-6xl"
                maxHeight="sm:max-h-[92vh]" height="sm:h-[88vh]" bodyClassName="px-4 sm:px-6 py-4">
                <form onSubmit={onSubmit} className="pb-2">
                    {(loadingEmployee || employeeError || calculationError) && <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        {loadingEmployee ? 'Cargando empleado e historial...' : employeeError || calculationError}
                        {calculationError && !employeeError && <button type="button" onClick={retryCalculation} className="ml-2 font-bold underline">Reintentar cálculo</button>}
                    </div>}
                    <fieldset disabled={mutation.isPending || loadingEmployee} className="contents">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Columna Izquierda: Formulario y Deducciones Fijas */}
                        <div className="lg:col-span-7 min-w-0 space-y-3">
                            {/* Metadata + Employee */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="col-span-3 sm:col-span-2">
                                    <label className={labelCls}>Año</label>
                                    <select value={periodoAño} onChange={e => setPeriodoAño(parseInt(e.target.value))} className={fieldCls}>
                                        {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 sm:col-span-3">
                                    <label className={labelCls}>Mes</label>
                                    <select value={periodoMes} onChange={e => setPeriodoMes(parseInt(e.target.value))} className={fieldCls}>
                                        {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-12 sm:col-span-7">
                                    <label className={labelCls}>Codigo Empleado <span className="text-[9px] text-indigo-500 font-normal lowercase">(F3 para buscar)</span></label>
                                    <div className="flex gap-2">
                                        <input type="text" value={codigoInput}
                                            onChange={e => setCodigoInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                            placeholder="Ej: EMP-001" className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono" />
                                        <button type="button" onClick={handleCodigoSearch} title="Buscar por código"
                                            className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"><Search size={16} /></button>
                                        <button type="button" onClick={() => setIsEmpModalOpen(true)} title="Catálogo de empleados (F3)"
                                            className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shrink-0"><Users size={16} /></button>
                                    </div>
                                </div>
                            </div>

                            {empleadoData ? (
                                <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                        <User size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-slate-800 text-[13px] truncate">{empleadoData.nombres} {empleadoData.apellidos}</div>
                                        <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                                            <span>{empleadoData.cargo_nombre || 'Sin cargo'}</span>
                                            <span>•</span>
                                            <span>{empleadoData.departamento_nombre || 'Sin departamento'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 border-l border-slate-200 pl-3">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Sueldo Base</span>
                                        <Money value={sueldo} className="font-bold text-indigo-600 text-sm" />
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-800">
                                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                    <span>Presione <strong>F3</strong> o ingrese el código para seleccionar al colaborador a liquidar.</span>
                                </div>
                            )}

                            {/* Periods + Ultimos Dias - Ultra Compacto */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={13} className="text-indigo-600 shrink-0" />
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                            Periodos de Liquidación
                                        </span>
                                    </div>
                                    {ultimaIndemnizacion?.desde && (
                                        <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-medium">
                                            Última indemn.: {formatDate(ultimaIndemnizacion.desde)} al {formatDate(ultimaIndemnizacion.hasta)}
                                        </span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="table-cards w-full text-[11px]">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                                <th className="text-left py-1 px-3 font-bold">Concepto</th>
                                                <th className="text-left py-1 px-1.5 font-bold">Desde</th>
                                                <th className="text-left py-1 px-1.5 font-bold">Hasta</th>
                                                <th className="text-center py-1 px-1.5 font-bold">Días</th>
                                                <th className="text-right py-1 px-3 font-bold">Devengado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {/* Indemnizacion */}
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td data-label="Concepto" className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Indemnización
                                                </td>
                                                <td data-label="Desde" className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoIndemnizacion.desde}
                                                        onChange={e => {
                                                            setPeriodoIndemnizacion({ ...periodoIndemnizacion, desde: e.target.value });
                                                            setDiasIndemnizacion(calcDays(e.target.value, periodoIndemnizacion.hasta));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Hasta" className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoIndemnizacion.hasta}
                                                        onChange={e => {
                                                            setPeriodoIndemnizacion({ ...periodoIndemnizacion, hasta: e.target.value });
                                                            setDiasIndemnizacion(calcDays(periodoIndemnizacion.desde, e.target.value));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Días" className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasIndemnizacion || ''}
                                                        onChange={e => setDiasIndemnizacion(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td data-label="Importe" className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={totalIndemnizacion} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>

                                            {/* Vacaciones */}
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td data-label="Concepto" className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Vacaciones
                                                </td>
                                                <td data-label="Desde" className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoVacaciones.desde}
                                                        onChange={e => {
                                                            setPeriodoVacaciones({ ...periodoVacaciones, desde: e.target.value });
                                                            setDiasVacaciones(calcDays(e.target.value, periodoVacaciones.hasta));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Hasta" className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoVacaciones.hasta}
                                                        onChange={e => {
                                                            setPeriodoVacaciones({ ...periodoVacaciones, hasta: e.target.value });
                                                            setDiasVacaciones(calcDays(periodoVacaciones.desde, e.target.value));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Días" className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasVacaciones || ''}
                                                        onChange={e => setDiasVacaciones(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td data-label="Importe" className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={totalVacaciones} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>

                                            {/* Aguinaldo */}
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td data-label="Concepto" className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Aguinaldo
                                                </td>
                                                <td data-label="Desde" className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoAguinaldo.desde}
                                                        onChange={e => {
                                                            setPeriodoAguinaldo({ ...periodoAguinaldo, desde: e.target.value });
                                                            setDiasAguinaldo(calcDays(e.target.value, periodoAguinaldo.hasta));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Hasta" className="py-1 px-1.5">
                                                    <input
                                                        type="date"
                                                        value={periodoAguinaldo.hasta}
                                                        onChange={e => {
                                                            setPeriodoAguinaldo({ ...periodoAguinaldo, hasta: e.target.value });
                                                            setDiasAguinaldo(calcDays(periodoAguinaldo.desde, e.target.value));
                                                        }}
                                                        className="h-7 w-[118px] px-1.5 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Días" className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasAguinaldo || ''}
                                                        onChange={e => setDiasAguinaldo(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td data-label="Importe" className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={totalAguinaldo} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>

                                            {/* Días Pendientes */}
                                            <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                                                <td data-label="Concepto" className="py-1 px-3 text-slate-700 font-semibold whitespace-nowrap">
                                                    Días Pendientes
                                                </td>
                                                <td data-label="Desde" className="py-1 px-1.5 text-slate-400 text-[10px] italic" colSpan={2}>
                                                    Salarios laborados pendientes de liquidar
                                                </td>
                                                <td data-label="Hasta" className="py-1 px-1.5 text-center">
                                                    <input
                                                        type="number"
                                                        value={diasUltimos || ''}
                                                        onChange={e => setDiasUltimos(parseInt(e.target.value) || 0)}
                                                        className="h-7 w-12 px-1 text-[11px] text-center font-bold text-indigo-700 bg-indigo-50/50 hover:bg-white focus:bg-white border border-indigo-100 focus:border-indigo-400 rounded outline-none transition-colors"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </td>
                                                <td data-label="Días" className="py-1 px-3 text-right tabular-nums">
                                                    <Money value={pagoUltimosDias} className="font-bold text-slate-800 text-[11px]" />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* RECUADRO DE DEDUCCIONES FIJO */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-indigo-600" />
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                            DEDUCCIONES DE LEY Y RETENCIONES
                                        </span>
                                    </div>
                                    <div>
                                        {calculando ? (
                                            <span className="inline-flex items-center gap-1.5 text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-bold animate-pulse">
                                                <Loader2 size={11} className="animate-spin" /> Calculando retenciones...
                                            </span>
                                        ) : calculationReady ? (
                                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                                Retenciones calculadas
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                                                {calculationStatus}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-3.5 space-y-3">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                                    <th className="text-left py-1.5 font-bold">Concepto</th>
                                                    <th className="text-right py-1.5 font-bold">Base Gravada</th>
                                                    <th className="text-right py-1.5 font-bold">Tasa</th>
                                                    <th className="text-right py-1.5 font-bold">Tope / Tramo</th>
                                                    <th className="text-right py-1.5 font-bold">Descuento</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {/* ISSS */}
                                                <tr className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2 text-slate-700 font-semibold flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                        <span>ISSS (Salud)</span>
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-600">
                                                        <CalculatedBenefitMoney ready={calculationReady} value={montoDeducciones > 0 && calculo ? montoDeducciones : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.isss_info?.porcentaje ? `${calculo.isss_info.porcentaje}%` : (montoDeducciones > 0 ? '3.00%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {montoDeducciones > 0 ? <CalculatedBenefitMoney ready={calculationReady} value={calculo?.isss_info?.tope || 1000} /> : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.descuento_isss || 0} />
                                                    </td>
                                                </tr>

                                                {/* AFP */}
                                                <tr className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2 text-slate-700 font-semibold flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                        <span>AFP {calculo?.afp_info?.nombre ? `(${calculo.afp_info.nombre})` : ''}</span>
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-600">
                                                        <CalculatedBenefitMoney ready={calculationReady} value={montoDeducciones > 0 && calculo ? montoDeducciones : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.afp_info?.porcentaje ? `${calculo.afp_info.porcentaje}%` : (montoDeducciones > 0 ? '7.25%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {montoDeducciones > 0 ? <CalculatedBenefitMoney ready={calculationReady} value={calculo?.afp_info?.tope || 7045.06} /> : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.descuento_afp || 0} />
                                                    </td>
                                                </tr>

                                                {/* Renta */}
                                                <tr className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2 text-slate-700 font-semibold flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                                        <span>Impuesto sobre la Renta</span>
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-600">
                                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.renta_info?.ingreso_gravado || 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info ? `${calculo.renta_info.porcentaje}%` : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info?.valor_descuento !== undefined ? <CalculatedBenefitMoney ready={calculationReady} value={calculo.renta_info.valor_descuento} /> : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.descuento_renta || 0} />
                                                    </td>
                                                </tr>

                                                {/* Otros Descuentos */}
                                                <tr className="hover:bg-slate-50/70 transition-colors bg-slate-50/50">
                                                    <td className="py-2 text-slate-700 font-semibold" colSpan={3}>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                                            <span>Otros Descuentos / Anticipos:</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 text-right" colSpan={2}>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className="text-[11px] text-slate-400 font-medium">$</span>
                                                            <MoneyInput
                                                                value={otrosDescuentos || ''}
                                                                onChange={e => setOtrosDescuentos(parseFloat(e.target.value) || 0)}
                                                                className="w-24 px-2 py-1 text-[12px] bg-white border border-slate-200 rounded-lg text-right font-bold text-rose-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Totales y notas dentro del recuadro */}
                                    <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/80 -mx-3.5 -mb-3.5 px-3.5 py-2.5">
                                        <span className="text-[10px] text-slate-400 leading-tight max-w-[280px]">
                                            * Por ley, la indemnización por retiro o despido está exenta de ISSS, AFP y Renta.
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Descuentos:</span>
                                            <CalculatedBenefitMoney ready={calculationReady} value={totalDeducciones} className="font-black text-rose-600 text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modalidad de Cuotas */}
                            <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={pagoCuotas} onChange={e => setPagoCuotas(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                                    <span className="text-[11px] font-bold text-slate-600 uppercase">Habilitar Pago en Cuotas</span>
                                </label>
                                {pagoCuotas && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                        <div>
                                            <label className={labelCls}>Número de Cuotas</label>
                                            <input type="number" value={cuotas || ''} onChange={e => setCuotas(parseInt(e.target.value) || 1)}
                                                className={fieldCls} min="1" />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Monto por Cuota Estimado</label>
                                            <div className={`${roCls} font-bold text-indigo-600`}>
                                                <CalculatedBenefitMoney ready={calculationReady} value={pagoPorCuota} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Columna Derecha: Tarjeta Ejecutiva del Monto a Pagar */}
                        <div className="lg:col-span-5 lg:sticky lg:top-2 space-y-4">
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-2xl border border-slate-800 space-y-4 relative overflow-hidden">
                                {/* Ambient decorative glows */}
                                <div className="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                                <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

                                {/* Header de la Tarjeta */}
                                <div className="flex items-center justify-between relative z-10 border-b border-white/10 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                            <Wallet size={16} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Liquidación Laboral</span>
                                            <h4 className="text-xs font-semibold text-slate-200">Resumen a Liquidar</h4>
                                        </div>
                                    </div>
                                    {empleadoData?.codigo && (
                                        <span className="text-[10px] bg-white/10 border border-white/15 px-2 py-0.5 rounded-md font-mono text-slate-300">
                                            {empleadoData.codigo}
                                        </span>
                                    )}
                                </div>

                                {/* Hero Amount to Pay */}
                                <div className="relative z-10 py-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                        Total Líquido a Pagar
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <CalculatedBenefitMoney ready={calculationReady} pendingText={calculationStatus} pendingClassName="text-sm font-bold text-amber-300" value={montoRecibir} className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400" />
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-medium mt-1">
                                        {!calculationReady ? 'El monto neto estará disponible después de calcular las retenciones.' : montoRecibir > 0 ? 'Monto neto final a transferir o pagar al colaborador.' : 'Complete los períodos para visualizar el cálculo.'}
                                    </p>
                                </div>

                                {/* Balance Devengado vs Deducciones */}
                                <div className="grid grid-cols-2 gap-2 relative z-10">
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                                        <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                                            <TrendingUp size={13} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Devengado (+)</span>
                                        </div>
                                        <Money value={totalDevengado} className="text-base font-black text-white block" />
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                                        <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                                            <TrendingDown size={13} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Deducciones (-)</span>
                                        </div>
                                        <CalculatedBenefitMoney ready={calculationReady} value={totalDeducciones} className="text-base font-black text-rose-300 block" />
                                    </div>
                                </div>

                                {/* Desglose de Percepciones */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5 relative z-10 text-xs">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-1 flex justify-between">
                                        <span>Concepto Devengado</span>
                                        <span>Subtotal</span>
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Indemnización ({diasIndemnizacion || 0}d)</span>
                                        <Money value={totalIndemnizacion} className="font-semibold text-white" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Vacaciones ({diasVacaciones || 0}d)</span>
                                        <Money value={totalVacaciones} className="font-semibold text-white" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Aguinaldo ({diasAguinaldo || 0}d)</span>
                                        <Money value={totalAguinaldo} className="font-semibold text-white" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300 text-[11px]">
                                        <span>Salarios Pendientes ({diasUltimos || 0}d)</span>
                                        <Money value={pagoUltimosDias} className="font-semibold text-white" />
                                    </div>
                                </div>

                                {/* Modalidad de Cuotas (si está marcada) */}
                                {pagoCuotas && cuotas > 1 && (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 relative z-10 text-xs">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase">
                                                <Calendar size={13} /> Pago Fraccionado
                                            </div>
                                            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-bold font-mono">
                                                {cuotas} Cuotas
                                            </span>
                                        </div>
                                        <div className="flex items-baseline justify-between pt-1">
                                            <span className="text-[11px] text-slate-300">Valor por cuota:</span>
                                            <CalculatedBenefitMoney ready={calculationReady} value={pagoPorCuota} className="text-base font-black text-amber-300" />
                                        </div>
                                    </div>
                                )}

                                {/* Botones de Acción dentro de la tarjeta lateral */}
                                <div className="pt-2 border-t border-white/10 flex flex-col gap-2 relative z-10">
                                    <button
                                        type="submit"
                                        disabled={mutation.isPending || loadingEmployee || !!employeeError || !calculationReady || !empleadoId}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-all text-sm shadow-lg shadow-emerald-900/40 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {mutation.isPending ? (
                                            <><Loader2 size={16} className="animate-spin" /> Guardando Liquidación...</>
                                        ) : (
                                            <><CheckCircle2 size={16} /> {selected ? 'Guardar Cambios' : 'Registrar Liquidación'}</>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="w-full py-1.5 text-slate-400 hover:text-white transition-colors text-xs font-semibold text-center cursor-pointer"
                                    >
                                        Cancelar operación
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    </fieldset>
                </form>
            </Modal>
    );
};

export default LiquidacionesModal;
