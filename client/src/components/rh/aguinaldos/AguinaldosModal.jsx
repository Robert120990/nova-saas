import Modal from '../../ui/Modal';
import Money from '../../ui/Money';
import { Calculator, Save, Gift, AlertCircle, FileText, ReceiptText } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

const AguinaldosModal = ({ open, onClose, onSubmit, model }) => {
    const { calcAño, calcMes, calcDeptoId, calculado, calculando, yaExiste, deptos, years, months, handleCalcular, setPreviewPeriodo, saveMutation, changeFilter, canSave } = model;
    if (!open) return null;
    return (
        <>
            <Modal isOpen={open} onClose={onClose}
                title="Planilla de Aguinaldos" maxWidth="max-w-5xl">
                <div className="space-y-3 pb-2">
                    {/* Filters in modal */}
                    <div className="flex flex-wrap gap-2 items-end">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">Año</label>
                            <select value={calcAño} onChange={e => changeFilter('year', parseInt(e.target.value))}
                                className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-xs">
                                {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">Mes</label>
                            <select value={calcMes} onChange={e => changeFilter('month', parseInt(e.target.value))}
                                className="w-24 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-xs">
                                {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 block">Departamento</label>
                            <select value={calcDeptoId} onChange={e => changeFilter('department', e.target.value)}
                                className="w-44 px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-xs">
                                <option value="">TODOS</option>
                                {(Array.isArray(deptos) ? deptos : []).map(d => <option key={d.id} value={d.id}>{d.descripcion}</option>)}
                            </select>
                        </div>
                        <button type="button" onClick={handleCalcular} disabled={calculando || !calcAño}
                            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 h-8">
                            <Calculator size={14} />
                            {calculando ? 'Calculando...' : 'Calcular'}
                        </button>
                    </div>
            
                    {yaExiste && calculado.length > 0 && (
                        <div className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex-wrap">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                                <span className="text-[10px] font-bold text-amber-700">Planilla guardada para este período.</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setPreviewPeriodo({
                                        anio: calcAño,
                                        mes: calcMes,
                                        departamento_id: calcDeptoId || undefined,
                                        departamento_nombre: deptos.find(d => String(d.id) === String(calcDeptoId))?.descripcion,
                                        tipo: 'aguinaldo'
                                    })}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 rounded-lg font-bold text-[11px] transition-colors border border-indigo-200 shadow-sm"
                                >
                                    <FileText size={13} />
                                    <span>Ver PDF Planilla</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewPeriodo({
                                        anio: calcAño,
                                        mes: calcMes,
                                        departamento_id: calcDeptoId || undefined,
                                        departamento_nombre: deptos.find(d => String(d.id) === String(calcDeptoId))?.descripcion,
                                        tipo: 'aguinaldo-recibos'
                                    })}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-purple-50 text-purple-700 rounded-lg font-bold text-[11px] transition-colors border border-purple-200 shadow-sm"
                                >
                                    <ReceiptText size={13} />
                                    <span>Ver PDF Recibos</span>
                                </button>
                            </div>
                        </div>
                    )}
            
                    {/* Table */}
                    {calculado.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                            <table className="w-full text-[12px] whitespace-nowrap">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-12">Codigo</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] max-w-[180px]">Nombre</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] max-w-[120px]">Cargo</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">F. Ingreso</th>
                                        <th className="text-left px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">F. Base</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-10">Dias</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-10">Tabla</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">Aguinaldo</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">Excedente</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-12">Renta</th>
                                        <th className="text-right px-1.5 py-1 font-bold text-slate-500 uppercase text-[9px] w-16">Recibir</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Array.isArray(calculado) ? calculado : []).map((item, i) => (
                                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                             <td className="px-1.5 py-0.5 font-mono font-bold text-indigo-500">{item.codigo}</td>
                                            <td className="px-1.5 py-0.5 font-bold text-slate-700 max-w-[180px] truncate">{item.nombres} {item.apellidos}</td>
                                            <td className="px-1.5 py-0.5 text-slate-500 max-w-[120px] truncate">{item.cargo_nombre || '-'}</td>
                                            <td className="px-1.5 py-0.5 text-slate-500">{formatDate(item.fecha_ingreso)}</td>
                                            <td className="px-1.5 py-0.5 text-slate-500">{formatDate(item.fecha_base)}</td>
                                            <td className="px-1.5 py-0.5 text-right text-slate-600">{item.dias_antiguedad}</td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-slate-700">{item.dias_segun_tabla}</td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-indigo-600"><Money value={item.aguinaldo_calculado} /></td>
                                            <td className="px-1.5 py-0.5 text-right text-slate-600"><Money value={item.excedente} /></td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-red-600"><Money value={item.renta} /></td>
                                            <td className="px-1.5 py-0.5 text-right font-bold text-emerald-600"><Money value={item.monto_recibir} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            
                    {calculado.length === 0 && !calculando && (
                        <div className="py-10 text-center">
                            <Gift size={24} className="mx-auto text-slate-300 mb-1" />
                            <p className="text-[10px] font-bold text-slate-400">Seleccione filtros y presione Calcular</p>
                        </div>
                    )}
            
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                        {calculado.length > 0 && !yaExiste && (
                            <button type="button" onClick={onSubmit} disabled={!canSave || saveMutation.isPending}
                                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50">
                                <Save size={14} />
                                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                            </button>
                        )}
                        <button type="button" onClick={onClose}
                            className="px-4 py-1.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs">Cerrar</button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default AguinaldosModal;
