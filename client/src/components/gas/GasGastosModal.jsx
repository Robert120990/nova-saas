import { Receipt, X, Plus, Trash2, Loader2, Save } from 'lucide-react';
import Money, { MoneyInput } from '../ui/Money';
import SearchableSelect from '../ui/SearchableSelect';

const GasGastosModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    gastos = [],
    expenseCategories = [],
    newCategoryName,
    setNewCategoryName,
    showNewCategoryInput,
    setShowNewCategoryInput,
    handleCreateCategory,
    handleGastoChange,
    loadProviders,
    despachadoresOptions = [],
    handleRemoveGasto,
    handleAddGastoRow,
    gastosTotal = 0,
    handleSaveSection,
    isSaving = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl min-h-[65vh] max-h-[95vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Receipt size={16} className="text-indigo-600" />
                        Gastos del Turno
                        {isDirty && estado !== 'cerrado' && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                ● Cambios sin guardar
                            </span>
                        )}
                        {estado === 'cerrado' && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                        )}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X size={16} className="text-slate-400" />
                    </button>
                </div>
                <div className="overflow-auto px-4 pb-4 flex-1">
                    <table className="w-full text-left border-separate border-spacing-0 table-cards">
                        <thead className="sticky top-0 z-20">
                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-36">Rubro</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Fecha</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-16">Tipo</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-36">Proveedor</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-20">Valor</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-32">Comentario</th>
                                <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {gastos.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-400">
                                        No hay gastos registrados. Agregue un gasto para comenzar.
                                    </td>
                                </tr>
                            )}
                            {gastos.map(g => (
                                <tr key={g.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                    <td className="px-1.5 py-1" data-label="Rubro">
                                        {showNewCategoryInput ? (
                                            <div className="flex gap-1">
                                                <input
                                                    type="text"
                                                    value={newCategoryName}
                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCreateCategory();
                                                        if (e.key === 'Escape') setShowNewCategoryInput(false);
                                                    }}
                                                    placeholder="Nuevo rubro..."
                                                    className="w-full px-1.5 py-0.5 bg-white border border-indigo-300 rounded text-[11px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    autoFocus
                                                />
                                                <button onClick={handleCreateCategory} className="p-0.5 text-indigo-600 hover:text-indigo-800">
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <select
                                                value={g.rubro || ''}
                                                onChange={(e) => {
                                                    if (e.target.value === '__new__') {
                                                        setShowNewCategoryInput(true);
                                                        setNewCategoryName('');
                                                    } else {
                                                        handleGastoChange(g.id, 'rubro', e.target.value);
                                                    }
                                                }}
                                                disabled={estado === 'cerrado'}
                                                className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            >
                                                <option value="">Seleccionar...</option>
                                                {expenseCategories.map(c => (
                                                    <option key={c.id} value={c.name}>{c.name}</option>
                                                ))}
                                                <option value="__new__">+ Nuevo rubro...</option>
                                            </select>
                                        )}
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Fecha">
                                        <input
                                            type="date"
                                            value={g.fecha || ''}
                                            onChange={(e) => handleGastoChange(g.id, 'fecha', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Documento">
                                        <input
                                            type="text"
                                            value={g.documento || ''}
                                            onChange={(e) => handleGastoChange(g.id, 'documento', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            placeholder="N° documento"
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Tipo">
                                        <select
                                            value={g.tipo || 'ccf'}
                                            onChange={(e) => handleGastoChange(g.id, 'tipo', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            <option value="ccf">CCF</option>
                                            <option value="cmp">CMP</option>
                                            <option value="fac">FAC</option>
                                            <option value="tic">TIC</option>
                                        </select>
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Proveedor">
                                        <SearchableSelect
                                            loadOptions={loadProviders}
                                            value={g.provider_id}
                                            onChange={(e, opt) => {
                                                handleGastoChange(g.id, 'provider_id', e.target.value);
                                                handleGastoChange(g.id, 'proveedor', opt ? opt.nombre : '');
                                            }}
                                            disabled={estado === 'cerrado'}
                                            placeholder="Buscar proveedor..."
                                            valueKey="id"
                                            labelKey="nombre"
                                            displayKey="nombre"
                                            codeKey="nrc"
                                            codeLabel="NRC"
                                            selectedLabel={g.proveedor}
                                            dropdownWidth={380}
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Despachador">
                                        <select
                                            value={g.despachador_id || ''}
                                            onChange={(e) => handleGastoChange(g.id, 'despachador_id', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {despachadoresOptions.length === 0 && <option value="">Sin despachador</option>}
                                            {despachadoresOptions.map(d => (
                                                <option key={d.id} value={d.id}>{d.label}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-1.5 py-1 text-right" data-label="Valor">
                                        <MoneyInput
                                            step="0.01"
                                            value={g.valor || ''}
                                            onChange={(e) => handleGastoChange(g.id, 'valor', parseFloat(e.target.value) || 0)}
                                            onFocus={(e) => e.target.select()}
                                            disabled={estado === 'cerrado'}
                                            placeholder="0.00"
                                            className="w-20 text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1" data-label="Comentario">
                                        <input
                                            type="text"
                                            value={g.comentario || ''}
                                            onChange={(e) => handleGastoChange(g.id, 'comentario', e.target.value)}
                                            disabled={estado === 'cerrado'}
                                            placeholder="Comentario"
                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </td>
                                    <td className="px-1.5 py-1 text-center" data-label="">
                                        {estado !== 'cerrado' && (
                                            <button
                                                onClick={() => handleRemoveGasto(g.id)}
                                                className="p-0.5 text-slate-600 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {estado !== 'cerrado' && (
                        <div className="flex items-center justify-between mt-3">
                            <button
                                onClick={handleAddGastoRow}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                            >
                                <Plus size={14} />
                                Agregar Gasto
                            </button>
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-500">
                                    Total Gastos: <strong className="text-red-600 font-mono text-sm"><Money value={gastosTotal} /></strong>
                                </span>
                                <button
                                    onClick={() => handleSaveSection('gastos')}
                                    disabled={isSaving}
                                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                                        isDirty
                                            ? 'text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
                                            : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {isSaving ? 'Guardando...' : (isDirty ? 'Guardar Gastos (Pendiente)' : 'Guardar Gastos')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GasGastosModal;
