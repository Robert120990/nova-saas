import { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from '../ui/Modal';
import { UserCheck, Save, Send, AlertCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function EditarClienteDteModal({ isOpen, onClose, sale, onSaved }) {
    const queryClient = useQueryClient();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        nombre_comercial: '',
        tipo_documento: 'DUI',
        numero_documento: '',
        nit: '',
        nrc: '',
        codigo_actividad: '',
        departamento: '06',
        municipio: '14',
        direccion: '',
        telefono: '',
        correo: ''
    });

    // Cargar catálogos
    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => (await axios.get('/api/catalogs/departments')).data,
        enabled: isOpen
    });

    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', formData.departamento],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${formData.departamento}`)).data,
        enabled: isOpen && !!formData.departamento
    });

    const { data: activities = [] } = useQuery({
        queryKey: ['catalogs', 'actividades'],
        queryFn: async () => (await axios.get('/api/catalogs/actividades')).data,
        enabled: isOpen
    });

    // Formato NIT / DUI
    const formatDocNumber = (value, type) => {
        const digits = value.replace(/\D/g, '');
        if (type === 'DUI') {
            if (digits.length <= 8) return digits;
            return `${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
        } else if (type === 'NIT') {
            if (digits.length <= 4) return digits;
            if (digits.length <= 10) return `${digits.slice(0, 4)}-${digits.slice(4, 10)}`;
            if (digits.length <= 13) return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}`;
            return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13, 14)}`;
        }
        return value;
    };

    const formatNRC = (value) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 6) return digits;
        return `${digits.slice(0, 6)}-${digits.slice(6, 7)}`;
    };

    useEffect(() => {
        if (!isOpen || !sale) return;

        const loadCustomerData = async () => {
            setLoading(true);
            try {
                // Si la venta tiene customer_id, consultar el registro de cliente
                if (sale.customer_id) {
                    const res = await axios.get(`/api/customers/${sale.customer_id}`);
                    const c = res.data;
                    if (c) {
                        setFormData({
                            nombre: c.nombre || sale.customer_name || '',
                            nombre_comercial: c.nombre_comercial || '',
                            tipo_documento: c.tipo_documento || (c.nrc ? 'NIT' : 'DUI'),
                            numero_documento: c.numero_documento || c.nit || '',
                            nit: c.nit || '',
                            nrc: c.nrc || '',
                            codigo_actividad: c.codigo_actividad || '',
                            departamento: c.departamento || '06',
                            municipio: c.municipio || '14',
                            direccion: c.direccion || '',
                            telefono: c.telefono || '',
                            correo: c.correo || ''
                        });
                        return;
                    }
                }

                // Si no tiene customer_id o falló la consulta, inicializar con lo que tenga la venta
                setFormData({
                    nombre: sale.customer_name || '',
                    nombre_comercial: '',
                    tipo_documento: sale.customer_nrc ? 'NIT' : 'DUI',
                    numero_documento: sale.customer_dui || sale.customer_nit || '',
                    nit: sale.customer_nit || '',
                    nrc: sale.customer_nrc || '',
                    codigo_actividad: '',
                    departamento: '06',
                    municipio: '14',
                    direccion: sale.customer_address || '',
                    telefono: '',
                    correo: sale.customer_email || ''
                });
            } catch (err) {
                console.error('Error loading customer details:', err);
                setFormData(prev => ({
                    ...prev,
                    nombre: sale.customer_name || '',
                    nit: sale.customer_nit || '',
                    nrc: sale.customer_nrc || '',
                    correo: sale.customer_email || ''
                }));
            } finally {
                setLoading(false);
            }
        };

        loadCustomerData();
    }, [isOpen, sale]);

    if (!isOpen || !sale) return null;

    const handleSubmit = async (retransmit = false) => {
        if (!formData.nombre.trim()) {
            toast.warning('El nombre o razón social es obligatorio');
            return;
        }

        const correoTrimmed = (formData.correo || '').trim();
        if (correoTrimmed) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(correoTrimmed)) {
                toast.error('El correo electrónico no tiene un formato válido');
                return;
            }
        }

        setSubmitting(true);
        try {
            const res = await axios.put(`/api/sales/${sale.id}/customer`, {
                ...formData,
                retransmit
            });

            if (res.data?.success) {
                toast.success(res.data.message || 'Datos de cliente actualizados');
                queryClient.invalidateQueries(['sales-history']);
                queryClient.invalidateQueries(['customers']);
                if (onSaved) {
                    onSaved({ retransmitted: retransmit, result: res.data });
                }
                onClose();
            } else {
                toast.error(res.data?.message || 'Error al actualizar');
            }
        } catch (err) {
            console.error('Error updating customer for sale:', err);
            toast.error(err.response?.data?.message || 'Error al guardar datos del cliente');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <UserCheck size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Corregir Datos del Cliente</h3>
                        <p className="text-xs text-slate-500">Actualizar datos fiscales para transmisión DTE</p>
                    </div>
                </div>
            }
            maxWidth="max-w-2xl"
        >
            {loading ? (
                <div className="py-12 text-center space-y-3">
                    <RefreshCcw size={28} className="animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Cargando datos del cliente...</p>
                </div>
            ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="space-y-4">
                    <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-100 flex items-center gap-2 text-xs text-indigo-900">
                        <AlertCircle size={16} className="text-indigo-600 shrink-0" />
                        <span>
                            Los cambios se aplicarán al cliente en la base de datos y a esta venta, permitiendo retransmitir a Hacienda sin rechazos.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Nombre o Razón Social <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                placeholder="Ej: Comercializadora San Salvador S.A. de C.V."
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Nombre Comercial
                            </label>
                            <input
                                type="text"
                                value={formData.nombre_comercial}
                                onChange={(e) => setFormData({ ...formData, nombre_comercial: e.target.value })}
                                placeholder="Ej: Supertienda Central"
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Tipo de Documento
                            </label>
                            <select
                                value={formData.tipo_documento}
                                onChange={(e) => {
                                    const nextType = e.target.value;
                                    setFormData({
                                        ...formData,
                                        tipo_documento: nextType,
                                        numero_documento: formatDocNumber(formData.numero_documento, nextType)
                                    });
                                }}
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            >
                                <option value="DUI">DUI (Consumidor Final)</option>
                                <option value="NIT">NIT (Contribuyente / Empresa)</option>
                                <option value="Pasaporte">Pasaporte</option>
                                <option value="Carnet Resident">Carnet de Residente</option>
                                <option value="Otro">Otro Documento</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Número de Documento (DUI / NIT)
                            </label>
                            <input
                                type="text"
                                value={formData.numero_documento}
                                onChange={(e) => {
                                    const formatted = formatDocNumber(e.target.value, formData.tipo_documento);
                                    setFormData({
                                        ...formData,
                                        numero_documento: formatted,
                                        nit: formData.tipo_documento === 'NIT' ? formatted : formData.nit
                                    });
                                }}
                                placeholder={formData.tipo_documento === 'DUI' ? '00000000-0' : '0000-000000-000-0'}
                                className="w-full font-mono text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                NRC (Registro de Contribuyente)
                            </label>
                            <input
                                type="text"
                                value={formData.nrc}
                                onChange={(e) => setFormData({ ...formData, nrc: formatNRC(e.target.value) })}
                                placeholder="000000-0"
                                className="w-full font-mono text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Actividad Económica (Giro - Catálogo CAT-019)
                            </label>
                            <select
                                value={formData.codigo_actividad}
                                onChange={(e) => setFormData({ ...formData, codigo_actividad: e.target.value })}
                                className="w-full text-[12px] font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            >
                                <option value="">-- Seleccionar Actividad Económica --</option>
                                {activities.map((a) => (
                                    <option key={a.code} value={a.code}>
                                        {a.code} - {a.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Departamento
                            </label>
                            <select
                                value={formData.departamento}
                                onChange={(e) => setFormData({ ...formData, departamento: e.target.value, municipio: '' })}
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            >
                                {departments.map((d) => (
                                    <option key={d.code} value={d.code}>
                                        {d.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Municipio
                            </label>
                            <select
                                value={formData.municipio}
                                onChange={(e) => setFormData({ ...formData, municipio: e.target.value })}
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            >
                                <option value="">-- Seleccionar Municipio --</option>
                                {municipalities.map((m) => (
                                    <option key={m.code} value={m.code}>
                                        {m.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Dirección Completa
                            </label>
                            <input
                                type="text"
                                value={formData.direccion}
                                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                                placeholder="Calle, número de casa, colonia, barrio o punto de referencia"
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Teléfono
                            </label>
                            <input
                                type="text"
                                value={formData.telefono}
                                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                                placeholder="2200-0000 o 7000-0000"
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                Correo Electrónico
                            </label>
                            <input
                                type="email"
                                value={formData.correo}
                                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                                placeholder="cliente@ejemplo.com"
                                className="w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="w-full sm:w-auto px-4 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>

                        <div className="w-full sm:w-auto flex flex-wrap items-center gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => handleSubmit(false)}
                                disabled={submitting}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                            >
                                <Save size={14} />
                                <span>Solo Guardar</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSubmit(true)}
                                disabled={submitting}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <RefreshCcw size={14} className="animate-spin" />
                                ) : (
                                    <Send size={14} />
                                )}
                                <span>Guardar y Reintentar Envío</span>
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </Modal>
    );
}
