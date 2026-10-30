import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Users, Save, Printer, Loader2, UserCheck, Sparkles } from 'lucide-react';
import Modal from '../../ui/Modal';
import EmployeeSearchModal from '../EmployeeSearchModal';
import ContratoTrabajadorSection from './ContratoTrabajadorSection';
import ContratoSalarioHorarioSection from './ContratoSalarioHorarioSection';
import ContratoDependientesSection from './ContratoDependientesSection';
import {
    buildInitialContratoForm,
    mapEmployeeToContratoFields
} from './contratoConstants';

const ContratoLaboralModal = ({
    isOpen,
    onClose,
    selectedContrato = null,
    initialEmployee = null,
    onSuccess,
    onSuccessAndPrint,
    zIndex = 'z-50'
}) => {
    const queryClient = useQueryClient();
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [codigoInput, setCodigoInput] = useState('');
    const [selectedEmpInfo, setSelectedEmpInfo] = useState(null);
    const [printAfterSave, setPrintAfterSave] = useState(false);

    const { data: patronoDefaults = {} } = useQuery({
        queryKey: ['rh-contratos-patrono-defaults'],
        queryFn: async () => (await axios.get('/api/rh/contratos-laborales/patrono-defaults')).data,
        enabled: isOpen,
        staleTime: 60000
    });

    const [form, setForm] = useState(() => buildInitialContratoForm(null, {}));

    useEffect(() => {
        if (!isOpen) return;
        if (selectedContrato) {
            setForm(buildInitialContratoForm(selectedContrato, patronoDefaults));
            setCodigoInput(selectedContrato.empleado_codigo || '');
            setSelectedEmpInfo(
                selectedContrato.empleado_id
                    ? {
                        id: selectedContrato.empleado_id,
                        codigo: selectedContrato.empleado_codigo,
                        nombres: selectedContrato.empleado_nombres || selectedContrato.trabajador_nombre,
                        apellidos: selectedContrato.empleado_apellidos || ''
                    }
                    : null
            );
        } else {
            let base = buildInitialContratoForm(null, patronoDefaults);
            if (initialEmployee) {
                base = mapEmployeeToContratoFields(initialEmployee, base);
                setCodigoInput(initialEmployee.codigo || '');
                setSelectedEmpInfo(initialEmployee);
            } else {
                setCodigoInput('');
                setSelectedEmpInfo(null);
            }
            setForm(base);
        }
    }, [isOpen, selectedContrato, initialEmployee, patronoDefaults]);

    // Global F3 shortcut to open Employee Search Modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setIsEmpModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleSelectEmployee = (emp) => {
        setSelectedEmpInfo(emp);
        setCodigoInput(emp.codigo || '');
        setForm((prev) => mapEmployeeToContratoFields(emp, prev));
        setIsEmpModalOpen(false);
        toast.success(`Datos cargados de ${emp.nombres} ${emp.apellidos}`);
    };

    const handleSearchByCodigo = async () => {
        if (!codigoInput.trim()) return;
        try {
            const res = await axios.get('/api/rh/empleados', {
                params: { search: codigoInput.trim(), limit: 1 }
            });
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            const emp = list[0];
            if (emp) {
                handleSelectEmployee(emp);
            } else {
                toast.error('No se encontró empleado con ese código o nombre');
            }
        } catch {
            toast.error('Error al buscar empleado');
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            if (selectedContrato?.id) {
                const res = await axios.put(`/api/rh/contratos-laborales/${selectedContrato.id}`, payload);
                return { ...res.data, id: selectedContrato.id, codigo: selectedContrato.codigo };
            }
            const res = await axios.post('/api/rh/contratos-laborales', payload);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['rh-contratos-laborales'] });
            toast.success(
                selectedContrato
                    ? 'Contrato laboral actualizado correctamente'
                    : `Contrato laboral ${data.codigo || ''} creado exitosamente`
            );
            if (onSuccess) onSuccess(data);
            if (printAfterSave && onSuccessAndPrint) {
                onSuccessAndPrint({
                    id: data.id,
                    codigo: data.codigo || selectedContrato?.codigo || 'CT',
                    trabajador_nombre: form.trabajador_nombre
                });
            }
            setPrintAfterSave(false);
            onClose();
        },
        onError: (err) => {
            setPrintAfterSave(false);
            toast.error(err.response?.data?.message || 'Error al guardar el contrato laboral');
        }
    });

    const handleSubmit = (shouldPrint = false) => {
        if (!form.trabajador_nombre?.trim()) {
            toast.error('El nombre del trabajador es obligatorio');
            return;
        }
        if (!form.cargo_laboral?.trim()) {
            toast.error('El cargo laboral es obligatorio');
            return;
        }
        if (!form.lugar_trabajo?.trim()) {
            toast.error('El lugar de trabajo es obligatorio');
            return;
        }
        if (!form.fecha_inicio) {
            toast.error('La fecha de inicio es obligatoria');
            return;
        }
        if (!form.fecha_creacion) {
            toast.error('La fecha de creación es obligatoria');
            return;
        }

        setPrintAfterSave(shouldPrint);
        saveMutation.mutate(form);
    };

    if (!isOpen) return null;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={
                    selectedContrato
                        ? `Editar Contrato Individual de Trabajo (${selectedContrato.codigo})`
                        : 'Formato de Contrato Individual de Trabajo'
                }
                maxWidth="max-w-6xl"
                zIndex={zIndex}
            >
                <div className="space-y-4">
                    {/* Top Employee Auto-Fill Bar */}
                    <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                <Sparkles size={17} />
                            </div>
                            <div>
                                <div className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                                    <span>Autocompletar desde Ficha de Empleado</span>
                                    {selectedEmpInfo && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            <UserCheck size={11} /> Vinculado: #{selectedEmpInfo.codigo || selectedEmpInfo.id}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    Seleccione un empleado existente (F3) para cargar sus datos automáticamente o edite cualquier campo manualmente.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 sm:w-44">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={codigoInput}
                                    onChange={(e) => setCodigoInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSearchByCodigo();
                                        }
                                    }}
                                    placeholder="Código o nombre + Enter"
                                    className="w-full pl-8 pr-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEmpModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0"
                            >
                                <Users size={15} />
                                <span>Buscar Empleado (F3)</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Two-Column Contract Form matching Reference Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        <div className="lg:col-span-7">
                            <ContratoTrabajadorSection form={form} onChange={setForm} />
                        </div>
                        <div className="lg:col-span-5">
                            <ContratoSalarioHorarioSection form={form} onChange={setForm} />
                        </div>
                    </div>

                    {/* Bottom Dependents Table (Section G) */}
                    <ContratoDependientesSection
                        dependientes={form.dependientes}
                        trabajadorDireccion={form.direccion}
                        onChange={(deps) => setForm({ ...form, dependientes: deps })}
                    />

                    {/* Modal Footer Actions */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
                        >
                            Cancelar
                        </button>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <button
                                type="button"
                                disabled={saveMutation.isPending}
                                onClick={() => handleSubmit(false)}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all disabled:opacity-50"
                            >
                                {saveMutation.isPending && !printAfterSave ? (
                                    <Loader2 size={15} className="animate-spin" />
                                ) : (
                                    <Save size={15} />
                                )}
                                <span>{selectedContrato ? 'Guardar Cambios' : 'Guardar Contrato'}</span>
                            </button>

                            <button
                                type="button"
                                disabled={saveMutation.isPending}
                                onClick={() => handleSubmit(true)}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                            >
                                {saveMutation.isPending && printAfterSave ? (
                                    <Loader2 size={15} className="animate-spin" />
                                ) : (
                                    <Printer size={15} />
                                )}
                                <span>Guardar y Ver Formato PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            </Modal>

            <EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
                showSalary={true}
            />
        </>
    );
};

export default ContratoLaboralModal;

