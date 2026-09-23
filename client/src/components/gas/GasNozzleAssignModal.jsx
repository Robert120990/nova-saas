import { useMemo } from 'react';
import { Fuel, X, Lock } from 'lucide-react';

const GasNozzleAssignModal = ({
    isOpen,
    onClose,
    modalSelectedDespachadorId,
    setModalSelectedDespachadorId,
    despachadoresOptions = [],
    nozzlesData = [],
    modalAssignments = [],
    setModalAssignments,
    closeoutDespachadores = [],
    allDespachadores = [],
    onSave,
    closeoutId
}) => {
    const modalSelectedNozzleIds = useMemo(() => {
        const despId = parseInt(modalSelectedDespachadorId, 10);
        return modalAssignments
            .filter(a => a.despachador_id === despId)
            .map(a => a.nozzle_id);
    }, [modalAssignments, modalSelectedDespachadorId]);

    const nozzleOccupancyMap = useMemo(() => {
        const map = {};
        modalAssignments.forEach(a => {
            map[a.nozzle_id] = a.despachador_id;
        });
        return map;
    }, [modalAssignments]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Fuel size={16} className="text-indigo-600" />
                        Asignación de Mangueras al Turno
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-5 overflow-y-auto">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Despachador
                    </label>
                    <select
                        value={modalSelectedDespachadorId}
                        onChange={(e) => setModalSelectedDespachadorId(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                        <option value="">-- Seleccionar despachador --</option>
                        {despachadoresOptions.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.label}
                            </option>
                        ))}
                    </select>
                    {modalSelectedDespachadorId && (
                        <div className="mt-5 border-t border-slate-100 pt-4">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Mangueras</h3>
                            {nozzlesData.length === 0 ? (
                                <p className="text-xs text-slate-400 py-4 text-center">No hay mangueras registradas.</p>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {nozzlesData.map(n => {
                                        const occupancy = nozzleOccupancyMap[n.id];
                                        const isAssignedToCurrent = modalSelectedNozzleIds.includes(n.id);
                                        const isOccupied = occupancy && occupancy !== parseInt(modalSelectedDespachadorId, 10);

                                        if (isOccupied) {
                                            const otherDesp = closeoutDespachadores.find(d => d.despachador_id === occupancy);
                                            const otherDespAll = allDespachadores.find(a => a.id === occupancy);
                                            const otherLabel = otherDesp?.nombre || otherDespAll?.codigo || `ID ${occupancy}`;
                                            return (
                                                <div
                                                    key={n.id}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 text-xs text-slate-400 cursor-not-allowed"
                                                    title={`Asignada a ${otherLabel}`}
                                                >
                                                    <Lock size={14} className="text-slate-300" />
                                                    <div className="text-left leading-tight">
                                                        <span className="font-bold">{n.codigo}</span>
                                                        {n.product_nombre && (
                                                            <span className="text-[10px] text-slate-400 block">{n.product_nombre}</span>
                                                        )}
                                                        {n.island_codigo && (
                                                            <span className="text-[10px] text-slate-400 block">Isla: {n.island_codigo}</span>
                                                        )}
                                                        <span className="text-[10px] text-amber-500 block">{otherLabel}</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <button
                                                key={n.id}
                                                onClick={() => {
                                                    const despId = parseInt(modalSelectedDespachadorId, 10);
                                                    setModalAssignments(prev => {
                                                        const exists = prev.find(a =>
                                                            a.despachador_id === despId &&
                                                            a.nozzle_id === n.id
                                                        );
                                                        if (exists) {
                                                            return prev.filter(a =>
                                                                !(a.despachador_id === despId && a.nozzle_id === n.id)
                                                            );
                                                        }
                                                        return [...prev, { despachador_id: despId, nozzle_id: n.id }];
                                                    });
                                                }}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                                                    isAssignedToCurrent
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                                                }`}
                                            >
                                                <Fuel size={14} className={isAssignedToCurrent ? 'text-indigo-500' : 'text-slate-300'} />
                                                <div className="text-left leading-tight">
                                                    <span className="font-bold">{n.codigo}</span>
                                                    {n.product_nombre && (
                                                        <span className="text-[10px] text-slate-500 block">{n.product_nombre}</span>
                                                    )}
                                                    {n.island_codigo && (
                                                        <span className="text-[10px] text-slate-400 block">Isla: {n.island_codigo}</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="text-xs text-slate-400 mt-3">
                                <Lock size={10} className="inline mr-1" />
                                Mangueras ocupadas por otro despachador.
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-100 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onSave}
                        className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
                    >
                        {closeoutId ? 'Guardar' : 'Aplicar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GasNozzleAssignModal;
