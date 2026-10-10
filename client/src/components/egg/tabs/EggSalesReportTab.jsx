import { useState, Fragment } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import Money from '../../ui/Money';
import EggSalesCustomerDetailModal from './EggSalesCustomerDetailModal';
import EggSalesFiltersBar from './EggSalesFiltersBar';
import EggSalesKpiCards from './EggSalesKpiCards';
import EggSalesCharts from './EggSalesCharts';
import EggSalesRowAccordion from './EggSalesRowAccordion';

export default function EggSalesReportTab({
    type,
    rows,
    summary,
    loading,
    error,
    onSwitchTab,
    filters,
    onChangeFilter,
    onChangeFilters,
    onApplyFilters,
    onExportExcel,
    onDownloadPdf,
    onViewPdf,
    customers,
    isExporting
}) {
    const [expanded, setExpanded] = useState({});
    const [modalCustomer, setModalCustomer] = useState(null);

    const isProduct = type === 'sales-product';
    const items = Array.isArray(rows) ? rows : [];

    const toggleRow = (key) => {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const totalLbs = summary?.totalLbs ?? items.reduce((s, r) => s + (r.is_shell ? 0 : (r.total_lbs || 0)), 0);
    const totalAmount = summary?.totalAmount ?? items.reduce((s, r) => s + (r.total_amount || 0), 0);
    const avgPrice = summary?.avgPricePerLb ?? (totalLbs > 0 ? ((totalAmount - (summary?.shellEggs?.totalAmount || 0)) / totalLbs) : 0);

    return (
        <div className="space-y-4">
            {/* 1. Barra de Filtros y Exportación */}
            {filters && (
                <EggSalesFiltersBar
                    filters={filters}
                    onChangeFilter={onChangeFilter}
                    onChangeFilters={onChangeFilters}
                    onApply={onApplyFilters}
                    onExportExcel={onExportExcel}
                    onDownloadPdf={onDownloadPdf}
                    onViewPdf={onViewPdf}
                    customers={customers}
                    isExporting={isExporting}
                />
            )}

            {/* 2. Tarjetas de Resumen (KPIs) */}
            <EggSalesKpiCards
                totalLbs={totalLbs}
                totalAmount={totalAmount}
                avgPrice={avgPrice}
                isProduct={isProduct}
                summary={summary}
                items={items}
            />

            {/* 3. Panel de Gráficos (Barras, Lineal, Circular, y Huevo Líquido en Producto) */}
            {!loading && !error && items.length > 0 && (
                <EggSalesCharts
                    items={items}
                    isProduct={isProduct}
                    summary={summary}
                />
            )}

            {/* 3. Selector de Subvista e Indicador de interacción */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/90 p-1.5 rounded-xl border border-slate-200">
                <div className="flex gap-1.5">
                    <button
                        onClick={() => onSwitchTab?.('sales-product')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isProduct ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        📦 Por Producto
                    </button>
                    <button
                        onClick={() => onSwitchTab?.('sales-customer')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            !isProduct ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        👥 Por Cliente
                    </button>
                </div>
                <span className="text-xs font-medium text-slate-600 pr-2">
                    💡 <span className="font-bold text-indigo-700">Haga clic en cualquier fila</span> para interactuar y ver el desglose
                </span>
            </div>

            {/* 4. Estado de Carga o Error */}
            {loading && (
                <div className="p-10 text-center bg-white rounded-2xl border border-slate-200">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mb-3" />
                    <p className="text-sm font-medium text-slate-600">Calculando ventas, libras y precios promedio...</p>
                </div>
            )}

            {error && !loading && (
                <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
                    <p className="font-bold">Error al consultar el reporte de ventas</p>
                    <p className="text-xs mt-1">Verifique los filtros seleccionados o intente nuevamente.</p>
                </div>
            )}

            {/* 5. TABLA INTERACTIVA PRINCIPAL - 100% ALINEADA CON CELDAS TD */}
            {!loading && !error && (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-10 text-center"></th>
                                <th className="p-3 min-w-[180px]">{isProduct ? 'Producto / Ovoproducto' : 'Cliente'}</th>
                                {!isProduct && <th className="p-3 w-32">NIT / NRC</th>}
                                <th className="p-3 text-right w-32">Volumen / Lbs</th>
                                <th className="p-3 text-right w-36">Total Facturado</th>
                                <th className="p-3 text-right bg-amber-50/70 text-amber-800 w-36">Precio Promedio</th>
                                <th className="p-3 text-right w-24">{isProduct ? '% Lbs' : '% Facturado'}</th>
                                <th className="p-3 text-right w-28">{isProduct ? 'N° Clientes' : 'Facturas'}</th>
                                <th className="p-3 text-center w-24">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((row, idx) => {
                                const rowKey = isProduct ? row.product_name : (row.customer_id || idx);
                                const isExpanded = !!expanded[rowKey];
                                const isShell = row.is_shell || row.is_only_shell || row.product_name === 'HUEVO EN CASCARA';

                                return (
                                    <Fragment key={rowKey}>
                                        <tr
                                            onClick={() => toggleRow(rowKey)}
                                            className={`cursor-pointer transition-colors hover:bg-slate-50/90 ${
                                                isExpanded ? 'bg-indigo-50/40' : ''
                                            }`}
                                        >
                                            <td className="p-3 w-10 text-center text-slate-400">
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-indigo-600 inline" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 inline" />
                                                )}
                                            </td>

                                            <td className="p-3 font-bold text-slate-800">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{isProduct ? row.product_name : row.customer_name}</span>
                                                    {isShell && (
                                                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 shrink-0">
                                                            Cáscara
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {!isProduct && (
                                                <td className="p-3 text-slate-500 font-mono text-[11px] truncate">
                                                    {row.customer_nit !== 'N/A' ? row.customer_nit : (row.customer_nrc || '-')}
                                                </td>
                                            )}

                                            <td className="p-3 text-right font-medium text-slate-700 tabular-nums">
                                                {isShell ? (
                                                    <span className="inline-block font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                                                        {row.display_quantity}
                                                    </span>
                                                ) : (
                                                    <>{Number(row.total_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-[10px] text-slate-400">Lb</span></>
                                                )}
                                            </td>

                                            <td className="p-3 text-right font-bold text-slate-800 tabular-nums">
                                                <Money value={row.total_amount} />
                                            </td>

                                            <td className="p-3 text-right">
                                                <span className="inline-block font-bold text-amber-800 bg-amber-50/80 py-0.5 px-2 rounded-lg border border-amber-200/60 tabular-nums">
                                                    {isShell ? (row.avg_price_display || '—') : <Money value={row.avg_price} />}
                                                </span>
                                            </td>

                                            <td className="p-3 text-right font-medium text-slate-600 tabular-nums">
                                                {isProduct ? (isShell ? '—' : `${row.pct_of_total_lbs}%`) : `${row.pct_of_total_amount}%`}
                                            </td>

                                            <td className="p-3 text-right text-slate-600 tabular-nums">
                                                {isProduct ? (row.customers?.length || 0) : (row.sales_count || 0)}
                                            </td>

                                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                {!isProduct ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setModalCustomer(row)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors shadow-2xs"
                                                        title="Ver opciones y facturas de lo que se le vendió"
                                                    >
                                                        Detalles <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRow(rowKey)}
                                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                                                    >
                                                        {isExpanded ? 'Ocultar' : 'Clientes'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Acordeón expandible al hacer clic */}
                                        {isExpanded && (
                                            <tr className="bg-slate-50/70">
                                                <td colSpan={isProduct ? 8 : 9} className="px-6 py-4 border-y border-indigo-100">
                                                    <EggSalesRowAccordion
                                                        row={row}
                                                        isProduct={isProduct}
                                                        onOpenCustomerModal={setModalCustomer}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                            <tr>
                                <td colSpan={isProduct ? 2 : 3} className="p-3 text-right uppercase text-[11px]">Totales Consolidados:</td>
                                <td className="p-3 text-right tabular-nums">
                                    <span className="block font-bold text-slate-900">{Number(totalLbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb</span>
                                    {summary?.shellEggs?.totalAmount > 0 && (
                                        <span className="block text-[10px] font-medium text-amber-800">+ {summary.shellEggs.displayQuantity}</span>
                                    )}
                                </td>
                                <td className="p-3 text-right text-emerald-800 tabular-nums"><Money value={totalAmount} /></td>
                                <td className="p-3 text-right text-amber-800 bg-amber-100/70 rounded tabular-nums">
                                    <Money value={avgPrice} /> <span className="text-[10px] font-normal text-slate-600">/Lb (Ovop.)</span>
                                </td>
                                <td className="p-3 text-right tabular-nums">100.0%</td>
                                <td className="p-3 text-right tabular-nums">{isProduct ? (summary?.totalCustomers || 0) : (summary?.totalTransactions || 0)}</td>
                                <td className="p-3"></td>
                            </tr>
                        </tfoot>
                    </table>

                    {!items.length && (
                        <div className="p-8 text-center text-slate-500 text-sm">
                            No se encontraron ventas para los filtros y rango de fechas seleccionados.
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Detalle de Cliente con opciones avanzadas */}
            <EggSalesCustomerDetailModal
                open={!!modalCustomer}
                onClose={() => setModalCustomer(null)}
                customer={modalCustomer}
            />
        </div>
    );
}
