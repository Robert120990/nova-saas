import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    Users,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import SearchableSelect from '../components/ui/SearchableSelect';

const PendingDocumentsDetailedReport = () => {
    const { user } = useAuth();
    const today = new Date().toISOString().split('T')[0];

    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id || '');
    const [cutoffDate, setCutoffDate] = useState(today);
    const [selectedCustomer, setSelectedCustomer] = useState('all');
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50, es_credito: 1 }
        });
        if (page === 1 && !search) {
            data.data = [{ id: 'all', nombre: 'TODOS LOS CLIENTES' }, ...(data.data || [])];
        }
        return data;
    };

    const handleGenerateReport = async () => {
        if (!selectedBranch) {
            toast.error('Debe seleccionar una sucursal');
            return;
        }
        if (!cutoffDate) {
            toast.error('Debe seleccionar una fecha de corte');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await axios.get('/api/cxc/reports/pending-detailed/pdf', {
                params: { 
                    branch_id: selectedBranch,
                    cutoffDate,
                    customer_id: selectedCustomer
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
            toast.success('Reporte detallado generado');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error(error.message || 'Error al generar el reporte detallado de documentos pendientes');
        } finally {
            setIsGenerating(false);
        }
    };

    React.useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Documentos_Pendientes_${cutoffDate}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = { 
                branch_id: selectedBranch,
                cutoffDate,
                customer_id: selectedCustomer,
                format: 'excel' 
            };
            const response = await axios.get('/api/cxc/reports/pending-detailed/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Documentos_Pendientes_CXC.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Reporte exportado a Excel correctamente');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    return (
        <ReportLayout
            title="Documentos Pendientes"
            subtitle="Listado detallado de documentos con saldo pendiente a una fecha de corte, agrupados por cliente."
            category="Cuentas por Cobrar"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(selectedBranch && cutoffDate)}
        >
            {/* Branch Selection */}
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

            {/* Cutoff Date */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha de Corte
                </label>
                <input 
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                />
            </div>

            {/* Customer Selection */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={12} className="text-indigo-500" /> Cliente (Opcional)
                </label>
                <SearchableSelect 
                    placeholder="TODOS LOS CLIENTES"
                    loadOptions={loadCustomersOptions}
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    valueKey="id"
                    labelKey="nombre"
                    displayKey="nombre"
                />
            </div>

            <div className="pt-4 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center gap-3 text-slate-400">
                    <FileText size={16} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Información del Reporte</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                    Este reporte detalla cada factura pendiente, calculando su saldo a la fecha de corte seleccionada y mostrando la antigüedad en días.
                </p>
            </div>
        </ReportLayout>
    );
};

export default PendingDocumentsDetailedReport;
