import {
    PlusCircle,
    MinusCircle,
    Edit3,
    Trash2,
    Table2,
    History
} from 'lucide-react';
import Table from '../../ui/Table';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

export default function SuppliesTableSection({ model }) {
    const {
        filteredSupplies,
        filteredMovements,
        isLoading,
        activeViewTab,
        setActiveViewTab,
        openEditSupplyModal,
        openMovementModal,
        handleDeleteSupply
    } = model;

    const supplyHeaders = [
        { label: 'Código', sortKey: 'item_code', sortType: 'string' },
        { label: 'Insumo / Descripción', sortKey: 'item_name', sortType: 'string' },
        { label: 'Categoría', sortKey: 'category_label', sortType: 'string' },
        { label: 'Unidad', sortKey: 'unit_of_measure', sortType: 'string' },
        { label: 'Existencia Actual', sortKey: 'current_stock', sortType: 'number', className: 'text-right' },
        { label: 'Stock Mínimo', sortKey: 'min_stock', sortType: 'number', className: 'text-right' },
        { label: 'Estado Stock', sortKey: 'stock_status', sortType: 'string' },
        { label: 'Costo Unit.', sortKey: 'unit_cost', sortType: 'number', className: 'text-right' },
        { label: 'Valor Total', sortKey: 'total_value', sortType: 'number', className: 'text-right' },
        { label: 'Acciones', sortable: false, className: 'text-right' }
    ];

    const movementHeaders = [
        { label: 'Fecha', sortKey: 'movement_date', sortType: 'date' },
        { label: 'Código', sortKey: 'item_code', sortType: 'string' },
        { label: 'Insumo', sortKey: 'item_name', sortType: 'string' },
        { label: 'Tipo Movimiento', sortKey: 'movement_label', sortType: 'string' },
        { label: 'Cantidad', sortKey: 'quantity', sortType: 'number', className: 'text-right' },
        { label: 'Stock Ant.', sortKey: 'previous_stock', sortType: 'number', className: 'text-right' },
        { label: 'Nuevo Stock', sortKey: 'new_stock', sortType: 'number', className: 'text-right' },
        { label: 'Costo Total', sortKey: 'total_cost', sortType: 'number', className: 'text-right' },
        { label: 'Referencia / Lote', sortKey: 'reference_doc', sortType: 'string' },
        { label: 'Usuario', sortKey: 'user_name', sortType: 'string' }
    ];

    const getStockStatusBadge = (status) => {
        if (status === 'agotado') {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                    Agotado
                </span>
            );
        }
        if (status === 'bajo_stock') {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    Bajo Stock
                </span>
            );
        }
        return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Óptimo
            </span>
        );
    };

    const getCategoryBadge = (cat, label) => {
        const colors = {
            empaque: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            aditivo: 'bg-amber-50 text-amber-800 border-amber-200',
            quimico_cip: 'bg-cyan-50 text-cyan-800 border-cyan-200'
        };
        return (
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${colors[cat] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {label}
            </span>
        );
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        Existencias Valorizadas y Kárdex de Insumos
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                        Haga clic en los botones + / - de cada fila para registrar compras, consumos por lote o ajustes de stock.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
                    <button
                        type="button"
                        onClick={() => setActiveViewTab('catalog')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeViewTab === 'catalog'
                                ? 'bg-white text-indigo-600 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Table2 size={14} />
                        <span>Existencias de Insumos ({filteredSupplies.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveViewTab('kardex')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeViewTab === 'kardex'
                                ? 'bg-white text-indigo-600 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <History size={14} />
                        <span>Kárdex de Movimientos ({filteredMovements.length})</span>
                    </button>
                </div>
            </div>

            {activeViewTab === 'catalog' ? (
                <Table
                    headers={supplyHeaders}
                    data={filteredSupplies}
                    loading={isLoading}
                    defaultSortBy="item_name"
                    defaultSortDir="asc"
                    emptyMessage="No se encontraron insumos con los filtros seleccionados"
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2 text-xs font-black text-slate-800 whitespace-nowrap">
                                {item.item_code}
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-slate-900">
                                <div>{item.item_name}</div>
                                {item.dose_per_batch > 0 && (
                                    <span className="text-[10px] text-slate-500 font-normal">
                                        Dosis estándar: {item.dose_per_batch} {item.unit_of_measure}/lote
                                    </span>
                                )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                                {getCategoryBadge(item.category, item.category_label)}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase">
                                {item.unit_of_measure}
                            </td>
                            <td className="px-3 py-2 text-xs font-black text-slate-900 text-right">
                                {Number(item.current_stock).toLocaleString('en-US')}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-slate-500 text-right">
                                {Number(item.min_stock).toLocaleString('en-US')}
                            </td>
                            <td className="px-3 py-2 text-xs">
                                {getStockStatusBadge(item.stock_status)}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-700 text-right">
                                <Money value={item.unit_cost} digits={4} />
                            </td>
                            <td className="px-3 py-2 text-xs font-black text-emerald-700 text-right">
                                <Money value={item.total_value} />
                            </td>
                            <td className="px-3 py-2 text-xs text-right whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1">
                                    <button
                                        type="button"
                                        onClick={() => openMovementModal(item, 'entrada_compra')}
                                        className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                        title="Registrar Entrada / Compra"
                                    >
                                        <PlusCircle size={13} />
                                        <span>Entrada</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openMovementModal(
                                                item,
                                                item.category === 'quimico_cip' ? 'salida_cip' : 'salida_produccion'
                                            )
                                        }
                                        className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                        title="Registrar Salida / Consumo en Planta"
                                    >
                                        <MinusCircle size={13} />
                                        <span>Salida</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openEditSupplyModal(item)}
                                        className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                                        title="Editar insumo"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteSupply(item)}
                                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                                        title="Eliminar insumo"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            ) : (
                <Table
                    headers={movementHeaders}
                    data={filteredMovements}
                    loading={isLoading}
                    defaultSortBy="movement_date"
                    defaultSortDir="desc"
                    emptyMessage="Aún no se han registrado movimientos en el kárdex de insumos"
                    renderRow={(mov) => {
                        const isOut = ['salida_produccion', 'salida_cip', 'ajuste_negativo'].includes(mov.movement_type);
                        return (
                            <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-3 py-2 text-xs font-bold text-slate-700 whitespace-nowrap">
                                    {formatDate(mov.movement_date)}
                                </td>
                                <td className="px-3 py-2 text-xs font-black text-slate-800">
                                    {mov.item_code}
                                </td>
                                <td className="px-3 py-2 text-xs font-bold text-slate-900">
                                    <div>{mov.item_name}</div>
                                    {mov.notes && (
                                        <span className="text-[10px] text-slate-500 font-normal block">
                                            {mov.notes}
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                            isOut
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                    >
                                        {mov.movement_label}
                                    </span>
                                </td>
                                <td className={`px-3 py-2 text-xs font-black text-right ${isOut ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {isOut ? '-' : '+'}{Number(mov.quantity).toLocaleString('en-US')}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500 text-right">
                                    {Number(mov.previous_stock).toLocaleString('en-US')}
                                </td>
                                <td className="px-3 py-2 text-xs font-black text-slate-900 text-right">
                                    {Number(mov.new_stock).toLocaleString('en-US')}
                                </td>
                                <td className="px-3 py-2 text-xs font-bold text-slate-800 text-right">
                                    <Money value={mov.total_cost} />
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-700">
                                    {mov.batch_code && (
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] mr-1">
                                            Lote: {mov.batch_code}
                                        </span>
                                    )}
                                    {mov.reference_doc || mov.provider_name || '—'}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                    {mov.user_name || 'Sistema'}
                                </td>
                            </tr>
                        );
                    }}
                />
            )}
        </div>
    );
}
