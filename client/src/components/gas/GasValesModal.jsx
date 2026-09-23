import { Gift, X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import Money, { MoneyInput } from '../ui/Money';

const GasValesModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    vales = [],
    fuelProducts = [],
    loadCustomers,
    despachadoresOptions = [],
    handleValeChange,
    handleRemoveVale,
    handleAddValeRow,
    valesTotal = 0,
    handleSaveSection,
    isSaving = false
}) => {
    if (!isOpen) return null;

    return (

                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-6xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Gift size={16} className="text-indigo-600" />
                                    Vales del Turno
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
                                <table className="w-full text-left border-collapse table-cards">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 sticky top-0 z-10">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-16">Tipo</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-36">Cliente</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Producto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-44">Despachador</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Cantidad</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Precio</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20 text-right">Monto</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Placa</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Kilometraje</th>
                                            {estado !== 'cerrado' && <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-6"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-[11px]">
                                        {vales.length === 0 && (
                                            <tr>
                                                <td colSpan={estado !== 'cerrado' ? 12 : 11} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                    Sin registros de vales
                                                </td>
                                            </tr>
                                        )}
                                        {vales.map(v => {
                                            return (
                                                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-1.5 py-1" data-label="Documento">
                                                        <input
                                                            type="text"
                                                            value={v.documento}
                                                            placeholder="Documento"
                                                            onChange={(e) => handleValeChange(v.id, 'documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo">
                                                        <select
                                                            value={v.tipo_documento || 'FAC'}
                                                            onChange={(e) => handleValeChange(v.id, 'tipo_documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="FAC">FAC</option>
                                                            <option value="CCF">CCF</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Cliente">
                                                        <SearchableSelect
                                                            loadOptions={loadCustomers()}
                                                            value={v.cliente_id}
                                                            onChange={(e, opt) => {
                                                                handleValeChange(v.id, 'cliente_id', e.target.value);
                                                                handleValeChange(v.id, 'cliente_nombre', opt ? opt.nombre : '');
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            placeholder="Buscar cliente..."
                                                            valueKey="id"
                                                            labelKey="nombre"
                                                            displayKey="nombre"
                                                            codeKey="nrc"
                                                            codeLabel="NRC"
                                                            selectedLabel={v.cliente_nombre}
                                                            dropdownWidth={420}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Producto">
                                                        <select
                                                            value={v.producto_codigo}
                                                            onChange={(e) => {
                                                                const cod = e.target.value;
                                                                const prod = fuelProducts.find(p => p.codigo === cod);
                                                                handleValeChange(v.id, 'producto_codigo', cod);
                                                                handleValeChange(v.id, 'producto_descripcion', prod ? prod.descripcion : '');
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {fuelProducts.map(p => (
                                                                <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.descripcion}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Despachador">
                                                        <select
                                                            value={v.despachador_id || ''}
                                                            onChange={(e) => handleValeChange(v.id, 'despachador_id', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            {despachadoresOptions.length === 0 && <option value="">Sin despachador</option>}
                                                            {despachadoresOptions.map(d => (
                                                                <option key={d.id} value={d.id}>{d.label}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Cantidad">
                                                        <input
                                                            type="number"
                                                            step="0.00001"
                                                            min="0"
                                                            value={v.cantidad}
                                                            onChange={(e) => {
                                                                const cant = parseFloat(e.target.value) || 0;
                                                                handleValeChange(v.id, 'cantidad', cant);
                                                                const monto = parseFloat(v.monto) || 0;
                                                                handleValeChange(v.id, 'precio', cant > 0 ? monto / cant : 0);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1 text-right font-mono font-bold text-indigo-600" data-label="Precio">
                                                        {parseFloat(v.cantidad) > 0 ? <Money value={parseFloat(v.monto) / parseFloat(v.cantidad)} /> : <Money value={0} />}
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        min="0"
                                                        value={v.monto}
                                                        onChange={(e) => {
                                                            const monto = parseFloat(e.target.value) || 0;
                                                            handleValeChange(v.id, 'monto', monto);
                                                            const cant = parseFloat(v.cantidad) || 0;
                                                            handleValeChange(v.id, 'precio', cant > 0 ? monto / cant : 0);
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                    />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Placa">
                                                        <input
                                                            type="text"
                                                            value={v.placa}
                                                            placeholder="Placa"
                                                            onChange={(e) => handleValeChange(v.id, 'placa', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Kilometraje">
                                                        <input
                                                            type="text"
                                                            value={v.kilometraje}
                                                            placeholder="KM"
                                                            onChange={(e) => handleValeChange(v.id, 'kilometraje', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
{estado !== 'cerrado' && (
                                                        <td className="px-1.5 py-1 text-center" data-label="">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveVale(v.id)}
                                                                className="p-0.5 text-slate-600 hover:text-red-500 transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={11} />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {estado !== 'cerrado' && (
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={12} className="px-2 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={handleAddValeRow}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            Agregar Vale
                                                        </button>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-slate-500">
                                                                Total Vales: <strong className="text-red-600 font-mono text-sm"><Money value={valesTotal} /></strong>
                                                            </span>
                                                            <button
                                                                onClick={() => handleSaveSection('vales')}
                                                                disabled={isSaving}
                                                                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                                                                    isDirty
                                                                        ? 'text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
                                                                        : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                                                }`}
                                                            >
                                                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                {isSaving ? 'Guardando...' : (isDirty ? 'Guardar Vales (Pendiente)' : 'Guardar Vales')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
    );
};

export default GasValesModal;
