import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { GitBranch, Calendar, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';

const GasLubricantsReport = () => {
    const { user } = useAuth();

    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all',
        only_with_sales: true
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

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
                only_with_sales: filters.only_with_sales ? 'true' : 'false'
            };

            const response = await axios.get('/api/gas-station/reports/lubricants-sold/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte de lubricantes vendidos generado');
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al generar el reporte de lubricantes');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Lubricantes_Vendidos_${filters.start_date}_al_${filters.end_date}.pdf`);
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
                only_with_sales: filters.only_with_sales ? 'true' : 'false',
                format: 'excel'
            };
            const response = await axios.get('/api/gas-station/reports/lubricants-sold/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Lubricantes_Vendidos_${filters.start_date}_al_${filters.end_date}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Reporte exportado a Excel');
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    return (
        <ReportLayout
            title="Reporte de Lubricantes Vendidos"
            subtitle="Control y consolidado de lubricantes despachados en turnos de pista."
            category="Gasolinera"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
            fileName={`Lubricantes_Vendidos_${filters.start_date}_al_${filters.end_date}.pdf`}
        >
            <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <GitBranch size={13} className="text-indigo-500" /> Sucursal
                </label>
                <select
                    name="branch_id"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={filters.branch_id}
                    onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                >
                    <option value="all">Todas las sucursales</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={13} className="text-indigo-500" /> Fecha Inicio
                </label>
                <input
                    type="date"
                    name="start_date"
                    value={filters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Calendar size={13} className="text-indigo-500" /> Fecha Fin
                </label>
                <input
                    type="date"
                    name="end_date"
                    value={filters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
            </div>

            <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl cursor-pointer transition-all">
                    <input
                        type="checkbox"
                        checked={filters.only_with_sales}
                        onChange={(e) => handleFilterChange('only_with_sales', e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                        <span className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                            <Droplets size={13} className="text-amber-500" />
                            Solo con ventas
                        </span>
                        <span className="text-[10px] text-slate-500">
                            Excluir productos con 0 despachos
                        </span>
                    </div>
                </label>
            </div>
        </ReportLayout>
    );
};

export default GasLubricantsReport;
