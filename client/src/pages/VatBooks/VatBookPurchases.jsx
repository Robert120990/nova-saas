import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar,
    Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import ReportLayout from '../../components/ui/ReportLayout';

const VatBookPurchases = () => {
    const { user } = useAuth();
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [filters, setFilters] = useState({
        year: currentYear.toString(),
        month: currentMonth.toString(),
        branch_id: user?.branch_id || 'all'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const currentBranchId = user?.branch_id ? String(user.branch_id) : null;
    const currentBranch = branches.find((b) => String(b.id) === currentBranchId);
    const currentBranchName = currentBranch?.nombre || user?.branch_name || 'Sucursal Actual';

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = async () => {
        setIsGenerating(true);
        try {
            const response = await axios.get('/api/vat-books/purchases-pdf', {
                params: filters,
                responseType: 'blob'
            });

            // Verify response is actually a PDF and not a JSON error wrapped in blob
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
            toast.success('Libro de compras generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            // When responseType is 'blob', error.response.data is a Blob, read it
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    toast.error(json.message || json.error || 'Error al generar el libro de compras');
                    console.error('Server error details:', json);
                } catch (e) {
                    toast.error('Error al generar el libro de compras');
                }
            } else {
                toast.error(error.response?.data?.message || 'Error al generar el libro de compras');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        const scope = filters.branch_id === 'all' ? 'Contribuyente' : `Sucursal_${filters.branch_id}`;
        link.setAttribute('download', `Libro_Compras_${scope}_${filters.month}_${filters.year}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = { 
                ...filters,
                format: 'excel' 
            };
            const response = await axios.get('/api/vat-books/purchases-pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const scope = filters.branch_id === 'all' ? 'Contribuyente' : `Sucursal_${filters.branch_id}`;
            link.setAttribute('download', `Libro_Compras_${scope}_${filters.month}_${filters.year}.xlsx`);
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

    const months = [
        { id: '1', name: 'Enero' }, { id: '2', name: 'Febrero' }, { id: '3', name: 'Marzo' },
        { id: '4', name: 'Abril' }, { id: '5', name: 'Mayo' }, { id: '6', name: 'Junio' },
        { id: '7', name: 'Julio' }, { id: '8', name: 'Agosto' }, { id: '9', name: 'Septiembre' },
        { id: '10', name: 'Octubre' }, { id: '11', name: 'Noviembre' }, { id: '12', name: 'Diciembre' }
    ];

    const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

    return (
        <ReportLayout
            title="Libro de Compras"
            subtitle="Registro mensual de adquisiciones de bienes y servicios."
            category="Libros de IVA"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.year && filters.month)}
        >
            {/* Ámbito del Reporte */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Building2 size={12} className="text-indigo-500" /> Ámbito del Reporte
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                        type="button"
                        onClick={() => handleFilterChange('branch_id', 'all')}
                        className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1.5 ${
                            filters.branch_id === 'all'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <span>🏢</span> Contribuyente
                    </button>
                    <button
                        type="button"
                        onClick={() => currentBranchId && handleFilterChange('branch_id', currentBranchId)}
                        className={`py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all text-center flex items-center justify-center gap-1.5 ${
                            filters.branch_id !== 'all' && (String(filters.branch_id) === currentBranchId || !currentBranchId)
                                ? 'bg-white text-emerald-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <span>🏪</span> Sucursal Actual
                    </button>
                </div>
            </div>

            {/* Sucursal Específica */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={12} className="text-indigo-500" /> Sucursal Específica
                </label>
                <select 
                    name="branch_id"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={filters.branch_id}
                    onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                >
                    <option value="all">🏢 Por Contribuyente (Todas las sucursales)</option>
                    {currentBranchId && (
                        <option value={currentBranchId}>🏪 Sucursal Actual: {currentBranchName}</option>
                    )}
                    {branches.filter(b => String(b.id) !== currentBranchId).map(b => (
                        <option key={b.id} value={String(b.id)}>📍 {b.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Mes */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Mes del Reporte
                </label>
                <select 
                    name="month"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={filters.month}
                    onChange={(e) => handleFilterChange('month', e.target.value)}
                >
                    {months.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
            </div>

            {/* Año */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-indigo-500" /> Año
                </label>
                <select 
                    name="year"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={filters.year}
                    onChange={(e) => handleFilterChange('year', e.target.value)}
                >
                    {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
        </ReportLayout>
    );
};

export default VatBookPurchases;
