import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { GitBranch, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import { generateCloseoutPdfBlob } from '../utils/closeoutPdf';

const GasAccumulatedDailyReport = () => {
    const { user } = useAuth();

    const today = new Date().toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        fecha: today,
        branch_id: user?.branch_id || 'all'
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
        if (!filters.fecha) {
            toast.error('Debe seleccionar una fecha');
            return;
        }
        if (!filters.branch_id || filters.branch_id === 'all') {
            toast.error('Debe seleccionar una sucursal');
            return;
        }

        setIsGenerating(true);
        try {
            const { data } = await axios.get('/api/gas-station/closeouts/print-day', {
                params: { fecha: filters.fecha, branch_id: filters.branch_id }
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const url = await generateCloseoutPdfBlob(data);
            setPdfUrl(url);
            toast.success('Reporte acumulado generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error(error.response?.data?.message || 'Error al generar el reporte acumulado');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Cierre_Acumulado_${filters.fecha}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        toast.info('La exportación a Excel no está disponible para este reporte');
    };

    return (
        <ReportLayout
            title="Reporte de Cierre Acumulado Diario"
            subtitle="Acumulado de lecturas de todas las bombas por sucursal y fecha."
            category="Gasolinera"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.fecha && filters.branch_id && filters.branch_id !== 'all')}
        >
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
                    <option value="all">Seleccione una sucursal</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha
                </label>
                <input
                    type="date"
                    name="fecha"
                    value={filters.fecha}
                    onChange={(e) => handleFilterChange('fecha', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
            </div>
        </ReportLayout>
    );
};

export default GasAccumulatedDailyReport;