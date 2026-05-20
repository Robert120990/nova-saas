import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { Settings, Save } from 'lucide-react';

const EggConfig = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;
    const [config, setConfig] = useState([]);
    const [loading, setLoading] = useState(true);

    const defaults = {
        'huevo entero': '32.00',
        'clara': '8.00',
        'yema salada': '4.00',
        'yema azucarada': '4.00',
        'fórmula especial': '32.00'
    };

    const products = [
        { type: 'huevo entero', label: 'Huevo Entero Pasteurizado' },
        { type: 'clara', label: 'Clara Pasteurizada' },
        { type: 'yema salada', label: 'Yema Líquida Salada' },
        { type: 'yema azucarada', label: 'Yema Líquida Azucarada' },
        { type: 'fórmula especial', label: 'Fórmula Especial / Mezcla Premium' }
    ];

    const getWeight = (productType) => {
        const cfg = config.find(c => c.product_type === productType);
        return cfg ? cfg.weight_per_unit_lbs : defaults[productType] || '32.00';
    };

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/egg-industrial/product-config');
            const data = Array.isArray(res.data) ? res.data : [];
            const merged = products.map(p => {
                const existing = data.find(c => c.product_type === p.type);
                return existing || { product_type: p.type, weight_per_unit_lbs: defaults[p.type] };
            });
            setConfig(merged);
        } catch (e) {
            toast.error('Error al cargar configuración.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConfig(); }, [companyId]);

    const handleUpdate = (productType, value) => {
        setConfig(prev => {
            const idx = prev.findIndex(c => c.product_type === productType);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], weight_per_unit_lbs: value };
                return updated;
            }
            return [...prev, { product_type: productType, weight_per_unit_lbs: value }];
        });
    };

    const handleSave = async (product_type) => {
        const weight = getWeight(product_type);
        try {
            await axios.put('/api/egg-industrial/product-config', {
                product_type,
                weight_per_unit_lbs: parseFloat(weight)
            });
            toast.success(`${product_type}: ${weight} Lbs guardado`);
        } catch (e) {
            toast.error('Error al guardar.');
        }
    };

    const handleSaveAll = async () => {
        try {
            for (const p of products) {
                await axios.put('/api/egg-industrial/product-config', {
                    product_type: p.type,
                    weight_per_unit_lbs: parseFloat(getWeight(p.type))
                });
            }
            toast.success('Toda la configuración guardada.');
        } catch (e) {
            toast.error('Error al guardar.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                        <Settings className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">Configuración Industrial</h1>
                        <p className="text-[12px] text-slate-400 font-semibold tracking-tight">Parámetros de producto, peso por unidad y ajustes del módulo de huevo industrial</p>
                    </div>
                </div>
                <button onClick={handleSaveAll} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all border border-indigo-500 flex items-center gap-1.5 shadow-lg">
                    <Save size={14} />
                    Guardar Todo
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 max-w-2xl">
                <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-indigo-400" />
                        Peso por Unidad de Producto Terminado
                    </h2>
                    <p className="text-[11px] text-slate-400">Estos valores se usarán por defecto al momento de envasar. Siempre podrán modificarse manualmente durante el envasado.</p>
                </div>
                <div className="h-px bg-slate-800" />

                {loading ? (
                    <div className="text-center text-slate-400 text-xs py-8 animate-pulse">Cargando configuración...</div>
                ) : (
                    <div className="space-y-3">
                        {products.map(p => {
                            return (
                                <div key={p.type} className="flex items-center gap-4 bg-slate-950 border border-slate-850 rounded-xl p-4">
                                    <span className="text-xs font-bold text-white capitalize flex-1">{p.label}</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={getWeight(p.type)}
                                            onChange={(e) => handleUpdate(p.type, e.target.value)}
                                            className="w-24 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold text-right focus:outline-none focus:border-indigo-500"
                                            step="0.01"
                                        />
                                        <span className="text-[10px] text-slate-500 font-bold">Lbs/Unidad</span>
                                    </div>
                                    <button
                                        onClick={() => handleSave(p.type)}
                                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-extrabold transition-all"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EggConfig;
