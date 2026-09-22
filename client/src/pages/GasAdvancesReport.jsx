import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calendar,
    Building2,
    Users,
    Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import SearchableSelect from '../components/ui/SearchableSelect';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';

const GasAdvancesReport = () => {
    const { user } = useAuth();

    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id ? String(user.branch_id) : 'all',
        cliente_id: 'all'
    });

    const [selectedClienteNombre, setSelectedClienteNombre] = useState('Todos los clientes');
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const loadCustomersOptions = async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50, es_anticipado: 1 }
        });
        return data;
    };

    const handleFilterChange = (field, val) => {
        setFilters(prev => ({ ...prev, [field]: val }));
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
                cliente_id: filters.cliente_id
            };

            const response = await axios.get('/api/gas-station/advances/report/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte generado correctamente');
        } catch (error) {
            console.error('Error generating advances report:', error);
            toast.error('Error al generar el reporte de anticipos');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Reporte_Pagos_Anticipados_${filters.start_date}_${filters.end_date}.pdf`);
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
                cliente_id: filters.cliente_id,
                format: 'excel'
            };

            const response = await axios.get('/api/gas-station/advances/report/pdf', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Reporte_Pagos_Anticipados_${filters.start_date}_${filters.end_date}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Reporte exportado a Excel correctamente');
        } catch (error) {
            console.error('Error exporting advances to Excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    const labelCls = "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5";
    const inputCls = "w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-semibold";

    return (
        <ReportLayout
            title="Reporte de Pagos Anticipados"
            subtitle="Historial consolidado con desglose de métodos de pago, referencias y saldos disponibles"
            category="Gasolinera"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            fileName={`Reporte_Pagos_Anticipados_${filters.start_date}_${filters.end_date}.pdf`}
            footerNote="Reporte oficial de pagos anticipados emitidos con cuadro resumen consolidado."
        >
            <div className="space-y-4">
                {/* Sucursal */}
                <div>
                    <label className={labelCls}>
                        <Building2 size={13} className="text-indigo-600" />
                        Sucursal
                    </label>
                    <select
                        value={filters.branch_id}
                        onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                        className={inputCls}
                    >
                        <option value="all">Todas las sucursales</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Cliente */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className={labelCls}>
                            <Users size={13} className="text-indigo-600" />
                            Cliente Anticipado
                        </label>
                        {filters.cliente_id !== 'all' && (
                            <button
                                onClick={() => {
                                    handleFilterChange('cliente_id', 'all');
                                    setSelectedClienteNombre('Todos los clientes');
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                            >
                                Limpiar filtro
                            </button>
                        )}
                    </div>
                    <SearchableSelect
                        loadOptions={loadCustomersOptions}
                        value={filters.cliente_id === 'all' ? '' : filters.cliente_id}
                        onChange={(e, opt) => {
                            if (e.target.value) {
                                handleFilterChange('cliente_id', e.target.value);
                                setSelectedClienteNombre(opt?.nombre || '');
                            } else {
                                handleFilterChange('cliente_id', 'all');
                                setSelectedClienteNombre('Todos los clientes');
                            }
                        }}
                        placeholder="Todos los clientes..."
                        valueKey="id"
                        labelKey="nombre"
                        displayKey="nombre"
                        codeKey="nrc"
                        codeLabel="NRC"
                        selectedLabel={filters.cliente_id === 'all' ? 'Todos los clientes' : selectedClienteNombre}
                        dropdownWidth={360}
                    />
                </div>

                {/* Rango de Fechas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div>
                        <label className={labelCls}>
                            <Calendar size={13} className="text-indigo-600" />
                            Fecha Desde
                        </label>
                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>
                            <Calendar size={13} className="text-indigo-600" />
                            Fecha Hasta
                        </label>
                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60 text-[11px] text-slate-600 flex items-start gap-2">
                    <Receipt size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    <span>
                        Incluye desglose por <strong>Efectivo, Tarjeta, Cheque y Transferencia</strong>, números de referencia, saldo disponible y cuadro resumen consolidado al pie del reporte.
                    </span>
                </div>
            </div>
        </ReportLayout>
    );
};

export default GasAdvancesReport;
