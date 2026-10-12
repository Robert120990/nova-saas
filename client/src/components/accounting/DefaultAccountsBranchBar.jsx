import { useState } from 'react';
import { Store, Copy, Check, ChevronDown } from 'lucide-react';

const DefaultAccountsBranchBar = ({
    branches = [],
    selectedBranchId = 0,
    onBranchChange,
    onCopyFromBranch,
    isSaving = false,
}) => {
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [sourceBranchId, setSourceBranchId] = useState('');

    const currentBranch = branches.find(b => b.id === Number(selectedBranchId));
    const currentBranchLabel = selectedBranchId === 0
        ? 'Configuración General (Todas)'
        : (currentBranch ? `${currentBranch.codigo ? currentBranch.codigo + ' - ' : ''}${currentBranch.nombre}` : `Sucursal #${selectedBranchId}`);

    const otherBranches = branches.filter(b => b.id !== Number(selectedBranchId));

    const handleExecuteCopy = () => {
        if (!sourceBranchId) return;
        onCopyFromBranch(Number(sourceBranchId));
        setIsCopyModalOpen(false);
        setSourceBranchId('');
    };

    return (
        <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 mb-3 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Selector de Sucursal */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 flex items-center justify-center">
                        <Store size={18} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Sucursal a Configurar</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                {currentBranchLabel}
                            </span>
                        </div>
                        <div className="relative mt-1">
                            <select
                                value={selectedBranchId}
                                onChange={(e) => onBranchChange(Number(e.target.value))}
                                disabled={isSaving}
                                className="appearance-none bg-white hover:bg-slate-50 border border-slate-300 font-bold text-xs text-slate-800 rounded-xl pl-3 pr-8 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-2xs transition-all cursor-pointer"
                            >
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.codigo ? `${b.codigo} - ` : ''}{b.nombre}
                                    </option>
                                ))}
                                <option value={0}>🏢 Configuración General (Todas las sucursales)</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Acciones de Sucursal: Copiar desde otra */}
                <div className="flex items-center gap-2 shrink-0">
                    {otherBranches.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setIsCopyModalOpen(true)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                            title="Copiar configuración de cuentas desde otra sucursal"
                        >
                            <Copy size={13} className="text-slate-500" />
                            <span>Copiar de otra sucursal</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Modal para Seleccionar Sucursal de Origen a Copiar */}
            {isCopyModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-md w-full space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Copy size={16} className="text-indigo-600" />
                                <h3 className="text-sm font-black text-slate-900">Copiar Cuentas a {currentBranchLabel}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCopyModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-600">
                            Selecciona la sucursal de donde deseas copiar la asignación de cuentas por defecto:
                        </p>

                        <div className="space-y-2">
                            {branches.map(b => (
                                <label
                                    key={b.id}
                                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                                        sourceBranchId === String(b.id)
                                            ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold'
                                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 text-xs">
                                        <input
                                            type="radio"
                                            name="sourceBranch"
                                            value={b.id}
                                            checked={sourceBranchId === String(b.id)}
                                            onChange={() => setSourceBranchId(String(b.id))}
                                            className="text-indigo-600"
                                        />
                                        <span>{b.codigo ? `${b.codigo} - ` : ''}{b.nombre}</span>
                                    </div>
                                    {b.id === Number(selectedBranchId) && (
                                        <span className="text-[10px] text-slate-400 font-medium">(Actual)</span>
                                    )}
                                </label>
                            ))}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsCopyModalOpen(false)}
                                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteCopy}
                                disabled={!sourceBranchId || sourceBranchId === String(selectedBranchId)}
                                className="px-4 py-1.5 text-xs font-black uppercase text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 shadow-sm"
                            >
                                <Check size={14} /> Copiar Cuentas
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DefaultAccountsBranchBar;
