import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { UserPlus, X, Check, Fingerprint, Users } from 'lucide-react';
import { unwrapList } from '../../utils/apiUtils';

const INITIAL_FORM = {
    nombres: '',
    apellidos: '',
    codigo: '',
    codigo_biometrico: '',
    branch_id: '',
    departamento_personal_id: '',
    cargo_id: '',
    turno_id: '',
    exento_horas_extras: 0,
    omitir_marcador_digital: 0,
    telefono: '',
    num_dui: '',
    sueldo_base: ''
};

const BiometricEmployeeModal = ({ open, onClose, onSuccess }) => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState(INITIAL_FORM);

    const { data: rawShifts = [] } = useQuery({
        queryKey: ['rh-biometric-shifts'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/biometric/shifts')),
        enabled: open
    });
    const { data: rawBranches = [] } = useQuery({
        queryKey: ['branches-list'],
        queryFn: async () => unwrapList(await axios.get('/api/branches')),
        enabled: open
    });
    const { data: rawDeps = [] } = useQuery({
        queryKey: ['rh-departamentos-list'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/departamentos')),
        enabled: open
    });
    const { data: rawCargos = [] } = useQuery({
        queryKey: ['rh-cargos-list'],
        queryFn: async () => unwrapList(await axios.get('/api/rh/cargos')),
        enabled: open
    });

    const shifts = Array.isArray(rawShifts) ? rawShifts : [];
    const branches = Array.isArray(rawBranches) ? rawBranches : [];
    const departamentos = Array.isArray(rawDeps) ? rawDeps : [];
    const cargos = Array.isArray(rawCargos) ? rawCargos : [];

    const handleClose = () => {
        setForm(INITIAL_FORM);
        onClose();
    };

    const mutation = useMutation({
        mutationFn: async (payload) => (await axios.post('/api/rh/empleados', payload)).data,
        onSuccess: (data) => {
            toast.success(`Colaborador ${form.nombres} registrado y vinculado al marcador.`);
            [
                'rh-biometric-attendance', 'rh-biometric-cortes-summary',
                'rh-biometric-cortes-daily-overtime', 'rh-biometric-attendance-report',
                'rh-biometric-overtime-employees', 'rh-biometric-employee-shifts',
                'rh-biometric-clock-users'
            ].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
            if (onSuccess) onSuccess(data);
            handleClose();
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar el colaborador')
    });

    if (!open) return null;

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

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
            codigo_biometrico: form.codigo_biometrico.trim() || undefined,
            branch_id: form.branch_id || undefined,
            departamento_personal_id: form.departamento_personal_id || undefined,
            cargo_id: form.cargo_id || undefined,
            turno_id: form.turno_id || undefined,
            exento_horas_extras: form.exento_horas_extras ? 1 : 0,
            omitir_marcador_digital: form.omitir_marcador_digital ? 1 : 0,
            telefono: form.telefono.trim() || undefined,
            num_dui: form.num_dui.trim() || undefined,
            sueldo_base: form.sueldo_base ? parseFloat(form.sueldo_base) : 0,
            es_activo: 1
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Registrar Empleado para Marcador</h2>
                            <p className="text-xs text-slate-500 font-medium">Alta inmediata con turno, UID biométrico y parámetros de asistencia</p>
                        </div>
                    </div>
                    <button type="button" onClick={handleClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-5 text-xs">
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 space-y-3">
                        <div className="flex items-center gap-2 text-indigo-900 font-bold uppercase tracking-wider">
                            <Fingerprint className="w-4 h-4 text-indigo-600" />
                            <span>Parámetros del Reloj Marcador</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase">
                                    ID / UID en el Reloj ZKTeco {!form.omitir_marcador_digital && <span className="text-indigo-600">*</span>}
                                </label>
                                <input
                                    type="text"
                                    required={!form.omitir_marcador_digital}
                                    disabled={!!form.omitir_marcador_digital}
                                    value={form.codigo_biometrico}
                                    onChange={e => updateField('codigo_biometrico', e.target.value)}
                                    placeholder={form.omitir_marcador_digital ? 'Omitido del marcador' : 'Ej. 10, 105, 35...'}
                                    className="w-full font-bold text-indigo-900 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                />
                                <p className="text-[10px] text-slate-500">Número de usuario asignado en el reloj ZKTeco para vincular sus huellas.</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase">Código Empleado SIPE</label>
                                <input
                                    type="text"
                                    value={form.codigo}
                                    onChange={e => updateField('codigo', e.target.value)}
                                    placeholder="Dejar vacío para auto-generar"
                                    className="w-full font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase">Turno / Horario Asignado</label>
                                <select
                                    value={form.turno_id}
                                    onChange={e => updateField('turno_id', e.target.value)}
                                    className="w-full font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white"
                                >
                                    <option value="">Turno General (Según Empresa)</option>
                                    {shifts.map(t => (
                                        <option key={t.id} value={t.id}>{t.nombre} ({t.hora_entrada?.slice(0, 5)} - {t.hora_salida?.slice(0, 5)})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col justify-center space-y-2 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={!!form.exento_horas_extras}
                                        onChange={e => updateField('exento_horas_extras', e.target.checked ? 1 : 0)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                    />
                                    <span className="font-bold text-slate-700">Exento de Horas Extras</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={!!form.omitir_marcador_digital}
                                        onChange={e => updateField('omitir_marcador_digital', e.target.checked ? 1 : 0)}
                                        className="w-4 h-4 text-amber-600 rounded border-slate-300"
                                    />
                                    <span className="font-bold text-amber-800">Omitir del Marcador Digital</span>
                                </label>
                                <p className="text-[10px] text-slate-400">Para personal fuera de planta o contrato sin horario fijo.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-slate-700 font-bold uppercase tracking-wider">
                            <Users className="w-4 h-4 text-slate-500" />
                            <span>Datos del Colaborador</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">Nombres <span className="text-rose-500">*</span></label>
                                <input type="text" required value={form.nombres} onChange={e => updateField('nombres', e.target.value)} placeholder="Nombres" className="w-full font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">Apellidos <span className="text-rose-500">*</span></label>
                                <input type="text" required value={form.apellidos} onChange={e => updateField('apellidos', e.target.value)} placeholder="Apellidos" className="w-full font-semibold border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">DUI (Opcional)</label>
                                <input type="text" value={form.num_dui} onChange={e => updateField('num_dui', e.target.value)} placeholder="00000000-0" className="w-full font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase">Teléfono / Celular</label>
                                <input type="text" value={form.telefono} onChange={e => updateField('telefono', e.target.value)} placeholder="7000-0000" className="w-full font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase">Sucursal</label>
                            <select value={form.branch_id} onChange={e => updateField('branch_id', e.target.value)} className="w-full font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white">
                                <option value="">Seleccione Sucursal</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name || b.nombre}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase">Departamento</label>
                            <select value={form.departamento_personal_id} onChange={e => updateField('departamento_personal_id', e.target.value)} className="w-full font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white">
                                <option value="">Seleccione Departamento</option>
                                {departamentos.map(d => <option key={d.id} value={d.id}>{d.descripcion || d.nombre}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase">Cargo / Puesto</label>
                            <select value={form.cargo_id} onChange={e => updateField('cargo_id', e.target.value)} className="w-full font-medium border border-slate-300 rounded-xl px-3 py-2 outline-none bg-white">
                                <option value="">Seleccione Cargo</option>
                                {cargos.map(c => <option key={c.id} value={c.id}>{c.descripcion || c.nombre}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button type="button" onClick={handleClose} className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                        <button type="submit" disabled={mutation.isPending} className="flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm disabled:opacity-50">
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
