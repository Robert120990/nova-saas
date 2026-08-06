import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    GitBranch,
    Calendar,
    ListFilter
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';

const reportTypes = [
    { value: 'remesas', label: 'Remesas' },
    { value: 'gastos', label: 'Gastos' },
    { value: 'creditos', label: 'Créditos' },
    { value: 'cupones', label: 'Cupones' },
    { value: 'descuentos', label: 'Descuentos' },
    { value: 'adelantos', label: 'Adelantos' },
    { value: 'tarjetas', label: 'Tarjetas' },
    { value: 'vales', label: 'Vales' },
    { value: 'anticipos_desp', label: 'Anticipos Despachados' },
    { value: 'lubricantes', label: 'Lubricantes' }
];

const GasCloseoutDetailReport = () => {
    const { user } = useAuth();

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all',
        tipo_reporte: 'remesas'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
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
                tipo_reporte: filters.tipo_reporte
            };

            const response = await axios.get('/api/gas-station/reports/closeout-detail/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el reporte');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        const tipoLabel = reportTypes.find(t => t.value === filters.tipo_reporte)?.label || filters.tipo_reporte;
        link.setAttribute('download', `Detalle_Cierre_${tipoLabel}_${filters.start_date}.pdf`);
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
                tipo_reporte: filters.tipo_reporte,
                format: 'excel'
            };
            const response = await axios.get('/api/gas-station/reports/closeout-detail/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Detalle_Cierre.xlsx`);
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
            title="Detalle del Cierre"
            subtitle="Reportes detallados de remesas, gastos, créditos, cupones y más por rango de fechas."
            category="Gasolinera"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date && filters.tipo_reporte)}
        >
            {/* Branch */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={12} className="text-indigo-500" /> Sucursal
                </label>
                <select
                    name="branch_id"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={filters.branch_id}
                    onChange={handleFilterChange}
                >
                    <option value="all">Todas las sucursales</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Tipo Reporte */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ListFilter size={12} className="text-indigo-500" /> Tipo de Reporte
                </label>
                <select
                    name="tipo_reporte"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={filters.tipo_reporte}
                    onChange={handleFilterChange}
                >
                    {reportTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
            </div>

            {/* Date Start */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha Inicio
                </label>
                <input
                    type="date"
                    name="start_date"
                    value={filters.start_date}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
            </div>

            {/* Date End */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha Fin
                </label>
                <input
                    type="date"
                    name="end_date"
                    value={filters.end_date}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
            </div>
        </ReportLayout>
    );
};

export default GasCloseoutDetailReport;
