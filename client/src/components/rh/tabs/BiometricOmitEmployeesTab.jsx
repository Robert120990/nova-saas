import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { UserX, UserCheck, Search, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';

const FILTER_PILLS = [
    { id: 'todos', label: 'Todos' },
    { id: 'omitidos', label: 'Omitidos' },
    { id: 'activos', label: 'En Marcador' },
    { id: 'sin_bio', label: 'Sin código Bio' }
];

const BiometricOmitEmployeesTab = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || null;
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('todos');

    const { data: rawEmployees = [], isLoading } = useQuery({
        queryKey: ['rh-biometric-omit-employees', companyId],
        queryFn: async () => unwrapList(await axios.get('/api/rh/biometric/omit-employees'))
    });

    const employees = useMemo(
        () => (Array.isArray(rawEmployees) ? rawEmployees : []),
        [rawEmployees]
    );

    const invalidateRelated = () => {
        [
            'rh-biometric-omit-employees',
            'rh-biometric-daily-radar',
            'rh-biometric-employee-shifts',
            'rh-biometric-attendance-report',
            'rh-biometric-cortes-daily-overtime',
            'rh-biometric-cortes-summary'
        ].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    };

    const toggleMutation = useMutation({
        mutationFn: async ({ empId, omitir }) =>
            (await axios.post(`/api/rh/biometric/omit-employees/${empId}`, { omitir })).data,
        onSuccess: (data) => {
            toast.success(data?.message || 'Estado actualizado.');
            invalidateRelated();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar estado')
    });

    const batchMutation = useMutation({
        mutationFn: async (payload) =>
            (await axios.post('/api/rh/biometric/omit-employees/batch', payload)).data,
        onSuccess: (data) => {
            toast.success(data?.message || 'Exclusiones actualizadas en lote.');
            invalidateRelated();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar en lote')
    });

    const stats = useMemo(() => {
        const omitidos = employees.filter((e) => !!e.omitir_marcador_digital).length;
        const sinBioNoOmitidos = employees.filter(
            (e) => !e.omitir_marcador_digital && !(e.codigo_biometrico && String(e.codigo_biometrico).trim())
        );
        return {
            total: employees.length,
            omitidos,
            enMarcador: employees.length - omitidos,
            sinBioNoOmitidos
        };
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        return employees.filter((e) => {
            const isOmitted = !!e.omitir_marcador_digital;
            const hasBio = !!(e.codigo_biometrico && String(e.codigo_biometrico).trim());

            if (filter === 'omitidos' && !isOmitted) return false;
            if (filter === 'activos' && isOmitted) return false;
            if (filter === 'sin_bio' && hasBio) return false;

            if (!q) return true;
            return (
                e.nombre_completo?.toLowerCase().includes(q) ||
                e.codigo?.toLowerCase().includes(q) ||
                String(e.codigo_biometrico || '').toLowerCase().includes(q) ||
                e.cargo_nombre?.toLowerCase().includes(q) ||
                e.departamento_nombre?.toLowerCase().includes(q)
            );
        });
    }, [employees, search, filter]);

    const handleOmitAllWithoutBio = () => {
        const omitIds = stats.sinBioNoOmitidos.map((e) => e.id);
        if (omitIds.length === 0) return;
        batchMutation.mutate({ omitIds });
    };

    return (
        <div className="space-y-4">
            <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5">
                <UserX className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                    <strong className="block font-bold">Omitir del Marcador Digital (Fuera de Planta / Sin Horario Fijo):</strong>
                    <span>
                        Active esta opción para colaboradores que trabajan fuera de planta (ruta, campo, ventas, gerencia) o cuyo contrato no les asigna un horario definido. No aparecerán como inasistencias en el Radar Diario ni en reportes biométricos, sin borrar su historial previo.
                    </span>
                </div>
            </div>

            {/* Resumen + Acción rápida */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <UserCheck className="w-3.5 h-3.5" />
                        En Marcador: {stats.enMarcador}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <UserX className="w-3.5 h-3.5" />
                        Omitidos: {stats.omitidos}
                    </span>
                </div>

                {stats.sinBioNoOmitidos.length > 0 && (
                    <button
                        type="button"
                        onClick={handleOmitAllWithoutBio}
                        disabled={batchMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        title="Omitir en lote a los colaboradores activos que no tienen código biométrico asignado"
                    >
                        {batchMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>Omitir sin código Bio ({stats.sinBioNoOmitidos.length})</span>
                    </button>
                )}
            </div>

            {/* Búsqueda + Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Buscar por nombre, código, Bio UID, cargo o departamento..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                    {FILTER_PILLS.map((pill) => (
                        <button
                            key={pill.id}
                            type="button"
                            onClick={() => setFilter(pill.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                filter === pill.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista de colaboradores */}
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl divide-y bg-white">
                {isLoading ? (
                    <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Cargando colaboradores...</span>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                        No se encontraron colaboradores con los criterios seleccionados.
                    </div>
                ) : (
                    filteredEmployees.map((emp) => {
                        const isOmitted = !!emp.omitir_marcador_digital;
                        const hasBio = !!(emp.codigo_biometrico && String(emp.codigo_biometrico).trim());
                        return (
                            <label
                                key={emp.id}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 cursor-pointer transition-colors ${
                                    isOmitted ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50'
                                }`}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-slate-800 text-xs">{emp.nombre_completo}</span>
                                        {isOmitted && (
                                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                                Omitido
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-slate-400 block truncate">
                                        [{emp.codigo}] {hasBio ? `Bio: ${emp.codigo_biometrico}` : 'Sin código Bio'} &bull; {emp.cargo_nombre || 'Sin cargo'} &bull; {emp.departamento_nombre || 'Sin depto'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                                    <span className={`text-[11px] font-bold ${isOmitted ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {isOmitted ? 'Omitido del marcador' : 'Controlado en marcador'}
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={isOmitted}
                                        disabled={toggleMutation.isPending}
                                        onChange={(e) => toggleMutation.mutate({ empId: emp.id, omitir: e.target.checked })}
                                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                                    />
                                </div>
                            </label>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default BiometricOmitEmployeesTab;
