import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Calendar,
    Server,
    Clock,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Download,
    Eye,
    EyeOff,
    Check,
    Copy,
    ArrowRight,
    ShieldAlert,
    ExternalLink,
    FileText,
    Code,
    User,
    Building2,
    Tag,
    Plus,
    Trash2,
    Pencil,
    Search,
    RotateCcw
} from 'lucide-react';
import Money from '../components/ui/Money';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';

const FilproSync = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('sync'); // 'sync' | 'mappings' | 'config' | 'logs'

    // Form states for sync
    const todayStr = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [establishmentCode, setEstablishmentCode] = useState('');

    // Preview state
    const [previewData, setPreviewData] = useState(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [copiedUuid, setCopiedUuid] = useState(null);

    // Reversal confirmation states
    const [isRevertDayModalOpen, setIsRevertDayModalOpen] = useState(false);
    const [revertDteTarget, setRevertDteTarget] = useState(null);

    // Real-time Sync Progress Modal state
    const [syncProgress, setSyncProgress] = useState({
        isOpen: false,
        isStreaming: false,
        isCompleted: false,
        hasError: false,
        errorMessage: '',
        statusMessage: '',
        total: 0,
        current: 0,
        imported: 0,
        skipped: 0,
        errors: 0,
        pct: 0,
        logs: []
    });

    // Detail Modal state
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedDocSummary, setSelectedDocSummary] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [detailTab, setDetailTab] = useState('summary'); // 'summary' | 'json'
    const [copiedJson, setCopiedJson] = useState(false);

    // Form states for mappings
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [editingMapping, setEditingMapping] = useState(null);
    const [mappingForm, setMappingForm] = useState({
        filpro_code: '',
        filpro_description: '',
        product_id: '',
        product_label: ''
    });
    const [mappingSearch, setMappingSearch] = useState('');

    // Form states for configuration
    const [showPassword, setShowPassword] = useState(false);
    const [configForm, setConfigForm] = useState({
        portal_url: 'https://api-filpro-service.apiconsumofel.com/api',
        filpro_email: '',
        filpro_password: '',
        branch_id: '',
        filpro_company_id: '',
        filpro_establishment_code: '',
        auto_sync: false
    });
    const [testResult, setTestResult] = useState(null);

    // Fetch branches for branch selectors
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    // Set default branch when branches load
    useEffect(() => {
        if (branches.length > 0 && !selectedBranchId) {
            setSelectedBranchId(String(branches[0].id));
        }
    }, [branches, selectedBranchId]);

    // Fetch existing connection config
    const { data: connectionConfig, isLoading: isConfigLoading } = useQuery({
        queryKey: ['filpro_config'],
        queryFn: async () => (await axios.get('/api/filpro/config')).data
    });

    useEffect(() => {
        if (connectionConfig?.configured) {
            setConfigForm({
                portal_url: connectionConfig.portal_url || 'https://api-filpro-service.apiconsumofel.com/api',
                filpro_email: connectionConfig.filpro_email || '',
                filpro_password: connectionConfig.filpro_password || '',
                branch_id: connectionConfig.branch_id ? String(connectionConfig.branch_id) : '',
                filpro_company_id: connectionConfig.filpro_company_id ? String(connectionConfig.filpro_company_id) : '',
                filpro_establishment_code: connectionConfig.filpro_establishment_code || '',
                auto_sync: !!connectionConfig.auto_sync
            });
            if (connectionConfig.branch_id) setSelectedBranchId(String(connectionConfig.branch_id));
            if (connectionConfig.filpro_establishment_code) setEstablishmentCode(connectionConfig.filpro_establishment_code);
        }
    }, [connectionConfig]);

    // Fetch sync audit logs
    const { data: syncLogs = [] } = useQuery({
        queryKey: ['filpro_logs'],
        queryFn: async () => (await axios.get('/api/filpro/logs')).data,
        enabled: activeTab === 'logs'
    });

    // Fetch mappings
    const { data: mappings = [], isLoading: isMappingsLoading } = useQuery({
        queryKey: ['filpro_mappings'],
        queryFn: async () => (await axios.get('/api/filpro/mappings')).data,
        enabled: activeTab === 'mappings' || isMappingModalOpen
    });

    // Mutation: Save Mapping
    const saveMappingMutation = useMutation({
        mutationFn: (mappingData) => axios.post('/api/filpro/mappings', mappingData),
        onSuccess: () => {
            queryClient.invalidateQueries(['filpro_mappings']);
            toast.success('Mapeo de código guardado correctamente');
            setIsMappingModalOpen(false);
            setEditingMapping(null);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar mapeo de código');
        }
    });

    // Mutation: Delete Mapping
    const deleteMappingMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/filpro/mappings/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['filpro_mappings']);
            toast.success('Mapeo eliminado correctamente');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar mapeo');
        }
    });

    // Mutation: Save Connection
    const saveConfigMutation = useMutation({
        mutationFn: (formData) => axios.post('/api/filpro/config', formData),
        onSuccess: () => {
            queryClient.invalidateQueries(['filpro_config']);
            toast.success('Configuración de FilPro guardada exitosamente');
            setTestResult(null);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar configuración');
        }
    });

    // Mutation: Test Connection
    const testConnectionMutation = useMutation({
        mutationFn: (credentials) => axios.post('/api/filpro/test', credentials),
        onSuccess: (res) => {
            setTestResult({
                success: true,
                message: res.data.message || 'Conexión exitosa',
                establishments: res.data.establishments || [],
                filproCompanyId: res.data.filproCompanyId
            });
            toast.success('Conexión con FilPro validada correctamente');
            if (res.data.filproCompanyId && !configForm.filpro_company_id) {
                setConfigForm(prev => ({ ...prev, filpro_company_id: String(res.data.filproCompanyId) }));
            }
        },
        onError: (err) => {
            setTestResult({
                success: false,
                message: err.response?.data?.message || 'Error al conectar con FilPro'
            });
            toast.error(err.response?.data?.message || 'Fallo de autenticación en FilPro');
        }
    });

    // Mutation: Sync Day
    const syncDayMutation = useMutation({
        mutationFn: (syncPayload) => axios.post('/api/filpro/sync-day', syncPayload),
        onSuccess: (res) => {
            const { totalImported, totalSkipped, totalErrors } = res.data;
            toast.success(`Sincronización finalizada: ${totalImported} importados, ${totalSkipped} omitidos, ${totalErrors} errores`);
            queryClient.invalidateQueries(['filpro_logs']);
            // Refresh preview
            handlePreviewDay();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error durante la sincronización de DTEs');
        }
    });

    // Mutation: Revert Single DTE
    const revertDteMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/filpro/revert-dte', payload),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Venta revertida exitosamente');
            queryClient.invalidateQueries(['filpro_logs']);
            setRevertDteTarget(null);
            if (isDetailModalOpen) setIsDetailModalOpen(false);
            handlePreviewDay();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al revertir la venta');
        }
    });

    // Mutation: Revert Day Sync
    const revertDayMutation = useMutation({
        mutationFn: (payload) => axios.post('/api/filpro/revert-day', payload),
        onSuccess: (res) => {
            toast.success(res.data?.message || 'Sincronización del día revertida exitosamente');
            queryClient.invalidateQueries(['filpro_logs']);
            setIsRevertDayModalOpen(false);
            handlePreviewDay();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al revertir sincronización del día');
        }
    });

    const handlePreviewDay = async () => {
        if (!selectedDate) {
            toast.error('Seleccione una fecha');
            return;
        }

        setIsPreviewLoading(true);
        try {
            const res = await axios.post('/api/filpro/preview-day', {
                date: selectedDate,
                establishment_code: establishmentCode
            });
            setPreviewData(res.data);
            if (res.data.summary.totalFound === 0) {
                toast.info('No se encontraron DTEs emitidos en FilPro para esta fecha');
            } else {
                toast.success(`Se encontraron ${res.data.summary.totalFound} DTEs en FilPro`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al consultar documentos del día en FilPro');
            setPreviewData(null);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleExecuteSync = async () => {
        if (!selectedDate) {
            toast.error('Seleccione una fecha a sincronizar');
            return;
        }
        if (!selectedBranchId) {
            toast.error('Seleccione la sucursal de destino en Nova SaaS');
            return;
        }

        const totalExpected = previewData?.summary?.totalFound || 0;
        setSyncProgress({
            isOpen: true,
            isStreaming: true,
            isCompleted: false,
            hasError: false,
            errorMessage: '',
            statusMessage: 'Iniciando descarga concurrente con 8 hilos en paralelo...',
            total: totalExpected,
            current: 0,
            imported: 0,
            skipped: 0,
            errors: 0,
            pct: 0,
            logs: []
        });

        try {
            const token = localStorage.getItem('token');
            const userStr = localStorage.getItem('user');
            const userObj = userStr ? JSON.parse(userStr) : null;
            const companyId = userObj?.company_id;

            const response = await fetch('/api/filpro/sync-day-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...(companyId ? { 'x-company-id': String(companyId) } : {})
                },
                body: JSON.stringify({
                    date: selectedDate,
                    branch_id: parseInt(selectedBranchId, 10),
                    establishment_code: establishmentCode
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || `Error ${response.status}: No se pudo conectar al stream de sincronización`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data:')) continue;
                    const jsonStr = trimmed.replace(/^data:\s*/, '');
                    try {
                        const event = JSON.parse(jsonStr);

                        if (event.type === 'status') {
                            setSyncProgress(prev => ({
                                ...prev,
                                statusMessage: event.message
                            }));
                        } else if (event.type === 'start') {
                            setSyncProgress(prev => ({
                                ...prev,
                                total: event.total,
                                statusMessage: event.message
                            }));
                        } else if (event.type === 'progress') {
                            setSyncProgress(prev => {
                                const newLogs = event.item ? [event.item, ...prev.logs.slice(0, 49)] : prev.logs;
                                return {
                                    ...prev,
                                    current: event.current,
                                    total: event.total,
                                    imported: event.imported,
                                    skipped: event.skipped,
                                    errors: event.errors,
                                    pct: event.pct,
                                    statusMessage: `Procesando documento ${event.current} de ${event.total} (${event.pct}%)...`,
                                    logs: newLogs
                                };
                            });
                        } else if (event.type === 'complete') {
                            setSyncProgress(prev => ({
                                ...prev,
                                isStreaming: false,
                                isCompleted: true,
                                imported: event.totalImported,
                                skipped: event.totalSkipped,
                                errors: event.totalErrors,
                                pct: 100,
                                statusMessage: event.message || 'Sincronización completada con éxito.'
                            }));
                            toast.success(`Sincronización finalizada: ${event.totalImported} importados, ${event.totalSkipped} omitidos, ${event.totalErrors} errores`);
                            queryClient.invalidateQueries(['filpro_logs']);
                            handlePreviewDay();
                        } else if (event.type === 'error') {
                            setSyncProgress(prev => ({
                                ...prev,
                                isStreaming: false,
                                hasError: true,
                                errorMessage: event.message
                            }));
                            toast.error(event.message || 'Error durante la sincronización');
                        }
                    } catch (parseErr) {
                        console.error('Error parseando evento SSE:', parseErr);
                    }
                }
            }

        } catch (error) {
            console.error('Error en stream de sincronización:', error);
            setSyncProgress(prev => ({
                ...prev,
                isStreaming: false,
                hasError: true,
                errorMessage: error.message || 'Error de conexión con el servidor'
            }));
            toast.error(error.message || 'Error durante la sincronización');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedUuid(text);
        toast.success('Copiado al portapapeles');
        setTimeout(() => setCopiedUuid(null), 2000);
    };

    const handleOpenDetail = async (doc) => {
        setSelectedDocSummary(doc);
        setIsDetailModalOpen(true);
        setIsDetailLoading(true);
        setDetailData(null);
        setDetailTab('summary');

        try {
            const res = await axios.get(`/api/filpro/dte-detail/${doc.uuid}`);
            setDetailData(res.data);
        } catch (err) {
            console.error('Error fetching DTE detail:', err);
            toast.error(err.response?.data?.message || 'Error al obtener detalle del DTE');
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleCopyJson = () => {
        if (detailData?.dte) {
            navigator.clipboard.writeText(JSON.stringify(detailData.dte, null, 2));
            setCopiedJson(true);
            toast.success('JSON copiado al portapapeles');
            setTimeout(() => setCopiedJson(false), 2000);
        }
    };

    const handleOpenCreateMapping = (prefillCode = '', prefillDesc = '') => {
        setEditingMapping(null);
        setMappingForm({
            filpro_code: prefillCode,
            filpro_description: prefillDesc,
            product_id: '',
            product_label: ''
        });
        setIsMappingModalOpen(true);
    };

    const handleOpenEditMapping = (mapping) => {
        setEditingMapping(mapping);
        setMappingForm({
            id: mapping.id,
            filpro_code: mapping.filpro_code,
            filpro_description: mapping.filpro_description || '',
            product_id: String(mapping.product_id),
            product_label: `[${mapping.product_code}] ${mapping.product_name}`
        });
        setIsMappingModalOpen(true);
    };

    const loadProductOptions = useCallback(async (searchTerm, page = 1) => {
        const res = await axios.get('/api/products', {
            params: {
                search: searchTerm?.trim() || undefined,
                page,
                limit: 30,
                status: 'activo'
            }
        });
        return {
            data: res.data?.data || [],
            total: res.data?.total || 0,
            totalPages: res.data?.totalPages || 1
        };
    }, []);

    const handleSaveMapping = (e) => {
        e.preventDefault();
        if (!mappingForm.filpro_code.trim()) {
            toast.error('Ingrese el código de FilPro');
            return;
        }
        if (!mappingForm.product_id) {
            toast.error('Seleccione el producto correspondiente en el sistema');
            return;
        }

        saveMappingMutation.mutate({
            id: editingMapping?.id,
            filpro_code: mappingForm.filpro_code.trim(),
            filpro_description: mappingForm.filpro_description.trim(),
            product_id: parseInt(mappingForm.product_id, 10)
        });
    };

    const handleDeleteMapping = (id) => {
        if (window.confirm('¿Está seguro de eliminar este mapeo de código?')) {
            deleteMappingMutation.mutate(id);
        }
    };

    const getTipoDteBadge = (tipoDte, compact = true) => {
        switch (tipoDte) {
            case '01':
                return (
                    <span
                        className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200`}
                        title="Factura Consumidor Final (01)"
                    >
                        {compact ? 'FCF 01' : 'Factura (01)'}
                    </span>
                );
            case '03':
                return (
                    <span
                        className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200`}
                        title="Comprobante de Crédito Fiscal (03)"
                    >
                        {compact ? 'CCF 03' : 'Crédito Fiscal (03)'}
                    </span>
                );
            case '05':
                return (
                    <span
                        className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200`}
                        title="Nota de Crédito (05)"
                    >
                        {compact ? 'NC 05' : 'Nota de Crédito (05)'}
                    </span>
                );
            case '07':
                return (
                    <span
                        className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200`}
                        title="Comprobante de Retención (07)"
                    >
                        {compact ? 'CR 07' : 'Retención (07)'}
                    </span>
                );
            default:
                return (
                    <span
                        className={`${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} font-bold rounded-md bg-slate-50 text-slate-700 border border-slate-200`}
                        title={`DTE Tipo ${tipoDte}`}
                    >
                        DTE {tipoDte}
                    </span>
                );
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <RefreshCw className="w-6 h-6 animate-spin-reverse" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                                Sincronización con FilPro (Infile)
                            </h1>
                            <p className="text-xs text-slate-500">
                                Extracción e ingesta de Documentos Tributarios Electrónicos (DTEs) día por día a Nova SaaS
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => setActiveTab('sync')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                            activeTab === 'sync'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        <span>Sincronización Diaria</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('mappings')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                            activeTab === 'mappings'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Tag className="w-4 h-4" />
                        <span>Mapeo de Códigos</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                            activeTab === 'config'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Server className="w-4 h-4" />
                        <span>Credenciales</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                            activeTab === 'logs'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>Historial</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: Sincronización por Fecha */}
            {activeTab === 'sync' && (
                <div className="space-y-6">
                    {/* Unconfigured Alert Banner */}
                    {!isConfigLoading && !connectionConfig?.configured && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                            <div className="flex items-center gap-3">
                                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                                <div className="text-xs">
                                    <span className="font-semibold">Credenciales no configuradas:</span> Para consultar y sincronizar DTEs de FilPro, primero debe guardar las credenciales de acceso de su empresa.
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveTab('config')}
                                className="px-3.5 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors shrink-0"
                            >
                                Configurar Ahora
                            </button>
                        </div>
                    )}

                    {/* Controls Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Fecha */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                    Fecha a Consultar
                                </label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-full text-[13px] font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Sucursal Destino */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                    Sucursal Destino (Nova SaaS)
                                </label>
                                <select
                                    value={selectedBranchId}
                                    onChange={(e) => setSelectedBranchId(e.target.value)}
                                    className="w-full text-[13px] font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    {branches.map(branch => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.nombre} ({branch.codigo})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Código Establecimiento FilPro */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                    Establecimiento FilPro (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: S001 (vacío = todos)"
                                    value={establishmentCode}
                                    onChange={(e) => setEstablishmentCode(e.target.value)}
                                    className="w-full text-[13px] font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            {/* Botón Consultar */}
                            <div className="flex items-end">
                                <button
                                    onClick={handlePreviewDay}
                                    disabled={isPreviewLoading}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {isPreviewLoading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Consultando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="w-4 h-4" />
                                            <span>Consultar Día en FilPro</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Preview Summary Cards */}
                    {previewData && (
                        <div className="space-y-4">
                            <div className={`grid grid-cols-1 sm:grid-cols-2 ${previewData.summary.totalAnulados > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase">Total DTEs en FilPro</div>
                                    <div className="text-2xl font-bold text-slate-800 mt-1">
                                        {previewData.summary.totalFound}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">Emitidos en fecha {selectedDate}</div>
                                </div>

                                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-sm">
                                    <div className="text-[11px] font-bold text-emerald-700 uppercase">Por Importar (Nuevos)</div>
                                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                                        {previewData.summary.totalNew}
                                    </div>
                                    <div className="text-[11px] text-emerald-600 mt-0.5">No existen aún en Nova SaaS</div>
                                </div>

                                <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 shadow-sm">
                                    <div className="text-[11px] font-bold text-blue-700 uppercase">Ya en el Sistema</div>
                                    <div className="text-2xl font-bold text-blue-700 mt-1">
                                        {previewData.summary.totalAlreadyImported}
                                    </div>
                                    <div className="text-[11px] text-blue-600 mt-0.5">Se omitirán para evitar duplicados</div>
                                </div>

                                {previewData.summary.totalAnulados > 0 && (
                                    <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-sm">
                                        <div className="text-[11px] font-bold text-rose-700 uppercase">Anulados en FilPro</div>
                                        <div className="text-2xl font-bold text-rose-700 mt-1">
                                            {previewData.summary.totalAnulados}
                                        </div>
                                        <div className="text-[11px] text-rose-600 mt-0.5">Se omiten (no se importan)</div>
                                    </div>
                                )}

                                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 shadow-sm">
                                    <div className="text-[11px] font-bold text-indigo-700 uppercase">Monto Total del Día</div>
                                    <div className="text-2xl font-bold text-indigo-900 mt-1">
                                        <Money value={previewData.summary.totalAmount} />
                                    </div>
                                    <div className="text-[11px] text-indigo-600 mt-0.5">DTEs válidos (sin anulados)</div>
                                </div>
                            </div>

                            {/* Sincronizar Action Button */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-indigo-900 text-white rounded-2xl shadow-sm">
                                <div>
                                    <h3 className="text-sm font-bold">
                                        Listo para sincronizar {previewData.summary.totalNew} DTEs nuevos
                                    </h3>
                                    <p className="text-xs text-indigo-200 mt-0.5">
                                        Se descargarán los JSONs certificados e ingresarán a Ventas y DTEs sin afectar inventario (Kardex). Los anulados son omitidos.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                                    {previewData.summary.totalAlreadyImported > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsRevertDayModalOpen(true)}
                                            disabled={revertDayMutation.isPending}
                                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
                                            title="Elimina las ventas importadas de este día para poder volver a sincronizar"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            <span>Revertir Día ({previewData.summary.totalAlreadyImported})</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={handleExecuteSync}
                                        disabled={syncProgress.isStreaming || previewData.summary.totalNew === 0}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-sm"
                                    >
                                        {syncProgress.isStreaming ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                <span>Sincronizando ({syncProgress.pct}%)...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4" />
                                                <span>Sincronizar al Sistema Ahora</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Documents Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                            Detalle de Documentos Encontrados ({previewData.documents.length})
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            💡 Haga <span className="font-semibold text-indigo-600">doble clic en cualquier fila</span> para ver el desglose completo del DTE o el PDF oficial.
                                        </p>
                                    </div>
                                    {previewData.summary.totalAnulados > 0 && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span>{previewData.summary.totalAnulados} anulados excluidos de importación</span>
                                        </span>
                                    )}
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse table-auto">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap text-center w-14">Tipo</th>
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">N° Control</th>
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap" title="Código de Generación (UUID)">UUID</th>
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase">Receptor</th>
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase text-right whitespace-nowrap">Total</th>
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap" title="Estado en FilPro">FilPro</th>
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap" title="Estado en Nova SaaS">Sistema</th>
                                                <th className="py-2 px-2 text-[11px] font-bold text-slate-500 uppercase text-center whitespace-nowrap w-16">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-[13px]">
                                            {previewData.documents.map((doc, idx) => {
                                                const isAnulado = (doc.status === 'ANULADO' || doc.status === 'INVALIDADO');
                                                return (
                                                    <tr
                                                        key={idx}
                                                        onDoubleClick={() => handleOpenDetail(doc)}
                                                        className="hover:bg-indigo-50/50 cursor-pointer transition-colors select-none group"
                                                        title="Haga doble clic para ver el detalle del DTE"
                                                    >
                                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                                            {getTipoDteBadge(doc.tipo_dte, true)}
                                                        </td>
                                                        <td className="py-2 px-2 font-mono text-[11px] tracking-tight text-slate-800 whitespace-nowrap">
                                                            {doc.numero_control || '—'}
                                                        </td>
                                                        <td className="py-2 px-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                                            <div className="flex items-center gap-1">
                                                                <span title={doc.uuid}>{doc.uuid ? `${doc.uuid.substring(0, 8)}...` : '—'}</span>
                                                                {doc.uuid && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            copyToClipboard(doc.uuid);
                                                                        }}
                                                                        className="p-0.5 text-slate-400 hover:text-indigo-600 transition-colors rounded"
                                                                        title="Copiar UUID completo"
                                                                    >
                                                                        {copiedUuid === doc.uuid ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-2 text-xs text-slate-700 max-w-[130px] lg:max-w-[160px] truncate" title={doc.nombre_receptor || 'Consumidor Final'}>
                                                            {doc.nombre_receptor || 'Consumidor Final'}
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-bold text-xs text-slate-900 whitespace-nowrap">
                                                            <Money value={doc.monto_total} />
                                                        </td>
                                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                                                isAnulado
                                                                    ? 'bg-rose-100 text-rose-700'
                                                                    : 'bg-emerald-100 text-emerald-700'
                                                            }`}>
                                                                {doc.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                                            {doc.is_already_imported ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    <span>Importado {doc.local_sale_id ? `#${doc.local_sale_id}` : ''}</span>
                                                                </span>
                                                            ) : isAnulado ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-rose-50 text-rose-700 border border-rose-200">
                                                                    <AlertCircle className="w-3 h-3" />
                                                                    <span>Anulado</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <ArrowRight className="w-3 h-3" />
                                                                    <span>Pendiente</span>
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-2 text-center whitespace-nowrap w-16">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenDetail(doc);
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                                    title="Ver detalle completo del DTE"
                                                                >
                                                                    <Eye className="w-3.5 h-3.5" />
                                                                </button>
                                                                {doc.is_already_imported && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setRevertDteTarget({
                                                                                uuid: doc.uuid,
                                                                                sale_id: doc.local_sale_id,
                                                                                numero_control: doc.numero_control,
                                                                                receptor: doc.nombre_receptor,
                                                                                total: doc.monto_total
                                                                            });
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                        title="Revertir y eliminar esta venta de Nova SaaS"
                                                                    >
                                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Mapeo de Códigos */}
            {activeTab === 'mappings' && (
                <div className="space-y-6">
                    {/* Header Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">
                                Mapeo de Códigos FilPro a Productos del Sistema
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Asocie los códigos de ítems emitidos por FilPro (ej: <span className="font-mono font-semibold text-slate-700">071228</span>) con el producto correspondiente en su catálogo de Nova SaaS.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleOpenCreateMapping()}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nuevo Mapeo</span>
                        </button>
                    </div>

                    {/* Table Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Códigos Configurados ({mappings.length})
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Buscar código o producto..."
                                    value={mappingSearch}
                                    onChange={(e) => setMappingSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                                        <th className="py-2.5 px-4">Código FilPro</th>
                                        <th className="py-2.5 px-4">Descripción en FilPro (Referencial)</th>
                                        <th className="py-2.5 px-4">Código en Sistema</th>
                                        <th className="py-2.5 px-4">Producto en Nova SaaS</th>
                                        <th className="py-2.5 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[13px]">
                                    {isMappingsLoading ? (
                                        <tr>
                                            <td colSpan="5" className="py-12 text-center text-xs text-slate-400">
                                                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                                                <span>Cargando mapeos de códigos...</span>
                                            </td>
                                        </tr>
                                    ) : mappings.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-12 text-center text-xs text-slate-400">
                                                <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                <p className="font-semibold text-slate-600">No hay mapeos de códigos registrados aún.</p>
                                                <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                                                    Los ítems no mapeados se ingresarán con el producto comodín conservando su descripción original de FilPro.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenCreateMapping()}
                                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Agregar primer mapeo</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        mappings
                                            .filter(m => {
                                                if (!mappingSearch.trim()) return true;
                                                const s = mappingSearch.toLowerCase();
                                                return (
                                                    m.filpro_code?.toLowerCase().includes(s) ||
                                                    m.filpro_description?.toLowerCase().includes(s) ||
                                                    m.product_code?.toLowerCase().includes(s) ||
                                                    m.product_name?.toLowerCase().includes(s)
                                                );
                                            })
                                            .map((m) => (
                                                <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="py-2.5 px-4 whitespace-nowrap">
                                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                                            {m.filpro_code}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-slate-600 font-medium max-w-[240px] truncate">
                                                        {m.filpro_description || <span className="text-slate-400 italic">Sin descripción</span>}
                                                    </td>
                                                    <td className="py-2.5 px-4 whitespace-nowrap">
                                                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                            {m.product_code || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-slate-800 font-semibold max-w-[280px] truncate">
                                                        {m.product_name}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditMapping(m)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                                title="Editar mapeo"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteMapping(m.id)}
                                                                disabled={deleteMappingMutation.isPending}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                title="Eliminar mapeo"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Configuración de Credenciales */}
            {activeTab === 'config' && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">
                            Configuración de Conexión Multi-Empresa
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Las credenciales se almacenan encriptadas y vinculadas exclusivamente a su empresa activa en Nova SaaS.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* URL Base */}
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                URL Base del Servicio FilPro
                            </label>
                            <input
                                type="text"
                                value={configForm.portal_url}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, portal_url: e.target.value }))}
                                className="w-full text-[13px] font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                Usuario / Correo de FilPro
                            </label>
                            <input
                                type="email"
                                placeholder="ejemplo@sipesv.com"
                                value={configForm.filpro_email}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, filpro_email: e.target.value }))}
                                className="w-full text-[13px] font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>

                        {/* Contraseña */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                Contraseña de FilPro
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={connectionConfig?.configured ? '•••••••• (guardada, dejar en blanco para no cambiar)' : 'Contraseña de FilPro'}
                                    value={configForm.filpro_password}
                                    onChange={(e) => setConfigForm(prev => ({ ...prev, filpro_password: e.target.value }))}
                                    className="w-full text-[13px] font-medium px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Sucursal por defecto */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                Sucursal por Defecto en Nova SaaS
                            </label>
                            <select
                                value={configForm.branch_id}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, branch_id: e.target.value }))}
                                className="w-full text-[13px] font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="">Seleccione sucursal...</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.nombre} ({b.codigo})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Código de Establecimiento en FilPro */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                                Código de Establecimiento en FilPro (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: S001 o vacío para todos"
                                value={configForm.filpro_establishment_code}
                                onChange={(e) => setConfigForm(prev => ({ ...prev, filpro_establishment_code: e.target.value }))}
                                className="w-full text-[13px] font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Test Results Banner */}
                    {testResult && (
                        <div className={`p-4 rounded-xl border ${
                            testResult.success 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                            <div className="flex items-center gap-2 font-bold text-xs">
                                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                                <span>{testResult.message}</span>
                            </div>
                            {testResult.establishments && testResult.establishments.length > 0 && (
                                <div className="mt-2 text-xs">
                                    <span className="font-semibold">Establecimientos detectados en FilPro:</span>
                                    <ul className="list-disc list-inside mt-1 text-slate-600">
                                        {testResult.establishments.map((est, i) => (
                                            <li key={i}>
                                                Código: <strong>{est.establishmentNumber || 'N/A'}</strong> — {est.name || 'Sin nombre'}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => testConnectionMutation.mutate({
                                filpro_email: configForm.filpro_email,
                                filpro_password: configForm.filpro_password,
                                filpro_company_id: configForm.filpro_company_id
                            })}
                            disabled={testConnectionMutation.isPending || !configForm.filpro_email}
                            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {testConnectionMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Probando...</span>
                                </>
                            ) : (
                                <>
                                    <Server className="w-4 h-4" />
                                    <span>Probar Conexión</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => saveConfigMutation.mutate(configForm)}
                            disabled={saveConfigMutation.isPending || !configForm.filpro_email}
                            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                            {saveConfigMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Guardar Configuración</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 3: Historial de Sincronizaciones */}
            {activeTab === 'logs' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Historial de Sincronizaciones
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[750px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase">Fecha Consultada</th>
                                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase">Sucursal</th>
                                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase text-center">Encontrados</th>
                                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase text-center">Importados</th>
                                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase text-center">Omitidos</th>
                                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase text-center">Errores</th>
                                    <th className="py-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase">Fecha de Ejecución</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[13px]">
                                {syncLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-xs text-slate-400">
                                            No se han realizado sincronizaciones aún.
                                        </td>
                                    </tr>
                                ) : (
                                    syncLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                                                {log.sync_date}
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                                                {log.branch_name || `Sucursal #${log.branch_id}`}
                                            </td>
                                            <td className="py-2.5 px-4 text-center font-semibold text-slate-700">
                                                {log.total_found}
                                            </td>
                                            <td className="py-2.5 px-4 text-center font-bold text-emerald-600">
                                                {log.total_imported}
                                            </td>
                                            <td className="py-2.5 px-4 text-center font-medium text-slate-500">
                                                {log.total_skipped}
                                            </td>
                                            <td className="py-2.5 px-4 text-center font-bold text-rose-600">
                                                {log.total_errors}
                                            </td>
                                            <td className="py-2.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Detalle DTE */}
            <Modal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                maxWidth="max-w-4xl"
                title={
                    <div className="flex items-center gap-2">
                        <span>Detalle de DTE</span>
                        {selectedDocSummary && (
                            <span className="text-xs font-mono font-normal text-slate-500">
                                {selectedDocSummary.numero_control || (selectedDocSummary.uuid ? selectedDocSummary.uuid.substring(0, 13) + '...' : '')}
                            </span>
                        )}
                    </div>
                }
            >
                {isDetailLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
                        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                        <p className="text-sm font-medium">Obteniendo detalle oficial del DTE desde FilPro / Infile...</p>
                        <p className="text-xs text-slate-400">Descargando JSON certificado y resumen tributario</p>
                    </div>
                ) : !detailData?.dte ? (
                    <div className="py-12 text-center space-y-3">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                        <div className="text-sm font-bold text-slate-800">No se pudo cargar la estructura oficial del DTE</div>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                            El certificador de Infile no retornó la información para este UUID o la conexión expiró.
                        </p>
                        {detailData?.pdfUrl && (
                            <a
                                href={detailData.pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>Ver PDF Oficial en Infile</span>
                            </a>
                        )}
                    </div>
                ) : (() => {
                    const dte = detailData.dte;
                    const ident = dte.identificacion || {};
                    const emisor = dte.emisor || {};
                    const receptor = dte.receptor || {};
                    const items = dte.cuerpoDocumento || [];
                    const resumen = dte.resumen || {};
                    const isAnulado = selectedDocSummary?.status === 'ANULADO' || selectedDocSummary?.status === 'INVALIDADO';

                    return (
                        <div className="space-y-5">
                            {/* Alerta de Anulado */}
                            {isAnulado && (
                                <div className="flex items-start sm:items-center gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                                    <div>
                                        <span className="font-bold">DOCUMENTO ANULADO EN FILPRO / HACIENDA:</span> Este DTE fue invalidado en los sistemas oficiales de tributación. Por regla de negocio se omite automáticamente y no se ingresará como venta en Nova SaaS.
                                    </div>
                                </div>
                            )}

                            {/* Alerta de Ya Importado */}
                            {selectedDocSummary?.is_already_imported && (
                                <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs">
                                    <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                                    <div>
                                        <span className="font-bold">YA IMPORTADO:</span> Este DTE ya se encuentra registrado en Nova SaaS vinculado a la Venta #{detailData.localDte?.venta_id || selectedDocSummary.local_sale_id}.
                                    </div>
                                </div>
                            )}

                            {/* Barra de Encabezado */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {getTipoDteBadge(ident.tipoDte || selectedDocSummary?.tipo_dte, false)}
                                        <span className="font-mono text-xs font-bold text-slate-800">
                                            {ident.numeroControl || selectedDocSummary?.numero_control || '—'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-600">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase">UUID:</span>
                                        <span className="font-mono text-[11px] select-all">{ident.codigoGeneracion || selectedDocSummary?.uuid}</span>
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(ident.codigoGeneracion || selectedDocSummary?.uuid)}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Copiar UUID"
                                        >
                                            {copiedUuid === (ident.codigoGeneracion || selectedDocSummary?.uuid) ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    {(detailData?.localDte?.venta_id || selectedDocSummary?.local_sale_id) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRevertDteTarget({
                                                    uuid: selectedDocSummary?.uuid || detailData?.uuid,
                                                    sale_id: detailData?.localDte?.venta_id || selectedDocSummary?.local_sale_id,
                                                    numero_control: selectedDocSummary?.numero_control || ident.numeroControl,
                                                    receptor: selectedDocSummary?.nombre_receptor || receptor.nombre,
                                                    total: selectedDocSummary?.monto_total || resumen.totalPagar
                                                });
                                            }}
                                            disabled={revertDteMutation.isPending}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
                                            title="Revertir y eliminar esta venta importada"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            <span>Revertir Venta #{detailData?.localDte?.venta_id || selectedDocSummary?.local_sale_id}</span>
                                        </button>
                                    )}
                                    {detailData.pdfUrl && (
                                        <a
                                            href={detailData.pdfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors shrink-0"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            <span>Ver PDF Oficial</span>
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setDetailTab(detailTab === 'summary' ? 'json' : 'summary')}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
                                    >
                                        {detailTab === 'summary' ? (
                                            <>
                                                <Code className="w-4 h-4 text-indigo-600" />
                                                <span>Ver JSON Crudo</span>
                                            </>
                                        ) : (
                                            <>
                                                <FileText className="w-4 h-4 text-indigo-600" />
                                                <span>Ver Vista Previa</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Subvista: Vista Detallada */}
                            {detailTab === 'summary' ? (
                                <div className="space-y-4">
                                    {/* Tarjetas Receptor & Emisor */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Receptor */}
                                        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100 pb-1.5">
                                                <User className="w-3.5 h-3.5 text-indigo-500" />
                                                <span>Datos del Receptor / Cliente</span>
                                            </div>
                                            <div className="text-xs space-y-1.5 pt-1">
                                                <div>
                                                    <span className="text-slate-400">Nombre / Razón Social: </span>
                                                    <span className="font-semibold text-slate-800">
                                                        {receptor.nombre || receptor.nombreComercial || selectedDocSummary?.nombre_receptor || 'Consumidor Final'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-slate-400">NIT/Doc: </span>
                                                        <span className="font-medium text-slate-700">{receptor.numDocumento || receptor.nit || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">NRC: </span>
                                                        <span className="font-medium text-slate-700">{receptor.nrc || '—'}</span>
                                                    </div>
                                                </div>
                                                {receptor.descActividad && (
                                                    <div>
                                                        <span className="text-slate-400">Actividad: </span>
                                                        <span className="text-slate-700">{receptor.descActividad}</span>
                                                    </div>
                                                )}
                                                {receptor.direccion?.complemento && (
                                                    <div>
                                                        <span className="text-slate-400">Dirección: </span>
                                                        <span className="text-slate-700">{receptor.direccion.complemento}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Emisor y Emisión */}
                                        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100 pb-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                                                <span>Datos del Emisor y Certificación</span>
                                            </div>
                                            <div className="text-xs space-y-1.5 pt-1">
                                                <div>
                                                    <span className="text-slate-400">Emisor: </span>
                                                    <span className="font-semibold text-slate-800">{emisor.nombreComercial || emisor.nombre || '—'}</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-slate-400">NIT: </span>
                                                        <span className="font-medium text-slate-700">{emisor.nit || '—'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">NRC: </span>
                                                        <span className="font-medium text-slate-700">{emisor.nrc || '—'}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-slate-400">Fecha Emisión: </span>
                                                        <span className="font-medium text-slate-700">{ident.fecEmi || selectedDocSummary?.fecha_emision}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Hora: </span>
                                                        <span className="font-medium text-slate-700">{ident.horEmi || '—'}</span>
                                                    </div>
                                                </div>
                                                {emisor.descActividad && (
                                                    <div className="truncate">
                                                        <span className="text-slate-400">Giro: </span>
                                                        <span className="text-slate-700" title={emisor.descActividad}>{emisor.descActividad}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tabla de Ítems */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                                Ítems del Documento ({items.length})
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                                                        <th className="py-2 px-3">#</th>
                                                        <th className="py-2 px-3">Código</th>
                                                        <th className="py-2 px-3">Descripción</th>
                                                        <th className="py-2 px-3 text-right">Cantidad</th>
                                                        <th className="py-2 px-3 text-right">Precio Unit.</th>
                                                        <th className="py-2 px-3 text-right">Descuento</th>
                                                        <th className="py-2 px-3 text-right">Venta Gravada</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {items.map((it, i) => (
                                                        <tr key={i} className="hover:bg-slate-50/60">
                                                            <td className="py-2 px-3 text-slate-400 font-mono">{it.numItem || i + 1}</td>
                                                            <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span>{it.codigo || '—'}</span>
                                                                    {it.codigo && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenCreateMapping(it.codigo, it.descripcion)}
                                                                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                                            title={`Mapear código ${it.codigo} en el sistema`}
                                                                        >
                                                                            <Tag className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-3 font-medium text-slate-800">{it.descripcion}</td>
                                                            <td className="py-2 px-3 text-right font-mono">{it.cantidad}</td>
                                                            <td className="py-2 px-3 text-right font-mono">
                                                                <Money value={it.precioUni} />
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                                                                {it.montoDescu ? <Money value={it.montoDescu} /> : '—'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                                                <Money value={it.ventaGravada ?? (it.ventaExenta || it.ventaNoSuj || (it.cantidad * it.precioUni))} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Totales y Tributos */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Tributos específicos */}
                                        <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 text-xs">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">
                                                Desglose de Impuestos y Tributos
                                            </span>
                                            <div className="space-y-1.5 pt-1">
                                                {Array.isArray(resumen.tributos) && resumen.tributos.length > 0 ? (
                                                    resumen.tributos.map((trib, idx) => (
                                                        <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/60 text-slate-700">
                                                            <span>{trib.descripcion || `Tributo ${trib.codigo}`}</span>
                                                            <span className="font-mono font-semibold"><Money value={trib.valor} /></span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-slate-400 italic">Sin tributos especiales adicionales</div>
                                                )}

                                                {resumen.totalIva > 0 && (
                                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-slate-700">
                                                        <span>IVA (13%)</span>
                                                        <span className="font-mono font-semibold"><Money value={resumen.totalIva} /></span>
                                                    </div>
                                                )}

                                                {resumen.ivaRete1 > 0 && (
                                                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60 text-slate-700">
                                                        <span>Retención IVA (1%)</span>
                                                        <span className="font-mono font-semibold text-rose-600">-<Money value={resumen.ivaRete1} /></span>
                                                    </div>
                                                )}

                                                <div className="pt-2 text-slate-500 text-[11px]">
                                                    <span className="font-semibold">Condición de Operación: </span>
                                                    <span>{resumen.condicionOperacion === 2 ? 'Crédito' : 'Contado'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Resumen Final */}
                                        <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-2 text-xs">
                                            <span className="text-[11px] font-bold text-indigo-800 uppercase">
                                                Resumen Total
                                            </span>
                                            <div className="space-y-1.5 pt-1">
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Subtotal Ventas:</span>
                                                    <span className="font-mono font-semibold"><Money value={resumen.subTotalVentas ?? resumen.subTotal} /></span>
                                                </div>
                                                {resumen.totalDescu > 0 && (
                                                    <div className="flex justify-between text-emerald-600">
                                                        <span>Descuentos:</span>
                                                        <span className="font-mono font-semibold">-<Money value={resumen.totalDescu} /></span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center pt-2 border-t border-indigo-200 text-sm font-bold text-indigo-950">
                                                    <span>Total a Pagar:</span>
                                                    <span className="text-base text-indigo-900 font-mono">
                                                        <Money value={resumen.totalPagar ?? resumen.montoTotalOperacion ?? selectedDocSummary?.monto_total} />
                                                    </span>
                                                </div>
                                                {resumen.totalLetras && (
                                                    <p className="text-[11px] text-slate-500 italic capitalize pt-1">
                                                        {resumen.totalLetras}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Subvista: Raw JSON */
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">
                                            JSON Oficial (Ministerio de Hacienda / Infile)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCopyJson}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors"
                                        >
                                            {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copiedJson ? 'Copiado' : 'Copiar JSON'}</span>
                                        </button>
                                    </div>
                                    <pre className="max-h-[60vh] overflow-y-auto p-4 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono select-all leading-relaxed">
                                        {JSON.stringify(dte, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>

            {/* Modal para Crear/Editar Mapeo de Código */}
            <Modal
                isOpen={isMappingModalOpen}
                onClose={() => {
                    setIsMappingModalOpen(false);
                    setEditingMapping(null);
                }}
                maxWidth="max-w-md"
                title={editingMapping ? 'Editar Mapeo de Código' : 'Nuevo Mapeo de Código'}
            >
                <form onSubmit={handleSaveMapping} className="space-y-4 pb-28">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                            Código en FilPro *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ej: 071228"
                            value={mappingForm.filpro_code}
                            onChange={(e) => setMappingForm(prev => ({ ...prev, filpro_code: e.target.value }))}
                            className="w-full text-[13px] font-mono font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                            El código de producto tal como aparece en los DTEs de FilPro.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                            Descripción Referencial en FilPro (Opcional)
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: FS Diesel"
                            value={mappingForm.filpro_description}
                            onChange={(e) => setMappingForm(prev => ({ ...prev, filpro_description: e.target.value }))}
                            className="w-full text-[13px] font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                            Nombre descriptivo de ayuda para identificar el producto en FilPro.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                            Producto en Nova SaaS *
                        </label>
                        <SearchableSelect
                            value={mappingForm.product_id}
                            onChange={(e, opt) => {
                                const selectedId = opt?.id ?? e?.target?.value ?? '';
                                const selectedName = opt ? `[${opt.codigo}] ${opt.nombre}` : '';
                                setMappingForm(prev => ({
                                    ...prev,
                                    product_id: String(selectedId),
                                    product_label: selectedName
                                }));
                            }}
                            placeholder="Buscar producto por nombre o código..."
                            valueKey="id"
                            codeKey="codigo"
                            labelKey="nombre"
                            codeLabel="CÓDIGO"
                            debounceMs={300}
                            selectedLabel={mappingForm.product_label || (editingMapping ? `[${editingMapping.product_code}] ${editingMapping.product_name}` : null)}
                            loadOptions={loadProductOptions}
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                            Seleccione el producto de su catálogo al que se vinculará este ítem.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => {
                                setIsMappingModalOpen(false);
                                setEditingMapping(null);
                            }}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saveMappingMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                        >
                            {saveMappingMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Guardando...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Guardar Mapeo</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal Confirmación Revertir DTE Individual */}
            <Modal
                isOpen={!!revertDteTarget}
                onClose={() => setRevertDteTarget(null)}
                maxWidth="max-w-md"
                title="Revertir Venta Importada"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">¿Está seguro de revertir esta venta?</span>
                            <p className="mt-1 text-rose-700">
                                Se eliminará la Venta {revertDteTarget?.sale_id ? `(#${revertDteTarget.sale_id})` : ''} y su DTE en Nova SaaS. Esto le permitirá volver a sincronizar el documento si lo necesita.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2 font-medium">
                        <div className="flex justify-between">
                            <span className="text-slate-500">N° Control:</span>
                            <span className="font-mono text-slate-800 font-bold">{revertDteTarget?.numero_control || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Receptor:</span>
                            <span className="text-slate-800 truncate max-w-[200px]">{revertDteTarget?.receptor || 'Consumidor Final'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Total:</span>
                            <span className="font-bold text-slate-900"><Money value={revertDteTarget?.total || 0} /></span>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setRevertDteTarget(null)}
                            disabled={revertDteMutation.isPending}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => revertDteMutation.mutate({
                                uuid: revertDteTarget?.uuid,
                                sale_id: revertDteTarget?.sale_id
                            })}
                            disabled={revertDteMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                        >
                            {revertDteMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Revirtiendo...</span>
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Confirmar Reversión</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal Confirmación Revertir Día Completo */}
            <Modal
                isOpen={isRevertDayModalOpen}
                onClose={() => setIsRevertDayModalOpen(false)}
                maxWidth="max-w-md"
                title="Revertir Sincronización del Día"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">¿Desea revertir las {previewData?.summary?.totalAlreadyImported || 0} ventas importadas?</span>
                            <p className="mt-1 text-rose-700">
                                Se eliminarán todas las ventas registradas en Nova SaaS que provengan de FilPro para la fecha <span className="font-semibold">{selectedDate}</span>. No afecta inventario. Los documentos quedarán listos para sincronizarse nuevamente.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2 font-medium">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Fecha:</span>
                            <span className="font-semibold text-slate-800">{selectedDate}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Sucursal:</span>
                            <span className="text-slate-800 font-semibold">
                                {branches.find(b => String(b.id) === String(selectedBranchId))?.nombre || 'Todas las sucursales'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Ventas a eliminar:</span>
                            <span className="font-bold text-rose-700">{previewData?.summary?.totalAlreadyImported || 0}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsRevertDayModalOpen(false)}
                            disabled={revertDayMutation.isPending}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={() => revertDayMutation.mutate({
                                date: selectedDate,
                                branch_id: selectedBranchId ? parseInt(selectedBranchId, 10) : null
                            })}
                            disabled={revertDayMutation.isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                        >
                            {revertDayMutation.isPending ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Revirtiendo día...</span>
                                </>
                            ) : (
                                <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Confirmar y Revertir Día</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Progreso en Vivo de Sincronización */}
            <Modal
                isOpen={syncProgress.isOpen}
                onClose={() => {
                    if (!syncProgress.isStreaming) {
                        setSyncProgress(prev => ({ ...prev, isOpen: false }));
                    }
                }}
                title={
                    syncProgress.isCompleted
                        ? '¡Sincronización Completada!'
                        : syncProgress.hasError
                        ? 'Error en la Sincronización'
                        : 'Sincronizando DTEs de FilPro'
                }
                maxWidth="max-w-2xl"
            >
                <div className="space-y-4">
                    {/* Header Info Banner */}
                    <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
                        syncProgress.isCompleted
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : syncProgress.hasError
                            ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                            : 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
                    }`}>
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                            syncProgress.isCompleted
                                ? 'bg-emerald-500 text-white'
                                : syncProgress.hasError
                                ? 'bg-rose-500 text-white'
                                : 'bg-indigo-600 text-white'
                        }`}>
                            {syncProgress.isCompleted ? (
                                <CheckCircle2 className="w-6 h-6" />
                            ) : syncProgress.hasError ? (
                                <AlertCircle className="w-6 h-6" />
                            ) : (
                                <RefreshCw className="w-6 h-6 animate-spin" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold uppercase tracking-wider opacity-75">
                                {syncProgress.isCompleted ? 'Operación Exitosa' : syncProgress.hasError ? 'Atención Requerida' : 'Procesando en Paralelo (8 Hilos)'}
                            </div>
                            <div className="text-sm font-bold truncate mt-0.5">
                                {syncProgress.hasError ? syncProgress.errorMessage : syncProgress.statusMessage}
                            </div>
                            <div className="text-[11px] opacity-75 mt-0.5">
                                Fecha: <span className="font-semibold">{selectedDate}</span> • Sucursal: <span className="font-semibold">{branches.find(b => String(b.id) === String(selectedBranchId))?.nombre || selectedBranchId}</span>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">Progreso de Ingestión</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500">
                                    {syncProgress.current} de {syncProgress.total} DTEs
                                </span>
                                <span className="text-base font-black text-indigo-600 min-w-[3rem] text-right">
                                    {syncProgress.pct}%
                                </span>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ease-out ${
                                    syncProgress.isCompleted
                                        ? 'bg-emerald-500'
                                        : syncProgress.hasError
                                        ? 'bg-rose-500'
                                        : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500'
                                }`}
                                style={{ width: `${Math.min(syncProgress.pct, 100)}%` }}
                            />
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total DTEs</div>
                            <div className="text-xl font-black text-slate-800 mt-0.5">{syncProgress.total}</div>
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl text-center">
                            <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Importados</div>
                            <div className="text-xl font-black text-emerald-700 mt-0.5">{syncProgress.imported}</div>
                        </div>
                        <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl text-center">
                            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Omitidos</div>
                            <div className="text-xl font-black text-blue-700 mt-0.5">{syncProgress.skipped}</div>
                        </div>
                        <div className="bg-rose-50/70 border border-rose-200 p-3 rounded-xl text-center">
                            <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Errores</div>
                            <div className="text-xl font-black text-rose-700 mt-0.5">{syncProgress.errors}</div>
                        </div>
                    </div>

                    {/* Live Activity Feed / Terminal Log */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                            <span>Registro de Actividad en Vivo</span>
                            {syncProgress.isStreaming && (
                                <span className="flex items-center gap-1.5 text-emerald-600 font-semibold normal-case">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                    Transmitiendo en tiempo real
                                </span>
                            )}
                        </div>
                        <div className="bg-slate-900 text-slate-200 rounded-xl p-3 font-mono text-xs max-h-44 overflow-y-auto space-y-1 border border-slate-800 shadow-inner select-text">
                            {syncProgress.logs.length === 0 ? (
                                <div className="text-slate-500 text-center py-4 italic">
                                    {syncProgress.isStreaming ? 'Iniciando conexión con Infile y preparando DTEs...' : 'Sin actividad registrada.'}
                                </div>
                            ) : (
                                syncProgress.logs.map((log, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 text-[11px] py-0.5 border-b border-slate-800/50 last:border-0">
                                        <div className="flex items-center gap-2 truncate">
                                            {log.status === 'imported' ? (
                                                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 font-bold rounded text-[10px]">IMPORTADO</span>
                                            ) : log.status === 'skipped' ? (
                                                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 font-bold rounded text-[10px]">OMITIDO</span>
                                            ) : (
                                                <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-400 font-bold rounded text-[10px]">ERROR</span>
                                            )}
                                            <span className="text-slate-300 font-semibold">{log.numero_control || log.uuid?.substring(0, 18)}</span>
                                            {log.saleId && (
                                                <span className="text-slate-400 text-[10px]">&rarr; Venta #{log.saleId}</span>
                                            )}
                                        </div>
                                        <div className="shrink-0 text-slate-400 text-[10px]">
                                            {log.total > 0 ? `$${log.total.toFixed(2)}` : (log.message || '')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-500">
                            {syncProgress.isStreaming ? (
                                <span className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                                    No cierre esta ventana mientras la sincronización esté en curso...
                                </span>
                            ) : (
                                <span>Proceso finalizado.</span>
                            )}
                        </div>
                        {!syncProgress.isStreaming && (
                            <button
                                type="button"
                                onClick={() => setSyncProgress(prev => ({ ...prev, isOpen: false }))}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                            >
                                Aceptar y Ver Resultados
                            </button>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default FilproSync;
