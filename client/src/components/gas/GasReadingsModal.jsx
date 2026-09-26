import { Fuel, ShieldCheck, Upload, Loader2, X } from 'lucide-react';
import Money from '../ui/Money';

const GasReadingsModal = ({
    isOpen,
    onClose,
    estado,
    isSuperAdmin,
    editAnterior,
    fileInputRef,
    importing,
    handleImportExcel,
    readings = [],
    inputRefs,
    handleReadingChange,
    handleReadingBlur,
    handleKeyDown,
    inputCls,
    inputDisabledCls,
    inputCalibCls,
    inputCalibDisabledCls,
    importResult,
    setImportResult,
    setImporting,
    batchUpdateMutation
}) => {
    if (!isOpen) return null;

    return (
        <>

                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Fuel size={16} className="text-indigo-600" />
                                    Lecturas por Pistola
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                    {editAnterior && isSuperAdmin && (
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <ShieldCheck size={11} /> Edición inicial (SuperAdmin)
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {estado !== 'cerrado' && (
                                        <>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".xlsx,.xls"
                                                className="hidden"
                                                onChange={(e) => {
                                                    handleImportExcel(e.target.files[0]);
                                                    e.target.value = '';
                                                }}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={importing}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                {importing ? 'Importando...' : 'Importar Excel'}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={onClose}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <X size={16} className="text-slate-400" />
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1 relative">
                                <table className="w-full text-left border-separate border-spacing-0 table-cards">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 w-16 bg-slate-50 border-b border-slate-100">Pistola</th>
                                            <th className="px-1.5 py-1 max-w-[120px] bg-slate-50 border-b border-slate-100">Producto</th>
                                            <th className="px-1.5 py-1 text-right w-16 bg-slate-50 border-b border-slate-100">Precio</th>
                                            <th className={`px-1.5 py-1 text-right w-32 bg-slate-50 border-b border-slate-100 ${editAnterior && isSuperAdmin ? 'text-amber-600' : ''}`}>Lect. Ant{editAnterior && isSuperAdmin && '*'}</th>
                                            <th className="px-1.5 py-1 text-right w-32 bg-slate-50 border-b border-slate-100">Lect. Actual</th>
                                            <th className="px-1.5 py-1 text-right w-24 bg-slate-50 border-b border-slate-100">Calibr</th>
                                            <th className="px-1.5 py-1 text-right w-16 bg-slate-50 border-b border-slate-100">Difer</th>
                                            <th className="px-1.5 py-1 text-right w-20 bg-slate-50 border-b border-slate-100">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {readings.map((r, idx) => {
                                            const diferencia = r.lectura_actual - r.lectura_anterior - r.calibracion;
                                            const monto = diferencia * r.precio;
                                            return (
                                                <tr key={r.nozzle_id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} hover:bg-indigo-100 transition-colors text-[11px]`}>
                                                    <td className="px-1.5 py-0.5 font-bold text-slate-900 whitespace-nowrap" data-label="Pistola">{r.codigo_pistola}</td>
                                                    <td className="px-1.5 py-0.5 max-w-[120px] truncate" data-label="Producto">
                                                        <span className="font-medium text-slate-800">{r.codigo_producto}</span>
                                                        <span className="text-[10px] text-slate-400 ml-1">— {r.descripcion_producto}</span>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono text-slate-700 whitespace-nowrap" data-label="Precio"><Money value={r.precio} /></td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Lect. Ant.">
                                                        {editAnterior && isSuperAdmin ? (
                                                            <input
                                                                ref={el => { inputRefs.current[`anterior-${r.nozzle_id}`] = el; }}
                                                                type="number"
                                                                step="0.00001"
                                                                value={r.lectura_anterior || ''}
                                                                onChange={(e) => handleReadingChange(r.nozzle_id, 'lectura_anterior', e.target.value)}
                                                                onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                                onKeyDown={(e) => handleKeyDown(e, idx, 'lectura_anterior')}
                                                                onFocus={(e) => e.target.select()}
                                                                disabled={estado === 'cerrado'}
                                                                className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                            />
                                                    ) : (
                                                        <span className="font-mono text-slate-500 whitespace-nowrap">{r.lectura_anterior.toFixed(5)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Lect. Actual">
                                                        <input
                                                            ref={el => { inputRefs.current[`lectura_actual-${r.nozzle_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.lectura_actual || ''}
                                                            onChange={(e) => handleReadingChange(r.nozzle_id, 'lectura_actual', e.target.value)}
                                                            onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                            onKeyDown={(e) => handleKeyDown(e, idx, 'lectura_actual')}
                                                            onFocus={(e) => e.target.select()}
                                                            onWheel={(e) => e.target.blur()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right" data-label="Calibr.">
                                                        <input
                                                            ref={el => { inputRefs.current[`calibracion-${r.nozzle_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.calibracion || ''}
                                                            onChange={(e) => handleReadingChange(r.nozzle_id, 'calibracion', e.target.value)}
                                                            onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                            onKeyDown={(e) => handleKeyDown(e, idx, 'calibracion')}
                                                            onFocus={(e) => e.target.select()}
                                                            onWheel={(e) => e.target.blur()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputCalibDisabledCls : inputCalibCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-indigo-600 whitespace-nowrap" data-label="Difer.">{diferencia.toFixed(5)}</td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap" data-label="Monto"><Money value={monto} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                {importResult && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => { setImportResult(null); setImporting(false); }} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-lg max-h-[80vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Upload size={16} className="text-indigo-600" />
                                    Importar Lecturas
                                </h3>
                                <button onClick={() => { setImportResult(null); setImporting(false); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="p-5 overflow-y-auto">
                                <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-emerald-600">{importResult.matched.length}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Coinciden</div>
                                    </div>
                                    <div className="w-px h-10 bg-slate-200" />
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-slate-400">{importResult.total}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Total filas</div>
                                    </div>
                                    {importResult.warnings.length > 0 && (
                                        <>
                                            <div className="w-px h-10 bg-slate-200" />
                                            <div className="text-center">
                                                <div className="text-2xl font-black text-amber-500">{importResult.warnings.length}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">Advertencias</div>
                                            </div>
                                        </>
                                    )}
                                    {importResult.unmatched.length > 0 && (
                                        <>
                                            <div className="w-px h-10 bg-slate-200" />
                                            <div className="text-center">
                                                <div className="text-2xl font-black text-rose-500">{importResult.unmatched.length}</div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">Sin match</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {importResult.warnings.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-[11px] font-bold text-amber-600 uppercase mb-2">Advertencias — Volumen inicial no coincide con lectura anterior</h4>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {importResult.warnings.map((w, i) => (
                                                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-50 text-[11px]">
                                                    <span className="font-medium text-slate-700">{w.reading}</span>
                                                    <span className="text-amber-600 ml-auto">Esperado: {w.expected} | Recibido: {w.actual}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {importResult.unmatched.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="text-[11px] font-bold text-rose-600 uppercase mb-2">Filas sin coincidencia</h4>
                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                            {importResult.unmatched.map((u, i) => (
                                                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-rose-50 text-[11px]">
                                                    <span className="font-medium text-slate-700">{u.row}</span>
                                                    <span className="text-rose-500 ml-auto">{u.reason}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100 shrink-0">
                                <button
                                    onClick={() => { setImportResult(null); setImporting(false); }}
                                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        batchUpdateMutation.mutate(importResult.matched.map(m => ({
                                            readingId: m.readingId,
                                            lectura_actual: m.lectura_actual
                                        })));
                                    }}
                                    disabled={importResult.matched.length === 0 || batchUpdateMutation.isPending}
                                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1"
                                >
                                    {batchUpdateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                    {batchUpdateMutation.isPending ? 'Guardando...' : `Aplicar ${importResult.matched.length} lectura(s)`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}


        </>
    );
};

export default GasReadingsModal;
