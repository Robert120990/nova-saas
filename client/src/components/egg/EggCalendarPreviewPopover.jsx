import { useMemo } from 'react';
import {
    Clock,
    User,
    CheckCircle2,
    Calendar,
    ShoppingBag,
    Truck,
    CheckSquare,
    Layers
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import Money from '../ui/Money';

// eslint-disable-next-line react-refresh/only-export-components
export const isProductionFinished = (prod) => {
    if (!prod) return false;
    const pStatus = (prod.status || '').toLowerCase();
    if (pStatus === 'completado' || pStatus === 'finalizado' || pStatus === 'cerrado') return true;
    const bStatus = (prod.batch_status || '').toLowerCase();
    if (['completado', 'cerrado', 'finalizado', 'empaquetado', 'congelado', 'almacenado'].includes(bStatus)) return true;
    if (prod.batch_completed_at) return true;
    return false;
};

export const EggCalendarPreviewPopover = ({ hoverPreview }) => {
    const rect = hoverPreview?.rect;

    const positionStyle = useMemo(() => {
        if (!rect) return { top: '100px', left: '100px' };
        const popoverWidth = 340;
        const estimatedHeight = 360;
        const padding = 12;

        let left = rect.right + padding;
        if (left + popoverWidth > window.innerWidth) {
            left = rect.left - popoverWidth - padding;
        }
        if (left < padding) {
            left = Math.max(padding, window.innerWidth - popoverWidth - padding);
        }

        let top = rect.top;
        if (top + estimatedHeight > window.innerHeight) {
            top = Math.max(padding, window.innerHeight - estimatedHeight - padding);
        }

        return {
            top: `${top}px`,
            left: `${left}px`
        };
    }, [rect]);

    if (!hoverPreview || !hoverPreview.data) return null;

    const { type, data } = hoverPreview;

    if (type === 'production') {
        const prod = data;
        const isFinished = isProductionFinished(prod);
        const tasks = Array.isArray(prod.tasks) ? prod.tasks : [];
        const completedTasks = tasks.filter(t => t.checklist_status === 'completado').length;
        const mix = typeof prod.mix_formula_json === 'object' && prod.mix_formula_json !== null
            ? prod.mix_formula_json
            : {};

        return (
            <div
                style={positionStyle}
                className="fixed z-[9999] pointer-events-none w-[340px] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-4 text-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-slate-900/5"
            >
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-black text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                                {prod.lot_code || 'Lote por asignar'}
                            </span>
                            {isFinished ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Finalizado
                                </span>
                            ) : prod.status === 'en_proceso' || prod.batch_status ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-blue-600 text-white shadow-xs animate-pulse">
                                    <Clock className="w-2.5 h-2.5" />
                                    En Proceso
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                                    Programado
                                </span>
                            )}
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 mt-1 capitalize">
                            {prod.product_profile || 'Ovoproducto Pasteurizado'}
                        </h4>
                    </div>

                    {prod.priority === 'urgente' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase shrink-0">
                            Urgente
                        </span>
                    )}
                </div>

                {/* Grid de Métricas Principales */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-[11px]">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Volumen Meta</span>
                        <span className="font-black text-slate-800 text-xs">
                            {parseFloat(prod.target_quantity_lbs || 0).toLocaleString()} Lbs
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Sólidos / Brix</span>
                        <span className="font-bold text-indigo-700 text-xs">
                            {prod.target_solids_pct || 22.5}%
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Presentación</span>
                        <span className="font-medium text-slate-700 truncate block" title={prod.presentation}>
                            {prod.presentation || 'cubeta 30LB'}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Horario</span>
                        <span className="font-medium text-slate-700">
                            {prod.start_time?.slice(0, 5) || '06:00'} - {prod.end_time?.slice(0, 5) || '14:00'}
                        </span>
                    </div>
                </div>

                {/* Operador y Fecha */}
                <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-medium">{formatDate(prod.production_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium truncate max-w-[120px]">{prod.assigned_operator_name || 'Operador de Planta'}</span>
                    </div>
                </div>

                {/* Formulación IA / Coproductos si aplica */}
                {(mix.raw_egg_boxes > 0 || mix.water_h2o_lbs > 0 || mix.clara_produced_lbs > 0) && (
                    <div className="p-2 rounded-xl bg-indigo-50/60 border border-indigo-100 text-[10px] space-y-1">
                        <div className="font-bold text-indigo-900 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-indigo-600" />
                            <span>Parámetros de Formulación:</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-slate-700 font-medium">
                            {mix.raw_egg_boxes > 0 && <div>Cajas cáscara: <b>{mix.raw_egg_boxes} cjs</b></div>}
                            {mix.raw_liquid_lbs > 0 && <div>Líquido: <b>{mix.raw_liquid_lbs} Lbs</b></div>}
                            {mix.water_h2o_lbs > 0 && <div className="text-teal-700">H2O purificada: <b>{mix.water_h2o_lbs} Lbs</b></div>}
                            {mix.clara_produced_lbs > 0 && <div>Clara útil: <b>{mix.clara_produced_lbs} Lbs</b></div>}
                        </div>
                        {mix.notes && <p className="text-slate-500 italic truncate">{mix.notes}</p>}
                    </div>
                )}

                {/* Checklist Roles de Fábrica */}
                {tasks.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 text-[10px]">
                        <div className="flex items-center justify-between text-slate-600 mb-1">
                            <span className="font-bold flex items-center gap-1">
                                <CheckSquare className="w-3 h-3 text-slate-400" />
                                Roles de Fábrica:
                            </span>
                            <span className="font-black text-indigo-600">
                                {completedTasks}/{tasks.length} completados
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {tasks.slice(0, 4).map((t, i) => (
                                <span
                                    key={i}
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                        t.checklist_status === 'completado'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {t.factory_role || t.task_description}
                                </span>
                            ))}
                            {tasks.length > 4 && (
                                <span className="text-[9px] text-slate-400 font-bold px-1">
                                    +{tasks.length - 4} más
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Batch vinculado en planta */}
                {prod.batch_id && (
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Lote en planta: <strong className="text-slate-800">{prod.batch_code_display || '#' + prod.batch_id}</strong></span>
                        <span className="capitalize font-semibold text-indigo-600">{prod.batch_status || 'En Planta'}</span>
                    </div>
                )}
            </div>
        );
    }

    if (type === 'order') {
        const order = data;
        const totalAmount = parseFloat(order.quantity_lbs || 0) * parseFloat(order.price_per_lb || 0);
        const statusColors = {
            pendiente: 'bg-amber-100 text-amber-800 border-amber-200',
            programado: 'bg-blue-100 text-blue-800 border-blue-200',
            despachado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            entregado: 'bg-slate-100 text-slate-800 border-slate-200',
            cancelado: 'bg-rose-100 text-rose-800 border-rose-200'
        };

        let itemsList = [];
        if (typeof order.items_json === 'string') {
            try {
                itemsList = JSON.parse(order.items_json);
            } catch (e) {
                itemsList = [];
            }
        } else if (Array.isArray(order.items_json)) {
            itemsList = order.items_json;
        }

        return (
            <div
                style={positionStyle}
                className="fixed z-[9999] pointer-events-none w-[340px] bg-white/95 backdrop-blur-md rounded-2xl border border-amber-200/90 shadow-2xl p-4 text-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-amber-500/10"
            >
                {/* Cabecera */}
                <div className="flex items-start justify-between gap-2 border-b border-amber-100 pb-2.5">
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-amber-900 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <ShoppingBag className="w-3 h-3 text-amber-700" />
                                #{order.order_number || order.id}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${statusColors[order.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {order.status || 'Pendiente'}
                            </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 mt-1 truncate max-w-[220px]" title={order.customer_name}>
                            {order.customer_name || 'Cliente'}
                        </h4>
                    </div>

                    {order.priority === 'urgente' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase shrink-0">
                            Urgente
                        </span>
                    )}
                </div>

                {/* Métricas Principales */}
                <div className="grid grid-cols-2 gap-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 text-[11px]">
                    <div>
                        <span className="text-[10px] font-bold text-amber-800/70 uppercase block">Cantidad Solicitada</span>
                        <span className="font-black text-slate-900 text-xs">
                            {parseFloat(order.quantity_lbs || 0).toLocaleString()} Lbs
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-amber-800/70 uppercase block">Total Estimado</span>
                        <span className="font-bold text-emerald-700 text-xs">
                            <Money value={totalAmount} />
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-amber-800/70 uppercase block">Producto</span>
                        <span className="font-medium text-slate-800 truncate block">
                            {order.product_type || 'Ovoproducto'}
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-amber-800/70 uppercase block">Presentación</span>
                        <span className="font-medium text-slate-800 truncate block">
                            {order.presentation || 'cubeta 30LB'}
                        </span>
                    </div>
                </div>

                {/* Entrega y Destino */}
                <div className="space-y-1 text-[11px] text-slate-600 px-0.5">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            Entrega requerida:
                        </span>
                        <span className="font-black text-slate-900">
                            {formatDate(order.required_delivery_date)}
                        </span>
                    </div>
                    {(order.customer_branch_name || order.delivery_address) && (
                        <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                            <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{order.customer_branch_name || order.delivery_address}</span>
                        </div>
                    )}
                </div>

                {/* Partidas Múltiples si las hay */}
                {itemsList.length > 0 && (
                    <div className="border-t border-amber-100 pt-2 text-[10px]">
                        <span className="font-bold text-amber-950 block mb-1">
                            Partidas del Pedido ({itemsList.length}):
                        </span>
                        <div className="space-y-1 max-h-20 overflow-y-auto">
                            {itemsList.map((it, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-50 p-1 rounded font-medium">
                                    <span className="truncate max-w-[180px]">{it.product_type} - {it.presentation}</span>
                                    <span className="font-bold text-slate-800">{parseFloat(it.quantity_lbs || 0).toLocaleString()} Lbs</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lote asignado */}
                <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Lote Asignado:</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/60">
                        {order.lot_code || order.linked_batch_code || 'Por asignar en planta'}
                    </span>
                </div>

                {order.notes && (
                    <p className="text-[10px] text-slate-500 italic bg-amber-50/40 p-1.5 rounded-lg border border-amber-100 truncate">
                        Nota: {order.notes}
                    </p>
                )}
            </div>
        );
    }

    return null;
};

export default EggCalendarPreviewPopover;
