import { getTodayString } from '../../../utils/dateUtils';
import { formatDate } from '../../../utils/dateUtils';
import {
    XCircle,
    RotateCcw,
    FileText,
    Printer
} from 'lucide-react';


export default function CostsMaintenanceStatementModalModal({ model, open = model.statementModal, onClose = () => {
                                        model.setStatementModal(null);
                                        model.setStatementData(null);
                                    } }) {
    const { statementModal, setStatementModal, statementData, setStatementData, loadingStatement, statementTypeFilter, setStatementTypeFilter, setMovementModal, setMovementForm } = model;
    if (!open) return null;
    return (<>{statementModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-4xl w-full p-3.5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 sm:space-y-5 text-xs my-auto max-h-[94dvh] sm:max-h-[92vh] flex flex-col">
                        {/* Cabecera del Estado de Cuenta */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 sm:pb-4 no-print">
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide truncate">
                                        Estado de Cuenta de Envases
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5 truncate">
                                        {statementModal.customer_name || statementData?.customer?.customer_name}
                                        {statementData?.customer?.telefono && ` • Tel: ${statementData.customer.telefono}`}
                                        {statementData?.customer?.nrc && ` • NRC: ${statementData.customer.nrc}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-end">
                                <button
                                    onClick={() => window.print()}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-200"
                                    title="Imprimir Estado de Cuenta"
                                >
                                    <Printer size={14} />
                                    <span>Imprimir</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setMovementModal(statementModal);
                                        setMovementForm({
                                            movement_type: 'devolucion',
                                            cubetas_qty: '',
                                            tapaderas_qty: '',
                                            movement_date: getTodayString(new Date()),
                                            reference_document: '',
                                            notes: ''
                                        });
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                >
                                    <RotateCcw size={14} />
                                    <span>Registrar Retorno</span>
                                </button>
                                <button
                                    onClick={onClose}
                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg shrink-0"
                                >
                                    <XCircle size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Área imprimible / Contenido */}
                        <div id="statement-printable-area" className="space-y-4 overflow-y-auto flex-1 pr-1">
                            {/* Resumen del cliente para impresión */}
                            <div className="hidden print:block border-b border-slate-300 pb-3 mb-4">
                                <div className="text-sm font-black text-slate-900 uppercase">ANDELSA, S.A. DE C.V. - DIVISIÓN OVOPRODUCTOS</div>
                                <div className="text-xs font-bold text-slate-700 mt-1">ESTADO DE CUENTA DE ENVASES RETORNABLES (CUBETAS Y TAPADERAS)</div>
                                <div className="text-xs text-slate-600 mt-1">
                                    <strong>Cliente:</strong> {statementData?.customer?.customer_name} |
                                    <strong> NRC:</strong> {statementData?.customer?.nrc || 'N/D'} |
                                    <strong> Fecha de Emisión:</strong> {formatDate(new Date())}
                                </div>
                                <div className="text-xs text-slate-700 mt-1">
                                    <strong>Histórico Entregado:</strong> {statementData?.summary?.delivered_cubetas_30lb || 0} cubetas de 30 LB | {statementData?.summary?.delivered_cubetas_32lb || 0} cubetas de 32 LB |
                                    <strong> Saldo Actual:</strong> {statementData?.summary?.current_cubetas || 0} cubetas / {statementData?.summary?.current_tapaderas || 0} tapaderas |
                                    <strong className={statementData?.summary?.missing_tapaderas > 0 ? 'text-red-700' : 'text-slate-700'}> Tapas Faltantes:</strong> {statementData?.summary?.missing_tapaderas || 0}
                                </div>
                            </div>

                            {/* Tarjetas métricas del cliente */}
                            {statementData?.summary && (
                                <div className="space-y-2.5">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5">
                                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Saldo Cubetas</span>
                                            <div className="text-xl font-black text-amber-900 mt-0.5">
                                                {statementData.summary.current_cubetas} <span className="text-xs font-bold">Uds</span>
                                            </div>
                                            <span className="text-[10px] text-amber-700/80 font-medium block mt-1">
                                                +{statementData.summary.delivered_cubetas} ent. / -{statementData.summary.returned_cubetas} dev.
                                            </span>
                                        </div>

                                        <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5">
                                            <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Saldo Tapaderas</span>
                                            <div className="text-xl font-black text-indigo-900 mt-0.5">
                                                {statementData.summary.current_tapaderas} <span className="text-xs font-bold">Uds</span>
                                            </div>
                                            <span className="text-[10px] text-indigo-700/80 font-medium block mt-1">
                                                +{statementData.summary.delivered_tapaderas} ent. / -{statementData.summary.returned_tapaderas} dev.
                                            </span>
                                        </div>

                                        <div className={`rounded-xl p-3.5 border ${
                                            statementData.summary.missing_tapaderas > 0
                                                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                        }`}>
                                            <span className="text-[10px] font-bold uppercase tracking-wider block">Descuadre Tapas</span>
                                            <div className="text-xl font-black mt-0.5">
                                                {statementData.summary.missing_tapaderas > 0 ? `-${statementData.summary.missing_tapaderas}` : '0'}{' '}
                                                <span className="text-xs font-bold">Uds</span>
                                            </div>
                                            <span className="text-[10px] font-medium block mt-1">
                                                {statementData.summary.missing_tapaderas > 0 ? 'Faltan tapaderas por retornar' : 'Saldos perfectamente cuadrados'}
                                            </span>
                                        </div>

                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Tasa de Retorno</span>
                                            <div className="text-xl font-black text-teal-800 mt-0.5">
                                                {statementData.summary.return_rate_cubetas}%
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium block mt-1">
                                                Eficiencia de devolución del cliente
                                            </span>
                                        </div>
                                    </div>

                                    {/* Desglose informativo de presentaciones entregadas (30 LB vs 32 LB) */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs no-print">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-600 uppercase">Histórico Entregado por Presentación:</span>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100/90 text-amber-900 border border-amber-300 font-bold text-[11px]">
                                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                                30 LB: {statementData.summary.delivered_cubetas_30lb || 0} cubetas
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-100/90 text-blue-900 border border-blue-300 font-bold text-[11px]">
                                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                32 LB: {statementData.summary.delivered_cubetas_32lb || 0} cubetas
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            * Mismo envase plástico y tapadera hermética universal
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Filtro de tipos de movimiento */}
                            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 no-print">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filtrar:</span>
                                    <button
                                        onClick={() => setStatementTypeFilter('all')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            statementTypeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Todos
                                    </button>
                                    <button
                                        onClick={() => setStatementTypeFilter('entrega')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            statementTypeFilter === 'entrega' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Entregas / Facturas (+)
                                    </button>
                                    <button
                                        onClick={() => setStatementTypeFilter('devolucion')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            statementTypeFilter === 'devolucion' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Devoluciones a Planta (-)
                                    </button>
                                </div>
                                <span className="text-[11px] text-slate-500 font-medium">
                                    {statementData?.movements?.length || 0} movimientos registrados
                                </span>
                            </div>

                            {/* Tabla de Movimientos Tipo Kardex */}
                            {loadingStatement ? (
                                <div className="p-8 text-center text-slate-500 font-semibold animate-pulse">
                                    Cargando estado de cuenta detallado...
                                </div>
                            ) : !statementData?.movements || statementData.movements.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-200">
                                    No hay movimientos registrados para este cliente aún.
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                                                <th className="px-3 py-2.5">Fecha</th>
                                                <th className="px-3 py-2.5">Tipo</th>
                                                <th className="px-3 py-2.5">Documento / Referencia</th>
                                                <th className="px-3 py-2.5 text-right bg-amber-50/50">Cub. Ent. (+)</th>
                                                <th className="px-3 py-2.5 text-right bg-amber-50/50">Cub. Dev. (-)</th>
                                                <th className="px-3 py-2.5 text-right bg-amber-100/50 font-black">Saldo Cub.</th>
                                                <th className="px-3 py-2.5 text-right bg-indigo-50/50">Tap. Ent. (+)</th>
                                                <th className="px-3 py-2.5 text-right bg-indigo-50/50">Tap. Dev. (-)</th>
                                                <th className="px-3 py-2.5 text-right bg-indigo-100/50 font-black">Saldo Tap.</th>
                                                <th className="px-3 py-2.5">Notas / Responsable</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                            {(Array.isArray(statementData.movements
                                                .filter(m => statementTypeFilter === 'all' || m.movement_type === statementTypeFilter)) ? statementData.movements
                                                .filter(m => statementTypeFilter === 'all' || m.movement_type === statementTypeFilter) : [])
                                                .map((m) => (
                                                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                                                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                                                            {formatDate(m.movement_date)}
                                                        </td>
                                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                m.movement_type === 'entrega'
                                                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                                                    : m.movement_type === 'devolucion'
                                                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                            }`}>
                                                                {m.movement_type === 'entrega' ? 'Entrega Factura' : (m.movement_type === 'devolucion' ? 'Devolución' : m.movement_type)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-slate-900 font-bold">
                                                            <div>{m.reference_document || (m.sale_id ? `Venta #${m.sale_id}` : 'S/R')}</div>
                                                            {m.movement_type === 'entrega' && (m.cubetas_30lb > 0 || m.cubetas_32lb > 0) && (
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    {m.cubetas_30lb > 0 && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                                            {m.cubetas_30lb} cbt 30LB
                                                                        </span>
                                                                    )}
                                                                    {m.cubetas_32lb > 0 && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                                                            {m.cubetas_32lb} cbt 32LB
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-indigo-700 font-bold bg-amber-50/30">
                                                            {m.cubetas_delivered > 0 ? `+${m.cubetas_delivered}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-teal-700 font-bold bg-amber-50/30">
                                                            {m.cubetas_returned > 0 ? `-${m.cubetas_returned}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-black text-amber-900 bg-amber-100/40">
                                                            {m.cubetas_balance}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-indigo-700 font-bold bg-indigo-50/30">
                                                            {m.tapaderas_delivered > 0 ? `+${m.tapaderas_delivered}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-teal-700 font-bold bg-indigo-50/30">
                                                            {m.tapaderas_returned > 0 ? `-${m.tapaderas_returned}` : '-'}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-black text-indigo-900 bg-indigo-100/40">
                                                            {m.tapaderas_balance}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-[11px] text-slate-600 max-w-xs truncate" title={m.notes || ''}>
                                                            {m.notes || 'Sin observaciones'}
                                                            {m.registered_by && <span className="block text-[9px] text-slate-400 font-medium">Por: {m.registered_by}</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Pie de modal */}
                        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200 no-print">
                            <button
                                type="button"
                                onClick={() => {
                                    setStatementModal(null);
                                    setStatementData(null);
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all text-center"
                            >
                                Cerrar Estado de Cuenta
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
