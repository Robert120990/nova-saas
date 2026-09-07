import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';
import ReportLayout from '../../components/ui/ReportLayout';
import SearchableSelect from '../../components/ui/SearchableSelect';

const AuxiliarOperaciones = () => {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        account_from: '',
        account_to: ''
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts'],
        queryFn: async () => (await axios.get('/api/accounting/accounts')).data,
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
                account_from: filters.account_from || undefined,
                account_to: filters.account_to || undefined
            };

            const response = await axios.get('/api/accounting/reports/auxiliar-operaciones', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Auxiliar de operaciones generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el auxiliar de operaciones');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Auxiliar_Operaciones_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                account_from: filters.account_from || undefined,
                account_to: filters.account_to || undefined,
                format: 'excel'
            };
            const response = await axios.get('/api/accounting/reports/auxiliar-operaciones', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Auxiliar_Operaciones_${filters.start_date}_al_${filters.end_date}.xlsx`);
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

    const accountOptions = [
        { id: '', nombre: '-- Todas las Cuentas --' },
        ...accounts.map(a => ({ id: a.code, nombre: `${a.code} - ${a.name}` }))
    ];

    return (
        <ReportLayout
            title="Auxiliar de Operaciones"
            subtitle="Movimiento detallado partida por partida para un rango de cuentas específico."
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

            {/* Cuenta Desde */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Search size={12} className="text-indigo-500" /> Desde la Cuenta:
                </label>
                <SearchableSelect
                    valueKey="id"
                    labelKey="nombre"
                    options={accountOptions}
                    value={filters.account_from}
                    onChange={(val) => handleFilterChange('account_from', val)}
                    placeholder="Todas las cuentas iniciales..."
                />
            </div>

            {/* Cuenta Hasta */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Search size={12} className="text-indigo-500" /> Hasta la Cuenta:
                </label>
                <SearchableSelect
                    valueKey="id"
                    labelKey="nombre"
                    options={accountOptions}
                    value={filters.account_to}
                    onChange={(val) => handleFilterChange('account_to', val)}
                    placeholder="Todas las cuentas finales..."
                />
            </div>
        </ReportLayout>
    );
};

export default AuxiliarOperaciones;
