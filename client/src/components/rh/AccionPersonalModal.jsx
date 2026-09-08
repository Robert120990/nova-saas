import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../ui/Modal';
import EmployeeSearchModal from './EmployeeSearchModal';
import { toast } from 'sonner';
import {
    AlertTriangle, CheckSquare, Square, Search, Users, User,
    Loader2
} from 'lucide-react';

import {
    INFRACCIONES_COL1,
    INFRACCIONES_COL2,
    ACCIONES_OPCIONES,
    TIEMPO_LABORADO_MAP,
    calculateTiempoLaboradoKey,
    fmtDate
} from './accionPersonalConstants';

const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";

const AccionPersonalModal = ({
    isOpen,
    onClose,
    selectedAction = null,
    initialEmployee = null,
    onSuccess,
    zIndex = "z-[60]"
}) => {
    const queryClient = useQueryClient();
    const employeeInputRef = useRef(null);

    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [codigoInput, setCodigoInput] = useState('');
    const [empleadoData, setEmpleadoData] = useState(null);

    // Form fields
    const [formFecha, setFormFecha] = useState(new Date().toISOString().split('T')[0]);
    const [formJefe, setFormJefe] = useState('');
    const [formLugar, setFormLugar] = useState('');
    const [formTiempo, setFormTiempo] = useState('0_a_1');
    const [formInfracciones, setFormInfracciones] = useState([]);
    const [formInfraccionOtra, setFormInfraccionOtra] = useState('');
    const [formCausa, setFormCausa] = useState('');
    const [formArticulo, setFormArticulo] = useState('Conforme a Reglamento Interno de Trabajo');
    const [formAccionTomar, setFormAccionTomar] = useState('llamado_escrito_1');
    const [formDiasSuspension, setFormDiasSuspension] = useState(1);
    const [formFechaInicioSusp, setFormFechaInicioSusp] = useState('');
    const [formFechaFinSusp, setFormFechaFinSusp] = useState('');
    const [formAccionOtra, setFormAccionOtra] = useState('');
    const [formRecursosHumanos, setFormRecursosHumanos] = useState('');
    const [formEstadoFirma, setFormEstadoFirma] = useState('pendiente');
    const [formTestigo, setFormTestigo] = useState('');
    const [formObservaciones, setFormObservaciones] = useState('');

    const resetForm = () => {
        setEmpleadoData(null);
        setCodigoInput('');
        setFormFecha(new Date().toISOString().split('T')[0]);
        setFormJefe('');
        setFormLugar('');
        setFormTiempo('0_a_1');
        setFormInfracciones([]);
        setFormInfraccionOtra('');
        setFormCausa('');
        setFormArticulo('Conforme a Reglamento Interno de Trabajo');
        setFormAccionTomar('llamado_escrito_1');
        setFormDiasSuspension(1);
        setFormFechaInicioSusp('');
        setFormFechaFinSusp('');
        setFormAccionOtra('');
        setFormRecursosHumanos('');
        setFormEstadoFirma('pendiente');
        setFormTestigo('');
        setFormObservaciones('');
    };

    const handleSelectEmployee = (emp) => {
        setEmpleadoData(emp);
        setCodigoInput(emp.codigo || '');
        setFormLugar(emp.departamento_nombre || emp.departamento || 'OFICINA CENTRAL');
        setFormTiempo(calculateTiempoLaboradoKey(emp.fecha_ingreso));
        setIsEmpModalOpen(false);
    };

    const handleCodigoSearch = async () => {
        if (!codigoInput.trim()) return;
        try {
            const res = await axios.get('/api/rh/empleados', { params: { search: codigoInput.trim(), limit: 1, solo_activos: 1 } });
            const emp = res.data.data?.[0];
            if (emp) {
                handleSelectEmployee(emp);
            } else {
                toast.error('Empleado no encontrado');
            }
        } catch {
            toast.error('Error al buscar empleado');
        }
    };

    // Load initial data when modal opens or props change
    useEffect(() => {
        if (!isOpen) return;

        if (selectedAction) {
            setEmpleadoData({
                id: selectedAction.empleado_id,
                nombres: selectedAction.empleado_nombres,
                apellidos: selectedAction.empleado_apellidos,
                codigo: selectedAction.empleado_codigo,
                cargo_nombre: selectedAction.cargo_nombre,
                departamento_nombre: selectedAction.departamento_nombre,
                fecha_ingreso: selectedAction.fecha_ingreso
            });
            setCodigoInput(selectedAction.empleado_codigo || '');
            setFormFecha(selectedAction.fecha ? selectedAction.fecha.substring(0, 10) : new Date().toISOString().split('T')[0]);
            setFormJefe(selectedAction.jefe_inmediato || '');
            setFormLugar(selectedAction.lugar_trabajo || '');
            setFormTiempo(selectedAction.tiempo_laborado || '0_a_1');

            let parsedInf = [];
            if (Array.isArray(selectedAction.infracciones)) {
                parsedInf = selectedAction.infracciones;
            } else if (typeof selectedAction.infracciones === 'string') {
                try { parsedInf = JSON.parse(selectedAction.infracciones); } catch { parsedInf = []; }
            }
            setFormInfracciones(parsedInf);
            setFormInfraccionOtra(selectedAction.infraccion_otra || '');
            setFormCausa(selectedAction.descripcion_causa || '');
            setFormArticulo(selectedAction.articulo_codigo_trabajo || 'Conforme a Reglamento Interno de Trabajo');
            setFormAccionTomar(selectedAction.accion_tomar || 'llamado_escrito_1');
            setFormDiasSuspension(selectedAction.dias_suspension || 1);
            setFormFechaInicioSusp(selectedAction.fecha_inicio_suspension ? selectedAction.fecha_inicio_suspension.substring(0, 10) : '');
            setFormFechaFinSusp(selectedAction.fecha_fin_suspension ? selectedAction.fecha_fin_suspension.substring(0, 10) : '');
            setFormAccionOtra(selectedAction.accion_otra || '');
            setFormRecursosHumanos(selectedAction.recursos_humanos || '');
            setFormEstadoFirma(selectedAction.estado_firma || 'pendiente');
            setFormTestigo(selectedAction.testigo_nombre || '');
            setFormObservaciones(selectedAction.observaciones || '');
        } else if (initialEmployee) {
            resetForm();
            handleSelectEmployee(initialEmployee);
        } else {
            resetForm();
        }
    }, [isOpen, selectedAction, initialEmployee]);

    // F3 shortcut for employee search
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3' && isOpen && !initialEmployee) {
                e.preventDefault();
                setIsEmpModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, initialEmployee]);

    const toggleInfraccion = (item) => {
        setFormInfracciones(prev => {
            if (prev.includes(item)) return prev.filter(x => x !== item);
            return [...prev, item];
        });
    };

    const mutation = useMutation({
        mutationFn: (payload) => {
            if (selectedAction?.id) {
                return axios.put(`/api/rh/acciones-personal/${selectedAction.id}`, payload);
            }
            return axios.post('/api/rh/acciones-personal', payload);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-acciones-personal'] });
            queryClient.invalidateQueries({ queryKey: ['rh-empleado-acciones'] });
            toast.success(selectedAction ? 'Acción de personal actualizada' : 'Acción de personal registrada');
            if (onSuccess) onSuccess(res.data);
            onClose();
            resetForm();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar la acción de personal');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!empleadoData?.id) {
            return toast.error('Debe seleccionar un empleado');
        }
        if (!formCausa.trim()) {
            return toast.error('Debe ingresar la descripción de la causa');
        }

        const payload = {
            empleado_id: empleadoData.id,
            fecha: formFecha,
            jefe_inmediato: formJefe,
            lugar_trabajo: formLugar,
            tiempo_laborado: formTiempo,
            tipo_accion: 'amonestacion',
            infracciones: formInfracciones,
            infraccion_otra: formInfraccionOtra,
            descripcion_causa: formCausa,
            articulo_codigo_trabajo: formArticulo,
            accion_tomar: formAccionTomar,
            dias_suspension: formAccionTomar === 'suspension' ? parseInt(formDiasSuspension) : 0,
            fecha_inicio_suspension: formAccionTomar === 'suspension' ? formFechaInicioSusp : null,
            fecha_fin_suspension: formAccionTomar === 'suspension' ? formFechaFinSusp : null,
            accion_otra: formAccionTomar === 'otro' ? formAccionOtra : null,
            recursos_humanos: formRecursosHumanos,
            estado_firma: formEstadoFirma,
            testigo_nombre: formEstadoFirma === 'se_nego_a_firmar' ? formTestigo : null,
            observaciones: formObservaciones
        };

        mutation.mutate(payload);
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={() => { onClose(); resetForm(); }}
                title={selectedAction ? `Editar Acción de Personal — ${selectedAction.codigo}` : 'Nueva Acción de Personal y/o Amonestación'}
                maxWidth="max-w-5xl"
                zIndex={zIndex}
            >
                <form onSubmit={handleSubmit} className="space-y-5 pb-2">
                    {/* Top Alert Badge */}
                    <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/70 p-3 rounded-xl text-xs text-amber-800">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                            <span>
                                Documento confidencial laboral conforme al Reglamento Interno de Trabajo autorizado y el Código de Trabajo.
                            </span>
                        </div>
                        <span className="text-[10px] font-bold font-mono uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Confidencial
                        </span>
                    </div>

                    {/* Section 1: Empleado y Metadatos */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                            1. Datos Generales del Empleado
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            {!initialEmployee && !selectedAction && (
                                <div className="sm:col-span-4">
                                    <label className={labelCls}>
                                        Empleado <span className="text-[9px] text-indigo-500 font-normal">(F3 para buscar)</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            ref={employeeInputRef}
                                            type="text"
                                            value={codigoInput}
                                            onChange={e => setCodigoInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodigoSearch(); } }}
                                            placeholder="Código ej. 0001"
                                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleCodigoSearch}
                                            className="px-3 py-2 bg-slate-200/70 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors text-xs font-medium"
                                            title="Buscar por código"
                                        >
                                            <Search size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsEmpModalOpen(true)}
                                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors text-xs font-bold flex items-center gap-1"
                                            title="Catálogo de empleados (F3)"
                                        >
                                            <Users size={14} />
                                            <span>F3</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className={initialEmployee || selectedAction ? 'sm:col-span-12' : 'sm:col-span-8'}>
                                {empleadoData ? (
                                    <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-900 text-sm">
                                                        {empleadoData.nombres} {empleadoData.apellidos}
                                                    </span>
                                                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                        CÓD: {empleadoData.codigo}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-slate-500">
                                                    {empleadoData.cargo_nombre || 'Sin cargo asignado'} — {empleadoData.departamento_nombre || 'Sin departamento'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Fecha Ingreso</span>
                                            <span className="font-semibold text-slate-700 text-xs">
                                                {fmtDate(empleadoData.fecha_ingreso)}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-2.5 bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 italic">
                                        Seleccione un empleado del catálogo para cargar su información laboral.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                            <div>
                                <label className={labelCls}>Fecha de Amonestación *</label>
                                <input
                                    type="date"
                                    required
                                    value={formFecha}
                                    onChange={e => setFormFecha(e.target.value)}
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Lugar de Trabajo Actual</label>
                                <input
                                    type="text"
                                    value={formLugar}
                                    onChange={e => setFormLugar(e.target.value)}
                                    placeholder="Ej: Sucursal Central / Planta"
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Nombre de Jefe Inmediato</label>
                                <input
                                    type="text"
                                    value={formJefe}
                                    onChange={e => setFormJefe(e.target.value)}
                                    placeholder="Nombre del supervisor"
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Tiempo Laborado</label>
                                <select
                                    value={formTiempo}
                                    onChange={e => setFormTiempo(e.target.value)}
                                    className={fieldCls}
                                >
                                    {Object.entries(TIEMPO_LABORADO_MAP).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Razón de la Acción de Personal (Checklist de Infracciones) */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                                    2. Razón de la Acción de Personal y/o Amonestación
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    Marque una o varias causales según las faltas cometidas conforme al Reglamento Interno
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                                {formInfracciones.length} seleccionada(s)
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                            {/* Columna 1 */}
                            <div className="space-y-1.5">
                                {INFRACCIONES_COL1.map((inf, idx) => {
                                    const checked = formInfracciones.includes(inf);
                                    return (
                                        <label
                                            key={idx}
                                            onClick={() => toggleInfraccion(inf)}
                                            className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-colors select-none ${
                                                checked ? 'bg-indigo-50/70 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-600'
                                            }`}
                                        >
                                            <div className="mt-0.5 shrink-0 text-indigo-600">
                                                {checked ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-slate-300" />}
                                            </div>
                                            <span className="text-[11.5px] leading-tight">{inf}</span>
                                        </label>
                                    );
                                })}
                            </div>

                            {/* Columna 2 */}
                            <div className="space-y-1.5">
                                {INFRACCIONES_COL2.map((inf, idx) => {
                                    const checked = formInfracciones.includes(inf);
                                    return (
                                        <div key={idx} className="space-y-1">
                                            <label
                                                onClick={() => toggleInfraccion(inf)}
                                                className={`flex items-start gap-2 p-1.5 rounded-lg cursor-pointer transition-colors select-none ${
                                                    checked ? 'bg-indigo-50/70 text-indigo-900 font-semibold' : 'hover:bg-slate-50 text-slate-600'
                                                }`}
                                            >
                                                <div className="mt-0.5 shrink-0 text-indigo-600">
                                                    {checked ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-slate-300" />}
                                                </div>
                                                <span className="text-[11.5px] leading-tight">{inf}</span>
                                            </label>
                                            {inf === 'Otros' && checked && (
                                                <input
                                                    type="text"
                                                    value={formInfraccionOtra}
                                                    onChange={e => setFormInfraccionOtra(e.target.value)}
                                                    placeholder="Especifique la otra causa..."
                                                    className="w-full ml-6 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100">
                            Nota: Todas las infracciones antes anotadas están incorporadas dentro del Reglamento Interno de Trabajo de la Sociedad, debidamente revisado y autorizado por la Dirección General de Trabajo.
                        </p>
                    </div>

                    {/* Section 3: Narrativa y Fundamento Legal */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                            3. Descripción de la Causa y Fundamento Legal
                        </span>

                        <div>
                            <label className={labelCls}>Describa la Causa de la Amonestación *</label>
                            <textarea
                                required
                                rows={3}
                                value={formCausa}
                                onChange={e => setFormCausa(e.target.value)}
                                placeholder="Describa con precisión los hechos ocurridos, circunstancias de tiempo, modo y lugar, testigos, y consecuencias..."
                                className={`${fieldCls} resize-y text-xs`}
                            />
                        </div>

                        <div>
                            <label className={labelCls}>Artículo Código de Trabajo Incumplido</label>
                            <input
                                type="text"
                                value={formArticulo}
                                onChange={e => setFormArticulo(e.target.value)}
                                placeholder="Ej: Art. 31, Numeral 5 del Código de Trabajo"
                                className={fieldCls}
                            />
                        </div>
                    </div>

                    {/* Section 4: Acciones a Tomar (Sanción) */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                            4. Acciones a Tomar (Sanción / Medida Disciplinaria)
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {ACCIONES_OPCIONES.map(opt => {
                                const selectedOpt = formAccionTomar === opt.key;
                                return (
                                    <label
                                        key={opt.key}
                                        onClick={() => setFormAccionTomar(opt.key)}
                                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                            selectedOpt ? `${opt.color} shadow-sm font-bold` : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-600 font-medium'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="modal_accion_tomar"
                                            checked={selectedOpt}
                                            onChange={() => setFormAccionTomar(opt.key)}
                                            className="accent-indigo-600"
                                        />
                                        <span className="text-xs leading-tight">{opt.label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        {formAccionTomar === 'suspension' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-rose-50/50 rounded-xl border border-rose-200/60 mt-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-rose-800 uppercase mb-1">Días de Suspensión</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={formDiasSuspension}
                                        onChange={e => setFormDiasSuspension(parseInt(e.target.value) || 1)}
                                        className={fieldCls}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-rose-800 uppercase mb-1">Fecha Inicio Suspensión</label>
                                    <input
                                        type="date"
                                        value={formFechaInicioSusp}
                                        onChange={e => setFormFechaInicioSusp(e.target.value)}
                                        className={fieldCls}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-rose-800 uppercase mb-1">Fecha Fin Suspensión</label>
                                    <input
                                        type="date"
                                        value={formFechaFinSusp}
                                        onChange={e => setFormFechaFinSusp(e.target.value)}
                                        className={fieldCls}
                                    />
                                </div>
                            </div>
                        )}

                        {formAccionTomar === 'otro' && (
                            <div className="mt-2">
                                <label className={labelCls}>Especifique otra medida</label>
                                <input
                                    type="text"
                                    value={formAccionOtra}
                                    onChange={e => setFormAccionOtra(e.target.value)}
                                    placeholder="Describa la medida a tomar..."
                                    className={fieldCls}
                                />
                            </div>
                        )}
                    </div>

                    {/* Section 5: Firmas y Notificación */}
                    <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                            5. Responsables y Estado de Notificación
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={labelCls}>Recursos Humanos (Firma)</label>
                                <input
                                    type="text"
                                    value={formRecursosHumanos}
                                    onChange={e => setFormRecursosHumanos(e.target.value)}
                                    placeholder="Nombre de quien representa RH"
                                    className={fieldCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Estado de Firma del Empleado</label>
                                <select
                                    value={formEstadoFirma}
                                    onChange={e => setFormEstadoFirma(e.target.value)}
                                    className={fieldCls}
                                >
                                    <option value="pendiente">Pendiente de firma</option>
                                    <option value="firmado">Firmado por el empleado</option>
                                    <option value="se_nego_a_firmar">Se negó a firmar</option>
                                </select>
                            </div>
                            {formEstadoFirma === 'se_nego_a_firmar' && (
                                <div>
                                    <label className="block text-[11px] font-bold text-rose-700 uppercase mb-1">Nombre del Testigo</label>
                                    <input
                                        type="text"
                                        value={formTestigo}
                                        onChange={e => setFormTestigo(e.target.value)}
                                        placeholder="Nombre del testigo presente"
                                        className={fieldCls}
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={labelCls}>Observaciones Adicionales</label>
                            <input
                                type="text"
                                value={formObservaciones}
                                onChange={e => setFormObservaciones(e.target.value)}
                                placeholder="Anotaciones complementarias o de seguimiento..."
                                className={fieldCls}
                            />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => { onClose(); resetForm(); }}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                        >
                            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
                            <span>{selectedAction ? 'Actualizar Acción' : 'Guardar Acción de Personal'}</span>
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Employee Search Modal (F3) */}
            <EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
            />
        </>
    );
};

export default AccionPersonalModal;
