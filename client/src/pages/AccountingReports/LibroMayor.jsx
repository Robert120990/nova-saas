import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';
import ReportLayout from '../../components/ui/ReportLayout';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { unwrapList } from '../../utils/apiUtils';
import { useAuth } from '../../context/AuthContext';

const LibroMayor = () => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = useMemo(() => (companyId ? { 'x-company-id': String(companyId) } : {}), [companyId]);

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        account_id: 'all'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

    const { data: rawAccounts = [] } = useQuery({
        queryKey: ['accounts', companyId],
        queryFn: async () => unwrapList(await axios.get('/api/accounting/accounts', { headers })),
    });

    const accounts = Array.isArray(rawAccounts) ? rawAccounts : [];

    const handleFilterChange = (name, value) => {
        const cleanValue = (value && typeof value === 'object' && value.target)
            ? value.target.value
            : (value && typeof value === 'object' && 'value' in value)
                ? value.value
                : value;
        setFilters(prev => ({ ...prev, [name]: cleanValue ?? '' }));
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
                account_id: filters.account_id !== 'all' ? filters.account_id : undefined
            };

            const response = await axios.get('/api/accounting/reports/libro-mayor', {
                params,
                headers,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Libro mayor generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el libro mayor');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Libro_Mayor_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                account_id: filters.account_id !== 'all' ? filters.account_id : undefined,
                format: 'excel'
            };

            const response = await axios.get('/api/accounting/reports/libro-mayor', {
                params,
                headers,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Libro_Mayor.xlsx');
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

    const accountOptions = useMemo(() => [
        { id: 'all', code: '', nombre: 'TODAS LAS CUENTAS CON MOVIMIENTO', display: 'TODAS LAS CUENTAS CON MOVIMIENTO' },
        ...accounts.map(a => ({
            id: a.id,
            code: a.code,
            nombre: a.name,
            display: `${a.code} - ${a.name}`
        }))
    ], [accounts]);

    return (
        <ReportLayout
            title="Libro Mayor"
            subtitle="Movimientos por cuenta contable con saldos iniciales, débitos, créditos y saldos finales."
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

            {/* Cuenta Contable */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Search size={12} className="text-indigo-500" /> Cuenta Contable
                </label>
                <SearchableSelect
                    valueKey="id"
                    labelKey="nombre"
                    codeKey="code"
                    displayKey="display"
                    searchKeys={['code', 'nombre', 'display']}
                    options={accountOptions}
                    value={filters.account_id}
                    onChange={(e) => handleFilterChange('account_id', e?.target?.value ?? e)}
                    placeholder="Todas las cuentas o busque una cuenta..."
                />
            </div>
        </ReportLayout>
    );
};

export default LibroMayor;
