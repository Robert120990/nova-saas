import { BarChart3, X, Loader2, AlertTriangle, FileText, Calendar } from 'lucide-react';
import Money from '../ui/Money';

const GasDiferenciasModal = ({
    isOpen,
    onClose,
    editData,
    fechaTurno,
    numeroTurno,
    toDateStrDDMMYYYY,
    dayShiftsQuery,
    targetShiftId,
    setTargetShiftId,
    formatHora,
    shiftEstado,
    selectedTargetShift,
    diferenciasLoading = false,
    diferenciasData,
    showConfirmComplementaria,
    setShowConfirmComplementaria,
    generarComplementariaMutation
}) => {
    if (!isOpen) return null;

    const shiftsList = Array.isArray(dayShiftsQuery?.data) ? dayShiftsQuery.data : (dayShiftsQuery?.data?.data || []);

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <BarChart3 size={16} className="text-indigo-600" />
                                    Lecturas vs Ventas
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                        {toDateStrDDMMYYYY(editData?.fecha_turno || fechaTurno) || '—'} — Turno #{numeroTurno}
                                    </span>
                                </h3>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <div className="flex flex-wrap items-center gap-3 mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviar a turno</span>
                                            {dayShiftsQuery.isLoading ? (
                                                <span className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                                                    <Loader2 size={12} className="animate-spin" /> Cargando turnos...
                                                </span>
                                            ) : shiftsList.length === 0 ? (
                                                <span className="flex items-center gap-2 text-[11px] font-bold text-amber-700">
                                                    <AlertTriangle size={12} /> No hay turnos para esta fecha en la sucursal
                                                </span>
                                            ) : (
                                                <>
                                                    <select
                                                        value={targetShiftId}
                                                        onChange={e => setTargetShiftId(e.target.value)}
                                                        className="text-[12px] font-bold text-slate-700 border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                    >
                                                        <option value="">Seleccione un turno</option>
                                                        {shiftsList.map(s => (
                                                            <option key={s.id} value={s.id}>
                                                                Turno #{s.shift_number} — {toDateStrDDMMYYYY(s.shift_date)}{formatHora(s.start_time) ? ` ${formatHora(s.start_time)}` : ''} — {s.pos_name}{s.seller_name ? ` — ${s.seller_name}` : ''} — {shiftEstado(s)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {selectedTargetShift && (
                                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">
                                                            Las complementarias se asignarán a este turno
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        {diferenciasLoading ? (
                                            <div className="flex items-center justify-center py-16">
                                                <Loader2 size={24} className="animate-spin text-indigo-600" />
                                                <span className="ml-3 text-sm font-medium text-slate-500">Cargando datos...</span>
                                            </div>
                                        ) : !diferenciasData ? (
                                            <div className="flex items-center justify-center py-16">
                                                <BarChart3 size={18} className="text-slate-400" />
                                                <span className="ml-3 text-sm font-medium text-slate-500">Seleccione un turno para ver las ventas y diferencias</span>
                                            </div>
                                        ) : (
                                            <>
                                                <table className="w-full text-left border-collapse mt-3 table-cards">
                                            <thead>
                                                <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100">Código</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100">Producto</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Precio</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Lectura (Gl)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Lectura ($)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Venta (Gl)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Venta ($)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Dif. (Gl)</th>
                                                    <th className="px-2 py-1 bg-slate-50 border-b border-slate-100 text-right">Dif. ($)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 text-[11px]">
                                                {diferenciasData.data.map((row, i) => (
                                                    <tr key={i} className={`hover:bg-slate-50 transition-colors ${parseFloat(row.diferencia_monto) > 0 ? 'bg-amber-50/50' : ''}`}>
                                                        <td className="px-2 py-1 font-bold text-slate-700" data-label="Código">{row.codigo_producto}</td>
                                                        <td className="px-2 py-1 text-slate-600" data-label="Producto">{row.descripcion_producto}</td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Precio"><Money value={parseFloat(row.precio)} /></td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Lectura (Gl)">{parseFloat(row.lectura_galones).toFixed(5)}</td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Lectura ($)"><Money value={parseFloat(row.lectura_monto)} /></td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Venta (Gl)">{parseFloat(row.venta_galones).toFixed(5)}</td>
                                                        <td className="px-2 py-1 text-right font-mono text-slate-700" data-label="Venta ($)"><Money value={parseFloat(row.venta_monto)} /></td>
                                                        <td className={`px-2 py-1 text-right font-mono font-bold ${parseFloat(row.diferencia_galones) > 0 ? 'text-red-600' : parseFloat(row.diferencia_galones) < 0 ? 'text-emerald-600' : 'text-slate-500'}`} data-label="Dif. (Gl)">
                                                            {parseFloat(row.diferencia_galones).toFixed(5)}
                                                        </td>
                                                        <td className={`px-2 py-1 text-right font-mono font-bold ${parseFloat(row.diferencia_monto) > 0 ? 'text-red-600' : parseFloat(row.diferencia_monto) < 0 ? 'text-emerald-600' : 'text-slate-500'}`} data-label="Dif. ($)">
                                                            <Money value={parseFloat(row.diferencia_monto)} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold">
                                                <tr>
                                                    <td colSpan={3} className="px-2 py-1.5 text-right text-slate-600 uppercase tracking-wider">Totales</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800">{diferenciasData.totales.lectura_galones.toFixed(5)}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={diferenciasData.totales.lectura_monto} /></td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800">{diferenciasData.totales.venta_galones.toFixed(5)}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={diferenciasData.totales.venta_monto} /></td>
                                                    <td className={`px-2 py-1.5 text-right font-mono ${diferenciasData.totales.diferencia_galones > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        {diferenciasData.totales.diferencia_galones.toFixed(5)}
                                                    </td>
                                                    <td className={`px-2 py-1.5 text-right font-mono ${diferenciasData.totales.diferencia_monto > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        <Money value={diferenciasData.totales.diferencia_monto} />
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                        <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                            <span className="text-xs text-slate-500">
                                                Diferencias Positivas: <strong className="text-red-600 font-mono">
                                                    <Money value={diferenciasData.totales.diferencia_monto > 0 ? diferenciasData.totales.diferencia_monto : 0} />
                                                </strong>
                                            </span>
                                            <button
                                                onClick={() => setShowConfirmComplementaria(true)}
                                                disabled={generarComplementariaMutation.isPending || diferenciasData.totales.diferencia_monto <= 0 || !targetShiftId}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                                            >
                                                {generarComplementariaMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                                {generarComplementariaMutation.isPending ? 'Generando...' : 'Generar DTE Complementaria'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

            {showConfirmComplementaria && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowConfirmComplementaria(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500" />
                                    Confirmar Generación de Complementarias
                                </h3>
                                <button onClick={() => setShowConfirmComplementaria(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 py-3 flex-1">
                                {(() => {
                                    const TASA_FOVIAL = 0.20;
                                    const TASA_COTRANS = 0.10;
                                    const productos = (diferenciasData?.data || []).filter(r => parseFloat(r.diferencia_galones) > 0);
                                    const totalMontoBruto = productos.reduce((s, r) => s + (parseFloat(r.diferencia_galones) * parseFloat(r.precio)), 0);
                                    const totalFovial = productos.reduce((s, r) => s + (parseFloat(r.diferencia_galones) * TASA_FOVIAL), 0);
                                    const totalCotran = productos.reduce((s, r) => s + (parseFloat(r.diferencia_galones) * TASA_COTRANS), 0);
                                    const totalBaseGrav = totalMontoBruto - totalFovial - totalCotran;
                                    return (
                                        <>
                                            <p className="text-xs text-slate-600 mb-3">
                                                Se generará <strong className="text-slate-800">{productos.length} DTE{productos.length !== 1 ? 's' : ''}</strong> de tipo Factura Consumidor Final (CF), uno por cada producto con diferencia positiva:
                                            </p>
                                            {selectedTargetShift && (
                                                <p className="text-[11px] font-bold text-indigo-600 mb-3 flex items-center gap-2">
                                                    <Calendar size={12} />
                                                    Se enviarán al Turno #{selectedTargetShift.shift_number} — {toDateStrDDMMYYYY(selectedTargetShift.shift_date)}{formatHora(selectedTargetShift.start_time) ? ` ${formatHora(selectedTargetShift.start_time)}` : ''} — {selectedTargetShift.pos_name}{selectedTargetShift.seller_name ? ` — ${selectedTargetShift.seller_name}` : ''} — {shiftEstado(selectedTargetShift)}
                                                </p>
                                            )}
                                            <table className="w-full text-left border-collapse text-[11px] table-cards">
                                                <thead>
                                                    <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                                                        <th className="px-2 py-1">Producto</th>
                                                        <th className="px-2 py-1 text-right">Dif. (Gl)</th>
                                                        <th className="px-2 py-1 text-right">Precio/Gal</th>
                                                        <th className="px-2 py-1 text-right">Monto Bruto</th>
                                                        <th className="px-2 py-1 text-right">FOVIAL</th>
                                                        <th className="px-2 py-1 text-right">COTRANS</th>
                                                        <th className="px-2 py-1 text-right">Base Gravable</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {productos.map((row, i) => {
                                                        const gl = parseFloat(row.diferencia_galones) || 0;
                                                        const precio = parseFloat(row.precio) || 0;
                                                        const montoBruto = gl * precio;
                                                        const fovial = gl * TASA_FOVIAL;
                                                        const cotrans = gl * TASA_COTRANS;
                                                        const baseGrav = montoBruto - fovial - cotrans;
                                                        return (
                                                            <tr key={i} className="hover:bg-slate-50">
                                                                <td className="px-2 py-1.5 font-medium text-slate-700" data-label="Producto">{row.descripcion_producto}</td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="Dif. (Gl)">{gl.toFixed(5)}</td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="Precio/Gal"><Money value={precio} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="Monto Bruto"><Money value={montoBruto} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="FOVIAL"><Money value={fovial} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-600" data-label="COTRANS"><Money value={cotrans} /></td>
                                                                <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-800" data-label="Base Gravable"><Money value={baseGrav} /></td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold">
                                                    <tr>
                                                        <td className="px-2 py-1.5 text-slate-600 uppercase tracking-wider">
                                                            {productos.length} DTE{productos.length !== 1 ? 's' : ''}
                                                        </td>
                                                        <td></td>
                                                        <td></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalMontoBruto} /></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalFovial} /></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalCotran} /></td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-800"><Money value={totalBaseGrav} /></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                            <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                                <button
                                                    onClick={() => setShowConfirmComplementaria(false)}
                                                    className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={() => generarComplementariaMutation.mutate({ shift_id: targetShiftId })}
                                                    disabled={generarComplementariaMutation.isPending}
                                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 shadow-lg"
                                                >
                                                    {generarComplementariaMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                                    {generarComplementariaMutation.isPending ? 'Generando...' : 'Confirmar y Generar'}
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
};

export default GasDiferenciasModal;

