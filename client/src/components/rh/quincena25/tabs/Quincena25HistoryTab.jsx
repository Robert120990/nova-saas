import Money from '../../../ui/Money';
import { formatDate } from '../../../../utils/dateUtils';

const Quincena25HistoryTab = ({ model }) => {
    const { resumen, isLoadingResumen, openHistory } = model;
    return (
        <>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4">
                <div>
                    <h3 className="text-base font-bold text-slate-900">Historial Consolidado de Quincena 25</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Registro histórico de emisiones anuales de la Planilla 25 y totales dispersados.
                    </p>
                </div>
            
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="py-3 px-4">Ejercicio Fiscal</th>
                                <th className="py-3 px-4">Departamento</th>
                                <th className="py-3 px-4 text-center">Total Empleados</th>
                                <th className="py-3 px-4 text-center">Beneficiarios</th>
                                <th className="py-3 px-4 text-right">Monto Dispersado</th>
                                <th className="py-3 px-4 text-center">Estado</th>
                                <th className="py-3 px-4 text-center">Fecha Pago</th>
                                <th className="py-3 px-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoadingResumen ? (
                                <tr>
                                    <td colSpan="8" className="py-8 text-center text-slate-400">
                                        Cargando historial...
                                    </td>
                                </tr>
                            ) : resumen.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-8 text-center text-slate-400">
                                        No hay registros históricos de Quincena 25.
                                    </td>
                                </tr>
                            ) : (
                                (Array.isArray(resumen) ? resumen : []).map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-4 font-black text-slate-900">
                                            {r.periodo_anio}
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 font-medium">
                                            {r.departamento_nombre || 'Todos'}
                                        </td>
                                        <td className="py-3 px-4 text-center font-semibold text-slate-800">
                                            {r.total_empleados}
                                        </td>
                                        <td className="py-3 px-4 text-center font-semibold text-emerald-700">
                                            {r.total_beneficiarios}
                                        </td>
                                        <td className="py-3 px-4 text-right font-black text-indigo-700">
                                            <Money value={r.total_monto} />
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {r.estado === 'pagada' ? (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                                                    Pagada
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                                    Borrador
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center text-slate-500 font-medium">
                                            {r.fecha_pago ? formatDate(r.fecha_pago) : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <button
                                                onClick={() => openHistory(r)}
                                                className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                            >
                                                Abrir
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default Quincena25HistoryTab;
