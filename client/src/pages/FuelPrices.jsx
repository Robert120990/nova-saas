import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Fuel, 
    Save, 
    RefreshCcw, 
    TrendingUp, 
    DollarSign,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

const FuelPrices = () => {
    const queryClient = useQueryClient();
    const [editablePrices, setEditablePrices] = useState({});

    const { data: fuelProducts, isLoading, isError, refetch } = useQuery({
        queryKey: ['fuel-products'],
        queryFn: async () => {
            const { data } = await axios.get('/api/products/fuel');
            return data;
        }
    });

    // Synchronize query data with local state
    React.useEffect(() => {
        if (fuelProducts) {
            const prices = {};
            fuelProducts.forEach(p => {
                prices[p.id] = p.precio_unitario;
            });
            setEditablePrices(prices);
        }
    }, [fuelProducts]);

    const updatePricesMutation = useMutation({
        mutationFn: (pricesArray) => axios.patch('/api/products/fuel/prices', { prices: pricesArray }),
        onSuccess: () => {
            queryClient.invalidateQueries(['fuel-products']);
            toast.success('Precios actualizados correctamente');
        },
        onError: (error) => {
            toast.error('Error al actualizar precios: ' + error.message);
        }
    });

    const handlePriceChange = (id, value) => {
        setEditablePrices(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleSave = () => {
        const pricesArray = Object.entries(editablePrices).map(([id, price]) => ({
            id: parseInt(id),
            precio_unitario: parseFloat(price)
        }));

        if (pricesArray.some(p => isNaN(p.precio_unitario) || p.precio_unitario <= 0)) {
            return toast.error('Todos los precios deben ser números válidos mayores a cero');
        }

        updatePricesMutation.mutate(pricesArray);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <RefreshCcw className="animate-spin text-indigo-600" size={40} />
            <p className="text-slate-500 font-medium animate-pulse">Cargando productos de combustible...</p>
        </div>
    );

    if (isError) return (
        <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100 max-w-2xl mx-auto mt-10">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-red-900 mb-2">Error al cargar datos</h2>
            <p className="text-red-600">No pudimos obtener la lista de combustibles. Por favor, intenta de nuevo.</p>
            <button 
                onClick={() => refetch()}
                className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
                Reintentar
            </button>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/30">
                        <Fuel size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Precios de Combustible</h1>
                        <p className="text-slate-500 font-medium">Actualización rápida de precios de venta</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleSave}
                        disabled={updatePricesMutation.isPending}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {updatePricesMutation.isPending ? <RefreshCcw className="animate-spin" size={20} /> : <Save size={20} />}
                        Guardar Cambios
                    </button>
                </div>
            </div>

            {/* Price Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Combustible</th>
                                <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Código</th>
                                <th className="px-5 py-3 text-left font-bold text-slate-500 uppercase tracking-wider">Costo</th>
                                <th className="px-5 py-3 text-right font-bold text-slate-500 uppercase tracking-wider w-[180px]">Precio Venta ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fuelProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                                                <Fuel size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-900 truncate">{product.nombre}</p>
                                                <p className="text-xs text-slate-400 truncate">{product.descripcion}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="font-mono text-xs text-slate-500">
                                            {product.codigo}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <p className="text-slate-600 font-medium">
                                            $ {parseFloat(product.costo).toFixed(4)}
                                        </p>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="relative inline-block w-full">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</div>
                                            <input 
                                                type="number" 
                                                step="0.001"
                                                value={editablePrices[product.id] || ''}
                                                onChange={(e) => handlePriceChange(product.id, e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-7 pr-3 text-right font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {fuelProducts.length === 0 && (
                    <div className="py-12 text-center">
                        <AlertCircle className="mx-auto text-slate-300 mb-2" size={40} />
                        <p className="text-slate-500 font-medium small">No se encontraron productos de combustible.</p>
                    </div>
                )}
            </div>

            {/* Info Alerts */}
            <div className="mt-6 flex gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 items-start">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <div className="space-y-0.5">
                    <p className="text-amber-900 font-bold text-sm">Aviso de sincronización</p>
                    <p className="text-amber-700 text-xs">
                        Los cambios de precio afectarán a todos los puntos de venta instantáneamente.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FuelPrices;
