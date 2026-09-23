import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    GitBranch,
    Calendar,
    Users,
    Monitor,
    UserCheck,
    Receipt,
    ListFilter,
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import SearchableSelect from '../components/ui/SearchableSelect';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';

const SalesDiscountsReport = () => {
    const { user } = useAuth();

    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all',
        pos_id: 'all',
        seller_id: 'all',
        customer_id: 'all',
        mode: 'summary' // 'summary' | 'detailed'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // 1. Cargar Sucursales
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList(await axios.get('/api/branches'))
    });

    // 2. Cargar Puntos de Venta (filtrados por sucursal seleccionada si aplica)
    const { data: posList = [] } = useQuery({
        queryKey: ['pos', filters.branch_id, 'activo'],
        queryFn: async () => unwrapList(await axios.get('/api/pos', {
            params: {
                branch_id: filters.branch_id !== 'all' ? filters.branch_id : undefined,
                status: 'activo'
            }
        }))
    });

    // 3. Cargar Vendedores
    const { data: sellers = [] } = useQuery({
        queryKey: ['sellers'],
        queryFn: async () => unwrapList(await axios.get('/api/sellers', { params: { limit: 500 } }))
    });

    // 4. Búsqueda remota de Clientes
    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        if (page === 1 && !search) {
            data.data = [{ id: 'all', nombre: 'TODOS LOS CLIENTES' }, ...(data.data || [])];
        }
        return data;
    };

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'branch_id' ? { pos_id: 'all' } : {})
        }));
    };

    const handleGenerateReport = async () => {
        if (!filters.start_date || !filters.end_date) {
            toast.error('Debe seleccionar un rango de fechas');
            return;
        }

        setIsGenerating(true);
        try {
            const response = await axios.get('/api/sales/reports/discounts/pdf', {
                params: {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    branch_id: filters.branch_id,
                    pos_id: filters.pos_id,
                    seller_id: filters.seller_id,
                    customer_id: filters.customer_id,
                    mode: filters.mode
                },
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte de descuentos generado exitosamente');
        } catch (error) {
            console.error('Error generating discounts report:', error);
            toast.error('Error al generar el reporte de descuentos');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Reporte_Descuentos_${filters.mode}_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        if (!filters.start_date || !filters.end_date) {
            toast.error('Debe seleccionar un rango de fechas');
            return;
        }

        try {
            const response = await axios.get('/api/sales/reports/discounts/pdf', {
                params: {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    branch_id: filters.branch_id,
                    pos_id: filters.pos_id,
                    seller_id: filters.seller_id,
                    customer_id: filters.customer_id,
                    mode: filters.mode,
                    format: 'excel'
                },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_Descuentos_${filters.start_date}_al_${filters.end_date}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('Excel exportado exitosamente');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    return (
        <ReportLayout
            title="Reporte de Descuentos"
            subtitle="Auditoría y análisis de descuentos concedidos en ventas por documento, ítem, sucursal y vendedor."
            category="Ventas"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.start_date && filters.end_date)}
            fileName={`Reporte_Descuentos_${filters.start_date}_al_${filters.end_date}.pdf`}
        >
            {/* Selector de Modo de Vista */}
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ListFilter size={13} className="text-indigo-500" /> Formato del Reporte
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                    <button
                        type="button"
                        onClick={() => handleFilterChange('mode', 'summary')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                            filters.mode === 'summary'
                                ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                        title="Resumen consolidado por factura o documento"
                    >
                        <FileText size={13} className="shrink-0" />
                        <span>Resumen</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleFilterChange('mode', 'detailed')}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                            filters.mode === 'detailed'
                                ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                        }`}
                        title="Detalle línea por línea de productos con descuento"
                    >
                        <Receipt size={13} className="shrink-0" />
                        <span>Detallado</span>
                    </button>
                </div>
                <p className="text-[10px] text-slate-400 px-1 italic">
                    {filters.mode === 'summary' ? 'Consolidado por documento emitido' : 'Desglose individual por ítem y producto'}
                </p>
            </div>

            {/* Filtro de Sucursal */}
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={13} className="text-indigo-500" /> Sucursal
                </label>
                <select
                    name="branch_id"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={filters.branch_id}
                    onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                >
                    <option value="all">Todas las sucursales</option>
                    {(Array.isArray(branches) ? branches : []).map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Filtro de Punto de Venta (POS) */}
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Monitor size={13} className="text-indigo-500" /> Punto de Venta (POS)
                </label>
                <select
                    name="pos_id"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={filters.pos_id}
                    onChange={(e) => handleFilterChange('pos_id', e.target.value)}
                >
                    <option value="all">Todos los puntos de venta</option>
                    {(Array.isArray(posList) ? posList : []).map(p => (
                        <option key={p.id} value={p.id}>
                            {p.nombre} {filters.branch_id === 'all' && p.branch_name ? `(${p.branch_name})` : ''}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filtro de Vendedor */}
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <UserCheck size={13} className="text-indigo-500" /> Vendedor / Cajero
                </label>
                <select
                    name="seller_id"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    value={filters.seller_id}
                    onChange={(e) => handleFilterChange('seller_id', e.target.value)}
                >
                    <option value="all">Todos los vendedores</option>
                    {(Array.isArray(sellers) ? sellers : []).map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Filtro de Cliente */}
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Users size={13} className="text-indigo-500" /> Cliente
                </label>
                <SearchableSelect
                    loadOptions={loadCustomersOptions}
                    value={filters.customer_id}
                    onChange={(e) => handleFilterChange('customer_id', e.target.value)}
                    placeholder="Seleccionar cliente..."
                    valueKey="id"
                    labelKey="nombre"
                    displayKey="nombre"
                />
            </div>

            {/* Fecha Inicio */}
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={13} className="text-indigo-500" /> Fecha Inicio
                </label>
                <input
                    type="date"
                    name="start_date"
                    value={filters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
            </div>

            {/* Fecha Fin */}
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={13} className="text-indigo-500" /> Fecha Fin
                </label>
                <input
                    type="date"
                    name="end_date"
                    value={filters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
            </div>
        </ReportLayout>
    );
};

export default SalesDiscountsReport;
