import {
    Power,
    RotateCcw,
    Edit3,
    History,
    Table2,
    FileText,
    FileSpreadsheet,
    CalendarRange,
    Undo2
} from 'lucide-react';
import Table from '../../ui/Table';
import Money from '../../ui/Money';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';

export default function ContainersTableSection({ model }) {
    const {
        filteredContainers,
        cutoffs,
        cutoffChain,
        logs,
        isLoading,
        activeSectionTab,
        setActiveSectionTab,
        handleTogglePower,
        handleResetCycle,
        openEditModal,
        handleOpenStatementPdf,
        handleExportStatementExcel,
        handleRevertCutoff
    } = model;

    const cutoffHeaders = [
        { label: 'Corte', sortKey: 'cutoff_number', sortType: 'number' },
        { label: 'Período (Desde → Hasta)', sortKey: 'period_end', sortType: 'date' },
        { label: 'Origen / Corte Anterior', sortKey: 'previous_cutoff_date', sortType: 'date' },
        { label: 'Cliente', sortKey: 'customer_name', sortType: 'string' },
        { label: 'Contenedores', sortKey: 'billed_containers_count', sortType: 'number', className: 'text-right' },
        { label: 'Total Días', sortKey: 'total_days_on', sortType: 'number', className: 'text-right' },
        { label: 'Subtotal', sortKey: 'subtotal', sortType: 'number', className: 'text-right' },
        { label: 'IVA (13%)', sortKey: 'iva_amount', sortType: 'number', className: 'text-right' },
        { label: 'Total (+IVA)', sortKey: 'total_with_iva', sortType: 'number', className: 'text-right' },
        { label: 'Acciones', sortable: false, className: 'text-right' }
    ];

    const containerHeaders = [
        { label: 'Código', sortKey: 'container_number', sortType: 'number' },
        { label: 'Contenedor', sortKey: 'name', sortType: 'string' },
        { label: 'Estado Actual', sortKey: 'is_active_power', sortType: 'number' },
        { label: 'Último Corte', sortKey: 'last_cutoff_date', sortType: 'date' },
        { label: 'Días en Período', sortKey: 'days_on', sortType: 'number', className: 'text-right' },
        { label: 'Tarifa / Día', sortKey: 'daily_rate', sortType: 'number', className: 'text-right' },
        { label: 'Subtotal', sortKey: 'subtotal', sortType: 'number', className: 'text-right' },
        { label: 'IVA (13%)', sortKey: 'iva_amount', sortType: 'number', className: 'text-right' },
        { label: 'Total (+IVA)', sortKey: 'total_with_iva', sortType: 'number', className: 'text-right' },
        { label: 'Acciones', sortable: false, className: 'text-right' }
    ];

    const logHeaders = [
        { label: 'Fecha / Hora', sortKey: 'created_at', sortType: 'date' },
        { label: 'Contenedor', sortKey: 'container_name', sortType: 'string' },
        { label: 'Movimiento', sortKey: 'action_type', sortType: 'string' },
        { label: 'Días', sortKey: 'days_on', sortType: 'number', className: 'text-right' },
        { label: 'Tarifa / Día', sortKey: 'daily_rate', sortType: 'number', className: 'text-right' },
        { label: 'Subtotal', sortKey: 'subtotal', sortType: 'number', className: 'text-right' },
        { label: 'IVA (13%)', sortKey: 'iva_amount', sortType: 'number', className: 'text-right' },
        { label: 'Total (+IVA)', sortKey: 'total_with_iva', sortType: 'number', className: 'text-right' },
        { label: 'Usuario', sortKey: 'user_name', sortType: 'string' }
    ];

    const getActionBadge = (type) => {
        switch (type) {
            case 'encendido':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-100 text-cyan-800">
                        Encendido
                    </span>
                );
            case 'apagado':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                        Apagado
                    </span>
                );
            case 'corte_fechas':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                        Corte Estado Cuenta
                    </span>
                );
            case 'cierre_ciclo':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        Ciclo Cerrado
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800">
                        Ajuste Días
                    </span>
                );
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        Estados de Cuenta por Corte de Fechas y Bitácora
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                        Historial encadenado de estados de cuenta emitidos al cliente, tabla del período actual y bitácora.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
                    <button
                        type="button"
                        onClick={() => setActiveSectionTab('cutoffs')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeSectionTab === 'cutoffs'
                                ? 'bg-white text-indigo-600 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <CalendarRange size={14} />
                        <span>Estados de Cuenta / Cortes ({cutoffs.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSectionTab('table')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeSectionTab === 'table'
                                ? 'bg-white text-indigo-600 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Table2 size={14} />
                        <span>Período Actual ({filteredContainers.length})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSectionTab('logs')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            activeSectionTab === 'logs'
                                ? 'bg-white text-indigo-600 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <History size={14} />
                        <span>Bitácora ({logs.length})</span>
                    </button>
                </div>
            </div>

            {activeSectionTab === 'cutoffs' && (
                <Table
                    headers={cutoffHeaders}
                    data={cutoffs}
                    loading={isLoading}
                    defaultSortBy="cutoff_number"
                    defaultSortDir="desc"
                    emptyMessage="Aún no se han realizado cortes por fechas. Utilice el botón 'Realizar Corte por Fechas' para generar el primer Estado de Cuenta."
                    renderRow={(cut) => {
                        const isLatest = Number(cut.id) === Number(cutoffChain?.last_cutoff_id);
                        return (
                            <tr key={cut.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-3 py-2 text-xs font-black text-indigo-700">
                                    <div className="flex items-center gap-1.5">
                                        <span>{cut.cutoff_code}</span>
                                        {isLatest && (
                                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                                                Último
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-normal block">
                                        {formatDateTime(cut.created_at)}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-xs font-bold text-slate-900">
                                    {formatDate(cut.period_start)} → {formatDate(cut.period_end)}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                    {cut.previous_cutoff_date ? (
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                            Partió del {formatDate(cut.previous_cutoff_date)}
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-slate-400 font-medium">
                                            Corte Inicial
                                        </span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-xs font-semibold text-slate-800">
                                    <div>{cut.customer_name || 'Cliente General'}</div>
                                    {cut.notes && (
                                        <div className="text-[10px] text-slate-500 font-normal">{cut.notes}</div>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-xs font-bold text-slate-700 text-right">
                                    {cut.billed_containers_count} / {cut.total_containers}
                                </td>
                                <td className="px-3 py-2 text-xs font-black text-indigo-700 text-right">
                                    {cut.total_days_on} d
                                </td>
                                <td className="px-3 py-2 text-xs font-bold text-slate-900 text-right">
                                    <Money value={cut.subtotal} />
                                </td>
                                <td className="px-3 py-2 text-xs font-semibold text-amber-700 text-right">
                                    <Money value={cut.iva_amount} />
                                </td>
                                <td className="px-3 py-2 text-xs font-black text-emerald-700 text-right">
                                    <Money value={cut.total_with_iva} />
                                </td>
                                <td className="px-3 py-2 text-xs text-right">
                                    <div className="inline-flex items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleOpenStatementPdf({
                                                    cutoff_id: cut.id,
                                                    code: cut.cutoff_code
                                                })
                                            }
                                            className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                            title="Ver e imprimir Estado de Cuenta en PDF"
                                        >
                                            <FileText size={13} />
                                            <span>PDF</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleExportStatementExcel({ cutoff_id: cut.id })}
                                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                            title="Exportar Estado de Cuenta a Excel"
                                        >
                                            <FileSpreadsheet size={14} />
                                        </button>
                                        {isLatest && (
                                            <button
                                                type="button"
                                                onClick={() => handleRevertCutoff(cut)}
                                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                                                title="Revertir último corte y restaurar días a los contenedores"
                                            >
                                                <Undo2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    }}
                />
            )}

            {activeSectionTab === 'table' && (
                <Table
                    headers={containerHeaders}
                    data={filteredContainers}
                    loading={isLoading}
                    defaultSortBy="container_number"
                    defaultSortDir="asc"
                    emptyMessage="No hay contenedores registrados"
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2 text-xs font-bold text-slate-800">{c.code}</td>
                            <td className="px-3 py-2 text-xs font-bold text-slate-900">
                                <div>{c.name}</div>
                                {c.notes && (
                                    <div className="text-[10px] text-slate-500 font-normal">{c.notes}</div>
                                )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                        c.is_active_power
                                            ? 'bg-cyan-100 text-cyan-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                >
                                    {c.is_active_power ? 'Encendido • En Uso' : 'Disponible • Apagado'}
                                </span>
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-slate-600">
                                {c.last_cutoff_date ? formatDate(c.last_cutoff_date) : 'Sin corte previo'}
                            </td>
                            <td className="px-3 py-2 text-xs font-black text-indigo-700 text-right">
                                {c.days_on} {c.days_on === 1 ? 'día' : 'días'}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-700 text-right">
                                <Money value={c.daily_rate} />
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-slate-900 text-right">
                                <Money value={c.subtotal} />
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-amber-700 text-right">
                                <Money value={c.iva_amount} />
                            </td>
                            <td className="px-3 py-2 text-xs font-black text-emerald-700 text-right">
                                <Money value={c.total_with_iva} />
                            </td>
                            <td className="px-3 py-2 text-xs text-right">
                                <div className="inline-flex items-center justify-end gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleTogglePower(c)}
                                        className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                            c.is_active_power
                                                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                        title={c.is_active_power ? 'Apagar contenedor' : 'Encender contenedor'}
                                    >
                                        <Power size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openEditModal(c)}
                                        className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                                        title="Editar días / contenedor"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    {c.days_on > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => handleResetCycle(c)}
                                            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                                            title="Cerrar ciclo individual y reiniciar a 0 días"
                                        >
                                            <RotateCcw size={14} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    )}
                />
            )}

            {activeSectionTab === 'logs' && (
                <Table
                    headers={logHeaders}
                    data={logs}
                    loading={isLoading}
                    defaultSortBy="created_at"
                    defaultSortDir="desc"
                    emptyMessage="Aún no hay movimientos registrados en la bitácora"
                    renderRow={(log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2 text-[11px] font-medium text-slate-600">
                                {formatDateTime(log.created_at)}
                            </td>
                            <td className="px-3 py-2 text-xs font-bold text-slate-900">
                                {log.container_name}
                                {log.notes && (
                                    <span className="block text-[10px] text-slate-500 font-normal">
                                        {log.notes}
                                    </span>
                                )}
                            </td>
                            <td className="px-3 py-2 text-xs">{getActionBadge(log.action_type)}</td>
                            <td className="px-3 py-2 text-xs font-bold text-indigo-700 text-right">
                                {log.days_on} d
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-700 text-right">
                                <Money value={log.daily_rate} />
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-800 text-right">
                                <Money value={log.subtotal} />
                            </td>
                            <td className="px-3 py-2 text-xs text-amber-700 text-right">
                                <Money value={log.iva_amount} />
                            </td>
                            <td className="px-3 py-2 text-xs font-black text-emerald-700 text-right">
                                <Money value={log.total_with_iva} />
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">
                                {log.user_name || 'Sistema'}
                            </td>
                        </tr>
                    )}
                />
            )}
        </div>
    );
}
