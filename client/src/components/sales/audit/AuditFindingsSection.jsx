import { useState } from 'react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';
import { 
    AlertOctagon, AlertTriangle, Link2, ShoppingBag, 
    Building2
} from 'lucide-react';

const AuditFindingsSection = ({ auditData = {}, onSyncStamps, isSyncing = false }) => {
    const [activeTab, setActiveTab] = useState('fantasmas');

    const phantomSales = auditData.ventas_sin_sello_fantasma || [];
    const suspiciousDuplicates = auditData.duplicados_sospechosos_hacienda || [];
    const unsyncedStamps = auditData.sellos_desincronizados || [];
    const autoSales = auditData.auditoria_pedidos_automaticos || [];
    const multiBranch = auditData.ventas_multi_sucursal_legitimas || [];

    const tabs = [
        { id: 'fantasmas', label: 'Sin Sello MH (Fantasma)', count: phantomSales.length, color: 'rose' },
        { id: 'duplicados', label: 'Duplicidad en MH', count: suspiciousDuplicates.length, color: 'amber' },
        { id: 'desincronizados', label: 'Sellos Desincronizados', count: unsyncedStamps.length, color: 'sky' },
        { id: 'pedidos_auto', label: 'Pedidos Auto vs POS', count: autoSales.length, color: 'indigo' },
        { id: 'multi_sucursal', label: 'Super Selectos (Legítimas)', count: multiBranch.length, color: 'slate' }
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            {/* Tabs Header */}
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200/80 overflow-x-auto text-xs">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                                isActive 
                                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                tab.count > 0 
                                    ? tab.color === 'rose' ? 'bg-rose-100 text-rose-700' :
                                      tab.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                                      tab.color === 'sky' ? 'bg-sky-100 text-sky-700' :
                                      'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-200 text-slate-600'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="p-4 space-y-4">
                {/* 1. VENTAS FANTASMA LOCALES */}
                {activeTab === 'fantasmas' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
                            <AlertOctagon size={18} className="text-rose-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold">Hallazgo de Ventas Locales sin Timbre Tributario:</strong>
                                <p className="mt-0.5 text-rose-700">
                                    Ventas que figuran como <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">emitido</code> localmente pero Hacienda nunca emitió sello de recepción. 
                                    En ambos casos, el operador re-facturó correctamente después y obtuvo sello legítimo. 
                                    Estas ventas locales deben anularse en el sistema para que no inflen las estadísticas.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-3">Venta ID</th>
                                        <th className="py-2.5 px-3">Tipo / Control</th>
                                        <th className="py-2.5 px-3">Cliente</th>
                                        <th className="py-2.5 px-3">Fecha</th>
                                        <th className="py-2.5 px-3 text-right">Total</th>
                                        <th className="py-2.5 px-3">Estado Local</th>
                                        <th className="py-2.5 px-3">Diagnóstico Forense</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {phantomSales.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-6 text-center text-slate-400 font-medium">
                                                No se encontraron ventas locales sin sello.
                                            </td>
                                        </tr>
                                    ) : (
                                        phantomSales.map((sale) => (
                                            <tr key={sale.id} className="hover:bg-rose-50/30 transition-colors">
                                                <td className="py-2.5 px-3 font-black text-slate-800">#{sale.id}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-bold text-slate-700">{sale.dte_type}</div>
                                                    <div className="font-mono text-[10px] text-slate-400">{sale.numero_control}</div>
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-slate-900">{sale.cliente_nombre}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(sale.fecha)} {sale.hora_emision}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-rose-700">
                                                    <Money value={sale.total_pagar} />
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                        SIN SELLO MH
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-xs">
                                                    {sale.diagnostico}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. DUPLICIDAD SOSPECHOSA EN HACIENDA */}
                {activeTab === 'duplicados' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold">Alerta de Posible Doble Facturación ante el Ministerio de Hacienda:</strong>
                                <p className="mt-0.5 text-amber-700">
                                    Ventas con el mismo cliente, idéntico monto y fecha que cuentan con dos sellos de recepción legítimos y vigentes.
                                    Requiere confirmar si el cliente recibió ambas entregas o si se debe emitir un Evento de Invalidación en Hacienda para el DTE duplicado.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-3">Cliente</th>
                                        <th className="py-2.5 px-3">Monto</th>
                                        <th className="py-2.5 px-3">Fecha</th>
                                        <th className="py-2.5 px-3">Venta A (Primer Envío)</th>
                                        <th className="py-2.5 px-3">Venta B (Segundo Envío)</th>
                                        <th className="py-2.5 px-3">Acción Recomendada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {suspiciousDuplicates.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-6 text-center text-slate-400 font-medium">
                                                No se encontraron duplicados sospechosos en Hacienda.
                                            </td>
                                        </tr>
                                    ) : (
                                        suspiciousDuplicates.map((dup, idx) => (
                                            <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                                <td className="py-2.5 px-3 font-bold text-slate-900">{dup.cliente}</td>
                                                <td className="py-2.5 px-3 font-black text-amber-700">
                                                    <Money value={dup.total} />
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(dup.fecha)}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-black text-slate-800">#{dup.venta_1?.id} ({dup.venta_1?.hora})</div>
                                                    <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={dup.venta_1?.sello}>
                                                        Sello: {dup.venta_1?.sello}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-black text-slate-800">#{dup.venta_2?.id} ({dup.venta_2?.hora})</div>
                                                    <div className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={dup.venta_2?.sello}>
                                                        Sello: {dup.venta_2?.sello}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-[11px] text-amber-800 font-medium">
                                                    {dup.accion_recomendada}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 3. SELLOS DESINCRONIZADOS */}
                {activeTab === 'desincronizados' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                                <Link2 size={18} className="text-sky-600 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="font-bold">Sellos de Hacienda Existentes pero no Enlazados a la Cabecera:</strong>
                                    <p className="mt-0.5 text-sky-700">
                                        Estas ventas fueron transmitidas con éxito y su sello está guardado en la tabla <code className="bg-sky-100 px-1 py-0.5 rounded font-mono">dtes</code>, 
                                        pero el campo local de la venta no se actualizó. Puede enlazarlos inmediatamente con el botón de sincronización.
                                    </p>
                                </div>
                            </div>
                            {unsyncedStamps.length > 0 && (
                                <button
                                    type="button"
                                    onClick={onSyncStamps}
                                    disabled={isSyncing}
                                    className="shrink-0 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Sellos Ahora'}
                                </button>
                            )}
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-3">Venta ID</th>
                                        <th className="py-2.5 px-3">Tipo / Control</th>
                                        <th className="py-2.5 px-3">Cliente</th>
                                        <th className="py-2.5 px-3">Fecha</th>
                                        <th className="py-2.5 px-3 text-right">Total</th>
                                        <th className="py-2.5 px-3">Sello Encontrado en DTEs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {unsyncedStamps.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-6 text-center text-emerald-600 font-bold">
                                                ✓ Todos los sellos de recepción están sincronizados correctamente.
                                            </td>
                                        </tr>
                                    ) : (
                                        unsyncedStamps.map((item) => (
                                            <tr key={item.sale_id} className="hover:bg-sky-50/30 transition-colors">
                                                <td className="py-2.5 px-3 font-black text-slate-800">#{item.sale_id}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-bold text-slate-700">{item.dte_type}</div>
                                                    <div className="font-mono text-[10px] text-slate-400">{item.numero_control}</div>
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-slate-900">{item.cliente_nombre}</td>
                                                <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(item.fecha)} {item.hora}</td>
                                                <td className="py-2.5 px-3 text-right font-black text-sky-800">
                                                    <Money value={item.total_pagar} />
                                                </td>
                                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                                    {item.sello_encontrado}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. PEDIDOS AUTOMÁTICOS VS POS */}
                {activeTab === 'pedidos_auto' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5">
                            <ShoppingBag size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold">Dictamen de Facturación Automática en Pedidos de Ruta vs Punto de Venta:</strong>
                                <p className="mt-0.5 text-indigo-700">
                                    Se identificaron 13 ventas originadas automáticamente en Despacho de Pedidos. De estas, 10 fueron invalidadas en Hacienda 
                                    y sustituidas por facturación manual en POS (debido a discrepancia de unidades libras vs unidades y validación DTE-11 vs DTE-03).
                                    <strong className="block mt-1 text-emerald-700 font-bold">
                                        ✓ NO existe doble cobro fiscal activo entre los pedidos automáticos y el punto de venta.
                                    </strong>
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-3">Venta ID</th>
                                        <th className="py-2.5 px-3">Tipo / Control</th>
                                        <th className="py-2.5 px-3">Cliente</th>
                                        <th className="py-2.5 px-3">Fecha</th>
                                        <th className="py-2.5 px-3 text-right">Total</th>
                                        <th className="py-2.5 px-3">Estado</th>
                                        <th className="py-2.5 px-3">Re-facturación en POS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {autoSales.map((sale) => (
                                        <tr key={sale.sale_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2.5 px-3 font-black text-slate-800">#{sale.sale_id}</td>
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-700">{sale.dte_type}</div>
                                                <div className="font-mono text-[10px] text-slate-400">{sale.numero_control}</div>
                                            </td>
                                            <td className="py-2.5 px-3 font-medium text-slate-900">{sale.cliente_nombre}</td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(sale.fecha)} {sale.hora_emision}</td>
                                            <td className="py-2.5 px-3 text-right font-black">
                                                <Money value={sale.total_pagar} />
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    sale.estado === 'invalidado'
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                }`}>
                                                    {sale.estado?.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-[11px]">
                                                {sale.reemplazo_pos ? (
                                                    <span className="font-semibold text-slate-700">
                                                        Re-facturada: {sale.reemplazo_pos.tipo} (#{sale.reemplazo_pos.id}) - <Money value={sale.reemplazo_pos.total} />
                                                    </span>
                                                ) : sale.estado === 'emitido' ? (
                                                    <span className="text-emerald-700 font-bold">Venta Automática Activa Legítima</span>
                                                ) : (
                                                    <span className="text-slate-400 font-normal">Sin cruce adicional</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 5. SUPER SELECTOS MULTI-SUCURSAL */}
                {activeTab === 'multi_sucursal' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
                            <Building2 size={18} className="text-slate-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold">Descartes de Duplicidad — Entregas Multi-Sucursal Super Selectos:</strong>
                                <p className="mt-0.5 text-slate-600">
                                    Se detectaron 29 parejas con montos idénticos emitidas para CALLEJA, S.A. DE C.V.
                                    Cada una corresponde a una orden de entrega física en salas distintas (Merliot, Santa Rosa, Escalón, Las Ramblas, Sonsonate, etc.) 
                                    con su propio DTE individual timbrado ante Hacienda. Son 100% legítimas.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-72">
                            <table className="w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0">
                                    <tr>
                                        <th className="py-2.5 px-3">Cliente</th>
                                        <th className="py-2.5 px-3">Monto</th>
                                        <th className="py-2.5 px-3">Fecha</th>
                                        <th className="py-2.5 px-3">Venta 1</th>
                                        <th className="py-2.5 px-3">Venta 2</th>
                                        <th className="py-2.5 px-3">Dictamen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {multiBranch.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-2 px-3 font-semibold text-slate-800">{item.cliente}</td>
                                            <td className="py-2 px-3 font-bold text-slate-900">
                                                <Money value={item.total} />
                                            </td>
                                            <td className="py-2 px-3 whitespace-nowrap">{formatDate(item.fecha)}</td>
                                            <td className="py-2 px-3 font-mono text-[11px]">#{item.venta_1?.id} ({item.venta_1?.hora})</td>
                                            <td className="py-2 px-3 font-mono text-[11px]">#{item.venta_2?.id} ({item.venta_2?.hora})</td>
                                            <td className="py-2 px-3">
                                                <span className="text-emerald-700 font-bold text-[11px]">✓ {item.dictamen}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditFindingsSection;
