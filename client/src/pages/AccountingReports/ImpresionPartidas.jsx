import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Filter, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReportLayout from '../../components/ui/ReportLayout';
import { unwrapList } from '../../utils/apiUtils';

const ImpresionPartidas = () => {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        entry_type_id: 'all',
        mode: 'normal'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

    const { data: entryTypesData = [] } = useQuery({
        queryKey: ['entry-types'],
        queryFn: async () => unwrapList(await axios.get('/api/accounting/entry-types')),
    });
    const entryTypes = Array.isArray(entryTypesData) ? entryTypesData : [];

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
                entry_type_id: filters.entry_type_id !== 'all' ? filters.entry_type_id : undefined,
                mode: filters.mode
            };

            const response = await axios.get('/api/accounting/reports/impresion-partidas', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Pólizas de partidas generadas correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar las pólizas de partidas');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Partidas_${filters.mode}_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                entry_type_id: filters.entry_type_id !== 'all' ? filters.entry_type_id : undefined,
                mode: filters.mode,
                format: 'excel'
            };

            const response = await axios.get('/api/accounting/reports/impresion-partidas', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Partidas_${filters.mode}_${filters.start_date}_al_${filters.end_date}.xlsx`);
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
            title="Impresión de Partidas Contables"
            subtitle="Emisión de comprobantes de diario individuales o por lote, con formato detallado o resumido por cuentas de mayor."
            category="Contabilidad"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
        >
            {/* Modalidad de Impresión */}
            <div className="space-y-2 col-span-full">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} className="text-indigo-500" /> Modalidad de Impresión
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => handleFilterChange('mode', 'normal')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                            filters.mode === 'normal'
                                ? 'bg-indigo-50/70 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <div className="font-bold text-xs uppercase flex items-center justify-between">
                            <span>Normal (Detallada)</span>
                            {filters.mode === 'normal' && (
                                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Muestra cada línea tal como fue registrada con sus cuentas y subcuentas de detalle.
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange('mode', 'mayorizada')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                            filters.mode === 'mayorizada'
                                ? 'bg-indigo-50/70 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <div className="font-bold text-xs uppercase flex items-center justify-between">
                            <span>Mayorizada (4 Dígitos)</span>
                            {filters.mode === 'mayorizada' && (
                                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Agrupa y totaliza los cargos y abonos por cuenta de mayor (4 dígitos) dentro de cada partida.
                        </p>
                    </button>
                </div>
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
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
            </div>

            {/* Tipo de Partida */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Filter size={12} className="text-indigo-500" /> Tipo de Partida
                </label>
                <select
                    name="entry_type_id"
                    value={filters.entry_type_id}
                    onChange={(e) => handleFilterChange('entry_type_id', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                >
                    <option value="all">Todos los tipos de partida</option>
                    {(Array.isArray(entryTypes) ? entryTypes : []).map(type => (
                        <option key={type.id} value={type.id}>
                            {type.name}
                        </option>
                    ))}
                </select>
            </div>
        </ReportLayout>
    );
};

export default ImpresionPartidas;
