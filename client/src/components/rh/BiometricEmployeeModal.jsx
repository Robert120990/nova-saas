import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { UserPlus, X, Check, Fingerprint, Clock, Building2, Briefcase, Users } from 'lucide-react';
import { unwrapList } from '../../utils/apiUtils';

const BiometricEmployeeModal = ({ open, onClose, onSuccess }) => {
    const queryClient = useQueryClient();

    const [form, setForm] = useState({
        nombres: '',
        apellidos: '',
        codigo: '',
        codigo_biometrico: '',
        branch_id: '',
        departamento_personal_id: '',
        cargo_id: '',
        turno_id: '',
        exento_horas_extras: 0,
        telefono: '',
        num_dui: '',
        sueldo_base: ''
    });

    // Cargar catálogos: Turnos
    const { data: rawShifts = [] } = useQuery({
        queryKey: ['rh-biometric-shifts'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/biometric/shifts')),
        enabled: open
    });
    const shifts = Array.isArray(rawShifts) ? rawShifts : [];

    // Cargar catálogos: Sucursales
    const { data: rawBranches = [] } = useQuery({
        queryKey: ['branches-list'],
        queryFn: async () => unwrapList(await axios.get('/api/branches')),
        enabled: open
    });
    const branches = Array.isArray(rawBranches) ? rawBranches : [];

    // Cargar catálogos: Departamentos
    const { data: rawDeps = [] } = useQuery({
        queryKey: ['rh-departamentos-list'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/departamentos')),
        enabled: open
    });
    const departamentos = Array.isArray(rawDeps) ? rawDeps : [];

    // Cargar catálogos: Cargos
    const { data: rawCargos = [] } = useQuery({
        queryKey: ['rh-cargos-list'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/cargos')),
        enabled: open
    });
    const cargos = Array.isArray(rawCargos) ? rawCargos : [];

    const mutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/rh/empleados', payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`Colaborador ${form.nombres} registrado exitosamente y vinculado al marcador.`);
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-overtime-employees'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-employee-shifts'] });
            if (onSuccess) onSuccess(data);
            handleClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al registrar el colaborador');
        }
    });

    const handleClose = () => {
        setForm({
            nombres: '',
            apellidos: '',
            codigo: '',
            codigo_biometrico: '',
            branch_id: '',
            departamento_personal_id: '',
            cargo_id: '',
            turno_id: '',
            exento_horas_extras: 0,
            telefono: '',
            num_dui: '',
            sueldo_base: ''
        });
        onClose();
    };

    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.nombres.trim() || !form.apellidos.trim()) {
            toast.error('Ingrese los nombres y apellidos del colaborador.');
            return;
        }

        mutation.mutate({
            nombres: form.nombres.trim(),
            apellidos: form.apellidos.trim(),
            codigo: form.codigo.trim() || undefined,
            codigo_biometrico: form.codigo_biometrico.trim() || form.codigo.trim() || undefined,
            branch_id: form.branch_id || undefined,
            departamento_personal_id: form.departamento_personal_id || undefined,
            cargo_id: form.cargo_id || undefined,
            turno_id: form.turno_id || undefined,
            exento_horas_extras: form.exento_horas_extras ? 1 : 0,
            telefono: form.telefono.trim() || undefined,
            num_dui: form.num_dui.trim() || undefined,
            sueldo_base: form.sueldo_base ? parseFloat(form.sueldo_base) : 0,
            es_activo: 1
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Registrar Empleado para Marcador
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Alta inmediata de colaborador con turno, UID biométrico y parámetros de asistencia
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5 text-xs">
                    {/* Sección 1: Marcador Digital & Turno */}
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                        <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wider">
                            <Fingerprint className="w-4 h-4 text-indigo-600" />
                            <span>Parámetros del Reloj Marcador</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase">
                                    ID / UID en el Reloj ZKTeco <span className="text-indigo-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.codigo_biometrico}
                                    onChange={e => setForm({ ...form, codigo_biometrico: e.target.value })}
                                    placeholder="Ej. 10, 105, 002..."
                                    className="w-full text-xs font-bold text-indigo-900 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                                />
                                <p className="text-[10px] text-slate-500">
                                    Número de usuario grabado en el reloj marcador para vincular sus huellas.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase">
                                    Código Empleado SIPE
                                </label>
                                <input
                                    type="text"
                                    value={form.codigo}
                                    onChange={e => setForm({ ...form, codigo: e.target.value })}
                                    placeholder="Dejar vacío para auto-generar"
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase">
                                    Turno / Horario Asignado
                                </label>
                                <select
                                    value={form.turno_id}
                                    onChange={e => setForm({ ...form, turno_id: e.target.value })}
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                                >
                                    <option value="">Turno General (Según Empresa)</option>
                                    {shifts.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.nombre} ({t.hora_entrada?.slice(0, 5)} - {t.hora_salida?.slice(0, 5)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col justify-center space-y-1 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={!!form.exento_horas_extras}
                                        onChange={e => setForm({ ...form, exento_horas_extras: e.target.checked ? 1 : 0 })}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    />
                                    <span className="font-bold text-slate-700 text-xs">
                                        Exento de Horas Extras
                                    </span>
                                </label>
                                <p className="text-[10px] text-slate-400">
                                    Marcar si es personal de confianza/jefatura que no devenga horas extras.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sección 2: Datos Personales */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
                            <Users className="w-4 h-4 text-slate-500" />
                            <span>Datos del Colaborador</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Nombres <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.nombres}
                                    onChange={e => setForm({ ...form, nombres: e.target.value })}
                                    placeholder="Nombres del empleado"
                                    className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Apellidos <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.apellidos}
                                    onChange={e => setForm({ ...form, apellidos: e.target.value })}
                                    placeholder="Apellidos del empleado"
                                    className="w-full text-xs font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    DUI (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={form.num_dui}
                                    onChange={e => setForm({ ...form, num_dui: e.target.value })}
                                    placeholder="00000000-0"
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Teléfono / Celular
                                </label>
                                <input
                                    type="text"
                                    value={form.telefono}
                                    onChange={e => setForm({ ...form, telefono: e.target.value })}
                                    placeholder="7000-0000"
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sección 3: Ubicación y Puesto */}
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Sucursal
                                </label>
                                <select
                                    value={form.branch_id}
                                    onChange={e => setForm({ ...form, branch_id: e.target.value })}
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white"
                                >
                                    <option value="">Seleccione Sucursal</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name || b.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Departamento
                                </label>
                                <select
                                    value={form.departamento_personal_id}
                                    onChange={e => setForm({ ...form, departamento_personal_id: e.target.value })}
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white"
                                >
                                    <option value="">Seleccione Departamento</option>
                                    {departamentos.map(d => (
                                        <option key={d.id} value={d.id}>{d.descripcion || d.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">
                                    Cargo / Puesto
                                </label>
                                <select
                                    value={form.cargo_id}
                                    onChange={e => setForm({ ...form, cargo_id: e.target.value })}
                                    className="w-full text-xs font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white"
                                >
                                    <option value="">Seleccione Cargo</option>
                                    {cargos.map(c => (
                                        <option key={c.id} value={c.id}>{c.descripcion || c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-200 disabled:opacity-50"
                        >
                            <Check className="w-4 h-4" />
                            <span>{mutation.isPending ? 'Registrando...' : 'Registrar Empleado'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricEmployeeModal;
