import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    User,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import SearchableSelect from '../components/ui/SearchableSelect';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';

const CustomerStatementReport = () => {
    const { user } = useAuth();
    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    // States
    const [reportType, setReportType] = useState('credito'); // 'credito' | 'anticipado' | 'trupput' | 'detallado'
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id || '');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedCustomerName, setSelectedCustomerName] = useState('');
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [includePayments, setIncludePayments] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList(await axios.get('/api/branches'))
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
            case 'detallado':
                return '/api/cxc/reports/detailed-statement/pdf';
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
            case 'detallado':
                return 'Estado de Cuenta Detallado';
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
            case 'detallado':
                return 'Estado_Cuenta_Detallado';
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
                    end_date: endDate || undefined,
                    ...(reportType === 'detallado' ? { include_payments: includePayments ? '1' : '0' } : {})
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
                ...(reportType === 'detallado' ? { include_payments: includePayments ? '1' : '0' } : {}),
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
                <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer"
                    value={reportType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                >
                    <option value="credito">CRÉDITO (VENTAS Y ABONOS)</option>
                    <option value="detallado">DETALLADO (PRODUCTOS, PLACAS Y FIRMAS)</option>
                    <option value="anticipado">ANTICIPOS (DEPÓSITOS Y CONSUMOS)</option>
                    <option value="trupput">TRUPPUT (PREPAGO POR GALONAJE)</option>
                </select>
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
                    {(Array.isArray(branches) ? branches : []).map(b => (
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

            {reportType === 'detallado' && (
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="space-y-0.5">
                        <span className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                            Consultar Abonos
                        </span>
                        <span className="block text-[10px] font-medium text-slate-500">
                            {includePayments ? 'Incluye facturas, créditos y recibos de abono' : 'Solo muestra documentos con saldo pendiente'}
                        </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                            type="checkbox" 
                            checked={includePayments} 
                            onChange={(e) => setIncludePayments(e.target.checked)} 
                            className="sr-only peer" 
                        />
                        <div className="relative w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                    </label>
                </div>
            )}

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
        </ReportLayout>
    );
};

export default CustomerStatementReport;
