import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Bell, Building2, GitBranch, ChevronRight, ChevronDown, Check, X, Save, Eye, EyeOff, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';

const Navbar = () => {
    const { logout, user, selectContext, updateUser } = useAuth();
    console.log('Navbar user object:', user);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Profile modal state
    const [showProfile, setShowProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    const openProfile = () => {
        setProfileForm({
            nombre: user?.nombre || '',
            email: user?.email || '',
            username: user?.username || '',
            password: '',
        });
        setShowPassword(false);
        setShowProfile(true);
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!profileForm.nombre || !profileForm.username) {
            return toast.error('El nombre y usuario son requeridos');
        }
        setSaving(true);
        try {
            const { data } = await axios.put('/api/users/me', profileForm);
            await updateUser(data);
            toast.success('Perfil actualizado correctamente');
            setShowProfile(false);
            window.location.reload(); // Bruteforce sync
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al actualizar perfil');
        } finally {
            setSaving(false);
        }
    };

    const { data: access = [] } = useQuery({
        queryKey: ['my-access'],
        queryFn: async () => (await axios.get('/api/auth/me/access')).data,
        staleTime: 5 * 60 * 1000,
    });

    const handleSwitch = async (companyId, branchId) => {
        try {
            const company = access.find(c => c.id === companyId);
            const branch = company?.branches.find(b => b.id === branchId);
            
            await selectContext(companyId, branchId);
            setIsMenuOpen(false);
            
            toast.success(
                <div className="flex flex-col">
                    <span className="font-bold">Cambio de contexto exitoso</span>
                    <span className="text-xs opacity-80">{company?.razon_social} - {branch?.nombre}</span>
                </div>
            );
        } catch (error) {
            console.error('Error switching context:', error);
            toast.error('Error al cambiar de empresa');
        }
    };

    return (
        <header className="h-16 bg-[#0c1524] border-b border-slate-800/70 flex items-center justify-between px-6 sticky top-0 z-50 shadow-lg">
            {/* Context Switcher / Breadcrumb */}
            <div className="relative">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="flex items-center gap-4 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 rounded-xl px-5 py-2 transition-all group min-w-[450px]"
                >
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                            <Building2 size={16} className="text-indigo-400" />
                        </div>
                        <div className="flex flex-col items-start leading-tight overflow-hidden">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Empresa</span>
                            <span className="text-sm font-bold text-slate-200 truncate w-full text-left">
                                {user?.company_name || 'Seleccionar Empresa'}
                            </span>
                        </div>
                    </div>
                    
                    <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                    
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <GitBranch size={16} className="text-emerald-400" />
                        </div>
                        <div className="flex flex-col items-start leading-tight overflow-hidden">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sucursal</span>
                            <span className="text-sm font-bold text-slate-200 truncate w-full text-left">
                                {user?.branch_name || 'Seleccionar Sucursal'}
                            </span>
                        </div>
                    </div>

                    <ChevronDown size={16} className={`ml-2 text-slate-500 transition-transform flex-shrink-0 ${isMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                        <div className="absolute top-full mt-2 left-0 w-[500px] bg-[#0f172a] rounded-2xl shadow-2xl border border-slate-800 p-2 z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-3 border-b border-slate-800/50 mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cambiar de Contexto</span>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto custom-scrollbar px-1">
                                {access.map(company => (
                                    <div key={company.id} className="mb-3">
                                        <div className="px-3 py-1.5 flex items-center gap-2 text-[10px] font-bold text-indigo-400 bg-indigo-500/5 rounded-lg mb-1 border border-indigo-500/10">
                                            <Building2 size={12} />
                                            {company.razon_social}
                                        </div>
                                        <div className="space-y-0.5">
                                            {company.branches.map(branch => {
                                                const isActive = user?.company_id === company.id && user?.branch_id === branch.id;
                                                return (
                                                    <button
                                                        key={branch.id}
                                                        onClick={() => !isActive && handleSwitch(company.id, branch.id)}
                                                        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all ${
                                                            isActive 
                                                            ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 cursor-default' 
                                                            : 'hover:bg-slate-800 text-slate-400 hover:text-slate-100 group border border-transparent'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <GitBranch size={16} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-emerald-400'} />
                                                            <span className="text-sm font-medium">{branch.nombre}</span>
                                                        </div>
                                                        {isActive && <Check size={16} className="text-indigo-400" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-4">
                <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800/30 hover:bg-slate-800/60 rounded-xl relative transition-all group">
                    <Bell size={20} />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#0c1524]" />
                </button>

                <div className="h-8 w-px bg-slate-800/60" />

                <div className="flex items-center gap-3 bg-slate-800/20 pl-3 pr-1 py-1 rounded-xl border border-slate-700/30">
                    <button 
                        onClick={openProfile}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                    >
                        <div className="flex flex-col items-end leading-tight">
                            <span className="text-sm font-bold text-slate-200">{user?.nombre || user?.username}</span>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{user?.role}</span>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-600/20">
                            {user?.nombre?.substring(0, 2).toUpperCase() || 'AD'}
                        </div>
                    </button>
                    <button
                        onClick={logout}
                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all group"
                        title="Cerrar Sesión"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>

            {/* Profile Modal */}
            {showProfile && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#0f172a] border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-[#1e293b]/30">
                            <div>
                                <h2 className="text-lg font-bold text-white">Mi Perfil</h2>
                                <p className="text-[11px] text-slate-500 mt-0.5">Actualiza tu información personal</p>
                            </div>
                            <button onClick={() => setShowProfile(false)} className="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400">Nombre completo</label>
                                <input
                                    value={profileForm.nombre}
                                    onChange={e => setProfileForm(p => ({ ...p, nombre: e.target.value }))}
                                    className="w-full bg-[#1e293b]/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="Tu nombre..."
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400">Correo electrónico</label>
                                <input
                                    type="email"
                                    value={profileForm.email}
                                    onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                                    className="w-full bg-[#1e293b]/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="correo@ejemplo.com"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400">Nombre de usuario</label>
                                <input
                                    value={profileForm.username}
                                    onChange={e => setProfileForm(p => ({ ...p, username: e.target.value }))}
                                    className="w-full bg-[#1e293b]/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="username"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400">Nueva contraseña <span className="text-slate-600 font-normal">(dejar en blanco para no cambiar)</span></label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={profileForm.password}
                                        onChange={e => setProfileForm(p => ({ ...p, password: e.target.value }))}
                                        className="w-full bg-[#1e293b]/60 border border-slate-700/50 rounded-xl px-4 py-2.5 pr-12 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowProfile(false)}
                                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 active:scale-95"
                                >
                                    <Save size={16} />
                                    {saving ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Navbar;
