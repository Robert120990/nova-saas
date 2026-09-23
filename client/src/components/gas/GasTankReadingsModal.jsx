import { FlaskConical, ShieldCheck, X } from 'lucide-react';

const defaultInputCls = "w-28 px-1.5 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] text-right font-mono";
const defaultInputDisabledCls = "w-28 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] text-right font-mono text-slate-500 cursor-not-allowed";
const defaultInputCalibCls = "w-20 px-1.5 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] text-right font-mono";
const defaultInputCalibDisabledCls = "w-20 px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] text-right font-mono text-slate-500 cursor-not-allowed";

const GasTankReadingsModal = ({
    isOpen,
    onClose,
    estado,
    superAdminTankEdit = false,
    editAnterior,
    setEditAnterior,
    tankReadings = [],
    handleTankReadingChange,
    handleTankReadingBlur,
    handleTankKeyDown,
    tankInputRefs,
    inputCls = defaultInputCls,
    inputDisabledCls = defaultInputDisabledCls,
    inputCalibCls = defaultInputCalibCls,
    inputCalibDisabledCls = defaultInputCalibDisabledCls
}) => {
    if (!isOpen) return null;

    const tankLocked = estado === 'cerrado' || (estado === 'reabierto' && !superAdminTankEdit);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl min-h-[50vh] max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                        <FlaskConical size={16} className="text-indigo-600" />
                        Lecturas por Tanque
                        {estado === 'cerrado' && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                        )}
                        {estado === 'reabierto' && superAdminTankEdit && (
                            <button
                                type="button"
                                onClick={() => setEditAnterior(prev => !prev)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                                    editAnterior
                                    ? 'text-amber-700 bg-amber-100 border-amber-300'
                                    : 'text-slate-500 bg-slate-50 border-slate-200'
                                }`}
                            >
                                <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />
                                {editAnterior ? 'Lect. anterior editable' : 'Editar lect. anterior'}
                            </button>
                        )}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>
                <div className="overflow-auto px-4 pb-4 flex-1 relative">
                    <table className="w-full text-left border-separate border-spacing-0 table-cards">
                        <thead className="sticky top-0 z-20">
                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-14">Tanque</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 min-w-[120px]">Descripción</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-20">Capacidad</th>
                                <th className={`px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-32 ${editAnterior ? 'text-amber-600' : ''}`}>
                                    Lect. Ant{editAnterior && '*'}
                                </th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Recarga</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-28">Lect. Actual</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Difer</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {tankReadings.map((r, idx) => {
                                const diferencia = (r.lectura_anterior || 0) + (r.recarga || 0) - (r.lectura_actual || 0);
                                return (
                                    <tr key={r.tank_id} className="hover:bg-slate-50 transition-colors text-[11px]">
                                        <td className="px-1.5 py-0.5 font-bold text-slate-900 whitespace-nowrap" data-label="Tanque">{r.codigo_tanque}</td>
                                        <td className="px-1.5 py-0.5 truncate" data-label="Descripción">
                                            <span className="font-medium text-slate-800">{r.descripcion_tanque}</span>
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right font-mono text-slate-700 whitespace-nowrap" data-label="Capacidad">{parseFloat(r.capacidad || 0).toFixed(2)}</td>
                                        <td className="px-1.5 py-0.5 text-right" data-label="Lect. Ant.">
                                            {editAnterior ? (
                                                <input
                                                    ref={el => {
                                                        if (tankInputRefs?.current) {
                                                            tankInputRefs.current[`anterior-${r.tank_id}`] = el;
                                                        }
                                                    }}
                                                    type="number"
                                                    step="0.00001"
                                                    value={r.lectura_anterior || ''}
                                                    onChange={(e) => handleTankReadingChange(r.tank_id, 'lectura_anterior', e.target.value)}
                                                    onBlur={() => handleTankReadingBlur(r.id, r.tank_id)}
                                                    onKeyDown={(e) => handleTankKeyDown(e, idx, 'lectura_anterior')}
                                                    onFocus={(e) => e.target.select()}
                                                    disabled={tankLocked}
                                                    className={`${tankLocked ? inputDisabledCls : inputCls} ml-auto`}
                                                />
                                            ) : (
                                                <span className="font-mono text-slate-500 whitespace-nowrap">{(r.lectura_anterior || 0).toFixed(5)}</span>
                                            )}
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right" data-label="Recarga">
                                            <input
                                                ref={el => {
                                                    if (tankInputRefs?.current) {
                                                        tankInputRefs.current[`recarga-${r.tank_id}`] = el;
                                                    }
                                                }}
                                                type="number"
                                                step="0.00001"
                                                value={r.recarga || ''}
                                                onChange={(e) => handleTankReadingChange(r.tank_id, 'recarga', e.target.value)}
                                                onBlur={() => handleTankReadingBlur(r.id, r.tank_id)}
                                                onKeyDown={(e) => handleTankKeyDown(e, idx, 'recarga')}
                                                onFocus={(e) => e.target.select()}
                                                disabled={tankLocked}
                                                className={`${tankLocked ? inputCalibDisabledCls : inputCalibCls} ml-auto`}
                                            />
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right" data-label="Lect. Actual">
                                            <input
                                                ref={el => {
                                                    if (tankInputRefs?.current) {
                                                        tankInputRefs.current[`lectura_actual-${r.tank_id}`] = el;
                                                    }
                                                }}
                                                type="number"
                                                step="0.00001"
                                                value={r.lectura_actual || ''}
                                                onChange={(e) => handleTankReadingChange(r.tank_id, 'lectura_actual', e.target.value)}
                                                onBlur={() => handleTankReadingBlur(r.id, r.tank_id)}
                                                onKeyDown={(e) => handleTankKeyDown(e, idx, 'lectura_actual')}
                                                onFocus={(e) => e.target.select()}
                                                disabled={tankLocked}
                                                className={`${tankLocked ? inputDisabledCls : inputCls} ml-auto`}
                                            />
                                        </td>
                                        <td className="px-1.5 py-0.5 text-right font-mono font-bold text-indigo-600 whitespace-nowrap" data-label="Difer.">{diferencia.toFixed(5)}</td>
                                    </tr>
                                );
                            })}
                            {tankReadings.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-400">
                                        No hay tanques registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default GasTankReadingsModal;
