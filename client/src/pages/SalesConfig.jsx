import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SalesConfig() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [cuentaBancaria, setCuentaBancaria] = useState('');
    const [empresaRrs, setEmpresaRrs] = useState('');
    const [selectedPosIds, setSelectedPosIds] = useState([]);

    const { data: settings } = useQuery({
        queryKey: ['sales-settings'],
        queryFn: () => axios.get('/api/sales/settings').then(r => r.data),
    });

    const { data: posList = [] } = useQuery({
        queryKey: ['sales-pos', user?.branch_id],
        queryFn: () => axios.get('/api/pos', { params: { branch_id: user?.branch_id } }).then(r => r.data),
        enabled: !!user?.branch_id
    });

    useEffect(() => {
        if (settings?.cuenta_bancaria_tienda) setCuentaBancaria(settings.cuenta_bancaria_tienda);
        if (settings?.empresa_rrs) setEmpresaRrs(settings.empresa_rrs);
        if (settings?.puntos_venta_tienda) {
            try {
                const parsed = JSON.parse(settings.puntos_venta_tienda);
                if (Array.isArray(parsed)) {
                    const validIds = parsed
                        .map(Number)
                        .filter(id => !isNaN(id) && posList.some(p => Number(p.id) === Number(id)));
                    setSelectedPosIds(validIds);
                }
            } catch (e) {
                setSelectedPosIds([]);
            }
        }
    }, [settings, posList]);

    const saveMutation = useMutation({
        mutationFn: (data) => axios.put('/api/sales/settings', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-settings'] });
            toast.success('Configuración guardada');
        },
        onError: (err) => {
            toast.error(err.response?.data?.error || 'Error al guardar configuración');
        },
    });

    const handleSave = () => {
        saveMutation.mutate({
            cuenta_bancaria_tienda: cuentaBancaria || null,
            empresa_rrs: empresaRrs || null,
            puntos_venta_tienda: JSON.stringify(selectedPosIds),
        });
    };

    const togglePuntoVenta = (posId) => {
        setSelectedPosIds(prev =>
            prev.includes(Number(posId))
                ? prev.filter(id => id !== Number(posId))
                : [...prev, Number(posId)]
        );
    };

    const labelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
    const fieldCls = "w-full border border-slate-300 rounded-xl px-3 py-2 text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400";

    return (
        <div className="p-6 max-w-xl mx-auto">
            <h1 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Store size={20} className="text-indigo-500" />
                Configuración Tienda
            </h1>
            <p className="text-xs text-slate-400 mb-6">
                Configura los parámetros operativos de la tienda {user?.branch_name ? `— Sucursal: ${user.branch_name}` : ''}
            </p>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">
                <div>
                    <label className={labelCls}>Cuenta Bancaria Tienda</label>
                    <input
                        type="text"
                        value={cuentaBancaria}
                        onChange={(e) => setCuentaBancaria(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="Número de cuenta bancaria"
                        className={fieldCls + " font-mono"}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                        Número de cuenta para depósitos de la tienda.
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
                        Código de la tienda en la base RRS.
                    </p>
                </div>

                <div>
                    <label className={labelCls}>Puntos de Venta Tienda</label>
                    <div className="space-y-2">
                        {posList.length === 0 ? (
                            <p className="text-xs text-slate-400">No hay puntos de venta registrados en esta sucursal.</p>
                        ) : (
                            posList.map(pos => {
                                const isSelected = selectedPosIds.includes(Number(pos.id));
                                return (
                                    <label
                                        key={pos.id}
                                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-indigo-50 border-indigo-200'
                                                : 'bg-white border-slate-200 hover:border-indigo-200'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => togglePuntoVenta(pos.id)}
                                            className="w-4 h-4 accent-indigo-600"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] font-bold text-slate-800">{pos.nombre}</div>
                                            <div className="text-[10px] font-mono font-bold text-indigo-600">Código: {pos.codigo}</div>
                                        </div>
                                        {pos.status === 'inactivo' && (
                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactivo</span>
                                        )}
                                    </label>
                                );
                            })
                        )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        Puede seleccionar varios puntos de venta de la tienda.
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
