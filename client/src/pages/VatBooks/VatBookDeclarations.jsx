import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    FileSpreadsheet,
    ShoppingBag,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { unwrapList } from '../../utils/apiUtils';
import {
    VatDeclarationsFilters,
    ComprasTab,
    AnticipoCuentaTab,
    RetencionesEmitidasTab,
    RetencionesRecibidasTab,
    PercepcionesTab
} from '../../components/vatDeclarations';

const TABS = [
    { id: 'compras', label: 'Compras', icon: ShoppingBag, endpoint: 'compras' },
    { id: 'anticipo', label: 'Anticipo 2% (Tarjetas)', icon: CreditCard, endpoint: 'anticipo-cuenta' },
    { id: 'ret_emitidas', label: 'Retenciones Emitidas (1%)', icon: ArrowUpRight, endpoint: 'retenciones-emitidas' },
    { id: 'ret_recibidas', label: 'Retenciones Recibidas (1%)', icon: ArrowDownLeft, endpoint: 'retenciones-recibidas' },
    { id: 'percepciones', label: 'Percepciones (1%)', icon: Percent, endpoint: 'percepciones' }
];

const VatBookDeclarations = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear().toString();
    const currentMonth = (currentDate.getMonth() + 1).toString();

    // Filtros
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);
    const [branchId, setBranchId] = useState('all');
    const [activeTab, setActiveTab] = useState('compras');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isExporting, setIsExporting] = useState(null);

    // Debounce de búsqueda
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reseteo al cambiar de pestaña
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
    };

    // Consulta de sucursales
    const { data: branchesData = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList(await axios.get('/api/branches'))
    });

    const activeTabConfig = TABS.find((t) => t.id === activeTab) || TABS[0];

    // Query principal de datos según la pestaña activa (sin paginación, carga directa completa)
    const { data: response, isLoading } = useQuery({
        queryKey: ['vat-declarations', activeTabConfig.id, year, month, branchId, debouncedSearch],
        queryFn: async () => {
            const params = {
                year,
                month,
                branch_id: branchId,
                search: debouncedSearch || undefined,
                limit: 'all'
            };
            const res = await axios.get(`/api/vat-books/declarations/${activeTabConfig.endpoint}`, { params });
            return res.data;
        }
    });

    const items = unwrapList(response);
    const summary = response?.summary || {};

    // Manejador de Exportación (PDF o Excel)
    const handleExport = async (format) => {
        setIsExporting(format);
        try {
            const endpoint = `/api/vat-books/declarations/${activeTabConfig.endpoint}/${format}`;
            const params = {
                year,
                month,
                branch_id: branchId,
                search: debouncedSearch || undefined
            };

            const responseType = 'blob';
            const res = await axios.get(endpoint, { params, responseType });

            const contentType = res.headers['content-type'] || '';
            const expectedMime = format === 'pdf' ? 'application/pdf' : 'spreadsheetml';

            if (!contentType.includes(expectedMime)) {
                const text = await res.data.text();
                console.error('Respuesta inesperada al exportar:', text);
                toast.error('El servidor retornó una respuesta inesperada');
                return;
            }

            const ext = format === 'pdf' ? 'pdf' : 'xlsx';
            const filename = `anexo_${activeTabConfig.endpoint}_${year}_${month}.${ext}`;

            const blob = new Blob([res.data], { type: contentType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            toast.success(format === 'pdf' ? 'PDF generado exitosamente' : 'Excel generado exitosamente');
        } catch (error) {
            console.error('Error al exportar anexo:', error);
            toast.error(`Error al exportar ${format.toUpperCase()}`);
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm shadow-indigo-200">
                        <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            Anexo de IVA Compras
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">
                            Libro de Compras, Anticipo a Cuenta 2%, Retenciones de IVA 1% y Percepciones 1%
                        </p>
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200/80 scrollbar-thin">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${
                                isActive
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                    : 'bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-200/70'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span>{tab.label}</span>
                            {isActive && summary.total_records !== undefined && (
                                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                                    {summary.total_records}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Barra de Filtros */}
            <VatDeclarationsFilters
                year={year}
                setYear={setYear}
                month={month}
                setMonth={setMonth}
                branchId={branchId}
                setBranchId={setBranchId}
                branches={branchesData}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onExportPdf={() => handleExport('pdf')}
                onExportExcel={() => handleExport('excel')}
                isExporting={isExporting}
            />

            {/* Contenido de la Pestaña Activa (sin paginación) */}
            <div>
                {activeTab === 'compras' && (
                    <ComprasTab
                        data={items}
                        summary={summary}
                        isLoading={isLoading}
                    />
                )}

                {activeTab === 'anticipo' && (
                    <AnticipoCuentaTab
                        data={items}
                        summary={summary}
                        isLoading={isLoading}
                    />
                )}

                {activeTab === 'ret_emitidas' && (
                    <RetencionesEmitidasTab
                        data={items}
                        summary={summary}
                        isLoading={isLoading}
                    />
                )}

                {activeTab === 'ret_recibidas' && (
                    <RetencionesRecibidasTab
                        data={items}
                        summary={summary}
                        isLoading={isLoading}
                    />
                )}

                {activeTab === 'percepciones' && (
                    <PercepcionesTab
                        data={items}
                        summary={summary}
                        isLoading={isLoading}
                    />
                )}
            </div>
        </div>
    );
};

export default VatBookDeclarations;
