import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Layers } from 'lucide-react';
import { toast } from 'sonner';
import ReportLayout from '../../components/ui/ReportLayout';

const MONTHS = [
    { val: 1, name: 'Enero' },
    { val: 2, name: 'Febrero' },
    { val: 3, name: 'Marzo' },
    { val: 4, name: 'Abril' },
    { val: 5, name: 'Mayo' },
    { val: 6, name: 'Junio' },
    { val: 7, name: 'Julio' },
    { val: 8, name: 'Agosto' },
    { val: 9, name: 'Septiembre' },
    { val: 10, name: 'Octubre' },
    { val: 11, name: 'Noviembre' },
    { val: 12, name: 'Diciembre' }
];

const AnexoBalance = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [filters, setFilters] = useState({
        year: currentYear,
        month: currentMonth,
        level: 4
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = async () => {
        if (!filters.year || !filters.month) {
            toast.error('Debe seleccionar el año y el mes');
            return;
        }

        setIsGenerating(true);
        try {
            const params = {
                year: filters.year,
                month: filters.month,
                level: filters.level
            };

            const response = await axios.get('/api/accounting/reports/anexo-balance', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Anexo al balance general generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el anexo al balance general');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Anexo_Balance_${filters.year}_Mes_${filters.month}_Nivel_${filters.level}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                year: filters.year,
                month: filters.month,
                level: filters.level,
                format: 'excel'
            };
            const response = await axios.get('/api/accounting/reports/anexo-balance', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Anexo_Balance_${filters.year}_Mes_${filters.month}.xlsx`);
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
            title="Anexo al Balance General"
            subtitle="Desglose complementario de las cuentas del balance de situación distribuido por niveles."
            category="Contabilidad"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.year && filters.month)}
        >
            {/* Año Fiscal */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Año Fiscal
                </label>
                <input 
                    type="number"
                    name="year"
                    value={filters.year}
                    onChange={(e) => handleFilterChange('year', parseInt(e.target.value) || '')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    min={2000}
                    max={2099}
                />
            </div>

            {/* Mes */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Mes
                </label>
                <select
                    name="month"
                    value={filters.month}
                    onChange={(e) => handleFilterChange('month', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                >
                    {MONTHS.map(m => (
                        <option key={m.val} value={m.val}>{m.name}</option>
                    ))}
                </select>
            </div>

            {/* Nivel de Cuenta */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} className="text-indigo-500" /> Nivel de Cuenta
                </label>
                <select
                    name="level"
                    value={filters.level}
                    onChange={(e) => handleFilterChange('level', parseInt(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                >
                    <option value={1}>Nivel 1 - Clase / Mayor Principal</option>
                    <option value={2}>Nivel 2 - Grupo / Rubro</option>
                    <option value={3}>Nivel 3 - Cuenta de Mayor</option>
                    <option value={4}>Nivel 4 - Subcuenta</option>
                    <option value={5}>Nivel 5 - Auxiliar</option>
                    <option value={6}>Nivel 6 - Detalle Analítico</option>
                </select>
            </div>
        </ReportLayout>
    );
};

export default AnexoBalance;
