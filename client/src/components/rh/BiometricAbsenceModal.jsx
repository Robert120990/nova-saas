import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { CalendarX, X, Save, Loader2, User } from 'lucide-react';
import { getTodayString, toDateInput } from '../../utils/dateUtils';
import { unwrapList } from '../../utils/apiUtils';
import {
    ABSENCE_CATEGORIES,
    ABSENCE_SUBTYPES,
    TIME_MODALITIES,
    getSubtypeMeta
} from './biometricAbsenceConstants';
import BiometricAbsenceAuthFields from './BiometricAbsenceAuthFields';

const labelCls = 'text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1';
const inputCls = 'w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all';

const BiometricAbsenceModal = ({ open, onClose, initialData = null, editingAbsence = null, onSuccess }) => {
    const queryClient = useQueryClient();

    const [empleadoId, setEmpleadoId] = useState('');
    const [categoria, setCategoria] = useState('interna');
    const [subtipo, setSubtipo] = useState('permiso_personal');
    const [pidioPermiso, setPidioPermiso] = useState(true);
    const [estadoAutorizacion, setEstadoAutorizacion] = useState('pendiente');
    const [goceSueldo, setGoceSueldo] = useState(false);
    const [afectaSeptimoDia, setAfectaSeptimoDia] = useState(false);
    const [modalidadTiempo, setModalidadTiempo] = useState('dia_completo');
    const [fechaInicio, setFechaInicio] = useState(getTodayString());
    const [fechaFin, setFechaFin] = useState(getTodayString());
    const [horaInicio, setHoraInicio] = useState('08:00');
    const [horaFin, setHoraFin] = useState('12:00');
    const [documentoRef, setDocumentoRef] = useState('');
    const [motivo, setMotivo] = useState('');
    const [notasAutorizacion, setNotasAutorizacion] = useState('');

    const { data: rawEmployees = [], isLoading: isLoadingEmp } = useQuery({
        queryKey: ['rh-empleados-active-picker'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/empleados', { params: { status: 'activo', limit: 400 } })),
        enabled: open
    });
    const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

    useEffect(() => {
        if (!open) return;
        if (editingAbsence) {
            setEmpleadoId(String(editingAbsence.empleado_id || ''));
            setCategoria(editingAbsence.categoria || 'interna');
            setSubtipo(editingAbsence.subtipo || 'permiso_personal');
            setPidioPermiso(!!editingAbsence.pidio_permiso);
            setEstadoAutorizacion(editingAbsence.estado_autorizacion || 'pendiente');
            setGoceSueldo(!!editingAbsence.goce_sueldo);
            setAfectaSeptimoDia(!!editingAbsence.afecta_septimo_dia);
            setModalidadTiempo(editingAbsence.modalidad_tiempo || 'dia_completo');
            setFechaInicio(toDateInput(editingAbsence.fecha_inicio) || getTodayString());
            setFechaFin(toDateInput(editingAbsence.fecha_fin) || getTodayString());
            setHoraInicio(editingAbsence.hora_inicio ? String(editingAbsence.hora_inicio).slice(0, 5) : '08:00');
            setHoraFin(editingAbsence.hora_fin ? String(editingAbsence.hora_fin).slice(0, 5) : '12:00');
            setDocumentoRef(editingAbsence.documento_referencia || '');
            setMotivo(editingAbsence.motivo || '');
            setNotasAutorizacion(editingAbsence.notas_autorizacion || '');
        } else {
            const targetDate = initialData?.fecha || getTodayString();
            const defCat = initialData?.categoria || 'interna';
            const defSub = initialData?.subtipo || (defCat === 'ley' ? 'incapacidad_isss' : defCat === 'injustificada' ? 'falta_sin_aviso' : 'permiso_personal');
            const meta = getSubtypeMeta(defSub);
            setEmpleadoId(initialData?.empleado_id ? String(initialData.empleado_id) : '');
            setCategoria(defCat);
            setSubtipo(defSub);
            setPidioPermiso(meta ? meta.defaultPidio : true);
            setEstadoAutorizacion(defCat === 'injustificada' ? 'sin_solicitud' : (defCat === 'ley' ? 'autorizado' : 'pendiente'));
            setGoceSueldo(meta ? meta.defaultGoce : false);
            setAfectaSeptimoDia(meta ? meta.defaultSeptimo : false);
            setModalidadTiempo('dia_completo');
            setFechaInicio(targetDate);
            setFechaFin(targetDate);
            setHoraInicio('08:00');
            setHoraFin('12:00');
            setDocumentoRef('');
            setMotivo('');
            setNotasAutorizacion('');
        }
    }, [open, editingAbsence, initialData]);

    const applySubtypeDefaults = (nextSub, catOverride = categoria) => {
        setSubtipo(nextSub);
        const meta = getSubtypeMeta(nextSub);
        if (!meta) return;
        setPidioPermiso(meta.defaultPidio);
        setGoceSueldo(meta.defaultGoce);
        setAfectaSeptimoDia(meta.defaultSeptimo);
        if (catOverride === 'injustificada') setEstadoAutorizacion(meta.defaultPidio ? 'rechazado' : 'sin_solicitud');
        else if (catOverride === 'ley') setEstadoAutorizacion('autorizado');
        else setEstadoAutorizacion('pendiente');
    };

    const handleCategoryChange = (nextCat) => {
        setCategoria(nextCat);
        const firstSub = ABSENCE_SUBTYPES.find(s => s.categoria === nextCat);
        if (firstSub) applySubtypeDefaults(firstSub.subtipo, nextCat);
    };

    const handleAuthStateChange = (nextAuth) => {
        setEstadoAutorizacion(nextAuth);
        if (nextAuth === 'pendiente') setPidioPermiso(true);
        if (nextAuth === 'sin_solicitud') { setPidioPermiso(false); setGoceSueldo(false); }
        if (nextAuth === 'rechazado') { setGoceSueldo(false); setAfectaSeptimoDia(true); }
        if (nextAuth === 'autorizado') setAfectaSeptimoDia(false);
    };

    const mutation = useMutation({
        mutationFn: async (payload) => editingAbsence?.id
            ? (await axios.put(`/api/rh/biometric/absences/${editingAbsence.id}`, payload)).data
            : (await axios.post('/api/rh/biometric/absences', payload)).data,
        onSuccess: (data) => {
            toast.success(data?.message || 'Registro guardado exitosamente.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-daily-radar'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-absences'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
            queryClient.invalidateQueries({ queryKey: ['rh-empleado-ausencias'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar el registro.')
    });

    if (!open) return null;

    const filteredSubtypes = ABSENCE_SUBTYPES.filter(s => s.categoria === categoria);
    const activeMeta = getSubtypeMeta(subtipo);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!empleadoId) return toast.error('Seleccione el colaborador.');
        if (!fechaInicio || !fechaFin) return toast.error('Indique el rango de fechas.');
        if (fechaInicio > fechaFin) return toast.error('La fecha de inicio no puede ser mayor a la fecha fin.');

        mutation.mutate({
            empleado_id: Number(empleadoId),
            categoria,
            subtipo,
            pidio_permiso: pidioPermiso,
            estado_autorizacion: estadoAutorizacion,
            goce_sueldo: categoria === 'injustificada' || estadoAutorizacion === 'rechazado' || estadoAutorizacion === 'sin_solicitud' ? false : goceSueldo,
            afecta_septimo_dia: afectaSeptimoDia,
            modalidad_tiempo: modalidadTiempo,
            fecha_inicio: fechaInicio,
            fecha_fin: modalidadTiempo === 'por_horas' ? fechaInicio : fechaFin,
            hora_inicio: modalidadTiempo === 'por_horas' ? `${horaInicio}:00` : null,
            hora_fin: modalidadTiempo === 'por_horas' ? `${horaFin}:00` : null,
            documento_referencia: documentoRef.trim(),
            motivo: motivo.trim(),
            notas_autorizacion: notasAutorizacion.trim()
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                            <CalendarX className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                {editingAbsence ? 'Editar Permiso / Inasistencia' : 'Registrar Permiso, Licencia o Inasistencia'}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Control de justificaciones de ley, permisos internos y estado de autorización
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
                    <div>
                        <label className={labelCls}>Colaborador *</label>
                        <div className="relative">
                            <select
                                required
                                value={empleadoId}
                                onChange={(e) => setEmpleadoId(e.target.value)}
                                disabled={isLoadingEmp || !!initialData?.lockEmployee}
                                className={`${inputCls} pl-9`}
                            >
                                <option value="">-- Seleccionar colaborador --</option>
                                {(Array.isArray(employees) ? employees : []).map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.codigo ? `[${emp.codigo}] ` : ''}{emp.nombres} {emp.apellidos}
                                    </option>
                                ))}
                            </select>
                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Clasificación de la Ausencia *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {ABSENCE_CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleCategoryChange(cat.id)}
                                    className={`px-3 py-2 rounded-xl border text-xs font-bold text-left transition-all ${
                                        categoria === cat.id
                                            ? `${cat.badgeCls} ring-2 ring-indigo-500/20 shadow-sm`
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Motivo Específico *</label>
                            <select value={subtipo} onChange={(e) => applySubtypeDefaults(e.target.value)} className={inputCls}>
                                {filteredSubtypes.map((s) => (
                                    <option key={s.subtipo} value={s.subtipo}>{s.label}</option>
                                ))}
                            </select>
                            {activeMeta?.legalRef && (
                                <span className="text-[10.5px] text-slate-400 font-medium mt-0.5 block">Base: {activeMeta.legalRef}</span>
                            )}
                        </div>
                        <div>
                            <label className={labelCls}>Alcance de Tiempo *</label>
                            <select
                                value={modalidadTiempo}
                                onChange={(e) => {
                                    setModalidadTiempo(e.target.value);
                                    if (e.target.value === 'por_horas') setFechaFin(fechaInicio);
                                }}
                                className={inputCls}
                            >
                                {TIME_MODALITIES.map((m) => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>{modalidadTiempo === 'por_horas' ? 'Fecha del Permiso *' : 'Fecha Inicio *'}</label>
                            <input
                                type="date"
                                required
                                value={fechaInicio}
                                onChange={(e) => {
                                    setFechaInicio(e.target.value);
                                    if (modalidadTiempo === 'por_horas' || e.target.value > fechaFin) setFechaFin(e.target.value);
                                }}
                                className={inputCls}
                            />
                        </div>
                        {modalidadTiempo === 'por_horas' ? (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelCls}>Desde *</label>
                                    <input type="time" required value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Hasta *</label>
                                    <input type="time" required value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className={inputCls} />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className={labelCls}>Fecha Fin *</label>
                                <input type="date" required value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} className={inputCls} />
                            </div>
                        )}
                    </div>

                    <BiometricAbsenceAuthFields
                        categoria={categoria}
                        pidioPermiso={pidioPermiso}
                        onPidioPermisoChange={(yes) => {
                            setPidioPermiso(yes);
                            if (!yes && estadoAutorizacion === 'pendiente') setEstadoAutorizacion('sin_solicitud');
                            if (yes && estadoAutorizacion === 'sin_solicitud') setEstadoAutorizacion('pendiente');
                        }}
                        estadoAutorizacion={estadoAutorizacion}
                        onEstadoAutorizacionChange={handleAuthStateChange}
                        goceSueldo={goceSueldo}
                        onGoceSueldoChange={setGoceSueldo}
                        afectaSeptimoDia={afectaSeptimoDia}
                        onAfectaSeptimoChange={setAfectaSeptimoDia}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>N° Boleta / Certificado ISSS / Ref.</label>
                            <input type="text" value={documentoRef} onChange={(e) => setDocumentoRef(e.target.value)} placeholder="Ej. Cert. ISSS #45892" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Nota de Jefatura / Autorización</label>
                            <input type="text" value={notasAutorizacion} onChange={(e) => setNotasAutorizacion(e.target.value)} placeholder="Ej. Pendiente presentar constancia física" className={inputCls} />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Explicación / Observaciones del Caso</label>
                        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Detalle el motivo informado por el colaborador..." className={inputCls} />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={mutation.isPending} className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 disabled:opacity-50 transition-all">
                            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>{editingAbsence ? 'Guardar Cambios' : 'Guardar Registro'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricAbsenceModal;
