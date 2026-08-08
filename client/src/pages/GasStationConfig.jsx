import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

export default function GasStationConfig() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [lubricantCategoryId, setLubricantCategoryId] = useState('');
    const [variacionPermitida, setVariacionPermitida] = useState('');
    const [cuentaBancariaPista, setCuentaBancariaPista] = useState('');
    const [empresaRrs, setEmpresaRrs] = useState('');

    const { data: settings } = useQuery({
        queryKey: ['gas-station-settings'],
        queryFn: () => axios.get('/api/gas-station/settings').then(r => r.data),
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories-all'],
        queryFn: () => axios.get('/api/categories', { params: { limit: 5000 } }).then(r => r.data?.data || []),
    });

    useEffect(() => {
        if (settings?.lubricant_category_id) setLubricantCategoryId(settings.lubricant_category_id);
        if (settings?.variacion_permitida) setVariacionPermitida(settings.variacion_permitida);
        if (settings?.cuenta_bancaria_pista) setCuentaBancariaPista(settings.cuenta_bancaria_pista);
        if (settings?.rrs_id_empresa) setEmpresaRrs(settings.rrs_id_empresa);
    }, [settings]);

    const saveMutation = useMutation({
        mutationFn: (data) => axios.put('/api/gas-station/settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gas-station-settings'] });
            toast.success('Configuración guardada');
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Error al guardar configuración');
        },
    });

    const handleSave = () => {
        saveMutation.mutate({
            lubricant_category_id: lubricantCategoryId || null,
            variacion_permitida: variacionPermitida || null,
            cuenta_bancaria_pista: cuentaBancariaPista || null,
            rrs_id_empresa: empresaRrs || null,
        });
    };

    const categoriesList = categories;

    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
    const fieldCls = "w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400";

    return (
        <div className="p-6 max-w-xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-slate-800">Configuración Gasolinera</h1>
                {user?.branch_name && (
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                        Sucursal: {user.branch_name}
                    </span>
                )}
            </div>
            <p className="text-xs text-slate-400 mb-6">Configura los parámetros operativos de la gasolinera</p>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">
                <div>
                    <label className={labelCls}>Categoría de Lubricantes</label>
                    <select
                        value={lubricantCategoryId}
                        onChange={(e) => setLubricantCategoryId(e.target.value)}
                        className={fieldCls}
                    >
                        <option value="">-- Seleccionar categoría --</option>
                        {categoriesList.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                        Los productos de esta categoría se considerarán lubricantes en los reportes de cierre de lecturas.
                    </p>
                </div>

                <div>
                    <label className={labelCls}>Variación Permitida ($)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={variacionPermitida}
                        onChange={(e) => setVariacionPermitida(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        className={fieldCls + " font-mono"}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                        Si la diferencia entre ingresos y egresos supera este monto, no se permitirá cerrar el turno. Déjelo en 0 para no aplicar validación.
                    </p>
                </div>

                <div>
                    <label className={labelCls}>Cuenta Bancaria Pista</label>
                    <input
                        type="text"
                        value={cuentaBancariaPista}
                        onChange={(e) => setCuentaBancariaPista(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="Número de cuenta bancaria"
                        className={fieldCls + " font-mono"}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                        Número de cuenta para depósitos y remesas de la gasolinera.
                    </p>
                </div>

                <div>
                    <label className={labelCls}>Empresa en RRS</label>
                    <input
                        type="text"
                        value={empresaRrs}
                        onChange={(e) => setEmpresaRrs(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="Código de empresa (ej. 015)"
                        className={fieldCls + " font-mono"}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                        Código de la empresa en la base RRS. Se usa en el envío de cierres de lecturas y remesas.
                    </p>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                        {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
