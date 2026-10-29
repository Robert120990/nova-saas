import {
    Search, Calendar, ShieldCheck, Edit3, PlusCircle,
    AlertTriangle, FileSignature, Sun
} from 'lucide-react';
import Table from '../ui/Table';
import { formatDate } from '../../utils/dateUtils';
import { getRadarStatusConfig, getAuthStateBadge } from './biometricAbsenceConstants';

const STATUS_PILLS = [
    { id: 'todos', label: 'Todos' },
    { id: 'sin_justificar', label: 'Sin Justificar' },
    { id: 'pendiente', label: 'Pendientes Autorizar' },
    { id: 'justificados', label: 'Autorizados / De Ley' },
    { id: 'injustificadas', label: 'Injustificadas' },
    { id: 'asistieron', label: 'Asistieron' }
];

const BiometricDailyRadarView = ({
    date,
    onDateChange,
    search,
    onSearchChange,
    statusFilter,
    onStatusFilterChange,
    radarData,
    isLoading,
    onJustifyEmployee,
    onEditAbsence,
    onAuthorizeAbsence,
    onOpenAccionPersonal
}) => {
    const rows = Array.isArray(radarData?.rows) ? radarData.rows : [];
    const isNonWorkingDay = !!(radarData?.is_holiday || radarData?.is_sunday);

    const headers = [
        { label: 'Colaborador', sortKey: 'empleado_nombre', sortType: 'string' },
        { label: 'Departamento / Turno', sortKey: 'departamento_nombre', sortType: 'string' },
        { label: 'Marcaciones Reloj', sortKey: 'primera_entrada', sortType: 'string' },
        { label: 'Estado de Asistencia', sortKey: 'radar_status', sortType: 'string' },
        { label: 'Motivo / Autorización', sortKey: 'codigo_biometrico', sortable: false },
        { label: 'Acciones', className: 'text-right', sortable: false }
    ];

    return (
        <div className="space-y-4">
            {/* Barra de Filtros del Radar Diario */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Fecha Radar:</span>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => onDateChange(e.target.value)}
                                className="text-[13px] font-bold text-slate-800 bg-transparent outline-none"
                            />
                        </div>
                    </div>

                    <div className="relative w-full md:w-72">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Buscar colaborador o código..."
                            className="w-full text-[13px] font-medium border border-slate-200 rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {STATUS_PILLS.map((pill) => (
                        <button
                            key={pill.id}
                            type="button"
                            onClick={() => onStatusFilterChange(pill.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                statusFilter === pill.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {isNonWorkingDay && (
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center gap-2.5 text-xs text-sky-900 font-medium">
                    <Sun className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>
                        <strong>{formatDate(date)}</strong> corresponde a{' '}
                        <strong>{radarData?.holiday_name ? `Día Festivo (${radarData.holiday_name})` : 'Domingo / Día de descanso'}</strong>.
                        Los colaboradores sin marcación no se penalizan como falta automática.
                    </span>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <Table
                    headers={headers}
                    data={rows}
                    isLoading={isLoading}
                    emptyMessage="No hay colaboradores que coincidan con el filtro seleccionado"
                    renderRow={(row) => {
                        const statusCfg = getRadarStatusConfig(row);
                        const abs = row.ausencia;
                        const authBadge = abs ? getAuthStateBadge(abs.estado_autorizacion) : null;

                        return (
                            <tr key={row.empleado_id} className="hover:bg-slate-50/80 transition-colors text-xs">
                                <td className="py-3 px-4">
                                    <span className="font-bold text-slate-800 block">{row.empleado_nombre}</span>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                        {row.codigo ? `Cód: ${row.codigo} · ` : ''}Bio: {row.codigo_biometrico}
                                    </span>
                                </td>
                                <td className="py-3 px-4">
                                    <span className="font-semibold text-slate-700 block">{row.departamento_nombre}</span>
                                    <span className="text-[11px] text-slate-400">
                                        {row.turno_nombre} ({row.hora_entrada_esperada})
                                    </span>
                                </td>
                                <td className="py-3 px-4 font-mono whitespace-nowrap">
                                    {row.total_marcaciones > 0 ? (
                                        <div>
                                            <span className="font-bold text-emerald-700">E: {row.primera_entrada}</span>
                                            {row.ultima_salida && <span className="text-slate-500 ml-2">S: {row.ultima_salida}</span>}
                                            <span className="block text-[10.5px] text-slate-400">{row.total_marcaciones} marcación(es)</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 font-sans italic">Sin marcaciones</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusCfg.cls}`}>
                                        {statusCfg.label}
                                    </span>
                                </td>
                                <td className="py-3 px-4 max-w-[260px]">
                                    {abs ? (
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-slate-800">{abs.subtipo_label}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${authBadge.badgeCls}`}>
                                                    {authBadge.shortLabel}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate" title={abs.motivo}>
                                                {abs.pidio_permiso ? 'Pidió permiso' : 'Sin solicitud previa'}
                                                {abs.motivo ? ` · ${abs.motivo}` : ''}
                                            </p>
                                        </div>
                                    ) : row.radar_status === 'ausente_sin_justificar' ? (
                                        <span className="text-rose-600 font-semibold inline-flex items-center gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Pendiente asignar motivo
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">—</span>
                                    )}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                        {!abs && row.radar_status === 'ausente_sin_justificar' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => onJustifyEmployee(row, 'interna')}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                    <span>Justificar / Permiso</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onJustifyEmployee(row, 'injustificada')}
                                                    className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                                                    title="Marcar como falta sin permiso"
                                                >
                                                    Falta
                                                </button>
                                            </>
                                        )}

                                        {!abs && row.radar_status !== 'ausente_sin_justificar' && (
                                            <button
                                                type="button"
                                                onClick={() => onJustifyEmployee(row, 'interna')}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                            >
                                                <PlusCircle className="w-3.5 h-3.5" />
                                                <span>Permiso</span>
                                            </button>
                                        )}

                                        {abs && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => onAuthorizeAbsence({ ...abs, empleado_nombre: row.empleado_nombre })}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                                        abs.estado_autorizacion === 'pendiente'
                                                            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                    }`}
                                                    title="Autorizar o rechazar permiso"
                                                >
                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                    <span>{abs.estado_autorizacion === 'pendiente' ? 'Autorizar' : 'Decisión'}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onEditAbsence(abs)}
                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Editar registro"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}

                                        {(row.radar_status === 'falta_injustificada' || row.radar_status === 'ausente_sin_justificar') && (
                                            <button
                                                type="button"
                                                onClick={() => onOpenAccionPersonal(row)}
                                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Emitir Acción de Personal (Amonestación / Suspensión)"
                                            >
                                                <FileSignature className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />
            </div>
        </div>
    );
};

export default BiometricDailyRadarView;
