import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Mail, Save, Server, Shield, User, Lock, Eye, EyeOff, GitBranch, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const SmtpConfig = () => {
    const queryClient = useQueryClient();
    const [selectedBranchId, setSelectedBranchId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // Obtener sucursales
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    // Establecer sucursal default si hay disponibles
    useEffect(() => {
        if (branches.length > 0 && !selectedBranchId) {
            setSelectedBranchId(branches[0].id);
        }
    }, [branches, selectedBranchId]);

    // Obtener configuración SMTP de la sucursal seleccionada
    const { data: smtpSettings, isLoading: isSmtpLoading } = useQuery({
        queryKey: ['smtp', selectedBranchId],
        queryFn: async () => (await axios.get(`/api/smtp/${selectedBranchId}`)).data,
        enabled: !!selectedBranchId
    });

    const mutation = useMutation({
        mutationFn: (data) => axios.post('/api/smtp', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['smtp', selectedBranchId]);
            toast.success('Configuración SMTP guardada correctamente');
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Error al guardar configuración');
        }
    });
    
    const testMutation = useMutation({
        mutationFn: (data) => axios.post('/api/smtp/test', data),
        onSuccess: (data) => {
            toast.success(data.data.message || 'Prueba exitosa');
        },
        onError: (error) => {
            const msg = error.response?.data?.error || error.response?.data?.message || 'Error en la prueba de conexión';
            toast.error(msg, { duration: 5000 });
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.branch_id = selectedBranchId;
        data.port = parseInt(data.port);
        mutation.mutate(data);
    };

    const handleTest = (e) => {
        e.preventDefault();
        const form = e.target.closest('form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        data.branch_id = selectedBranchId;
        data.port = parseInt(data.port);
        testMutation.mutate(data);
    };

    const inputCls = "w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm";
    const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Configuración SMTP</h2>
                <p className="text-slate-500 font-medium">Gestiona los servidores de correo saliente por sucursal</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Branch Selection Sidebar */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Seleccionar Sucursal</h3>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {branches.map(branch => (
                            <button
                                key={branch.id}
                                onClick={() => setSelectedBranchId(branch.id)}
                                className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all border-b border-slate-50 last:border-0 ${
                                    selectedBranchId === branch.id 
                                    ? 'bg-indigo-50 text-indigo-700' 
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <GitBranch size={18} className={selectedBranchId === branch.id ? 'text-indigo-600' : 'text-slate-400'} />
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold">{branch.nombre}</span>
                                    <span className="text-[10px] opacity-70 uppercase font-bold tracking-wider">{branch.codigo}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Settings Form */}
                <div className="md:col-span-2">
                    {selectedBranchId ? (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {isSmtpLoading ? (
                                <div className="p-20 text-center flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-slate-400 font-medium">Cargando configuración...</span>
                                </div>
                            ) : (
                                <form key={selectedBranchId} onSubmit={handleSubmit} className="p-8 space-y-6 text-slate-900">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4 md:col-span-2">
                                             <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                <Server size={16} className="text-indigo-600" />
                                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Servidor de Correo</h4>
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className={labelCls}>Host SMTP</label>
                                            <div className="relative">
                                                <Server className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input name="host" defaultValue={smtpSettings?.host} required placeholder="smtp.gmail.com" className={inputCls} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Puerto</label>
                                            <div className="relative">
                                                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input name="port" type="number" defaultValue={smtpSettings?.port || 587} required placeholder="587" className={inputCls} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Cifrado</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <select name="encryption" defaultValue={smtpSettings?.encryption || 'tls'} className={`${inputCls} appearance-none`}>
                                                    <option value="none">Ninguno</option>
                                                    <option value="ssl">SSL</option>
                                                    <option value="tls">TLS</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-4 md:col-span-2 mt-4">
                                             <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                <User size={16} className="text-indigo-600" />
                                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Autenticación</h4>
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Usuario / Email</label>
                                            <div className="relative">
                                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input name="user" defaultValue={smtpSettings?.user} required placeholder="usuario@ejemplo.com" className={inputCls} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Contraseña</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input 
                                                    name="password" 
                                                    type={showPassword ? 'text' : 'password'} 
                                                    defaultValue={smtpSettings?.password} 
                                                    required 
                                                    placeholder="••••••••" 
                                                    className={inputCls} 
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-4 md:col-span-2 mt-4">
                                             <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                                <Mail size={16} className="text-indigo-600" />
                                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Remitente</h4>
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Nombre Remitente</label>
                                            <div className="relative">
                                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input name="from_name" defaultValue={smtpSettings?.from_name} required placeholder="Nombre de la empresa" className={inputCls} />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Email Remitente</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input name="from_email" type="email" defaultValue={smtpSettings?.from_email} required placeholder="no-reply@empresa.com" className={inputCls} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                                        <button 
                                            type="button"
                                            onClick={handleTest}
                                            disabled={testMutation.isPending || mutation.isPending}
                                            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={20} className="text-emerald-500" />
                                            <span>{testMutation.isPending ? 'Probando...' : 'Probar Configuración'}</span>
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={mutation.isPending || testMutation.isPending}
                                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                                        >
                                            <Save size={20} />
                                            <span>{mutation.isPending ? 'Guardando...' : 'Guardar Configuración'}</span>
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-20 text-center">
                            <Server className="mx-auto text-slate-200 mb-4" size={48} />
                            <p className="text-slate-400 font-medium italic">Selecciona una sucursal para ver su configuración SMTP</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmtpConfig;
