import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    GitBranch,
    Calendar,
    Monitor
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';

const SalesDetailReport = () => {
    const { user } = useAuth();

    const today = new Date().toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: today,
        end_date: today,
        branch_id: user?.branch_id || 'all'
    });

    const [selectedPosIds, setSelectedPosIds] = useState([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: posList = [] } = useQuery({
        queryKey: ['pos', filters.branch_id, 'activo'],
        queryFn: async () => (await axios.get('/api/pos', {
            params: {
                branch_id: filters.branch_id !== 'all' ? filters.branch_id : undefined,
                status: 'activo'
            }
        })).data,
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
                pos_ids: selectedPosIds.length ? selectedPosIds.join(',') : undefined
            };

            const response = await axios.get('/api/sales/reports/detalle/pdf', {
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
            toast.error('Error al generar el detalle de facturación');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Detalle_Facturacion_${filters.start_date}_al_${filters.end_date}.pdf`);
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
                format: 'excel'
            };
            const response = await axios.get('/api/sales/reports/detalle/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Detalle_Facturacion_${filters.start_date}_al_${filters.end_date}.xlsx`);
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
            title="Detalle de Facturación"
            subtitle="Detalle línea por línea de la facturación: documento, cliente, producto, cantidades e impuestos."
            category="Ventas"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
        >
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

export default SalesDetailReport;
