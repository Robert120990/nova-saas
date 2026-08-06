import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { Settings, Save, Plus, Trash2 } from 'lucide-react';

const EggConfig = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;
    const [config, setConfig] = useState([]);
    const [loading, setLoading] = useState(true);
    const [costConcepts, setCostConcepts] = useState([]);
    const [newConcept, setNewConcept] = useState({ concept_name: '', default_value: '' });

    const defaults = {
        'huevo entero': { weight: '32.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'clara': { weight: '8.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'yema salada': { weight: '4.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'yema azucarada': { weight: '4.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' },
        'fórmula especial': { weight: '32.00', yield_pct: '85.00', shell_pct: '12.00', loss_pct: '3.00' }
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
        return cfg ? cfg.weight_per_unit_lbs : defaults[productType]?.weight || '32.00';
    };

    const getPct = (productType, field) => {
        const cfg = config.find(c => c.product_type === productType);
        return cfg && cfg[field] !== undefined ? cfg[field] : (defaults[productType]?.[field] || '0');
    };

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const [prodRes, costRes] = await Promise.all([
                axios.get('/api/egg-industrial/product-config'),
                axios.get('/api/egg-industrial/cost-concepts')
            ]);
            const data = Array.isArray(prodRes.data) ? prodRes.data : [];
            setCostConcepts(Array.isArray(costRes.data) ? costRes.data : []);
            const merged = products.map(p => {
                const existing = data.find(c => c.product_type === p.type);
                return existing || { 
                    product_type: p.type, 
                    weight_per_unit_lbs: defaults[p.type]?.weight || '32.00',
                    yield_pct: defaults[p.type]?.yield_pct || '85.00',
                    waste_shell_pct: defaults[p.type]?.shell_pct || '12.00',
                    waste_loss_pct: defaults[p.type]?.loss_pct || '3.00'
                };
            });
            setConfig(merged);
        } catch (e) {
            toast.error('Error al cargar configuración.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConfig(); }, [companyId]);

    const handleUpdate = (productType, field, value) => {
        setConfig(prev => {
            const idx = prev.findIndex(c => c.product_type === productType);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], [field]: value };
                return updated;
            }
            return [...prev, { product_type: productType, [field]: value }];
        });
    };

    const handleSave = async (product_type) => {
        try {
            await axios.put('/api/egg-industrial/product-config', {
                product_type,
                weight_per_unit_lbs: parseFloat(getWeight(product_type)),
                yield_pct: parseFloat(getPct(product_type, 'yield_pct')),
                waste_shell_pct: parseFloat(getPct(product_type, 'waste_shell_pct')),
                waste_loss_pct: parseFloat(getPct(product_type, 'waste_loss_pct'))
            });
            toast.success(`${product_type}: configurado`);
        } catch (e) {
            toast.error('Error al guardar.');
        }
    };

    const handleSaveAll = async () => {
        try {
            for (const p of products) {
                await axios.put('/api/egg-industrial/product-config', {
                    product_type: p.type,
                    weight_per_unit_lbs: parseFloat(getWeight(p.type)),
                    yield_pct: parseFloat(getPct(p.type, 'yield_pct')),
                    waste_shell_pct: parseFloat(getPct(p.type, 'waste_shell_pct')),
                    waste_loss_pct: parseFloat(getPct(p.type, 'waste_loss_pct'))
                });
            }
            toast.success('Toda la configuración guardada.');
        } catch (e) {
            toast.error('Error al guardar.');
        }
    };

    const handleAddConcept = async () => {
        if (!newConcept.concept_name.trim()) return toast.error('Ingrese nombre del concepto.');
        try {
            await axios.post('/api/egg-industrial/cost-concepts', {
                concept_name: newConcept.concept_name,
                default_value: parseFloat(newConcept.default_value || 0)
            });
            toast.success('Concepto agregado.');
            setNewConcept({ concept_name: '', default_value: '' });
            fetchConfig();
        } catch (e) { toast.error('Error al agregar.'); }
    };

    const handleUpdateConcept = async (id, field, value) => {
        const concept = costConcepts.find(c => c.id === id);
        if (!concept) return;
        try {
            await axios.put(`/api/egg-industrial/cost-concepts/${id}`, {
                id, concept_name: concept.concept_name, default_value: parseFloat(concept.default_value),
                [field]: field === 'default_value' ? parseFloat(value) : value
            });
            setCostConcepts(prev => prev.map(c => c.id === id ? { ...c, [field]: field === 'default_value' ? value : value } : c));
        } catch (e) { toast.error('Error al actualizar.'); }
    };

    const handleDeleteConcept = async (id) => {
        try {
            await axios.delete(`/api/egg-industrial/cost-concepts/${id}`);
            setCostConcepts(prev => prev.filter(c => c.id !== id));
            toast.success('Concepto eliminado.');
        } catch (e) { toast.error('Error al eliminar.'); }
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
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
                    <div className="space-y-4">
                        {products.map(p => (
                            <div key={p.type} className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3">
                                <span className="text-xs font-bold text-white capitalize block">{p.label}</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div className="space-y-0.5">
                                        <span className="text-[8px] font-black text-slate-500 uppercase block">Peso/Unidad</span>
                                        <input type="number" value={getWeight(p.type)} onChange={(e) => handleUpdate(p.type, 'weight_per_unit_lbs', e.target.value)} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-semibold text-right focus:outline-none" step="0.01" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[8px] font-black text-slate-500 uppercase block">Rendimiento %</span>
                                        <input type="number" value={getPct(p.type, 'yield_pct')} onChange={(e) => handleUpdate(p.type, 'yield_pct', e.target.value)} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-teal-400 font-semibold text-right focus:outline-none" step="0.01" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[8px] font-black text-slate-500 uppercase block">Cáscara %</span>
                                        <input type="number" value={getPct(p.type, 'waste_shell_pct')} onChange={(e) => handleUpdate(p.type, 'waste_shell_pct', e.target.value)} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-amber-400 font-semibold text-right focus:outline-none" step="0.01" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[8px] font-black text-slate-500 uppercase block">Merma %</span>
                                        <input type="number" value={getPct(p.type, 'waste_loss_pct')} onChange={(e) => handleUpdate(p.type, 'waste_loss_pct', e.target.value)} className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-rose-400 font-semibold text-right focus:outline-none" step="0.01" />
                                    </div>
                                </div>
                                <button onClick={() => handleSave(p.type)} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-extrabold transition-all">Guardar {p.label}</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-indigo-400" />
                        Costos Fijos de Producción
                    </h2>
                    <p className="text-[11px] text-slate-400">Estos valores se cargarán automáticamente al costear cada lote. Puede agregar, modificar o eliminar conceptos.</p>
                </div>
                <div className="h-px bg-slate-800" />

                <div className="space-y-2">
                    {costConcepts.map(c => (
                        <div key={c.id} className="flex items-center gap-3 bg-slate-950 border border-slate-850 rounded-xl p-3">
                            <input
                                type="text"
                                value={c.concept_name}
                                onChange={(e) => {
                                    setCostConcepts(prev => prev.map(x => x.id === c.id ? { ...x, concept_name: e.target.value } : x));
                                    handleUpdateConcept(c.id, 'concept_name', e.target.value);
                                }}
                                className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-semibold focus:outline-none"
                            />
                            <input
                                type="number"
                                value={c.default_value}
                                onChange={(e) => {
                                    setCostConcepts(prev => prev.map(x => x.id === c.id ? { ...x, default_value: e.target.value } : x));
                                }}
                                onBlur={(e) => handleUpdateConcept(c.id, 'default_value', e.target.value)}
                                className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-teal-400 font-semibold text-right focus:outline-none"
                                step="0.01"
                            />
                            <span className="text-[9px] text-slate-500 font-bold">$</span>
                            <button onClick={() => handleDeleteConcept(c.id)} className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 rounded-xl p-2">
                        <input
                            type="text"
                            value={newConcept.concept_name}
                            onChange={(e) => setNewConcept({ ...newConcept, concept_name: e.target.value })}
                            placeholder="Nuevo concepto..."
                            className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-semibold focus:outline-none placeholder-slate-500"
                        />
                        <input
                            type="number"
                            value={newConcept.default_value}
                            onChange={(e) => setNewConcept({ ...newConcept, default_value: e.target.value })}
                            placeholder="0.00"
                            className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white font-semibold text-right focus:outline-none"
                            step="0.01"
                        />
                        <button onClick={handleAddConcept} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[10px] font-extrabold flex items-center gap-1">
                            <Plus size={12} /> Agregar
                        </button>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default EggConfig;
