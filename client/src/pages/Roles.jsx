import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Modal from "../components/ui/Modal";
import { 
    Plus, 
    Shield, 
    CheckCircle2, 
    Circle, 
    Trash2, 
    X, 
    Save, 
    ChevronRight,
    Search
} from "lucide-react";
import { toast } from "sonner";
import { getAllPermissions } from "../config/menuConfig";

const Roles = () => {
    const queryClient = useQueryClient();
    const [selectedRole, setSelectedRole] = useState(null);
    const [formData, setFormData] = useState({ name: "", description: "", permissions: [] });
    const [isDeleting, setIsDeleting] = useState(null);

    const permissionGroups = getAllPermissions();

    const { data: roles = [], isLoading } = useQuery({
        queryKey: ["roles"],
        queryFn: async () => (await axios.get("/api/roles")).data,
    });

    const parsePermissions = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        try { return JSON.parse(raw); } catch { return []; }
    };

    useEffect(() => {
        if (selectedRole) {
            setFormData({
                name: selectedRole.name,
                description: selectedRole.description || "",
                permissions: parsePermissions(selectedRole.permissions),
            });
        } else {
            setFormData({ name: "", description: "", permissions: [] });
        }
    }, [selectedRole]);

    const mutation = useMutation({
        mutationFn: async (data) => {
            if (selectedRole) {
                return axios.put(`/api/roles/${selectedRole.id}`, data);
            }
            return axios.post("/api/roles", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["roles"]);
            toast.success(selectedRole ? "Rol actualizado" : "Rol creado");
            if (!selectedRole) setFormData({ name: "", description: "", permissions: [] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/roles/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(["roles"]);
            toast.success("Rol eliminado");
            setIsDeleting(null);
            if (selectedRole?.id === isDeleting) setSelectedRole(null);
        },
    });

    const handleTogglePermission = (id) => {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(id)
                ? prev.permissions.filter((p) => p !== id)
                : [...prev.permissions, id],
        }));
    };

    const handleToggleGroup = (groupPermissions) => {
        const groupIds = groupPermissions.map(p => p.id);
        const allSelected = groupIds.every(id => formData.permissions.includes(id));
        
        if (allSelected) {
            setFormData(prev => ({
                ...prev,
                permissions: prev.permissions.filter(id => !groupIds.includes(id))
            }));
        } else {
            setFormData(prev => {
                const newPerms = new Set([...prev.permissions, ...groupIds]);
                return { ...prev, permissions: Array.from(newPerms) };
            });
        }
    };

    const handleToggleAll = () => {
        const allIds = permissionGroups.flatMap(g => g.permissions.map(p => p.id));
        const everythingSelected = allIds.every(id => formData.permissions.includes(id));

        if (everythingSelected) {
            setFormData(prev => ({ ...prev, permissions: [] }));
        } else {
            setFormData(prev => ({ ...prev, permissions: allIds }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name) return toast.error("El nombre es requerido");
        mutation.mutate({
            ...formData,
            permissions: JSON.stringify(formData.permissions)
        });
    };

    if (isLoading) return <div className="p-8 text-slate-400">Cargando...</div>;

    return (
        <div className="h-[calc(100vh-120px)] flex gap-6 p-2">
            {/* Sidebar de Roles */}
            <div className="w-80 flex flex-col bg-[#0f172a] rounded-2xl border border-slate-800/50 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Shield size={20} className="text-indigo-400" />
                        </div>
                        <h2 className="font-bold text-white tracking-tight uppercase text-sm">Roles</h2>
                    </div>
                    <button 
                        onClick={() => setSelectedRole(null)}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {roles.map((role) => {
                        const rolePerms = parsePermissions(role.permissions);
                        const isActive = selectedRole?.id === role.id;

                        return (
                            <div 
                                key={role.id}
                                onClick={() => setSelectedRole(role)}
                                className={`group p-4 rounded-xl cursor-pointer transition-all border ${
                                    isActive 
                                    ? "bg-[#1e293b] border-indigo-500/50 shadow-inner" 
                                    : "bg-transparent border-transparent hover:bg-[#1e293b]/40"
                                }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-bold transition-colors ${isActive ? "text-indigo-400" : "text-white group-hover:text-indigo-300"}`}>
                                            {role.name}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                            {rolePerms.length} módulos accesibles
                                        </p>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setIsDeleting(role.id); }}
                                        className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Panel de Edición */}
            <div className="flex-1 bg-[#0f172a] rounded-2xl border border-slate-800/50 flex flex-col shadow-2xl overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]/20">
                        <h2 className="text-xl font-bold text-white tracking-tight">
                            {selectedRole ? "Editar Rol" : "Nuevo Rol"}
                        </h2>
                        <div className="flex items-center gap-3">
                            <button 
                                type="button"
                                onClick={() => setSelectedRole(null)}
                                className="px-5 py-2 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 text-sm"
                            >
                                <X size={18} /> Cancelar
                            </button>
                            <button 
                                type="submit"
                                disabled={mutation.isPending}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                            >
                                <Save size={18} /> {mutation.isPending ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 px-1">Nombre del Rol</label>
                                <input 
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="Ej: Administrador..."
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 px-1">Descripción (Opcional)</label>
                                <input 
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="Detalles sobre el alcance..."
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-800/50 pb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-white tracking-wide">Módulos Mapeados Automáticamente</h3>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Este panel se adapta en tiempo real a las opciones agregadas al sistema. Selecciona o deshabilita en qué menús tendrá visión y acceso este rol:
                                    </p>
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleToggleAll}
                                    className="px-4 py-1.5 bg-[#1e293b] hover:bg-slate-700 text-white text-[11px] font-bold rounded-lg transition-colors border border-slate-700 shadow-sm"
                                >
                                    Marcar / Desmarcar Todos
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {permissionGroups.map(group => (
                                    <div key={group.id} className="bg-[#1e293b]/20 border border-slate-800/50 rounded-2xl overflow-hidden hover:border-slate-700/50 transition-all">
                                        <div className="px-5 py-4 flex justify-between items-center">
                                            <h4 className="font-bold text-indigo-400 text-xs tracking-wider uppercase">{group.label}</h4>
                                            <button 
                                                type="button"
                                                onClick={() => handleToggleGroup(group.permissions)}
                                                className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase underline underline-offset-4 decoration-slate-700 hover:decoration-indigo-400"
                                            >
                                                Todo el grupo
                                            </button>
                                        </div>
                                        <div className="px-6 pb-6 space-y-3">
                                             {group.permissions.map(perm => (
                                                <label 
                                                    key={`${group.id}-${perm.id}`} 
                                                    className="flex items-center gap-3 cursor-pointer group/item select-none"
                                                >
                                                    <div 
                                                        onClick={() => handleTogglePermission(perm.id)}
                                                        className={`transition-all duration-200 ${formData.permissions.includes(perm.id) ? "text-indigo-500" : "text-slate-700 group-hover/item:text-slate-500"}`}
                                                    >
                                                        {formData.permissions.includes(perm.id) ? (
                                                            <div className="w-5 h-5 border border-indigo-500 rounded bg-indigo-500/10 flex items-center justify-center">
                                                                <CheckCircle2 size={14} className="text-indigo-500" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 border border-slate-700 rounded bg-transparent" />
                                                        )}
                                                    </div>
                                                    <span className={`text-[13px] font-medium transition-colors ${formData.permissions.includes(perm.id) ? "text-slate-200" : "text-slate-500 group-hover/item:text-slate-400"}`}>
                                                        {perm.label}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            {/* Modal de Eliminación */}
            <Modal
                isOpen={!!isDeleting}
                onClose={() => setIsDeleting(null)}
                title="Confirmar Eliminación"
            >
                <div className="p-6 bg-[#0f172a]">
                    <p className="text-slate-300">
                        ¿Estás seguro de que deseas eliminar este rol? Esta acción no se puede deshacer.
                    </p>
                    <div className="mt-8 flex justify-end gap-3">
                        <button 
                            onClick={() => setIsDeleting(null)}
                            className="px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-bold text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => deleteMutation.mutate(isDeleting)}
                            className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors font-bold text-sm shadow-lg shadow-red-600/20"
                        >
                            Eliminar Rol
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Roles;
