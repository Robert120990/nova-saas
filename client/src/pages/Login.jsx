import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Building2, MapPin, ChevronRight, LogIn } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectionData, setSelectionData] = useState(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    
    const { login, selectContext } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await login(username, password);
            if (res && res.mustSelectContext) {
                setSelectionData(res);
                // Si solo hay una empresa, la seleccionamos por defecto
                if (res.companies.length === 1) {
                    setSelectedCompanyId(res.companies[0].id);
                }
            } else {
                toast.success('¡Bienvenido!');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al iniciar sesión');
        }
    };

    const handleSelectContext = async (e) => {
        e.preventDefault();
        try {
            await selectContext(selectedCompanyId, selectedBranchId);
            toast.success('¡Bienvenido!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al seleccionar contexto');
        }
    };

    const selectedCompany = selectionData?.companies.find(c => c.id === parseInt(selectedCompanyId));
    const availableBranches = selectedCompany?.branches || [];

    const { data: settings } = useQuery({
        queryKey: ['public-settings'],
        queryFn: async () => (await axios.get('/api/settings/public')).data,
    });

    if (selectionData) {
        // ... selection view unchanged or using settings too
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
                    <div className="text-center mb-8">
                        {settings?.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="h-12 w-auto mx-auto mb-4 object-contain" />
                        ) : (
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl mb-4">
                                <Building2 size={32} />
                            </div>
                        )}
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Seleccionar Acceso</h1>
                        <p className="text-slate-500 mt-2 text-sm italic font-spanish font-medium">Hola {selectionData.user.nombre}, selecciona la oficina para trabajar hoy</p>
                    </div>
                    {/* ... form ... */}

                    <form onSubmit={handleSelectContext} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Empresa</label>
                            <div className="relative">
                                <select 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer text-sm font-medium"
                                    value={selectedCompanyId}
                                    onChange={(e) => {
                                        setSelectedCompanyId(e.target.value);
                                        setSelectedBranchId('');
                                    }}
                                    required
                                >
                                    <option value="">Seleccionar Empresa</option>
                                    {selectionData.companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.razon_social}</option>
                                    ))}
                                </select>
                                <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sucursal</label>
                            <div className="relative">
                                <select 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer text-sm font-medium disabled:opacity-50"
                                    value={selectedBranchId}
                                    onChange={(e) => setSelectedBranchId(e.target.value)}
                                    required
                                    disabled={!selectedCompanyId}
                                >
                                    <option value="">Seleccionar Sucursal</option>
                                    {availableBranches.map(b => (
                                        <option key={b.id} value={b.id}>{b.nombre}</option>
                                    ))}
                                </select>
                                <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group active:scale-[0.98]"
                        >
                            <span>Ingresar al Sistema</span>
                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button 
                            type="button"
                            onClick={() => setSelectionData(null)}
                            className="w-full text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors"
                        >
                            Volver al login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
                <div className="text-center mb-10">
                    {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="h-16 w-auto mx-auto mb-4 object-contain" />
                    ) : (
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 text-white rounded-2xl mb-4 shadow-xl shadow-slate-200">
                            <LogIn size={32} />
                        </div>
                    )}
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{settings?.system_name || 'SaaS Facturación'}</h1>
                    <p className="text-slate-500 mt-2 font-medium">Ingresa a tu cuenta para continuar</p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Usuario</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-sm font-medium"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Tu nombre de usuario"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contraseña</label>
                        <input 
                            type="password" 
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-sm font-medium"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    
                    <button 
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
                    >
                        Iniciar Sesión
                    </button>
                </form>

                <div className="mt-10 pt-6 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">© 2026 El Salvador DTE SaaS</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
