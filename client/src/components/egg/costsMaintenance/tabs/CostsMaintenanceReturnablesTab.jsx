import { getTodayString } from '../../../../utils/dateUtils';
import { formatDate } from '../../../../utils/dateUtils';
import {
    Plus,
    Package,
    RotateCcw,
    CheckCircle2,
    RefreshCw,
    FileText,
    Search,
    Sparkles,
    Layers,
    AlertTriangle
} from 'lucide-react';


export default function CostsMaintenanceReturnablesTab({ model }) {
    const { returnables, loadingReturnables, isSyncingSales, returnableSearch, setReturnableSearch, returnableFilter, setReturnableFilter, setMovementModal, setMovementForm, activeTab, fetchReturnables, syncSalesReturnables, openStatement, openNewCustomerModal } = model;

    return (<>{activeTab === 'returnables' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <RotateCcw className="h-4 w-4 text-emerald-600" />
                                <span>Control de Cubetas y Tapaderas Retornables</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Seguimiento automatizado desde facturas de venta, estado de cuenta por cliente y conciliación de cubetas y tapaderas.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                onClick={syncSalesReturnables}
                                disabled={isSyncingSales}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                                title="Escanear y vincular facturas que contengan cubetas automáticamente"
                            >
                                <Sparkles size={14} className={isSyncingSales ? 'animate-spin text-indigo-600' : 'text-indigo-600'} />
                                <span>{isSyncingSales ? 'Sincronizando...' : 'Sincronizar Facturación Automática'}</span>
                            </button>
                            <button
                                onClick={fetchReturnables}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl border border-slate-200 transition-all"
                                title="Recargar saldos"
                            >
                                <RefreshCw size={15} className={loadingReturnables ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={openNewCustomerModal}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
                            >
                                <Plus size={15} />
                                <span>Registrar Cliente para Envases</span>
                            </button>
                        </div>
                    </div>

                    {/* KPIs de Envases: Cubetas y Tapaderas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(() => {
                            const totalPendingCubetas = returnables.reduce((s, r) => s + (parseInt(r.current_balance) || 0), 0);
                            const totalDeliveredCubetas = returnables.reduce((s, r) => s + (parseInt(r.delivered_qty) || 0), 0);
                            const totalReturnedCubetas = returnables.reduce((s, r) => s + (parseInt(r.returned_qty) || 0), 0);

                            const totalPendingTapaderas = returnables.reduce((s, r) => s + (parseInt(r.current_tapaderas) || 0), 0);
                            const totalDeliveredTapaderas = returnables.reduce((s, r) => s + (parseInt(r.delivered_tapaderas) || 0), 0);
                            const totalReturnedTapaderas = returnables.reduce((s, r) => s + (parseInt(r.returned_tapaderas) || 0), 0);

                            const missingLids = Math.max(0, totalPendingCubetas - totalPendingTapaderas);
                            const returnRateCubetas = totalDeliveredCubetas > 0 ? ((totalReturnedCubetas / totalDeliveredCubetas) * 100).toFixed(1) : '100';

                            return (
                                <>
                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cubetas en Clientes</span>
                                            <Package size={16} className="text-amber-600" />
                                        </div>
                                        <div className="text-2xl font-black text-amber-700 mt-1">{totalPendingCubetas.toLocaleString()} <span className="text-xs font-bold text-amber-600/80">Uds</span></div>
                                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-100 pt-2">
                                            <span>+{totalDeliveredCubetas.toLocaleString()} entregadas</span>
                                            <span>-{totalReturnedCubetas.toLocaleString()} devueltas</span>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tapaderas en Clientes</span>
                                            <Layers size={16} className="text-indigo-600" />
                                        </div>
                                        <div className="text-2xl font-black text-indigo-700 mt-1">{totalPendingTapaderas.toLocaleString()} <span className="text-xs font-bold text-indigo-600/80">Uds</span></div>
                                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-semibold border-t border-slate-100 pt-2">
                                            <span>+{totalDeliveredTapaderas.toLocaleString()} entregadas</span>
                                            <span>-{totalReturnedTapaderas.toLocaleString()} devueltas</span>
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tapaderas Faltantes</span>
                                            <AlertTriangle size={16} className={missingLids > 0 ? 'text-rose-600' : 'text-slate-400'} />
                                        </div>
                                        <div className={`text-2xl font-black mt-1 ${missingLids > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                                            {missingLids.toLocaleString()} <span className="text-xs font-bold">Uds</span>
                                        </div>
                                        <div className="mt-2 text-[10px] text-slate-500 font-medium border-t border-slate-100 pt-2">
                                            {missingLids > 0 ? (
                                                <span className="text-rose-600 font-bold">Diferencia entre cubetas y tapas</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold">Sin descuadre de tapaderas</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasa de Retorno</span>
                                            <CheckCircle2 size={16} className="text-emerald-600" />
                                        </div>
                                        <div className="text-2xl font-black text-emerald-700 mt-1">{returnRateCubetas}%</div>
                                        <div className="mt-2 text-[10px] text-slate-500 font-medium border-t border-slate-100 pt-2">
                                            Recuperación de envases retornables
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Filtros y Buscador de Clientes */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3.5">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                value={returnableSearch}
                                onChange={(e) => setReturnableSearch(e.target.value)}
                                placeholder="Buscar por cliente o código..."
                                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto">
                            <button
                                onClick={() => setReturnableFilter('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    returnableFilter === 'all'
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Todos ({returnables.length})
                            </button>
                            <button
                                onClick={() => setReturnableFilter('pending')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    returnableFilter === 'pending'
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Con Saldo Pendiente ({returnables.filter(r => (parseInt(r.current_balance) || 0) > 0 || (parseInt(r.current_tapaderas) || 0) > 0).length})
                            </button>
                            <button
                                onClick={() => setReturnableFilter('missing_lids')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    returnableFilter === 'missing_lids'
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Con Descuadre de Tapas ({returnables.filter(r => (parseInt(r.missing_tapaderas) || 0) > 0).length})
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Envases y Estados de Cuenta por Cliente */}
                    {(() => {
                        const filtered = returnables.filter(r => {
                            const name = (r.customer_name || r.customer_full_name || '').toLowerCase();
                            const code = (r.customer_code || '').toLowerCase();
                            const matchesQuery = name.includes(returnableSearch.toLowerCase()) || code.includes(returnableSearch.toLowerCase());
                            if (!matchesQuery) return false;

                            if (returnableFilter === 'pending') {
                                return (parseInt(r.current_balance) || 0) > 0 || (parseInt(r.current_tapaderas) || 0) > 0;
                            }
                            if (returnableFilter === 'missing_lids') {
                                return (parseInt(r.missing_tapaderas) || 0) > 0;
                            }
                            return true;
                        });

                        return (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                        Estado de Cuenta de Envases por Cliente ({filtered.length})
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium">Control independiente de Cubetas y Tapaderas</span>
                                </div>

                                {filtered.length === 0 ? (
                                    <div className="p-10 text-center space-y-3">
                                        <Package className="mx-auto text-slate-300" size={36} />
                                        <p className="text-slate-500 text-xs font-semibold">
                                            {returnables.length === 0
                                                ? 'No se han registrado clientes con envases aún. Haga clic en "Sincronizar Facturación Automática" para cargar clientes desde facturas existentes o "Registrar Cliente" para empezar.'
                                                : 'No se encontraron clientes con los filtros aplicados.'}
                                        </p>
                                        {returnables.length === 0 && (
                                            <button
                                                onClick={syncSalesReturnables}
                                                disabled={isSyncingSales}
                                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md shadow-indigo-600/20"
                                            >
                                                <Sparkles size={14} />
                                                <span>Cargar desde Facturas Emitidas</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="px-4 py-3">Cliente</th>
                                                    <th className="px-3 py-3 text-right">Cubetas (+)</th>
                                                    <th className="px-3 py-3 text-right">Cubetas (-)</th>
                                                    <th className="px-4 py-3 text-right">Saldo Cubetas</th>
                                                    <th className="px-3 py-3 text-right">Tapas (+)</th>
                                                    <th className="px-3 py-3 text-right">Tapas (-)</th>
                                                    <th className="px-4 py-3 text-right">Saldo Tapas</th>
                                                    <th className="px-3 py-3 text-center">Descuadre</th>
                                                    <th className="px-3 py-3">Último Mov.</th>
                                                    <th className="px-4 py-3 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {(Array.isArray(filtered) ? filtered : []).map((r) => {
                                                    const cubetasBalance = parseInt(r.current_balance) || 0;
                                                    const tapaderasBalance = parseInt(r.current_tapaderas) || 0;
                                                    const missingTapas = Math.max(0, cubetasBalance - tapaderasBalance);

                                                    return (
                                                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-slate-900 text-xs">
                                                                    {r.customer_full_name || r.customer_name}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                                                                    {r.telefono && <span>Tel: {r.telefono}</span>}
                                                                    {r.dias_credito != null && (
                                                                        <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-bold">
                                                                            Crédito {r.dias_credito}d
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-indigo-700 font-bold">
                                                                +{r.delivered_qty || 0}
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-teal-700 font-bold">
                                                                -{r.returned_qty || 0}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-block ${
                                                                    cubetasBalance > 50
                                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                        : cubetasBalance > 0
                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                }`}>
                                                                    {cubetasBalance} Uds
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-indigo-700 font-bold">
                                                                +{r.delivered_tapaderas || 0}
                                                            </td>
                                                            <td className="px-3 py-3 text-right text-teal-700 font-bold">
                                                                -{r.returned_tapaderas || 0}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <span className={`px-2.5 py-1 rounded-xl text-xs font-black inline-block ${
                                                                    tapaderasBalance > 50
                                                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                        : tapaderasBalance > 0
                                                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                }`}>
                                                                    {tapaderasBalance} Uds
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                {missingTapas > 0 ? (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black inline-flex items-center gap-1 border border-rose-200">
                                                                        <AlertTriangle size={10} />
                                                                        <span>-{missingTapas} Tapas</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-emerald-700 text-[10px] font-bold">
                                                                        Al día
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                                                {formatDate(r.last_movement_date || r.created_at)}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <button
                                                                        onClick={() => openStatement(r)}
                                                                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                                                                        title="Ver Estado de Cuenta detallado tipo Kardex"
                                                                    >
                                                                        <FileText size={13} />
                                                                        <span>Estado de Cuenta</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setMovementModal(r);
                                                                            setMovementForm({
                                                                                movement_type: 'devolucion',
                                                                                cubetas_qty: '',
                                                                                tapaderas_qty: '',
                                                                                movement_date: getTodayString(new Date()),
                                                                                reference_document: '',
                                                                                notes: ''
                                                                            });
                                                                        }}
                                                                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                                                                        title="Registrar devolución o entrega de envases"
                                                                    >
                                                                        <RotateCcw size={13} />
                                                                        <span>Movimiento &plusmn;</span>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}</>);
}
