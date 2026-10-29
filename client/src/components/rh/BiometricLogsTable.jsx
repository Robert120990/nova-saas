import {
    LogIn, LogOut, Coffee, Clock, CheckCircle2,
    ShieldCheck, Laptop, Fingerprint, FolderArchive
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';

const BiometricLogsTable = ({
    logs = [],
    isLoading = false,
    pagination = { total: 0, totalPages: 1, page: 1, limit: 20 },
    limit = 20,
    onLimitChange,
    onPageChange
}) => {
    const safeLogs = Array.isArray(logs) ? logs : [];

    const getPunchBadge = (type) => {
        switch (type) {
            case 'entrada':
                return { label: 'Entrada', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: LogIn };
            case 'salida':
                return { label: 'Salida', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: LogOut };
            case 'salida_almuerzo':
                return { label: 'Salida Almuerzo', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Coffee };
            case 'entrada_almuerzo':
                return { label: 'Regreso Almuerzo', bg: 'bg-sky-50 text-sky-700 border-sky-200', icon: CheckCircle2 };
            default:
                return { label: type || 'Marcación', bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock };
        }
    };

    const headers = [
        { label: 'Fecha y Hora', sortKey: 'punch_time', sortType: 'date' },
        { label: 'Empleado', sortKey: 'empleado_nombre_completo', sortType: 'string' },
        { label: 'Código Bio', sortKey: 'device_uid', sortType: 'number' },
        { label: 'Tipo Marcación', sortKey: 'punch_type', sortType: 'string' },
        { label: 'Modo Verificación', sortKey: 'verify_label', sortType: 'string' },
        { label: 'Origen / Dispositivo', sortKey: 'source', sortType: 'string' }
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <Table
                headers={headers}
                data={safeLogs}
                isLoading={isLoading}
                emptyMessage="No se encontraron marcaciones para el rango de fechas y filtros seleccionados"
                renderRow={(log) => {
                    const badge = getPunchBadge(log.punch_type);
                    const BadgeIcon = badge.icon;
                    const isManual = log.source === 'manual';
                    const isZkImport = log.source === 'zk_import';
                    return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors text-xs font-medium text-slate-700">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                                {formatDateTime(log.punch_time)}
                            </td>
                            <td className="py-3 px-4">
                                {log.empleado_nombres ? (
                                    <div>
                                        <span className="font-bold text-slate-800 block">
                                            {log.empleado_nombres} {log.empleado_apellidos}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            {log.cargo_nombre || log.departamento_nombre || 'Sin cargo'}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-amber-600 font-medium">
                                        No vinculado (UID: {log.device_uid})
                                    </span>
                                )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                                <span className="bg-slate-100 px-2 py-0.5 rounded border text-[11px] font-bold">
                                    {log.device_uid || '—'}
                                </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                                    <BadgeIcon className="w-3.5 h-3.5" />
                                    {badge.label}
                                </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                                    {log.verify_label || 'Huella'}
                                </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                                {isManual ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        <Laptop className="w-3 h-3" />
                                        Manual ({log.registrado_por_nombre || 'RH'})
                                    </span>
                                ) : isZkImport ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                        <FolderArchive className="w-3 h-3" />
                                        Archivo ZK (.xls)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600">
                                        <Fingerprint className="w-3.5 h-3.5 text-indigo-500" />
                                        {log.device_nombre || 'Reloj'} ({log.device_ip || '192.168.3.201'})
                                    </span>
                                )}
                            </td>
                        </tr>
                    );
                }}
            />

            <div className="border-t border-slate-100 px-4 py-1 bg-slate-50/50">
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemsOnPage={safeLogs.length}
                    isLoading={isLoading}
                    limit={limit}
                    onLimitChange={onLimitChange}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};

export default BiometricLogsTable;
