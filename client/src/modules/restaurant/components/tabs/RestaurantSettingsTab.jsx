import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Percent, Clock, ShieldCheck, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../../context/AuthContext';
import { unwrapList } from '../../../../utils/apiUtils';

export default function RestaurantSettingsTab() {
    const { user } = useAuth();
    const branchId = user?.branch_id;
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        enable_tips: true,
        default_tip_percentage: 10.00,
        tip_is_optional: true,
        kds_warning_minutes: 10,
        kds_danger_minutes: 18,
        auto_print_comanda: false,
        allowed_categories: []
    });

    const { data: config, isLoading } = useQuery({
        queryKey: ['restaurant-config', branchId],
        queryFn: async () => {
            const res = await axios.get('/api/restaurant/config', { params: { branch_id: branchId } });
            return res.data?.data || {};
        }
    });

    const { data: categories = [], isLoading: loadingCategories } = useQuery({
        queryKey: ['categories-list'],
        queryFn: async () => unwrapList(await axios.get('/api/categories', { params: { limit: 1000 } }))
    });

    useEffect(() => {
        if (config) {
            setFormData({
                enable_tips: config.enable_tips !== undefined ? Boolean(config.enable_tips) : true,
                default_tip_percentage: config.default_tip_percentage !== undefined ? Number(config.default_tip_percentage) : 10,
                tip_is_optional: config.tip_is_optional !== undefined ? Boolean(config.tip_is_optional) : true,
                kds_warning_minutes: config.kds_warning_minutes || 10,
                kds_danger_minutes: config.kds_danger_minutes || 18,
                auto_print_comanda: Boolean(config.auto_print_comanda),
                allowed_categories: Array.isArray(config.allowed_categories) ? config.allowed_categories : []
            });
        }
    }, [config]);

    const mutation = useMutation({
        mutationFn: async (payload) => axios.put('/api/restaurant/config', { ...payload, branch_id: branchId }),
        onSuccess: () => {
            toast.success('Configuración guardada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['restaurant-config'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar configuración')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    if (isLoading) {
        return <div className="text-center py-12 text-slate-400 text-xs animate-pulse">Cargando configuración...</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
            {/* Parámetros de Propina */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <Percent size={16} />
                    </div>
                    <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">Servicio y Propina Sugerida</h4>
                        <p className="text-xs text-slate-400">Controla el cálculo automático en pre-cuentas y comandas.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                            <span className="text-xs font-bold text-slate-800 block">Habilitar Propina Sugerida</span>
                            <span className="text-[11px] text-slate-400">Calcula propina sugerida en pre-cuenta de 58mm</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={formData.enable_tips}
                            onChange={(e) => setFormData(prev => ({ ...prev, enable_tips: e.target.checked }))}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Porcentaje Sugerido por Defecto (%)
                        </label>
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="50"
                            value={formData.default_tip_percentage}
                            onChange={(e) => setFormData(prev => ({ ...prev, default_tip_percentage: Number(e.target.value) }))}
                            disabled={!formData.enable_tips}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
                        />
                    </div>

                    <div className="sm:col-span-2 flex items-start gap-2 p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-amber-900 text-xs">
                        <ShieldCheck size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">Cumplimiento Legal (El Salvador): </span>
                            <span>
                                La propina se calcula como sugerida (10%) y es voluntaria. El cliente puede solicitar ajustarla o exonerarla antes del cobro final.
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Parámetros de Tiempos KDS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <Clock size={16} />
                    </div>
                    <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">Tiempos de Alerta en Cocina (KDS)</h4>
                        <p className="text-xs text-slate-400">Minutos para cambiar el color de las tarjetas en pantalla.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Alerta Amarilla (Atención en minutos)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={formData.kds_warning_minutes}
                            onChange={(e) => setFormData(prev => ({ ...prev, kds_warning_minutes: Number(e.target.value) }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Alerta Roja (Retraso en minutos)
                        </label>
                        <input
                            type="number"
                            min="2"
                            max="120"
                            value={formData.kds_danger_minutes}
                            onChange={(e) => setFormData(prev => ({ ...prev, kds_danger_minutes: Number(e.target.value) }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                        />
                    </div>
                </div>
            </div>

            {/* Categorías Visibles en Comanda */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                            <Utensils size={16} />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">Categorías del Menú de Comanda</h4>
                            <p className="text-xs text-slate-400">
                                Selecciona qué categorías de productos están disponibles en el terminal para esta sucursal.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                const allIds = (Array.isArray(categories) ? categories : []).map(c => c.id);
                                setFormData(prev => ({ ...prev, allowed_categories: allIds }));
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                            Marcar todas
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, allowed_categories: [] }))}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Desmarcar todas
                        </button>
                    </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500">
                    💡 <span className="font-semibold text-slate-700">Filtro por giro / rubro:</span> Selecciona las categorías de alimentos y bebidas disponibles en esta sucursal. Esto protege el terminal de meseros para mostrar únicamente el menú gastronómico (evitando productos de otros giros) y limita los modificadores a estos rubros.
                </div>

                {loadingCategories ? (
                    <div className="text-center py-6 text-slate-400 text-xs animate-pulse">Cargando categorías...</div>
                ) : (Array.isArray(categories) ? categories : []).length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">No hay categorías registradas en el sistema.</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                        {(Array.isArray(categories) ? categories : []).map(cat => {
                            const isSelected = (formData.allowed_categories || []).includes(cat.id);
                            return (
                                <label
                                    key={cat.id}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                                        isSelected
                                            ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold shadow-2xs'
                                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                            setFormData(prev => {
                                                const current = Array.isArray(prev.allowed_categories) ? prev.allowed_categories : [];
                                                const next = current.includes(cat.id)
                                                    ? current.filter(id => id !== cat.id)
                                                    : [...current, cat.id];
                                                return { ...prev, allowed_categories: next };
                                            });
                                        }}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 shrink-0"
                                    />
                                    <span className="text-xs truncate" title={cat.name}>
                                        {cat.name}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end pt-2">
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-200 transition-all disabled:opacity-50"
                >
                    <Save size={15} />
                    <span>{mutation.isPending ? 'Guardando...' : 'Guardar Parámetros'}</span>
                </button>
            </div>
        </form>
    );
}
