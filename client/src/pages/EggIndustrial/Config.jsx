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
        <div className="space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <Settings className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configuración de Parámetros de Planta</h1>
                        <p className="text-xs text-slate-500 font-medium">Pesos por unidad de producto terminado, rendimientos esperados y costos fijos de proceso</p>
                    </div>
                </div>
                <button 
                    onClick={handleSaveAll} 
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                    <Save size={15} />
                    Guardar Toda la Configuración
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Parámetros de Producto */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <Settings className="h-4 w-4 text-indigo-600" />
                            Peso por Unidad y Rendimientos Estándar
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Estos valores se usarán como referencia y sugerencia al envasar y formular cada lote de producción.</p>
                    </div>
                    <div className="h-px bg-slate-100" />

                    {loading ? (
                        <div className="text-center text-slate-400 text-xs py-8 animate-pulse font-medium">Cargando parámetros...</div>
                    ) : (
                        <div className="space-y-4">
                            {products.map(p => (
                                <div key={p.type} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800 capitalize">{p.label}</span>
                                        <button 
                                            onClick={() => handleSave(p.type)} 
                                            className="px-3 py-1 bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 rounded-lg text-[11px] font-bold transition-all shadow-xs"
                                        >
                                            Guardar
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Peso/Unidad (lb)</span>
                                            <input 
                                                type="number" 
                                                value={getWeight(p.type)} 
                                                onChange={(e) => handleUpdate(p.type, 'weight_per_unit_lbs', e.target.value)} 
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs" 
                                                step="0.01" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-emerald-700 uppercase block">Rendimiento %</span>
                                            <input 
                                                type="number" 
                                                value={getPct(p.type, 'yield_pct')} 
                                                onChange={(e) => handleUpdate(p.type, 'yield_pct', e.target.value)} 
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-emerald-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs" 
                                                step="0.01" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-amber-700 uppercase block">Cáscara %</span>
                                            <input 
                                                type="number" 
                                                value={getPct(p.type, 'waste_shell_pct')} 
                                                onChange={(e) => handleUpdate(p.type, 'waste_shell_pct', e.target.value)} 
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-amber-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-xs" 
                                                step="0.01" 
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-rose-700 uppercase block">Merma %</span>
                                            <input 
                                                type="number" 
                                                value={getPct(p.type, 'waste_loss_pct')} 
                                                onChange={(e) => handleUpdate(p.type, 'waste_loss_pct', e.target.value)} 
                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-rose-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs" 
                                                step="0.01" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Costos Fijos */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <Settings className="h-4 w-4 text-indigo-600" />
                            Costos Fijos y Operativos de Producción
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Valores predeterminados cargados al calcular el costo de cada lote de producción.</p>
                    </div>
                    <div className="h-px bg-slate-100" />

                    <div className="space-y-2.5">
                        {costConcepts.map(c => (
                            <div key={c.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <input
                                    type="text"
                                    value={c.concept_name}
                                    onChange={(e) => {
                                        setCostConcepts(prev => prev.map(x => x.id === c.id ? { ...x, concept_name: e.target.value } : x));
                                        handleUpdateConcept(c.id, 'concept_name', e.target.value);
                                    }}
                                    className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                />
                                <div className="relative w-28">
                                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">$</span>
                                    <input
                                        type="number"
                                        value={c.default_value}
                                        onChange={(e) => {
                                            setCostConcepts(prev => prev.map(x => x.id === c.id ? { ...x, default_value: e.target.value } : x));
                                        }}
                                        onBlur={(e) => handleUpdateConcept(c.id, 'default_value', e.target.value)}
                                        className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-emerald-700 font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-xs"
                                        step="0.01"
                                    />
                                </div>
                                <button 
                                    onClick={() => handleDeleteConcept(c.id)} 
                                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Eliminar concepto"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}

                        <div className="flex items-center gap-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-2.5 mt-3">
                            <input
                                type="text"
                                value={newConcept.concept_name}
                                onChange={(e) => setNewConcept({ ...newConcept, concept_name: e.target.value })}
                                placeholder="Nombre de nuevo concepto..."
                                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 shadow-xs"
                            />
                            <div className="relative w-28">
                                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">$</span>
                                <input
                                    type="number"
                                    value={newConcept.default_value}
                                    onChange={(e) => setNewConcept({ ...newConcept, default_value: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-semibold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    step="0.01"
                                />
                            </div>
                            <button 
                                onClick={handleAddConcept} 
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all"
                            >
                                <Plus size={14} /> Agregar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EggConfig;
