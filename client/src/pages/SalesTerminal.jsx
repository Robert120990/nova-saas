import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Search, 
    Plus, 
    Trash2, 
    Package, 
    User, 
    ShoppingCart, 
    CreditCard, 
    Banknote, 
    ChevronRight, 
    X, 
    Calculator,
    Tag,
    History,
    FileText,
    Zap,
    Barcode,
    Edit,
    UserPlus
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAuth } from '../context/AuthContext';

const SalesTerminal = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [activeView, setActiveView] = useState('pos'); // 'pos' o 'pago'
    
    // Logistic/Seller Auth State
    const [sellerSession, setSellerSession] = useState(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(true);
    const [authPassword, setAuthPassword] = useState('');
    
    // Header State
    const [customerId, setCustomerId] = useState('');
    const [sellerId, setSellerId] = useState('');
    const [tipoDte, setTipoDte] = useState('01'); // 01, 03, 04, 05, 07, 11
    const [condicionPago, setCondicionPago] = useState('1'); // 1=Contado, 2=Crédito
    
    // Linked Documents (NC, NR)
    const [linkedDocs, setLinkedDocs] = useState([]);
    const [isLinkedDocModalOpen, setIsLinkedDocModalOpen] = useState(false);

    // Export Data (FEX)
    const [fexData, setFexData] = useState({
        itemType: 1, // 1:Bienes, 2:Servicios
        enclosure: '',
        regime: '',
        country: '059' // El Salvador por defecto o dejar vacío
    });

    // Remission Data (NR)
    const [nrData, setNrData] = useState({
        type: '02', // Traslado de bienes
        transporterName: '',
        vehiclePlate: ''
    });
    
    // Items State
    const [cart, setCart] = useState([]);
    const [generalDiscount, setGeneralDiscount] = useState(0);

    // Payment State
    const [payments, setPayments] = useState([]);
    const [currentPayment, setCurrentPayment] = useState({
        metodo_pago: '01',
        monto: '',
        referencia: '',
        num_cheque: '',
        last_digits: ''
    });
    
    // UI State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [barcode, setBarcode] = useState('');
    
    // Quick Add State (Like Purchases)
    const [quickBarcode, setQuickBarcode] = useState('');
    const [quickProd, setQuickProd] = useState(null);
    const [quickCant, setQuickCant] = useState('1');
    const [quickPrecio, setQuickPrecio] = useState('0');
    const [quickDesc, setQuickDesc] = useState('');
    
    // Customer Management State
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [nitValue, setNitValue] = useState('');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [manualCustomerName, setManualCustomerName] = useState('');

    // Shift Management State
    const [currentShift, setCurrentShift] = useState(null);
    const [isLoadingShift, setIsLoadingShift] = useState(false);

    // Fuel Modal State
    const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
    const [fuelProd, setFuelProd] = useState(null);
    const [fuelAmount, setFuelAmount] = useState('');
    const [fuelQty, setFuelQty] = useState('');

    // Reference Management State
    const [referencingSale, setReferencingSale] = useState(null);

    // Refs for Keyboard Navigation
    const barcodeInputRef = useRef(null);
    const qtyInputRef = useRef(null);
    const priceInputRef = useRef(null);
    const descInputRef = useRef(null);
    const barcodeRef = useRef(null);

    // Queries
    const { data: currentCompany } = useQuery({
        queryKey: ['company', user?.company_id],
        queryFn: async () => (await axios.get(`/api/companies`)).data.find(c => c.id === user.company_id),
        enabled: !!user?.company_id
    });

    const { data: taxSettings } = useQuery({
        queryKey: ['tax-settings'],
        queryFn: async () => (await axios.get('/api/taxes')).data,
    });

    const { data: customers = [] } = useQuery({
        queryKey: ['customers'],
        queryFn: async () => (await axios.get('/api/customers', { params: { limit: 1000 } })).data?.data || []
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products-all', sellerSession?.branch_id],
        queryFn: async () => (await axios.get('/api/products', { params: { limit: 5000, branch_id: sellerSession?.branch_id } })).data?.data || [],
        enabled: !!sellerSession?.branch_id
    });

    const { data: combos = [] } = useQuery({
        queryKey: ['combos-all', sellerSession?.branch_id],
        queryFn: async () => (await axios.get('/api/combos', { params: { limit: 1000, branch_id: sellerSession?.branch_id } })).data?.data || [],
        enabled: !!sellerSession?.branch_id
    });

    const { data: sellers = [] } = useQuery({
        queryKey: ['sellers'],
        queryFn: async () => (await axios.get('/api/sellers', { params: { limit: 1000 } })).data?.data || []
    });

    const { data: customerSales = [], isLoading: isLoadingCustomerSales } = useQuery({
        queryKey: ['customer-sales', customerId],
        queryFn: async () => (await axios.get(`/api/sales?customer_id=${customerId}&status=emitido&only_processed=true&exclude_has_nc=true&limit=100`)).data?.data || [],
        enabled: !!customerId && tipoDte === '05'
    });

    const { data: customerDiscounts = [] } = useQuery({
        queryKey: ['customer-discounts', sellerSession?.branch_id],
        queryFn: async () => (await axios.get('/api/customer-discounts', { params: { branch_id: sellerSession?.branch_id } })).data,
        enabled: !!sellerSession?.branch_id
    });

    // Helper to get specific customer discount
    const getCustomerDiscount = (productId) => {
        if (!selectedCustomerData?.id || !productId) return null;
        return customerDiscounts.find(d => d.product_id === productId && d.customer_id === selectedCustomerData.id);
    };

    const calculateDiscountedPrice = (originalPrice, discount) => {
        if (!discount) return originalPrice;
        if (discount.discount_type === 'PORCENTAJE') {
            return originalPrice * (1 - parseFloat(discount.discount_value) / 100);
        }
        return Math.max(0, originalPrice - parseFloat(discount.discount_value));
    };

    // Catalogs for Customer Modal
    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => (await axios.get('/api/catalogs/departments')).data
    });

    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept
    });

    const { data: activities = [] } = useQuery({
        queryKey: ['catalogs', 'actividades'],
        queryFn: async () => (await axios.get('/api/catalogs/actividades')).data
    });

    const { data: personTypes = [] } = useQuery({
        queryKey: ['catalogs', 'cat_029_tipo_persona'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_029_tipo_persona')).data
    });

    const { data: countries = [] } = useQuery({
        queryKey: ['catalogs', 'cat_020_pais'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_020_pais')).data
    });

    const { data: paymentMethods = [] } = useQuery({
        queryKey: ['catalogs', 'cat_017_forma_pago'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_017_forma_pago')).data
    });

    const { data: condiciones = [] } = useQuery({
        queryKey: ['catalogs', 'cat_016_condicion_operacion'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_016_condicion_operacion')).data
    });

    // Helper: Format NIT
    const formatNIT = (value) => {
        const digits = value.replace(/\D/g, '');
        let formatted = '';
        if (digits.length > 0) formatted += digits.substring(0, 4);
        if (digits.length > 4) formatted += '-' + digits.substring(4, 10);
        if (digits.length > 10) formatted += '-' + digits.substring(10, 13);
        if (digits.length > 13) formatted += '-' + digits.substring(13, 14);
        return formatted;
    };

    // Helper: Find selected customer data
    const selectedCustomerData = useMemo(() => {
        return customers.find(c => c.id === parseInt(customerId));
    }, [customerId, customers]);
    
    // Búsqueda optimizada (F3) para evitar lentitud con miles de ítems
    const { filteredProducts, filteredCombos } = useMemo(() => {
        if (!isProductModalOpen) return { filteredProducts: [], filteredCombos: [] };
        
        const search = productSearch.toLowerCase().trim();
        if (!search) {
            return {
                filteredCombos: combos.slice(0, 10),
                filteredProducts: products.slice(0, 50)
            };
        }

        const fCombos = combos.filter(c => 
            (c.name || '').toLowerCase().includes(search) || 
            (c.barcode || '').toLowerCase().includes(search)
        );

        const fProducts = products.filter(p => 
            (p.nombre || '').toLowerCase().includes(search) || 
            (p.codigo || '').toLowerCase().includes(search) ||
            (p.codigo_barra || '').toLowerCase().includes(search)
        );

        return {
            filteredCombos: fCombos.slice(0, 20),
            filteredProducts: fProducts.slice(0, 100)
        };
    }, [products, combos, productSearch, isProductModalOpen]);

    const handleEditCustomer = () => {
        if (!selectedCustomerData) return;
        setEditingCustomer(selectedCustomerData);
        setSelectedDept(selectedCustomerData.departamento || '');
        setSelectedMun(selectedCustomerData.municipio || '');
        setSelectedActivity(selectedCustomerData.codigo_actividad || '');
        setNitValue(selectedCustomerData.nit || '');
        setIsCustomerModalOpen(true);
    };

    const handleCustomerSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.aplica_iva = formData.get('aplica_iva') === 'on';
        data.exento_iva = formData.get('exento_iva') === 'on';
        data.aplica_fovial = formData.get('aplica_fovial') === 'on';
        data.aplica_cotrans = formData.get('aplica_cotrans') === 'on';
        data.codigo_actividad = selectedActivity;

        try {
            let res;
            if (editingCustomer) {
                res = await axios.put(`/api/customers/${editingCustomer.id}`, data);
                toast.success('Cliente actualizado');
            } else {
                res = await axios.post('/api/customers', data);
                toast.success('Cliente registrado');
                setCustomerId(res.data.id); // Auto-select new customer
            }
            queryClient.invalidateQueries(['customers']);
            setIsCustomerModalOpen(false);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al guardar cliente');
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                setIsProductModalOpen(true);
            }
            if (e.key === 'F9') {
                e.preventDefault();
                setIsLinkedDocModalOpen(true);
            }
            if (e.key === 'F10') {
                e.preventDefault();
                if (cart.length > 0) goToPayment();
            }
            if (e.key === 'Escape' && isAuthModalOpen) {
                navigate('/dashboard');
            }

            // Document Type Switching (Up/Down Arrows) - ONLY in Auth Modal
            if (isAuthModalOpen) {
                const allowedTypes = ['01', '03', '04', '05', '07', '11'];
                const typeNames = {
                    '01': 'Factura (01)',
                    '03': 'Crédito Fiscal (03)',
                    '04': 'Nota Remisión (04)',
                    '05': 'Nota Crédito (05)',
                    '07': 'Comprobante Retención (07)',
                    '11': 'Factura de Exportación (11)'
                };
                const currentIndex = allowedTypes.indexOf(tipoDte);

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const nextIndex = (currentIndex + 1) % allowedTypes.length;
                    const nextType = allowedTypes[nextIndex];
                    setTipoDte(nextType);
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prevIndex = (currentIndex - 1 + allowedTypes.length) % allowedTypes.length;
                    const prevType = allowedTypes[prevIndex];
                    setTipoDte(prevType);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length, isAuthModalOpen, tipoDte, navigate]);

    // Auto-focus barcode input when starting POS
    useEffect(() => {
        if (activeView === 'pos' && !isAuthModalOpen && !isProductModalOpen && !isLinkedDocModalOpen) {
            setTimeout(() => barcodeInputRef.current?.focus(), 300);
        }
    }, [activeView, isAuthModalOpen, isProductModalOpen, isLinkedDocModalOpen]);

    // Check shift status on mount or when seller session changes
    useEffect(() => {
        const checkStatus = async () => {
            if (sellerSession) {
                console.log('[DEBUG-POS-SHIFT] Iniciando verificación para:', {
                    pos_id: sellerSession.pos_id,
                    seller_id: sellerSession.seller_id
                });
                setIsLoadingShift(true);
                try {
                    const res = await axios.get(`/api/shifts/current?pos_id=${sellerSession.pos_id}&seller_id=${sellerSession.seller_id}`);
                    console.log('[DEBUG-POS-SHIFT] Respuesta:', res.data);
                    
                    if (res.data.open) {
                        setCurrentShift(res.data.shift);
                    } else {
                        setCurrentShift(null);
                        toast.error('Debe abrir un turno para vender. Redirigiendo...');
                        navigate('/ventas/cierre');
                    }
                } catch (error) {
                    console.error('[DEBUG-POS-SHIFT] Error:', error);
                    setCurrentShift(null);
                } finally {
                    setIsLoadingShift(false);
                }
            } else {
                setIsLoadingShift(false);
                setCurrentShift(null);
            }
        };
        checkStatus();
    }, [sellerSession, navigate]);

    const validateCustomerData = () => {
        // Si no hay cliente seleccionado, solo permitimos Factura (01) y Nota Remisión (04) como Consumidor Final
        if (!customerId) {
            if (tipoDte === '03' || tipoDte === '05' || tipoDte === '11' || tipoDte === '07') {
                toast.error(`El cliente es obligatorio para el tipo de documento: ${tipoDte}`);
                return false;
            }
            
            // Si es Nota de Remisión (04) sin cliente, validar transporte
            if (tipoDte === '04') {
                if (!nrData.transporterName || !nrData.vehiclePlate) {
                    toast.error('Nombre del transportista y Placa son obligatorios para Nota de Remisión');
                    return false;
                }
            }
            return true; 
        }

        // Si hay cliente seleccionado, validar según tipo de DTE
        const customer = selectedCustomerData;
        const missing = [];

        if (tipoDte === '03') { // Crédito Fiscal
            if (!customer.nit) missing.push('NIT');
            if (!customer.nrc) missing.push('NRC');
            if (!customer.codigo_actividad) missing.push('Giro/Actividad');
            if (!customer.departamento) missing.push('Departamento');
            if (!customer.municipio) missing.push('Municipio');
            if (!customer.direccion) missing.push('Dirección');
        } else if (tipoDte === '01') { // Factura
            if (!customer.numero_documento && !customer.nit) missing.push('DUI o NIT');
            if (!customer.departamento) missing.push('Departamento');
            if (!customer.municipio) missing.push('Municipio');
            if (!customer.direccion) missing.push('Dirección');
        } else if (tipoDte === '11') { // FEX
            if (!customer.numero_documento) missing.push('Doc. Identidad');
            if (!customer.pais || customer.pais === '059') missing.push('País de Destino (Extranjero)');
            if (!customer.direccion) missing.push('Dirección');
        } else if (tipoDte === '05') { // Nota de Crédito
            if (!customer.nit && !customer.numero_documento) missing.push('NIT o DUI');
            if (!customer.departamento) missing.push('Departamento');
            if (!customer.municipio) missing.push('Municipio');
            if (!customer.direccion) missing.push('Dirección');
        } else if (tipoDte === '07') { // Comprobante de Retención
            if (!customer.nit) missing.push('NIT');
            if (!customer.nrc) missing.push('NRC');
            if (!customer.codigo_actividad) missing.push('Giro/Actividad');
            if (!customer.departamento) missing.push('Departamento');
            if (!customer.municipio) missing.push('Municipio');
            if (!customer.direccion) missing.push('Dirección');
            if (!customer.telefono) missing.push('Teléfono');
            if (!customer.correo) missing.push('Correo');
        } else if (tipoDte === '04') { // Nota de Remisión con Cliente
            if (!nrData.transporterName) missing.push('Nombre Chofer');
            if (!nrData.vehiclePlate) missing.push('Placa Vehículo');
            if (!customer.departamento) missing.push('Depto Destino');
            if (!customer.municipio) missing.push('Munic. Destino');
            if (!customer.direccion) missing.push('Dirección Destino');
        }

        if (missing.length > 0) {
            const docName = tipoDte === '03' ? 'Crédito Fiscal' : 
                            tipoDte === '07' ? 'Retención' : 
                            tipoDte === '05' ? 'Nota de Crédito' : 
                            tipoDte === '04' ? 'Nota de Remisión' : 'el DTE';
            toast.error(`Faltan datos obligatorios para ${docName}: ${missing.join(', ')}`);
            return false;
        }

        return true;
    };

    const goToPayment = () => {
        if (cart.length === 0) return;
        if (validateCustomerData()) {
            setActiveView('pago');
            // Sugerir pago total en efectivo por defecto (Solicitado por usuario para agilidad)
            setPayments([{ 
                metodo_pago: '01', 
                monto: totals.total.toFixed(2),
                referencia: '',
                extra: '',
                methodName: 'Efectivo'
            }]);
            
            setCurrentPayment({
                metodo_pago: '01',
                monto: '',
                referencia: '',
                num_cheque: '',
                last_digits: ''
            });
        }
    };

    // Mutation
    const processSale = useMutation({
        mutationFn: async (saleData) => {
            return (await axios.post('/api/sales', saleData)).data;
        },
        onSuccess: () => {
            toast.success('Venta procesada correctamente');
            setCart([]);
            setCustomerId('');
            setLinkedDocs([]);
            setActiveView('pos');
            // Reset Session for Next Sale
            setSellerSession(null);
            setSellerId('');
            setReferencingSale(null);
            setIsAuthModalOpen(true);
            queryClient.invalidateQueries(['sales']);
        },
        onError: (error) => {
            toast.error('Error al procesar venta: ' + (error.response?.data?.message || error.message));
        }
    });

    const handleProcessSale = () => {
        if (tipoDte === '05' && referencingSale) {
            if (totals.total > (parseFloat(referencingSale.total_pagar) + 0.01)) {
                return toast.error(`El monto de la Nota de Crédito ($${totals.total.toFixed(2)}) no puede ser mayor al documento original ($${parseFloat(referencingSale.total_pagar).toFixed(2)})`);
            }
        }

        // Validar que el total pagado cubra la venta (excepto crédito)
        const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.monto), 0);
        if (condicionPago === '1' && totalPaid < (totals.total - 0.01)) {
            return toast.error('El monto pagado es insuficiente para una venta al contado');
        }

        const saleData = {
            header: {
                customer_id: customerId || null,
                seller_id: sellerId || null,
                pos_id: sellerSession?.pos_id || null,
                shift_id: currentShift?.id || null,
                dte_type: tipoDte,
                tipo_documento: tipoDte, 
                payment_condition: condicionPago,
                condicion_operacion: condicionPago,
                total_iva: totals.iva,
                total_retencion: totals.retencion,
                total_percepcion: totals.percepcion,
                total_nosujetas: totals.noSujeto,
                total_exento: totals.exento,
                total_gravado: totals.gravadoNeto,
                descuento_general: generalDiscount,
                fovial: totals.fovial,
                cotrans: totals.cotrans,
                total_pagar: totals.total,
                export_item_type: tipoDte === '11' ? fexData.itemType : null,
                fiscal_enclosure: tipoDte === '11' ? fexData.enclosure : null,
                export_regime: tipoDte === '11' ? fexData.regime : null,
                dest_country_code: tipoDte === '11' ? fexData.country : null,
                remission_type: tipoDte === '04' ? nrData.type : null,
                transporter_name: tipoDte === '04' ? nrData.transporterName : null,
                vehicle_plate: tipoDte === '04' ? nrData.vehiclePlate : null,
                cliente_nombre: !customerId ? manualCustomerName : null,
            },
            items: cart.map((item, idx) => {
                const itemFovial = item.tipo_combustible > 0 ? (item.cantidad * parseFloat(taxSettings?.fovial_rate || 0.20)) : 0;
                const itemCotrans = item.tipo_combustible > 0 ? (item.cantidad * parseFloat(taxSettings?.cotrans_rate || 0.10)) : 0;
                const subtotal = (item.precio * item.cantidad) - item.descuento;
                
                return {
                    num_item: idx + 1,
                    product_id: item.isManual ? null : item.id,
                    descripcion: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio,
                    monto_descuento: item.descuento,
                    venta_gravada: !item.exento && !item.no_sujeto ? (subtotal - itemFovial - itemCotrans) : 0,
                    venta_exenta: item.exento ? subtotal : 0,
                    tributos: (item.tipo_combustible > 0 && tipoDte !== '04') ? [
                        { codigo: "D1", descripcion: "FOVIAL", valor: itemFovial },
                        { codigo: "C8", descripcion: "COTRANS", valor: itemCotrans }
                    ] : [],
                    referencedDoc: item.referencedDoc || null
                };
            }),
            payments: payments.map(p => ({
                codigo: p.metodo_pago,
                monto: parseFloat(p.monto),
                referencia: p.referencia || p.num_cheque || p.last_digits || null
            })),
            linkedDocuments: (tipoDte === '04' || tipoDte === '05') ? linkedDocs : []
        };
        processSale.mutate(saleData);
    };

    // Totals Calculation
    const totals = useMemo(() => {
        let gravadoBruto = 0; // Precio con IVA incluido
        let exento = 0;
        let noSujeto = 0;
        let fovial = 0;
        let cotrans = 0;

        cart.forEach(item => {
            const price = parseFloat(item.precio) || 0;
            const qty = parseFloat(item.cantidad) || 0;
            const disc = parseFloat(item.descuento) || 0;
            const subtotal = (price * qty) - disc;

            if (item.exento) exento += subtotal;
            else if (item.no_sujeto) noSujeto += subtotal;
            else {
                // FOVIAL/COTRANS only for non-Remission notes
                if (item.tipo_combustible > 0 && tipoDte !== '04') {
                    const itemFovial = qty * parseFloat(taxSettings?.fovial_rate || 0.20);
                    const itemCotrans = qty * parseFloat(taxSettings?.cotrans_rate || 0.10);
                    fovial += itemFovial;
                    cotrans += itemCotrans;
                    gravadoBruto += (subtotal - itemFovial - itemCotrans);
                } else {
                    gravadoBruto += subtotal;
                }
            }
        });

        const ivaRate = parseFloat(taxSettings?.iva_rate || 13) / 100;
        // En SV el precio de venta al consumidor ya suele llevar IVA.
        // Si es Factura (01) o Crédito Fiscal (03), hay que desglosarlo internamente.
        // Asumiendo que `gravadoBruto` ya incluye IVA:
        const iva = gravadoBruto - (gravadoBruto / (1 + ivaRate));
        const gravadoNeto = gravadoBruto - iva;
        const subtotalGeneral = gravadoBruto + exento + noSujeto + fovial + cotrans;
        
        // Retención y Percepción
        let retencion = 0;
        let percepcion = 0;
        const nosAgenteRetencion = currentCompany?.tipo_contribuyente === 'Gran Contribuyente';
        const clienteGC = selectedCustomerData?.es_gran_contribuyente;
        
        const retencionRate = parseFloat(taxSettings?.retencion_rate || 1) / 100;
        const percepcionRate = parseFloat(taxSettings?.percepcion_rate || 1) / 100;

        if (tipoDte === '03' && gravadoNeto >= 100) {
            if (!nosAgenteRetencion && clienteGC) {
                // Nosotros no somos GC, pero el Cliente SÍ lo es -> Ellos nos retienen el 1% de nuestra venta
                retencion = gravadoNeto * retencionRate;
            } else if (nosAgenteRetencion && !clienteGC) {
                // Nosotros somos GC, y el Cliente NO lo es -> Nosotros les percibimos el 1% adicional
                percepcion = gravadoNeto * percepcionRate;
            }
        }

        const totalFinal = subtotalGeneral - retencion + percepcion - generalDiscount;

        // Visualización dinámica según tipo de DTE
        // En Factura (01), el IVA se muestra como 0.0 (porque ya está en Gravadas)
        // En Crédito Fiscal (03), se desglosa el Neto y el IVA
        const viewIva = tipoDte === '01' ? 0 : iva;
        const viewGravadas = tipoDte === '01' ? gravadoBruto : gravadoNeto;

        return {
            gravadoBruto,
            gravadoNeto,
            iva,
            viewIva,
            viewGravadas,
            exento,
            noSujeto,
            fovial,
            cotrans,
            retencion,
            percepcion,
            subtotal: subtotalGeneral,
            montoOperacion: subtotalGeneral,
            total: Math.max(0, totalFinal)
        };
    }, [cart, generalDiscount, currentCompany, selectedCustomerData, tipoDte, taxSettings]);

    const addToCart = (itemData, isCombo = false) => {
        const itemId = isCombo ? `combo-${itemData.id}` : itemData.id;
        const itemName = itemData.nombre || itemData.name;
        let itemPrice = itemData.precio_unitario || itemData.price || 0;

        // Regla de Negocio: Nota de Remisión siempre tiene precio simbólico
        if (tipoDte === '04') {
            itemPrice = 0.00001;
        }

        // Validación de precio 0 cuando no se permite editar
        if (!sellerSession?.allow_price_edit && itemPrice <= 0) {
            return toast.error('No se permite agregar productos con precio 0 sin autorización de edición.');
        }
        const existing = cart.find(item => 
            isCombo ? (item.combo_id === itemData.id) : (item.id === itemData.id && !item.isManual && !item.combo_id)
        );

        if (itemData.tipo_combustible > 0 && !isCombo) {
            setFuelProd(itemData);
            setFuelAmount(itemData.precio_unitario || itemData.price);
            setFuelQty('1');
            setIsFuelModalOpen(true);
            setIsProductModalOpen(false);
            setProductSearch('');
            return;
        }

        if (existing) {
            setCart(cart.map(item => 
                (isCombo ? item.combo_id === itemData.id : (item.id === itemData.id && !item.isManual && !item.combo_id))
                ? { ...item, cantidad: item.cantidad + 1 } 
                : item
            ));
        } else {
            setCart([...cart, {
                id: isCombo ? null : itemData.id,
                combo_id: isCombo ? itemData.id : null,
                nombre: itemName,
                codigo: itemData.codigo || itemData.barcode,
                tipo_combustible: itemData.tipo_combustible || 0,
                precio: itemData.precio_unitario || itemData.price,
                cantidad: 1,
                descuento: 0,
                exento: false,
                isManual: false,
                referencedDoc: itemData.referencedDoc || null
            }]);
        }
        setIsProductModalOpen(false);
        setProductSearch('');
        toast.success(`${isCombo ? 'Combo' : 'Producto'} añadido: ${itemName}`);
        // Devolver foco al buscador de código
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
    };

    const handleAddFuelToCart = () => {
        const qty = parseFloat(fuelQty);
        const discountRule = getCustomerDiscount(fuelProd?.id);
        const price = calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), discountRule);
        
        // Validación de precio 0 cuando no se permite editar
        if (!sellerSession?.allow_price_edit && price <= 0) {
            return toast.error('No se permite agregar combustible con precio 0 sin autorización de edición.');
        }

        if (qty > 0) {
            let finalPrice = price;
            if (tipoDte === '04') finalPrice = 0.00001;

            setCart([...cart, {
                id: fuelProd.id,
                nombre: fuelProd.nombre,
                codigo: fuelProd.codigo,
                tipo_combustible: fuelProd.tipo_combustible,
                precio: finalPrice,
                cantidad: qty,
                descuento: 0,
                exento: false,
                isManual: false
            }]);
            setIsFuelModalOpen(false);
            setFuelAmount('');
            setFuelQty('');
            toast.success('Combustible añadido');
            setTimeout(() => barcodeInputRef.current?.focus(), 100);
        } else {
            toast.error('Ingrese un monto o cantidad válida');
        }
    };

    const handleBarcodeSubmit = (e) => {
        if (e.key === 'Enter' && quickBarcode) {
            // Buscar primero en productos
            const product = products.find(p => p.codigo === quickBarcode || p.codigo_barra === quickBarcode);
            if (product) {
                if (product.status === 'inactivo') {
                    setQuickBarcode('');
                    return toast.error('El producto se encuentra inactivo');
                }
                
                if (product.tipo_combustible > 0) {
                    setFuelProd(product);
                    setFuelAmount(product.precio_unitario || '0');
                    setFuelQty('1');
                    setIsFuelModalOpen(true);
                    setQuickBarcode('');
                    return;
                }

                const discountRule = getCustomerDiscount(product.id);
                const finalPrice = calculateDiscountedPrice(product.precio_unitario || 0, discountRule);

                setQuickProd(product);
                setQuickPrecio(finalPrice.toFixed(2));
                setQuickDesc(product.nombre);
                setQuickCant('1');
                
                if (discountRule) {
                    // Si hay descuento de cliente, saltar precio directamente a agregar
                    toast.info('Descuento de cliente aplicado');
                    // timeout para asegurar que el estado se actualizó antes de handleAddQuick o dejar en cantidad
                    qtyInputRef.current?.focus();
                } else {
                    qtyInputRef.current?.focus();
                }
            } else {
                // Si no es producto, buscar en combos
                const combo = combos.find(c => c.barcode === quickBarcode);
                if (combo) {
                    if (combo.status === 'inactive') {
                        setQuickBarcode('');
                        return toast.error('El combo se encuentra inactivo');
                    }
                    // Los combos se añaden directamente o se pueden pre-cargar igual que productos
                    const discountRule = getCustomerDiscount(combo.id); // Note: Assuming combos can also have discounts if product_id logic allows
                    const finalPrice = calculateDiscountedPrice(combo.price || 0, discountRule);

                    setQuickProd({ ...combo, nombre: combo.name, precio_unitario: combo.price, isCombo: true });
                    setQuickPrecio(finalPrice.toFixed(2));
                    setQuickDesc(combo.name);
                    setQuickCant('1');
                    
                    if (discountRule) toast.info('Descuento de cliente aplicado');
                    qtyInputRef.current?.focus();
                } else {
                    toast.error('Producto o Combo no encontrado');
                    setQuickBarcode('');
                }
            }
        }
    };

    const handleAddQuick = () => {
        const qty = parseFloat(quickCant);
        let price = parseFloat(quickPrecio);

        // Regla de Negocio: Nota de Remisión siempre tiene precio simbólico
        if (tipoDte === '04') {
            price = 0.00001;
        }

        // Validación de precio 0 cuando no se permite editar
        if (!sellerSession?.allow_price_edit && price <= 0 && quickProd) {
            return toast.error('No se permite agregar productos con precio 0 sin autorización de edición.');
        }

        if (quickProd) {
            if (qty <= 0) return toast.error('Cantidad inválida');
            const isCombo = quickProd.isCombo === true;
            
            const existing = cart.find(item => 
                isCombo ? (item.combo_id === quickProd.id) : (item.id === quickProd.id && !item.isManual && !item.combo_id)
            );

            if (existing) {
                setCart(cart.map(item => 
                    (isCombo ? item.combo_id === quickProd.id : (item.id === quickProd.id && !item.isManual && !item.combo_id))
                    ? { ...item, cantidad: item.cantidad + qty, precio: price } 
                    : item
                ));
            } else {
                setCart([...cart, {
                    id: isCombo ? null : quickProd.id,
                    combo_id: isCombo ? quickProd.id : null,
                    nombre: (quickProd.nombre || quickProd.name),
                    codigo: (quickProd.codigo || quickProd.barcode),
                    tipo_combustible: quickProd.tipo_combustible || 0,
                    precio: price,
                    cantidad: qty,
                    descuento: 0,
                    exento: false,
                    isManual: false
                }]);
            }
            toast.success(`${isCombo ? 'Combo' : 'Producto'} añadido al carrito`);
        } else if (quickDesc.trim()) {
            // Nota Manual
            const id = Date.now();
            setCart([...cart, {
                id,
                nombre: quickDesc.trim().toUpperCase(),
                codigo: '',
                precio: 0,
                cantidad: 1,
                descuento: 0,
                isManual: true
            }]);
            toast.success('Nota añadida');
        } else {
            return;
        }

        setQuickBarcode('');
        setQuickProd(null);
        setQuickDesc('');
        setQuickCant('1');
        setQuickPrecio('0');
        barcodeInputRef.current?.focus();
    };

    const addManualItem = () => {
        if (!sellerSession?.allow_price_edit) {
            return toast.error('No tiene permisos para agregar conceptos manuales (requiere edición de precio).');
        }
        const id = Date.now();
        setCart([...cart, {
            id,
            nombre: 'Nuevo Concepto...',
            codigo: 'VAR-01',
            precio: 0,
            cantidad: 1,
            descuento: 0,
            isManual: true
        }]);
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateItem = (id, field, value) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                // Validación para Nota de Crédito (05)
                if (tipoDte === '05') {
                    if (field === 'cantidad' && item.originalQty !== undefined && value > item.originalQty) {
                        toast.error(`La cantidad no puede superar el original (${item.originalQty})`);
                        return item;
                    }
                    if (field === 'precio' && item.originalPrice !== undefined && value > item.originalPrice) {
                        toast.error(`El precio no puede superar el original ($${item.originalPrice})`);
                        return item;
                    }
                }

                // Validación para Nota de Remisión (04) - Precio bloqueado
                if (tipoDte === '04' && field === 'precio') {
                    return item;
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const handleSellerAuth = async (e) => {
        e.preventDefault();
        const trimmedPass = authPassword.trim();
        if (!trimmedPass) {
            toast.error('La contraseña es obligatoria');
            return;
        }

        try {
            const { data } = await axios.post('/api/sellers/login-pos', { password: trimmedPass });

            // Verificar que la sucursal del vendedor coincida con la sucursal del usuario
            console.log('[DEBUG-POS-AUTH]', { 
                sellerBranchId: data.branch_id, 
                userContextBranchId: user?.branch_id,
                sellerBranchName: data.branch_name 
            });

            if (Number(data.branch_id) !== Number(user?.branch_id)) {
                toast.error(`El vendedor (${data.seller_name}) pertenece a la sucursal "${data.branch_name || 'Desconocida'}", no a la actual.`);
                return;
            }

            setSellerSession(data);
            setSellerId(data.seller_id);
            setIsAuthModalOpen(false);
            setAuthPassword('');
            toast.success(`Bienvenido, ${data.seller_name}`);
        } catch (error) {
            console.error('[DEBUG-AUTH-DETAILED]', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message,
                url: error.config?.url
            });

            const msg = error.response?.data?.message || `Error: ${error.message}`;
            toast.error(msg);

            // Si el error es por token expirado o no autorizado (401/403 del middleware global)
            if (error.response?.status === 401 || error.response?.status === 403) {
                const isSellerError = error.response.data?.message?.toLowerCase().includes('contraseña') ||
                                    error.response.data?.message?.toLowerCase().includes('vendedor');
                if (isSellerError) return;

                toast.error('Sesión no válida o expirada. Redirigiendo...');
                setTimeout(() => navigate('/login'), 2000);
            }
        }
    };

    if (sellerSession && (isLoadingShift || !currentShift)) {
        return (
            <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-sm z-[300] flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {isLoadingShift ? 'Verificando Turno...' : 'Redirigiendo a apertura...'}
                </h3>
                <p className="text-slate-500 font-medium mt-2">
                    {isLoadingShift 
                        ? 'Espere un momento mientras validamos el estado de caja.' 
                        : 'No se detectó un turno activo para este terminal.'}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-0 flex flex-col gap-6 pb-20 overflow-y-auto custom-scrollbar pr-2">
            {activeView === 'pos' ? (
                <>
                    {/* Header: Cliente, Tipo DTE, Vendedor */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 items-start">
                        {/* Cliente Section (Col 1-6) */}
                        <div className="md:col-span-6 flex flex-col gap-2">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cliente / Contribuyente</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setEditingCustomer(null);
                                            setNitValue('');
                                            setSelectedDept('');
                                            setSelectedMun('');
                                            setSelectedActivity('');
                                            setIsCustomerModalOpen(true);
                                        }}
                                        className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg transition-all"
                                        title="Nuevo Cliente"
                                    >
                                        <UserPlus size={16} />
                                    </button>
                                    <button 
                                        onClick={handleEditCustomer}
                                        disabled={!customerId}
                                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg transition-all disabled:opacity-20"
                                        title="Editar Seleccionado"
                                    >
                                        <Edit size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="relative">
                                <SearchableSelect 
                                    options={customers}
                                    value={customerId}
                                    onChange={(e) => setCustomerId(e.target.value)}
                                    placeholder="Consumidor Final (General)"
                                    valueKey="id"
                                    labelKey="nombre"
                                    displayKey="nombre"
                                    codeKey="nit"
                                    codeLabel="NIT/DOC"
                                />
                            </div>
                            {!customerId && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                                    <input 
                                        type="text"
                                        value={manualCustomerName}
                                        onChange={(e) => setManualCustomerName(e.target.value)}
                                        placeholder="Nombre del cliente (Opcional)"
                                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
                                    />
                                </div>
                            )}
                            {selectedCustomerData && (
                                <div className="p-3 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200 shadow-inner">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Documentos</span>
                                            <span className="text-[10px] font-bold text-indigo-600 font-mono">
                                                {selectedCustomerData.nit ? `NIT: ${selectedCustomerData.nit}` : ''}
                                                {selectedCustomerData.nit && selectedCustomerData.nrc ? ' | ' : ''}
                                                {selectedCustomerData.nrc ? `NRC: ${selectedCustomerData.nrc}` : ''}
                                                {!selectedCustomerData.nit && !selectedCustomerData.nrc ? (selectedCustomerData.numero_documento || 'S/D') : ''}
                                            </span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Tipo Persona</span>
                                            <span className="text-[10px] font-bold text-slate-600 uppercase">
                                                {personTypes.find(t => t.code === selectedCustomerData.tipo_persona)?.description || 'NATURAL'}
                                            </span>
                                        </div>

                                        <div className="flex flex-col col-span-2 border-t border-indigo-100/30 pt-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Actividad Económica</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate" title={selectedCustomerData.actividad_nombre || 'Sin Giro'}>
                                                {selectedCustomerData.actividad_nombre || 'GIRO NO ASIGNADO'}
                                            </span>
                                        </div>

                                        <div className="flex flex-col border-t border-indigo-100/30 pt-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Ubicación</span>
                                            <span className="text-[10px] font-bold text-slate-600 truncate uppercase">
                                                {selectedCustomerData.municipio_nombre || 'MUNIC.'}, {selectedCustomerData.departamento_nombre || 'DEPTO.'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col border-t border-indigo-100/30 pt-1 text-right">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Dirección</span>
                                            <span className="text-[10px] font-medium text-slate-500 line-clamp-1 italic text-right" title={selectedCustomerData.direccion}>
                                                {selectedCustomerData.direccion || 'Dirección s/n'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tipo DTE Section (Col 6-7) */}
                        <div className="md:col-span-2 flex flex-col gap-1.5 pt-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Tipo Documento</label>
                            <select 
                                value={tipoDte}
                                onChange={(e) => setTipoDte(e.target.value)}
                                disabled={!!sellerSession}
                                className={`w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 appearance-none transition-all ${sellerSession ? 'opacity-70 cursor-not-allowed bg-slate-100' : ''}`}
                            >
                                <option value="01">Factura (01)</option>
                                <option value="03">Crédito Fiscal (03)</option>
                                <option value="04">Nota Remisión (04)</option>
                                <option value="05">Nota Crédito (05)</option>
                                <option value="07">Comprobante Retención (07)</option>
                                <option value="11">FEX (11)</option>
                            </select>
                        </div>

                        {/* Seller / POS Section (Col 9-11) */}
                        <div className="md:col-span-3 flex flex-col gap-1.5 pt-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Vendedor / POS</label>
                            <div className="flex gap-2">
                                <div className="flex-1 px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-sm font-bold text-indigo-600 truncate flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${currentShift ? 'bg-green-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                    {sellerSession ? `${sellerSession.seller_name} - ${sellerSession.pos_name || 'Sin POS'}` : 'Acceso Limitado'}
                                </div>
                            </div>
                        </div>

                        {/* History / Refs Section (Col 12) */}
                        <div className="md:col-span-1 flex items-end justify-end h-full py-1">
                            <button 
                                onClick={() => setIsLinkedDocModalOpen(true)}
                                className={`bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-3 rounded-2xl transition-all shadow-sm ${linkedDocs.length > 0 ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                title="Referencias / Historial (F9)"
                            >
                                <History size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Paneles Dinámicos DTE (FEX/NR) */}
                    {(tipoDte === '11' || tipoDte === '04') && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100 animate-in fade-in slide-in-from-top-4 duration-500">
                            {tipoDte === '11' ? (
                                <>
                                    <input className="bg-white rounded-xl px-4 py-2 text-sm font-bold" placeholder="Régimen" value={fexData.regime} onChange={e => setFexData({...fexData, regime: e.target.value})} />
                                    <input className="bg-white rounded-xl px-4 py-2 text-sm font-bold" placeholder="Recinto" value={fexData.enclosure} onChange={e => setFexData({...fexData, enclosure: e.target.value})} />
                                    <input className="bg-white rounded-xl px-4 py-2 text-sm font-bold" placeholder="País ISO" value={fexData.country} onChange={e => setFexData({...fexData, country: e.target.value})} />
                                </>
                            ) : (
                                <>
                                    <input className="bg-white rounded-xl px-4 py-2 text-sm font-bold" placeholder="Transportista" value={nrData.transporterName} onChange={e => setNrData({...nrData, transporterName: e.target.value})} />
                                    <input className="bg-white rounded-xl px-4 py-2 text-sm font-bold" placeholder="Placa" value={nrData.vehiclePlate} onChange={e => setNrData({...nrData, vehiclePlate: e.target.value})} />
                                    <select className="bg-white rounded-xl px-4 py-2 text-sm font-bold" value={nrData.type} onChange={e => setNrData({...nrData, type: e.target.value})}>
                                        <option value="02">Traslado</option>
                                        <option value="01">Venta</option>
                                    </select>
                                </>
                            )}
                        </div>
                    )}

                    {/* Área Principal (Carrito y Totales) */}
                    <div className="flex-none flex flex-col lg:flex-row gap-6 mb-10">
                        <div className="flex-[8] bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                            {/* Quick Add Bar (Like Purchases) */}
                            <div className="p-3 bg-slate-50 border-b border-slate-100 grid grid-cols-[120px_1fr_80px_100px_100px_40px] gap-2 items-end">
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Cód. Producto</label>
                                    <div className="relative">
                                        <Barcode className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                        <input 
                                            ref={barcodeInputRef}
                                            type="text" 
                                            value={quickBarcode} 
                                            onChange={(e) => setQuickBarcode(e.target.value.toUpperCase())} 
                                            onKeyDown={handleBarcodeSubmit} 
                                            placeholder="SCAN..." 
                                            className="w-full pl-7 pr-1 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 font-mono text-[10px] font-bold transition-all" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Descripción / Nota</label>
                                    <input 
                                        ref={descInputRef}
                                        type="text" 
                                        value={quickDesc} 
                                        onChange={(e) => setQuickDesc(e.target.value.toUpperCase())} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (!quickProd) {
                                                    handleAddQuick();
                                                } else {
                                                    qtyInputRef.current?.focus();
                                                }
                                            }
                                        }} 
                                        placeholder={quickProd ? "DESCRIPCIÓN BLOQUEADA" : "ESCRIBIR NOTA..."} 
                                        disabled={!!quickProd}
                                        className={`w-full px-3 py-1.5 rounded-lg text-[10px] font-black h-[30px] flex items-center transition-all outline-none ${!!quickProd ? 'bg-slate-100 text-slate-500 border border-slate-200 unselectable' : 'bg-white border border-indigo-200 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'}`}
                                    />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-center">Cant.</label>
                                    <input 
                                        ref={qtyInputRef}
                                        type="number" 
                                        value={quickCant} 
                                        onChange={(e) => setQuickCant(e.target.value)} 
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (sellerSession?.allow_price_edit) {
                                                    priceInputRef.current?.focus();
                                                } else {
                                                    handleAddQuick();
                                                }
                                            }
                                        }} 
                                        onFocus={(e) => e.target.select()} 
                                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-[10px] font-black text-center h-[30px] transition-all" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right">Precio U.</label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-[9px]">$</span>
                                        <input 
                                            ref={priceInputRef}
                                            type="number" 
                                            value={quickPrecio} 
                                            onChange={(e) => setQuickPrecio(e.target.value)} 
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddQuick()} 
                                            onFocus={(e) => e.target.select()} 
                                            disabled={!sellerSession?.allow_price_edit || !!getCustomerDiscount(quickProd?.id)}
                                            tabIndex={(!sellerSession?.allow_price_edit || !!getCustomerDiscount(quickProd?.id)) ? -1 : 0}
                                            className={`w-full pl-5 pr-2 py-1.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-[10px] font-black text-right h-[30px] transition-all ${(!sellerSession?.allow_price_edit || !!getCustomerDiscount(quickProd?.id)) ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200' : 'bg-white border-slate-200 text-slate-900'}`} 
                                        />
                                        {getCustomerDiscount(quickProd?.id) && (
                                            <div className="absolute -bottom-4 right-0 flex items-center gap-1 text-[7px] font-black text-indigo-500 uppercase italic">
                                                <Tag size={8} /> Especial
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1 text-right pr-2">Subtotal</label>
                                    <div className="w-full px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black text-indigo-600 text-right h-[30px] flex items-center justify-end">
                                        ${(parseFloat(quickCant || 0) * parseFloat(quickPrecio || 0)).toFixed(2)}
                                    </div>
                                </div>
                                <button 
                                    onClick={handleAddQuick} 
                                    disabled={!quickProd} 
                                    className="h-[30px] w-full bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-black disabled:opacity-20 active:scale-95 transition-all shadow-sm"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white/80 backdrop-blur-md border-b text-[10px] font-black text-slate-400 uppercase tracking-widest z-10">
                                        <tr>
                                            <th className="pl-6 py-4">Ítem</th>
                                            <th className="px-4 py-4 text-center">Cant.</th>
                                            <th className="px-4 py-4 text-right">Precio</th>
                                            <th className="px-4 py-4 text-right">Desc.</th>
                                            <th className="px-4 py-4 text-right">Subtotal</th>
                                            <th className="pr-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {cart.map((item) => (
                                            <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="pl-6 py-4">
                                                    <div className="font-bold text-slate-800 text-xs">{item.nombre}</div>
                                                    <div className="text-[9px] font-mono text-indigo-400">{item.codigo}</div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <input 
                                                        type="number"
                                                        className="w-14 text-center bg-slate-100 rounded-lg font-black text-xs py-1"
                                                        value={item.cantidad}
                                                        onChange={(e) => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    {tipoDte === '05' ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-slate-400 text-[10px]">$</span>
                                                            <input 
                                                                type="number"
                                                                step="0.01"
                                                                className="w-20 text-right bg-indigo-50 border border-indigo-100 rounded-lg font-black text-xs py-1 px-2 focus:ring-2 focus:ring-indigo-500/20"
                                                                value={item.precio}
                                                                onChange={(e) => updateItem(item.id, 'precio', parseFloat(e.target.value) || 0)}
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="font-bold text-xs text-slate-700">${parseFloat(item.precio || 0).toFixed(2)}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right text-rose-500 font-bold text-xs">-${parseFloat(item.descuento || 0).toFixed(2)}</td>
                                                <td className="px-4 py-4 text-right font-black text-slate-900 text-xs">
                                                    ${((parseFloat(item.precio || 0) * (parseFloat(item.cantidad || 0))) - (parseFloat(item.descuento || 0))).toFixed(2)}
                                                </td>
                                                <td className="pr-6 py-4 text-right">
                                                    <button onClick={() => removeFromCart(item.id)} className="text-rose-300 hover:text-rose-600"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex-[3] flex flex-col gap-4">
                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
                                <div className="space-y-1.5 mb-6 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>Gravadas</span><span>${totals.viewGravadas.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>IVA ({(taxSettings?.iva_rate || 13)}%)</span><span>${totals.viewIva.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-orange-300"><span>FOVIAL (${(taxSettings?.fovial_rate || 0.20)}/gal)</span><span>${totals.fovial.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-amber-300"><span>COTRANS (${(taxSettings?.cotrans_rate || 0.10)}/gal)</span><span>${totals.cotrans.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-blue-300"><span>Exentas</span><span>${totals.exento.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-slate-400"><span>No Sujetas</span><span>${totals.noSujeto.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 font-black text-indigo-300"><span>Subtotal s/Impuestos</span><span>${totals.subtotal.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-rose-300"><span>Retención ({(taxSettings?.retencion_rate || 1)}%)</span><span>-${totals.retencion.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-emerald-300"><span>Percepción ({(taxSettings?.percepcion_rate || 1)}%)</span><span>+${totals.percepcion.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-indigo-400"><span>Monto Operación</span><span>${totals.montoOperacion.toFixed(2)}</span></div>
                                    {generalDiscount > 0 && <div className="flex justify-between text-rose-300"><span>Descuento Gral.</span><span>-${generalDiscount.toFixed(2)}</span></div>}
                                </div>
                                <div className="text-5xl font-black mb-6 tracking-tighter">${totals.total.toFixed(2)}</div>
                                <button 
                                    disabled={cart.length === 0}
                                    onClick={goToPayment}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
                                >
                                    Pagar (F10)
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col gap-4 bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Caja de Cobro</h2>
                        <button onClick={() => setActiveView('pos')} className="bg-slate-100 p-4 rounded-2xl"><X size={24} className="text-slate-600" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
                        {/* Columna de Resumen */}
                        <div className="bg-slate-50 p-8 rounded-[3rem] flex flex-col border border-slate-100 overflow-y-auto custom-scrollbar">
                            <span className="text-indigo-500 font-black uppercase text-[10px] tracking-[0.2em] mb-4">Resumen de Operación</span>
                            <div className="space-y-2 mb-8 text-xs font-bold text-slate-500 uppercase">
                                <div className="flex justify-between border-b border-slate-100 pb-1"><span>Gravadas</span><span>${totals.viewGravadas.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1"><span>IVA ({(taxSettings?.iva_rate || 13)}%)</span><span>${totals.viewIva.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1 text-orange-600"><span>FOVIAL (${(taxSettings?.fovial_rate || 0.20)}/gal)</span><span>${totals.fovial.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1 text-amber-600"><span>COTRANS (${(taxSettings?.cotrans_rate || 0.10)}/gal)</span><span>${totals.cotrans.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1"><span>Exentas</span><span>${totals.exento.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1"><span>No Sujetas</span><span>${totals.noSujeto.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1 font-black text-indigo-600"><span>Subtotal s/Impuestos</span><span>${totals.subtotal.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1 text-rose-500"><span>Retención ({(taxSettings?.retencion_rate || 1)}%)</span><span>-${totals.retencion.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-1 text-emerald-600"><span>Percepción ({(taxSettings?.percepcion_rate || 1)}%)</span><span>+${totals.percepcion.toFixed(2)}</span></div>
                                <div className="flex justify-between font-black text-slate-900 pt-2 text-sm italic"><span>Monto Operación</span><span>${totals.montoOperacion.toFixed(2)}</span></div>
                            </div>

                            <div className="mt-auto space-y-4">
                                <div className="flex justify-between items-end">
                                    <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Total Documento</span>
                                    <span className="text-4xl font-black text-slate-900 tracking-tighter">${totals.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-end p-4 bg-indigo-600 rounded-2xl text-white shadow-lg">
                                    <span className="font-black uppercase text-[10px] tracking-widest opacity-80">Total Cobrado</span>
                                    <span className="text-2xl font-black tracking-tighter">${payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0).toFixed(2)}</span>
                                </div>
                                {condicionPago === '1' && (
                                    <div className="flex justify-between items-end p-4 bg-white rounded-2xl border border-slate-200 shadow-sm italic">
                                        <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Saldo Pendiente</span>
                                        <span className={`text-2xl font-black tracking-tighter ${totals.total - payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0) > 0.01 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            ${Math.max(0, totals.total - payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0)).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Columna de Pagos */}
                        <div className="flex flex-col gap-6 overflow-hidden">
                            {/* Condición de Operación */}
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Condición de la Operación (DTE)</label>
                                <select 
                                    value={condicionPago}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setCondicionPago(val);
                                        // Si cambia a CRÉDITO (2) y hay un pago por el total sugerido, limpiarlo para que sea prima opcional
                                        if (val === '2' && payments.length === 1 && Math.abs(parseFloat(payments[0].monto) - totals.total) < 0.01) {
                                            setPayments([]);
                                            toast.info('Venta al crédito: los pagos ahora son opcionales (Prima)');
                                        }
                                    }}
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 appearance-none transition-all"
                                >
                                    {condiciones.length > 0 ? condiciones.map(c => (
                                        <option key={c.code} value={c.code}>{c.description.toUpperCase()}</option>
                                    )) : (
                                        <>
                                            <option value="1">CONTADO</option>
                                            <option value="2">CRÉDITO</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Formulario de Abono */}
                            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Forma de Pago</label>
                                        <select 
                                            value={currentPayment.metodo_pago}
                                            onChange={(e) => setCurrentPayment({...currentPayment, metodo_pago: e.target.value})}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {paymentMethods.length > 0 ? paymentMethods.map(m => (
                                                <option key={m.code} value={m.code}>{m.description}</option>
                                            )) : (
                                                <>
                                                    <option value="01">Billetes y Monedas</option>
                                                    <option value="02">Tarjeta de Débito</option>
                                                    <option value="03">Tarjeta de Crédito</option>
                                                    <option value="04">Transferencia Bancaria</option>
                                                    <option value="05">Cheque</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Monto a Recibir</label>
                                        <input 
                                            type="number"
                                            value={currentPayment.monto}
                                            onChange={(e) => setCurrentPayment({...currentPayment, monto: e.target.value})}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>

                                {['02', '03', '04', '05'].includes(currentPayment.metodo_pago) && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="col-span-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Referencia / Auth</label>
                                            <input 
                                                type="text"
                                                value={currentPayment.referencia}
                                                onChange={(e) => setCurrentPayment({...currentPayment, referencia: e.target.value})}
                                                placeholder="Nro. Transacción"
                                                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                        </div>
                                        {currentPayment.metodo_pago === '05' ? (
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Nro. de Cheque</label>
                                                <input 
                                                    type="text"
                                                    value={currentPayment.num_cheque}
                                                    onChange={(e) => setCurrentPayment({...currentPayment, num_cheque: e.target.value})}
                                                    placeholder="CH-0000"
                                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </div>
                                        ) : ['02', '03'].includes(currentPayment.metodo_pago) && (
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Últimos 4 Dígitos</label>
                                                <input 
                                                    type="text"
                                                    value={currentPayment.last_digits}
                                                    onChange={(e) => setCurrentPayment({...currentPayment, last_digits: e.target.value})}
                                                    placeholder="0000"
                                                    maxLength={4}
                                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button 
                                    onClick={() => {
                                        const monto = parseFloat(currentPayment.monto);
                                        if (isNaN(monto) || monto <= 0) return toast.error('Monto inválido');
                                        
                                        // Validar que no supere el total
                                        const alreadyPaid = payments.reduce((acc, p) => acc + parseFloat(p.monto), 0);
                                        if (alreadyPaid + monto > totals.total + 0.01) {
                                            return toast.error('El monto total de los pagos no puede superar el total de la venta');
                                        }

                                        const method = paymentMethods.find(m => m.code === currentPayment.metodo_pago) || { description: 'Pago' };
                                        setPayments([...payments, { ...currentPayment, monto: monto.toFixed(2), methodName: method.description }]);
                                        
                                        // Auto-sugerir restante
                                        const newTotalPaid = alreadyPaid + monto;
                                        const remaining = Math.max(0, totals.total - newTotalPaid);
                                        setCurrentPayment({ metodo_pago: '01', monto: remaining > 0 ? remaining.toFixed(2) : '', referencia: '', num_cheque: '', last_digits: '' });
                                        toast.success('Abono registrado');
                                    }}
                                    className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black active:scale-95 transition-all shadow-md"
                                >
                                    Agregar Abono
                                </button>
                            </div>

                            {/* Listado de Abonos */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {condicionPago === '2' ? 'Primas / Abonos Iniciales' : 'Registro de Abonos'}
                                    </span>
                                </div>
                                {payments.map((p, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                                                {p.metodo_pago === '01' ? <Banknote size={20} /> : <CreditCard size={20} />}
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{p.methodName}</div>
                                                <div className="text-sm font-black text-slate-900">
                                                    {p.referencia ? `Ref: ${p.referencia}` : (p.num_cheque ? `Cheque: ${p.num_cheque}` : 'Sín Referencia')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <span className="text-xl font-black text-slate-900 tracking-tight">${parseFloat(p.monto).toFixed(2)}</span>
                                            <button onClick={() => setPayments(payments.filter((_, i) => i !== idx))} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20} /></button>
                                        </div>
                                    </div>
                                ))}
                                {payments.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-4 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                                        <Calculator size={40} className="opacity-20" />
                                        <span className="font-bold uppercase text-[10px] tracking-[0.2em] italic">Esperando abonos...</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 py-4">
                                <button 
                                    onClick={handleProcessSale}
                                    disabled={processSale.isPending || (condicionPago === '1' && payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0) < (totals.total - 0.01))}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed text-white py-8 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4"
                                >
                                    {processSale.isPending ? 'Emitiendo DTE...' : 'Finalizar y Facturar'}
                                    <ChevronRight size={20} />
                                </button>
                                <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">Al confirmar, el documento será enviado a @HaciendaSV</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b bg-slate-50/30 flex justify-between items-center">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Seleccionar Ítem</h3>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-white rounded-xl shadow-sm transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-8 pb-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input 
                                    autoFocus
                                    type="text"
                                    placeholder="Buscar productos o combos..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/5 font-bold transition-all shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {/* Combos */}
                                {filteredCombos.map(c => (
                                    <button key={`combo-${c.id}`} onClick={() => addToCart(c, true)} className="flex items-center gap-3 p-3 rounded-2xl border border-amber-100 bg-amber-50/20 hover:border-amber-400 hover:bg-amber-100/30 transition-all text-left group">
                                        <div className="p-2 bg-white rounded-xl shadow-sm text-amber-500 group-hover:scale-110 transition-transform"><Zap size={20} /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 text-sm truncate leading-tight">{c.name}</div>
                                            <div className="text-[10px] font-mono text-slate-400 font-bold uppercase">{c.barcode}</div>
                                            <div className="font-black text-amber-700 mt-0.5">${parseFloat(c.price || 0).toFixed(2)}</div>
                                        </div>
                                    </button>
                                ))}

                                {/* Productos */}
                                {filteredProducts.map(p => (
                                    <button key={p.id} onClick={() => addToCart(p)} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left group">
                                        <div className="p-2 bg-white rounded-xl shadow-sm group-hover:text-indigo-500 group-hover:scale-110 transition-transform text-slate-400"><Package size={20} /></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 text-sm truncate leading-tight">{p.nombre}</div>
                                            <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase">{p.codigo}</div>
                                            <div className="font-black mt-0.5 text-slate-700">${parseFloat(p.precio_unitario || 0).toFixed(2)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {filteredProducts.length === 0 && filteredCombos.length === 0 && (
                                <div className="text-center py-20 opacity-30">
                                    <Search size={64} className="mx-auto mb-4" />
                                    <p className="font-black uppercase tracking-widest text-sm">No se encontraron resultados</p>
                                    <p className="text-[10px] font-bold mt-2 italic">Intenta escribir una palabra clave diferente</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isLinkedDocModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b bg-slate-50/30 flex justify-between items-center">
                            <h3 className="text-2xl font-black text-slate-900">Referencias Documentales</h3>
                            <button onClick={() => setIsLinkedDocModalOpen(false)} className="p-2 hover:bg-white rounded-xl shadow-sm"><X size={20} /></button>
                        </div>
                            <div className="space-y-4">
                                {tipoDte === '05' && customerId ? (
                                    <div className="flex flex-col gap-4">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Seleccionar Documento del Cliente</label>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl divide-y">
                                            {isLoadingCustomerSales ? (
                                                <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">Cargando documentos...</div>
                                            ) : customerSales.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-xs font-bold">No se encontraron documentos previos para este cliente.</div>
                                            ) : (
                                                customerSales.filter(s => ['01', '03', '07'].includes(s.dte_type)).map(sale => (
                                                    <button 
                                                        key={sale.id}
                                                        onClick={async () => {
                                                            try {
                                                                const { data: fullSale } = await axios.get(`/api/sales/${sale.id}`);
                                                                setReferencingSale(fullSale);
                                                                const refDoc = fullSale.codigo_generacion || fullSale.numero_control || fullSale.dte_control;
                                                                
                                                                // Cargar items al carrito
                                                                const newItems = fullSale.items.map(item => ({
                                                                    id: item.product_id,
                                                                    nombre: item.descripcion,
                                                                    codigo: item.codigo,
                                                                    precio: item.precio_unitario,
                                                                    originalPrice: item.precio_unitario,
                                                                    cantidad: item.cantidad,
                                                                    originalQty: item.cantidad,
                                                                    descuento: item.monto_descuento,
                                                                    exento: item.venta_exenta > 0,
                                                                    isManual: !item.product_id,
                                                                    referencedDoc: refDoc
                                                                }));
                                                                setCart(newItems);

                                                                // Vincular documento
                                                                setLinkedDocs([{
                                                                    doc_type: sale.dte_type,
                                                                    doc_number: sale.numero_control || sale.dte_control || sale.codigo_generacion || sale.id.toString(),
                                                                    emission_date: sale.fecha_emision.split('T')[0],
                                                                    generation_type: 1 // Electrónico
                                                                }]);
                                                                
                                                                setIsLinkedDocModalOpen(false);
                                                                toast.success('Documento referenciado y productos cargados');
                                                            } catch (error) {
                                                                toast.error('Error al cargar detalle del documento');
                                                            }
                                                        }}
                                                        className="w-full p-4 flex items-center justify-between hover:bg-indigo-50 transition-colors text-left group"
                                                    >
                                                        <div>
                                                            <div className="font-black text-slate-900 text-xs tracking-tight group-hover:text-indigo-600 transition-colors">
                                                                {sale.tipo_documento_name} - {sale.numero_control || sale.dte_control || sale.codigo_generacion || `ID: ${sale.id}`}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                                {new Date(sale.fecha_emision).toLocaleDateString()} • TOTAL: ${parseFloat(sale.total_pagar).toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        <div className="relative flex items-center gap-2">
                                            <div className="flex-1 h-[1px] bg-slate-100"></div>
                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">O entrada manual</span>
                                            <div className="flex-1 h-[1px] bg-slate-100"></div>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="grid grid-cols-2 gap-4">
                                    <select id="link-type" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" defaultValue={tipoDte === '05' ? '01' : '01'}>
                                        <option value="01">Factura</option>
                                        <option value="03">C. Fiscal</option>
                                        <option value="07">C. Retención</option>
                                    </select>
                                    <input id="link-date" type="date" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" defaultValue={new Date().toISOString().split('T')[0]} />
                                </div>
                                <input id="link-number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="UUID o Número de Documento" />
                                <button 
                                    onClick={() => {
                                        const type = document.getElementById('link-type').value;
                                        const num = document.getElementById('link-number').value;
                                        const date = document.getElementById('link-date').value;
                                        if(!num) return toast.error('El número es obligatorio');
                                        setLinkedDocs([...linkedDocs, { doc_type: type, doc_number: num, emission_date: date, generation_type: 2 }]);
                                        document.getElementById('link-number').value = '';
                                    }}
                                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all active:scale-95"
                                >
                                    Vincular Manualmente
                                </button>
                            </div>

                            <div className="mt-8 border-t pt-6 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                {linkedDocs.map((doc, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="truncate pr-4">
                                            <div className="font-black text-sm truncate">{doc.doc_number}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{doc.doc_type} • {doc.emission_date}</div>
                                        </div>
                                        <button onClick={() => setLinkedDocs(linkedDocs.filter((_, i) => i !== idx))} className="text-rose-400 p-2"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                {linkedDocs.length === 0 && <p className="text-center py-8 text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">No hay documentos vinculados</p>}
                            </div>
                        </div>
                    </div>
            )}

            {/* Modal de Autenticación Logística */}
            {isAuthModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <form onSubmit={handleSellerAuth} className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="p-4 bg-indigo-100 rounded-3xl text-indigo-600 mb-4">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">Acceso Logística</h3>
                            <p className="text-slate-400 font-bold text-sm mt-2">Configura el documento y verifica tu acceso</p>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Tipo de Documento</label>
                                <select 
                                    value={tipoDte}
                                    onChange={(e) => setTipoDte(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                >
                                    <option value="01">Factura (01)</option>
                                    <option value="03">Crédito Fiscal (03)</option>
                                    <option value="04">Nota Remisión (04)</option>
                                    <option value="05">Nota Crédito (05)</option>
                                    <option value="07">Comprobante Retención (07)</option>
                                    <option value="11">FEX (11)</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Contraseña de Vendedor</label>
                                <input 
                                    autoFocus
                                    type="password"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-center tracking-[0.5em] outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all placeholder:tracking-normal placeholder:font-bold"
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 mt-4"
                            >
                                Iniciar Terminal
                                <ChevronRight size={20} />
                            </button>

                            <button 
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all mt-4 border border-slate-200 shadow-sm"
                            >
                                Salir al Panel Principal (Esc)
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Modal de Gestión de Clientes */}
            <Modal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleCustomerSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Persona</label>
                            <select name="tipo_persona" defaultValue={editingCustomer?.tipo_persona || '1'} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" required>
                                {personTypes.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">País</label>
                            <select name="pais" defaultValue={editingCustomer?.pais || '222'} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" required>
                                {countries.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo Documento</label>
                            <select name="tipo_documento" defaultValue={editingCustomer?.tipo_documento} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm">
                                <option value="DUI">DUI</option>
                                <option value="NIT">NIT</option>
                                <option value="Pasaporte">Pasaporte</option>
                                <option value="Carnet Resident">Carnet Residente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Número Documento</label>
                            <input name="numero_documento" defaultValue={editingCustomer?.numero_documento} placeholder="00000000-0" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">NIT</label>
                            <input 
                                name="nit" 
                                value={nitValue} 
                                onChange={(e) => setNitValue(formatNIT(e.target.value))}
                                placeholder="0000-000000-000-0" 
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" 
                                maxLength={17}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">NRC</label>
                            <input name="nrc" defaultValue={editingCustomer?.nrc} placeholder="000000-0" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre / Razón Social</label>
                        <input name="nombre" defaultValue={editingCustomer?.nombre} required className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Comercial</label>
                        <input name="nombre_comercial" defaultValue={editingCustomer?.nombre_comercial} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Actividad Económica</label>
                        <SearchableSelect 
                            name="codigo_actividad" 
                            options={activities} 
                            value={selectedActivity} 
                            onChange={(e) => setSelectedActivity(e.target.value)}
                            placeholder="Seleccionar actividad"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
                            <input name="telefono" defaultValue={editingCustomer?.telefono} placeholder="2200-0000" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Correo Electrónico</label>
                            <input name="correo" type="email" defaultValue={editingCustomer?.correo} placeholder="cliente@ejemplo.com" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Departamento</label>
                            <select name="departamento" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} required>
                                <option value="">Seleccionar</option>
                                {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Municipio</label>
                            <select name="municipio" value={selectedMun} onChange={(e) => setSelectedMun(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm" required>
                                <option value="">Seleccionar</option>
                                {municipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Dirección Exacta</label>
                        <textarea name="direccion" defaultValue={editingCustomer?.direccion} required placeholder="Dirección completa..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm h-16 resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'aplica_iva', label: 'Aplica IVA', default: true },
                            { id: 'exento_iva', label: 'Exento de IVA', default: false },
                            { id: 'aplica_fovial', label: 'Aplica FOVIAL', default: true },
                            { id: 'aplica_cotrans', label: 'Aplica COTRANS', default: true }
                        ].map(tax => (
                            <label key={tax.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all text-xs font-semibold text-slate-600">
                                <input type="checkbox" name={tax.id} defaultChecked={editingCustomer ? editingCustomer[tax.id] : tax.default} className="accent-indigo-600 w-4 h-4" />
                                {tax.label}
                            </label>
                        ))}
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95">
                            {editingCustomer ? 'Actualizar' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </Modal>
            {/* Modal de Ingreso de Combustible */}
            {isFuelModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
                        <div className="flex flex-col items-center text-center mb-8">
                            <div className="p-4 bg-orange-100 rounded-3xl text-orange-600 mb-4">
                                <Zap size={40} />
                            </div>
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">{fuelProd?.nombre}</h3>
                            {(() => {
                                const discountRule = getCustomerDiscount(fuelProd?.id);
                                const finalPrice = calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), discountRule);
                                return (
                                    <div className="mt-2">
                                        <p className={`font-bold text-sm ${discountRule ? 'text-slate-400 line-through' : 'text-slate-400'}`}>
                                            Precio Ref: ${parseFloat(fuelProd?.precio_unitario || 0).toFixed(3)} / gal
                                        </p>
                                        {discountRule && (
                                            <p className="text-indigo-600 font-black text-lg animate-pulse uppercase italic">
                                                Precio Especial: ${finalPrice.toFixed(3)} / gal
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Monto en Dólares ($)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                                        <input 
                                            autoFocus
                                            type="number"
                                            value={fuelAmount}
                                            onFocus={(e) => e.target.select()}
                                            onKeyDown={(e) => {
                                                if(e.key === 'Enter') handleAddFuelToCart();
                                            }}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFuelAmount(val);
                                                const discountRule = getCustomerDiscount(fuelProd?.id);
                                                const price = calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), discountRule);
                                                if (price > 0 && val) {
                                                    setFuelQty((parseFloat(val) / price).toFixed(4));
                                                } else {
                                                    setFuelQty('');
                                                }
                                            }}
                                            placeholder="0.00"
                                            className="w-full pl-10 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-right outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Cantidad en Galones</label>
                                    <input 
                                        type="number"
                                        value={fuelQty}
                                        onFocus={(e) => e.target.select()}
                                        onKeyDown={(e) => {
                                            if(e.key === 'Enter') handleAddFuelToCart();
                                        }}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFuelQty(val);
                                            const discountRule = getCustomerDiscount(fuelProd?.id);
                                            const price = calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), discountRule);
                                            if (price > 0 && val) {
                                                setFuelAmount((parseFloat(val) * price).toFixed(2));
                                            } else {
                                                setFuelAmount('');
                                            }
                                        }}
                                        placeholder="0.0000"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-right outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {[5, 10, 20, 40].map(val => (
                                    <button 
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                            setFuelAmount(val.toString());
                                            const discountRule = getCustomerDiscount(fuelProd?.id);
                                            const price = calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), discountRule);
                                            setFuelQty((val / price).toFixed(4));
                                        }}
                                        className="py-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl font-black text-xs transition-all border border-slate-100 hover:border-indigo-200"
                                    >
                                        ${val}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button 
                                    type="button"
                                    onClick={() => setIsFuelModalOpen(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button"
                                    onClick={handleAddFuelToCart}
                                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 transition-all active:scale-95"
                                >
                                    Añadir al Carrito (Enter)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesTerminal;
