import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Truck, Plus, Edit, Trash2, Search, User, Fuel, Phone, IdCard } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import { useConfirm } from '../../context/ConfirmContext';
import { unwrapList, getApiErrorMessage } from '../../utils/apiUtils';

const EMPTY_FORM = {
    placa: '',
    codigo_interno: '',
    motorista: '',
    documento_motorista: '',
    telefono_motorista: '',
    tipo_vehiculo: '',
    tipo_combustible: '',
    marca: '',
    modelo: '',
    anio: '',
    color: '',
    observaciones: '',
    activo: true
};

const VEHICLE_TYPES = [
    'Pick-up',
    'Camión',
    'Sedán',
    'Camioneta / SUV',
    'Panel',
    'Furgón',
    'Motocicleta',
    'Microbús / Autobús',
    'Cabezal / Rastra',
    'Maquinaria',
    'Otro'
];

const FUEL_TYPES = [
    'Diésel',
    'Gasolina Regular',
    'Gasolina Súper',
    'Eléctrico',
    'Híbrido',
    'Gas LP',
    'N/A'
];

const fieldCls = 'w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-800';
const labelCls = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5';

const CustomerFleetsModal = ({ isOpen, onClose, customer }) => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    const [activeTab, setActiveTab] = useState('form');
    const [searchTerm, setSearchTerm] = useState('');
    const [editingFleet, setEditingFleet] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    const resetForm = () => {
        setEditingFleet(null);
        setFormData(EMPTY_FORM);
    };

    useEffect(() => {
        if (!isOpen) {
            resetForm();
            setSearchTerm('');
            setActiveTab('form');
        }
    }, [isOpen, customer?.id]);

    const { data: rawFleets = [], isLoading } = useQuery({
        queryKey: ['customer-fleets', customer?.id],
        queryFn: async () => unwrapList(
            await axios.get('/api/customer-fleets', { params: { customer_id: customer?.id } })
        ),
        enabled: Boolean(isOpen && customer?.id)
    });

    const fleets = useMemo(() => (Array.isArray(rawFleets) ? rawFleets : []), [rawFleets]);

    const filteredFleets = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return fleets;
        return fleets.filter(f => [
            f.placa,
            f.motorista,
            f.codigo_interno,
            f.marca,
            f.modelo,
            f.tipo_vehiculo,
            f.tipo_combustible,
            f.documento_motorista,
            f.color
        ].some(v => (v || '').toString().toLowerCase().includes(q)));
    }, [fleets, searchTerm]);

    const saveMutation = useMutation({
        mutationFn: (payload) => {
            if (editingFleet) {
                return axios.put(`/api/customer-fleets/${editingFleet.id}`, payload);
            }
            return axios.post('/api/customer-fleets', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer-fleets', customer?.id] });
            queryClient.invalidateQueries({ queryKey: ['customer-fleets', customer?.id, 'active'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success(editingFleet ? 'Vehículo actualizado' : 'Vehículo agregado a la flota');
            resetForm();
        },
        onError: (error) => {
            toast.error(getApiErrorMessage(error, 'Error al guardar vehículo de flota'));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/customer-fleets/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customer-fleets', customer?.id] });
            queryClient.invalidateQueries({ queryKey: ['customer-fleets', customer?.id, 'active'] });
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            toast.success('Vehículo eliminado de la flota');
        },
        onError: (error) => {
            toast.error(getApiErrorMessage(error, 'Error al eliminar vehículo'));
        }
    });

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleEditFleet = (fleet) => {
        setEditingFleet(fleet);
        setFormData({
            placa: fleet.placa || '',
            codigo_interno: fleet.codigo_interno || '',
            motorista: fleet.motorista || '',
            documento_motorista: fleet.documento_motorista || '',
            telefono_motorista: fleet.telefono_motorista || '',
            tipo_vehiculo: fleet.tipo_vehiculo || '',
            tipo_combustible: fleet.tipo_combustible || '',
            marca: fleet.marca || '',
            modelo: fleet.modelo || '',
            anio: fleet.anio ? String(fleet.anio) : '',
            color: fleet.color || '',
            observaciones: fleet.observaciones || '',
            activo: fleet.activo !== 0 && fleet.activo !== false
        });
        setActiveTab('form');
    };

    const handleDeleteFleet = async (fleet) => {
        const ok = await confirm({
            title: '¿Eliminar vehículo de la flota?',
            message: `La placa ${fleet.placa} será eliminada del control de flotas de este cliente.`,
            confirmLabel: 'Sí, eliminar',
            variant: 'danger'
        });
        if (ok) {
            if (editingFleet?.id === fleet.id) resetForm();
            deleteMutation.mutate(fleet.id);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!customer?.id) return;
        const cleanPlate = formData.placa.trim().toUpperCase();
        if (!cleanPlate) {
            toast.error('La placa del vehículo es obligatoria');
            return;
        }
        saveMutation.mutate({
            customer_id: customer.id,
            placa: cleanPlate,
            codigo_interno: formData.codigo_interno.trim() || null,
            motorista: formData.motorista.trim() || null,
            documento_motorista: formData.documento_motorista.trim() || null,
            telefono_motorista: formData.telefono_motorista.trim() || null,
            tipo_vehiculo: formData.tipo_vehiculo || null,
            tipo_combustible: formData.tipo_combustible || null,
            marca: formData.marca.trim() || null,
            modelo: formData.modelo.trim() || null,
            anio: formData.anio ? parseInt(formData.anio, 10) : null,
            color: formData.color.trim() || null,
            observaciones: formData.observaciones.trim() || null,
            activo: formData.activo ? 1 : 0
        });
    };

    const handleCloseModal = () => {
        resetForm();
        setSearchTerm('');
        setActiveTab('form');
        onClose();
    };

    if (!isOpen || !customer) return null;

    return (
        <Modal
            isOpen={isOpen && Boolean(customer)}
            onClose={handleCloseModal}
            maxWidth="max-w-2xl"
            height="h-[88vh] sm:h-[640px]"
            bodyClassName="px-3.5 sm:px-6 py-4 sm:py-5 flex flex-col"
            title={
                <span className="flex items-center gap-2 min-w-0">
                    <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                        <Truck size={18} />
                    </span>
                    <span className="truncate">Control de Flotas — {customer.nombre || ''}</span>
                    <span className="shrink-0 px-2 py-0.5 text-[10px] font-black uppercase bg-indigo-100 text-indigo-700 rounded-full">
                        {fleets.length} {fleets.length === 1 ? 'vehículo' : 'vehículos'}
                    </span>
                </span>
            }
        >
            <div className="flex flex-col flex-1 min-h-0 gap-4">
                {/* Tabs */}
                <div className="flex bg-slate-50/50 border border-slate-100 p-1 rounded-lg shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('form')}
                        className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md flex items-center justify-center gap-1.5 ${
                            activeTab === 'form' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Plus size={13} /> {editingFleet ? 'Editar Vehículo' : 'Agregar / Editar'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('lista')}
                        className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all rounded-md flex items-center justify-center gap-1.5 ${
                            activeTab === 'lista' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Truck size={13} /> Listado ({fleets.length})
                    </button>
                </div>

                {activeTab === 'form' ? (
                    <form onSubmit={handleSubmit} autoComplete="off" className="flex-1 min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase">
                                {editingFleet ? `Editando Vehículo (${editingFleet.placa})` : 'Nuevo Vehículo de Flota'}
                            </h4>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                                <input
                                    type="checkbox"
                                    checked={formData.activo}
                                    onChange={(e) => handleFieldChange('activo', e.target.checked)}
                                    className="accent-indigo-600 rounded w-4 h-4 cursor-pointer"
                                />
                                Vehículo activo (disponible al facturar)
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>
                                    Placa <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.placa}
                                    onChange={(e) => handleFieldChange('placa', e.target.value.toUpperCase())}
                                    required
                                    maxLength={20}
                                    placeholder="Ej: P-123456 / C-45890"
                                    className={`${fieldCls} font-mono uppercase font-bold`}
                                />
                            </div>

                            <div>
                                <label className={labelCls}>Código Interno / Unidad</label>
                                <input
                                    type="text"
                                    value={formData.codigo_interno}
                                    onChange={(e) => handleFieldChange('codigo_interno', e.target.value)}
                                    maxLength={40}
                                    placeholder="Ej: UNIDAD-04 / FL-12"
                                    className={fieldCls}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={labelCls}>Motorista / Conductor</label>
                                <input
                                    type="text"
                                    value={formData.motorista}
                                    onChange={(e) => handleFieldChange('motorista', e.target.value)}
                                    maxLength={150}
                                    placeholder="Nombre completo"
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>DUI / Licencia Motorista</label>
                                <input
                                    type="text"
                                    value={formData.documento_motorista}
                                    onChange={(e) => handleFieldChange('documento_motorista', e.target.value)}
                                    maxLength={30}
                                    placeholder="00000000-0"
                                    className={`${fieldCls} font-mono`}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Teléfono Motorista</label>
                                <input
                                    type="text"
                                    value={formData.telefono_motorista}
                                    onChange={(e) => handleFieldChange('telefono_motorista', e.target.value)}
                                    maxLength={25}
                                    placeholder="7000-0000"
                                    className={fieldCls}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Tipo de Vehículo</label>
                                <select
                                    value={formData.tipo_vehiculo}
                                    onChange={(e) => handleFieldChange('tipo_vehiculo', e.target.value)}
                                    className={fieldCls}
                                >
                                    <option value="">Seleccionar</option>
                                    {VEHICLE_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Tipo de Combustible</label>
                                <select
                                    value={formData.tipo_combustible}
                                    onChange={(e) => handleFieldChange('tipo_combustible', e.target.value)}
                                    className={fieldCls}
                                >
                                    <option value="">Seleccionar</option>
                                    {FUEL_TYPES.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div>
                                <label className={labelCls}>Marca</label>
                                <input
                                    type="text"
                                    value={formData.marca}
                                    onChange={(e) => handleFieldChange('marca', e.target.value)}
                                    maxLength={80}
                                    placeholder="Ej: Toyota, Isuzu"
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Modelo</label>
                                <input
                                    type="text"
                                    value={formData.modelo}
                                    onChange={(e) => handleFieldChange('modelo', e.target.value)}
                                    maxLength={80}
                                    placeholder="Ej: Hilux, NPR"
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Año</label>
                                <input
                                    type="number"
                                    min={1900}
                                    max={2100}
                                    value={formData.anio}
                                    onChange={(e) => handleFieldChange('anio', e.target.value)}
                                    placeholder="2024"
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Color</label>
                                <input
                                    type="text"
                                    value={formData.color}
                                    onChange={(e) => handleFieldChange('color', e.target.value)}
                                    maxLength={40}
                                    placeholder="Ej: Blanco"
                                    className={fieldCls}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Observaciones</label>
                            <textarea
                                rows={2}
                                value={formData.observaciones}
                                onChange={(e) => handleFieldChange('observaciones', e.target.value)}
                                placeholder="Notas operativas, restricciones de despacho o comentarios..."
                                className={`${fieldCls} resize-none`}
                            />
                        </div>
                        </div>

                        <div className="shrink-0 flex flex-wrap justify-end gap-2 pt-3 mt-3 border-t border-slate-100">
                            {editingFleet && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-3 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-xs"
                                >
                                    Cancelar edición
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={saveMutation.isPending}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl font-bold transition-all text-xs active:scale-95 disabled:opacity-50 shadow-sm"
                            >
                                {saveMutation.isPending ? 'Guardando...' : editingFleet ? 'Actualizar Vehículo' : 'Agregar a Flota'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col gap-3">
                        <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar por placa, motorista, código, marca o modelo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                            />
                        </div>

                        {!isLoading && fleets.length > 0 && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                                {filteredFleets.length} de {fleets.length} vehículo(s)
                            </p>
                        )}

                        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5 flex flex-col gap-2">
                            {(Array.isArray(filteredFleets) ? filteredFleets : []).map(f => {
                                const vehicleDesc = [
                                    f.tipo_vehiculo,
                                    [f.marca, f.modelo, f.anio].filter(Boolean).join(' '),
                                    f.color
                                ].filter(Boolean).join(' · ');

                                return (
                                    <div
                                        key={f.id}
                                        className={`shrink-0 flex items-start justify-between gap-2 p-3 rounded-xl border transition-colors ${
                                            f.activo ? 'bg-slate-50 border-slate-200/70' : 'bg-slate-100/60 border-slate-200 opacity-75'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-xs font-black rounded-md tracking-wide">
                                                    {f.placa}
                                                </span>
                                                {f.codigo_interno && (
                                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded border border-indigo-200/60">
                                                        {f.codigo_interno}
                                                    </span>
                                                )}
                                                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded-full ${
                                                    f.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                                }`}>
                                                    {f.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                                {f.tipo_combustible && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-200/70">
                                                        <Fuel size={10} /> {f.tipo_combustible}
                                                    </span>
                                                )}
                                            </div>

                                            {f.motorista && (
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-700 font-semibold">
                                                    <span className="inline-flex items-center gap-1">
                                                        <User size={12} className="text-slate-400" /> {f.motorista}
                                                    </span>
                                                    {f.documento_motorista && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                                                            <IdCard size={11} className="text-slate-400" /> {f.documento_motorista}
                                                        </span>
                                                    )}
                                                    {f.telefono_motorista && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                                            <Phone size={11} className="text-slate-400" /> {f.telefono_motorista}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {vehicleDesc && (
                                                <div className="text-xs text-slate-500 font-medium">{vehicleDesc}</div>
                                            )}

                                            {f.observaciones && (
                                                <div className="text-[11px] text-slate-400 italic line-clamp-2">{f.observaciones}</div>
                                            )}
                                        </div>

                                        <div className="flex gap-1 ml-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleEditFleet(f)}
                                                title="Editar vehículo"
                                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteFleet(f)}
                                                title="Eliminar vehículo"
                                                className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {!isLoading && fleets.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-slate-400 text-sm py-8">
                                    <Truck size={28} className="text-slate-300" />
                                    <p>No hay vehículos registrados en la flota</p>
                                </div>
                            )}

                            {!isLoading && fleets.length > 0 && filteredFleets.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-slate-400 text-sm py-8">
                                    <Truck size={28} className="text-slate-300" />
                                    <p>Sin resultados para &quot;{searchTerm}&quot;</p>
                                </div>
                            )}

                            {isLoading && (
                                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-slate-400 text-sm py-8">
                                    <p>Cargando flotas...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CustomerFleetsModal;
