import {
    LogIn, LogOut, Coffee, Clock, CheckCircle2,
    ShieldCheck, Laptop, Fingerprint, RefreshCw
} from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';
import Pagination from '../ui/Pagination';

const BiometricLogsTable = ({
    logs = [],
    isLoading = false,
    pagination = { total: 0, totalPages: 1, page: 1, limit: 20 },
    limit = 20,
    onLimitChange,
    onPageChange
}) => {
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

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-3.5 px-4">Fecha y Hora</th>
                            <th className="py-3.5 px-4">Empleado</th>
                            <th className="py-3.5 px-4">Código Bio</th>
                            <th className="py-3.5 px-4">Tipo Marcación</th>
                            <th className="py-3.5 px-4">Modo Verificación</th>
                            <th className="py-3.5 px-4">Origen / Dispositivo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {isLoading ? (
                            <tr>
                                <td colSpan="6" className="py-12 text-center text-slate-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                    Cargando marcaciones...
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="py-12 text-center text-slate-400">
                                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                    No se encontraron marcaciones para los filtros seleccionados
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => {
                                const badge = getPunchBadge(log.punch_type);
                                const BadgeIcon = badge.icon;
                                const isManual = log.source === 'manual';
                                return (
                                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
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
                                                        {log.cargo || log.departamento || 'Sin cargo'}
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
                                                    Manual ({log.registrado_por_nombre || 'Usuario'})
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
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/50">
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    limit={limit}
                    onLimitChange={onLimitChange}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    );
};

export default BiometricLogsTable;
