import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    User
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import SearchableSelect from '../components/ui/SearchableSelect';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';

const CustomerDetailedStatementReport = () => {
    const { user } = useAuth();
    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    // Filters State
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id || '');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedCustomerName, setSelectedCustomerName] = useState('');
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(today);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: rawBranches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList((await axios.get('/api/branches')).data)
    });
    const branches = Array.isArray(rawBranches) ? rawBranches : [];

    // Searchable customer options loader
    const loadCustomersOptions = async (search, page) => {
        const res = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50, es_credito: 1 }
        });
        return res.data;
    };

    // Revoke object URL on unmount or change
    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

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
            const response = await axios.get('/api/cxc/reports/detailed-statement/pdf', {
                params: { 
                    customer_id: selectedCustomer,
                    branch_id: selectedBranch,
                    start_date: startDate || undefined,
                    end_date: endDate || undefined
                },
                responseType: 'blob'
            });

            if (response.data.type !== 'application/pdf') {
                const text = await response.data.text();
                const error = JSON.parse(text);
                throw new Error(error.message || 'Error en el formato del reporte');
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Estado de cuenta detallado generado exitosamente');
        } catch (error) {
            console.error('Error generating detailed statement report:', error);
            toast.error(error.message || 'Error al generar el estado de cuenta detallado');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const cleanName = (selectedCustomerName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Estado_Cuenta_Detallado_${cleanName}_${endDate || 'corte'}.pdf`);
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
            const params = { 
                customer_id: selectedCustomer,
                branch_id: selectedBranch,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                format: 'excel' 
            };

            const response = await axios.get('/api/cxc/reports/detailed-statement/pdf', {
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
            link.setAttribute('download', `Estado_Cuenta_Detallado_${cleanName}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            toast.success('Reporte exportado a Excel correctamente', { id: toastId });
        } catch (error) {
            console.error('Error exporting detailed statement to Excel:', error);
            toast.error('Error al exportar a Excel', { id: toastId });
        }
    };

    return (
        <ReportLayout
            title="Estado de Cuenta Detallado"
            subtitle="Detalle de consumos y movimientos con productos, placas, odómetro, pagaré legal y firmas."
            category="Cuentas por Cobrar"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(selectedBranch && selectedCustomer)}
            fileName={`Estado_Cuenta_Detallado_${(selectedCustomerName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`}
        >
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

            {/* Cliente */}
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
                    placeholder="BUSCAR CLIENTE POR NOMBRE O NIT..."
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
        </ReportLayout>
    );
};

export default CustomerDetailedStatementReport;
