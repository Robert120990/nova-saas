import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Save, X, LogOut, Calendar, ChevronDown } from 'lucide-react';

const PurchasePeriod = () => {
    const navigate = useNavigate();
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [loading, setLoading] = useState(true);

    const months = [
        { value: 1, label: 'ENERO' },
        { value: 2, label: 'FEBRERO' },
        { value: 3, label: 'MARZO' },
        { value: 4, label: 'ABRIL' },
        { value: 5, label: 'MAYO' },
        { value: 6, label: 'JUNIO' },
        { value: 7, label: 'JULIO' },
        { value: 8, label: 'AGOSTO' },
        { value: 9, label: 'SEPTIEMBRE' },
        { value: 10, label: 'OCTUBRE' },
        { value: 11, label: 'NOVIEMBRE' },
        { value: 12, label: 'DICIEMBRE' },
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

    useEffect(() => {
        fetchPeriod();
    }, []);

    const fetchPeriod = async () => {
        try {
            const { data } = await axios.get('/api/period-purchases');
            setYear(data.year);
            setMonth(data.month);
        } catch (error) {
            console.error('Error fetching period:', error);
            // toast.error('Error al cargar el periodo');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const loadingToast = toast.loading('Guardando periodo...');
        try {
            await axios.post('/api/period-purchases', { year, month });
            toast.success('Periodo guardado correctamente', { id: loadingToast });
        } catch (error) {
            console.error('Error saving period:', error);
            toast.error('Error al guardar el periodo', { id: loadingToast });
        }
    };

    const handleExit = () => {
        navigate('/dashboard');
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-slate-50/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando Periodo...</p>
            </div>
        </div>
    );

    return (
        <div className="flex items-center justify-center min-h-full bg-slate-50/50 p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-indigo-500/10 border border-slate-100 overflow-hidden">
                {/* Simplified Header */}
                <div className="bg-indigo-600 p-6 text-white relative">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                            <Calendar size={18} />
                        </div>
                        <h2 className="text-xl font-black tracking-tight">Periodo de Compras</h2>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Content Section */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Year Selection */}
                            <div className="space-y-1.5">
                                <p className="ml-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Año Fiscal</p>
                                <div className="relative group">
                                    <select 
                                        value={year}
                                        onChange={(e) => setYear(parseInt(e.target.value))}
                                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer group-hover:bg-white"
                                    >
                                        {years.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none" size={16} />
                                </div>
                            </div>

                            {/* Month Selection */}
                            <div className="space-y-1.5">
                                <p className="ml-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Mes</p>
                                <div className="relative group">
                                    <select 
                                        value={month}
                                        onChange={(e) => setMonth(parseInt(e.target.value))}
                                        className="w-full h-12 bg-slate-50 border border-slate-100 rounded-2xl px-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none cursor-pointer group-hover:bg-white"
                                    >
                                        {months.map(m => (
                                            <option key={m.value} value={m.value}>{m.value.toString().padStart(2, '0')} - {m.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none" size={16} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons on One Line */}
                    <div className="pt-6 border-t border-slate-50">
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => navigate(-1)}
                                className="h-12 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                <X size={16} />
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                className="h-12 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={16} />
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchasePeriod;
