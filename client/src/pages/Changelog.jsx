import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { History, GitCommitHorizontal, Clock, User } from 'lucide-react';

const SCOPE_COLORS = {
    'RRHH': 'bg-pink-100 text-pink-700',
    'Branches': 'bg-amber-100 text-amber-700',
    'ConnectedUsers': 'bg-cyan-100 text-cyan-700',
    'db.schema.js': 'bg-violet-100 text-violet-700',
};

const getScopeColor = (scope) => {
    if (!scope) return 'bg-slate-100 text-slate-500';
    return SCOPE_COLORS[scope] || 'bg-indigo-100 text-indigo-700';
};

const getTimeAgo = (dateStr) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `Hoy ${hours}:${mins}`;
    }
    if (diffDays === 1) {
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `Ayer ${hours}:${mins}`;
    }
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}/${mes}/${anio}`;
};

const Changelog = () => {
    const [limit, setLimit] = useState(50);

    const { data: response = { data: [] }, isLoading } = useQuery({
        queryKey: ['changelog', limit],
        queryFn: async () => (await axios.get('/api/changelog', { params: { limit } })).data,
    });

    const commits = response.data || [];

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                        <History size={24} className="text-indigo-600" />
                        Historial de Cambios
                    </h2>
                    <p className="text-slate-500 text-[11px] font-medium">Últimas actualizaciones del sistema</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Mostrar</span>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400"
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 font-medium">Cargando...</div>
                ) : commits.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-medium">No hay cambios registrados</div>
                ) : (
                    <div className="p-6">
                        <div className="relative">
                            <div className="absolute left-[9px] top-3 bottom-3 w-[2px] bg-slate-200" />
                            <div className="space-y-0">
                                {commits.map((commit, i) => (
                                    <div key={commit.hash} className="relative flex gap-4 pb-5">
                                        <div className="relative z-10 mt-1.5 flex-shrink-0">
                                            <div className="w-[20px] h-[20px] rounded-full bg-white border-2 border-indigo-300 flex items-center justify-center">
                                                <div className="w-[8px] h-[8px] rounded-full bg-indigo-500" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {commit.scope && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getScopeColor(commit.scope)}`}>
                                                        {commit.scope}
                                                    </span>
                                                )}
                                                <span className="text-[13px] font-medium text-slate-800 break-words">
                                                    {commit.description}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                                                    <GitCommitHorizontal size={11} />
                                                    {commit.hash}
                                                </span>
                                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                    <Clock size={11} />
                                                    {getTimeAgo(commit.date)}
                                                </span>
                                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                    <User size={11} />
                                                    {commit.author}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Changelog;
