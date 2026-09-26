import { Truck, X, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import Money, { MoneyInput } from '../ui/Money';

const GasAnticiposModal = ({
    isOpen,
    onClose,
    isDirty,
    estado,
    anticiposDesp = [],
    fuelProducts = [],
    loadCustomers,
    despachadoresOptions = [],
    handleAnticipoChange,
    handleAnticipoClienteChange,
    handleRemoveAnticipo,
    handleAddAnticipoRow,
    anticiposDespTotal = 0,
    handleSaveSection,
    isSaving = false,
    pendingAnticiposByClient = {}
}) => {
    if (!isOpen) return null;

    return (

                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={onClose} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-6xl min-h-[50vh] max-h-[95vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Truck size={16} className="text-indigo-600" />
                                    Anticipos Despachados del Turno
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
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Cliente</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Saldo Disp.</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-24">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-16">Tipo</th>
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
                                        {anticiposDesp.length === 0 && (
                                            <tr>
                                                <td colSpan={estado !== 'cerrado' ? 13 : 12} className="px-2 py-3 text-center text-[10px] text-slate-400">
                                                    Sin registros de anticipos despachados
                                                </td>
                                            </tr>
                                        )}
                                        {anticiposDesp.map(a => {
                                            const saldoBase = parseFloat(a.saldo_disponible) || 0;
                                            const pendingSame = a.cliente_id ? (pendingAnticiposByClient[a.cliente_id] || 0) : 0;
                                            const efectivoDisponible = saldoBase - pendingSame;
                                            const excedeSaldo = parseFloat(a.monto) > 0 && efectivoDisponible < -0.0001;
                                            return (
                                                <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${excedeSaldo ? 'bg-red-50' : ''}`}>
                                                    <td className="px-1.5 py-1" data-label="Cliente">
                                                        <SearchableSelect
                                                            loadOptions={loadCustomers({ es_anticipado: 1 })}
                                                            value={a.cliente_id}
                                                            onChange={(e, opt) => {
                                                                handleAnticipoClienteChange(a.id, e.target.value);
                                                                if (opt) handleAnticipoChange(a.id, 'cliente_nombre', opt.nombre);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            placeholder="Buscar cliente..."
                                                            valueKey="id"
                                                            labelKey="nombre"
                                                            displayKey="nombre"
                                                            codeKey="nrc"
                                                            codeLabel="NRC"
                                                            selectedLabel={a.cliente_nombre}
                                                            dropdownWidth={420}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1 text-center font-mono font-bold text-xs" data-label="Saldo Disp.">
                                                        {a.cliente_id ? (
                                                            <span className={`${excedeSaldo ? 'text-red-600' : 'text-indigo-600'}`}>
                                                                <Money value={efectivoDisponible} />
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Documento">
                                                        <input
                                                            type="text"
                                                            value={a.documento}
                                                            placeholder="Documento"
                                                            onChange={(e) => handleAnticipoChange(a.id, 'documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Tipo">
                                                        <select
                                                            value={a.tipo_documento || 'FAC'}
                                                            onChange={(e) => handleAnticipoChange(a.id, 'tipo_documento', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="FAC">FAC</option>
                                                            <option value="CCF">CCF</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Producto">
                                                        <select
                                                            value={a.producto_codigo}
                                                            onChange={(e) => {
                                                                const cod = e.target.value;
                                                                const prod = fuelProducts.find(p => p.codigo === cod);
                                                                handleAnticipoChange(a.id, 'producto_codigo', cod);
                                                                handleAnticipoChange(a.id, 'producto_descripcion', prod ? prod.descripcion : '');
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
                                                            value={a.despachador_id || ''}
                                                            onChange={(e) => handleAnticipoChange(a.id, 'despachador_id', e.target.value)}
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
                                                            value={a.cantidad}
                                                            onChange={(e) => {
                                                                const cant = parseFloat(e.target.value) || 0;
                                                                handleAnticipoChange(a.id, 'cantidad', cant);
                                                                const monto = parseFloat(a.monto) || 0;
                                                                handleAnticipoChange(a.id, 'precio', cant > 0 ? monto / cant : 0);
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1 text-right font-mono font-bold text-indigo-600" data-label="Precio">
                                                        {parseFloat(a.cantidad) > 0 ? <Money value={parseFloat(a.monto) / parseFloat(a.cantidad)} /> : <Money value={0} />}
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Monto">
                                                    <MoneyInput
                                                        step="0.01"
                                                        min="0"
                                                        value={a.monto}
                                                        onChange={(e) => {
                                                            const monto = parseFloat(e.target.value) || 0;
                                                            handleAnticipoChange(a.id, 'monto', monto);
                                                            const cant = parseFloat(a.cantidad) || 0;
                                                            handleAnticipoChange(a.id, 'precio', cant > 0 ? monto / cant : 0);
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className={`w-full bg-white border rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 text-right font-mono ${excedeSaldo ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                                                    />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Placa">
                                                        <input
                                                            type="text"
                                                            value={a.placa}
                                                            placeholder="Placa"
                                                            onChange={(e) => handleAnticipoChange(a.id, 'placa', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-1" data-label="Kilometraje">
                                                        <input
                                                            type="text"
                                                            value={a.kilometraje}
                                                            placeholder="KM"
                                                            onChange={(e) => handleAnticipoChange(a.id, 'kilometraje', e.target.value)}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                    </td>
{estado !== 'cerrado' && (
                                                        <td className="px-1.5 py-1 text-center" data-label="">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveAnticipo(a.id)}
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
                                                <td colSpan={13} className="px-2 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={handleAddAnticipoRow}
                                                            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                            Agregar Anticipo Despachado
                                                        </button>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-slate-500">
                                                                Total Anticipos: <strong className="text-red-600 font-mono text-sm"><Money value={anticiposDespTotal} /></strong>
                                                            </span>
                                                            <button
                                                                onClick={() => handleSaveSection('anticipos')}
                                                                disabled={isSaving}
                                                                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${
                                                                    isDirty
                                                                        ? 'text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/50 animate-pulse'
                                                                        : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                                                }`}
                                                            >
                                                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                                {isSaving ? 'Guardando...' : (isDirty ? 'Guardar Anticipos (Pendiente)' : 'Guardar Anticipos')}
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

export default GasAnticiposModal;
