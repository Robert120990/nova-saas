import { useState } from 'react';
import { X, Package, FileText, TrendingUp, DollarSign } from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

export default function EggSalesCustomerDetailModal({ open, onClose, customer }) {
    const [subTab, setSubTab] = useState('products');

    if (!open || !customer) return null;

    const products = Array.isArray(customer.products) ? customer.products : [];
    const invoices = Array.isArray(customer.invoices) ? customer.invoices : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                {/* Cabecera */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                                Cliente
                            </span>
                            <h2 className="text-lg font-bold text-slate-800 truncate max-w-md sm:max-w-xl">
                                {customer.customer_name}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            NIT: {customer.customer_nit !== 'N/A' ? customer.customer_nit : 'N/A'} • NRC: {customer.customer_nrc || 'N/A'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                        title="Cerrar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Métricas / KPIs del cliente */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px]">
                            <Package className="w-3.5 h-3.5 text-indigo-600" />
                            {customer.is_only_shell ? 'Volumen Cáscara' : 'Total Libras (Ovop.)'}
                        </div>
                        <p className="text-base font-bold text-slate-800 mt-1">
                            {customer.is_only_shell ? (
                                <span className="text-amber-800 text-sm font-semibold">{customer.display_quantity}</span>
                            ) : (
                                <>{Number(customer.total_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-normal text-slate-500">Lb</span></>
                            )}
                        </p>
                        {!customer.is_only_shell && customer.shell_amount > 0 && (
                            <span className="block text-[10px] text-amber-700 font-medium mt-0.5">+ {customer.shell_boxes > 0 ? `${customer.shell_boxes} Cajas` : `${customer.shell_units} Unid`}</span>
                        )}
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px]">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            Total Facturado
                        </div>
                        <p className="text-base font-bold text-emerald-700 mt-1">
                            <Money value={customer.total_amount} />
                        </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px]">
                            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                            {customer.is_only_shell ? 'Precio Promedio' : 'Prom. Ovop. ($/Lb)'}
                        </div>
                        <p className="text-base font-bold text-amber-700 mt-1">
                            {customer.is_only_shell ? (
                                customer.avg_price_display
                            ) : (
                                <><Money value={customer.avg_price} /> <span className="text-xs font-normal text-slate-500">/Lb</span></>
                            )}
                        </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm">
                        <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px]">
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            Líneas Facturadas
                        </div>
                        <p className="text-base font-bold text-slate-800 mt-1">
                            {customer.sales_count || 0}
                        </p>
                    </div>
                </div>

                {/* Sub-navegación de pestañas */}
                <div className="flex border-b border-slate-200 px-6 bg-white gap-4 text-xs font-bold">
                    <button
                        onClick={() => setSubTab('products')}
                        className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                            subTab === 'products'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Package className="w-4 h-4" />
                        Productos Comprados ({products.length})
                    </button>
                    <button
                        onClick={() => setSubTab('invoices')}
                        className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
                            subTab === 'invoices'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        Facturación y DTEs ({invoices.length})
                    </button>
                </div>

                {/* Contenido scrolleable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {subTab === 'products' ? (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="p-3">Producto / Categoría</th>
                                        <th className="p-3 text-right">Volumen</th>
                                        <th className="p-3 text-right">Monto Total ($)</th>
                                        <th className="p-3 text-right">Precio Promedio</th>
                                        <th className="p-3 text-right">% del Cliente</th>
                                        <th className="p-3 text-right">Transacciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {products.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 font-semibold text-slate-800">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{p.product_name}</span>
                                                    {p.is_shell && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">Cáscara</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-700 tabular-nums">
                                                {p.is_shell ? (
                                                    <span className="inline-block font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                                                        {p.display_quantity}
                                                    </span>
                                                ) : (
                                                    <>{Number(p.lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-[10px] text-slate-400">Lb</span></>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-800">
                                                <Money value={p.amount} />
                                            </td>
                                            <td className="p-3 text-right font-bold text-amber-700">
                                                {p.is_shell ? (p.avg_price_display || `$${p.avg_price}`) : (
                                                    <><Money value={p.avg_price} /><span className="text-[10px] font-normal text-slate-500 ml-0.5">/Lb</span></>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-600">
                                                {p.is_shell ? '—' : (p.pct_of_customer_lbs ? `${p.pct_of_customer_lbs}%` : '-')}
                                            </td>
                                            <td className="p-3 text-right text-slate-500">
                                                {p.transactions_count || 1}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Tipo</th>
                                        <th className="p-3">Comprobante / DTE</th>
                                        <th className="p-3">Descripción</th>
                                        <th className="p-3 text-right">Cant.</th>
                                        <th className="p-3 text-right">Libras</th>
                                        <th className="p-3 text-right">Precio Unit.</th>
                                        <th className="p-3 text-right">Total ($)</th>
                                        <th className="p-3 text-right">Precio / Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoices.map((inv, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-3 whitespace-nowrap text-slate-600">
                                                {formatDate(inv.fecha_emision)}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">
                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                    inv.tipo_documento === '03' ? 'bg-purple-100 text-purple-700' :
                                                    (inv.tipo_documento === '11' ? 'bg-emerald-100 text-emerald-700' :
                                                    (inv.tipo_documento === '04' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-700'))
                                                }`}>
                                                    {inv.tipo_documento === '03' ? 'CCF' : (inv.tipo_documento === '11' ? 'FEX' : (inv.tipo_documento === '04' ? 'REM (04)' : 'FAC'))}
                                                </span>
                                            </td>
                                            <td className="p-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                                                <div>{inv.numero_control || (inv.codigo_generacion ? `${inv.codigo_generacion.substring(0, 13)}...` : `#${inv.sale_id}`)}</div>
                                                {inv.linked_remisiones && (
                                                    <div className="text-[10px] text-indigo-600 font-sans font-medium truncate max-w-[180px]" title={`Remisiones liquidadas: ${inv.linked_remisiones}`}>
                                                        🔗 Rem: {inv.linked_remisiones}
                                                    </div>
                                                )}
                                                {inv.tipo_documento === '04' && (
                                                    <div className="text-[10px] text-amber-600 font-sans font-medium">
                                                        ⏳ Pendiente de facturar
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-700 max-w-xs truncate" title={inv.descripcion}>
                                                {inv.descripcion}
                                            </td>
                                            <td className="p-3 text-right text-slate-600">
                                                {inv.cantidad} <span className="text-[10px] text-slate-400">{inv.unit_label || (inv.is_shell ? 'U' : 'Lb')}</span>
                                            </td>
                                            <td className="p-3 text-right font-medium text-slate-800">
                                                {inv.is_shell ? <span className="text-slate-400">—</span> : Number(inv.lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                            </td>
                                            <td className="p-3 text-right text-slate-600">
                                                <Money value={inv.precio_unitario} />
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-800">
                                                <Money value={inv.amount} />
                                            </td>
                                            <td className="p-3 text-right font-semibold text-amber-700">
                                                {inv.is_shell ? (
                                                    <><Money value={inv.precio_unitario} /><span className="text-[10px] font-normal text-slate-500 ml-0.5">/{inv.unit_label || 'U'}</span></>
                                                ) : (
                                                    <><Money value={inv.avg_price} /><span className="text-[10px] font-normal text-slate-500 ml-0.5">/Lb</span></>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pie de modal */}
                <div className="flex justify-end items-center px-6 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
