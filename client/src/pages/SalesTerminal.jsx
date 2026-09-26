import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { 
    Search, 
    Plus, 
    Minus,
    Trash2, 
    CreditCard, 
    Banknote, 
    ChevronRight, 
    X, 
    Calculator,
    Tag,
    History,
    Barcode,
    Edit,
    UserPlus,
    Handshake,
    Loader2,
    Layers,
    Sparkles,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/SearchableSelect';
import { printTicket } from '../utils/qzPrint';
import { useAuth } from '../context/AuthContext';
import Money, { MoneyInput } from '../components/ui/Money';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import { validateDocumentNumber, isValidDocumentNumber } from '../utils/svfeValidators';

import ItemDiscountDialog from '../components/pos/ItemDiscountDialog';
import GeneralDiscountDialog from '../components/pos/GeneralDiscountDialog';
import PosSuccessModal from '../components/pos/PosSuccessModal';
import PosLotSelectionModal from '../components/pos/PosLotSelectionModal';
import DteTransmittingOverlay from '../components/pos/DteTransmittingOverlay';
import PosProductCatalogModal from '../components/pos/PosProductCatalogModal';
import PosCustomerSearchModal from '../components/pos/PosCustomerSearchModal';
import PosLinkedDocModal from '../components/pos/PosLinkedDocModal';
import PosSupervisorAuthModal from '../components/pos/PosSupervisorAuthModal';
import PosCustomerModal from '../components/pos/PosCustomerModal';
import PosFuelEntryModal from '../components/pos/PosFuelEntryModal';

import { isPromoApplicableNow, computePromotionDiscount } from '../utils/posCalculations';

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
    const [customerBranchId, setCustomerBranchId] = useState('');
    const [sellerId, setSellerId] = useState('');
    const [tipoDte, setTipoDte] = useState('01'); // 01, 03, 04, 05, 07, 11
    const [condicionPago, setCondicionPago] = useState('1'); // 1=Contado, 2=Crédito
    
    // Linked Documents (NC, NR)
    const [linkedDocs, setLinkedDocs] = useState([]);
    const [isLinkedDocModalOpen, setIsLinkedDocModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [saleResult, setSaleResult] = useState(null);

    // Export Data (FEX)
    // itemType como número (CAT-011): 1=Bienes, 2=Servicios, 3=Bienes y Servicios
    // tipoRegimen se fija automáticamente en '48' (exportación definitiva) en el servidor
    const [fexData, setFexData] = useState({
        itemType: 1,
        enclosure: '',
        country: ''
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
    const [generalDiscountPercentage, setGeneralDiscountPercentage] = useState(null);
    const [isGeneralDiscountModalOpen, setIsGeneralDiscountModalOpen] = useState(false);
    const [selectedDiscountItem, setSelectedDiscountItem] = useState(null);

    // Payment State
    const [payments, setPayments] = useState([]);
    const [currentPayment, setCurrentPayment] = useState({
        metodo_pago: '01',
        monto: '',
        referencia: '',
        num_cheque: '',
        last_digits: ''
    });
    const [entregado, setEntregado] = useState('');
    
    // UI State
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
    const [modalPage, setModalPage] = useState(1);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
    const [productViewMode, setProductViewMode] = useState('grid'); // 'grid' | 'list'
    
    // Lot Selection Modal State (Alt + Shift + L)
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [lotSearch, setLotSearch] = useState('');
    const [showAllLots, setShowAllLots] = useState(false);
    const [lotWarningTarget, setLotWarningTarget] = useState(null);
    
    // Quick Add State (Like Purchases)
    const [quickBarcode, setQuickBarcode] = useState('');
    const [quickProd, setQuickProd] = useState(null);
    const [quickCant, setQuickCant] = useState('1');
    const [quickPrecio, setQuickPrecio] = useState('0');
    const [quickDesc, setQuickDesc] = useState('');
    
    // Customer Management State
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [docNumberValue, setDocNumberValue] = useState('');
    const [docType, setDocType] = useState('DUI');
    const [nrcValue, setNrcValue] = useState('');
    const [condicionFiscal, setCondicionFiscal] = useState('contribuyente');
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedDistrito, setSelectedDistrito] = useState('');
    const [selectedActivity, setSelectedActivity] = useState('');
    const [selectedPais, setSelectedPais] = useState('9579');
    const [manualCustomerName, setManualCustomerName] = useState('');

    // Customer Search Modal State
    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerNit, setCustomerNit] = useState('');
    const [customerNrc, setCustomerNrc] = useState('');
    const [debouncedCustomerName, setDebouncedCustomerName] = useState('');
    const [debouncedCustomerNit, setDebouncedCustomerNit] = useState('');
    const [debouncedCustomerNrc, setDebouncedCustomerNrc] = useState('');
    const [customerSearchPage, setCustomerSearchPage] = useState(1);

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
    const barcodeLookupInFlightRef = useRef(false);
    const scanEntryRef = useRef(null);
    const quickAddFocusRef = useRef(false);

    useDirtyTracker('terminal', cart.length > 0 || customerId || linkedDocs.length > 0 || entregado);

    // Queries
    const { data: currentCompany } = useQuery({
        queryKey: ['company', user?.company_id],
        queryFn: async () => (await axios.get(`/api/companies`)).data.find(c => c.id == user?.company_id),
        enabled: !!user?.company_id
    });

    const { data: taxSettings } = useQuery({
        queryKey: ['tax-settings'],
        queryFn: async () => (await axios.get('/api/taxes')).data,
    });

    const { data: contingencyData } = useQuery({
        queryKey: ['contingency', 'status'],
        queryFn: async () => (await axios.get('/api/contingency/status')).data,
        refetchInterval: 5000,
    });
    const activeContingency = (contingencyData?.history || []).find(c => c.estado === 'OPEN');

    const [customersCache, setCustomersCache] = useState({});

    const loadCustomersOptions = useCallback(async (search, page) => {
        const { data } = await axios.get('/api/customers', {
            params: { search: search || undefined, page, limit: 50 }
        });
        if (data?.data?.length) {
            setCustomersCache(prev => {
                const next = { ...prev };
                data.data.forEach(c => { next[c.id] = c; });
                return next;
            });
        }
        return data;
    }, []);

    const { data: customerSearchData = { data: [], total: 0, totalPages: 0 }, isLoading: isLoadingCustomerSearch } = useQuery({
        queryKey: ['terminal-customers', debouncedCustomerName, debouncedCustomerNit, debouncedCustomerNrc, customerSearchPage],
        queryFn: async () => (await axios.get('/api/customers', {
            params: {
                nombre: debouncedCustomerName || undefined,
                nit: debouncedCustomerNit || undefined,
                nrc: debouncedCustomerNrc || undefined,
                page: customerSearchPage,
                limit: 50
            }
        })).data,
        enabled: isCustomerSearchOpen
    });

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedCustomerName(customerName);
            setDebouncedCustomerNit(customerNit);
            setDebouncedCustomerNrc(customerNrc);
            setCustomerSearchPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [customerName, customerNit, customerNrc]);

    // Categorías de productos para filtro en modal F3
    const { data: productCategoriesData } = useQuery({
        queryKey: ['categories-terminal'],
        queryFn: async () => (await axios.get('/api/categories', { params: { limit: 1000 } })).data,
        enabled: isProductModalOpen,
        staleTime: 1000 * 60 * 5
    });
    const categoriesList = useMemo(() => {
        if (!productCategoriesData) return [];
        return Array.isArray(productCategoriesData.data) ? productCategoriesData.data : (Array.isArray(productCategoriesData) ? productCategoriesData : []);
    }, [productCategoriesData]);

    const { data: modalProductsData = { data: [], total: 0, totalPages: 0 }, isLoading: isLoadingModalProducts } = useQuery({
        queryKey: ['terminal-products', debouncedProductSearch, sellerSession?.branch_id, sellerSession?.pos_id, selectedCategoryFilter, modalPage],
        queryFn: async () => (await axios.get('/api/products', {
            params: {
                search: debouncedProductSearch || undefined,
                branch_id: sellerSession?.branch_id,
                pos_id: sellerSession?.pos_id,
                category_id: (selectedCategoryFilter && selectedCategoryFilter !== 'combos') ? selectedCategoryFilter : undefined,
                limit: 24,
                page: modalPage
            }
        })).data,
        enabled: !!sellerSession?.branch_id && isProductModalOpen
    });

    React.useEffect(() => {
        const timer = setTimeout(() => { setDebouncedProductSearch(productSearch); setModalPage(1); }, 350);
        return () => clearTimeout(timer);
    }, [productSearch]);

    const { data: combos = [] } = useQuery({
        queryKey: ['combos-all', sellerSession?.branch_id],
        queryFn: async () => (await axios.get('/api/combos', { params: { limit: 1000, branch_id: sellerSession?.branch_id } })).data?.data || [],
        enabled: !!sellerSession?.branch_id
    });

    // POS & Branch info for policies and discount controls
    const { data: posList = [] } = useQuery({
        queryKey: ['pos'],
        queryFn: async () => (await axios.get('/api/pos')).data,
        staleTime: 60000,
    });

    const currentPos = useMemo(() => {
        if (!sellerSession?.pos_id || !posList.length) return null;
        return posList.find(p => String(p.id) === String(sellerSession.pos_id)) || null;
    }, [sellerSession?.pos_id, posList]);

    const { data: branchList = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data,
        staleTime: 60000,
    });

    const currentBranch = useMemo(() => {
        const bId = sellerSession?.branch_id || user?.branch_id;
        if (!bId || !branchList.length) return null;
        return branchList.find(b => String(b.id) === String(bId)) || null;
    }, [sellerSession?.branch_id, user?.branch_id, branchList]);

    const userPermissions = useMemo(() => {
        if (!user) return [];
        if (user.role === 'SuperAdmin') return ['ALL'];
        let p = user.permissions;
        if (typeof p === 'string') {
            try { p = JSON.parse(p); } catch { p = []; }
        }
        return Array.isArray(p) ? p : [];
    }, [user]);

    const hasPerm = useCallback((key) => {
        if (!user) return false;
        if (user.role === 'SuperAdmin') return true;
        return userPermissions.includes(key);
    }, [user, userPermissions]);

    const posAllowsDiscounts = Boolean(currentPos && currentPos.allow_discounts && Number(currentPos.allow_discounts) !== 0);
    const canApplyItemDiscount = posAllowsDiscounts && hasPerm('apply_item_discount');
    const canApplyGeneralDiscount = posAllowsDiscounts && hasPerm('apply_general_discount');

    const hasItemDiscounts = useMemo(() => cart.some(item => (parseFloat(item.descuento) || 0) > 0), [cart]);
    const hasGeneralDiscount = (parseFloat(generalDiscount) || 0) > 0;

    const branchPercentages = useMemo(() => {
        const raw = currentBranch?.discount_percentages;
        if (!raw) return [5, 10, 15, 20];
        if (Array.isArray(raw)) return raw.map(Number).filter(n => !isNaN(n) && n > 0);
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed.map(Number).filter(n => !isNaN(n) && n > 0);
            } catch {
                return raw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
            }
        }
        return [5, 10, 15, 20];
    }, [currentBranch]);

    const maxDiscountAmount = currentBranch?.max_discount_amount ? parseFloat(currentBranch.max_discount_amount) : null;
    const maxDiscountPercentage = currentBranch?.max_discount_percentage ? parseFloat(currentBranch.max_discount_percentage) : null;

    // Lotes Ovoproductos para selección rápida (Alt + Shift + L)
    const { 
        data: companyEggLots = [], 
        isLoading: isLoadingLots,
        refetch: refetchLots 
    } = useQuery({
        queryKey: ['sales-company-egg-lots', user?.company_id],
        queryFn: async () => {
            try {
                const res = await axios.get('/api/egg-industrial/traceability-360/available-lots', {
                    params: { all_lots: 'true' }
                });
                return Array.isArray(res.data) ? res.data : [];
            } catch {
                return [];
            }
        },
        staleTime: 60 * 1000,
        retry: false
    });

    const hasEggLots = companyEggLots.length > 0;

    const availableLots = useMemo(() => {
        if (!companyEggLots || companyEggLots.length === 0) return [];
        let list = companyEggLots;
        if (!showAllLots) {
            list = list.filter(l => l.has_stock);
        }
        if (lotSearch && lotSearch.trim()) {
            const q = lotSearch.trim().toLowerCase();
            list = list.filter(l => 
                (l.lot_code && l.lot_code.toLowerCase().includes(q)) ||
                (l.product_type && l.product_type.toLowerCase().includes(q)) ||
                (l.presentation && l.presentation.toLowerCase().includes(q)) ||
                (l.barcode && l.barcode.includes(q))
            );
        }
        return list;
    }, [companyEggLots, showAllLots, lotSearch]);

    useEffect(() => {
        if (isLotModalOpen && hasEggLots) {
            refetchLots();
        }
    }, [isLotModalOpen, hasEggLots, refetchLots]);

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

    // Acuerdos de precios pactados con cliente (Multi-empresa: si no tiene acuerdos activos, continúa normal)
    const { data: customerAgreements = [] } = useQuery({
        queryKey: ['customer-agreements-sales', customerId],
        queryFn: async () => {
            const res = await axios.get(`/api/crm/customer-agreements/active-by-customer/${customerId}`);
            return Array.isArray(res.data) ? res.data : (res.data?.data || []);
        },
        enabled: !!customerId,
        staleTime: 60000
    });

    // Helper para verificar y obtener el precio pactado de un producto para el cliente actual
    const getCustomerAgreedPrice = useCallback((itemData) => {
        if (!customerId || !customerAgreements || customerAgreements.length === 0 || !itemData) {
            return null;
        }
        const prodId = Number(itemData.id);
        const prodName = (itemData.nombre || itemData.name || '').toUpperCase();
        const prodCode = (itemData.codigo || itemData.barcode || '').toUpperCase();

        // 1. Coincidencia directa por product_id vinculado
        let agreement = customerAgreements.find(a => a.status === 'activo' && Number(a.product_id) === prodId);

        // 2. Coincidencia por regla heurística (tipo de producto + presentación en nombre/código)
        if (!agreement) {
            agreement = customerAgreements.find(a => {
                if (a.status !== 'activo') return false;
                const typeMatches = (
                    (a.product_type === 'Huevo Entero' && (prodName.includes('ENTERO') || prodCode.startsWith('HE'))) ||
                    (a.product_type === 'Clara' && (prodName.includes('CLARA') || prodCode.startsWith('CL'))) ||
                    (a.product_type === 'Yema' && (prodName.includes('YEMA') || prodCode.startsWith('YM')))
                );
                if (!typeMatches) return false;

                const pres = (a.presentation || '').toUpperCase().replace(/\s+/g, '');
                const normName = prodName.replace(/\s+/g, '');
                const normCode = prodCode.replace(/\s+/g, '');
                return normName.includes(pres) || normCode.includes(pres);
            });
        }

        if (agreement) {
            let unitPrice = parseFloat(agreement.agreed_unit_price);
            if (!unitPrice || isNaN(unitPrice) || unitPrice <= 0) {
                const priceLb = parseFloat(agreement.agreed_price_per_lb) || 0;
                let weight = 1;
                const presMatch = (agreement.presentation || '').match(/(\d+)/);
                if (presMatch) weight = parseFloat(presMatch[1]);
                unitPrice = priceLb * weight;
            }
            return {
                agreementId: agreement.id,
                agreedUnitPrice: unitPrice,
                pricePerLb: parseFloat(agreement.agreed_price_per_lb),
                presentation: agreement.presentation,
                productType: agreement.product_type
            };
        }
        return null;
    }, [customerId, customerAgreements]);

    // Recalcular ítems del carrito si se cambia o asigna cliente con acuerdos comerciales
    useEffect(() => {
        if (!customerId || !customerAgreements.length || !cart.length) return;
        let anyUpdated = false;
        const newCart = cart.map(item => {
            if (item.isManual || item.combo_id || !item.id) return item;
            const agreed = getCustomerAgreedPrice(item);
            if (agreed && Math.abs(parseFloat(item.precio || 0) - agreed.agreedUnitPrice) > 0.0001) {
                anyUpdated = true;
                return {
                    ...item,
                    precio: agreed.agreedUnitPrice,
                    isAgreedPrice: true,
                    agreedPriceInfo: agreed
                };
            }
            return item;
        });
        if (anyUpdated) {
            setCart(newCart);
            toast.info('Se actualizaron los precios del carrito según los acuerdos pactados con el cliente.');
        }
    }, [customerAgreements, customerId, getCustomerAgreedPrice]);

    // Product discount rules (independientes del cliente)
    const { data: productDiscountRules = [] } = useQuery({
        queryKey: ['discount-rules', 'active'],
        queryFn: async () => (await axios.get('/api/discount-rules?active=1')).data,
        staleTime: 60000,
    });

    const getProductDiscountRule = (productId) => {
        if (!productId) return null;
        return productDiscountRules.find(r => r.product_id == productId && r.active);
    };

    // Promociones comerciales de tienda activas (2x1, 2da al 50%, paquetes fijos, escala volumen)
    const { data: activePromotions = [] } = useQuery({
        queryKey: ['active-promotions-pos', sellerSession?.branch_id || user?.branch_id],
        queryFn: async () => {
            const bId = sellerSession?.branch_id || user?.branch_id;
            const res = await axios.get('/api/promotions/active-pos', {
                params: bId ? { branch_id: bId } : undefined
            });
            return Array.isArray(res.data) ? res.data : [];
        },
        staleTime: 60000,
    });

    const findPromotionForProduct = useCallback((productId) => {
        if (!productId || !activePromotions?.length) return null;
        const numId = Number(productId);
        return activePromotions.find(promo => {
            if (!isPromoApplicableNow(promo)) return false;
            return Array.isArray(promo.product_ids) && promo.product_ids.some(id => Number(id) === numId);
        }) || null;
    }, [activePromotions]);

    const computeItemDiscount = useCallback((item, newQty, newPrice = null) => {
        const qty = parseFloat(newQty) || 0;
        const price = newPrice !== null ? parseFloat(newPrice) : (parseFloat(item.precio) || 0);
        const lineGross = qty * price;
        const isFuel = item.tipo_combustible > 0;
        const fovial = isFuel ? Math.round(qty * parseFloat(taxSettings?.fovial_rate || 0.20) * 100) / 100 : 0;
        const cotrans = isFuel ? Math.round(qty * parseFloat(taxSettings?.cotrans_rate || 0.10) * 100) / 100 : 0;
        const fuelTaxes = fovial + cotrans;
        const discountableBase = Math.max(0, lineGross - fuelTaxes);

        if (qty <= 0 || discountableBase <= 0) {
            return { descuento: 0, unitDiscount: 0, promoApplied: null, upsellPromo: null, discountApplied: false };
        }

        // 1. Evaluar promoción comercial activa de tienda si no tiene descuento manual explícito
        if (!item.isManual && !item.combo_id && item.id && !item.isManualDiscount) {
            const promo = findPromotionForProduct(item.id);
            if (promo) {
                const promoRes = computePromotionDiscount(promo, qty, price, discountableBase);
                if (promoRes.discount > 0 || promoRes.upsellPromo) {
                    const unitDiscount = qty > 0 ? (promoRes.discount / qty) : 0;
                    return {
                        descuento: promoRes.discount,
                        unitDiscount,
                        promoApplied: promoRes.promoApplied,
                        upsellPromo: promoRes.upsellPromo,
                        discountApplied: promoRes.discount > 0
                    };
                }
            }
        }

        // 2. Regla de descuento de producto si fue aplicada
        if (item.discountRule && item.discountApplied) {
            const rule = item.discountRule;
            let discountAmount = 0;
            if (rule.discount_type === 'percentage') {
                const pct = parseFloat(rule.discount_value) || 0;
                discountAmount = Math.round((discountableBase * (pct / 100)) * 100) / 100;
            } else {
                const fixedUnit = parseFloat(rule.discount_value) || 0;
                const fixedTotal = Math.round((fixedUnit * qty) * 100) / 100;
                discountAmount = Math.min(fixedTotal, discountableBase);
            }
            discountAmount = Math.min(discountAmount, discountableBase);
            const unitDiscount = qty > 0 ? (discountAmount / qty) : 0;
            return { descuento: discountAmount, unitDiscount, promoApplied: null, upsellPromo: null, discountApplied: true };
        }

        // 3. Descuento manual previo por unidad
        if (item.unitDiscount > 0) {
            const discountAmount = Math.min(Math.round((item.unitDiscount * qty) * 100) / 100, discountableBase);
            return { descuento: discountAmount, unitDiscount: item.unitDiscount, promoApplied: null, upsellPromo: null, discountApplied: discountAmount > 0 };
        }

        if (item.descuento > 0 && item.cantidad > 0) {
            const prevUnit = item.descuento / item.cantidad;
            const discountAmount = Math.min(Math.round((prevUnit * qty) * 100) / 100, discountableBase);
            return { descuento: discountAmount, unitDiscount: prevUnit, promoApplied: null, upsellPromo: null, discountApplied: discountAmount > 0 };
        }

        return { descuento: 0, unitDiscount: 0, promoApplied: null, upsellPromo: null, discountApplied: false };
    }, [taxSettings, findPromotionForProduct]);

    // Re-evaluar promociones del carrito cuando se carguen o cambien las promociones activas
    useEffect(() => {
        if (!activePromotions?.length || !cart.length) return;
        setCart(prevCart => {
            let anyChanged = false;
            const updated = prevCart.map(item => {
                if (item.isManual || item.combo_id || item.isManualDiscount) return item;
                const res = computeItemDiscount(item, item.cantidad, item.precio);
                if (
                    res.descuento !== (item.descuento || 0) ||
                    JSON.stringify(res.promoApplied) !== JSON.stringify(item.promoApplied || null) ||
                    JSON.stringify(res.upsellPromo) !== JSON.stringify(item.upsellPromo || null)
                ) {
                    anyChanged = true;
                    return {
                        ...item,
                        descuento: res.descuento,
                        unitDiscount: res.unitDiscount,
                        promoApplied: res.promoApplied,
                        upsellPromo: res.upsellPromo,
                        discountApplied: res.descuento > 0
                    };
                }
                return item;
            });
            return anyChanged ? updated : prevCart;
        });
    }, [activePromotions, computeItemDiscount]);

    const applyDiscountRule = (itemId) => {
        if (!posAllowsDiscounts) {
            toast.error('Los descuentos están inhabilitados en este punto de venta.');
            return;
        }
        if (hasGeneralDiscount) {
            toast.error('No se puede aplicar descuento por producto: ya existe un descuento general activo en la venta.');
            return;
        }
        const item = cart.find(i => i.id === itemId || i.combo_id === itemId);
        if (!item || !item.discountRule) return;

        const qty = parseFloat(item.cantidad) || 0;
        const price = parseFloat(item.precio) || 0;
        const lineGross = qty * price;
        const isFuel = item.tipo_combustible > 0;
        const fovial = isFuel ? Math.round(qty * parseFloat(taxSettings?.fovial_rate || 0.20) * 100) / 100 : 0;
        const cotrans = isFuel ? Math.round(qty * parseFloat(taxSettings?.cotrans_rate || 0.10) * 100) / 100 : 0;
        const fuelTaxes = fovial + cotrans;
        const discountableBase = Math.max(0, lineGross - fuelTaxes);

        if (discountableBase <= 0) {
            toast.error('Este producto no cuenta con base gravada descontable.');
            return;
        }

        const rule = item.discountRule;
        let discountAmount = 0;
        if (rule.discount_type === 'percentage') {
            const pct = parseFloat(rule.discount_value) || 0;
            discountAmount = Math.round((discountableBase * (pct / 100)) * 100) / 100;
        } else {
            const fixedUnit = parseFloat(rule.discount_value) || 0;
            const fixedTotal = Math.round((fixedUnit * qty) * 100) / 100;
            discountAmount = Math.min(fixedTotal, discountableBase);
        }

        const unitDiscount = qty > 0 ? (discountAmount / qty) : 0;

        setCart(cart.map(i =>
            (i.id === itemId || i.combo_id === itemId)
                ? { ...i, descuento: discountAmount, unitDiscount, discountApplied: true }
                : i
        ));
        toast.success(`${item.nombre}: descuento de $${discountAmount.toFixed(2)} aplicado (${rule.discount_type === 'percentage' ? `${rule.discount_value}%` : `$${rule.discount_value}/u`})`);
    };

    const calculateDiscountedPrice = (originalPrice, discount) => {
        if (!discount) return originalPrice;
        if (discount.discount_type === 'PORCENTAJE') {
            return originalPrice * (1 - parseFloat(discount.discount_value) / 100);
        }
        return Math.max(0, originalPrice - parseFloat(discount.discount_value));
    };

    const handleApplyItemDiscount = (itemId, discountAmount) => {
        if (discountAmount > 0 && hasGeneralDiscount) {
            toast.error('No se puede aplicar descuento por producto: ya existe un descuento general activo en la venta.');
            return;
        }
        setCart(prev => prev.map(item => {
            if (item.id === itemId || item.combo_id === itemId) {
                const qty = parseFloat(item.cantidad) || 1;
                return { 
                    ...item, 
                    descuento: discountAmount, 
                    discountApplied: discountAmount > 0,
                    isManualDiscount: discountAmount > 0,
                    promoApplied: null,
                    upsellPromo: null,
                    unitDiscount: qty > 0 ? (discountAmount / qty) : 0
                };
            }
            return item;
        }));
        toast.success(`Descuento de $${discountAmount.toFixed(2)} aplicado al producto`);
    };

    const handleRemoveItemDiscount = (itemId) => {
        setCart(prev => prev.map(item => {
            if (item.id === itemId || item.combo_id === itemId) {
                const cleanItem = { ...item, descuento: 0, unitDiscount: 0, discountApplied: false, isManualDiscount: false, promoApplied: null, upsellPromo: null };
                const recomputed = computeItemDiscount(cleanItem, cleanItem.cantidad, cleanItem.precio);
                return { ...cleanItem, ...recomputed };
            }
            return item;
        }));
        toast.info('Descuento de producto removido');
    };

    const handleApplyGeneralDiscount = (discountAmount, discountPercentage = null) => {
        if (hasItemDiscounts) {
            toast.error('No se puede aplicar descuento general: ya existen productos con descuento individual en la venta.');
            return;
        }
        setGeneralDiscount(discountAmount);
        setGeneralDiscountPercentage(discountPercentage);
        toast.success(`Descuento general de $${discountAmount.toFixed(2)} aplicado a la venta`);
    };

    const handleRemoveGeneralDiscount = () => {
        setGeneralDiscount(0);
        setGeneralDiscountPercentage(null);
        toast.info('Descuento general removido');
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

    const { data: distritos = [] } = useQuery({
        queryKey: ['catalogs', 'distritos', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/districts?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept
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

    // Helper: Format NRC
    const formatNRC = (value) => {
        if (!value) return '';
        const digits = value.replace(/\D/g, '');
        if (digits.length <= 6) return digits;
        return `${digits.slice(0, 6)}-${digits.slice(6, 7)}`;
    };

    // Helper: Format Document Number (DUI / NIT)
    const formatDocumentNumber = (value, type = 'DUI') => {
        if (!value) return '';
        const digits = value.replace(/\D/g, '');
        if (type === 'DUI') {
            if (digits.length <= 8) return digits;
            return `${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
        } else if (type === 'NIT') {
            if (digits.length <= 4) return digits;
            if (digits.length <= 10) return `${digits.slice(0, 4)}-${digits.slice(4, 10)}`;
            if (digits.length <= 13) return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}`;
            return `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13, 14)}`;
        }
        return value;
    };

    // Helper: Find selected customer data
    const selectedCustomerData = useMemo(() => {
        if (!customerId) return null;
        return customersCache[parseInt(customerId)] || null;
    }, [customerId, customersCache]);

    const { data: customerBranches = [] } = useQuery({
        queryKey: ['customer-branches', customerId],
        queryFn: async () => (await axios.get('/api/customer-branches', { params: { customer_id: customerId } })).data,
        enabled: !!customerId
    });

    // Helper: Find selected branch data if any
    const selectedBranchData = useMemo(() => {
        if (!customerBranchId || !customerBranches.length) return null;
        return customerBranches.find(b => String(b.id) === String(customerBranchId)) || null;
    }, [customerBranchId, customerBranches]);

    // Active customer address info (resolving branch address when selected)
    const activeAddressInfo = useMemo(() => {
        if (!selectedCustomerData) return null;
        if (selectedBranchData) {
            return {
                isBranch: true,
                branchName: selectedBranchData.nombre,
                departamento: (selectedBranchData.departamento && String(selectedBranchData.departamento).trim()) || selectedCustomerData.departamento,
                municipio: (selectedBranchData.municipio && String(selectedBranchData.municipio).trim()) || selectedCustomerData.municipio,
                distrito: (selectedBranchData.distrito && String(selectedBranchData.distrito).trim()) || selectedCustomerData.distrito,
                departamento_nombre: selectedBranchData.departamento_nombre || selectedCustomerData.departamento_nombre,
                municipio_nombre: selectedBranchData.municipio_nombre || selectedCustomerData.municipio_nombre,
                distrito_nombre: selectedBranchData.distrito_nombre || selectedCustomerData.distrito_nombre,
                direccion: (selectedBranchData.direccion && String(selectedBranchData.direccion).trim()) || selectedCustomerData.direccion || 'Dirección s/n'
            };
        }
        return {
            isBranch: false,
            branchName: 'Principal',
            departamento: selectedCustomerData.departamento,
            municipio: selectedCustomerData.municipio,
            distrito: selectedCustomerData.distrito,
            departamento_nombre: selectedCustomerData.departamento_nombre,
            municipio_nombre: selectedCustomerData.municipio_nombre,
            distrito_nombre: selectedCustomerData.distrito_nombre,
            direccion: selectedCustomerData.direccion || 'Dirección s/n'
        };
    }, [selectedCustomerData, selectedBranchData]);

    // Campos de ubicación obligatorios para facturar (DTE)
    const getMissingLocationFields = (loc) => {
        if (!loc) return [];
        const missing = [];
        if (!loc.departamento) missing.push('Departamento');
        if (!loc.municipio) missing.push('Municipio');
        if (!loc.distrito) missing.push('Distrito');
        return missing;
    };

    const selectedCustomerMissing = activeAddressInfo ? getMissingLocationFields(activeAddressInfo) : [];

    const handleCustomerSelect = (value, option) => {
        setCustomerId(value);
        if (option) {
            setCustomersCache(prev => ({ ...prev, [option.id]: option }));
        }
        if (value) {
            const cust = option || customersCache[parseInt(value)];
            if (cust) {
                const missing = getMissingLocationFields(cust);
                // Solo alertar si no es Factura (01) o si la venta es >= $200
                if (missing.length > 0 && (tipoDte !== '01' || (totals?.total || 0) >= 200)) {
                    toast.warning(`El cliente "${cust.nombre}" no tiene ${missing.join(', ')}. Complételos para facturar.`);
                }
            }
        }
    };

    useEffect(() => {
        setCustomerBranchId('');
    }, [customerId]);
    
    // Búsqueda optimizada (F3) para evitar lentitud con miles de ítems
    const { filteredProducts, filteredCombos } = useMemo(() => {
        if (!isProductModalOpen) return { filteredProducts: [], filteredCombos: [] };
        
        const search = productSearch.toLowerCase().trim();

        let fCombos = [];
        if (!selectedCategoryFilter || selectedCategoryFilter === 'combos') {
            if (!search) {
                fCombos = combos.slice(0, 24);
            } else {
                fCombos = combos.filter(c => 
                    (c.name || '').toLowerCase().includes(search) || 
                    (c.barcode || '').toLowerCase().includes(search)
                ).slice(0, 24);
            }
        }

        const fProducts = selectedCategoryFilter === 'combos' ? [] : (modalProductsData?.data || []);

        return {
            filteredCombos: fCombos,
            filteredProducts: fProducts
        };
    }, [modalProductsData, combos, productSearch, isProductModalOpen, selectedCategoryFilter]);

    const handleEditCustomer = () => {
        if (!selectedCustomerData) return;
        setEditingCustomer(selectedCustomerData);
        setSelectedDept(selectedCustomerData.departamento || '');
        setSelectedMun(selectedCustomerData.municipio || '');
        setSelectedDistrito(selectedCustomerData.distrito || '');
        setSelectedActivity(selectedCustomerData.codigo_actividad || '');
        setCondicionFiscal(selectedCustomerData.condicion_fiscal || (selectedCustomerData.nrc ? 'contribuyente' : 'otro'));
        
        // Carga transparente de documento histórico (si solo tenía nit, lo carga en el campo único)
        const rawDoc = selectedCustomerData.numero_documento || selectedCustomerData.nit || '';
        const cleanDigits = rawDoc.replace(/\D/g, '');
        let inferredType = selectedCustomerData.tipo_documento || 'DUI';
        if (!selectedCustomerData.tipo_documento && selectedCustomerData.nit) {
            inferredType = cleanDigits.length === 14 ? 'NIT' : 'DUI';
        }
        setDocType(inferredType);
        setDocNumberValue(formatDocumentNumber(rawDoc, inferredType));
        setNrcValue(formatNRC(selectedCustomerData.nrc || ''));
        setSelectedPais(selectedCustomerData.pais || '9579');
        setIsCustomerModalOpen(true);
    };

    const isCustomerForeign = docType === 'Pasaporte' || docType === 'Carnet Resident' || docType === 'Otro' || condicionFiscal === 'extranjero';

    const handleCustomerSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.exento_iva = formData.get('exento_iva') === 'on';
        data.aplica_fovial = formData.get('aplica_fovial') === 'on';
        data.aplica_cotrans = formData.get('aplica_cotrans') === 'on';
        data.codigo_actividad = selectedActivity || null;
        data.tipo_documento = docType;
        data.condicion_fiscal = condicionFiscal;

        // Documento unificado y homologación automática DUI = NIT
        const rawDoc = (docNumberValue || '').trim();
        data.numero_documento = rawDoc || null;
        data.nit = rawDoc || null;
        data.nrc = (nrcValue || data.nrc || '').trim() || null;

        // Normalización de condición fiscal: sin NRC no puede ser contribuyente de IVA (es consumidor final / 'otro')
        if (!data.nrc && data.condicion_fiscal === 'contribuyente') {
            data.condicion_fiscal = 'otro';
        } else if (data.nrc && data.condicion_fiscal === 'otro') {
            data.condicion_fiscal = 'contribuyente';
        }

        // Inferencia automática de tipo de persona (2: Jurídica si tiene NIT o NRC, 1: Natural)
        data.tipo_persona = (docType === 'NIT' || data.nrc) ? '2' : (editingCustomer?.tipo_persona || '1');

        // País: si no es extranjero, se asigna El Salvador (9579)
        data.pais = isCustomerForeign ? (data.pais || selectedPais || '9579') : (editingCustomer?.pais || '9579');

        const correoTrimmed = (data.correo || '').trim();
        if (correoTrimmed) {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(correoTrimmed)) {
                toast.error('El correo electrónico no tiene un formato válido (ejemplo: cliente@dominio.com)');
                return;
            }
            data.correo = correoTrimmed;
        } else {
            data.correo = null;
        }

        data.departamento = (data.departamento || '').trim() || null;
        data.distrito = (data.distrito || '').trim() || null;
        data.municipio = (data.municipio || '').trim() || null;
        data.direccion = (data.direccion || '').trim() || null;

        if (data.distrito) {
            const distritoSel = distritos.find(d => d.code === data.distrito);
            if (distritoSel && data.municipio && data.municipio !== distritoSel.muni_code) {
                toast.error('El municipio seleccionado no corresponde al distrito');
                return;
            }
        }

        if (data.numero_documento) {
            const docCheck = validateDocumentNumber(data.numero_documento, docType);
            if (!docCheck.isValid) {
                toast.error(`Documento no válido: ${docCheck.error}`);
                return;
            }
        }

        try {
            let res;
            if (editingCustomer) {
                res = await axios.put(`/api/customers/${editingCustomer.id}`, data);
                toast.success('Cliente actualizado');
                if (res.data?.data) {
                    setCustomersCache(prev => ({ ...prev, [editingCustomer.id]: res.data.data }));
                }
            } else {
                res = await axios.post('/api/customers', data);
                toast.success('Cliente registrado');
                setCustomerId(res.data.id); // Auto-select new customer
                setCustomersCache(prev => ({ ...prev, [res.data.id]: res.data }));
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
            if (hasEggLots && e.altKey && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
                e.preventDefault();
                setIsLotModalOpen(prev => !prev);
            }
            if (e.key === 'F3') {
                e.preventDefault();
                setIsProductModalOpen(true);
            }
            if (e.key === 'F8') {
                e.preventDefault();
                if (!posAllowsDiscounts) {
                    toast.error('Los descuentos están inhabilitados en este punto de venta.');
                } else if (!canApplyGeneralDiscount) {
                    toast.error('No tiene permisos para aplicar descuentos globales.');
                } else if (cart.length === 0) {
                    toast.error('Agregue productos al carrito antes de aplicar un descuento.');
                } else if (hasItemDiscounts) {
                    toast.error('No se puede aplicar descuento general: ya existen productos con descuento individual en la venta.');
                } else {
                    setIsGeneralDiscountModalOpen(true);
                }
            }
            if (e.key === 'F9') {
                e.preventDefault();
                setIsLinkedDocModalOpen(true);
            }
            if (e.key === 'F10') {
                e.preventDefault();
                if (isSuccessModalOpen && saleResult) {
                    handlePrintTicketRef.current(saleResult);
                } else if (activeView === 'pago') {
                    handleProcessSaleRef.current();
                } else if (tipoDte === '07' ? linkedDocs.length > 0 : (tipoDte === '05' ? (cart.length > 0 && linkedDocs.length > 0) : cart.length > 0)) {
                    goToPayment();
                }
            }
            if (e.key === 'Enter' && isSuccessModalOpen) {
                e.preventDefault();
                handleCloseSuccessRef.current();
            }
            if (e.key === 'Escape' && isProductModalOpen) {
                e.preventDefault();
                setIsProductModalOpen(false);
            }
            if (e.key === 'Escape' && isFuelModalOpen) {
                e.preventDefault();
                setIsFuelModalOpen(false);
            }
            if (e.key === 'Escape' && isAuthModalOpen) {
                navigate('/dashboard');
            }
            if (e.key === 'Escape' && isSuccessModalOpen) {
                e.preventDefault();
                navigate('/dashboard');
            }

            // Document Type Switching (Up/Down Arrows) - ONLY in Auth Modal
            if (isAuthModalOpen) {
                const allowedTypes = ['01', '03', '04', '05', '07', '11'];
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
    }, [cart.length, isProductModalOpen, isAuthModalOpen, isSuccessModalOpen, isFuelModalOpen, tipoDte, navigate, activeView, saleResult, linkedDocs.length, posAllowsDiscounts, canApplyGeneralDiscount, hasItemDiscounts]);

    // Detect if any modal or overlay dialog is active to prevent stealing focus
    const isAnyModalOpen = Boolean(
        isAuthModalOpen || 
        isProductModalOpen || 
        isLinkedDocModalOpen || 
        isFuelModalOpen || 
        isCustomerModalOpen || 
        isCustomerSearchOpen || 
        isLotModalOpen || 
        isSuccessModalOpen || 
        isGeneralDiscountModalOpen || 
        selectedDiscountItem
    );

    // Auto-focus barcode input when starting POS or returning to POS without modals open
    useEffect(() => {
        if (activeView === 'pos' && !isAnyModalOpen) {
            if (quickAddFocusRef.current) {
                quickAddFocusRef.current = false;
                return;
            }
            const timer = setTimeout(() => {
                barcodeInputRef.current?.focus();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [activeView, isAnyModalOpen]);

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
                        if (res.data.isAssigned === false) {
                            setCurrentShift(null);
                            toast.error(`No está asignado al turno activo (#${res.data.shift.shift_number}, responsable: ${res.data.responsable_name}). Consulte con el responsable de turno.`);
                            navigate('/ventas/cierre');
                        } else {
                            setCurrentShift(res.data.shift);
                        }
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

        const rawActividad = customer.codigo_actividad ? String(customer.codigo_actividad).trim() : '';
        const normalizedActividad = (rawActividad.length === 4 && /^\d+$/.test(rawActividad)) ? rawActividad.padStart(5, '0') : rawActividad;

        if (tipoDte === '03') { // Crédito Fiscal
            const rawNit = customer.nit || customer.numero_documento;
            const nitVal = validateDocumentNumber(rawNit, 'NIT');
            if (!nitVal.isValid) {
                missing.push(`NIT inválido: ${nitVal.error}`);
            }
            const cleanNrc = String(customer.nrc || '').replace(/\D/g, '');
            if (!cleanNrc || /^0+$/.test(cleanNrc)) {
                missing.push('NRC inválido');
            }
            if (!normalizedActividad || normalizedActividad.length < 5) missing.push('Giro/Actividad');
            if (!customer.departamento) missing.push('Departamento');
            if (!customer.municipio) missing.push('Municipio');
            if (!customer.distrito) missing.push('Distrito');
            if (!customer.direccion) missing.push('Dirección');
        } else if (tipoDte === '01') { // Factura
            const isOver200 = (totals?.total || 0) >= 200;
            const rawDoc = customer.numero_documento || customer.nit;
            const cleanDoc = String(rawDoc || '').replace(/[-\s]/g, '');
            const hasDoc = cleanDoc.length > 0;
            const docVal = hasDoc ? validateDocumentNumber(cleanDoc, customer.tipo_documento) : null;
            const hasValidDoc = docVal && docVal.isValid;

            if (isOver200) {
                if (!hasDoc) {
                    missing.push('DUI o NIT (obligatorio para ventas ≥ $200.00)');
                } else if (!hasValidDoc) {
                    missing.push(`DUI/NIT inválido: ${docVal.error}`);
                }
            }

            // Para Factura (01), la dirección solo es obligatoria por normativa si la venta es >= $200
            if (isOver200) {
                if (!customer.departamento) missing.push('Departamento');
                if (!customer.municipio) missing.push('Municipio');
                if (!customer.distrito) missing.push('Distrito');
                if (!customer.direccion) missing.push('Dirección');
            }
        } else if (tipoDte === '11') { // FEX
            if (!customer.numero_documento) missing.push('Doc. Identidad');
            if (!customer.pais || customer.pais === '059') missing.push('País de Destino (Extranjero)');
            if (!customer.direccion) missing.push('Dirección');
        } else if (tipoDte === '05') { // Nota de Crédito
            const isReferencingCCF = referencingSale?.tipo_documento === '03' || 
                                     linkedDocs.some(d => d.doc_type === '03' || d.tipoDte === '03');
            if (isReferencingCCF) {
                const rawNit = customer.nit || customer.numero_documento;
                const nitVal = validateDocumentNumber(rawNit, 'NIT');
                if (!nitVal.isValid) {
                    missing.push(`NIT inválido para NC sobre Crédito Fiscal: ${nitVal.error}`);
                }
                const cleanNrc = String(customer.nrc || '').replace(/\D/g, '');
                if (!cleanNrc || /^0+$/.test(cleanNrc)) {
                    missing.push('NRC inválido');
                }
            } else {
                const rawDoc = customer.numero_documento || customer.nit;
                const cleanDoc = String(rawDoc || '').replace(/[-\s]/g, '');
                if (cleanDoc.length > 0) {
                    const docVal = validateDocumentNumber(cleanDoc, customer.tipo_documento);
                    if (!docVal.isValid) {
                        missing.push(`Documento inválido: ${docVal.error}`);
                    }
                }
            }
            if (!customer.departamento) missing.push('Departamento');
            if (!customer.municipio) missing.push('Municipio');
            if (!customer.distrito) missing.push('Distrito');
            if (!customer.direccion) missing.push('Dirección');
        } else if (tipoDte === '07') { // Comprobante de Retención
            if (!customer.tipo_documento || (customer.tipo_documento !== 'NIT' && customer.tipo_documento !== '36')) {
                missing.push('Tipo Documento debe ser NIT');
            }
            const nitVal = validateDocumentNumber(customer.nit, 'NIT');
            if (!nitVal.isValid) {
                missing.push(`NIT inválido: ${nitVal.error}`);
            }
            const cleanNrc = String(customer.nrc || '').replace(/\D/g, '');
            if (!cleanNrc || /^0+$/.test(cleanNrc)) {
                missing.push('NRC inválido');
            }
            if (!normalizedActividad || normalizedActividad.length < 5) missing.push('Giro/Actividad');
            if (!customer.departamento) missing.push('Departamento');
            if (!customer.municipio) missing.push('Municipio');
            if (!customer.distrito) missing.push('Distrito');
            if (!customer.direccion) missing.push('Dirección');
            if (!customer.telefono) missing.push('Teléfono');
            if (!customer.correo) missing.push('Correo');
        } else if (tipoDte === '04') { // Nota de Remisión con Cliente
            if (!nrData.transporterName) missing.push('Nombre Chofer');
            if (!nrData.vehiclePlate) missing.push('Placa Vehículo');
            if (!customer.departamento) missing.push('Depto Destino');
            if (!customer.municipio) missing.push('Munic. Destino');
            if (!customer.distrito) missing.push('Distrito Destino');
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

        if (customer.distrito) {
            const distritoSel = distritos.find(d => d.code === customer.distrito);
            if (distritoSel && customer.municipio && customer.municipio !== distritoSel.muni_code) {
                toast.error('El municipio del cliente no corresponde al distrito seleccionado');
                return false;
            }
        }

        return true;
    };

    const goToPayment = () => {
        if (tipoDte === '07' || tipoDte === '05') {
            if (!validateCustomerData()) return;
            if (tipoDte === '05' && linkedDocs.length === 0) {
                return toast.error('Debe seleccionar el documento original a referenciar para la Nota de Crédito');
            }
            handleProcessSale();
            return;
        }
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
            setEntregado(totals.total.toFixed(2));
            
            setCurrentPayment({
                metodo_pago: '01',
                monto: '',
                referencia: '',
                num_cheque: '',
                last_digits: ''
            });
        }
    };

    // Sync entregado to cash payment
    useEffect(() => {
        if (activeView !== 'pago') return;
        const amount = parseFloat(entregado) || 0;
        if (amount <= 0) return;
        setPayments(prev => {
            const idx = prev.findIndex(p => p.metodo_pago === '01');
            if (idx < 0) return prev;
            if (Math.abs(parseFloat(prev[idx].monto) - amount) < 0.001) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], monto: amount.toFixed(2) };
            return next;
        });
    }, [entregado, activeView]);

    // Mutation
    const processSale = useMutation({
        mutationFn: async (saleData) => {
            return (await axios.post('/api/sales', saleData)).data;
        },
        onSuccess: (data) => {
            toast.success('Venta procesada correctamente');
            setSaleResult({
                ...data,
                items: [...cart],
                totals: { ...totals },
                descuento_general: generalDiscount,
                customer: selectedCustomerData ? {
                    ...selectedCustomerData,
                    branch_name: selectedBranchData?.nombre || null,
                    branch_address: selectedBranchData?.direccion || null,
                    active_address: activeAddressInfo?.direccion || selectedCustomerData.direccion
                } : { nombre: manualCustomerName || 'Consumidor Final' },
                tipoDteName: tipoDte === '01' ? 'Factura' : tipoDte === '03' ? 'Crédito Fiscal' : tipoDte === '04' ? 'Nota Remisión' : tipoDte === '05' ? 'Nota Crédito' : tipoDte === '07' ? 'Comprobante Retención' : tipoDte === '11' ? 'Factura Exportación' : 'Documento',
                seller: sellerSession?.seller_name,
                contingency: Boolean(data?.dte?.contingency || activeContingency)
            });
            setIsSuccessModalOpen(true);
            
            // Note: We don't reset cart/customer here, we'll do it when closing success modal
            queryClient.invalidateQueries(['sales']);
        },
        onError: (error) => {
            const data = error.response?.data;
            const baseMsg = data?.error || data?.message || error.message;
            const details = data?.details;
            let fullMsg = baseMsg;
            if (details && Array.isArray(details) && details.length > 0) {
                fullMsg = `${baseMsg}: ` + details.map(d => d.message || d).join('; ');
            } else if (data?.message && data?.error && data.message !== data.error) {
                fullMsg = `${data.message}: ${data.error}`;
            }
            toast.error(fullMsg, { duration: 8000 });
        }
    });

    const handleCloseSuccess = () => {
        setIsSuccessModalOpen(false);
        setSaleResult(null);
        setCart([]);
        setGeneralDiscount(0);
        setGeneralDiscountPercentage(null);
        setCustomerId('');
        setCustomerBranchId('');
        setManualCustomerName('');
        setLinkedDocs([]);
        setActiveView('pos');
        setTipoDte('01'); // Restablecer a Factura (01) por defecto para la siguiente venta
        setCondicionPago('1'); // Restablecer a Contado (1) por defecto
        setSellerSession(null);
        setSellerId('');
        setReferencingSale(null);
        setIsAuthModalOpen(true);
    };

    const handlePrintTicket = async (sale) => {
        const printContainer = window.open('', '_blank', 'width=400,height=600');
        const origin = window.location.origin;
        const qrUrl = sale.dte?.codigo_generacion
            ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(origin + '/dte?codigo=' + encodeURIComponent(sale.dte.codigo_generacion))}`
            : '';
        const now = new Date();
        const fechaStr = now.toLocaleDateString('es-SV');
        const horaStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let branchAddr = '';
        if (sellerSession?.branch_id) {
            try {
                const { data: branchesData } = await axios.get('/api/branches');
                const branch = Array.isArray(branchesData) ? branchesData.find(b => b.id == sellerSession.branch_id) : null;
                if (branch?.direccion) branchAddr = branch.direccion;
            } catch (e) {}
        }
        
        const itemsHtml = sale.items.map(item => {
            const precio = parseFloat(item.precio);
            const cantidad = parseFloat(item.cantidad);
            const descuento = parseFloat(item.descuento || 0);
            const showPrice = precio !== 0 && (cantidad * precio - descuento) !== 0;
            return `
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                <div style="flex: 1;">${item.nombre}</div>
            </div>
            ${showPrice ? `
            <div style="text-align: right; font-size: 11px;">
                ${cantidad} x $${precio.toFixed(2)}
                ${descuento > 0 ? ` (-$${descuento.toFixed(2)})` : ''}
                = $${(cantidad * precio - descuento).toFixed(2)}
            </div>` : ''}
            ${item.promoApplied && descuento > 0 ? `
            <div style="font-size: 9px; color: #047857; margin-left: 8px; font-weight: bold;">
                ↳ 🏷️ PROMO ${item.promoApplied.name.toUpperCase()}: -$${descuento.toFixed(2)}
            </div>` : ''}
        `}).join('');

        const ticketHtml = `
            <html>
                <head>
                    <title>Ticket de Venta</title>
                    <style>
                        @page { margin: 0; }
                        body { width: 72mm; font-family: 'Courier New', monospace; font-size: 11px; font-weight: 600; margin: 0; padding: 5px 4px 5px 7px; }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .dashed { border-top: 1px dashed #000; margin: 4px 0; }
                        .flex-between { display: flex; justify-content: space-between; }
                    </style>
                </head>
                <body>
                    <div class="center bold" style="font-size: 14px;">${currentCompany?.razon_social || user?.company_name || 'EMPRESA'}</div>
                    ${sellerSession?.branch_name ? `<div class="center" style="font-size: 10px;">${sellerSession.branch_name}</div>` : ''}
                    ${branchAddr ? `<div class="center" style="font-size: 8px;">${branchAddr}</div>` : ''}
                    <div class="center" style="font-size: 9px;">NIT: ${currentCompany?.nit || ''} | NRC: ${currentCompany?.nrc || ''}</div>
                    <div class="dashed"></div>
                    <div class="flex-between"><span>TIPO DTE:</span><span>${sale.tipoDteName || 'FACTURA'}</span></div>
                    <div class="flex-between"><span>N° CONTROL:</span><span style="font-size: 9px;">${sale.dte?.numero_control || '---'}</span></div>
                    <div class="flex-between"><span>CÓDIGO GENERACIÓN:</span><span style="font-size: 7px;">${sale.dte?.codigo_generacion || '---'}</span></div>
                    ${sale.dte?.sello_recepcion ? `<div class="flex-between"><span>SELLO:</span><span style="font-size: 7px;">${sale.dte.sello_recepcion}</span></div>` : ''}
                    ${sale.dte?.contingency || sale.contingency ? `
                    <div style="border: 2px solid #000; padding: 4px 2px; margin: 5px 0; text-align: center;">
                        <div class="bold" style="font-size: 10px; letter-spacing: 1px; color: #000;">
                            *** EMITIDO EN CONTINGENCIA ***
                        </div>
                        <div style="font-size: 8px; margin-top: 2px; color: #000; font-weight: bold;">
                            TRANSMISI&Oacute;N DIFERIDA A HACIENDA
                        </div>
                    </div>` : ''}
                    <div class="flex-between"><span>FECHA:</span><span>${fechaStr}</span></div>
                    <div class="flex-between"><span>HORA:</span><span>${horaStr}</span></div>
                    <div class="dashed"></div>
                    <div><span class="bold">CLIENTE:</span> ${sale.customer?.nombre || 'CONSUMIDOR FINAL'}</div>
                    ${sale.customer?.nit ? `<div><span class="bold">NIT:</span> ${sale.customer.nit}</div>` : ''}
                    ${sale.customer?.nrc ? `<div><span class="bold">NRC:</span> ${sale.customer.nrc}</div>` : ''}
                    <div class="dashed"></div>

                    <div class="flex-between bold">
                        <div style="width: 50%;">DESCRIPCION</div>
                        <div>CANT.</div>
                        <div>PRECIO</div>
                        <div>SUBTOTAL</div>
                    </div>
                    
                    <div class="dashed"></div>

                    ${itemsHtml}

                    <div class="dashed"></div>

                    <div class="flex-between">
                        <div>TOTAL GRAVADAS</div>
                        <div>$${sale.totals.viewGravadas.toFixed(2)}</div>
                    </div>
                    <div class="flex-between">
                        <div>TOTAL IVA</div>
                        <div>$${sale.totals.viewIva.toFixed(2)}</div>
                    </div>
                    <div class="flex-between">
                        <div>TOTAL EXENTAS</div>
                        <div>$${sale.totals.exento.toFixed(2)}</div>
                    </div>
                    <div class="flex-between">
                        <div>VENTAS NO SUJETAS</div>
                        <div>$${sale.totals.noSujeto.toFixed(2)}</div>
                    </div>
                    ${parseFloat(sale.totals.totalItemDiscounts || 0) > 0 ? `
                    <div class="flex-between bold" style="color: #b91c1c;">
                        <div>DESCUENTOS ÍTEMS</div>
                        <div>-$${parseFloat(sale.totals.totalItemDiscounts).toFixed(2)}</div>
                    </div>` : ''}
                    ${parseFloat(sale.descuento_general || 0) > 0 ? `
                    <div class="flex-between bold" style="color: #b91c1c;">
                        <div>DESCUENTO GENERAL</div>
                        <div>-$${parseFloat(sale.descuento_general).toFixed(2)}</div>
                    </div>` : ''}
                    ${sale.totals.cotrans > 0 ? `
                    <div class="flex-between">
                        <div>COTRANS</div>
                        <div>$${sale.totals.cotrans.toFixed(2)}</div>
                    </div>` : ''}
                    ${sale.totals.fovial > 0 ? `
                    <div class="flex-between">
                        <div>FOVIAL</div>
                        <div>$${sale.totals.fovial.toFixed(2)}</div>
                    </div>` : ''}
                    <div class="flex-between bold" style="font-size: 1.2em; margin-top: 5px;">
                        <div>TOTAL A PAGAR</div>
                        <div>$${sale.totals.total.toFixed(2)}</div>
                    </div>

                    <div class="dashed"></div>

                    <div class="center">ATENDIDO POR : ${sale.seller || 'SISTEMA'}</div>
                    <div class="center">GRACIAS POR SU COMPRA</div>

                    <div class="dashed"></div>
                    
                    <div class="center" style="margin-top: 10px;">
                        <div style="margin-bottom: 5px;">DESCARGUE SU DTE</div>
                        <img src="${qrUrl}" style="width: 120px; height: 120px;" onload="setTimeout(() => { window.print(); window.close(); }, 200);" onerror="setTimeout(() => { window.print(); window.close(); }, 200);" />
                    </div>

                    <div style="height: 30px;"></div>
                </body>
            </html>
        `;

        printContainer.document.write(ticketHtml);

        // Verificar si el POS tiene QZ Tray con impresora configurada
        let qzSuccess = false;
        try {
            if (sellerSession?.pos_id) {
                const { data } = await axios.get('/api/pos');
                const pos = Array.isArray(data) ? data.find(p => p.id == sellerSession.pos_id) : null;
                if (pos?.auto_print && pos?.printer_name) {
                    const qzResult = await printTicket(ticketHtml, pos.printer_name);
                    qzSuccess = qzResult?.success;
                }
            }
        } catch (e) { /* fallback */ }

        if (qzSuccess) {
            printContainer.close();
            return;
        }

        // Fallback: mostrar ventana de impresión normal
        printContainer.document.close();
    };

    const handleProcessSale = () => {
        if (processSale.isPending) return;

        // 1. Validaciones Básicas
        if (tipoDte !== '07' && cart.length === 0) {
            return toast.error('El carrito está vacío');
        }
        if ((tipoDte === '07' || tipoDte === '05') && linkedDocs.length === 0) {
            return toast.error('Debe agregar al menos un documento relacionado');
        }

        if (!validateCustomerData()) {
            return; // Detener si faltan datos requeridos por el DTE
        }

        // 2. Validaciones adicionales de negocio
        if (tipoDte === '01') { // Factura
            if (totals.total >= 200 && !customerId && !manualCustomerName) {
                return toast.error('Facturas mayores o iguales a $200.00 requieren identificación del cliente');
            }
        }

        if (tipoDte === '05' && referencingSale) {
            if (totals.total > (parseFloat(referencingSale.total_pagar) + 0.01)) {
                return toast.error(`El monto de la Nota de Crédito ($${totals.total.toFixed(2)}) no puede ser mayor al documento original ($${parseFloat(referencingSale.total_pagar).toFixed(2)})`);
            }
        }

        // 2b. Validaciones de límites de descuento de la sucursal (Margen y Tope Ticket)
        if (maxDiscountAmount && totals.totalDescuentos > (maxDiscountAmount + 0.01)) {
            const hasManualGeneral = generalDiscount > 0;
            const hasManualItemDiscount = cart.some(item => parseFloat(item.descuento || 0) > 0 && !item.discountRule && !item.promoApplied);
            if (hasManualGeneral || hasManualItemDiscount) {
                return toast.error(`El total de descuentos aplicados ($${totals.totalDescuentos.toFixed(2)}) excede el monto máximo permitido por ticket en esta sucursal ($${maxDiscountAmount.toFixed(2)})`);
            }
        }

        if (maxDiscountPercentage) {
            for (const item of cart) {
                const disc = parseFloat(item.descuento) || 0;
                if (disc > 0 && !item.discountRule && !item.promoApplied) {
                    const price = parseFloat(item.precio) || 0;
                    const qty = parseFloat(item.cantidad) || 0;
                    const lineGross = price * qty;
                    let discountableBase = lineGross;
                    if (item.tipo_combustible > 0 && tipoDte !== '04') {
                        const itemFovial = Math.round(qty * parseFloat(taxSettings?.fovial_rate || 0.20) * 100) / 100;
                        const itemCotrans = Math.round(qty * parseFloat(taxSettings?.cotrans_rate || 0.10) * 100) / 100;
                        discountableBase = Math.max(0, lineGross - itemFovial - itemCotrans);
                    }
                    if (discountableBase > 0) {
                        const itemPct = (disc / discountableBase) * 100;
                        if (itemPct > (maxDiscountPercentage + 0.01)) {
                            return toast.error(`El producto "${item.nombre}" tiene un descuento de ${itemPct.toFixed(1)}%, que supera el porcentaje máximo permitido (${maxDiscountPercentage}%)`);
                        }
                    }
                }
            }

            if (generalDiscount > 0 && totals.gravadoBruto > 0) {
                const genPct = (generalDiscount / totals.gravadoBruto) * 100;
                if (genPct > (maxDiscountPercentage + 0.01)) {
                    return toast.error(`El descuento general representa un ${genPct.toFixed(1)}%, que supera el porcentaje máximo permitido (${maxDiscountPercentage}%)`);
                }
            }
        }

        // 3. Validar que el total pagado cubra la venta (excepto crédito, CR y NC)
        if (tipoDte !== '07' && tipoDte !== '05') {
            const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.monto), 0);
            if (condicionPago === '1' && totalPaid < (totals.total - 0.01)) {
                return toast.error('El monto pagado es insuficiente para una venta al contado');
            }
        }



        if (tipoDte === '01' && (totals.total || 0) < 200 && selectedCustomerData?.id) {
            const rawDoc = selectedCustomerData.numero_documento || selectedCustomerData.nit;
            const cleanDoc = String(rawDoc || '').replace(/[-\s]/g, '');
            if (cleanDoc.length > 0 && !isValidDocumentNumber(cleanDoc, selectedCustomerData.tipo_documento)) {
                setCustomersCache(prev => ({
                    ...prev,
                    [selectedCustomerData.id]: {
                        ...prev[selectedCustomerData.id],
                        numero_documento: null,
                        nit: null
                    }
                }));
            }
        }

        const saleData = {
            header: {
                customer_id: customerId || null,
                customer_branch_id: customerBranchId || null,
                seller_id: sellerId || null,
                pos_id: sellerSession?.pos_id || null,
                shift_id: currentShift?.id || null,
                dte_type: tipoDte,
                tipo_documento: tipoDte, 
                payment_condition: condicionPago,
                condicion_operacion: condicionPago,
                dias_credito: selectedCustomerData?.dias_credito || 15,
                total_iva: totals.iva,
                total_retencion: totals.retencion,
                total_percepcion: totals.percepcion,
                total_nosujetas: totals.noSujeto,
                total_exento: totals.exento,
                total_gravado: totals.gravadoNeto,
                descuento_general: generalDiscount,
                porcentaje_descuento: generalDiscountPercentage,
                fovial: totals.fovial,
                cotrans: totals.cotrans,
                total_pagar: tipoDte === '07' ? totals.totalIVAretenido : totals.total,
                export_item_type: tipoDte === '11' ? fexData.itemType : null,
                fiscal_enclosure: tipoDte === '11' ? (fexData.enclosure || '00') : null,
                export_regime: tipoDte === '11' ? 'EX-1' : null,
                dest_country_code: tipoDte === '11' ? fexData.country : null,
                remission_type: tipoDte === '04' ? nrData.type : null,
                transporter_name: tipoDte === '04' ? nrData.transporterName : null,
                vehicle_plate: tipoDte === '04' ? nrData.vehiclePlate : null,
                cliente_nombre: !customerId ? manualCustomerName : null,
            },
            items: tipoDte === '07' ? linkedDocs.map((doc, idx) => ({
                num_item: idx + 1,
                product_id: null,
                descripcion: doc.descripcion || `RETENCION DOC ${doc.doc_number}`,
                cantidad: 1,
                precio_unitario: parseFloat(doc.montoSujeto) || 0,
                monto_descuento: 0,
                venta_gravada: parseFloat(doc.montoSujeto) || 0,
                venta_exenta: 0,
                tributos: []
            })) : cart.map((item, idx) => {
                const itemFovial = item.tipo_combustible > 0 ? Math.round(item.cantidad * parseFloat(taxSettings?.fovial_rate || 0.20) * 100) / 100 : 0;
                const itemCotrans = item.tipo_combustible > 0 ? Math.round(item.cantidad * parseFloat(taxSettings?.cotrans_rate || 0.10) * 100) / 100 : 0;
                const subtotal = (item.precio * item.cantidad) - item.descuento;
                
                return {
                    num_item: idx + 1,
                    product_id: item.isManual ? null : item.id,
                    codigo: item.codigo || null,
                    descripcion: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio,
                    monto_descuento: item.descuento,
                    venta_gravada: (tipoDte === '11') ? (subtotal / (1 + parseFloat(taxSettings?.iva_rate || 13) / 100)) : (!item.exento && !item.no_sujeto ? (subtotal - itemFovial - itemCotrans) : 0),
                    venta_exenta: (tipoDte === '11') ? 0 : (item.exento ? subtotal : 0),
                    tributos: (item.tipo_combustible > 0 && tipoDte !== '04') ? [
                        { codigo: "D1", descripcion: "FOVIAL", valor: itemFovial },
                        { codigo: "C8", descripcion: "COTRANS", valor: itemCotrans }
                    ] : [],
                    referencedDoc: (tipoDte === '05' && linkedDocs.length > 0) ? linkedDocs[0].doc_number : (item.referencedDoc || null)
                };
            }),
            payments: (tipoDte === '05' || tipoDte === '07') ? [] : payments.map(p => ({
                codigo: p.metodo_pago,
                monto: parseFloat(p.monto),
                referencia: p.referencia || p.num_cheque || p.last_digits || null
            })),
            linkedDocuments: (tipoDte === '04' || tipoDte === '05' || tipoDte === '07') ? linkedDocs : []
        };
        processSale.mutate(saleData);
    };

    const handleProcessSaleRef = useRef(handleProcessSale);
    handleProcessSaleRef.current = handleProcessSale;
    const handleCloseSuccessRef = useRef(handleCloseSuccess);
    handleCloseSuccessRef.current = handleCloseSuccess;
    const handlePrintTicketRef = useRef(handlePrintTicket);
    handlePrintTicketRef.current = handlePrintTicket;

    // Totals Calculation
    const totals = useMemo(() => {
        let gravadoBruto = 0; // Precio con IVA incluido
        let exento = 0;
        let noSujeto = 0;
        let fovial = 0;
        let cotrans = 0;
        let totalItemDiscounts = 0;

        cart.forEach(item => {
            const price = parseFloat(item.precio) || 0;
            const qty = parseFloat(item.cantidad) || 0;
            const disc = parseFloat(item.descuento) || 0;
            totalItemDiscounts += disc;
            const subtotal = (price * qty) - disc;

            if (item.exento) exento += subtotal;
            else if (item.no_sujeto) noSujeto += subtotal;
            else if (tipoDte === '11') {
                const ivaRate = parseFloat(taxSettings?.iva_rate || 13) / 100;
                gravadoBruto += subtotal / (1 + ivaRate);
            }
            else {
                // FOVIAL/COTRANS only for non-Remission notes
                if (item.tipo_combustible > 0 && tipoDte !== '04') {
                    const itemFovial = Math.round(qty * parseFloat(taxSettings?.fovial_rate || 0.20) * 100) / 100;
                    const itemCotrans = Math.round(qty * parseFloat(taxSettings?.cotrans_rate || 0.10) * 100) / 100;
                    fovial += itemFovial;
                    cotrans += itemCotrans;
                    gravadoBruto += (subtotal - itemFovial - itemCotrans);
                } else {
                    gravadoBruto += subtotal;
                }
            }
        });

        const ivaRate = parseFloat(taxSettings?.iva_rate || 13) / 100;
        // Aplicar descuento general exclusivamente a operaciones gravadas (sin tocar combustibles ni exentos/no sujetos)
        const safeGeneralDiscount = Math.min(generalDiscount, Math.max(0, gravadoBruto));

        let iva = 0;
        let gravadoNeto = 0;
        let viewGravadas = 0;
        let viewIva = 0;
        let subtotalGeneral = 0;

        if (tipoDte === '01') {
            const gravadoFinalConIva = Math.max(0, gravadoBruto - safeGeneralDiscount);
            iva = gravadoFinalConIva - (gravadoFinalConIva / (1 + ivaRate));
            gravadoNeto = gravadoFinalConIva - iva;
            viewGravadas = gravadoFinalConIva;
            viewIva = 0;
            subtotalGeneral = gravadoFinalConIva + exento + noSujeto + fovial + cotrans;
        } else if (tipoDte === '11') {
            gravadoNeto = Math.max(0, gravadoBruto - safeGeneralDiscount);
            iva = 0;
            viewGravadas = gravadoNeto;
            viewIva = 0;
            subtotalGeneral = gravadoNeto + exento + noSujeto + fovial + cotrans;
        } else {
            // CCF (03) y otros comprobantes
            const gravadoNetoAntes = gravadoBruto / (1 + ivaRate);
            const netGeneralDisc = safeGeneralDiscount / (1 + ivaRate);
            gravadoNeto = Math.max(0, gravadoNetoAntes - netGeneralDisc);
            iva = gravadoNeto * ivaRate;
            viewGravadas = gravadoNeto;
            viewIva = iva;
            subtotalGeneral = gravadoNeto + iva + exento + noSujeto + fovial + cotrans;
        }
        
        // Retención y Percepción
        let retencion = 0;
        let percepcion = 0;
        const nosAgenteRetencion = currentCompany?.tipo_contribuyente === 'Grande';
        const clienteGC = selectedCustomerData?.condicion_fiscal === 'gran contribuyente';
        
        const retencionRate = parseFloat(taxSettings?.retencion_rate || 1) / 100;
        const percepcionRate = parseFloat(taxSettings?.percepcion_rate || 1) / 100;

        if ((tipoDte === '03' || tipoDte === '01') && gravadoNeto >= 100) {
            if (!nosAgenteRetencion && clienteGC) {
                // Nosotros no somos GC, pero el Cliente SÍ lo es -> Ellos nos retienen el 1% de nuestra venta
                retencion = gravadoNeto * retencionRate;
            } else if (nosAgenteRetencion && !clienteGC) {
                // Nosotros somos GC, y el Cliente NO lo es -> Nosotros les percibimos el 1% adicional
                percepcion = gravadoNeto * percepcionRate;
            }
        }

        const totalFinal = subtotalGeneral - retencion + percepcion;

        // CR: totales de retención desde documentos vinculados
        const totalSujetoRetencion = linkedDocs.reduce((s, d) => s + parseFloat(d.montoSujeto || 0), 0);
        const totalIVAretenido = linkedDocs.reduce((s, d) => s + parseFloat(d.ivaRetenido || 0), 0);

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
            totalItemDiscounts,
            safeGeneralDiscount,
            totalDescuentos: totalItemDiscounts + safeGeneralDiscount,
            subtotal: subtotalGeneral,
            montoOperacion: subtotalGeneral,
            total: Math.max(0, totalFinal),
            totalSujetoRetencion,
            totalIVAretenido
        };
    }, [cart, generalDiscount, currentCompany, selectedCustomerData, tipoDte, taxSettings, linkedDocs]);

    const addToCart = (itemData, isCombo = false) => {
        const itemName = itemData.nombre || itemData.name;
        const agreedPriceInfo = !isCombo ? getCustomerAgreedPrice(itemData) : null;
        let itemPrice = agreedPriceInfo ? agreedPriceInfo.agreedUnitPrice : (itemData.precio_unitario || itemData.price || 0);

        // Combustible siempre va a su modal dedicado
        if (itemData.tipo_combustible > 0 && !isCombo) {
            setFuelProd(itemData);
            setFuelAmount(itemData.precio_unitario || itemData.price);
            setFuelQty('1');
            setIsFuelModalOpen(true);
            setIsProductModalOpen(false);
            setProductSearch('');
            return;
        }

        // Si el vendedor puede editar precio, pausar para edición antes de agregar
        if (sellerSession?.allow_price_edit) {
            const prodData = isCombo
                ? { ...itemData, nombre: itemData.name, precio_unitario: itemData.price, isCombo: true }
                : itemData;
            let finalPrice;
            if (agreedPriceInfo) {
                finalPrice = agreedPriceInfo.agreedUnitPrice;
            } else {
                const discountRule = getCustomerDiscount(prodData.id);
                const basePrice = prodData.precio_unitario || prodData.price || 0;
                finalPrice = discountRule ? calculateDiscountedPrice(basePrice, discountRule) : basePrice;
            }

            setQuickProd(prodData);
            setQuickPrecio(tipoDte === '04' ? '0.00001' : finalPrice.toString());
            setQuickCant('1');
            setQuickDesc(prodData.nombre || prodData.name || '');
            quickAddFocusRef.current = true;
            setIsProductModalOpen(false);
            setProductSearch('');

            if (agreedPriceInfo) {
                toast.info(`Precio pactado aplicado: $${agreedPriceInfo.agreedUnitPrice.toFixed(2)}`);
            }

            setTimeout(() => {
                qtyInputRef.current?.focus();
            }, 100);
            return;
        }

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

        if (existing) {
            setCart(cart.map(item => {
                if (isCombo ? item.combo_id === itemData.id : (item.id === itemData.id && !item.isManual && !item.combo_id)) {
                    const newQty = item.cantidad + 1;
                    const res = computeItemDiscount(item, newQty, itemPrice);
                    return { 
                        ...item, 
                        cantidad: newQty, 
                        precio: itemPrice, 
                        descuento: res.descuento, 
                        unitDiscount: res.unitDiscount, 
                        promoApplied: res.promoApplied,
                        upsellPromo: res.upsellPromo,
                        discountApplied: res.discountApplied,
                        isAgreedPrice: !!agreedPriceInfo || item.isAgreedPrice 
                    };
                }
                return item;
            }));
        } else {
            // Verificar regla de descuento de producto (solo marcar, no aplicar)
            const productRule = getProductDiscountRule(itemData.id);
            const tempItem = {
                id: isCombo ? null : itemData.id,
                combo_id: isCombo ? itemData.id : null,
                nombre: itemName,
                codigo: itemData.codigo || itemData.barcode,
                tipo_combustible: itemData.tipo_combustible || 0,
                precio: itemPrice,
                cantidad: 1,
                descuento: 0,
                exento: false,
                isManual: false,
                referencedDoc: itemData.referencedDoc || null,
                discountRule: productRule || null,
                isAgreedPrice: !!agreedPriceInfo,
                agreedPriceInfo: agreedPriceInfo || null
            };
            const res = computeItemDiscount(tempItem, 1, itemPrice);
            setCart([...cart, {
                ...tempItem,
                descuento: res.descuento,
                unitDiscount: res.unitDiscount,
                promoApplied: res.promoApplied,
                upsellPromo: res.upsellPromo,
                discountApplied: res.discountApplied
            }]);
        }
        setIsProductModalOpen(false);
        setProductSearch('');
        if (agreedPriceInfo) {
            toast.success(`${itemName} añadido con precio pactado: $${agreedPriceInfo.agreedUnitPrice.toFixed(2)}`);
        } else {
            toast.success(`${isCombo ? 'Combo' : 'Producto'} añadido: ${itemName}`);
        }
        // Devolver foco al buscador de código
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
    };

    const handleSelectLot = (lot) => {
        if (lot.release_status === 'bloqueado_haccp' || lot.quality_status === 'bloqueado_haccp' || lot.status === 'bloqueado_haccp') {
            return toast.error(`BLOQUEO HACCP: El lote ${lot.lot_code} está bloqueado por calidad y no puede ser facturado.`);
        }
        if (lot.release_status === 'cuarentena' || lot.quality_status === 'cuarentena') {
            toast.warning(`Lote ${lot.lot_code} en CUARENTENA: Pendiente de aprobación microbiológica oficial.`);
        }
        if (!lot.has_stock || lot.units_in_stock <= 0) {
            setLotWarningTarget(lot);
            return;
        }
        executeAddLot(lot);
    };

    const executeAddLot = (lot) => {
        const matched = modalProductsData?.data?.find(p => 
            (lot.barcode && (p.codigo === lot.barcode || p.barcode === lot.barcode)) ||
            (p.nombre && p.nombre.toLowerCase().includes(lot.product_type.toLowerCase()))
        );

        let unitPrice = matched?.precio_unitario 
            ? parseFloat(matched.precio_unitario) 
            : (lot.weight_per_unit_lbs ? parseFloat(lot.weight_per_unit_lbs) * 1.5 : 30.00);

        if (tipoDte === '04') unitPrice = 0.00001;

        const productRule = matched?.id ? getProductDiscountRule(matched.id) : null;
        setCart(prev => [...prev, {
            id: matched?.id || null,
            combo_id: null,
            nombre: `${lot.product_type} - ${lot.presentation} [Lote: ${lot.lot_code}]`,
            codigo: lot.barcode || lot.lot_code,
            tipo_combustible: 0,
            precio: unitPrice,
            cantidad: 1,
            descuento: 0,
            exento: false,
            isManual: !matched,
            discountRule: productRule || null,
            lot_code: lot.lot_code,
            batch_id: lot.batch_id,
            packaging_id: lot.packaging_id,
            expiry_date: lot.expiry_date
        }]);

        setIsLotModalOpen(false);
        setLotWarningTarget(null);
        toast.success(`Lote ${lot.lot_code} agregado al carrito.`);
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

    const autoAddScannedProduct = (product, isCombo = false, price = 0, isAgreed = false) => {
        let finalPrice = price;

        // Regla de Negocio: Nota de Remisión siempre tiene precio simbólico
        if (tipoDte === '04') {
            finalPrice = 0.00001;
        }

        // Validación de precio 0 cuando no se permite editar
        if (!sellerSession?.allow_price_edit && finalPrice <= 0) {
            setQuickBarcode('');
            return toast.error('No se permite agregar productos con precio 0 sin autorización de edición.');
        }

        const existing = cart.find(item => 
            isCombo ? (item.combo_id === product.id) : (item.id === product.id && !item.isManual && !item.combo_id)
        );

        if (existing) {
            setCart(cart.map(item => {
                if (isCombo ? item.combo_id === product.id : (item.id === product.id && !item.isManual && !item.combo_id)) {
                    const newQty = item.cantidad + 1;
                    const res = computeItemDiscount(item, newQty, finalPrice);
                    return { 
                        ...item, 
                        cantidad: newQty, 
                        precio: finalPrice, 
                        descuento: res.descuento, 
                        unitDiscount: res.unitDiscount, 
                        promoApplied: res.promoApplied,
                        upsellPromo: res.upsellPromo,
                        discountApplied: res.discountApplied,
                        isAgreedPrice: isAgreed || item.isAgreedPrice 
                    };
                }
                return item;
            }));
        } else {
            const productRule = getProductDiscountRule(product.id);
            const tempItem = {
                id: isCombo ? null : product.id,
                combo_id: isCombo ? product.id : null,
                nombre: (product.nombre || product.name),
                codigo: (product.codigo || product.barcode),
                tipo_combustible: product.tipo_combustible || 0,
                precio: finalPrice,
                cantidad: 1,
                descuento: 0,
                exento: false,
                isManual: false,
                discountRule: productRule || null,
                isAgreedPrice: isAgreed
            };
            const res = computeItemDiscount(tempItem, 1, finalPrice);
            setCart([...cart, {
                ...tempItem,
                descuento: res.descuento,
                unitDiscount: res.unitDiscount,
                promoApplied: res.promoApplied,
                upsellPromo: res.upsellPromo,
                discountApplied: res.discountApplied
            }]);
        }

        toast.success(`${isCombo ? 'Combo' : 'Producto'} añadido: ${product.nombre || product.name}`);
        setQuickBarcode('');
        setQuickProd(null);
        setQuickDesc('');
        setQuickCant('1');
        setQuickPrecio('0');
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
    };

    const recordBarcodeKeystroke = () => {
        const now = Date.now();
        if (!scanEntryRef.current || (now - scanEntryRef.current.last) > 500) {
            scanEntryRef.current = { start: now, last: now, count: 1 };
        } else {
            scanEntryRef.current.last = now;
            scanEntryRef.current.count += 1;
        }
    };

    const classifyScanEntry = () => {
        const entry = scanEntryRef.current;
        if (!entry || entry.count < 4) return false;
        const avgGap = (entry.last - entry.start) / Math.max(1, entry.count - 1);
        return avgGap < 60;
    };

    const finishBarcodeLookup = (product, isCombo, autoAdd) => {
        if (!isCombo && product.tipo_combustible > 0) {
            setFuelProd(product);
            setFuelAmount(product.precio_unitario || '0');
            setFuelQty('1');
            setIsFuelModalOpen(true);
            setQuickBarcode('');
            return;
        }

        const agreedPriceInfo = !isCombo ? getCustomerAgreedPrice(product) : null;
        let finalPrice;
        if (agreedPriceInfo) {
            finalPrice = agreedPriceInfo.agreedUnitPrice;
            toast.info(`Precio pactado aplicado: $${finalPrice.toFixed(2)}`);
        } else {
            const discountRule = getCustomerDiscount(product.id);
            finalPrice = calculateDiscountedPrice(product.precio_unitario || product.price || 0, discountRule);
            if (discountRule) toast.info('Descuento de cliente aplicado');
        }

        if (autoAdd) {
            autoAddScannedProduct(product, isCombo, finalPrice, !!agreedPriceInfo);
        } else {
            setQuickProd(isCombo
                ? { ...product, nombre: product.name, precio_unitario: product.price, isCombo: true }
                : { ...product, isAgreedPrice: !!agreedPriceInfo, agreedPriceInfo });
            setQuickPrecio(finalPrice.toFixed(2));
            setQuickDesc(product.nombre || product.name);
            setQuickCant('1');
            qtyInputRef.current?.focus();
        }
    };

    const performBarcodeLookup = async (autoAdd = true) => {
        if (!quickBarcode) return;
        if (barcodeLookupInFlightRef.current) return;
        barcodeLookupInFlightRef.current = true;

        try {
            // Buscar directo en el servidor (búsqueda exacta por código o código de barras)
            let code = quickBarcode;
            if (sellerSession?.omitir_digito_verificador && code.length > 1) {
                code = code.slice(0, -1);
            }
            try {
                const res = await axios.get(`/api/products/lookup/${code}`, {
                    params: { branch_id: sellerSession?.branch_id, pos_id: sellerSession?.pos_id }
                });
                const product = res.data;
                if (product.status === 'inactivo') {
                    setQuickBarcode('');
                    return toast.error('El producto se encuentra inactivo');
                }
                finishBarcodeLookup(product, false, autoAdd);
            } catch {
                // Si no es producto, buscar en combos
                const combo = combos.find(c => c.barcode === code);
                if (combo) {
                    if (combo.status === 'inactive') {
                        setQuickBarcode('');
                        return toast.error('El combo se encuentra inactivo');
                    }
                    finishBarcodeLookup(combo, true, autoAdd);
                } else {
                    toast.error('El código no corresponde a un producto asignado a este punto de venta');
                    setQuickBarcode('');
                }
            }
        } finally {
            barcodeLookupInFlightRef.current = false;
            scanEntryRef.current = null;
        }
    };

    const handleBarcodeSubmit = async (e) => {
        recordBarcodeKeystroke();
        if (e.key === 'Enter') {
            await performBarcodeLookup(classifyScanEntry());
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
            const agreedPriceInfo = !isCombo ? getCustomerAgreedPrice(quickProd) : null;
            const isAgreed = !!agreedPriceInfo || quickProd.isAgreedPrice === true;
            
            const existing = cart.find(item => 
                isCombo ? (item.combo_id === quickProd.id) : (item.id === quickProd.id && !item.isManual && !item.combo_id)
            );

            if (existing) {
                setCart(cart.map(item => {
                    if (isCombo ? item.combo_id === quickProd.id : (item.id === quickProd.id && !item.isManual && !item.combo_id)) {
                        const newQty = item.cantidad + qty;
                        const res = computeItemDiscount(item, newQty, price);
                        return { 
                            ...item, 
                            cantidad: newQty, 
                            precio: price, 
                            descuento: res.descuento, 
                            unitDiscount: res.unitDiscount, 
                            promoApplied: res.promoApplied,
                            upsellPromo: res.upsellPromo,
                            discountApplied: res.discountApplied,
                            isAgreedPrice: isAgreed || item.isAgreedPrice 
                        };
                    }
                    return item;
                }));
            } else {
                const productRule = !isCombo ? getProductDiscountRule(quickProd.id) : null;
                const tempItem = {
                    id: isCombo ? null : quickProd.id,
                    combo_id: isCombo ? quickProd.id : null,
                    nombre: (quickProd.nombre || quickProd.name),
                    codigo: (quickProd.codigo || quickProd.barcode),
                    tipo_combustible: quickProd.tipo_combustible || 0,
                    precio: price,
                    cantidad: qty,
                    descuento: 0,
                    exento: false,
                    isManual: false,
                    discountRule: productRule || null,
                    isAgreedPrice: isAgreed,
                    agreedPriceInfo: agreedPriceInfo || quickProd.agreedPriceInfo || null
                };
                const res = computeItemDiscount(tempItem, qty, price);
                setCart([...cart, {
                    ...tempItem,
                    descuento: res.descuento,
                    unitDiscount: res.unitDiscount,
                    promoApplied: res.promoApplied,
                    upsellPromo: res.upsellPromo,
                    discountApplied: res.discountApplied
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

    const removeFromCart = (id) => {
        const nextCart = cart.filter(item => item.id !== id);
        setCart(nextCart);
        if (nextCart.length === 0) {
            setGeneralDiscount(0);
            setGeneralDiscountPercentage(null);
        }
    };

    const updateItem = (id, field, value) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                // Validación para Nota de Crédito (05)
                if (tipoDte === '05') {
                    if (field === 'cantidad') {
                        const numVal = parseFloat(value) || 0;
                        if (item.originalQty !== undefined && numVal > item.originalQty) {
                            toast.error(`La cantidad no puede superar el original (${item.originalQty})`);
                            return item;
                        }
                        const unitDisc = (item.unitDiscount !== undefined) 
                            ? item.unitDiscount 
                            : (item.originalQty > 0 ? (parseFloat(item.descuento || 0) / item.originalQty) : 0);
                        const newDescuento = Math.round((unitDisc * numVal) * 100) / 100;
                        return { ...item, cantidad: value, descuento: newDescuento, unitDiscount: unitDisc };
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

                if (field === 'cantidad') {
                    const newQty = parseFloat(value) || 0;
                    const res = computeItemDiscount(item, newQty);
                    return { 
                        ...item, 
                        cantidad: value, 
                        descuento: res.descuento, 
                        unitDiscount: res.unitDiscount,
                        promoApplied: res.promoApplied,
                        upsellPromo: res.upsellPromo,
                        discountApplied: res.discountApplied
                    };
                }

                if (field === 'precio') {
                    const newPrice = parseFloat(value) || 0;
                    const res = computeItemDiscount(item, item.cantidad, newPrice);
                    return { 
                        ...item, 
                        precio: value, 
                        descuento: res.descuento, 
                        unitDiscount: res.unitDiscount,
                        promoApplied: res.promoApplied,
                        upsellPromo: res.upsellPromo,
                        discountApplied: res.discountApplied
                    };
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

                toast.error('Sesión no válida o expirada. Redirigiendo...', { id: 'session-expired' });
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
        <div className="min-h-0 flex flex-col gap-4 pb-20 overflow-y-auto custom-scrollbar pr-2 -mt-6 md:-mt-8">
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
                                        onClick={() => setIsCustomerSearchOpen(true)}
                                        className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg transition-all"
                                        title="Buscar Cliente"
                                    >
                                        <Search size={16} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setEditingCustomer(null);
                                            setDocNumberValue('');
                                            setNrcValue('');
                                            setDocType('DUI');
                                            setCondicionFiscal('otro');
                                            setSelectedDept('');
                                            setSelectedMun('');
                                            setSelectedDistrito('');
                                            setSelectedActivity('');
                                            setSelectedPais('9579');
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
                                    loadOptions={loadCustomersOptions}
                                    value={customerId}
                                    onChange={(e, opt) => handleCustomerSelect(e.target.value, opt)}
                                    placeholder="Consumidor Final (General)"
                                    valueKey="id"
                                    labelKey="nombre"
                                    displayKey="nombre"
                                    codeKey="nit"
                                    codeLabel="NIT/DOC"
                                    selectedLabel={selectedCustomerData?.nombre}
                                    dropdownWidth={440}
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
                                <div className="relative p-3 bg-indigo-50/30 rounded-2xl border border-indigo-100/50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-200 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => handleCustomerSelect('', null)}
                                        className="absolute top-2 right-2 p-1 rounded-lg text-slate-600 hover:text-red-500 hover:bg-red-50 transition-all"
                                        title="Quitar Cliente"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pr-8">
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

                                        <div className="flex flex-col col-span-2 sm:col-span-1 border-t border-indigo-100/30 pt-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Actividad Económica</span>
                                            <span className="text-[10px] font-bold text-slate-700 truncate" title={selectedCustomerData.actividad_nombre || 'Sin Giro'}>
                                                {selectedCustomerData.actividad_nombre || 'GIRO NO ASIGNADO'}
                                            </span>
                                        </div>

                                        <div className="flex flex-col col-span-2 sm:col-span-1 border-t border-indigo-100/30 pt-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Condición Fiscal</span>
                                            <span className="text-[10px] font-bold truncate uppercase" title={selectedCustomerData.condicion_fiscal || (selectedCustomerData.nrc ? 'contribuyente' : 'otro')}
                                                style={{ color: selectedCustomerData.condicion_fiscal === 'gran contribuyente' ? '#d97706' : '#334155' }}>
                                                {selectedCustomerData.condicion_fiscal === 'otro' 
                                                    ? 'CONSUMIDOR FINAL' 
                                                    : (selectedCustomerData.condicion_fiscal || (selectedCustomerData.nrc ? 'CONTRIBUYENTE' : 'CONSUMIDOR FINAL')).toUpperCase()}
                                            </span>
                                        </div>

                                        <div className="flex flex-col border-t border-indigo-100/30 pt-1">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter flex items-center gap-1">
                                                Ubicación {activeAddressInfo?.isBranch && (
                                                    <span className="px-1 py-0.2 bg-amber-100 text-amber-700 text-[7px] font-black rounded-sm truncate max-w-[80px]">
                                                        {activeAddressInfo.branchName}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-600 truncate uppercase">
                                                Dist. {activeAddressInfo?.distrito_nombre || activeAddressInfo?.distrito || '01'}, {activeAddressInfo?.municipio_nombre || 'MUNIC.'}, {activeAddressInfo?.departamento_nombre || 'DEPTO.'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col border-t border-indigo-100/30 pt-1 text-right">
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">Dirección</span>
                                            <span className="text-[10px] font-medium text-slate-500 line-clamp-1 italic text-right" title={activeAddressInfo?.direccion}>
                                                {activeAddressInfo?.direccion || 'Dirección s/n'}
                                            </span>
                                        </div>
                                    </div>
                                    {selectedCustomerMissing.length > 0 && (tipoDte !== '01' || (totals?.total || 0) >= 200) && (
                                        <div className="mt-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2 animate-in fade-in zoom-in-95 duration-200">
                                            <span className="text-[10px] font-bold text-amber-700">
                                                Faltan: {selectedCustomerMissing.join(', ')} — obligatorio para facturar
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleEditCustomer}
                                                className="text-[10px] font-black text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded-lg uppercase transition-all"
                                            >
                                                Editar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {selectedCustomerData && customerBranches.length > 0 && (
                                <div className="flex items-center gap-2 p-2 bg-amber-50/50 rounded-xl border border-amber-100/50">
                                    <label className="text-[10px] font-black text-amber-600 uppercase whitespace-nowrap">Sucursal</label>
                                    <select 
                                        value={customerBranchId} 
                                        onChange={(e) => setCustomerBranchId(e.target.value)}
                                        className="flex-1 px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all"
                                    >
                                        <option value="">Principal</option>
                                        {customerBranches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.nombre} — Dist. {b.distrito_nombre || b.distrito || '01'}, {b.municipio_nombre || b.municipio}, {b.departamento_nombre || b.departamento}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Tipo DTE + Vendedor Section (Col 7-11) */}
                        <div className="md:col-span-5 flex flex-col gap-3 pt-1">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo Documento</label>
                                    <div className="flex items-center gap-2">
                                        {activeContingency && (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse shadow-sm">
                                                <AlertTriangle size={11} /> CONTINGENCIA ACTIVA
                                            </span>
                                        )}
                                    </div>
                                </div>
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
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Vendedor</label>
                                <div className="px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-sm font-bold text-indigo-600 flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${currentShift ? 'bg-green-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                    {sellerSession ? `${sellerSession.seller_name} — ${sellerSession.pos_name || 'Sin POS'}` : 'Acceso Limitado'}
                                    {currentShift?.shift_number && <span className="text-[10px] font-black text-indigo-400 ml-auto">#{currentShift.shift_number}</span>}
                                </div>
                            </div>
                        </div>

                        {/* History / Refs & Lotes Section (Col 12) */}
                        <div className="md:col-span-1 flex items-end justify-end h-full py-1 gap-1.5">
                            {hasEggLots && (
                                <button 
                                    type="button"
                                    onClick={() => setIsLotModalOpen(true)}
                                    className="bg-amber-50 hover:bg-amber-100 text-amber-700 p-3 rounded-2xl transition-all shadow-sm border border-amber-200/60 relative group"
                                    title="Selección de Lotes Ovoproductos (Alt + Shift + L)"
                                >
                                    <Layers size={20} className="text-amber-600" />
                                    <span className="hidden group-hover:block absolute -top-8 right-0 bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded whitespace-nowrap z-30 shadow">
                                        Lotes (Alt+Shift+L)
                                    </span>
                                </button>
                            )}
                            <button 
                                type="button"
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
                                    {/* Tipo de ítem de exportación — CAT-011 */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-wider ml-1">Tipo de ítem</label>
                                        <select
                                            className="bg-white rounded-xl px-4 py-2 text-sm font-bold border-0 outline-none"
                                            value={fexData.itemType}
                                            onChange={e => setFexData({...fexData, itemType: parseInt(e.target.value)})}
                                        >
                                            <option value={1}>Bienes</option>
                                            <option value={2}>Servicios</option>
                                            <option value={3}>Bienes y Servicios</option>
                                            <option value={4}>Otro</option>
                                        </select>
                                    </div>
                                    {/* Recinto fiscal — opcional, solo si aplica zona franca */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-wider ml-1">Recinto fiscal <span className="normal-case font-normal text-slate-400">(opcional)</span></label>
                                        <input
                                            className="bg-white rounded-xl px-4 py-2 text-sm font-bold"
                                            placeholder="Cód. 2 dígitos"
                                            maxLength={2}
                                            value={fexData.enclosure}
                                            onChange={e => setFexData({...fexData, enclosure: e.target.value})}
                                        />
                                    </div>
                                    {/* País de destino */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black uppercase text-indigo-400 tracking-wider ml-1">País destino (ISO)</label>
                                        <input
                                            className="bg-white rounded-xl px-4 py-2 text-sm font-bold"
                                            placeholder="Ej: US, HN, GT"
                                            maxLength={2}
                                            value={fexData.country}
                                            onChange={e => setFexData({...fexData, country: e.target.value.toUpperCase()})}
                                        />
                                    </div>
                                </>
                            ) : tipoDte === '04' ? (
                                <>
                                    <input className="bg-white rounded-xl px-4 py-2 text-sm font-bold" placeholder="Transportista" value={nrData.transporterName} onChange={e => setNrData({...nrData, transporterName: e.target.value})} />
                                    <input className="bg-white rounded-xl px-4 py-2 text-sm font-bold" placeholder="Placa" value={nrData.vehiclePlate} onChange={e => setNrData({...nrData, vehiclePlate: e.target.value})} />
                                    <select className="bg-white rounded-xl px-4 py-2 text-sm font-bold" value={nrData.type} onChange={e => setNrData({...nrData, type: e.target.value})}>
                                        <option value="02">Traslado</option>
                                        <option value="01">Venta</option>
                                    </select>
                                </>
                            ) : null}
                        </div>
                    )}

                    {/* Área Principal (Carrito y Totales) */}
                    <div className="flex-none flex flex-col lg:flex-row gap-4 mb-6">
                        <div className="flex-[8] bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                            {/* Quick Add Bar (Like Purchases) */}
                            <div className="p-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 md:grid-cols-[120px_1fr_80px_100px_100px_40px] gap-2 items-end">
                                <div className="col-span-2 md:col-span-1">
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
                                            className="w-full pl-7 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 font-mono text-[10px] font-bold transition-all" 
                                        />
                                        <button 
                                            onClick={() => performBarcodeLookup(false)} 
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-indigo-600 transition-colors"
                                        >
                                            <Search size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="col-span-2 md:col-span-1">
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
                                        className={`w-full px-3 py-1.5 rounded-lg text-[10px] font-black h-[30px] flex items-center transition-all outline-none ${quickProd ? 'bg-slate-100 text-slate-500 border border-slate-200 unselectable' : 'bg-white border border-indigo-200 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400'}`}
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
                                        {getCustomerAgreedPrice(quickProd) && (
                                            <div className="absolute -bottom-4 right-0 flex items-center gap-1 text-[7px] font-black text-indigo-600 uppercase italic">
                                                <Handshake size={8} /> Pactado
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
                                    className="h-10 md:h-[30px] w-full bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-black disabled:opacity-20 active:scale-95 transition-all shadow-sm"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left table-cards">
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
                                                <td className="pl-6 py-4" data-label="Ítem">
                                                    <div className="font-bold text-slate-800 text-xs">{item.nombre}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-mono text-indigo-400">{item.codigo}</span>
                                                        {item.isAgreedPrice && (
                                                            <span className="inline-flex items-center gap-1 text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full" title={`Precio pactado en acuerdo con cliente: $${parseFloat(item.precio || 0).toFixed(2)}`}>
                                                                <Handshake size={9} className="text-indigo-600" />
                                                                Pactado
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.promoApplied && (
                                                        <div className="mt-1 flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md inline-flex shadow-xs">
                                                            <Sparkles size={10} className="text-emerald-600" />
                                                            <span>↳ 🏷️ PROMO {item.promoApplied.name.toUpperCase()}: -${parseFloat(item.descuento || 0).toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    {item.upsellPromo && (
                                                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-md shadow-xs">
                                                                <Sparkles size={10} className="text-amber-600" />
                                                                {item.upsellPromo.hint}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(item.id, 'cantidad', item.upsellPromo.targetQty)}
                                                                className="text-[9px] font-black uppercase text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 px-2 py-0.5 rounded transition-all shadow-xs active:scale-95"
                                                                title={`Aumentar a ${item.upsellPromo.targetQty} unidades para completar la promoción`}
                                                            >
                                                                + Aplicar ({item.upsellPromo.targetQty}u)
                                                            </button>
                                                        </div>
                                                    )}
                                                    {!item.promoApplied && item.discountRule && !item.discountApplied && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (hasGeneralDiscount) {
                                                                    toast.error('No se puede aplicar descuento por producto: ya existe un descuento general activo en la venta.');
                                                                    return;
                                                                }
                                                                if (!posAllowsDiscounts) {
                                                                    toast.error('Los descuentos están inhabilitados en este punto de venta.');
                                                                    return;
                                                                }
                                                                applyDiscountRule(item.id);
                                                            }}
                                                            className={`mt-1 flex items-center gap-1 text-[8px] font-bold border px-2 py-0.5 rounded-full transition-all ${
                                                                hasGeneralDiscount || !posAllowsDiscounts
                                                                    ? 'text-slate-400 bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                                                                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 shadow-sm'
                                                            }`}
                                                            title={hasGeneralDiscount ? "Inhabilitado: descuento general activo" : !posAllowsDiscounts ? "Inhabilitado en este POS" : "Aplicar regla de descuento configurada"}
                                                        >
                                                            <Tag size={10} />
                                                            {item.discountRule.discount_type === 'percentage'
                                                                ? `Aplicar Regla: -${parseFloat(item.discountRule.discount_value)}%`
                                                                : `Aplicar Regla: -$${parseFloat(item.discountRule.discount_value).toFixed(2)}/u`
                                                            }
                                                        </button>
                                                    )}
                                                    {!item.promoApplied && item.discountRule && item.discountApplied && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveItemDiscount(item.id)}
                                                            className="mt-1 flex items-center gap-1 text-[8px] font-bold border px-2 py-0.5 rounded-full transition-all text-emerald-700 bg-emerald-50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border-emerald-200 group/disc shadow-sm"
                                                            title="Regla aplicada. Clic para remover el descuento"
                                                        >
                                                            <Tag size={10} />
                                                            <span>
                                                                {item.discountRule.discount_type === 'percentage'
                                                                    ? `Regla: -${parseFloat(item.discountRule.discount_value)}% (-$${parseFloat(item.descuento || 0).toFixed(2)})`
                                                                    : `Regla: -$${parseFloat(item.discountRule.discount_value).toFixed(2)}/u (-$${parseFloat(item.descuento || 0).toFixed(2)})`
                                                                }
                                                            </span>
                                                            <X size={9} className="opacity-60 group-hover/disc:opacity-100" />
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="px-2 sm:px-4 py-4 text-center" data-label="Cant.">
                                                    <div className="inline-flex items-center justify-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-sm">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const current = parseFloat(item.cantidad) || 0;
                                                                if (current > 1) {
                                                                    updateItem(item.id, 'cantidad', Math.round((current - 1) * 100) / 100);
                                                                } else if (current > 0.01 && current <= 1) {
                                                                    updateItem(item.id, 'cantidad', Math.max(0.01, Math.round((current - 0.1) * 100) / 100));
                                                                }
                                                            }}
                                                            disabled={parseFloat(item.cantidad) <= 0.01}
                                                            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Disminuir cantidad"
                                                        >
                                                            <Minus size={13} strokeWidth={2.5} />
                                                        </button>
                                                        <input 
                                                            type="number"
                                                            step="any"
                                                            min="0.01"
                                                            className="w-10 sm:w-12 text-center bg-transparent font-black text-xs py-1 outline-none text-slate-800"
                                                            value={item.cantidad}
                                                            onChange={(e) => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                                                            onFocus={(e) => e.target.select()}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const current = parseFloat(item.cantidad) || 0;
                                                                if (tipoDte === '05' && item.originalQty !== undefined && current >= item.originalQty) {
                                                                    toast.error(`La cantidad no puede superar el original (${item.originalQty})`);
                                                                    return;
                                                                }
                                                                updateItem(item.id, 'cantidad', Math.round((current + 1) * 100) / 100);
                                                            }}
                                                            disabled={tipoDte === '05' && item.originalQty !== undefined && parseFloat(item.cantidad) >= item.originalQty}
                                                            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                                            title="Aumentar cantidad"
                                                        >
                                                            <Plus size={13} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right" data-label="Precio">
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
                                                        <div className="font-bold text-xs text-slate-700">${(tipoDte === '11' ? parseFloat(item.precio || 0) / (1 + parseFloat(taxSettings?.iva_rate || 13) / 100) : parseFloat(item.precio || 0)).toFixed(2)}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right" data-label="Desc.">
                                                    {canApplyItemDiscount ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (hasGeneralDiscount && (parseFloat(item.descuento) || 0) <= 0) {
                                                                    toast.error('No se puede aplicar descuento por producto: ya existe un descuento general activo en la venta.');
                                                                    return;
                                                                }
                                                                setSelectedDiscountItem(item);
                                                            }}
                                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                                                (item.descuento || 0) > 0 
                                                                    ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 shadow-sm' 
                                                                    : hasGeneralDiscount
                                                                        ? 'text-slate-300 border border-transparent cursor-not-allowed opacity-60'
                                                                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 border border-transparent'
                                                            }`}
                                                            title={hasGeneralDiscount && (parseFloat(item.descuento) || 0) <= 0 ? "Inhabilitado: descuento general activo" : "Editar o aplicar descuento a este producto"}
                                                        >
                                                            <Tag size={11} />
                                                            <span>{(item.descuento || 0) > 0 ? `-$${parseFloat(item.descuento).toFixed(2)}` : '$0.00'}</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-rose-500 font-bold text-xs">
                                                            {(item.descuento || 0) > 0 ? `-$${parseFloat(item.descuento).toFixed(2)}` : '$0.00'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right font-black text-slate-900 text-xs" data-label="Subtotal">
                                                    ${(tipoDte === '11' ? (((parseFloat(item.precio || 0) * (parseFloat(item.cantidad || 0))) - (parseFloat(item.descuento || 0))) / (1 + parseFloat(taxSettings?.iva_rate || 13) / 100)) : ((parseFloat(item.precio || 0) * (parseFloat(item.cantidad || 0))) - (parseFloat(item.descuento || 0)))).toFixed(2)}
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
                            <div className="bg-slate-900 rounded-[2rem] p-5 text-white shadow-xl">
                                <div className="space-y-1.5 mb-4 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                                    {tipoDte === '07' ? (
                                        <>
                                            <div className="flex justify-between border-b border-white/10 pb-1"><span>Docs. Vinculados</span><span>{linkedDocs.length}</span></div>
                                            <div className="flex justify-between border-b border-white/10 pb-1 text-blue-300"><span>Sujeto a Retención</span><span>${totals.totalSujetoRetencion.toFixed(2)}</span></div>
                                            <div className="flex justify-between border-b border-white/10 pb-1 text-rose-300"><span>IVA Retenido (1%)</span><span>${totals.totalIVAretenido.toFixed(2)}</span></div>
                                        </>
                                    ) : (
                                        <>
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>Gravadas</span><span>${totals.viewGravadas.toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>IVA ({(taxSettings?.iva_rate || 13)}%)</span><span>${totals.viewIva.toFixed(2)}</span></div>
                                    <div className="flex justify-between items-center border-b border-white/10 pb-1 text-orange-200">
                                        <span>FOVIAL ${totals.fovial.toFixed(2)}</span>
                                        <span className="opacity-40 font-normal">|</span>
                                        <span>COTRANS ${totals.cotrans.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-white/10 pb-1 text-blue-300">
                                        <span>EXENTAS ${totals.exento.toFixed(2)}</span>
                                        <span className="opacity-40 font-normal">|</span>
                                        <span className="text-slate-400">NO SUJETAS ${totals.noSujeto.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 font-black text-indigo-300"><span>Subtotal s/Impuestos</span><span>${totals.subtotal.toFixed(2)}</span></div>
                                    <div className="flex justify-between items-center border-b border-white/10 pb-1 text-rose-300">
                                        <span>RETENCIÓN -${totals.retencion.toFixed(2)}</span>
                                        <span className="opacity-40 font-normal">|</span>
                                        <span>PERCEPCIÓN +${totals.percepcion.toFixed(2)}</span>
                                    </div>
                                    <div className={`flex justify-between border-b border-white/10 pb-1 items-center ${totals.totalItemDiscounts > 0 ? 'text-rose-300 font-bold' : 'text-slate-400'}`}>
                                        <span className="flex items-center gap-1"><Tag size={10} /> Desc. Ítems</span>
                                        <span className="font-mono text-[10px]">-${totals.totalItemDiscounts.toFixed(2)}</span>
                                    </div>
                                    <div className={`flex justify-between border-b border-white/10 pb-1 items-center ${generalDiscount > 0 ? 'text-rose-300 font-bold' : 'text-slate-400'}`}>
                                        <span className="flex items-center gap-1"><Tag size={10} /> Desc. General</span>
                                        <span className="font-mono text-[10px]">-${generalDiscount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-indigo-400"><span>Monto Operación</span><span>${totals.montoOperacion.toFixed(2)}</span></div>
                                        </>
                                    )}
                                </div>
                                <div className="text-4xl font-black mb-3 tracking-tighter">${(tipoDte === '07' ? totals.totalIVAretenido : totals.total).toFixed(2)}</div>
                                
                                {canApplyGeneralDiscount && cart.length > 0 && tipoDte !== '07' && tipoDte !== '05' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (hasItemDiscounts && !hasGeneralDiscount) {
                                                toast.error('No se puede aplicar descuento general: ya existen productos con descuento individual en la venta.');
                                                return;
                                            }
                                            setIsGeneralDiscountModalOpen(true);
                                        }}
                                        className={`w-full mb-3 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between border ${
                                            generalDiscount > 0 
                                                ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 hover:bg-rose-500/30' 
                                                : hasItemDiscounts
                                                    ? 'bg-white/5 text-slate-400 border-white/5 cursor-not-allowed opacity-60'
                                                    : 'bg-white/10 text-slate-200 border-white/10 hover:bg-white/15'
                                        }`}
                                        title={hasItemDiscounts && !hasGeneralDiscount ? "Inhabilitado: ya existen productos con descuento individual" : "Descuento general"}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Tag size={13} className={generalDiscount > 0 ? 'text-rose-300' : 'text-slate-300'} />
                                            <span>{generalDiscount > 0 ? `Desc. General: -$${generalDiscount.toFixed(2)}` : 'Descuento General'}</span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {generalDiscount > 0 && (
                                                <span 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setGeneralDiscount(0);
                                                        setGeneralDiscountPercentage(null);
                                                        toast.info('Descuento general eliminado');
                                                    }}
                                                    className="p-1 text-rose-300 hover:text-white hover:bg-rose-600/40 rounded transition-colors"
                                                    title="Quitar descuento"
                                                >
                                                    <X size={12} />
                                                </span>
                                            )}
                                            <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-slate-300">F8</span>
                                        </div>
                                    </button>
                                )}

                                <button 
                                    disabled={tipoDte === '07' ? linkedDocs.length === 0 : (tipoDte === '05' ? (cart.length === 0 || linkedDocs.length === 0) : cart.length === 0)}
                                    onClick={goToPayment}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black uppercase text-xs hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
                                >
                                    {tipoDte === '07' ? 'Emitir Retención (F10)' : tipoDte === '05' ? 'Emitir Nota de Crédito (F10)' : 'Pagar (F10)'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col gap-2 bg-white rounded-[3rem] pt-4 pb-5 px-4 md:px-6 shadow-sm border border-slate-100 animate-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between mb-0">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Caja de Cobro</h2>
                        <button onClick={() => setActiveView('pos')} className="bg-slate-100 p-4 rounded-2xl"><X size={24} className="text-slate-600" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                        {/* Columna de Resumen */}
                        <div className="bg-slate-50 p-4 rounded-[3rem] flex flex-col border border-slate-100 overflow-y-auto custom-scrollbar">
                            <span className="text-indigo-500 font-black uppercase text-[10px] tracking-[0.2em] mb-2">Resumen de Operación</span>
                            <div className="space-y-1 mb-4 text-[11px] font-bold text-slate-500 uppercase">
                                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span>Gravadas</span><span>${totals.viewGravadas.toFixed(2)}</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-0.5"><span>IVA ({(taxSettings?.iva_rate || 13)}%)</span><span>${totals.viewIva.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-0.5 text-orange-600">
                                    <span>FOVIAL ${totals.fovial.toFixed(2)}</span>
                                    <span className="opacity-40 font-normal">|</span>
                                    <span>COTRANS ${totals.cotrans.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-0.5 text-blue-600">
                                    <span>EXENTAS ${totals.exento.toFixed(2)}</span>
                                    <span className="opacity-40 font-normal">|</span>
                                    <span className="text-slate-400">NO SUJETAS ${totals.noSujeto.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-0.5 font-black text-indigo-600"><span>Subtotal s/Impuestos</span><span>${totals.subtotal.toFixed(2)}</span></div>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-0.5 text-slate-700">
                                    <span>RETENCIÓN -${totals.retencion.toFixed(2)}</span>
                                    <span className="opacity-40 font-normal">|</span>
                                    <span>PERCEPCIÓN +${totals.percepcion.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between border-b border-slate-100 pb-0.5 items-center ${totals.totalItemDiscounts > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                    <span className="flex items-center gap-1"><Tag size={10} /> Desc. Ítems</span>
                                    <span className="font-mono text-[10px]">-${totals.totalItemDiscounts.toFixed(2)}</span>
                                </div>
                                <div className={`flex justify-between border-b border-slate-100 pb-0.5 items-center ${generalDiscount > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                    <span className="flex items-center gap-1"><Tag size={10} /> Desc. General</span>
                                    <span className="font-mono text-[10px]">-${generalDiscount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-black text-slate-900 pt-1 text-xs italic"><span>Monto Operación</span><span>${totals.montoOperacion.toFixed(2)}</span></div>
                            </div>

                            <div className="mt-auto space-y-3">
                                <div className="flex justify-between items-end">
                                    <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Total Documento</span>
                                    <span className="text-3xl font-black text-slate-900 tracking-tighter">${totals.total.toFixed(2)}</span>
                                </div>

                                {/* Entregado y Vuelto */}
                                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm space-y-2">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Entregado</label>
                                        <MoneyInput 
                                            value={entregado}
                                            onChange={(e) => setEntregado(e.target.value)}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-400 transition-all tabular-nums text-right"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {/* Quick Amount Buttons */}
                                    <div className="flex flex-wrap gap-1">
                                        <button onClick={() => setEntregado(totals.total.toFixed(2))}
                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all">
                                            Exacto
                                        </button>
                                        {['+1', '+5', '10', '20', '50', '100'].map(val => (
                                            <button key={val} onClick={() => {
                                                const current = parseFloat(entregado) || 0;
                                                if (val.startsWith('+')) {
                                                    setEntregado((current + parseFloat(val.slice(1))).toFixed(2));
                                                } else {
                                                    setEntregado(val);
                                                }
                                            }}
                                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black transition-all">
                                                {val.startsWith('+') ? val : `$${val}`}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Vuelto */}
                                    {(() => {
                                        const v = Math.max(0, parseFloat(entregado || 0) - totals.total);
                                        return v > 0.01 ? (
                                            <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vuelto</span>
                                                <span className="text-lg font-black text-emerald-600 tabular-nums">${v.toFixed(2)}</span>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col justify-between p-3.5 bg-indigo-600 rounded-2xl text-white shadow-md">
                                        <span className="font-black uppercase text-[10px] tracking-widest opacity-80">Total Cobrado</span>
                                        <span className="text-xl font-black tracking-tight mt-1">
                                            <Money value={payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0)} />
                                        </span>
                                    </div>
                                    <div className="flex flex-col justify-between p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                        <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Saldo Pendiente</span>
                                        <span className={`text-xl font-black tracking-tight mt-1 ${condicionPago === '1' && (totals.total - payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0) > 0.01) ? 'text-rose-500' : 'text-emerald-500'}`}>
                                            <Money value={condicionPago === '1' ? Math.max(0, totals.total - payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0)) : 0} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Columna de Pagos */}
                        <div className="flex flex-col gap-3">
                            {/* Condición de Operación */}
                            <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-1">
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
                                    className="w-full px-5 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 appearance-none transition-all"
                                >
                                    {condiciones.length > 0 ? condiciones.map(c => (
                                        <option key={c.code} value={c.code} disabled={c.code === '2' && !selectedCustomerData?.es_credito}>{c.description.toUpperCase()}</option>
                                    )) : (
                                        <>
                                            <option value="1">CONTADO</option>
                                            <option value="2" disabled={!selectedCustomerData?.es_credito}>CRÉDITO</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Formulario de Abono */}
                            <div className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Forma de Pago</label>
                                        <select 
                                            value={currentPayment.metodo_pago}
                                            onChange={(e) => setCurrentPayment({...currentPayment, metodo_pago: e.target.value})}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        >
                                            {paymentMethods.length > 0 ? paymentMethods.map(m => (
                                                <option key={m.code} value={m.code}>{m.description}</option>
                                            )) : (
                                                <>
                                                    <option value="01">Billetes y Monedas</option>
                                                    <option value="02">Tarjeta de Débito</option>
                                                    <option value="03">Tarjeta de Crédito</option>
                                                    <option value="04">Cheque</option>
                                                    <option value="05">Transferencia - Depósito Bancario</option>
                                                    <option value="99">Otros</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block ml-1">Monto a Recibir</label>
                                        <MoneyInput 
                                            value={currentPayment.monto}
                                            onChange={(e) => setCurrentPayment({...currentPayment, monto: e.target.value})}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                </div>

                                {['02', '03', '04', '05', '08', '09', '11', '12', '13', '14', '99'].includes(currentPayment.metodo_pago) && (
                                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
                                        {currentPayment.metodo_pago === '04' ? (
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
                                        
                                        // Validar que no supere el total (excepto efectivo que genera vuelto)
                                        const alreadyPaid = payments.reduce((acc, p) => acc + parseFloat(p.monto), 0);
                                        if (currentPayment.metodo_pago !== '01' && alreadyPaid + monto > totals.total + 0.01) {
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
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black active:scale-95 transition-all shadow-md"
                                >
                                    Agregar Abono
                                </button>
                            </div>

                            {/* Listado de Abonos */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {condicionPago === '2' ? 'Primas / Abonos Iniciales' : 'Registro de Abonos'}
                                    </span>
                                </div>
                                {payments.map((p, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-3xl border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
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
                                        <div className="flex items-center gap-2 sm:gap-6">
                                            <span className="text-xl font-black text-slate-900 tracking-tight"><Money value={p.monto} /></span>
                                            <button onClick={() => setPayments(payments.filter((_, i) => i !== idx))} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20} /></button>
                                        </div>
                                    </div>
                                ))}
                                {payments.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-slate-300 gap-3 border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                                        <Calculator size={40} className="opacity-20" />
                                        <span className="font-bold uppercase text-[10px] tracking-[0.2em] italic">Esperando abonos...</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 py-2">
                                <button 
                                    onClick={handleProcessSale}
                                    disabled={processSale.isPending || (condicionPago === '1' && payments.reduce((acc, p) => acc + parseFloat(p.monto || 0), 0) < (totals.total - 0.01))}
                                    className={`w-full text-white py-5 rounded-[2.5rem] font-black uppercase text-sm tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                                        processSale.isPending 
                                            ? 'bg-indigo-700 cursor-wait shadow-indigo-500/30' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed'
                                    }`}
                                >
                                    {processSale.isPending ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin text-white" />
                                            <span>{activeContingency ? 'Emitiendo DTE en Contingencia...' : 'Transmitiendo DTE a Hacienda...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{activeContingency ? 'Emitir en Contingencia' : 'Finalizar y Facturar'}</span>
                                            <span className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-mono font-bold tracking-normal border border-white/30">
                                                F10
                                            </span>
                                            {activeContingency ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-amber-950 uppercase tracking-tight shadow-xs">
                                                    <AlertTriangle size={11} /> Contingencia
                                                </span>
                                            ) : (
                                                <ChevronRight size={20} />
                                            )}
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                    {activeContingency ? (
                                        <span className="text-amber-600 font-black inline-flex items-center gap-1">
                                            <AlertTriangle size={11} /> El DTE se emitirá localmente en contingencia y se enviará a @HaciendaSV al reanudar conexión
                                        </span>
                                    ) : (
                                        'Al confirmar, el documento será enviado a @HaciendaSV'
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {/* Modal de Catálogo de Productos (F3) */}
            <PosProductCatalogModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                selectedCategoryFilter={selectedCategoryFilter}
                setSelectedCategoryFilter={setSelectedCategoryFilter}
                setModalPage={setModalPage}
                categoriesList={categoriesList}
                combos={combos}
                productViewMode={productViewMode}
                setProductViewMode={setProductViewMode}
                isLoadingModalProducts={isLoadingModalProducts}
                modalProductsData={modalProductsData}
                filteredCombos={filteredCombos}
                filteredProducts={filteredProducts}
                addToCart={addToCart}
                getCustomerAgreedPrice={getCustomerAgreedPrice}
                modalPage={modalPage}
            />

            {/* Modal de Búsqueda Avanzada de Clientes */}
            <PosCustomerSearchModal
                isOpen={isCustomerSearchOpen}
                onClose={() => setIsCustomerSearchOpen(false)}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerNit={customerNit}
                setCustomerNit={setCustomerNit}
                customerNrc={customerNrc}
                setCustomerNrc={setCustomerNrc}
                handleCustomerSelect={handleCustomerSelect}
                isLoadingCustomerSearch={isLoadingCustomerSearch}
                customerSearchData={customerSearchData}
                customerSearchPage={customerSearchPage}
                setCustomerSearchPage={setCustomerSearchPage}
                personTypes={personTypes}
            />

            {/* Modal de Referencias Documentales DTE (F9) */}
            <PosLinkedDocModal
                isOpen={isLinkedDocModalOpen}
                onClose={() => setIsLinkedDocModalOpen(false)}
                tipoDte={tipoDte}
                customerId={customerId}
                isLoadingCustomerSales={isLoadingCustomerSales}
                customerSales={customerSales}
                linkedDocs={linkedDocs}
                setLinkedDocs={setLinkedDocs}
                setReferencingSale={setReferencingSale}
                setCart={setCart}
                setGeneralDiscount={setGeneralDiscount}
                setGeneralDiscountPercentage={setGeneralDiscountPercentage}
            />

            {/* Modal de Autenticación Logística */}
            <PosSupervisorAuthModal
                isOpen={isAuthModalOpen}
                onSubmit={handleSellerAuth}
                tipoDte={tipoDte}
                setTipoDte={setTipoDte}
                authPassword={authPassword}
                setAuthPassword={setAuthPassword}
                onExit={() => navigate('/dashboard')}
            />

            {/* Modal de Gestión de Clientes */}
            <PosCustomerModal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                editingCustomer={editingCustomer}
                handleCustomerSubmit={handleCustomerSubmit}
                condicionFiscal={condicionFiscal}
                setCondicionFiscal={setCondicionFiscal}
                nrcValue={nrcValue}
                setNrcValue={setNrcValue}
                docType={docType}
                setDocType={setDocType}
                docNumberValue={docNumberValue}
                setDocNumberValue={setDocNumberValue}
                formatDocumentNumber={formatDocumentNumber}
                formatNRC={formatNRC}
                isCustomerForeign={isCustomerForeign}
                selectedPais={selectedPais}
                setSelectedPais={setSelectedPais}
                countries={countries}
                activities={activities}
                selectedActivity={selectedActivity}
                setSelectedActivity={setSelectedActivity}
                selectedDept={selectedDept}
                setSelectedDept={setSelectedDept}
                selectedMun={selectedMun}
                setSelectedMun={setSelectedMun}
                selectedDistrito={selectedDistrito}
                setSelectedDistrito={setSelectedDistrito}
                departments={departments}
                distritos={distritos}
                municipalities={municipalities}
            />

            {/* Modal de Ingreso de Combustible */}
            <PosFuelEntryModal
                isOpen={isFuelModalOpen}
                onClose={() => {
                    setIsFuelModalOpen(false);
                    setTimeout(() => barcodeInputRef.current?.focus(), 100);
                }}
                fuelProd={fuelProd}
                getCustomerDiscount={getCustomerDiscount}
                calculateDiscountedPrice={calculateDiscountedPrice}
                fuelAmount={fuelAmount}
                setFuelAmount={setFuelAmount}
                fuelQty={fuelQty}
                setFuelQty={setFuelQty}
                handleAddFuelToCart={handleAddFuelToCart}
            />

            {/* Modal de Éxito de Venta */}
            <PosSuccessModal
                isOpen={isSuccessModalOpen}
                saleResult={saleResult}
                onPrintTicket={handlePrintTicket}
                onNewSale={handleCloseSuccess}
            />

            {/* Modal de Selección de Lotes Ovoproductos (Alt + Shift + L) */}
            <PosLotSelectionModal
                isOpen={isLotModalOpen && hasEggLots}
                onClose={() => { setIsLotModalOpen(false); setLotWarningTarget(null); }}
                lotSearch={lotSearch}
                setLotSearch={setLotSearch}
                showAllLots={showAllLots}
                setShowAllLots={setShowAllLots}
                isLoadingLots={isLoadingLots}
                availableLots={availableLots}
                handleSelectLot={handleSelectLot}
                lotWarningTarget={lotWarningTarget}
                setLotWarningTarget={setLotWarningTarget}
                executeAddLot={executeAddLot}
            />

            {/* Modal de Descuento por Ítem */}
            {selectedDiscountItem && (
                <ItemDiscountDialog
                    item={selectedDiscountItem}
                    onClose={() => setSelectedDiscountItem(null)}
                    onApply={handleApplyItemDiscount}
                    onRemove={handleRemoveItemDiscount}
                    branchPercentages={branchPercentages}
                    maxDiscountAmount={maxDiscountAmount}
                    maxDiscountPercentage={maxDiscountPercentage}
                    currentCartTotalDiscounts={totals.totalItemDiscounts}
                    currentGeneralDiscount={generalDiscount}
                />
            )}

            {/* Modal de Descuento General */}
            {isGeneralDiscountModalOpen && (
                <GeneralDiscountDialog
                    isOpen={isGeneralDiscountModalOpen}
                    onClose={() => setIsGeneralDiscountModalOpen(false)}
                    currentDiscount={generalDiscount}
                    currentDiscountPercentage={generalDiscountPercentage}
                    onApply={handleApplyGeneralDiscount}
                    onRemove={handleRemoveGeneralDiscount}
                    gravadoBruto={totals.gravadoBruto}
                    branchPercentages={branchPercentages}
                    maxDiscountAmount={maxDiscountAmount}
                    maxDiscountPercentage={maxDiscountPercentage}
                    currentCartTotalDiscounts={totals.totalItemDiscounts}
                />
            )}

            {/* Overlay de Procesamiento y Transmisión de DTE a Hacienda */}
            <DteTransmittingOverlay 
                isVisible={processSale.isPending} 
                isContingency={Boolean(activeContingency)}
            />
        </div>
    );
};

export default SalesTerminal;
