import { ExternalLink } from 'lucide-react';
import Money from '../../ui/Money';

/**
 * Subcomponente de Desglose en Acordeón para filas de Ventas por Producto o Cliente.
 */
export default function EggSalesRowAccordion({ row, isProduct, onOpenCustomerModal }) {
    if (isProduct) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-700 uppercase">
                        Clientes que compraron {row.product_name} ({row.customers?.length || 0})
                    </span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-100/80 text-slate-600 text-[10px] font-bold uppercase">
                            <tr>
                                <th className="p-2.5 text-left">Cliente</th>
                                <th className="p-2.5 text-right">Volumen</th>
                                <th className="p-2.5 text-right">Monto ($)</th>
                                <th className="p-2.5 text-right text-amber-800">Precio Prom.</th>
                                <th className="p-2.5 text-right">% del Producto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(row.customers || []).map((c, cIdx) => (
                                <tr key={cIdx} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-medium text-slate-800">{c.customer_name}</td>
                                    <td className="p-2.5 text-right text-slate-700 tabular-nums">
                                        {c.is_shell ? c.display_quantity : `${Number(c.lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`}
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-slate-800 tabular-nums">
                                        <Money value={c.amount} />
                                    </td>
                                    <td className="p-2.5 text-right font-bold text-amber-700 tabular-nums">
                                        {c.is_shell ? (c.avg_price_display || `$${c.avg_price}`) : <Money value={c.avg_price} />}
                                    </td>
                                    <td className="p-2.5 text-right text-slate-500 tabular-nums">{c.is_shell ? '—' : `${c.pct_of_product_lbs}%`}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 uppercase">
                    Desglose de productos vendidos a este cliente
                </span>
                <button
                    type="button"
                    onClick={() => onOpenCustomerModal(row)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                >
                    Ver DTEs y facturas completas <ExternalLink className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 text-[10px] font-bold uppercase">
                        <tr>
                            <th className="p-2.5 text-left">Producto</th>
                            <th className="p-2.5 text-right">Volumen</th>
                            <th className="p-2.5 text-right">Monto ($)</th>
                            <th className="p-2.5 text-right text-amber-800">Precio Prom.</th>
                            <th className="p-2.5 text-right">% del Cliente</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(row.products || []).map((prod, pIdx) => (
                            <tr key={pIdx} className="hover:bg-slate-50">
                                <td className="p-2.5 font-medium text-slate-800">{prod.product_name}</td>
                                <td className="p-2.5 text-right text-slate-700 tabular-nums">
                                    {prod.is_shell ? prod.display_quantity : `${Number(prod.lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`}
                                </td>
                                <td className="p-2.5 text-right font-bold text-slate-800 tabular-nums">
                                    <Money value={prod.amount} />
                                </td>
                                <td className="p-2.5 text-right font-bold text-amber-700 tabular-nums">
                                    {prod.is_shell ? (prod.avg_price_display || `$${prod.avg_price}`) : <Money value={prod.avg_price} />}
                                </td>
                                <td className="p-2.5 text-right text-slate-500 tabular-nums">{prod.is_shell ? '—' : `${prod.pct_of_customer_lbs}%`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
