import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Plus, Edit, Trash2, FileText, FileSignature,
    Copy, CheckCircle2, Clock, Ban
} from 'lucide-react';
import Table from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import Money from '../../components/ui/Money';
import PdfViewerModal from '../../components/ui/PdfViewerModal';
import { useConfirm } from '../../context/ConfirmContext';
import { formatDate } from '../../utils/dateUtils';
import { unwrapList } from '../../utils/apiUtils';
import {
    ContratoLaboralModal,
    ContratosFiltersBar,
    ESTADOS_CONTRATO
} from '../../components/rh/contratos';

const ContratosLaborales = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [searchParams] = useSearchParams();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedContrato, setSelectedContrato] = useState(null);
    const [paramEmployee, setParamEmployee] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [filterDesde, setFilterDesde] = useState('');
    const [filterHasta, setFilterHasta] = useState('');
    const [page, setPage] = useState(1);

    const [pdfViewer, setPdfViewer] = useState({
        isOpen: false,
        url: null,
        isLoading: false,
        error: null,
        item: null
    });

    useEffect(() => {
        const empId = searchParams.get('empleado_id');
        const isNuevo = searchParams.get('nuevo') === '1';
        if (empId) {
            axios.get(`/api/rh/empleados/${empId}`).then((res) => {
                const emp = res.data;
                if (emp) {
                    if (isNuevo) {
                        setSelectedContrato(null);
                        setParamEmployee(emp);
                        setIsModalOpen(true);
                    } else {
                        setSearchTerm(emp.codigo || `${emp.nombres || ''} ${emp.apellidos || ''}`.trim());
                    }
                }
            }).catch((err) => {
                console.error('Error fetching employee from params:', err);
            });
        }
    }, [searchParams]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 450);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['rh-contratos-laborales', debouncedSearch, filterEstado, filterDesde, filterHasta, page],
        queryFn: async () => {
            const res = await axios.get('/api/rh/contratos-laborales', {
                params: {
                    search: debouncedSearch || undefined,
                    estado: filterEstado || undefined,
                    fecha_desde: filterDesde || undefined,
                    fecha_hasta: filterHasta || undefined,
                    page
                }
            });
            return {
                data: unwrapList(res),
                total: res.data?.total || 0,
                page: res.data?.page || 1,
                totalPages: res.data?.totalPages || 1
            };
        }
    });

    const items = Array.isArray(response.data) ? response.data : [];

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/rh/contratos-laborales/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rh-contratos-laborales'] });
            toast.success('Contrato laboral eliminado correctamente');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar el contrato');
        }
    });

    const handleDelete = async (item) => {
        const ok = await confirm({
            title: '¿Eliminar Contrato Laboral?',
            message: `¿Está seguro de eliminar el contrato ${item.codigo} de ${item.trabajador_nombre}? Esta acción no se puede deshacer.`,
            confirmLabel: 'Sí, eliminar',
            variant: 'danger'
        });
        if (ok) deleteMutation.mutate(item.id);
    };

    const handleOpenPdf = async (item) => {
        if (pdfViewer.url) window.URL.revokeObjectURL(pdfViewer.url);
        setPdfViewer({ isOpen: true, url: null, isLoading: true, error: null, item });
        try {
            const res = await axios.get(`/api/rh/contratos-laborales/${item.id}/pdf`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfViewer({ isOpen: true, url: blobUrl, isLoading: false, error: null, item });
        } catch (err) {
            console.error('Error al generar PDF de contrato:', err);
            setPdfViewer((prev) => ({
                ...prev,
                isLoading: false,
                error: 'No se pudo generar el documento PDF del contrato laboral.'
            }));
            toast.error('Error al generar el PDF del contrato laboral');
        }
    };

    const handleClosePdf = () => {
        if (pdfViewer.url) window.URL.revokeObjectURL(pdfViewer.url);
        setPdfViewer({ isOpen: false, url: null, isLoading: false, error: null, item: null });
    };

    const handleOpenCreate = () => {
        setSelectedContrato(null);
        setParamEmployee(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item) => {
        setSelectedContrato(item);
        setParamEmployee(null);
        setIsModalOpen(true);
    };

    const handleDuplicate = (item) => {
        const { id: _id, codigo: _codigo, created_at: _c, updated_at: _u, ...rest } = item;
        setParamEmployee(null);
        setSelectedContrato({ ...rest, id: null, codigo: null });
        setIsModalOpen(true);
    };

    const renderEstadoBadge = (estado) => {
        const opt = ESTADOS_CONTRATO.find((o) => o.key === estado) || ESTADOS_CONTRATO[0];
        const Icon = estado === 'anulado' ? Ban : estado === 'finalizado' ? Clock : CheckCircle2;
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${opt.color}`}>
                <Icon size={11} />
                {opt.label}
            </span>
        );
    };

    return (
        <div className="space-y-4 text-slate-900 pb-12">
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                        <FileSignature size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-900">
                            Contratos Individuales de Trabajo
                        </h2>
                        <p className="text-slate-500 text-xs font-medium">
                            Elaboración, registro e impresión oficial de contratos laborales conforme al Código de Trabajo
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={18} />
                    <span>Nuevo Contrato Laboral</span>
                </button>
            </div>

            <ContratosFiltersBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                filterEstado={filterEstado}
                onEstadoChange={(val) => { setFilterEstado(val); setPage(1); }}
                filterDesde={filterDesde}
                onDesdeChange={(val) => { setFilterDesde(val); setPage(1); }}
                filterHasta={filterHasta}
                onHastaChange={(val) => { setFilterHasta(val); setPage(1); }}
                onClear={() => {
                    setSearchTerm('');
                    setFilterEstado('');
                    setFilterDesde('');
                    setFilterHasta('');
                    setPage(1);
                }}
            />

            {/* Main Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={[
                        'Correlativo',
                        'Fecha Creación',
                        'Trabajador / DUI',
                        'Cargo / Lugar de Trabajo',
                        'Fecha Inicio',
                        'Salario Mensual',
                        'Horario / Sem.',
                        'Estado',
                        'Acciones'
                    ]}
                    data={items}
                    isLoading={isLoading}
                    renderRow={(item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2.5">
                                <span className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                    {item.codigo}
                                </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-medium text-slate-600">
                                {formatDate(item.fecha_creacion)}
                                <div className="text-[10px] text-slate-400">{item.lugar_creacion || 'SAN SALVADOR'}</div>
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="text-xs font-bold text-slate-800">{item.trabajador_nombre}</div>
                                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                                    <span>DUI: {item.num_dui || '—'}</span>
                                    {item.empleado_codigo && (
                                        <span className="text-indigo-600 font-bold">• CÓD: {item.empleado_codigo}</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="text-xs font-bold text-slate-700">{item.cargo_laboral}</div>
                                <div className="text-[10px] text-slate-500">{item.lugar_trabajo}</div>
                            </td>
                            <td className="px-3 py-2.5 text-xs font-medium text-slate-600">
                                {formatDate(item.fecha_inicio)}
                                <div className="text-[10px] text-slate-400">{item.plazo_contrato}</div>
                            </td>
                            <td className="px-3 py-2.5">
                                <Money value={item.salario_mensual} className="text-xs font-extrabold font-mono text-slate-800" />
                                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{item.lugar_pago || item.forma_pago}</div>
                            </td>
                            <td className="px-3 py-2.5">
                                <div className="text-xs font-semibold text-slate-700">{item.total_horas_semana || 44} hrs/sem</div>
                                <div className="text-[10px] text-slate-400">{item.horario_dia_inicio} a {item.horario_dia_fin}</div>
                            </td>
                            <td className="px-3 py-2.5">{renderEstadoBadge(item.estado)}</td>
                            <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleOpenPdf(item)}
                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Ver e Imprimir Contrato Oficial (PDF)"
                                    >
                                        <FileText size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleOpenEdit(item)}
                                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Editar Contrato"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDuplicate(item)}
                                        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Duplicar como plantilla para otro contrato"
                                    >
                                        <Copy size={15} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item)}
                                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Eliminar Contrato"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Pagination
                currentPage={page}
                totalPages={response.totalPages}
                totalItems={response.total}
                onPageChange={setPage}
                itemsOnPage={items.length}
                isLoading={isLoading}
            />

            <ContratoLaboralModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedContrato(null);
                    setParamEmployee(null);
                }}
                selectedContrato={selectedContrato}
                initialEmployee={paramEmployee}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['rh-contratos-laborales'] });
                }}
                onSuccessAndPrint={(savedItem) => {
                    handleOpenPdf(savedItem);
                }}
            />

            <PdfViewerModal
                isOpen={pdfViewer.isOpen}
                onClose={handleClosePdf}
                title="Contrato Individual de Trabajo"
                subtitle={pdfViewer.item ? `${pdfViewer.item.codigo || ''} • ${pdfViewer.item.trabajador_nombre || ''}` : ''}
                badge="Formato Oficial MTPS"
                pdfUrl={pdfViewer.url}
                isLoading={pdfViewer.isLoading}
                loadingText="Generando Contrato Individual de Trabajo en formato oficial (2 páginas)..."
                error={pdfViewer.error}
                onRetry={pdfViewer.item ? () => handleOpenPdf(pdfViewer.item) : null}
                fileName={`CONTRATO_LABORAL_${pdfViewer.item?.codigo || 'OFICIAL'}.pdf`}
                footerNote="Contrato Individual de Trabajo • Formato Tamaño Carta (2 Páginas)"
            />
        </div>
    );
};

export default ContratosLaborales;
