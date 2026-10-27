import {
    Power,
    Snowflake,
    Minus,
    Plus,
    RotateCcw,
    Edit3,
    Trash2,
    CheckCircle2
} from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

export default function ContainersGrid({ model }) {
    const {
        filteredContainers,
        isLoading,
        daysDrafts,
        handleTogglePower,
        handleAdjustDays,
        handleDaysInputChange,
        handleDaysInputCommit,
        handleResetCycle,
        openEditModal,
        handleDeleteContainer
    } = model;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, idx) => (
                    <div
                        key={idx}
                        className="h-80 rounded-2xl bg-white border border-slate-200 p-4 animate-pulse flex flex-col justify-between"
                    >
                        <div className="h-6 bg-slate-100 rounded-lg w-2/3" />
                        <div className="h-24 bg-slate-100 rounded-xl" />
                        <div className="h-16 bg-slate-100 rounded-xl" />
                        <div className="h-10 bg-slate-100 rounded-xl" />
                    </div>
                ))}
            </div>
        );
    }

    if (filteredContainers.length === 0) {
        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <p className="text-sm font-bold text-slate-700">
                    No se encontraron contenedores con el filtro seleccionado.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                    Cambie el filtro de estado o adicione un nuevo contenedor.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {(Array.isArray(filteredContainers) ? filteredContainers : []).map((container) => {
                const isOn = Boolean(container.is_active_power);
                const draftVal = daysDrafts[container.id];
                const displayDays = draftVal !== undefined ? draftVal : container.days_on;
                const numericDays = Math.max(0, parseFloat(displayDays) || 0);
                const rate = parseFloat(container.daily_rate || 195);
                const liveSubtotal = +(numericDays * rate).toFixed(2);
                const liveIva = +(liveSubtotal * 0.13).toFixed(2);
                const liveTotal = +(liveSubtotal + liveIva).toFixed(2);

                return (
                    <div
                        key={container.id}
                        className={`rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm ${
                            isOn
                                ? 'bg-gradient-to-b from-cyan-50/70 via-white to-indigo-50/40 border-cyan-500 shadow-cyan-500/10 shadow-md'
                                : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                    >
                        {/* Cabecera Gráfica del Contenedor ( Textura Metálica Reefer ) */}
                        <div>
                            <div
                                className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
                                    isOn
                                        ? 'bg-gradient-to-r from-cyan-700 via-indigo-700 to-slate-800 text-white border-cyan-600'
                                        : 'bg-slate-100 text-slate-800 border-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-black tracking-tight shrink-0 ${
                                            isOn
                                                ? 'bg-amber-400 text-slate-950'
                                                : 'bg-slate-800 text-white'
                                        }`}
                                    >
                                        {container.code}
                                    </span>
                                    <h3 className="text-xs font-extrabold truncate" title={container.name}>
                                        {container.name}
                                    </h3>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(container)}
                                        className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                            isOn
                                                ? 'text-cyan-100 hover:bg-white/15 hover:text-white'
                                                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                                        }`}
                                        title="Editar contenedor"
                                    >
                                        <Edit3 size={13} />
                                    </button>
                                    {numericDays > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleResetCycle(container)}
                                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                                isOn
                                                    ? 'text-amber-300 hover:bg-white/15'
                                                    : 'text-amber-600 hover:bg-amber-50'
                                            }`}
                                            title="Cerrar ciclo y reiniciar días a 0"
                                        >
                                            <RotateCcw size={13} />
                                        </button>
                                    )}
                                    {container.container_number > 10 && (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteContainer(container)}
                                            className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                                isOn
                                                    ? 'text-rose-200 hover:bg-rose-500/30'
                                                    : 'text-rose-500 hover:bg-rose-50'
                                            }`}
                                            title="Eliminar contenedor"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Ilustración Visual del Contenedor Industrial (Puertas Acanaladas + Unidad de Frío) */}
                            <div className="p-3.5 space-y-3">
                                <div
                                    className={`relative rounded-xl p-3 border overflow-hidden transition-all ${
                                        isOn
                                            ? 'bg-gradient-to-br from-cyan-900 via-slate-900 to-indigo-950 border-cyan-500/60 text-white'
                                            : 'bg-slate-50 border-slate-200/90 text-slate-700'
                                    }`}
                                >
                                    {/* Líneas acanaladas decorativas de contenedor marítimo/industrial */}
                                    <div className="absolute inset-y-2 right-2 w-12 flex justify-between opacity-15 pointer-events-none">
                                        <div className="w-1 h-full bg-current rounded-full" />
                                        <div className="w-1 h-full bg-current rounded-full" />
                                        <div className="w-1 h-full bg-current rounded-full" />
                                        <div className="w-1 h-full bg-current rounded-full" />
                                    </div>

                                    <div className="relative z-10 flex items-center justify-between gap-2">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className={`h-2.5 w-2.5 rounded-full ${
                                                        isOn
                                                            ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                                                            : 'bg-emerald-500'
                                                    }`}
                                                />
                                                <span
                                                    className={`text-[10px] font-black uppercase tracking-wider ${
                                                        isOn ? 'text-cyan-300' : 'text-emerald-700'
                                                    }`}
                                                >
                                                    {isOn ? 'ENCENDIDO • EN USO' : 'DISPONIBLE'}
                                                </span>
                                            </div>
                                            <p
                                                className={`text-[10px] font-medium leading-tight ${
                                                    isOn ? 'text-slate-300' : 'text-slate-500'
                                                }`}
                                            >
                                                {isOn
                                                    ? container.turned_on_at
                                                        ? `Activo desde ${formatDateTime(container.turned_on_at)}`
                                                        : 'Almacenando producto'
                                                    : 'Apagado • Listo para carga'}
                                                {container.last_cutoff_date ? ` • Últ. corte: ${formatDate(container.last_cutoff_date)}` : ''}
                                            </p>
                                        </div>

                                        <div
                                            className={`p-2 rounded-xl shrink-0 ${
                                                isOn
                                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            }`}
                                        >
                                            {isOn ? (
                                                <Snowflake className="h-5 w-5 animate-spin" style={{ animationDuration: '6s' }} />
                                            ) : (
                                                <CheckCircle2 className="h-5 w-5" />
                                            )}
                                        </div>
                                    </div>

                                    {container.notes && (
                                        <div
                                            className={`mt-2 pt-1.5 border-t text-[10px] font-medium truncate ${
                                                isOn ? 'border-white/10 text-cyan-100' : 'border-slate-200 text-slate-600'
                                            }`}
                                            title={container.notes}
                                        >
                                            Nota: {container.notes}
                                        </div>
                                    )}
                                </div>

                                {/* CONTROL DE DÍAS QUE ESTUVO ENCENDIDO (Dato Único Requerido) */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                                    <div className="flex items-center justify-between gap-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Días Encendido
                                        </label>
                                        {isOn && container.elapsed_days_since_on > numericDays ? (
                                            <button
                                                type="button"
                                                onClick={() => handleAdjustDays(container, container.elapsed_days_since_on - numericDays)}
                                                className="text-[10px] font-extrabold text-cyan-700 bg-cyan-100 hover:bg-cyan-200 px-1.5 py-0.5 rounded border border-cyan-300 transition-colors cursor-pointer"
                                                title="Sincronizar con días transcurridos desde la fecha de encendido"
                                            >
                                                Sugerido: {container.elapsed_days_since_on}d
                                            </button>
                                        ) : (
                                            <span className="text-[10px] font-bold text-indigo-600">
                                                <Money value={rate} /> + IVA/día
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleAdjustDays(container, -1)}
                                            disabled={numericDays <= 0}
                                            className="p-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                                            title="Restar 1 día"
                                        >
                                            <Minus size={13} />
                                        </button>

                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={displayDays}
                                                onChange={(e) => handleDaysInputChange(container.id, e.target.value)}
                                                onBlur={() => handleDaysInputCommit(container)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.currentTarget.blur();
                                                    }
                                                }}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleAdjustDays(container, 1)}
                                            className="p-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors cursor-pointer shrink-0"
                                            title="Sumar 1 día"
                                        >
                                            <Plus size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* Desglose de Cobro Diario ($195 + IVA) */}
                                <div className="rounded-xl bg-slate-900 text-white p-2.5 space-y-1">
                                    <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium">
                                        <span>Subtotal ({numericDays}d):</span>
                                        <Money value={liveSubtotal} className="font-bold text-white" />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-300 font-medium">
                                        <span>IVA (13%):</span>
                                        <Money value={liveIva} className="font-bold text-amber-300" />
                                    </div>
                                    <div className="pt-1 border-t border-white/15 flex items-center justify-between">
                                        <span className="text-[10px] font-extrabold uppercase text-cyan-300">
                                            Total + IVA:
                                        </span>
                                        <Money
                                            value={liveTotal}
                                            className="text-sm font-black text-emerald-400"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botón Principal de Encendido / Apagado */}
                        <div className="px-3.5 pb-3.5">
                            <button
                                type="button"
                                onClick={() => handleTogglePower(container)}
                                className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                                    isOn
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                            >
                                <Power size={15} />
                                <span>{isOn ? 'Apagar Contenedor' : 'Encender Contenedor'}</span>
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
