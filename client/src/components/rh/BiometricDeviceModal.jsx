import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Fingerprint, X, Save, Loader2, Network, ShieldCheck } from 'lucide-react';

const BiometricDeviceModal = ({ open, onClose, device = null, onSuccess }) => {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        nombre: 'Marcador Central',
        ip_address: '192.168.3.201',
        port: 4370,
        comm_key: 0,
        protocol: 'tcp',
        ubicacion: 'Entrada Principal',
        status: 'activo'
    });

    useEffect(() => {
        if (device) {
            setFormData({
                id: device.id,
                nombre: device.nombre || 'Marcador Central',
                ip_address: device.ip_address || '192.168.3.201',
                port: device.port || 4370,
                comm_key: device.comm_key || 0,
                protocol: device.protocol || 'tcp',
                ubicacion: device.ubicacion || 'Entrada Principal',
                status: device.status || 'activo'
            });
        } else {
            setFormData({
                nombre: 'Marcador Central',
                ip_address: '192.168.3.201',
                port: 4370,
                comm_key: 0,
                protocol: 'tcp',
                ubicacion: 'Entrada Principal',
                status: 'activo'
            });
        }
    }, [device, open]);

    const mutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/rh/biometric/devices', payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Dispositivo guardado correctamente');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-devices'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar el dispositivo');
        }
    });

    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.nombre.trim()) {
            return toast.error('El nombre del marcador es obligatorio');
        }
        if (!formData.ip_address.trim()) {
            return toast.error('La dirección IP es obligatoria');
        }
        mutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                            <Fingerprint className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                {device ? 'Editar Marcador Biométrico' : 'Nuevo Marcador Biométrico'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Configuración de conexión TCP/IP en la red local
                            </p>
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Nombre del Dispositivo
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ej. Marcador Planta Principal"
                            value={formData.nombre}
                            onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                            className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Dirección IP (LAN)
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    placeholder="192.168.3.201"
                                    value={formData.ip_address}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                                    className="w-full text-[13px] font-medium font-mono border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                                <Network className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Puerto TCP
                            </label>
                            <input
                                type="number"
                                required
                                min="1"
                                max="65535"
                                value={formData.port}
                                onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 4370 }))}
                                className="w-full text-[13px] font-medium font-mono border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Clave Comunicación (Comm Key)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={formData.comm_key}
                                    onChange={(e) => setFormData(prev => ({ ...prev, comm_key: parseInt(e.target.value) || 0 }))}
                                    className="w-full text-[13px] font-medium font-mono border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">Por defecto es 0 en ZKTeco</span>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Protocolo Socket
                            </label>
                            <select
                                value={formData.protocol}
                                onChange={(e) => setFormData(prev => ({ ...prev, protocol: e.target.value }))}
                                className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
                            >
                                <option value="tcp">TCP (Recomendado)</option>
                                <option value="udp">UDP</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Ubicación Física
                            </label>
                            <input
                                type="text"
                                placeholder="Ej. Garita de Entrada, Pasillo RRHH"
                                value={formData.ubicacion}
                                onChange={(e) => setFormData(prev => ({ ...prev, ubicacion: e.target.value }))}
                                className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Estado Operativo
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
                            >
                                <option value="activo">Activo</option>
                                <option value="inactivo">Inactivo</option>
                            </select>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-[13px] font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm shadow-indigo-200 transition-all"
                        >
                            {mutation.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Guardar Dispositivo</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricDeviceModal;
