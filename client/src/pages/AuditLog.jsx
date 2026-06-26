import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Pagination from '../components/ui/Pagination';
import { Search, Clock, ShieldAlert, Filter } from 'lucide-react';

const ENTITY_TYPES = [
    'api_request', 'sale', 'product', 'customer', 'user', 'company', 'branch', 'pos',
    'dte', 'purchase', 'expense', 'provider', 'role', 'inventory', 'transfer', 'payment'
];

const ACTION_TYPES = [
    { label: 'Crear', value: 'POST' },
    { label: 'Actualizar', value: 'PUT' },
    { label: 'Eliminar', value: 'DELETE' },
    { label: 'Consultar', value: 'GET' },
    { label: 'DTE Emitir', value: 'emit' },
    { label: 'DTE Invalidar', value: 'invalidate' },
    { label: 'Login', value: 'login' },
    { label: 'Imprimir', value: 'print' },
];

const AuditLog = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [filterEntity, setFilterEntity] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);
    const limit = 50;

    const params = { search, page, limit };
    if (filterEntity) params.entity_type = filterEntity;
    if (filterAction) params.action = filterAction;

    const { data: logData = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['audit-log', search, page, filterEntity, filterAction],
        queryFn: async () => (await axios.get('/api/audit-log', { params })).data
    });

    const getActionColor = (action) => {
        if (action.startsWith('POST')) return 'text-emerald-600 bg-emerald-50';
        if (action.startsWith('PUT')) return 'text-amber-600 bg-amber-50';
        if (action.startsWith('DELETE')) return 'text-rose-600 bg-rose-50';
        if (action.startsWith('GET')) return 'text-blue-600 bg-blue-50';
        return 'text-slate-600 bg-slate-50';
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleString('es-SV');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <ShieldAlert size={24} className="text-indigo-600" />
                        Bitácora del Sistema
                    </h2>
                    <p className="text-slate-500 font-medium">Registro de auditoría de todas las operaciones del sistema</p>
                </div>
                <div className="text-xs text-slate-400 font-bold">{logData.total} registros</div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por usuario, acción, entidad..."
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-slate-400" />
                        <select
                            value={filterEntity}
                            onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
                        >
                            <option value="">Todas las entidades</option>
                            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select
                            value={filterAction}
                            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-indigo-400"
                        >
                            <option value="">Todas las acciones</option>
                            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-3 py-1.5 w-36">Fecha/Hora</th>
                                <th className="px-3 py-1.5">Usuario</th>
                                <th className="px-3 py-1.5 w-24">Acción</th>
                                <th className="px-3 py-1.5">Entidad</th>
                                <th className="px-3 py-1.5">Descripción</th>
                                <th className="px-3 py-1.5 w-20 text-right">Duración</th>
                                <th className="px-3 py-1.5 w-28">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {logData.data.map((row) => (
                                <React.Fragment key={row.id}>
                                    <tr
                                        className="hover:bg-slate-50/50 transition-colors cursor-pointer text-xs"
                                        onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                                    >
                                        <td className="px-3 py-1">
                                            <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">
                                                {new Date(row.created_at).toLocaleString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1">
                                            <span className="text-[11px] font-bold text-slate-800">{row.username || '—'}</span>
                                        </td>
                                        <td className="px-3 py-1">
                                            <span className={`inline-block px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${getActionColor(row.action)}`}>
                                                {row.action?.split(' ')[0] || row.action}
                                            </span>
                                        </td>
                                        <td className="px-3 py-1">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                                {row.entity_type}
                                            </span>
                                            {row.entity_id && (
                                                <span className="text-[8px] text-slate-400 font-mono ml-1">#{row.entity_id}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-1 max-w-xs">
                                            <span className="text-[11px] text-slate-600 truncate block">{row.description || '—'}</span>
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                            {row.duration_ms != null && (
                                                <span className={`text-[9px] font-bold ${row.duration_ms > 1000 ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {row.duration_ms}ms
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-1">
                                            <span className="text-[9px] font-mono text-slate-400">{row.ip_address || '—'}</span>
                                        </td>
                                    </tr>
                                    {expandedRow === row.id && (
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={7} className="px-6 py-3">
                                                <div className="grid grid-cols-2 gap-3 text-[11px]">
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">ID</span>
                                                        <p className="font-bold text-slate-700">{row.id}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Fecha Completa</span>
                                                        <p className="font-bold text-slate-700">{formatDateTime(row.created_at)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Usuario</span>
                                                        <p className="font-bold text-slate-700">{row.username || 'Anónimo'} {row.user_id ? `(ID: ${row.user_id})` : ''}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Empresa / Sucursal</span>
                                                        <p className="font-bold text-slate-700">Company #{row.company_id}{row.branch_id ? ` / Branch #${row.branch_id}` : ''}</p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Descripción Completa</span>
                                                        <p className="font-bold text-slate-700">{row.description || '—'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                            {!isLoading && logData.data.length === 0 && (
                                <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400 italic">No se encontraron registros</td></tr>
                            )}
                            {isLoading && (
                                <tr><td colSpan={7} className="px-3 py-6 text-center">
                                    <div className="flex items-center justify-center gap-3"><Clock size={18} className="animate-spin text-indigo-500" /><span className="text-xs font-bold text-slate-400">Cargando...</span></div>
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    currentPage={page}
                    totalPages={logData.totalPages}
                    totalItems={logData.total}
                    onPageChange={setPage}
                    itemsOnPage={logData.data.length}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
};

export default AuditLog;
