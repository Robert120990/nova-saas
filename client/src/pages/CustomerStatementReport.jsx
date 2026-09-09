import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    User,
    FileText,
    Info,
    ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import SearchableSelect from '../components/ui/SearchableSelect';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';

const CustomerStatementReport = () => {
    const { user } = useAuth();
    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    // States
    const [reportType, setReportType] = useState('credito'); // 'credito' | 'anticipado' | 'trupput'
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id || '');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedCustomerName, setSelectedCustomerName] = useState('');
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        return data;
    };

    // Revoke previous URL on unmount
    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    // Reset pdf preview when changing report type
    const handleTypeChange = (newType) => {
        if (newType !== reportType) {
            setReportType(newType);
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }
        }
    };

    const getEndpoint = () => {
        switch (reportType) {
            case 'anticipado':
                return '/api/cxc/anticipos/statement/pdf';
            case 'trupput':
                return '/api/cxc/trupput/statement/pdf';
            case 'credito':
            default:
                return '/api/cxc/statement/pdf';
        }
    };

    const getReportTitle = () => {
        switch (reportType) {
            case 'anticipado':
                return 'Estado de Cuenta de Anticipos';
            case 'trupput':
                return 'Estado de Cuenta Trupput';
            case 'credito':
            default:
                return 'Estado de Cuenta de Crédito';
        }
    };

    const getFilePrefix = () => {
        switch (reportType) {
            case 'anticipado':
                return 'Estado_Cuenta_Anticipos';
            case 'trupput':
                return 'Estado_Cuenta_Trupput';
            case 'credito':
            default:
                return 'Estado_Cuenta_Credito';
        }
    };

    const handleGenerateReport = async () => {
        if (!selectedBranch) {
            toast.error('Debe seleccionar una sucursal');
            return;
        }
        if (!selectedCustomer) {
            toast.error('Debe seleccionar un cliente');
            return;
        }

        setIsGenerating(true);
        try {
            const endpoint = getEndpoint();
            const response = await axios.get(endpoint, {
                params: { 
                    customer_id: selectedCustomer,
                    branch_id: selectedBranch,
                    start_date: startDate || undefined,
                    end_date: endDate || undefined
                },
                responseType: 'blob'
            });

            // Verificar si el resultado es realmente un PDF o un JSON de error
            if (response.data.type !== 'application/pdf') {
                const text = await response.data.text();
                const error = JSON.parse(text);
                throw new Error(error.message || 'Error en el formato del reporte');
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte de estado de cuenta generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error(error.message || 'Error al generar el estado de cuenta');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const cleanName = (selectedCustomerName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `${getFilePrefix()}_${cleanName}_${endDate || 'corte'}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        if (!selectedBranch || !selectedCustomer) {
            toast.error('Debe seleccionar sucursal y cliente');
            return;
        }

        const toastId = toast.loading('Generando archivo Excel...');
        try {
            const endpoint = getEndpoint();
            const params = { 
                customer_id: selectedCustomer,
                branch_id: selectedBranch,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                format: 'excel' 
            };

            const response = await axios.get(endpoint, {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const cleanName = (selectedCustomerName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${getFilePrefix()}_${cleanName}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            toast.success('Reporte exportado a Excel correctamente', { id: toastId });
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            toast.error('Error al exportar a Excel', { id: toastId });
        }
    };

    return (
        <ReportLayout
            title={getReportTitle()}
            subtitle="Estado de cuenta contable pormenorizado: movimientos, cargos, abonos y saldos acumulados."
            category="Cuentas por Cobrar"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(selectedBranch && selectedCustomer)}
            fileName={`${getFilePrefix()}_${(selectedCustomerName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
        >
            {/* Modalidad / Tipo de Reporte */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText size={12} className="text-indigo-500" /> Modalidad de Cuenta
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => handleTypeChange('credito')}
                        className={`py-2 px-1 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all text-center cursor-pointer ${
                            reportType === 'credito'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Crédito
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTypeChange('anticipado')}
                        className={`py-2 px-1 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all text-center cursor-pointer ${
                            reportType === 'anticipado'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Anticipos
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTypeChange('trupput')}
                        className={`py-2 px-1 rounded-lg font-bold text-[11px] uppercase tracking-wider transition-all text-center cursor-pointer ${
                            reportType === 'trupput'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        Trupput
                    </button>
                </div>
            </div>

            {/* Sucursal */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={12} className="text-indigo-500" /> Sucursal
                </label>
                <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                >
                    <option value="">Seleccionar Sucursal...</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Cliente (Búsqueda remota) */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={12} className="text-indigo-500" /> Cliente
                </label>
                <SearchableSelect 
                    loadOptions={loadCustomersOptions}
                    value={selectedCustomer}
                    onChange={(e, option) => {
                        setSelectedCustomer(e.target.value);
                        if (option) {
                            setSelectedCustomerName(option.nombre || option.name || '');
                        } else if (!e.target.value) {
                            setSelectedCustomerName('');
                        }
                    }}
                    placeholder="BUSCAR POR NOMBRE, NIT O DOCUMENTO..."
                    valueKey="id"
                    labelKey="nombre"
                    displayKey="nombre"
                    codeKey="nit"
                    codeLabel="NIT/DOC"
                    dropdownWidth={420}
                />
            </div>

            {/* Fecha Inicio */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha Inicio
                </label>
                <input 
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                />
            </div>

            {/* Fecha Fin */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha Fin
                </label>
                <input 
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                />
            </div>

            {/* Accesos Rápidos de Fecha */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <button
                    type="button"
                    onClick={() => {
                        setStartDate(getFirstDayOfMonth());
                        setEndDate(getTodayString());
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                    Este Mes
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const now = new Date();
                        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                        setStartDate(getTodayString(prevMonthStart));
                        setEndDate(getTodayString(prevMonthEnd));
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                    Mes Anterior
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setStartDate('');
                        setEndDate('');
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                >
                    Historial Completo
                </button>
            </div>

            {/* Tarjeta Informativa */}
            <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-slate-500">
                    <Info size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                        {reportType === 'credito' && 'Modalidad Crédito'}
                        {reportType === 'anticipado' && 'Modalidad Anticipos'}
                        {reportType === 'trupput' && 'Modalidad Trupput (Galones)'}
                    </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    {reportType === 'credito' && 'Incluye las ventas a crédito, documentos fiscales y abonos/pagos recibidos. Si especifica una fecha de inicio, calcula el saldo inicial previo a esa fecha.'}
                    {reportType === 'anticipado' && 'Muestra los depósitos o anticipos monetarios recibidos y los consumos aplicados en estación, reflejando el saldo disponible en dólares.'}
                    {reportType === 'trupput' && 'Presenta el control de prepago de combustible en volumen: recargas en galones (+) versus despachos por turno (-), expresando el saldo disponible en galones.'}
                </p>
            </div>

            {/* Acceso a Consulta Interactiva */}
            <div className="pt-2">
                <Link
                    to="/cxc/estado-cuenta"
                    className="inline-flex items-center gap-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                    <ArrowLeft size={13} />
                    <span>Ir a Consulta Interactiva de Clientes</span>
                </Link>
            </div>
        </ReportLayout>
    );
};

export default CustomerStatementReport;
