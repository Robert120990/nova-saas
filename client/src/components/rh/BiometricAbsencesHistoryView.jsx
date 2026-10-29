import {
    Search, ShieldCheck, Edit3, Trash2, FileSignature
} from 'lucide-react';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import {
    ABSENCE_CATEGORIES,
    AUTH_STATES,
    getCategoryBadge,
    getAuthStateBadge
} from './biometricAbsenceConstants';

const BiometricAbsencesHistoryView = ({
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    categoria,
    onCategoriaChange,
    estadoAutorizacion,
    onEstadoAutorizacionChange,
    search,
    onSearchChange,
    rows = [],
    pagination = { total: 0, page: 1, totalPages: 1, limit: 15 },
    limit = 15,
    onLimitChange,
    onPageChange,
    isLoading,
    onEdit,
    onAuthorize,
    onDelete,
    onOpenAccionPersonal
}) => {
    const safeRows = Array.isArray(rows) ? rows : [];

    const headers = [
        { label: 'Colaborador', sortKey: 'empleado_nombre', sortType: 'string' },
        { label: 'Vigencia / Alcance', sortKey: 'fecha_inicio', sortType: 'date' },
        { label: 'Clasificación y Motivo', sortKey: 'subtipo_label', sortType: 'string' },
        { label: 'Estado Autorización', sortKey: 'estado_autorizacion', sortType: 'string' },
        { label: 'Impacto en Planilla', sortKey: 'goce_sueldo', sortType: 'number' },
        { label: 'Acciones', className: 'text-right', sortable: false }
    ];

    return (
        <div className="space-y-4">
            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Desde</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Hasta</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Clasificación</label>
                    <select
                        value={categoria}
                        onChange={(e) => onCategoriaChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                        <option value="todos">Todas las categorías</option>
                        {ABSENCE_CATEGORIES.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Autorización</label>
                    <select
                        value={estadoAutorizacion}
                        onChange={(e) => onEstadoAutorizacionChange(e.target.value)}
                        className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    >
                        <option value="todos">Todos los estados</option>
                        {AUTH_STATES.map((s) => (
                            <option key={s.id} value={s.id}>{s.shortLabel}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Buscar</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Nombre, código, boleta..."
                            className="w-full text-[13px] font-medium border border-slate-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                </div>
            </div>

            {/* Tabla con Ordenamiento por Columna */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <Table
                    headers={headers}
                    data={safeRows}
                    isLoading={isLoading}
                    emptyMessage="No se encontraron permisos ni inasistencias en el período seleccionado"
                    renderRow={(item) => {
                        const catBadge = getCategoryBadge(item.categoria);
                        const authBadge = getAuthStateBadge(item.estado_autorizacion);
                        const isSameDay = item.fecha_inicio === item.fecha_fin;
                        const isUnjustified = item.categoria === 'injustificada' || item.estado_autorizacion === 'rechazado' || item.estado_autorizacion === 'sin_solicitud';

                        return (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors text-xs">
                                <td className="py-3 px-4">
                                    <span className="font-bold text-slate-800 block">{item.empleado_nombre}</span>
                                    <span className="text-[11px] text-slate-400">
                                        {item.empleado_codigo ? `[${item.empleado_codigo}] ` : ''}{item.departamento_nombre || 'Sin Depto'}
                                    </span>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                    <span className="font-bold text-slate-800 block">
                                        {formatDate(item.fecha_inicio)}{!isSameDay ? ` → ${formatDate(item.fecha_fin)}` : ''}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        {item.modalidad_tiempo === 'por_horas'
                                            ? `Por horas (${String(item.hora_inicio || '').slice(0, 5)} - ${String(item.hora_fin || '').slice(0, 5)} · ${item.horas_ausencia}h)`
                                            : item.modalidad_tiempo === 'medio_dia'
                                                ? `Medio día (${item.horas_ausencia}h)`
                                                : `${item.total_dias || 1} día(s) completo(s)`}
                                    </span>
                                </td>
                                <td className="py-3 px-4 max-w-[260px]">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${catBadge.badgeCls}`}>
                                            {catBadge.shortLabel}
                                        </span>
                                        <span className="font-bold text-slate-800">{item.subtipo_label}</span>
                                    </div>
                                    {item.motivo && (
                                        <p className="text-[11px] text-slate-500 truncate" title={item.motivo}>{item.motivo}</p>
                                    )}
                                    {item.documento_referencia && (
                                        <span className="text-[10.5px] font-mono text-indigo-600 font-semibold block">
                                            Ref: {item.documento_referencia}
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${authBadge.badgeCls}`}>
                                        {authBadge.shortLabel}
                                    </span>
                                    <span className="block text-[10.5px] text-slate-400 mt-0.5">
                                        {item.pidio_permiso ? 'Pidió permiso' : 'No pidió permiso'}
                                        {item.autorizado_por_nombre ? ` · Por: ${item.autorizado_por_nombre}` : ''}
                                    </span>
                                    {item.fecha_autorizacion && (
                                        <span className="block text-[10px] text-slate-400">
                                            {formatDateTime(item.fecha_autorizacion)}
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                    {item.goce_sueldo ? (
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                            Con Goce de Sueldo
                                        </span>
                                    ) : (
                                        <div className="space-y-0.5">
                                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold inline-block">
                                                Sin Goce (Descuento)
                                            </span>
                                            {!!item.afecta_septimo_dia && (
                                                <span className="block text-[10.5px] font-bold text-rose-600">
                                                    + Pierde 7° Día (Art. 171)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onAuthorize(item)}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                                item.estado_autorizacion === 'pendiente'
                                                    ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm'
                                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                            }`}
                                            title="Autorizar o cambiar decisión"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>{item.estado_autorizacion === 'pendiente' ? 'Autorizar' : 'Decisión'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onEdit(item)}
                                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        {isUnjustified && (
                                            <button
                                                type="button"
                                                onClick={() => onOpenAccionPersonal({
                                                    empleado_id: item.empleado_id,
                                                    nombres: item.empleado_nombres,
                                                    apellidos: item.empleado_apellidos,
                                                    codigo: item.empleado_codigo,
                                                    cargo_nombre: item.cargo_nombre,
                                                    departamento_nombre: item.departamento_nombre,
                                                    fecha_ingreso: item.fecha_ingreso
                                                })}
                                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Emitir Acción de Personal"
                                            >
                                                <FileSignature className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => onDelete(item)}
                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Eliminar registro"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />
                <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={pagination.total}
                    itemsOnPage={safeRows.length}
                    limit={limit}
                    onLimitChange={onLimitChange}
                    onPageChange={onPageChange}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
};

export default BiometricAbsencesHistoryView;
