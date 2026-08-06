import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calendar,
    ListChecks
} from 'lucide-react';
import { toast } from 'sonner';
import ReportLayout from '../../components/ui/ReportLayout';

const ListadoPartidas = () => {

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        entry_type_id: 'all'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

    const { data: entryTypes = [] } = useQuery({
        queryKey: ['entry-types'],
        queryFn: async () => (await axios.get('/api/accounting/entry-types')).data,
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
                entry_type_id: filters.entry_type_id
            };

            const response = await axios.get('/api/accounting/reports/listado-partidas', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Listado de partidas generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el listado de partidas');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Listado_Partidas_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                entry_type_id: filters.entry_type_id,
                format: 'excel'
            };

            const response = await axios.get('/api/accounting/reports/listado-partidas', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Listado_Partidas.xlsx`);
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
            title="Listado de Partidas"
            subtitle="Relación de asientos contables del período."
            category="Contabilidad"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
        >
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

            {/* Tipo de Partida */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ListChecks size={12} className="text-indigo-500" /> Tipo de Partida
                </label>
                <select
                    name="entry_type_id"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={filters.entry_type_id}
                    onChange={(e) => handleFilterChange('entry_type_id', e.target.value)}
                >
                    <option value="all">Todos</option>
                    {entryTypes.map(et => (
                        <option key={et.id} value={et.id}>{et.nombre || et.name || et.description}</option>
                    ))}
                </select>
            </div>
        </ReportLayout>
    );
};

export default ListadoPartidas;
