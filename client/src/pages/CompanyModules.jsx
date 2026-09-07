import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Layers, 
    Building2, 
    Check, 
    Search, 
    Receipt, 
    ShoppingBag, 
    Package, 
    Fuel, 
    Droplets, 
    Sparkles, 
    Handshake, 
    BookOpen, 
    Users,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MODULE_ICONS = {
    sales: Receipt,
    purchases: ShoppingBag,
    inventory: Package,
    gas_station: Fuel,
    pozo: Droplets,
    egg_industrial: Sparkles,
    crm: Handshake,
    accounting: BookOpen,
    human_resources: Users,
};

export default function CompanyModules() {
    const { user, updateUser } = useAuth();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    
    const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
        const param = searchParams.get('company_id');
        return param ? parseInt(param, 10) : null;
    });
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const param = searchParams.get('company_id');
        if (param) {
            setSelectedCompanyId(parseInt(param, 10));
        }
    }, [searchParams]);

    // Obtener la matriz de módulos y empresas
    const { data: matrixData = { available_modules: [], companies: [] }, isLoading } = useQuery({
        queryKey: ['company-modules-matrix'],
        queryFn: async () => {
            const res = await axios.get('/api/companies/modules-matrix');
            return res.data;
        }
    });

    const companies = matrixData.companies || [];
    const availableModules = matrixData.available_modules || [];

    // Auto-seleccionar la empresa del usuario actual si no hay selección
    const activeCompany = useMemo(() => {
        if (companies.length === 0) return null;
        if (selectedCompanyId) {
            return companies.find(c => c.id === selectedCompanyId) || companies[0];
        }
        const found = companies.find(c => c.id === user?.company_id);
        return found || companies[0];
    }, [companies, selectedCompanyId, user?.company_id]);

    // Filtrar empresas según término de búsqueda
    const filteredCompanies = useMemo(() => {
        if (!searchQuery.trim()) return companies;
        const q = searchQuery.toLowerCase();
        return companies.filter(c => 
            (c.razon_social && c.razon_social.toLowerCase().includes(q)) ||
            (c.nombre_comercial && c.nombre_comercial.toLowerCase().includes(q)) ||
            (c.nit && c.nit.toLowerCase().includes(q))
        );
    }, [companies, searchQuery]);

    // Mutación para actualizar módulos
    const updateModulesMutation = useMutation({
        mutationFn: async ({ companyId, modules }) => {
            const res = await axios.put(`/api/companies/${companyId}/modules`, { modules });
            return res.data;
        },
        onSuccess: (data, variables) => {
            toast.success('Módulos actualizados correctamente');
            queryClient.invalidateQueries({ queryKey: ['company-modules-matrix'] });

            // Si se actualizó la empresa en la que está el usuario conectado actualmente, refrescar su sesión
            if (user?.company_id === parseInt(variables.companyId, 10)) {
                updateUser({ enabled_modules: variables.modules });
                queryClient.invalidateQueries({ queryKey: ['menu-items'] });
            }
        },
        onError: (err) => {
            console.error('Error al actualizar módulos:', err);
            toast.error(err.response?.data?.message || 'Error al actualizar los módulos de la empresa');
        }
    });

    const handleToggleModule = (moduleId) => {
        if (!activeCompany) return;
        const currentModules = activeCompany.enabled_modules || [];
        const exists = currentModules.includes(moduleId);
        const nextModules = exists 
            ? currentModules.filter(m => m !== moduleId)
            : [...currentModules, moduleId];

        updateModulesMutation.mutate({
            companyId: activeCompany.id,
            modules: nextModules
        });
    };

    const handleSetAll = (enableAll = true) => {
        if (!activeCompany) return;
        const nextModules = enableAll 
            ? availableModules.map(m => m.id)
            : ['sales', 'purchases', 'inventory'];

        updateModulesMutation.mutate({
            companyId: activeCompany.id,
            modules: nextModules
        });
    };

    // Agrupar módulos por categoría
    const modulesByCategory = useMemo(() => {
        const groups = {};
        availableModules.forEach(mod => {
            const cat = mod.category || 'General';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(mod);
        });
        return groups;
    }, [availableModules]);

    return (
        <div className="space-y-6">
            {/* Encabezado Estándar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                        Módulos por Empresa
                    </h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm">
                        Control de activación y visibilidad de funciones por modelo de negocio
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['company-modules-matrix'] })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95"
                        title="Refrescar lista"
                    >
                        <RefreshCw size={15} className={`text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Refrescar</span>
                    </button>
                </div>
            </div>

            {/* Selector de Empresa y Panel de Configuración */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Panel Izquierdo: Lista de Empresas */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Empresas Registradas ({filteredCompanies.length})
                            </span>
                        </div>

                        {/* Buscador de empresas */}
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar empresa o NIT..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>

                        {/* Lista de empresas */}
                        <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                            {filteredCompanies.map((comp) => {
                                const isSelected = activeCompany?.id === comp.id;
                                const isCurrentSession = user?.company_id === comp.id;
                                const activeCount = (comp.enabled_modules || []).length;

                                return (
                                    <button
                                        key={comp.id}
                                        onClick={() => setSelectedCompanyId(comp.id)}
                                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                                            isSelected 
                                                ? 'bg-indigo-50/70 border-indigo-300 shadow-sm' 
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                                            isSelected 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20' 
                                                : 'bg-slate-100 border-slate-200 text-slate-500'
                                        }`}>
                                            <Building2 size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className={`font-bold text-xs truncate ${isSelected ? 'text-indigo-950' : 'text-slate-900'}`}>
                                                    {comp.nombre_comercial || comp.razon_social}
                                                </span>
                                                {isCurrentSession && (
                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Sesión Activa
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                                                {comp.razon_social}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                    {activeCount} de {availableModules.length} módulos
                                                </span>
                                                {comp.codigo_actividad && (
                                                    <span className="text-[10px] font-mono text-slate-400">
                                                        Act: {comp.codigo_actividad}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {filteredCompanies.length === 0 && (
                                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                                    No se encontraron empresas con ese criterio.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Panel Derecho: Módulos de la Empresa Seleccionada */}
                <div className="lg:col-span-8 space-y-6">
                    {activeCompany ? (
                        <div className="space-y-6">
                            {/* Tarjeta de Resumen de la Empresa Seleccionada */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">
                                            Empresa en Edición
                                        </span>
                                        {user?.company_id === activeCompany.id && (
                                            <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Tu empresa actual
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                                        {activeCompany.razon_social}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                                        {activeCompany.nit && (
                                            <span>NIT: <strong className="text-slate-700 font-mono">{activeCompany.nit}</strong></span>
                                        )}
                                        {activeCompany.nrc && (
                                            <span>NRC: <strong className="text-slate-700 font-mono">{activeCompany.nrc}</strong></span>
                                        )}
                                        {activeCompany.codigo_actividad && (
                                            <span className="text-slate-600">
                                                Giro: <strong className="text-indigo-600">{activeCompany.codigo_actividad}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleSetAll(false)}
                                        disabled={updateModulesMutation.isPending}
                                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors disabled:opacity-50 active:scale-95"
                                    >
                                        Solo Core
                                    </button>
                                    <button
                                        onClick={() => handleSetAll(true)}
                                        disabled={updateModulesMutation.isPending}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 active:scale-95"
                                    >
                                        Activar Todos
                                    </button>
                                </div>
                            </div>

                            {/* Categorías de Módulos */}
                            {Object.entries(modulesByCategory).map(([category, modules]) => (
                                <div key={category} className="space-y-3">
                                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                                            {category}
                                        </span>
                                        <span className="text-[11px] text-slate-400 font-medium">
                                            ({modules.length} {modules.length === 1 ? 'módulo' : 'módulos'})
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        {modules.map((mod) => {
                                            const Icon = MODULE_ICONS[mod.id] || Layers;
                                            const isEnabled = (activeCompany.enabled_modules || []).includes(mod.id);

                                            return (
                                                <div
                                                    key={mod.id}
                                                    onClick={() => !updateModulesMutation.isPending && handleToggleModule(mod.id)}
                                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                                                        isEnabled
                                                            ? 'bg-white border-indigo-300 shadow-sm hover:border-indigo-400 ring-1 ring-indigo-500/10'
                                                            : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                                                        isEnabled
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20'
                                                            : 'bg-white text-slate-400 border-slate-200'
                                                    }`}>
                                                        <Icon size={20} />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <h4 className={`font-bold text-sm tracking-tight ${
                                                                isEnabled ? 'text-slate-900' : 'text-slate-600'
                                                            }`}>
                                                                {mod.name}
                                                            </h4>
                                                            
                                                            {/* Toggle Switch estándar */}
                                                            <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                                                                isEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                                                            }`}>
                                                                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                                    isEnabled ? 'translate-x-4' : 'translate-x-0'
                                                                }`} />
                                                            </div>
                                                        </div>

                                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2 font-normal">
                                                            {mod.description}
                                                        </p>

                                                        <div className="flex items-center gap-2 mt-2.5">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                                                isEnabled
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                                            }`}>
                                                                {isEnabled ? (
                                                                    <>
                                                                        <Check size={11} className="stroke-[3]" />
                                                                        Habilitado
                                                                    </>
                                                                ) : (
                                                                    'Deshabilitado'
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
                            <Building2 size={36} className="mx-auto text-slate-400 mb-3" />
                            <h3 className="text-slate-700 font-bold text-sm">Selecciona una empresa</h3>
                            <p className="text-slate-400 text-xs mt-1">Elige una empresa del listado para gestionar sus módulos activos.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
