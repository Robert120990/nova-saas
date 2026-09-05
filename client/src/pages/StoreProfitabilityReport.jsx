import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    Store
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';

const StoreProfitabilityReport = () => {
    const { user } = useAuth();

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
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
                branch_id: filters.branch_id
            };

            const response = await axios.get('/api/sales/reports/store-profitability/pdf', {
                params,
                responseType: 'blob'
            });

            const contentType = response.headers['content-type'] || '';
            if (!contentType.includes('application/pdf')) {
                const text = await response.data.text();
                console.error('Server returned non-PDF:', text);
                toast.error('El servidor retornó una respuesta inesperada');
                return;
            }

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Informe de rentabilidad generado correctamente');
        } catch (error) {
            console.error('Error generating store profitability report:', error);
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    toast.error(json.message || 'Error al generar el informe de rentabilidad');
                } catch (e) {
                    toast.error('Error al generar el informe de rentabilidad');
                }
            } else {
                toast.error(error.response?.data?.message || 'Error al generar el informe de rentabilidad');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Rentabilidad_Tienda_${filters.start_date}_al_${filters.end_date}.pdf`);
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
                format: 'excel'
            };

            const response = await axios.get('/api/sales/reports/store-profitability/pdf', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Rentabilidad_Tienda_${filters.start_date}_al_${filters.end_date}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Archivo Excel descargado correctamente');
        } catch (error) {
            console.error('Error exporting excel:', error);
            toast.error('Error al exportar el archivo Excel');
        }
    };

    return (
        <ReportLayout
            title="Rentabilidad de Tienda"
            subtitle="Informe de ventas, costo y margen de rentabilidad por producto en puntos de venta de tienda"
            category="Ventas"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            generateButtonText="Generar Informe"
        >
            {/* Sucursal */}
            <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <GitBranch size={14} className="text-slate-400" />
                    Sucursal
                </label>
                <select
                    value={filters.branch_id}
                    onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                >
                    <option value="all">Todas las sucursales</option>
                    {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                            {branch.nombre}
                        </option>
                    ))}
                </select>
            </div>

            {/* Rango de Fechas */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        Fecha Inicio
                    </label>
                    <input
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => handleFilterChange('start_date', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        Fecha Fin
                    </label>
                    <input
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => handleFilterChange('end_date', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    />
                </div>
            </div>

            {/* Aviso informativo de configuración de tienda */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                    <Store size={15} />
                    <span>Filtro de Tienda</span>
                </div>
                <p className="text-[11px] font-medium text-indigo-900/80 leading-relaxed">
                    Este reporte lee la configuración de <strong>puntos de venta de tienda</strong> del sistema para excluir ventas de pista o servicios externos.
                </p>
            </div>
        </ReportLayout>
    );
};

export default StoreProfitabilityReport;
