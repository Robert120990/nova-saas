import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { unwrapList } from '../utils/apiUtils';
import { useRhPayrollRequest } from './useRhPayrollRequest';

const yearNow = new Date().getFullYear();
// A partir de 2027 es obligatorio, pero permitimos 2026 en adelante
const defaultYear = yearNow >= 2027 ? yearNow : 2027;
const availableYears = [2026, 2027, 2028, 2029, 2030, 2031];

export const useQuincena25 = (companyId) => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();

    // Filtros principales
    const [selectedYear, setSelectedYear] = useState(defaultYear);
    const [selectedDepto, setSelectedDepto] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [tabActiva, setTabActiva] = useState('gestion'); // 'gestion' | 'historial'

    // Datos calculados / en edición
    const [itemsCalculados, setItemsCalculados] = useState(null);
    const [draftContext, setDraftContext] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const context = JSON.stringify([companyId, selectedYear, selectedDepto, selectedBranch]);
    const requestScope = useRhPayrollRequest(context);
    const hasCurrentDraft = itemsCalculados !== null && draftContext === context;
    const headers = { 'x-company-id': companyId };

    // Modal de Reportes (Planilla y Recibos PDF)
    const [previewPeriodo, setPreviewPeriodo] = useState(null);

    // 1. Obtener Departamentos y Sucursales para los filtros
    const { data: departamentos = [] } = useQuery({
        queryKey: ['rh-departamentos-all', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/rh/departamentos', { params: { limit: 5000 }, headers, signal })),
        enabled: !!companyId
    });

    const { data: branchesResp = [] } = useQuery({
        queryKey: ['branches-all', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/branches', { headers, signal })),
        enabled: !!companyId
    });
    const branches = Array.isArray(branchesResp) ? branchesResp : [];

    // 2. Obtener Historial de Resumen por Año
    const { data: resumen = [], isLoading: isLoadingResumen } = useQuery({
        queryKey: ['rh-quincena25-resumen', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/rh/planilla-quincena25/resumen', { headers, signal })),
        enabled: !!companyId,
        staleTime: 0
    });

    // 3. Obtener Planilla Guardada para el Año Seleccionado
    const { data: planillaGuardada = [], isLoading: isLoadingPlanilla } = useQuery({
        queryKey: ['rh-quincena25-periodo', companyId, selectedYear, selectedDepto, selectedBranch],
        queryFn: async ({ signal }) => {
            const params = { año: selectedYear };
            if (selectedDepto !== 'all') params.departamento_id = selectedDepto;
            if (selectedBranch !== 'all') params.branch_id = selectedBranch;
            return unwrapList(await axios.get('/api/rh/planilla-quincena25', { params, headers, signal }));
        },
        enabled: !!companyId,
        staleTime: 0
    });

    // Si ya existe planilla guardada y no estamos en modo simulación manual, usamos los datos guardados
    const itemsActuales = useMemo(() => {
        if (hasCurrentDraft) return itemsCalculados;
        return planillaGuardada;
    }, [itemsCalculados, planillaGuardada, hasCurrentDraft]);

    // Estado del período actual
    const estadoPeriodo = useMemo(() => {
        if (!planillaGuardada.length) return 'no_generada';
        return planillaGuardada[0]?.estado || 'borrador';
    }, [planillaGuardada]);

    const esPagada = estadoPeriodo === 'pagada';
    const fechaPago = planillaGuardada[0]?.fecha_pago;

    // Métricas para las tarjetas de resumen
    const metricas = useMemo(() => {
        const list = itemsActuales || [];
        const total = list.reduce((s, r) => s + parseFloat(r.monto_recibir || 0), 0);
        const elegibles = list.filter(r => parseFloat(r.sueldo_base || 0) <= 1500.00);
        const excluidos = list.filter(r => parseFloat(r.sueldo_base || 0) > 1500.00);
        const conPago = list.filter(r => parseFloat(r.monto_recibir || 0) > 0);
        const proporcionales = list.filter(r => r.es_proporcional && parseFloat(r.monto_recibir || 0) > 0);

        return {
            totalMonto: total,
            totalEmpleados: list.length,
            totalElegibles: elegibles.length,
            totalExcluidos: excluidos.length,
            totalConPago: conPago.length,
            totalProporcionales: proporcionales.length
        };
    }, [itemsActuales]);

    // Items filtrados por búsqueda de texto
    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return itemsActuales;
        const q = searchTerm.toLowerCase().trim();
        return itemsActuales.filter(r => 
            (r.codigo || '').toLowerCase().includes(q) ||
            (r.nombres || '').toLowerCase().includes(q) ||
            (r.apellidos || '').toLowerCase().includes(q) ||
            (r.cargo_nombre || '').toLowerCase().includes(q) ||
            (r.departamento_nombre || '').toLowerCase().includes(q)
        );
    }, [itemsActuales, searchTerm]);

    // Mutación: Calcular automáticamente
    const handleCalcular = async () => {
        if (contextBusy || esPagada) return;
        const request = requestScope.begin();
        setIsCalculating(true);
        try {
            const params = { año: selectedYear };
            if (selectedDepto !== 'all') params.departamento_id = selectedDepto;
            if (selectedBranch !== 'all') params.branch_id = selectedBranch;
            const res = await axios.get('/api/rh/planilla-quincena25/calcular', { params, headers, signal: request.signal });
            if (!request.isCurrent()) return;
            setItemsCalculados(unwrapList(res));
            setDraftContext(context);
            toast.success(`Cálculo de Quincena 25 para ${selectedYear} generado con éxito`);
        } catch (error) {
            if (request.isCurrent()) toast.error(error.response?.data?.message || 'Error al calcular Quincena 25');
        } finally {
            if (request.isCurrent()) setIsCalculating(false);
        }
    };

    // Mutación: Guardar Planilla
    const saveMutation = useMutation({
        mutationFn: (data) => axios.post('/api/rh/planilla-quincena25', data, { headers }),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo', companyId] }),
                queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen', companyId] })
            ]);
            setItemsCalculados(null);
            setDraftContext(null);
            toast.success('Planilla 25 guardada exitosamente');
        },
        onError: (err) => {
            if (err?.response?.status === 404) {
                toast.error('El período o registro de Quincena 25 ya no existe o fue eliminado');
            } else {
                toast.error(err?.response?.data?.message || 'Error al guardar planilla');
            }
        }
    });

    const handleGuardar = () => {
        if (contextBusy || esPagada || !hasCurrentDraft) return toast.error('Calcule o edite la planilla actual antes de guardar');
        if (!itemsActuales.length) return toast.error('No hay registros para guardar');
        saveMutation.mutate({
            año: selectedYear,
            items: itemsActuales,
            filtro_departamento_id: selectedDepto !== 'all' ? parseInt(selectedDepto) : null,
            estado: estadoPeriodo === 'pagada' ? 'pagada' : 'borrador'
        });
    };

    // Mutación: Cerrar Período (Marcar Pagada)
    const cerrarMutation = useMutation({
        mutationFn: (año) => axios.post('/api/rh/planilla-quincena25/cerrar-periodo', { año }, { headers }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo'] });
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen'] });
            toast.success(res.data.message);
        },
        onError: (err) => {
            if (err?.response?.status === 404) {
                toast.error('El período que intenta cerrar ya no existe o fue eliminado');
            } else {
                toast.error(err?.response?.data?.message || 'Error al cerrar período');
            }
        }
    });

    const handleCerrarPeriodo = async () => {
        if (contextBusy || hasCurrentDraft) return toast.error('Guarde los cambios antes de cerrar el período');
        const request = requestScope.begin();
        const ok = await confirm({
            title: '¿Cerrar y marcar como pagada la Planilla 25?',
            message: `Se marcará como pagada la Quincena 25 del ejercicio fiscal ${selectedYear}. Esta acción consolidará el período y registrará la fecha de dispersión. ¿Desea continuar?`,
            confirmLabel: 'Sí, cerrar período',
            variant: 'primary'
        });
        if (ok && request.isCurrent()) cerrarMutation.mutate(selectedYear);
    };

    // Mutación: Reabrir Período
    const reabrirMutation = useMutation({
        mutationFn: (año) => axios.post('/api/rh/planilla-quincena25/reabrir-periodo', { año }, { headers }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo'] });
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen'] });
            toast.success(res.data.message);
        },
        onError: (err) => {
            if (err?.response?.status === 404) {
                toast.error('El período que intenta reabrir ya no existe o fue eliminado');
            } else {
                toast.error(err?.response?.data?.message || 'Error al reabrir período');
            }
        }
    });

    const handleReabrirPeriodo = async () => {
        if (contextBusy) return;
        const request = requestScope.begin();
        const ok = await confirm({
            title: '¿Reabrir período a borrador?',
            message: `El período ${selectedYear} volverá al estado borrador para permitir modificaciones. ¿Confirmar?`,
            confirmLabel: 'Sí, reabrir',
            variant: 'warning'
        });
        if (ok && request.isCurrent()) reabrirMutation.mutate(selectedYear);
    };

    // Mutación: Eliminar Período
    const deleteMutation = useMutation({
        mutationFn: ({ año, departamento_id }) => {
            const params = { año };
            if (departamento_id && departamento_id !== 'all') params.departamento_id = departamento_id;
            return axios.delete('/api/rh/planilla-quincena25/periodo', { params, headers });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-periodo'] });
            queryClient.invalidateQueries({ queryKey: ['rh-quincena25-resumen'] });
            setItemsCalculados(null);
            toast.success('Registros eliminados con éxito');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar período')
    });

    const handleEliminarPeriodo = async () => {
        if (contextBusy || esPagada) return;
        if (selectedBranch !== 'all') return toast.error('Seleccione todas las sucursales antes de eliminar un período');
        const request = requestScope.begin();
        const ok = await confirm({
            title: '¿Eliminar registros de Quincena 25?',
            message: `Se eliminarán los registros calculados para el ejercicio ${selectedYear}. Esta acción no se puede deshacer. ¿Desea continuar?`,
            confirmLabel: 'Sí, eliminar',
            variant: 'danger'
        });
        if (ok && request.isCurrent()) deleteMutation.mutate({ año: selectedYear, departamento_id: selectedDepto });
    };

    // Edición en caliente de ajustes y observaciones
    const handleUpdateItem = (empId, field, val) => {
        if (contextBusy || esPagada) return;
        const updater = (prevList) => prevList.map(item => {
            if (item.empleado_id !== empId) return item;
            const updated = { ...item, [field]: val };
            if (field === 'ajuste') {
                const montoQ25 = parseFloat(updated.monto_quincena25 || 0);
                const adj = parseFloat(val || 0);
                updated.monto_recibir = Math.round((montoQ25 + adj) * 100) / 100;
            }
            return updated;
        });

        setDraftContext(context);
        if (hasCurrentDraft) {
            setItemsCalculados(updater);
        } else {
            setItemsCalculados(updater(planillaGuardada));
        }
    };

    // Descarga de archivos bancarios
    const handleDownloadBanco = async (formato = 'ambos') => {
        try {
            const params = { año: selectedYear, formatoBancario: formato };
            if (selectedDepto !== 'all') params.departamento_id = selectedDepto;
            if (selectedBranch !== 'all') params.branch_id = selectedBranch;
            const res = await axios.get('/api/rh/planilla-quincena25/export-banco', { params, headers });
            const data = res.data;

            const triggerFile = (content, filename, mime) => {
                const blob = new Blob([content], { type: mime });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            };

            if (formato === 'csv' || formato === 'ambos') {
                triggerFile(data.csv, `${data.filename}.csv`, 'text/csv;charset=utf-8');
            }
            if (formato === 'txt' || formato === 'ambos') {
                setTimeout(() => {
                    triggerFile(data.txt, `${data.filename}.txt`, 'text/plain;charset=utf-8');
                }, 200);
            }
            toast.success('Archivo(s) bancario(s) descargado(s) exitosamente');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al exportar archivo bancario');
        }
    };

    // Descarga de Anexo F-14 para Hacienda
    const handleDownloadHaciendaF14 = async () => {
        try {
            const res = await axios.get('/api/rh/planilla-quincena25/export-hacienda', {
                params: { año: selectedYear },
                headers,
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `ANEXO_F14_QUINCENA25_${selectedYear}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            toast.success('Anexo F-14 de Quincena 25 descargado');
        } catch (error) {
            toast.error('Error al generar Anexo F-14 para Hacienda');
        }
    };

    const contextBusy = isCalculating || saveMutation.isPending || cerrarMutation.isPending || reabrirMutation.isPending || deleteMutation.isPending || isLoadingPlanilla;
    const resetDraft = () => { requestScope.cancel(); setItemsCalculados(null); setDraftContext(null); setIsCalculating(false); };
    const setFilter = (field, value) => {
        if (saveMutation.isPending || cerrarMutation.isPending || reabrirMutation.isPending || deleteMutation.isPending) return;
        resetDraft();
        if (field === 'year') setSelectedYear(value);
        if (field === 'department') setSelectedDepto(value);
        if (field === 'branch') setSelectedBranch(value);
    };
    const openHistory = (row) => {
        if (saveMutation.isPending) return;
        resetDraft();
        setSelectedYear(row.periodo_anio);
        setSelectedDepto(row.filtro_departamento_id ? String(row.filtro_departamento_id) : 'all');
        setSelectedBranch('all');
        setSearchTerm('');
        setTabActiva('gestion');
    };

    return { selectedYear, selectedDepto, selectedBranch, searchTerm, setSearchTerm, tabActiva, setTabActiva, isCalculating, previewPeriodo, setPreviewPeriodo, departamentos, branches, resumen, isLoadingResumen, isLoadingPlanilla, itemsActuales, esPagada, fechaPago, metricas, filteredItems, handleCalcular, saveMutation, handleGuardar, handleCerrarPeriodo, handleReabrirPeriodo, handleEliminarPeriodo, handleUpdateItem, handleDownloadBanco, handleDownloadHaciendaF14, availableYears, openHistory, hasCurrentDraft, contextBusy, setFilter };
};
