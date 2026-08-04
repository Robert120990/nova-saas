import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    Users,
    TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import SearchableSelect from '../components/ui/SearchableSelect';

const SalesReport = () => {
    const { user } = useAuth();
    
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all',
        customer_id: 'all'
    });

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
        if (page === 1 && !search) {
            data.data = [{ id: 'all', nombre: 'TODOS LOS CLIENTES' }, ...(data.data || [])];
        }
        return data;
    };

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = async () => {
        if (!filters.start_date || !filters.end_date) {
            toast.error('Debe seleccionar un rango de fechas');
            return;
        }

        setIsGenerating(true);
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                branch_id: filters.branch_id,
                customer_id: filters.customer_id
            };

            const response = await axios.get('/api/sales/reports/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte de ventas generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el reporte de ventas');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Reporte_Ventas_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                branch_id: filters.branch_id,
                customer_id: filters.customer_id,
                format: 'excel'
            };
            const response = await axios.get('/api/sales/reports/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Reporte_Ventas.xlsx`);
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
            title="Reporte de Ventas Detallado"
            subtitle="Análisis profundo de transacciones por cliente y sucursal."
            category="Ventas"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
        >
            {/* Sucursal */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={12} className="text-indigo-500" /> Sucursal
                </label>
                <select 
                    name="branch_id"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={filters.branch_id}
                    onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                >
                    <option value="all">Todas las sucursales</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Cliente */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Users size={12} className="text-indigo-500" /> Cliente
                </label>
                <SearchableSelect
                    loadOptions={loadCustomersOptions}
                    value={filters.customer_id}
                    onChange={(e) => handleFilterChange('customer_id', e.target.value)}
                    placeholder="Seleccionar cliente..."
                    valueKey="id"
                    labelKey="nombre"
                    displayKey="nombre"
                />
            </div>

            {/* Fecha Inicio */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha Inicio
                </label>
                <input 
                    type="date"
                    name="start_date"
                    value={filters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
            </div>

            {/* Fecha Fin */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha Fin
                </label>
                <input 
                    type="date"
                    name="end_date"
                    value={filters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
            </div>
        </ReportLayout>
    );
};

export default SalesReport;
