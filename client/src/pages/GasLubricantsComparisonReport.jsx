import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calendar,
    Building2,
    Search,
    Filter,
    Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';

const GasLubricantsComparisonReport = () => {
    const { user } = useAuth();

    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id ? String(user.branch_id) : 'all',
        filter_mode: 'with_movements',
        search: ''
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const handleFilterChange = (field, val) => {
        setFilters(prev => ({ ...prev, [field]: val }));
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
                filter_mode: filters.filter_mode,
                search: filters.search.trim() || undefined
            };

            const response = await axios.get('/api/gas-station/reports/lubricants-comparison/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte de auditoría de lubricantes generado correctamente');
        } catch (error) {
            console.error('Error generating lubricants audit report:', error);
            toast.error('Error al generar el reporte de auditoría de lubricantes');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Auditoria_Lubricantes_${filters.start_date}_al_${filters.end_date}.pdf`);
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
                filter_mode: filters.filter_mode,
                search: filters.search.trim() || undefined,
                format: 'excel'
            };

            const response = await axios.get('/api/gas-station/reports/lubricants-comparison/pdf', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Auditoria_Lubricantes_${filters.start_date}_al_${filters.end_date}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Excel exportado correctamente');
        } catch (error) {
            console.error('Error exporting excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    return (
        <ReportLayout
            title="Auditoría de Lubricantes"
            subtitle="Auditoría y conciliación entre movimientos de Cierres de Turno (Pista) e Inventario General (Kárdex)"
            category="Gasolinera"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            fileName={`Auditoria_Lubricantes_${filters.start_date}_al_${filters.end_date}.pdf`}
            footerNote="Reporte unificado de auditoría de lubricantes. Cifras expresadas en Dólares de los Estados Unidos de América."
        >
            <div className="space-y-4">
                {/* Selector de Sucursal */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        Sucursal
                    </label>
                    <select
                        value={filters.branch_id}
                        onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                        className="w-full text-[13px] font-medium px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    >
                        <option value="all">Todas las sucursales</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Rango de Fechas - Vertical para evitar truncado */}
                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            Fecha Desde
                        </label>
                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                            className="w-full text-[13px] font-medium px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            Fecha Hasta
                        </label>
                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                            className="w-full text-[13px] font-medium px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        />
                    </div>
                </div>

                {/* Modo de Visualización / Filtro */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                        <Filter className="w-3.5 h-3.5 text-indigo-500" />
                        Mostrar Productos
                    </label>
                    <select
                        value={filters.filter_mode}
                        onChange={(e) => handleFilterChange('filter_mode', e.target.value)}
                        className="w-full text-[13px] font-medium px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    >
                        <option value="with_movements">Solo con movimientos o diferencias (Recomendado)</option>
                        <option value="only_differences">Solo con diferencias (Faltantes / Sobrantes)</option>
                        <option value="all">Todos los lubricantes del catálogo</option>
                    </select>
                </div>

                {/* Buscador de Producto */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                        <Search className="w-3.5 h-3.5 text-indigo-500" />
                        Buscar Producto (Opcional)
                    </label>
                    <input
                        type="text"
                        placeholder="Código o descripción..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        className="w-full text-[13px] font-medium px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition placeholder:text-slate-400"
                    />
                </div>

                {/* Tarjeta informativa de conciliación */}
                <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-1.5 text-xs text-indigo-900 dark:text-indigo-300">
                    <div className="flex items-center gap-1.5 font-semibold text-[12px] text-indigo-700 dark:text-indigo-400">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        Alcance de la Auditoría
                    </div>
                    <p className="text-[11px] leading-relaxed text-indigo-800/80 dark:text-indigo-300/80">
                        Compara lecturas de pista (<span className="font-semibold">Inicial, Recargas, Ventas, Final</span>) contra Kárdex de inventario (<span className="font-semibold">Inicial, Entradas, Salidas, Stock</span>), identificando faltantes, sobrantes y valorización económica neta.
                    </p>
                </div>
            </div>
        </ReportLayout>
    );
};

export default GasLubricantsComparisonReport;
