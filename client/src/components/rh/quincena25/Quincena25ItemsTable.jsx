import { Eye } from 'lucide-react';
import Money, { MoneyInput } from '../../ui/Money';

const Quincena25ItemsTable = ({ model }) => {
    const { selectedYear, setPreviewPeriodo, isLoadingPlanilla, esPagada, filteredItems, handleUpdateItem } = model;
    return (
        <>
            {/* Tabla de Detalle de Nómina */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-cards w-full text-left text-xs text-slate-700 border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="py-3 px-3 w-12 text-center">Nº</th>
                                <th className="py-3 px-3 w-20">Código</th>
                                <th className="py-3 px-3">Empleado</th>
                                <th className="py-3 px-3">Cargo / Depto</th>
                                <th className="py-3 px-3 text-right">Sueldo Base</th>
                                <th className="py-3 px-3 text-center">Antigüedad</th>
                                <th className="py-3 px-3 text-center">Condición</th>
                                <th className="py-3 px-3 text-right">Monto Q25</th>
                                <th className="py-3 px-3 text-right w-24">Ajuste</th>
                                <th className="py-3 px-3 text-right font-black text-indigo-900">Total Pagar</th>
                                <th className="py-3 px-3 w-40">Observaciones</th>
                                <th className="py-3 px-3 text-center w-16">Recibo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingPlanilla ? (
                                <tr>
                                    <td colSpan="12" className="py-12 text-center text-slate-400">
                                        Cargando registros de Quincena 25...
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="12" className="py-12 text-center text-slate-400">
                                        No hay registros para este período. Haz clic en "Calcular Quincena 25" para generar la nómina.
                                    </td>
                                </tr>
                            ) : (
                                (Array.isArray(filteredItems) ? filteredItems : []).map((item, idx) => {
                                    const sueldo = parseFloat(item.sueldo_base || 0);
                                    const esExcluido = sueldo > 1500.00;
                                    const montoQ25 = parseFloat(item.monto_quincena25 || 0);
                                    const netoRecibir = parseFloat(item.monto_recibir || 0);
            
                                    return (
                                        <tr 
                                            key={item.empleado_id || idx}
                                            className={`hover:bg-slate-50/80 transition-colors ${
                                                esExcluido ? 'bg-slate-50/50 opacity-75' : ''
                                            }`}
                                        >
                                            <td data-label="Nº" className="py-3 px-3 text-center text-slate-400 font-medium">
                                                {idx + 1}
                                            </td>
                                            <td data-label="Código" className="py-3 px-3 font-bold text-slate-800">
                                                {item.codigo}
                                            </td>
                                            <td data-label="Empleado" className="py-3 px-3 font-semibold text-slate-900">
                                                {item.nombres} {item.apellidos}
                                            </td>
                                            <td data-label="Cargo / Depto" className="py-3 px-3 text-slate-600">
                                                <div className="truncate max-w-[150px] font-medium">
                                                    {item.cargo_nombre || 'GENERAL'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                                    {item.departamento_nombre || 'GENERAL'}
                                                </div>
                                            </td>
                                            <td data-label="Sueldo Base" className="py-3 px-3 text-right font-bold text-slate-800">
                                                <Money value={sueldo} />
                                            </td>
                                            <td data-label="Antigüedad" className="py-3 px-3 text-center text-slate-600 font-medium text-[11px]">
                                                {item.dias_laborados_anio || 0} días
                                            </td>
                                            <td data-label="Condición" className="py-3 px-3 text-center">
                                                {esExcluido ? (
                                                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
                                                        Excluido (&gt; <Money value={1500} />)
                                                    </span>
                                                ) : item.es_proporcional ? (
                                                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                                                        Proporcional
                                                    </span>
                                                ) : (
                                                    <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                                                        100% de Ley
                                                    </span>
                                                )}
                                            </td>
                                            <td data-label="Monto Q25" className="py-3 px-3 text-right font-medium text-slate-700">
                                                <Money value={montoQ25} />
                                            </td>
                                            <td data-label="Ajuste" className="py-3 px-3 text-right">
                                                {esPagada || esExcluido ? (
                                                    <Money value={parseFloat(item.ajuste || 0)} />
                                                ) : (
                                                    <MoneyInput
                                                        value={item.ajuste ?? 0}
                                                        onChange={(e) => handleUpdateItem(item.empleado_id, 'ajuste', e.target.value)}
                                                        className="w-20 text-right px-1.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                )}
                                            </td>
                                            <td data-label="Total Pagar" className="py-3 px-3 text-right font-black text-indigo-700 text-sm">
                                                <Money value={netoRecibir} />
                                            </td>
                                            <td data-label="Observaciones" className="py-3 px-3">
                                                {esPagada || esExcluido ? (
                                                    <span className="text-[11px] text-slate-500 truncate block max-w-[150px]">
                                                        {item.observaciones || '—'}
                                                    </span>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={item.observaciones || ''}
                                                        onChange={(e) => handleUpdateItem(item.empleado_id, 'observaciones', e.target.value)}
                                                        placeholder="Notas..."
                                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                )}
                                            </td>
                                            <td data-label="Recibo" className="py-3 px-3 text-center">
                                                {!esExcluido && netoRecibir > 0 && (
                                                    <button
                                                        onClick={() => setPreviewPeriodo({
                                                            anio: selectedYear,
                                                            tipo: 'quincena25-recibos',
                                                            empleado_id: item.empleado_id
                                                        })}
                                                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                        title="Ver recibo de pago de este empleado"
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default Quincena25ItemsTable;
