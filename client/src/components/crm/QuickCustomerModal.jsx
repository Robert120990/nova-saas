import { useState } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function QuickCustomerModal({ isOpen, onClose, onCustomerCreated }) {
    const [formData, setFormData] = useState({
        nombre: '',
        nombre_comercial: '',
        nit: '',
        nrc: '',
        telefono: '',
        correo: '',
        direccion: '',
        dias_credito: '30'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            toast.warning('El nombre del cliente es obligatorio.');
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await axios.post('/api/customers', formData);
            toast.success('Cliente registrado exitosamente.');
            onCustomerCreated(res.data);
            onClose();
        } catch (err) {
            console.error('Error al crear cliente rápido:', err);
            toast.error(err.response?.data?.message || 'Error al guardar el cliente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Nuevo Cliente Rápido</h3>
                            <p className="text-xs text-slate-500">Registrar cliente para esta cotización</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Nombre / Razón Social <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ej: Panadería La Espiga, S.A. de C.V."
                            value={formData.nombre}
                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Nombre Comercial / Contacto
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: La Espiga (Atención: Don Pedro)"
                            value={formData.nombre_comercial}
                            onChange={(e) => setFormData({ ...formData, nombre_comercial: e.target.value })}
                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Teléfono
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: 2250-0000"
                                value={formData.telefono}
                                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Correo Electrónico
                            </label>
                            <input
                                type="email"
                                placeholder="compras@cliente.com"
                                value={formData.correo}
                                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                NRC (Registro)
                            </label>
                            <input
                                type="text"
                                placeholder="Opcional"
                                value={formData.nrc}
                                onChange={(e) => setFormData({ ...formData, nrc: e.target.value })}
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                NIT o DUI
                            </label>
                            <input
                                type="text"
                                placeholder="Opcional"
                                value={formData.nit}
                                onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Dirección de Entrega
                        </label>
                        <input
                            type="text"
                            placeholder="Calle principal, Municipio, Departamento"
                            value={formData.direccion}
                            onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                            className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
                        >
                            <Save className="w-4 h-4" />
                            {isSubmitting ? 'Guardando...' : 'Crear y Asignar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
