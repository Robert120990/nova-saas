import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Building2, Landmark, CheckCircle2, RotateCcw, Info, Check } from 'lucide-react';
import { toast } from 'sonner';

const BANK_OPTIONS = [
    {
        id: 'promerica',
        name: 'Banco Promerica',
        subtitle: 'Formato estándar delimitado por tabulación (Cuenta, Monto, Nombre)',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
        id: 'atlantida',
        name: 'Banco Atlántida',
        subtitle: 'Formato posicional de 78 caracteres (Monto: 18, Nombre: 40, Cuenta: 16, Espacios: 4)',
        badge: 'bg-sky-50 text-sky-700 border-sky-200'
    }
];

const RhBankFormatsConfigTab = () => {
    const queryClient = useQueryClient();
    const [subTab, setSubTab] = useState('sucursales'); // 'sucursales' | 'departamentos'
    const [sucursales, setSucursales] = useState([]);
    const [departamentos, setDepartamentos] = useState([]);

    const { data, isPending } = useQuery({
        queryKey: ['rh-banco-formatos-config'],
        queryFn: async () => (await axios.get('/api/rh/config/banco-formatos')).data
    });

    useEffect(() => {
        if (data) {
            setSucursales(data.sucursales || []);
            setDepartamentos(data.departamentos || []);
        }
    }, [data]);

    const mutation = useMutation({
        mutationFn: (payload) => axios.put('/api/rh/config/banco-formatos', payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-banco-formatos-config'] });
            toast.success('Configuración de formatos bancarios guardada con éxito');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar configuración bancaria');
        }
    });

    const handleSucursalChange = (id, formato) => {
        setSucursales(prev => prev.map(s => s.id === id ? { ...s, formato_banco: formato } : s));
    };

    const handleDeptoChange = (id, formato) => {
        setDepartamentos(prev => prev.map(d => d.id === id ? { ...d, formato_banco: formato } : d));
    };

    const handleSetAllSucursales = (formato) => {
        setSucursales(prev => prev.map(s => ({ ...s, formato_banco: formato })));
    };

    const handleSetAllDeptos = (formato) => {
        setDepartamentos(prev => prev.map(d => ({ ...d, formato_banco: formato })));
    };

    const handleSave = (e) => {
        e.preventDefault();
        mutation.mutate({
            sucursales: sucursales.map(s => ({ id: s.id, formato_banco: s.formato_banco })),
            departamentos: departamentos.map(d => ({ id: d.id, formato_banco: d.formato_banco }))
        });
    };

    if (isPending) {
        return (
            <div className="flex flex-col items-center justify-center h-48 space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Cargando...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
            {/* Header explicativo */}
            <div className="p-6 sm:p-8 border-b border-slate-100 space-y-4">
                <div className="bg-gradient-to-r from-indigo-50/60 to-slate-50 p-4 rounded-xl border border-indigo-100/60 flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs text-slate-600 leading-relaxed">
                        <p className="font-bold text-indigo-950 text-sm">
                            Configuración de Dispersión Bancaria de Nómina
                        </p>
                        <p>
                            Define qué sucursal o departamento utilizará el formato tradicional de <strong className="text-slate-900">Banco Promerica</strong> (separado por tabulaciones) o el formato posicional de <strong className="text-slate-900">Banco Atlántida</strong> (78 caracteres fijos por línea).
                        </p>
                        <p className="text-[11px] text-slate-500">
                            Por defecto, todas las sucursales y departamentos están configurados en <strong>Banco Promerica</strong>.
                        </p>
                    </div>
                </div>

                {/* Sub-tabs: Sucursales vs Departamentos */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setSubTab('sucursales')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                subTab === 'sucursales'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Building2 size={15} />
                            <span>Por Sucursal ({sucursales.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubTab('departamentos')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                subTab === 'departamentos'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Landmark size={15} />
                            <span>Por Departamento ({departamentos.length})</span>
                        </button>
                    </div>

                    {/* Acciones masivas */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => subTab === 'sucursales' ? handleSetAllSucursales('promerica') : handleSetAllDeptos('promerica')}
                            className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors flex items-center gap-1.5"
                        >
                            <RotateCcw size={12} />
                            <span>Restablecer todos a Promerica</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => subTab === 'sucursales' ? handleSetAllSucursales('atlantida') : handleSetAllDeptos('atlantida')}
                            className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50/50 hover:bg-sky-50 transition-colors flex items-center gap-1.5"
                        >
                            <CheckCircle2 size={12} />
                            <span>Pasar todos a Atlántida</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Listado editable */}
            <div className="p-6 sm:p-8 max-h-[55vh] overflow-y-auto">
                {subTab === 'sucursales' ? (
                    <div className="divide-y divide-slate-100">
                        {sucursales.length === 0 ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No hay sucursales registradas</p>
                        ) : (
                            sucursales.map((suc) => (
                                <div key={suc.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-3 rounded-xl transition-colors">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">{suc.nombre}</span>
                                            {suc.codigo && (
                                                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                                    {suc.codigo}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400">Sucursal de asignación de personal</p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <select
                                            value={suc.formato_banco || 'promerica'}
                                            onChange={(e) => handleSucursalChange(suc.id, e.target.value)}
                                            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700"
                                        >
                                            <option value="promerica">Banco Promerica (Tabuladores)</option>
                                            <option value="atlantida">Banco Atlántida (78 Caracteres)</option>
                                        </select>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {departamentos.length === 0 ? (
                            <p className="text-xs text-slate-400 py-6 text-center">No hay departamentos registrados</p>
                        ) : (
                            departamentos.map((dep) => (
                                <div key={dep.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-3 rounded-xl transition-colors">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">{dep.descripcion}</span>
                                            {dep.codigo && (
                                                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                                    {dep.codigo}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400">Departamento de personal</p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <select
                                            value={dep.formato_banco || 'promerica'}
                                            onChange={(e) => handleDeptoChange(dep.id, e.target.value)}
                                            className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-slate-700"
                                        >
                                            <option value="promerica">Banco Promerica (Tabuladores)</option>
                                            <option value="atlantida">Banco Atlántida (78 Caracteres)</option>
                                        </select>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Footer con Guardar */}
            <div className="bg-slate-50 px-8 py-5 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs text-slate-500 font-medium">
                    Los cambios aplicarán automáticamente a todas las planillas generadas.
                </span>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                >
                    <Save size={16} />
                    {mutation.isPending ? 'Guardando...' : 'Guardar Formatos Bancarios'}
                </button>
            </div>
        </form>
    );
};

export default RhBankFormatsConfigTab;
