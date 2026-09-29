import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Sliders, Clock, Users, Calendar, Link2, X, UserCheck
} from 'lucide-react';
import { unwrapList } from '../../utils/apiUtils';
import {
    BiometricShiftsTab,
    BiometricEmployeeShiftsTab,
    BiometricOvertimeTab,
    BiometricHolidaysTab,
    BiometricPayrollTab
} from './tabs';

const BiometricConfigModal = ({ open, onClose }) => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('turnos');

    const [form, setForm] = useState({
        hora_entrada: '08:00',
        hora_salida: '17:00',
        hora_inicio_almuerzo: '12:00',
        hora_fin_almuerzo: '13:00',
        tolerancia_entrada_minutos: 15,
        tolerancia_salida_temprana_minutos: 10,
        ventana_entrada_inicio: '05:00',
        ventana_entrada_fin: '11:00',
        ventana_almuerzo_inicio: '11:00',
        ventana_almuerzo_fin: '14:30',
        ventana_salida_inicio: '15:00',
        ventana_salida_fin: '23:59',
        modo_clasificacion: 'hibrido',
        pais_festivos: 'SV',
        vincular_con_planilla: 0,
        calcular_horas_extra: 1,
        horas_jornada_diaria: 8.00
    });

    const [empSearch, setEmpSearch] = useState('');
    const [shiftEmpSearch, setShiftEmpSearch] = useState('');
    const [selectedShiftFilter, setSelectedShiftFilter] = useState('todos');

    const { data: settingsData } = useQuery({
        queryKey: ['rh-biometric-settings'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/settings');
            return res.data?.data || null;
        },
        enabled: open
    });

    // Fetch shifts
    const { data: rawShifts = [], refetch: refetchShifts } = useQuery({
        queryKey: ['rh-biometric-shifts'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/shifts');
            return unwrapList(res);
        },
        enabled: open
    });

    // Fetch employee shift assignments
    const { data: rawEmpShifts = [], refetch: refetchEmpShifts } = useQuery({
        queryKey: ['rh-biometric-employee-shifts'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/employee-shifts');
            return unwrapList(res);
        },
        enabled: open && activeTab === 'horarios_empleados'
    });

    // Fetch overtime employees
    const { data: rawEmployees = [], refetch: refetchEmployees } = useQuery({
        queryKey: ['rh-biometric-overtime-employees'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/overtime-employees');
            return unwrapList(res);
        },
        enabled: open && activeTab === 'horas_extras'
    });

    // Fetch holidays
    const { data: rawHolidays = [], refetch: refetchHolidays } = useQuery({
        queryKey: ['rh-biometric-holidays', form.pais_festivos],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/holidays', {
                params: { pais: form.pais_festivos }
            });
            return unwrapList(res);
        },
        enabled: open && activeTab === 'festivos'
    });

    const shifts = Array.isArray(rawShifts) ? rawShifts : [];
    const empShifts = Array.isArray(rawEmpShifts) ? rawEmpShifts : [];
    const employees = Array.isArray(rawEmployees) ? rawEmployees : [];
    const holidays = Array.isArray(rawHolidays) ? rawHolidays : [];

    useEffect(() => {
        if (settingsData) {
            setForm(prev => ({
                ...prev,
                ...settingsData,
                hora_entrada: (settingsData.hora_entrada || '08:00:00').slice(0, 5),
                hora_salida: (settingsData.hora_salida || '17:00:00').slice(0, 5),
                hora_inicio_almuerzo: (settingsData.hora_inicio_almuerzo || '12:00:00').slice(0, 5),
                hora_fin_almuerzo: (settingsData.hora_fin_almuerzo || '13:00:00').slice(0, 5),
                ventana_entrada_inicio: (settingsData.ventana_entrada_inicio || '05:00:00').slice(0, 5),
                ventana_entrada_fin: (settingsData.ventana_entrada_fin || '11:00:00').slice(0, 5),
                ventana_almuerzo_inicio: (settingsData.ventana_almuerzo_inicio || '11:00:00').slice(0, 5),
                ventana_almuerzo_fin: (settingsData.ventana_almuerzo_fin || '14:30:00').slice(0, 5),
                ventana_salida_inicio: (settingsData.ventana_salida_inicio || '15:00:00').slice(0, 5),
                ventana_salida_fin: (settingsData.ventana_salida_fin || '23:59:59').slice(0, 5),
                vincular_con_planilla: settingsData.vincular_con_planilla ? 1 : 0
            }));
        }
    }, [settingsData]);

    const saveSettingsMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/rh/biometric/settings', payload);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Configuración general guardada exitosamente.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-settings'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar configuración');
        }
    });

    const saveShiftMutation = useMutation({
        mutationFn: async (shiftData) => {
            const res = await axios.post('/api/rh/biometric/shifts', shiftData);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Turno guardado con éxito.');
            refetchShifts();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar turno');
        }
    });

    const deleteShiftMutation = useMutation({
        mutationFn: async (shiftId) => {
            const res = await axios.delete(`/api/rh/biometric/shifts/${shiftId}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Turno eliminado correctamente.');
            refetchShifts();
            refetchEmpShifts();
        }
    });

    const assignShiftMutation = useMutation({
        mutationFn: async ({ empId, turnoId }) => {
            const res = await axios.post(`/api/rh/biometric/employee-shifts/${empId}`, { turnoId });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Horario asignado al colaborador.');
            refetchEmpShifts();
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance'] });
        }
    });

    const reclassifyMutation = useMutation({
        mutationFn: async () => {
            const res = await axios.post('/api/rh/biometric/reclassify', {});
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(data?.message || 'Marcaciones reclasificadas con éxito.');
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al reclasificar marcaciones');
        }
    });

    const toggleExemptMutation = useMutation({
        mutationFn: async ({ empId, exento }) => {
            const res = await axios.post(`/api/rh/biometric/overtime-employees/${empId}`, { exento });
            return res.data;
        },
        onSuccess: () => {
            refetchEmployees();
        }
    });

    const toggleHolidayMutation = useMutation({
        mutationFn: async ({ id, is_active }) => {
            const res = await axios.post(`/api/rh/biometric/holidays/${id}/toggle`, { is_active });
            return res.data;
        },
        onSuccess: () => {
            refetchHolidays();
        }
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                            <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Configuración de Marcador Biométrico
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Parametrización de turnos, horarios diferenciados, tolerancias y festivos
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

                {/* Tabs Bar */}
                <div className="flex border-b border-slate-200 px-6 bg-slate-50/50 gap-2 overflow-x-auto">
                    {[
                        { id: 'turnos', label: 'Turnos y Horarios', icon: Clock },
                        { id: 'horarios_empleados', label: 'Horarios por Empleado', icon: UserCheck },
                        { id: 'horas_extras', label: 'Exención Horas Extra', icon: Users },
                        { id: 'festivos', label: 'Días Festivos', icon: Calendar },
                        { id: 'planilla', label: 'Vinculación Planilla', icon: Link2 }
                    ].map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                                    active
                                        ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'turnos' && (
                        <BiometricShiftsTab
                            form={form}
                            setForm={setForm}
                            shifts={shifts}
                            onSaveShift={(data) => saveShiftMutation.mutate(data)}
                            onDeleteShift={(id) => deleteShiftMutation.mutate(id)}
                            onSave={(e) => { e.preventDefault(); saveSettingsMutation.mutate(form); }}
                            isSaving={saveSettingsMutation.isPending}
                            onReclassify={() => reclassifyMutation.mutate()}
                            isReclassifying={reclassifyMutation.isPending}
                        />
                    )}

                    {activeTab === 'horarios_empleados' && (
                        <BiometricEmployeeShiftsTab
                            employees={empShifts}
                            shifts={shifts}
                            empSearch={shiftEmpSearch}
                            setEmpSearch={setShiftEmpSearch}
                            selectedShiftFilter={selectedShiftFilter}
                            setSelectedShiftFilter={setSelectedShiftFilter}
                            onAssignShift={(empId, turnoId) => assignShiftMutation.mutate({ empId, turnoId })}
                        />
                    )}

                    {activeTab === 'horas_extras' && (
                        <BiometricOvertimeTab
                            employees={employees}
                            empSearch={empSearch}
                            setEmpSearch={setEmpSearch}
                            onToggleExempt={(empId, exento) => toggleExemptMutation.mutate({ empId, exento })}
                        />
                    )}

                    {activeTab === 'festivos' && (
                        <BiometricHolidaysTab
                            holidays={holidays}
                            selectedCountry={form.pais_festivos}
                            onCountryChange={(country) => {
                                setForm(prev => ({ ...prev, pais_festivos: country }));
                                saveSettingsMutation.mutate({ ...form, pais_festivos: country });
                            }}
                            onToggleHoliday={(id, is_active) => toggleHolidayMutation.mutate({ id, is_active })}
                        />
                    )}

                    {activeTab === 'planilla' && (
                        <BiometricPayrollTab
                            vincularConPlanilla={form.vincular_con_planilla}
                            onTogglePayrollLink={(val) => {
                                setForm(prev => ({ ...prev, vincular_con_planilla: val }));
                                saveSettingsMutation.mutate({ ...form, vincular_con_planilla: val });
                            }}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BiometricConfigModal;
