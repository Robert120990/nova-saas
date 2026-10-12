import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    GitBranch,
    Calendar,
    Monitor,
    ListFilter
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import { getTodayString } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';

const ArqueosReport = () => {
    const { user } = useAuth();
    const today = getTodayString();

    const [filters, setFilters] = useState({
        start_date: today,
        end_date: today,
        branch_id: user?.branch_id || 'all'
    });

    const [selectedPosIds, setSelectedPosIds] = useState([]);
    const [isDetailed, setIsDetailed] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList((await axios.get('/api/branches')).data)
    });

    const { data: posList = [] } = useQuery({
        queryKey: ['pos', filters.branch_id, 'activo'],
        queryFn: async () => unwrapList((await axios.get('/api/pos', {
            params: {
                branch_id: filters.branch_id !== 'all' ? filters.branch_id : undefined,
                status: 'activo'
            }
        })).data),
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        if (name === 'branch_id') setSelectedPosIds([]);
    };

    const togglePos = (id) => {
        setSelectedPosIds(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
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
                pos_ids: selectedPosIds.length ? selectedPosIds.join(',') : undefined,
                detailed: isDetailed ? 'true' : 'false'
            };

            const response = await axios.get('/api/shifts/reports/arqueos/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success(isDetailed ? 'Reporte detallado generado correctamente' : 'Reporte generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el reporte de arqueos');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        const suffix = isDetailed ? '_Detallado' : '';
        link.setAttribute('download', `Reporte_Arqueos_${filters.start_date}_al_${filters.end_date}${suffix}.pdf`);
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
                pos_ids: selectedPosIds.length ? selectedPosIds.join(',') : undefined,
                detailed: isDetailed ? 'true' : 'false',
                format: 'excel'
            };
            const response = await axios.get('/api/shifts/reports/arqueos/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const suffix = isDetailed ? '_Detallado' : '';
            link.setAttribute('download', `Reporte_Arqueos_${filters.start_date}_al_${filters.end_date}${suffix}.xlsx`);
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
            title="Reporte de Arqueos"
            subtitle="Cortes de caja por turno: fondo, ventas, ingresos, gastos, remesas, puntos y diferencias."
            category="Ventas"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
        >
            {/* Detailed Movements Toggle */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5 transition-all">
                <div className="flex items-center justify-between">
                    <label
                        className="text-xs font-black text-slate-800 flex items-center gap-1.5 cursor-pointer select-none"
                        onClick={() => setIsDetailed(!isDetailed)}
                    >
                        <ListFilter size={13} className={isDetailed ? "text-indigo-600" : "text-slate-400"} />
                        Detallar Movimientos
                    </label>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isDetailed}
                        onClick={() => setIsDetailed(!isDetailed)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isDetailed ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                isDetailed ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                    {isDetailed 
                        ? 'Muestra cada voucher, remesa, ingreso y gasto de forma individual.' 
                        : 'Consolida partidas agrupadas (ej. 4 Remesas, 3 Vouchers).'}
                </p>
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

            {/* POS Selection */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Monitor size={12} className="text-indigo-500" /> Puntos de Venta (POS)
                </label>
                {posList.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic px-1">No hay terminales activas en esta sucursal</p>
                ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1 px-1 custom-scrollbar border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                        {posList.map(p => {
                            const isSelected = selectedPosIds.includes(p.id);
                            return (
                                <label key={p.id} className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-100'}`}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => togglePos(p.id)}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[11px] font-bold text-slate-700 truncate">{p.nombre}</span>
                                    {filters.branch_id === 'all' && p.branch_name && (
                                        <span className="text-[9px] font-semibold text-slate-400 ml-auto truncate">{p.branch_name}</span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                )}
                <p className="text-[10px] text-slate-400 px-1">
                    {selectedPosIds.length === 0 ? 'Todos los puntos de venta' : `${selectedPosIds.length} seleccionado(s)`}
                </p>
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

export default ArqueosReport;
