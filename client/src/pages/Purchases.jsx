import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
    Plus, 
    Trash2, 
    Save, 
    History, 
    Search, 
    X,
    Barcode,
    Check,
    Package,
    Eye,
    XCircle,
    FileSpreadsheet,
    ShoppingCart,
    Truck,
    Calculator,
    Calendar,
    AlertCircle,
    FileText as FilePdf,
    Settings,
    Edit,
    Zap,
    FileJson
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';

const Purchases = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('nuevo');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Header State
    const [branchId, setBranchId] = useState('');
    const [providerId, setProviderId] = useState('');
    const [tipoDocId, setTipoDocId] = useState('03'); // Default CCF
    const [condicionId, setCondicionId] = useState('01'); // Default Contado
    const [numeroDoc, setNumeroDoc] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [observaciones, setObservaciones] = useState('');

    // Credit Note Specific
    const [docAfectado, setDocAfectado] = useState('');
    const [fechaAfectada, setFechaAfectada] = useState('');

    // Items State
    const [selectedItems, setSelectedItems] = useState([]);
    
    // Quick Add State
    const [quickBarcode, setQuickBarcode] = useState('');
    const [quickCant, setQuickCant] = useState('1');
    const [quickCosto, setQuickCosto] = useState('0');
    const [quickProd, setQuickProd] = useState(null);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    const barcodeInputRef = useRef(null);
    const fileInputRef = useRef(null);

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
    const qtyInputRef = useRef(null);
    const costInputRef = useRef(null);

    // Summary/Totals State
    const [totals, setTotals] = useState({
        nosujeta: 0,
        exenta: 0,
        gravada: 0,
        iva: 0,
        retencion: 0,
        percepcion: 0,
        fovial: 0,
        cotrans: 0,
        total: 0
    });

    const [manualIVA, setManualIVA] = useState(0);
    const [manualRetencion, setManualRetencion] = useState(0);
    const [manualPercepcion, setManualPercepcion] = useState(0);
    const [manualNosujeta, setManualNosujeta] = useState(0);
    const [manualExenta, setManualExenta] = useState(0);

    // History State
    const [historySearch, setHistorySearch] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [viewingPurchase, setViewingPurchase] = useState(null);
    const limit = 10;

    // Date Period Validation
    const dateLimits = useMemo(() => {
        const now = new Date();
        const min = new Date();
        min.setMonth(now.getMonth() - 3); // 3 months back
        const max = new Date();
        max.setMonth(now.getMonth() + 1); // 1 month forward
        return { 
            min: min.toISOString().split('T')[0],
            max: max.toISOString().split('T')[0]
        };
    }, []);

    // Queries
    const { data: currentCompany } = useQuery({
        queryKey: ['company', user?.company_id],
        queryFn: async () => (await axios.get(`/api/companies`)).data.find(c => c.id === user.company_id),
        enabled: !!user?.company_id
    });

    const { data: providers = [] } = useQuery({
        queryKey: ['providers-all', user?.company_id],
        queryFn: async () => (await axios.get('/api/providers', { params: { limit: 5000 } })).data?.data || []
    });

    const selectedProvider = useMemo(() => {
        return providers.find(p => p.id === parseInt(providerId));
    }, [providers, providerId]);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches', user?.company_id],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products-all', user?.company_id],
        queryFn: async () => (await axios.get('/api/products', { params: { limit: 5000 } })).data?.data || []
    });

    const { data: tipoDocs = [] } = useQuery({
        queryKey: ['catalog', '002'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_002_tipo_dte')).data
    });

    const { data: condiciones = [] } = useQuery({
        queryKey: ['catalog', '016'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_016_condicion_operacion')).data
    });

    const { data: purchasesData = { data: [], totalItems: 0, totalPages: 0 }, isLoading: loadingHistory } = useQuery({
        queryKey: ['purchases', historySearch, historyPage],
        queryFn: async () => (await axios.get('/api/purchases', { 
            params: { search: historySearch, page: historyPage, limit } 
        })).data,
        enabled: activeTab === 'historial'
    });

    const { data: purchaseDetail, isLoading: loadingDetail } = useQuery({
        queryKey: ['purchase-detail', viewingPurchase?.id],
        queryFn: async () => (await axios.get(`/api/purchases/${viewingPurchase.id}`)).data,
        enabled: !!viewingPurchase?.id
    });

    const { data: activePeriod, isLoading: loadingPeriod } = useQuery({
        queryKey: ['active-period', user?.company_id],
        queryFn: async () => {
            const resp = await axios.get('/api/period-purchases');
            return resp.data;
        },
        retry: false
    });

    const { data: taxSettings } = useQuery({
        queryKey: ['tax-settings'],
        queryFn: async () => (await axios.get('/api/taxes')).data,
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/purchases', data),
        onSuccess: () => {
            toast.success('Compra registrada correctamente');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['purchases']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al procesar')
    });
    
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => axios.put(`/api/purchases/${id}`, data),
        onSuccess: () => {
            toast.success('Compra actualizada correctamente');
            resetForm();
            setActiveTab('historial');
            queryClient.invalidateQueries(['purchases']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar')
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.post(`/api/purchases/${id}/void`),
        onSuccess: () => {
            toast.success('Compra anulada correctamente');
            queryClient.invalidateQueries(['purchases']);
            queryClient.invalidateQueries(['inventory']);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al anular')
    });

    // Tax Logic SV
    useEffect(() => {
        let gravada = 0;
        let fovial = 0;
        let cotrans = 0;

        selectedItems.forEach(item => {
            const qty = parseFloat(item.cantidad || 0);
            const cost = parseFloat(item.precio_unitario || 0);
            gravada += qty * cost;

            if (item.tipo_combustible > 0) {
                fovial += qty * parseFloat(taxSettings?.fovial_rate || 0.20);
                cotrans += qty * parseFloat(taxSettings?.cotrans_rate || 0.10);
            }
        });

        // FISCAL LOGIC: For 'Factura' (01), the buyer cannot deduct IVA, so for our records IVA = 0
        const esFactura = tipoDocId === '01';
        const ivaRate = parseFloat(taxSettings?.iva_rate || 13) / 100;
        const iva = (selectedProvider?.exento_iva || esFactura) ? 0 : (gravada * ivaRate);
        
        // Advanced Fiscal Logic
        // 1. Retención (Nosotros retenemos al proveedor)
        let retencion = 0;
        const nosAgenteRetencion = currentCompany?.tipo_contribuyente === 'Gran Contribuyente';
        const proveedNoGC = !selectedProvider?.es_gran_contribuyente;
        const retencionRate = parseFloat(taxSettings?.retencion_rate || 1) / 100;
        
        if (nosAgenteRetencion && proveedNoGC && gravada >= 100 && tipoDocId === '03') {
            retencion = gravada * retencionRate;
        }

        // 2. Percepción (Proveedor nos percibe a nosotros)
        let percepcion = 0;
        const proveedAgentePerc = selectedProvider?.es_gran_contribuyente;
        const nosNoGC = currentCompany?.tipo_contribuyente !== 'Gran Contribuyente';
        const percepcionRate = parseFloat(taxSettings?.percepcion_rate || 1) / 100;

        if (proveedAgentePerc && nosNoGC && tipoDocId === '03') {
            percepcion = gravada * percepcionRate;
        }

        setTotals({
            gravada,
            iva: manualIVA || iva,
            retencion: manualRetencion || retencion,
            percepcion: manualPercepcion || percepcion,
            fovial,
            cotrans,
            nosujeta: manualNosujeta,
            exenta: selectedProvider?.exento_iva ? (manualExenta + gravada) : manualExenta,
            total: (selectedProvider?.exento_iva ? 0 : gravada) + (manualIVA || iva) + fovial + cotrans + manualNosujeta + (selectedProvider?.exento_iva ? (manualExenta + gravada) : manualExenta) - (manualRetencion || retencion) + (manualPercepcion || percepcion)
        });

    }, [selectedItems, tipoDocId, selectedProvider, currentCompany, manualIVA, manualRetencion, manualPercepcion, manualNosujeta, manualExenta, taxSettings]);

    const handleSelectProduct = (product) => {
        setQuickProd(product);
        setQuickCosto(product.costo || '0');
        setIsProductModalOpen(false);
        setProductSearch('');
        setTimeout(() => qtyInputRef.current?.focus(), 100);
    };

    const filteredProducts = useMemo(() => {
        let list = products.filter(p => p.status === 'activo');
        
        // Filter by branch if selected
        if (branchId) {
            const bid = parseInt(branchId);
            list = list.filter(p => p.branches?.includes(bid));
        }

        if (!productSearch) return list.slice(0, 50);
        const search = productSearch.toLowerCase();
        return list.filter(p => 
            p.nombre?.toLowerCase().includes(search) || 
            p.codigo?.toLowerCase().includes(search)
        ).slice(0, 50);
    }, [products, productSearch, branchId]);

    const handleBarcodeSubmit = (e) => {
        if (e.key === 'Enter' && quickBarcode) {
            const product = products.find(p => p.codigo === quickBarcode);
            if (product) {
                if (product.status !== 'activo') {
                    setQuickBarcode('');
                    return toast.error('El producto seleccionado se encuentra inactivo');
                }
                const bid = parseInt(branchId);
                if (bid && !product.branches?.includes(bid)) {
                    setQuickBarcode('');
                    return toast.error('El producto no está autorizado para esta sucursal');
                }
                setQuickProd(product);
                setQuickCosto(product.costo || '0');
                qtyInputRef.current?.focus();
            } else {
                toast.error('Producto no encontrado');
                setQuickBarcode('');
            }
        }
    };

    const handleAddQuick = () => {
        if (!quickProd) return;
        const qty = parseFloat(quickCant);
        const cost = parseFloat(quickCosto);
        if (qty <= 0) return toast.error('Cantidad inválida');

        const existing = selectedItems.find(i => i.product_id === quickProd.id);
        if (existing) {
            setSelectedItems(selectedItems.map(i => i.product_id === quickProd.id ? { 
                ...i, 
                cantidad: i.cantidad + qty,
                precio_unitario: cost,
                total: (i.cantidad + qty) * cost
            } : i));
        } else {
            setSelectedItems([...selectedItems, {
                product_id: quickProd.id,
                nombre: quickProd.nombre,
                codigo: quickProd.codigo,
                tipo_combustible: quickProd.tipo_combustible || 0,
                cantidad: qty,
                precio_unitario: cost,
                total: qty * cost
            }]);
        }

        setQuickBarcode(''); setQuickProd(null); setQuickCant('1'); setQuickCosto('0');
        barcodeInputRef.current?.focus();
    };

    const updateItem = (id, field, value) => {
        setSelectedItems(selectedItems.map(item => {
            if (item.product_id === id) {
                const updated = { ...item, [field]: value };
                updated.total = updated.cantidad * updated.precio_unitario;
                return updated;
            }
            return item;
        }));
    };

    const removeItem = (id) => {
        setSelectedItems(selectedItems.filter(item => item.product_id !== id));
    };

    const resetForm = () => {
        setSelectedItems([]); setNumeroDoc(''); setObservaciones('');
        setDocAfectado(''); setFechaAfectada('');
        setManualRetencion(0); setManualPercepcion(0); setManualNosujeta(0); setManualExenta(0);
        setIsEditing(false); setEditingId(null);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let json = JSON.parse(event.target.result);
                
                // Support both direct DTE and wrapped structures
                if (!json.identificacion && json.dte) json = json.dte;
                if (!json.identificacion && json.data) json = json.data;

                if (!json.identificacion) {
                    return toast.error("El archivo no parece ser un DTE válido de El Salvador.");
                }

                toast.info("Procesando DTE...");

                // 1. Basic Metadata
                if (json.identificacion) {
                    setFecha(json.identificacion.fecEmi || new Date().toISOString().split('T')[0]);
                    setNumeroDoc(json.identificacion.codigoGeneracion || json.identificacion.numeroControl || '');
                    if (json.identificacion.tipoDte) setTipoDocId(json.identificacion.tipoDte);
                }

                // 2. Identify Provider
                if (json.emisor) {
                    const nit = json.emisor.nit?.replace(/\D/g, '');
                    const nrc = json.emisor.nrc?.replace(/\D/g, '');
                    
                    const found = providers.find(p => {
                        const pNit = p.nit?.replace(/\D/g, '');
                        const pNrc = p.nrc?.replace(/\D/g, '');
                        return (nit && pNit === nit) || (nrc && pNrc === nrc);
                    });

                    if (found) {
                        setProviderId(found.id);
                        toast.success(`Proveedor: ${found.nombre}`);
                    } else {
                        toast.error(`Proveedor NO encontrado: NIT ${json.emisor.nit || 'desconocido'}. Debe seleccionarlo o crearlo.`, { duration: 6000 });
                        setProviderId('');
                    }
                } else {
                    toast.warning("No se encontró información del emisor en el DTE.");
                }

                // 3. Process Items
                const body = json.cuerpoDocumento;
                if (body && Array.isArray(body)) {
                    const newItems = [];
                    const missingProducts = [];
                    let matchedCount = 0;

                    body.forEach(item => {
                        const code = (item.codigo || '').toUpperCase();
                        const prod = products.find(p => p.codigo?.toUpperCase() === code);
                        
                        if (prod) {
                            newItems.push({
                                product_id: prod.id,
                                nombre: prod.nombre,
                                codigo: prod.codigo,
                                tipo_combustible: prod.tipo_combustible || 0,
                                cantidad: parseFloat(item.cantidad || 0),
                                precio_unitario: parseFloat(item.precioUni || 0),
                                total: (parseFloat(item.cantidad || 0) * parseFloat(item.precioUni || 0))
                            });
                            matchedCount++;
                        } else {
                            missingProducts.push(code || item.descripcion);
                        }
                    });

                    if (newItems.length > 0) {
                        setSelectedItems(newItems);
                        toast.success(`Se cargaron ${matchedCount} productos.`);
                    }

                    if (missingProducts.length > 0) {
                        toast.error(`Atención: ${missingProducts.length} ítems no coinciden con su catálogo: ${missingProducts.join(', ')}`, { duration: 8000 });
                    }
                } else {
                    toast.warning("El DTE no contiene una lista de ítems válida.");
                }

                // 4. Totals (Override with fiscal precision)
                if (json.resumen) {
                    setManualIVA(parseFloat(json.resumen.iva || json.resumen.totalIva || 0));
                    setManualRetencion(parseFloat(json.resumen.retencionValue || json.resumen.totalRetencion || 0));
                    setManualNosujeta(parseFloat(json.resumen.totalNoSuj || 0));
                    setManualExenta(parseFloat(json.resumen.totalExenta || 0));
                }

                toast.info("Importación completada.");
            } catch (err) {
                console.error("DTE Import Error:", err);
                toast.error("Error crítico al leer el archivo. Verifique el formato JSON.");
            }
        };
        reader.readAsText(file);
        e.target.value = null; 
    };

    const handleSubmit = () => {
        if (fecha < dateLimits.min || fecha > dateLimits.max) return toast.error('Fecha fuera de periodo permitido');
        if (!branchId || !providerId || !numeroDoc) return toast.error('Cabecera incompleta');
        if (tipoDocId === '06' && !docAfectado) return toast.error('Documento afectado es requerido para Notas de Crédito');
        if (selectedItems.length === 0) return toast.error('Agregue productos');

        const payload = {
            branch_id: branchId, provider_id: providerId, fecha, numero_documento: numeroDoc,
            tipo_documento_id: tipoDocId, condicion_operacion_id: condicionId, observaciones,
            total_nosujeta: totals.nosujeta, total_exenta: totals.exenta, total_gravada: totals.gravada,
            iva: totals.iva, retencion: totals.retencion, percepcion: totals.percepcion, 
            fovial: totals.fovial, cotrans: totals.cotrans, monto_total: totals.total,
            documento_afectado: docAfectado, fecha_afectada: fechaAfectada,
            period_year: activePeriod?.year, period_month: activePeriod?.month,
            items: selectedItems
        };

        if (isEditing && editingId) {
            updateMutation.mutate({ id: editingId, data: payload });
        } else {
            createMutation.mutate(payload);
        }
    };

    const handleDownloadPDF = async (id, numero) => {
        try {
            const response = await axios.get(`/api/purchases/pdf/${id}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Compra_${numero || id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error al descargar PDF:', error);
            toast.error('Error al descargar PDF');
        }
    };

    const handleEdit = async (purchase) => {
        const loadToast = toast.loading('Cargando datos de compra...');
        try {
            const { data: detail } = await axios.get(`/api/purchases/${purchase.id}`);
            
            setEditingId(purchase.id);
            setIsEditing(true);
            setBranchId(detail.branch_id);
            setProviderId(detail.provider_id);
            setTipoDocId(detail.tipo_documento_id);
            setCondicionId(detail.condicion_operacion_id);
            setNumeroDoc(detail.numero_documento);
            setFecha(new Date(detail.fecha).toISOString().split('T')[0]);
            setObservaciones(detail.observaciones || '');
            setDocAfectado(detail.documento_afectado || '');
            setFechaAfectada(detail.fecha_afectada ? new Date(detail.fecha_afectada).toISOString().split('T')[0] : '');
            
            // Totals
            setManualNosujeta(parseFloat(detail.total_nosujeta));
            setManualExenta(parseFloat(detail.total_exenta));
            setManualIVA(parseFloat(detail.iva));
            setManualRetencion(parseFloat(detail.retencion));
            setManualPercepcion(parseFloat(detail.percepcion));

            setSelectedItems(detail.items.map(it => ({
                product_id: it.product_id,
                nombre: it.nombre,
                codigo: it.codigo,
                tipo_combustible: products.find(p => p.id === it.product_id)?.tipo_combustible || 0,
                cantidad: parseFloat(it.cantidad),
                precio_unitario: parseFloat(it.precio_unitario),
                total: parseFloat(it.total)
            })));

            setActiveTab('nuevo');
            toast.dismiss(loadToast);
        } catch (error) {
            toast.error('Error al cargar detalle');
            toast.dismiss(loadToast);
        }
    };

    const handleExportExcel = () => {
        if (!purchasesData.data || purchasesData.data.length === 0) {
            return toast.error('No hay datos para exportar');
        }

        const dataToExport = purchasesData.data.map(p => ({
            'FECHA': new Date(p.fecha).toLocaleDateString(),
            'PROVEEDOR': p.provider_nombre || '---',
            'NRC': p.provider_nrc || '---',
            'TIPO DOC.': p.tipo_doc_nombre || '---',
            'NÚMERO': p.numero_documento || '---',
            'SUCURSAL': p.branch_nombre || '---',
            'GRAVADA': parseFloat(p.total_gravada || 0),
            'IVA': parseFloat(p.iva || 0),
            'RETENCIÓN': parseFloat(p.retencion || 0),
            'PERCEPCIÓN': parseFloat(p.percepcion || 0),
            'TOTAL': parseFloat(p.monto_total || 0),
            'ESTADO': p.status === 'voided' ? 'ANULADO' : 'ACTIVO'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'COMPRAS');
        XLSX.writeFile(wb, `Reporte_Compras_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!purchasesData.data || purchasesData.data.length === 0) {
            return toast.error('No hay datos para exportar');
        }

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('REPORTE DE COMPRAS', 14, 22);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

        const tableColumn = ["FECHA", "PROVEEDOR", "DOC.", "NÚMERO", "GRAVADA", "IVA", "TOTAL", "ESTADO"];
        const tableRows = purchasesData.data.map(p => [
            new Date(p.fecha).toLocaleDateString(),
            (p.provider_nombre || '---').substring(0, 25).toUpperCase(),
            p.tipo_doc_nombre || '---',
            p.numero_documento || '---',
            `$${parseFloat(p.total_gravada || 0).toFixed(2)}`,
            `$${parseFloat(p.iva || 0).toFixed(2)}`,
            `$${parseFloat(p.monto_total || 0).toFixed(2)}`,
            p.status === 'voided' ? 'ANULADO' : 'ACTIVO'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'striped',
            headStyles: { 
                fillColor: [79, 70, 229],
                fontSize: 8,
                halign: 'center'
            },
            bodyStyles: { fontSize: 7 },
            columnStyles: {
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'center' }
            }
        });

        doc.save(`Reporte_Compras_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const inputCls = "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[11px] font-bold uppercase tracking-tight";
    const labelCls = "block text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1 ml-1";

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black tracking-tighter text-slate-900 uppercase leading-none">Gestión de Compras</h2>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none">
                            ADministre sus compras desde aquí 
                        </span>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/50">
                    <button onClick={() => setActiveTab('nuevo')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'nuevo' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                        <Plus size={12} /> {isEditing ? 'Editando' : 'Nueva'}
                    </button>
                    <button onClick={() => setActiveTab('historial')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'historial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                        <History size={12} /> Historial
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".json" 
                        className="hidden" 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 text-amber-600 hover:bg-amber-50"
                        title="Importar desde archivo JSON oficial (Hacienda SV)"
                    >
                        <Zap size={12} className="fill-amber-500" /> Importar DTE
                    </button>
                </div>
            </div>

            {/* Redirección/Bloqueo si no hay periodo */}
            {(!activePeriod && !loadingPeriod) && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                            <Calendar size={40} className="text-amber-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Periodo Requerido</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Debe seleccionar un periodo fiscal activo para poder registrar compras en el sistema.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 w-full">
                            <button 
                                onClick={() => window.location.href = '/compras/periodo'}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                            >
                                CONFIGURAR PERIODO
                            </button>
                            <button 
                                onClick={() => window.location.href = '/dashboard'}
                                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-400 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] active:scale-95 transition-all border border-slate-100"
                            >
                                SALIR AL DASHBOARD
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'nuevo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                    <div className="lg:col-span-3 space-y-4">
                        {/* Cabecera */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Truck size={16} className="text-indigo-600" />
                                    <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-widest text-[Spanish]">Datos del Comprobante</h3>
                                </div>
                                {tipoDocId === '06' && (
                                    <div className="flex items-center gap-1.5 animate-pulse">
                                        <AlertCircle size={14} className="text-rose-500" />
                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-[Spanish]">Requiere Referencia</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-3">
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Sucursal Receptor</label>
                                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputCls}>
                                        <option value="">---</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Proveedor / Emisor</label>
                                    <div className="relative">
                                        <SearchableSelect 
                                            options={providers} value={providerId} 
                                            onChange={(e) => setProviderId(e.target.value)}
                                            valueKey="id" labelKey="nombre" placeholder="BUSCAR PROVEEDOR..."
                                            codeKey="nrc" codeLabel="NRC"
                                        />
                                        {selectedProvider && (
                                            <span className={`absolute -bottom-4 right-1 text-[8px] font-black uppercase tracking-tighter ${selectedProvider.es_gran_contribuyente ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                {selectedProvider.es_gran_contribuyente ? 'Gran Contribuyente' : 'Otros'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Fecha / Periodo Activo</label>
                                    <div className="relative group">
                                        <input type="date" value={fecha} min={dateLimits.min} max={dateLimits.max} onChange={(e) => setFecha(e.target.value)} className={`${inputCls} pr-20`} />
                                        {activePeriod && (
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black uppercase tracking-tighter">
                                                {activePeriod.year} - {activePeriod.month}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={labelCls}>Tipo Documento</label>
                                    <select value={tipoDocId} onChange={(e) => setTipoDocId(e.target.value)} className={inputCls}>
                                        {tipoDocs.map(t => <option key={t.code} value={t.code}>{t.description.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>No. Documento</label>
                                    <input type="text" value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} placeholder="0000-0000" className={inputCls} />
                                </div>
                                <div className="md:col-span-1">
                                    <label className={labelCls}>Condición Pago</label>
                                    <select value={condicionId} onChange={(e) => setCondicionId(e.target.value)} className={inputCls}>
                                        {condiciones.map(c => <option key={c.code} value={c.code}>{c.description.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                
                                {tipoDocId === '06' && (
                                    <>
                                        <div className="md:col-span-1 bg-rose-50/50 p-2 rounded-xl border border-rose-100 animate-in slide-in-from-top-2">
                                            <label className="block text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1 text-[Spanish]">Doc. Afectado</label>
                                            <input type="text" value={docAfectado} onChange={(e) => setDocAfectado(e.target.value)} placeholder="NO. FACTURA" className={`${inputCls} border-rose-100`} />
                                        </div>
                                        <div className="md:col-span-1 bg-rose-50/50 p-2 rounded-xl border border-rose-100 animate-in slide-in-from-top-2">
                                            <label className="block text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1 text-[Spanish]">Fecha Afectada</label>
                                            <input type="date" value={fechaAfectada} onChange={(e) => setFechaAfectada(e.target.value)} className={`${inputCls} border-rose-100`} />
                                        </div>
                                    </>
                                )}

                                <div className={tipoDocId === '06' ? 'md:col-span-2' : 'md:col-span-4'}>
                                    <label className={labelCls}>Observaciones / Notas</label>
                                    <input type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="OPCIONAL..." className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${(!branchId || !providerId || !tipoDocId) ? 'opacity-50 grayscale pointer-events-none select-none' : ''}`}>
                            {(!branchId || !providerId || !tipoDocId) && (
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 text-center px-10">
                                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-100 shadow-xl inline-block">
                                        <AlertCircle size={24} className="mx-auto mb-2 text-rose-500" />
                                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Complete la cabecera para agregar productos</p>
                                        <p className="text-[9px] text-slate-400 font-medium mt-1 uppercase italic">(Sucursal, Proveedor y Documento requeridos)</p>
                                    </div>
                                </div>
                            )}
                            {/* Quick Add Bar */}
                            <div className="p-3 bg-slate-50 border-b border-slate-100 grid grid-cols-[110px_1fr_70px_90px_90px_40px] gap-2 items-end">
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Cód. Producto</label>
                                    <div className="relative">
                                        <Barcode className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                        <input ref={barcodeInputRef} type="text" value={quickBarcode} onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())} onKeyDown={handleBarcodeSubmit} placeholder="SCAN..." className="w-full pl-7 pr-1 py-1 bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[10px] font-bold" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Descripción</label>
                                    <div className="w-full px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 truncate h-[26px] flex items-center">
                                        {quickProd?.nombre?.toUpperCase() || '---'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-center">Cant.</label>
                                    <input ref={qtyInputRef} type="number" value={quickCant} onChange={(e) => setQuickCant(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && costInputRef.current?.focus()} onFocus={(e) => e.target.select()} className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-[10px] font-black text-center h-[26px]" />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right">Costo Neto</label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[9px]">$</span>
                                        <input ref={costInputRef} type="number" value={quickCosto} onChange={(e) => setQuickCosto(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddQuick()} onFocus={(e) => e.target.select()} className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg outline-none text-[10px] font-black text-right h-[26px]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right pr-2">Total</label>
                                    <div className="w-full px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black text-indigo-600 text-right h-[26px] flex items-center justify-end">
                                        ${(parseFloat(quickCant || 0) * parseFloat(quickCosto || 0)).toFixed(2)}
                                    </div>
                                </div>
                                <button onClick={handleAddQuick} disabled={!quickProd} className="h-[26px] w-full bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-20 active:scale-95 transition-all">
                                    <Plus size={14} />
                                </button>
                            </div>

                            {/* Table */}
                            <div className="min-h-[250px]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/50 border-b border-slate-100 font-bold text-[9px] text-slate-400 uppercase tracking-[0.2em]">
                                        <tr>
                                            <th className="px-5 py-2">Código</th>
                                            <th className="px-5 py-2">Producto</th>
                                            <th className="px-5 py-2 text-center w-20">Cant.</th>
                                            <th className="px-5 py-2 text-right w-24">Costo U.</th>
                                            <th className="px-5 py-2 text-right w-24">Subtotal</th>
                                            <th className="px-5 py-2 text-right w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {selectedItems.length === 0 ? (
                                            <tr><td colSpan="6" className="px-5 py-16 text-center text-[9px] font-black text-slate-200 uppercase tracking-widest">Esperando Productos...</td></tr>
                                        ) : selectedItems.map(item => (
                                            <tr key={item.product_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-1.5 font-mono text-[9px] font-bold text-indigo-600">{item.codigo}</td>
                                                <td className="px-5 py-1.5 text-[10px] font-bold text-slate-600 uppercase">{item.nombre}</td>
                                                <td className="px-5 py-1.5">
                                                    <input type="number" value={item.cantidad} onChange={(e) => updateItem(item.product_id, 'cantidad', parseFloat(e.target.value))} className="w-full bg-slate-50 text-center font-black py-0.5 rounded text-[10px]" />
                                                </td>
                                                <td className="px-5 py-1.5">
                                                    <input type="number" value={item.precio_unitario} onChange={(e) => updateItem(item.product_id, 'precio_unitario', parseFloat(e.target.value))} className="w-full bg-slate-50 text-right pr-1 font-bold py-0.5 rounded text-[10px]" />
                                                </td>
                                                <td className="px-5 py-1.5 text-right font-black text-slate-900 text-[10px]">${item.total.toFixed(2)}</td>
                                                <td className="px-5 py-1.5 text-right">
                                                    <button onClick={() => removeItem(item.product_id)} className="p-1 text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-slate-900 p-5 rounded-[2rem] text-white shadow-xl space-y-5 sticky top-4">
                            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                                <Calculator size={16} className="text-indigo-400" />
                                <h3 className="font-black text-[9px] uppercase tracking-widest text-[Spanish]">Resumen de Operaciones</h3>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-0.5">
                                    <div className="text-[8px] opacity-40 font-black uppercase text-[Spanish]">Ventas Gravadas</div>
                                    <div className="text-lg font-black text-right">${(selectedProvider?.exento_iva ? 0 : totals.gravada).toFixed(2)}</div>
                                </div>
                                <div className="space-y-0.5 border-t border-white/5 pt-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[8px] opacity-40 font-black uppercase text-[Spanish]">IVA ({(taxSettings?.iva_rate || 13)}%)</span>
                                        {manualIVA > 0 && <span className="text-[7px] text-indigo-400 font-black px-1.5 py-0.5 bg-indigo-500/10 rounded uppercase tracking-tighter text-[Spanish]">Manual</span>}
                                    </div>
                                    <div className="text-sm font-black text-right text-white/90">${totals.iva.toFixed(2)}</div>
                                </div>
                                
                                {totals.fovial > 0 && (
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                        <span className="text-[8px] opacity-40 font-black uppercase text-[Spanish]">FOVIAL (${(taxSettings?.fovial_rate || 0.20)} / Gal)</span>
                                        <span className="text-sm font-black text-right text-white/90">${totals.fovial.toFixed(2)}</span>
                                    </div>
                                )}
                                
                                {totals.cotrans > 0 && (
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                        <span className="text-[8px] opacity-40 font-black uppercase text-[Spanish]">COTRANS (${(taxSettings?.cotrans_rate || 0.10)} / Gal)</span>
                                        <span className="text-sm font-black text-right text-white/90">${totals.cotrans.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                                    <div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-rose-400 uppercase text-[Spanish]">Retención ({(taxSettings?.retencion_rate || 1)}%)</span>
                                            <div className="relative group">
                                                <input type="number" step="0.01" value={totals.retencion.toFixed(2)} onChange={(e) => setManualRetencion(parseFloat(e.target.value) || 0)} className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-rose-500 group-hover:bg-white/10" />
                                                <Settings size={8} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-rose-400" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-black text-emerald-400 uppercase text-[Spanish]">Percepción ({(taxSettings?.percepcion_rate || 1)}%)</span>
                                            <div className="relative group">
                                                <input type="number" step="0.01" value={totals.percepcion.toFixed(2)} onChange={(e) => setManualPercepcion(parseFloat(e.target.value) || 0)} className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none focus:ring-1 focus:ring-emerald-500 group-hover:bg-white/10" />
                                                <Settings size={8} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-emerald-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-slate-500 uppercase text-[Spanish]">No Sujeta</span>
                                        <input type="number" step="0.01" value={manualNosujeta.toFixed(2)} onChange={(e) => setManualNosujeta(parseFloat(e.target.value) || 0)} className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none" />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[8px] font-black text-slate-500 uppercase text-[Spanish]">Exenta</span>
                                        <input type="number" step="0.01" value={totals.exenta.toFixed(2)} onChange={(e) => setManualExenta(parseFloat(e.target.value) || 0)} className="w-full bg-white/5 border border-white/10 rounded-lg py-1 px-2 text-[10px] font-black text-right outline-none" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10 mt-4 text-[Spanish]">
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 leading-none">Total</span>
                                            <span className="text-[7px] font-black opacity-30 uppercase tracking-[0.1em] mt-1 leading-none">Neto a Liquidar</span>
                                        </div>
                                        <span className="text-2xl font-black text-white leading-none">${totals.total.toFixed(2)}</span>
                                    </div>
                                    <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50">
                                        {(createMutation.isPending || updateMutation.isPending) ? 'PROCESANDO...' : (isEditing ? 'ACTUALIZAR COMPRA' : 'GUARDAR COMPRA')}
                                    </button>
                                    {isEditing && (
                                        <button onClick={resetForm} className="w-full mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">
                                            Cancelar Edición
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 animate-in fade-in duration-300">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                type="text"
                                value={historySearch}
                                onChange={(e) => setHistorySearch(e.target.value.toUpperCase())}
                                placeholder="BUSCAR POR FACTURA, PROVEEDOR..." 
                                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border-none rounded-xl outline-none text-[10px] font-bold uppercase tracking-tight" 
                            />
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={handleExportExcel} className="h-8 px-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-100 transition-all">
                                <FileSpreadsheet size={14} /> EXCEL
                            </button>
                            <button onClick={handleExportPDF} className="h-8 px-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-rose-100 transition-all">
                                <FilePdf size={14} /> PDF
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                        <Table 
                            headers={['No. Doc', 'Tipo', 'Fecha', 'Proveedor', 'Total', 'Estado', 'Acciones']}
                            data={purchasesData?.data || []} isLoading={loadingHistory}
                            compact={true}
                            renderRow={(c) => (
                                <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-50 last:border-0 grow">
                                    <td className="px-5 py-3 font-black text-slate-800 text-[10px] uppercase tracking-tighter">
                                        {c.numero_documento}
                                        {c.documento_afectado && <div className="text-[7px] text-rose-500 flex items-center gap-1 mt-0.5">REF: {c.documento_afectado}</div>}
                                    </td>
                                    <td className="px-5 py-3"><span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase">{c.tipo_documento_nombre}</span></td>
                                    <td className="px-5 py-3 text-[9px] font-bold text-slate-400">{new Date(c.fecha).toLocaleDateString()}</td>
                                    <td className="px-5 py-3 text-[10px] font-bold text-slate-600 uppercase">{c.provider_nombre}</td>
                                    <td className="px-5 py-3 font-black text-slate-900 text-[10px]">${parseFloat(c.monto_total).toFixed(2)}</td>
                                    <td className="px-5 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${c.status === 'COMPLETADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{c.status}</span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button 
                                                onClick={() => setViewingPurchase(c)} 
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Ver Detalle"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleEdit(c)} 
                                                className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleDownloadPDF(c.id, c.numero_documento)}
                                                className="p-1.5 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Exportar PDF"
                                            >
                                                <FilePdf size={14} />
                                            </button>
                                            {c.status !== 'ANULADO' && (
                                                <button 
                                                    onClick={() => { if(window.confirm('\u00BFAnular?')) voidMutation.mutate(c.id); }} 
                                                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                    title="Anular"
                                                >
                                                    <XCircle size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        />
                         <Pagination 
                            currentPage={historyPage}
                            totalPages={purchasesData.totalPages}
                            totalItems={purchasesData.totalItems}
                            onPageChange={setHistoryPage}
                            itemsOnPage={purchasesData?.data?.length || 0}
                            isLoading={loadingHistory}
                            compact={true}
                        />
                    </div>
                </div>
            )}

            {viewingPurchase && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200">
                         <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                    <Eye size={16} />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase text-[10px] tracking-widest leading-none">Detalle de Compra</h3>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Ref: {viewingPurchase.numero_documento}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewingPurchase(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={16} /></button>
                         </div>

                         <div className="p-6 overflow-y-auto space-y-6">
                            {loadingDetail ? (
                                <div className="py-20 text-center space-y-3">
                                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando información detallada...</p>
                                </div>
                            ) : purchaseDetail && (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Proveedor</label>
                                            <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{purchaseDetail.provider_nombre}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sucursal</label>
                                            <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{purchaseDetail.branch_nombre}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Fecha</label>
                                            <p className="text-[11px] font-bold text-slate-600 uppercase leading-tight">{new Date(purchaseDetail.fecha).toLocaleDateString()}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tipo Documento</label>
                                            <p className="text-[11px] font-bold text-indigo-600 uppercase leading-tight">{purchaseDetail.tipo_documento_nombre || viewingPurchase.tipo_documento_nombre || '---'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">No. Documento</label>
                                            <p className="text-[11px] font-bold text-slate-800 uppercase leading-tight">{purchaseDetail.numero_documento}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Estado</label>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${purchaseDetail.status === 'ANULADO' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {purchaseDetail.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        <label className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 block border-b border-slate-100 pb-2">Productos Comprados</label>
                                        <div className="overflow-hidden rounded-2xl border border-slate-100">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-50 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                    <tr>
                                                        <th className="px-4 py-2">Producto</th>
                                                        <th className="px-4 py-2 text-right">Cant</th>
                                                        <th className="px-4 py-2 text-right">Precio U.</th>
                                                        <th className="px-4 py-2 text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {purchaseDetail.items?.map((item, idx) => (
                                                        <tr key={idx} className="text-[10px] font-bold text-slate-600">
                                                            <td className="px-4 py-2 uppercase italic">{item.nombre}</td>
                                                            <td className="px-4 py-2 text-right font-black text-slate-800">{parseFloat(item.cantidad).toFixed(2)}</td>
                                                            <td className="px-4 py-2 text-right text-slate-400">${parseFloat(item.precio_unitario).toFixed(2)}</td>
                                                            <td className="px-4 py-2 text-right font-black text-indigo-600">${parseFloat(item.total).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-3xl flex justify-between items-center mt-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Monto Total Invertido</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase italic">Incluye impuestos registrados</p>
                                        </div>
                                        <p className="text-2xl font-black tracking-tighter text-indigo-600">${parseFloat(purchaseDetail.monto_total).toFixed(2)}</p>
                                    </div>
                                </>
                            )}
                         </div>
                    </div>
                </div>
            )}
            <ProductSelectionModal 
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                products={filteredProducts}
                handleSelect={handleSelectProduct}
            />
        </div>
    );
};

const ProductSelectionModal = ({ isOpen, onClose, productSearch, setProductSearch, products, handleSelect }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 border-none">Seleccionar Producto</h3>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Buscador rápido de ítems para compra</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>
                
                <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            autoFocus
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all font-medium"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {products.map(p => (
                            <button 
                                key={p.id}
                                onClick={() => handleSelect(p)}
                                className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left group"
                            >
                                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm group-hover:shadow-indigo-100 transition-all">
                                    <Package size={20} className="text-slate-400 group-hover:text-indigo-500" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-900 line-clamp-1">{p.nombre}</div>
                                    <div className="text-xs font-mono font-bold text-indigo-500 mt-1">{p.codigo}</div>
                                    <div className="mt-2 text-[10px] font-black uppercase text-slate-400">Stock Actual: <span className="text-slate-900">{p.stock || 0}</span></div>
                                </div>
                            </button>
                        ))}
                        {products.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                <Package size={40} className="mx-auto opacity-20 mb-2" />
                                <p className="font-bold uppercase tracking-widest text-xs italic">Cargue productos en el inventario para que aparezcan aquí</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Purchases;
