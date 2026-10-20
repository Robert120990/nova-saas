import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';
import { Plus, History, Settings } from 'lucide-react';
import { exportJsonToExcel } from '../utils/excelExport';
import {
    AdjustmentDetailModal,
    AdjustmentMotivosModal,
    AdjustmentEditModal,
    NewAdjustmentTab,
    AdjustmentHistoryTab
} from '../components/inventory';
import PdfViewerModal from '../components/ui/PdfViewerModal';
import ProductSearchModal from '../components/products/ProductSearchModal';
import { useAuth } from '../context/AuthContext';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import { formatDateDMY } from '../utils/dateUtils';
import { unwrapList } from '../utils/apiUtils';

const InventoryAdjustments = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [activeTab, setActiveTab] = useState('historial');
    const barcodeInputRef = useRef(null);
    const qtyInputRef = useRef(null);
    const costInputRef = useRef(null);

    const [branchId, setBranchId] = useState(user?.branch_id ? String(user.branch_id) : '');
    const [tipo, setTipo] = useState('ENTRADA');
    const [motivoId, setMotivoId] = useState('');
    const [numero, setNumero] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [observaciones, setObservaciones] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);

    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const limit = 10;

    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [pdfError, setPdfError] = useState(null);

    const [quickProd, setQuickProd] = useState(null);
    const [quickCant, setQuickCant] = useState(1);
    const [quickCosto, setQuickCosto] = useState(0);
    const [quickBarcode, setQuickBarcode] = useState('');

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isMotivosModalOpen, setIsMotivosModalOpen] = useState(false);
    const [viewingAdjustment, setViewingAdjustment] = useState(null);
    const [editingAdjustment, setEditingAdjustment] = useState(null);

    useDirtyTracker('ajustes', selectedItems.length > 0 || numero);

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => unwrapList(await axios.get('/api/branches'))
    });

    const { data: motivos = [] } = useQuery({
        queryKey: ['inventory-motivos'],
        queryFn: async () => unwrapList(await axios.get('/api/inventory/motivos'))
    });

    const { data: adjustmentsData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: loadingAdjustments } = useQuery({
        queryKey: ['inventory-adjustments', historySearch, historyPage, user?.branch_id],
        queryFn: async () => (await axios.get('/api/inventory/adjustments', {
            params: { search: historySearch, page: historyPage, limit, branch_id: user?.branch_id }
        })).data,
        enabled: activeTab === 'historial'
    });

    const getDefaultBranchId = () => {
        if (user?.branch_id) return String(user.branch_id);
        if (Array.isArray(branches) && branches.length === 1) return String(branches[0].id);
        return '';
    };

    useEffect(() => {
        if (!branchId) {
            const defBranch = getDefaultBranchId();
            if (defBranch) setBranchId(defBranch);
        }
    }, [branches, user?.branch_id, branchId]);

    useEffect(() => {
        const matchingMotivos = (Array.isArray(motivos) ? motivos : []).filter((m) => m.tipo === tipo);
        if (matchingMotivos.length > 0) {
            const currentValid = matchingMotivos.some((m) => String(m.id) === String(motivoId));
            if (!currentValid) {
                setMotivoId(String(matchingMotivos[0].id));
            }
        } else if (motivoId) {
            setMotivoId('');
        }
    }, [motivos, tipo, motivoId]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                if (activeTab === 'nuevo') {
                    if (!branchId) {
                        toast.error('Seleccione primero una sucursal');
                    } else {
                        setIsProductModalOpen(true);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [branchId, activeTab]);

    const resetForm = () => {
        setBranchId(getDefaultBranchId());
        const matchingMotivos = (Array.isArray(motivos) ? motivos : []).filter((m) => m.tipo === tipo);
        setMotivoId(matchingMotivos.length > 0 ? String(matchingMotivos[0].id) : '');
        setNumero('');
        setObservaciones('');
        setSelectedItems([]);
        setQuickBarcode('');
        setQuickProd(null);
    };

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/inventory/adjustments', data),
        onSuccess: () => {
            toast.success('Movimiento registrado correctamente');
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['terminal-products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
            queryClient.invalidateQueries({ queryKey: ['kardex'] });
            setActiveTab('historial');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al procesar el movimiento');
        }
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/inventory/adjustments/${id}/void`),
        onSuccess: () => {
            toast.success('Movimiento anulado correctamente');
            queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['terminal-products'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
            queryClient.invalidateQueries({ queryKey: ['kardex'] });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al anular')
    });

    const handleBarcodeSubmit = async (e) => {
        if (e.key === 'Enter' && quickBarcode) {
            const code = quickBarcode.trim();
            if (!branchId) return toast.error('Seleccione primero una sucursal');
            try {
                const { data } = await axios.get(`/api/products/lookup/${encodeURIComponent(code)}`, { params: { branch_id: branchId } });
                if (data.status !== 'activo') {
                    setQuickBarcode('');
                    return toast.error('El producto seleccionado se encuentra inactivo');
                }
                setQuickProd(data);
                setQuickCosto(data.costo || 0);
                setTimeout(() => qtyInputRef.current?.focus(), 50);
            } catch {
                toast.error('Producto no encontrado');
                setQuickBarcode('');
            }
        }
    };

    const handleAddQuick = () => {
        if (!quickProd) return;
        if (quickProd.status !== 'activo') return toast.error('El producto seleccionado se encuentra inactivo');
        if (!branchId || !motivoId) return toast.error('Seleccione la sucursal y el motivo del movimiento');
        if (Array.isArray(quickProd.branches) && quickProd.branches.length > 0 && !quickProd.branches.includes(parseInt(branchId))) {
            return toast.error(`El producto "${quickProd.nombre}" no está autorizado para esta sucursal`);
        }

        const cant = parseFloat(quickCant);
        const cost = parseFloat(quickCosto);
        if (isNaN(cant) || cant <= 0) return toast.error('Cantidad inválida');
        if (isNaN(cost) || cost < 0) return toast.error('Costo inválido');
        if (selectedItems.find((item) => item.product_id === quickProd.id)) {
            return toast.error('El producto ya está en la lista');
        }

        setSelectedItems([
            ...selectedItems,
            {
                product_id: quickProd.id,
                nombre: quickProd.nombre,
                codigo: quickProd.codigo,
                cantidad: cant,
                costo: cost,
                total: cant * cost
            }
        ]);
        setQuickProd(null);
        setQuickBarcode('');
        setQuickCant(1);
        setQuickCosto(0);
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
    };

    const handleSelectProduct = (product) => {
        setQuickProd(product);
        setQuickCosto(product.costo || 0);
        setQuickCant(1);
        setIsProductModalOpen(false);
        setTimeout(() => qtyInputRef.current?.focus(), 50);
    };

    const updateItem = (productId, field, value) => {
        setSelectedItems((prev) => prev.map((item) => {
            if (item.product_id === productId) {
                const updated = { ...item, [field]: value };
                updated.total = updated.cantidad * updated.costo;
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter((item) => item.product_id !== id));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!branchId || !motivoId || !tipo) return toast.error('Complete la configuración del encabezado');
        if (selectedItems.length === 0) return toast.error('Agregue al menos un producto');

        createMutation.mutate({
            branch_id: branchId,
            motivo_id: motivoId,
            tipo,
            numero: String(numero || ''),
            fecha,
            observaciones: String(observaciones || ''),
            items: selectedItems
        });
    };

    const handleVoidAdjustment = async (id) => {
        const ok = await confirm({
            title: '¿Anular movimiento?',
            message: 'El stock afectado será revertido automáticamente. Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, anular',
            variant: 'warning'
        });
        if (ok) voidMutation.mutate(id);
    };

    const exportToExcel = () => {
        if (!adjustmentsData?.data?.length) return toast.warning('No hay movimientos para exportar');
        const rows = adjustmentsData.data.map((a) => ({
            Documento: `AJ-${String(a.id).padStart(6, '0')}`,
            Referencia: a.numero || '',
            Fecha: formatDateDMY(a.fecha),
            Sucursal: a.branch_name,
            Motivo: a.motivo_name,
            Tipo: a.tipo,
            Items: a.items_count,
            Estado: a.status || 'COMPLETADO'
        }));
        exportJsonToExcel(rows, `Movimientos_Inventario_${new Date().toISOString().split('T')[0]}`, 'Movimientos');
    };

    const handleOpenPdfModal = async () => {
        setIsPdfModalOpen(true);
        setIsLoadingPdf(true);
        setPdfError(null);
        try {
            const response = await axios.get('/api/inventory/adjustments/reports/pdf', {
                params: {
                    branch_id: user?.branch_id || undefined,
                    search: historySearch?.trim() ? historySearch.trim() : undefined
                },
                responseType: 'blob'
            });
            if (response.data.type !== 'application/pdf') {
                const text = await response.data.text();
                let errorMsg = 'Error al generar el reporte en formato PDF';
                try { errorMsg = JSON.parse(text).message || errorMsg; } catch {}
                throw new Error(errorMsg);
            }
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            setPdfUrl(URL.createObjectURL(response.data));
        } catch (err) {
            setPdfError(err.message || 'Ocurrió un error al generar el PDF');
        } finally {
            setIsLoadingPdf(false);
        }
    };

    const totalAjuste = selectedItems.reduce((acc, item) => acc + item.total, 0);

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                        {activeTab === 'historial' ? 'Movimientos de Inventario' : 'Nuevo Movimiento de Inventario'}
                    </h2>
                    <p className="text-slate-500 mt-1 font-medium text-sm">
                        {activeTab === 'historial' ? 'Historial de ajustes, entradas y salidas de stock' : 'Registro de entradas y salidas de stock'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsMotivosModalOpen(true)}
                        className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95"
                    >
                        <Settings size={14} />
                        Motivos
                    </button>
                    {activeTab === 'historial' ? (
                        <button
                            onClick={() => { resetForm(); setActiveTab('nuevo'); }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                        >
                            <Plus size={14} />
                            Nuevo Movimiento
                        </button>
                    ) : (
                        <button
                            onClick={() => { resetForm(); setActiveTab('historial'); }}
                            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95"
                        >
                            <History size={14} />
                            Volver al Listado
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'nuevo' ? (
                <NewAdjustmentTab
                    branchId={branchId}
                    setBranchId={setBranchId}
                    branches={branches}
                    tipo={tipo}
                    setTipo={setTipo}
                    fecha={fecha}
                    setFecha={setFecha}
                    numero={numero}
                    setNumero={setNumero}
                    motivoId={motivoId}
                    setMotivoId={setMotivoId}
                    motivos={motivos}
                    observaciones={observaciones}
                    setObservaciones={setObservaciones}
                    selectedItems={selectedItems}
                    totalAjuste={totalAjuste}
                    isSubmitting={createMutation.isPending}
                    onSubmit={handleSubmit}
                    onCancel={() => { resetForm(); setActiveTab('historial'); }}
                    barcodeInputRef={barcodeInputRef}
                    qtyInputRef={qtyInputRef}
                    costInputRef={costInputRef}
                    quickBarcode={quickBarcode}
                    setQuickBarcode={setQuickBarcode}
                    handleBarcodeSubmit={handleBarcodeSubmit}
                    onOpenProductSearch={() => {
                        if (!branchId) toast.error('Seleccione primero una sucursal');
                        else setIsProductModalOpen(true);
                    }}
                    quickProd={quickProd}
                    quickCant={quickCant}
                    setQuickCant={setQuickCant}
                    quickCosto={quickCosto}
                    setQuickCosto={setQuickCosto}
                    handleAddQuick={handleAddQuick}
                    updateItem={updateItem}
                    removeItem={removeItem}
                />
            ) : (
                <AdjustmentHistoryTab
                    historySearch={historySearch}
                    setHistorySearch={setHistorySearch}
                    historyPage={historyPage}
                    setHistoryPage={setHistoryPage}
                    adjustmentsData={adjustmentsData}
                    loadingAdjustments={loadingAdjustments}
                    onExportExcel={exportToExcel}
                    onOpenPdfModal={handleOpenPdfModal}
                    onViewAdjustment={setViewingAdjustment}
                    onEditAdjustment={setEditingAdjustment}
                    onVoidAdjustment={handleVoidAdjustment}
                />
            )}

            <ProductSearchModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onSelectProduct={handleSelectProduct}
                branchId={branchId}
                mode="inventory"
            />
            <AdjustmentMotivosModal open={isMotivosModalOpen} onClose={() => setIsMotivosModalOpen(false)} tipo={tipo} motivos={motivos} />
            <AdjustmentDetailModal adjustment={viewingAdjustment} onClose={() => setViewingAdjustment(null)} />
            <AdjustmentEditModal open={!!editingAdjustment} adjustment={editingAdjustment} onClose={() => setEditingAdjustment(null)} />
            <PdfViewerModal
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                title="Reporte de Movimientos de Inventario"
                subtitle={historySearch ? `Búsqueda: "${historySearch}"` : (user?.branch_id ? `Sucursal: ${branches.find((b) => String(b.id) === String(user.branch_id))?.nombre || ''}` : 'Historial general de movimientos')}
                badge="Formato Oficial"
                pdfUrl={pdfUrl}
                isLoading={isLoadingPdf}
                loadingText="Generando reporte de movimientos en formato contable oficial..."
                error={pdfError}
                onRetry={handleOpenPdfModal}
                fileName={`Movimientos_Inventario_${new Date().toISOString().split('T')[0]}.pdf`}
                footerNote="Formato contable estándar oficial • Presentación Carta sin firmas"
            />
        </div>
    );
};

export default InventoryAdjustments;
