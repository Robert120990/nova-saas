import {
    Plus,
    ShoppingBag,
    CheckCircle2,
    Play,
    Split,
    Wand2,
    CalendarCheck
} from 'lucide-react';
import {
    getJulianDayInfo,
    isJulianLotCode
} from '../../../utils/julianDate';
import { isProductionFinished } from '../EggCalendarPreviewPopover';


export default function ProductionCalendarContent({ model }) {
    const { navigate, calendarView, customerOrders, setIsCustomerOrderModalOpen, setSelectedOrderToEdit, setHoverPreview, draggedItem, dragOverDate, handleConvertLotToJulian, handleOpenCreateModal, handleOpenEditModal, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleOpenAlterDateModal, calendarMonthDays, getProductionsForDate, getProfileBadgeStyle, todayStr } = model;

    return (<>{calendarView === 'month' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    {/* Encabezado Días de la Semana */}
                    <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50/80 text-center py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <div>Lun</div>
                        <div>Mar</div>
                        <div>Mié</div>
                        <div>Jue</div>
                        <div>Vie</div>
                        <div className="text-slate-400">Sáb</div>
                        <div className="text-slate-400">Dom</div>
                    </div>

                    {/* Matriz de Días */}
                    <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                        {(Array.isArray(calendarMonthDays) ? calendarMonthDays : []).map((cell, index) => {
                            const dayProds = getProductionsForDate(cell.dateStr);
                            const dayOrders = customerOrders.filter(o => o.required_delivery_date && o.required_delivery_date.split('T')[0] === cell.dateStr);
                            const isToday = cell.dateStr === todayStr;
                            const isDropTarget = dragOverDate === cell.dateStr;

                            return (
                                <div
                                    key={index}
                                    onDragOver={(e) => handleDragOver(e, cell.dateStr)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, cell.dateStr)}
                                    className={`min-h-[125px] sm:min-h-[145px] p-1.5 sm:p-2 flex flex-col transition-all group ${cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 opacity-60'
                                        } ${isDropTarget ? 'bg-indigo-50/80 ring-2 ring-indigo-400 ring-inset' : ''}`}
                                >
                                    {/* Número del día y botón rápido + */}
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className={`text-xs font-bold rounded-lg w-6 h-6 flex items-center justify-center ${isToday
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : cell.isCurrentMonth
                                                        ? 'text-slate-700'
                                                        : 'text-slate-400'
                                                }`}
                                        >
                                            {cell.dayNumber}
                                        </span>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedOrderToEdit(null);
                                                    setIsCustomerOrderModalOpen(true);
                                                }}
                                                className="p-1 hover:bg-amber-50 text-amber-700 rounded-md transition-all text-xs"
                                                title={`Registrar pedido para ${cell.dateStr}`}
                                            >
                                                <ShoppingBag className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenCreateModal(cell.dateStr)}
                                                className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-md transition-all text-xs"
                                                title={`Programar producción para ${cell.dateStr}`}
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista de Producciones y Pedidos del Día */}
                                    <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[135px] pr-0.5">
                                        {/* 1. Lotes de Producción */}
                                        {(Array.isArray(dayProds) ? dayProds : []).map((prod) => {
                                            const badgeStyle = getProfileBadgeStyle(prod.product_profile);
                                            const tasksDone = (prod.tasks || []).filter(t => t.checklist_status === 'completado').length;
                                            const tasksTotal = (prod.tasks || []).length;
                                            const isFinished = isProductionFinished(prod);

                                            return (
                                                <div
                                                    key={prod.id}
                                                    draggable={true}
                                                    onDragStart={(e) => handleDragStart(e, prod)}
                                                    onClick={() => handleOpenEditModal(prod)}
                                                    onMouseEnter={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setHoverPreview({ type: 'production', data: prod, rect });
                                                    }}
                                                    onMouseLeave={() => setHoverPreview(null)}
                                                    className={`p-1.5 rounded-lg border text-left cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${isFinished
                                                            ? 'border-l-4 border-l-emerald-600 bg-emerald-50/95 text-emerald-950 border-emerald-300 hover:bg-emerald-100/90 ring-1 ring-emerald-200'
                                                            : badgeStyle.card
                                                        } ${draggedItem?.id === prod.id ? 'opacity-40' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <div className="flex items-center gap-1 min-w-0">
                                                            <span className="font-bold text-[11px] text-slate-900 truncate">
                                                                {prod.lot_code}
                                                            </span>
                                                            <span
                                                                className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0"
                                                                title={`Día Juliano: ${getJulianDayInfo(prod.production_date).dayOfYearStr} / 365`}
                                                            >
                                                                J-{getJulianDayInfo(prod.production_date).dayOfYearStr}
                                                            </span>
                                                            {Boolean(prod.is_coproduct) && (
                                                                <span
                                                                    className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0"
                                                                    title="Co-Producto / Lote Secundario Simultáneo"
                                                                >
                                                                    🔗 Co-Prod
                                                                </span>
                                                            )}
                                                            {isFinished && (
                                                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-600 text-white uppercase tracking-wider flex items-center gap-0.5 shadow-2xs shrink-0">
                                                                    <CheckCircle2 className="w-2.5 h-2.5" /> FINALIZADO
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {/* Botón Alterar fecha de producción */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenAlterDateModal('production', prod);
                                                                }}
                                                                className="p-0.5 rounded bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-800 text-[8px] font-bold transition-all flex items-center"
                                                                title="Alterar / Reprogramar fecha de producción"
                                                            >
                                                                <CalendarCheck className="w-2.5 h-2.5" />
                                                            </button>

                                                            {!isJulianLotCode(prod.lot_code) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleConvertLotToJulian(prod.id);
                                                                    }}
                                                                    className="p-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[8px] font-bold transition-all flex items-center"
                                                                    title="Convertir a Lote Juliano"
                                                                >
                                                                    <Wand2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            )}
                                                            {(!prod.batch_id && prod.status !== 'completado' && prod.status !== 'cancelado') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate('/industrial/produccion', {
                                                                            state: {
                                                                                openNewBatchModal: true,
                                                                                scheduledProduction: prod
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="p-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[8px] font-bold transition-all flex items-center"
                                                                    title="Llevar actividad a Producción"
                                                                >
                                                                    <Play className="w-2.5 h-2.5 fill-emerald-700" />
                                                                </button>
                                                            )}
                                                            {prod.priority === 'urgente' && (
                                                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" title="Prioridad Urgente" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-[10px] font-semibold text-slate-600 truncate mt-0.5">
                                                        {prod.product_profile}
                                                    </div>

                                                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
                                                        <span>{parseFloat(prod.target_quantity_lbs || 0).toLocaleString()} Lbs</span>
                                                        {tasksTotal > 0 && (
                                                            <span
                                                                className={`font-semibold px-1 rounded ${tasksDone === tasksTotal ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                                    }`}
                                                            >
                                                                {tasksDone}/{tasksTotal} roles
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Badge de sugerencia IA si aplica */}
                                                    {prod.suggestion_source && prod.suggestion_source.includes('coproduct') && (
                                                        <div className="mt-1 flex items-center gap-1 text-[8px] font-bold text-emerald-700 bg-emerald-100/80 px-1 py-0.2 rounded">
                                                            <Split className="w-2.5 h-2.5" />
                                                            <span>Yema + MP liquida A</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* 2. Pedidos de Clientes del Día */}
                                        {(Array.isArray(dayOrders) ? dayOrders : []).map((ord) => (
                                            <div
                                                key={`ord-${ord.id}`}
                                                onClick={() => {
                                                    setSelectedOrderToEdit(ord);
                                                    setIsCustomerOrderModalOpen(true);
                                                }}
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoverPreview({ type: 'order', data: ord, rect });
                                                }}
                                                onMouseLeave={() => setHoverPreview(null)}
                                                className="p-1 sm:p-1.5 rounded-lg border border-amber-200/90 bg-amber-50/70 hover:bg-amber-100/80 text-left cursor-pointer transition-all hover:shadow-xs group/ord"
                                                title="Clic para ver o editar pedido completo"
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="font-bold text-[10px] text-amber-950 truncate flex items-center gap-1">
                                                        <ShoppingBag className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                                        <span className="truncate">{ord.customer_name}</span>
                                                    </span>
                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenAlterDateModal('order', ord);
                                                            }}
                                                            className="p-0.5 rounded bg-amber-200/80 hover:bg-amber-300 text-amber-900 text-[8px] font-bold transition-all flex items-center"
                                                            title="Alterar / Reprogramar fecha de entrega de pedido"
                                                        >
                                                            <CalendarCheck className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-[9px] font-medium text-amber-800 truncate mt-0.5">
                                                    {ord.product_type} - {parseFloat(ord.quantity_lbs || 0).toLocaleString()} Lbs
                                                </div>
                                                {ord.linked_batch_code && (
                                                    <div className="text-[8px] font-bold text-emerald-700 mt-0.5 truncate">
                                                        Lote: {ord.linked_batch_code}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}</>);
}
