import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Clock, X, Save, Loader2, User } from 'lucide-react';
import { getNowDateTimeLocal } from '../../utils/dateUtils';
import { unwrapList } from '../../utils/apiUtils';

const BiometricManualPunchModal = ({ open, onClose, onSuccess }) => {
    const queryClient = useQueryClient();

    const [empleadoId, setEmpleadoId] = useState('');
    const [punchTime, setPunchTime] = useState(getNowDateTimeLocal());
    const [punchType, setPunchType] = useState('entrada');
    const [notes, setNotes] = useState('');

    // Fetch active employees for dropdown
    const { data: rawEmployees = [], isLoading: isLoadingEmp } = useQuery({
        queryKey: ['rh-empleados-active-picker'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/empleados', {
                params: { status: 'activo', limit: 300 }
            });
            return unwrapList(res);
        },
        enabled: open
    });

    const employees = Array.isArray(rawEmployees) ? rawEmployees : [];

    useEffect(() => {
        if (open) {
            setPunchTime(getNowDateTimeLocal());
            setPunchType('entrada');
            setNotes('');
            if (employees.length > 0 && !empleadoId) {
                setEmpleadoId(employees[0].id);
            }
        }
    }, [open]);

    const mutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/rh/biometric/manual-punch', payload);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Marcación manual registrada correctamente');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al registrar marcación');
        }
    });

    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!empleadoId) {
            return toast.error('Debe seleccionar un empleado');
        }
        if (!punchTime) {
            return toast.error('Debe indicar la fecha y hora de la marcación');
        }
        mutation.mutate({
            empleado_id: empleadoId,
            punch_time: punchTime.replace('T', ' ') + ':00',
            punch_type: punchType,
            notes: notes.trim()
        });
    };

    const selectedEmp = employees.find(e => String(e.id) === String(empleadoId));

    return (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Registrar Marcación Manual
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Justificación de asistencia o corrección horaria
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
                            Empleado
                        </label>
                        <div className="relative">
                            <select
                                required
                                value={empleadoId}
                                onChange={(e) => setEmpleadoId(e.target.value)}
                                disabled={isLoadingEmp}
                                className="w-full text-[13px] font-medium border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
                            >
                                <option value="">-- Seleccionar empleado --</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.codigo ? `[${emp.codigo}] ` : ''}{emp.nombres} {emp.apellidos} {emp.cargo ? `— ${emp.cargo}` : ''}
                                    </option>
                                ))}
                            </select>
                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                        </div>
                    </div>

                    {selectedEmp && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 flex items-center justify-between text-xs">
                            <div className="text-slate-600">
                                <span className="font-semibold text-slate-800">Código Biométrico:</span>{' '}
                                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-indigo-700 font-bold">
                                    {selectedEmp.codigo_biometrico || selectedEmp.codigo || selectedEmp.id}
                                </span>
                            </div>
                            <div className="text-slate-500 font-medium truncate max-w-[200px]">
                                {selectedEmp.departamento || 'Sin Depto'}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Tipo de Marcación
                            </label>
                            <select
                                value={punchType}
                                onChange={(e) => setPunchType(e.target.value)}
                                className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white transition-all"
                            >
                                <option value="entrada">Entrada Normal</option>
                                <option value="salida">Salida Normal</option>
                                <option value="salida_almuerzo">Salida a Almuerzo</option>
                                <option value="entrada_almuerzo">Entrada de Almuerzo</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Fecha y Hora
                            </label>
                            <input
                                type="datetime-local"
                                required
                                value={punchTime}
                                onChange={(e) => setPunchTime(e.target.value)}
                                className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Motivo / Observaciones (Opcional)
                        </label>
                        <div className="relative">
                            <textarea
                                rows="3"
                                placeholder="Ej. Olvido de marcación en reloj físico, falla de energía o salida autorizada..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full text-[13px] font-medium border border-slate-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                            />
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
                                    <span>Registrando...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Registrar Marcación</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BiometricManualPunchModal;
