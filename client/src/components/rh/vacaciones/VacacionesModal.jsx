import { CalculatedBenefitMoney } from '../benefits';
import Modal from '../../ui/Modal';
import { Search, Users, Umbrella, Loader2, User, ShieldCheck, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';

const VacacionesModal = ({ open, onClose, onSubmit, model }) => {
    const { aplicaVacacion, calculando, calculationError, calculationReady, calculo, codigoInput, diasServicio, diasTranscurridos, empleadoData, empleadoId, employeeError, employeeInputRef, fechaFinal, fechaInicial, fieldCls, handleCodigoSearch, handleFechaInicialChange, labelCls, loadingEmployee, months, montoRecibir, mutation, periodoAño, periodoMes, quincena, recargoLey, retryCalculation, salarioBaseVacaciones, selected, setCodigoInput, setFechaFinal, setIsEmpModalOpen, setPeriodoAño, setPeriodoMes, setQuincena, setVacacionesMonto, sueldo, sueldoDiario, totalDeducciones, totalDevengado, vacacionesMonto, years } = model;
    if (!open) return null;
    const calculationStatus = calculationError || employeeError ? 'Cálculo no disponible' : 'Retenciones pendientes';
    return (<Modal isOpen={open} onClose={onClose}
                title={selected ? 'Editar Planilla de Vacaciones' : 'Nueva Planilla de Vacaciones'}
                maxWidth="max-w-6xl" maxHeight="sm:max-h-[92vh]" height="sm:h-[88vh]" bodyClassName="px-4 sm:px-6 py-4">
                <form onSubmit={onSubmit} className="pb-2">
                    {(loadingEmployee || employeeError || calculationError) && <div role="status" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        {loadingEmployee ? 'Cargando empleado e historial...' : employeeError || calculationError}
                        {calculationError && !employeeError && <button type="button" onClick={retryCalculation} className="ml-2 font-bold underline">Reintentar cálculo</button>}
                    </div>}
                    <fieldset disabled={mutation.isPending || loadingEmployee} className="contents">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Columna Izquierda: Formulario, Período y Deducciones Fijas */}
                        <div className="lg:col-span-7 min-w-0 space-y-3">
                            {/* Metadata Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="col-span-1 sm:col-span-3">
                                    <label className={labelCls}>Año</label>
                                    <select value={periodoAño} onChange={e => setPeriodoAño(parseInt(e.target.value))} className={fieldCls}>
                                        {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 sm:col-span-4">
                                    <label className={labelCls}>Mes</label>
                                    <select value={periodoMes} onChange={e => setPeriodoMes(parseInt(e.target.value))} className={fieldCls}>
                                        {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-1 sm:col-span-5">
                                    <label className={labelCls}>Quincena</label>
                                    <select value={quincena} onChange={e => setQuincena(e.target.value)} className={fieldCls}>
                                        <option value="primera">Primera Quincena</option>
                                        <option value="segunda">Segunda Quincena</option>
                                    </select>
                                </div>
                                <div className="col-span-1 sm:col-span-12">
                                    <label className={labelCls}>Código Empleado <span className="text-[9px] text-indigo-500 font-normal lowercase">(F3 para buscar)</span></label>
                                    <div className="flex gap-2">
                                        <input ref={employeeInputRef} type="text" value={codigoInput}
                                            onChange={e => setCodigoInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                            placeholder="Ingrese código de colaborador (Ej: EMP-001)"
                                            className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm font-mono" />
                                        <button type="button" onClick={handleCodigoSearch} title="Buscar por código"
                                            className="px-3.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-xs font-semibold">
                                            <Search size={15} />
                                            <span className="hidden sm:inline">Buscar</span>
                                        </button>
                                        <button type="button" onClick={() => setIsEmpModalOpen(true)} title="Catálogo de empleados (F3)"
                                            className="px-3.5 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-xs font-bold shadow-sm shadow-indigo-600/20">
                                            <Users size={15} />
                                            <span>Catálogo F3</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Empleado Banner */}
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
                                    <span>Presione <strong>F3</strong> o ingrese el código para seleccionar al colaborador a liquidar vacaciones.</span>
                                </div>
                            )}

                            {/* Eligibility Status Banner */}
                            {empleadoData && (
                                aplicaVacacion ? (
                                    <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs text-emerald-800">
                                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold">Aplica vacación — </span>
                                            <span>{diasServicio} días de servicio ({Math.floor(diasServicio / 365)} año{Math.floor(diasServicio / 365) !== 1 ? 's' : ''} y {diasServicio % 365} días). Se calcularán 15 días + 30% recargo (Art. 177 C.Tr.).</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-800">
                                        <AlertCircle size={15} className="text-rose-600 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold">No aplica aún — </span>
                                            <span>
                                                {diasServicio > 0
                                                    ? `${diasServicio} días de servicio. Faltan ${365 - diasServicio} días para completar 1 año (Art. 177 C.Tr.).`
                                                    : 'Seleccione el período de servicio para evaluar.'}
                                            </span>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* Tarjeta de Período de Servicio */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Umbrella size={13} className="text-indigo-600 shrink-0" />
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                                            Período de Servicio Cotizable
                                        </span>
                                    </div>
                                    {sueldo > 0 && (
                                        <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-medium">
                                            Salario Diario: <Money value={sueldoDiario} />
                                        </span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="table-cards w-full text-[11px]">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-bold tracking-wider">
                                                <th className="text-left py-1 px-3 font-bold">Inicio Servicio</th>
                                                <th className="text-left py-1 px-2 font-bold">Fin Servicio</th>
                                                <th className="text-center py-1 px-2 font-bold">Días Serv.</th>
                                                <th className="text-right py-1 px-3 font-bold">Monto Vac. (15d + 30%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-slate-50/60 transition-colors">
                                                <td data-label="Inicio servicio" className="py-1.5 px-3">
                                                    <input
                                                        type="date"
                                                        value={fechaInicial}
                                                        onChange={e => handleFechaInicialChange(e.target.value)}
                                                        className="h-7 w-[125px] px-2 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Fin servicio" className="py-1.5 px-2">
                                                    <input
                                                        type="date"
                                                        value={fechaFinal}
                                                        onChange={e => setFechaFinal(e.target.value)}
                                                        className="h-7 w-[125px] px-2 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-700 transition-colors"
                                                    />
                                                </td>
                                                <td data-label="Días de servicio" className="py-1.5 px-2 text-center">
                                                    <span className={`inline-block h-7 px-2.5 py-1 text-[11px] font-bold rounded tabular-nums ${aplicaVacacion ? 'text-emerald-700 bg-emerald-50/80 border border-emerald-200' : 'text-slate-600 bg-slate-100 border border-slate-200'}`}>
                                                        {diasTranscurridos > 0 ? `${diasTranscurridos} días` : '—'}
                                                    </span>
                                                </td>
                                                <td data-label="Vacaciones" className="py-1.5 px-3 text-right">
                                                    <MoneyInput
                                                        value={vacacionesMonto || ''}
                                                        onChange={e => setVacacionesMonto(parseFloat(e.target.value) || 0)}
                                                        className="h-7 w-28 px-2 text-[12px] bg-white border border-slate-200 rounded text-right font-black text-indigo-600 focus:ring-1 focus:ring-indigo-500 outline-none tabular-nums"
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Desglose rápido informativo de la fórmula legal */}
                                {sueldo > 0 && (
                                    <div className="bg-slate-50/60 px-3 py-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-slate-600">Base 15 días:</span>
                                            <Money value={salarioBaseVacaciones} className="font-bold text-slate-700" />
                                            <span className="text-slate-300">•</span>
                                            <span className="font-semibold text-slate-600">+30% Recargo:</span>
                                            <Money value={recargoLey} className="font-bold text-slate-700" />
                                        </div>
                                        <span className="text-slate-400 italic">Art. 177 Código de Trabajo</span>
                                    </div>
                                )}
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
                                                        <CalculatedBenefitMoney ready={calculationReady} value={vacacionesMonto > 0 && calculo ? vacacionesMonto : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.isss_info?.porcentaje ? `${calculo.isss_info.porcentaje}%` : (vacacionesMonto > 0 ? '3.00%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {vacacionesMonto > 0 ? <CalculatedBenefitMoney ready={calculationReady} value={calculo?.isss_info?.tope || 500} /> : '-'}
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
                                                        <CalculatedBenefitMoney ready={calculationReady} value={vacacionesMonto > 0 && calculo ? vacacionesMonto : 0} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.afp_info?.porcentaje ? `${calculo.afp_info.porcentaje}%` : (vacacionesMonto > 0 ? '7.25%' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {vacacionesMonto > 0 ? <CalculatedBenefitMoney ready={calculationReady} value={calculo?.afp_info?.tope || 3188.56} /> : '-'}
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
                                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.renta_info?.ingreso_gravado || Math.max(0, vacacionesMonto - (calculo?.descuento_isss || 0) - (calculo?.descuento_afp || 0))} />
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info?.porcentaje !== undefined ? `${calculo.renta_info.porcentaje}%` : (vacacionesMonto > 0 ? 'Según tramo' : '-')}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums text-slate-500">
                                                        {calculo?.renta_info?.valor_descuento !== undefined ? <CalculatedBenefitMoney ready={calculationReady} value={calculo.renta_info.valor_descuento} /> : '-'}
                                                    </td>
                                                    <td className="py-2 text-right tabular-nums font-bold text-rose-600">
                                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.descuento_renta || 0} />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Totales dentro del recuadro */}
                                    <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/80 -mx-3.5 -mb-3.5 px-3.5 py-2.5">
                                        <span className="text-[10px] text-slate-400 leading-tight max-w-[280px]">
                                            * Por ley, el descanso vacacional está gravado con deducciones de ISSS, AFP y Renta.
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Descuentos:</span>
                                            <CalculatedBenefitMoney ready={calculationReady} value={totalDeducciones} className="font-black text-rose-600 text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: Tarjeta Ejecutiva del Monto a Recibir */}
                        <div className="lg:col-span-5 min-w-0 lg:sticky lg:top-2 space-y-4">
                            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-2xl border border-slate-800 space-y-4 relative overflow-hidden">
                                {/* Ambient decorative glows */}
                                <div className="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
                                <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

                                {/* Header de la tarjeta */}
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                                            <Wallet size={15} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold tracking-wider uppercase text-slate-200">
                                                Resumen de Vacaciones
                                            </h4>
                                            <span className="text-[10px] text-indigo-300 font-medium capitalize">
                                                {quincena} quincena • {months.find(m => m.value === periodoMes)?.label} {periodoAño}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Hero Net Amount to Pay */}
                                <div className="bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-slate-700/60 relative z-10">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                                        Total Líquido a Pagar
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <CalculatedBenefitMoney ready={calculationReady} pendingText={calculationStatus} pendingClassName="text-sm font-bold text-amber-300" value={montoRecibir} className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight" />
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        {calculationReady ? 'Pago neto a transferir o pagar al colaborador' : 'El monto neto estará disponible después de calcular las retenciones.'}
                                    </span>
                                </div>

                                {/* Side-by-side metric boxes */}
                                <div className="grid grid-cols-2 gap-3 relative z-10">
                                    <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                            <TrendingUp size={12} className="text-emerald-400" />
                                            <span>Devengado (+)</span>
                                        </div>
                                        <Money value={totalDevengado} className="text-base sm:text-lg font-bold text-white block" />
                                        <span className="text-[9px] text-slate-500">Salario + Recargo 30%</span>
                                    </div>

                                    <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                            <TrendingDown size={12} className="text-rose-400" />
                                            <span>Deducciones (-)</span>
                                        </div>
                                        <CalculatedBenefitMoney ready={calculationReady} value={totalDeducciones} className="text-base sm:text-lg font-bold text-rose-400 block" />
                                        <span className="text-[9px] text-slate-500">ISSS, AFP y Renta</span>
                                    </div>
                                </div>

                                {/* Breakdown detail lines */}
                                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs relative z-10 font-mono">
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span className="text-[11px] text-slate-400">Salario Base (15 días):</span>
                                        <Money value={salarioBaseVacaciones} className="font-semibold text-slate-200" />
                                    </div>
                                    <div className="flex justify-between items-center text-slate-300">
                                        <span className="text-[11px] text-slate-400">+ Recargo de Ley (30%):</span>
                                        <Money value={recargoLey} className="font-semibold text-emerald-400" />
                                    </div>
                                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-800 text-slate-200 font-bold">
                                        <span className="text-[11px]">Total Devengado Vacaciones:</span>
                                        <Money value={totalDevengado} className="text-indigo-300" />
                                    </div>
                                    <div className="flex justify-between items-center text-rose-400/90 pt-1 text-[11px]">
                                        <span>- Retención ISSS (3%):</span>
                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.descuento_isss || 0} />
                                    </div>
                                    <div className="flex justify-between items-center text-rose-400/90 text-[11px]">
                                        <span>- Retención AFP (7.25%):</span>
                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.descuento_afp || 0} />
                                    </div>
                                    <div className="flex justify-between items-center text-rose-400/90 text-[11px]">
                                        <span>- Retención Impuesto Renta:</span>
                                        <CalculatedBenefitMoney ready={calculationReady} value={calculo?.descuento_renta || 0} />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2 pt-2 relative z-10">
                                    <button
                                        type="submit"
                                        disabled={mutation.isPending || loadingEmployee || !!employeeError || !calculationReady || !empleadoId || vacacionesMonto <= 0}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                                    >
                                        {mutation.isPending ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>Guardando planilla...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 size={16} />
                                                <span>{selected ? 'Guardar Cambios' : 'Registrar Planilla de Vacaciones'}</span>
                                            </>
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

export default VacacionesModal;
