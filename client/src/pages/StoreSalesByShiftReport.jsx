import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    Clock,
    Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import { getTodayString, getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';
import { StoreSalesComparisonCard } from '../components/storeSales';

const StoreSalesByShiftReport = () => {
    const { user } = useAuth();
    const today = getTodayString();

    const [filters, setFilters] = useState({
        start_date: today,
        end_date: today,
        branch_id: user?.branch_id || 'all'
    });

    const [isComparative, setIsComparative] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList((await axios.get('/api/branches')).data)
    });

    // Query to discover detected store terminals or comparative summary
    const { data: summaryData, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['store-sales-shifts-summary', filters.branch_id, filters.start_date, filters.end_date, isComparative],
        queryFn: async () => {
            const res = await axios.get('/api/sales/reports/tienda-shifts', {
                params: {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    branch_id: filters.branch_id,
                    comparative: isComparative ? 'true' : 'false'
                }
            });
            return res.data;
        },
        enabled: Boolean(filters.start_date && filters.end_date),
        staleTime: 30000
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handlePresetRange = (type) => {
        const now = new Date();
        if (type === 'today') {
            setFilters(prev => ({ ...prev, start_date: today, end_date: today }));
        } else if (type === 'yesterday') {
            const y = new Date();
            y.setDate(y.getDate() - 1);
            setFilters(prev => ({ ...prev, start_date: getTodayString(y), end_date: getTodayString(y) }));
        } else if (type === 'this_month') {
            setFilters(prev => ({
                ...prev,
                start_date: getFirstDayOfMonth(now),
                end_date: getLastDayOfMonth(now)
            }));
        } else if (type === 'last_month') {
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            setFilters(prev => ({
                ...prev,
                start_date: getFirstDayOfMonth(prevMonthDate),
                end_date: getLastDayOfMonth(prevMonthDate)
            }));
        }
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
                comparative: isComparative ? 'true' : 'false'
            };

            const response = await axios.get('/api/sales/reports/tienda-shifts/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            setPdfUrl(URL.createObjectURL(blob));
            toast.success(isComparative ? 'Reporte comparativo generado' : 'Reporte de ventas de tienda generado');
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
        const prefix = isComparative ? 'Comparativo_Arqueos_vs_DTEs' : 'Ventas_Tienda_Turnos';
        link.setAttribute('download', `${prefix}_${filters.start_date}.pdf`);
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
                comparative: isComparative ? 'true' : 'false',
                format: 'excel'
            };
            const response = await axios.get('/api/sales/reports/tienda-shifts/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const prefix = isComparative ? 'Comparativo_Arqueos_vs_DTEs' : 'Ventas_Tienda_Turnos';
            link.setAttribute('download', `${prefix}_${filters.start_date}.xlsx`);
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

    const detectedPosList = summaryData?.posGroups?.map(g => g.pos_name) || [];
    const compSummary = summaryData?.comparison?.summary;

    return (
        <ReportLayout
            title={isComparative ? "Comparativo: Arqueos vs Ventas Tienda" : "Ventas de Tienda por Turno"}
            subtitle={isComparative 
                ? "Cuadre analítico de arqueos de caja contra facturación DTE por turno." 
                : "Facturación de tienda agrupada por turno operativo (según apertura del turno)."}
            category="Ventas"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
        >
            {/* Comparative Mode Toggle */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5 transition-all">
                <div className="flex items-center justify-between">
                    <label 
                        className="text-xs font-black text-slate-800 flex items-center gap-1.5 cursor-pointer select-none"
                        onClick={() => setIsComparative(!isComparative)}
                    >
                        <Scale size={13} className={isComparative ? "text-indigo-600" : "text-slate-400"} />
                        Modo Comparativo
                    </label>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isComparative}
                        onClick={() => setIsComparative(!isComparative)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isComparative ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                isComparative ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                    {isComparative 
                        ? 'Compara día a día y turno por turno los Arqueos de Caja vs los DTEs emitidos.' 
                        : 'Muestra el desglose detallado de ventas DTE agrupado por turnos.'}
                </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={12} className="text-indigo-500" /> Período Rápido
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                    <button
                        type="button"
                        onClick={() => handlePresetRange('today')}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors text-center"
                    >
                        Hoy
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePresetRange('yesterday')}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors text-center"
                    >
                        Ayer
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePresetRange('this_month')}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors text-center"
                    >
                        Este Mes
                    </button>
                    <button
                        type="button"
                        onClick={() => handlePresetRange('last_month')}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors text-center"
                    >
                        Mes Anterior
                    </button>
                </div>
            </div>

            {/* Branch Selection */}
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

            {/* Date Start */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Fecha Inicio (Apertura)
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
                    <Calendar size={12} className="text-indigo-500" /> Fecha Fin (Apertura)
                </label>
                <input 
                    type="date"
                    name="end_date"
                    value={filters.end_date}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
            </div>

            {/* Information Card (Detected POS or Comparative KPI) */}
            <StoreSalesComparisonCard
                isComparative={isComparative}
                compSummary={compSummary}
                isLoadingSummary={isLoadingSummary}
                detectedPosList={detectedPosList}
            />
        </ReportLayout>
    );
};

export default StoreSalesByShiftReport;
