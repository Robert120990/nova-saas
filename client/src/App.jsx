import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Suspense } from 'react';
import { lazyWithRetry } from './utils/lazyRetry';

// Pages
import Login from './pages/Login';
import PublicDTE from './pages/PublicDTE';
const MobileDteScanner = lazyWithRetry(() => import('./pages/MobileDteScanner'));
import Dashboard from './pages/Dashboard';
const Companies = lazyWithRetry(() => import('./pages/Companies'));
const CompanyModules = lazyWithRetry(() => import('./pages/CompanyModules'));
const Branches = lazyWithRetry(() => import('./pages/Branches'));
import POS from './pages/POS';
const FilproSync = lazyWithRetry(() => import('./pages/FilproSync'));
import Customers from './pages/Customers';
import Products from './pages/Products';
const Sellers = lazyWithRetry(() => import('./pages/Sellers'));
const Users = lazyWithRetry(() => import('./pages/Users'));
const Roles = lazyWithRetry(() => import('./pages/Roles'));
const Providers = lazyWithRetry(() => import('./pages/Providers'));
const Categories = lazyWithRetry(() => import('./pages/Categories'));
const UserAccess = lazyWithRetry(() => import('./pages/UserAccess'));
const SmtpConfig = lazyWithRetry(() => import('./pages/SmtpConfig'));
const SystemSettings = lazyWithRetry(() => import('./pages/SystemSettings'));
const ServerTerminal = lazyWithRetry(() => import('./pages/ServerTerminal'));
const NotificacionesConfig = lazyWithRetry(() => import('./pages/NotificacionesConfig'));
const NotificacionesLista = lazyWithRetry(() => import('./pages/NotificacionesLista'));
const WhatsAppConfig = lazyWithRetry(() => import('./pages/WhatsAppConfig'));
const MenuItems = lazyWithRetry(() => import('./pages/MenuItems'));
const Transfers = lazyWithRetry(() => import('./pages/Transfers'));
const InventoryAdjustments = lazyWithRetry(() => import('./pages/InventoryAdjustments'));
const PhysicalInventory = lazyWithRetry(() => import('./pages/PhysicalInventory'));
const ScanInventory = lazyWithRetry(() => import('./pages/ScanInventory'));
import Kardex from './pages/Kardex';
const Purchases = lazyWithRetry(() => import('./pages/Purchases'));
const PurchasePeriod = lazyWithRetry(() => import('./pages/PurchasePeriod'));
import SalesTerminal from './pages/SalesTerminal';
const SalesHistory = lazyWithRetry(() => import('./pages/SalesHistory'));
const CustomerDiscounts = lazyWithRetry(() => import('./pages/CustomerDiscounts'));
const DiscountRules = lazyWithRetry(() => import('./pages/DiscountRules'));
const Promotions = lazyWithRetry(() => import('./pages/Promotions'));
const ChartOfAccounts = lazyWithRetry(() => import('./pages/ChartOfAccounts'));
const AccountingEntries = lazyWithRetry(() => import('./pages/AccountingEntries'));
const AccountingGenerate = lazyWithRetry(() => import('./pages/AccountingGenerate'));
const AccountingCorrelativos = lazyWithRetry(() => import('./pages/AccountingCorrelativos'));
const YearClosing = lazyWithRetry(() => import('./pages/YearClosing'));
const YearOpening = lazyWithRetry(() => import('./pages/YearOpening'));
const AccountingSettings = lazyWithRetry(() => import('./pages/AccountingSettings'));
const LibroDiario = lazyWithRetry(() => import('./pages/AccountingReports/LibroDiario'));
const LibroDiarioMayor = lazyWithRetry(() => import('./pages/AccountingReports/LibroDiarioMayor'));
const LibroMayor = lazyWithRetry(() => import('./pages/AccountingReports/LibroMayor'));
const BalanceComprobacion = lazyWithRetry(() => import('./pages/AccountingReports/BalanceComprobacion'));
const EstadoResultados = lazyWithRetry(() => import('./pages/AccountingReports/EstadoResultados'));
const BalanceGeneral = lazyWithRetry(() => import('./pages/AccountingReports/BalanceGeneral'));
const AnexoBalance = lazyWithRetry(() => import('./pages/AccountingReports/AnexoBalance'));
const BalanceComparativo = lazyWithRetry(() => import('./pages/AccountingReports/BalanceComparativo'));
const CambiosPatrimonio = lazyWithRetry(() => import('./pages/AccountingReports/CambiosPatrimonio'));
const FlujoEfectivo = lazyWithRetry(() => import('./pages/AccountingReports/FlujoEfectivo'));
const AuxiliarOperaciones = lazyWithRetry(() => import('./pages/AccountingReports/AuxiliarOperaciones'));
const ListadoPartidas = lazyWithRetry(() => import('./pages/AccountingReports/ListadoPartidas'));
const CedulaAuditoria = lazyWithRetry(() => import('./pages/AccountingReports/CedulaAuditoria'));
const Retenciones = lazyWithRetry(() => import('./pages/AccountingReports/Retenciones'));
const DailySalesReport = lazyWithRetry(() => import('./pages/DailySalesReport'));
const SalesByCustomerReport = lazyWithRetry(() => import('./pages/SalesByCustomerReport'));
const Contingency = lazyWithRetry(() => import('./pages/Contingency'));
const Eret = lazyWithRetry(() => import('./pages/Eret'));
const AuditLog = lazyWithRetry(() => import('./pages/AuditLog'));
const ServerMetrics = lazyWithRetry(() => import('./pages/ServerMetrics'));
const ConnectedUsers = lazyWithRetry(() => import('./pages/ConnectedUsers'));
const Changelog = lazyWithRetry(() => import('./pages/Changelog'));
const KeyboardShortcuts = lazyWithRetry(() => import('./pages/KeyboardShortcuts'));
const CashClosing = lazyWithRetry(() => import('./pages/CashClosing'));
const Combos = lazyWithRetry(() => import('./pages/Combos'));
const CustomerStatement = lazyWithRetry(() => import('./pages/CustomerStatement'));
const AddPayment = lazyWithRetry(() => import('./pages/AddPayment'));
const ProviderStatement = lazyWithRetry(() => import('./pages/ProviderStatement'));
const AddProviderPayment = lazyWithRetry(() => import('./pages/AddProviderPayment'));
const InventoryStockReport = lazyWithRetry(() => import('./pages/InventoryStockReport'));
const InventoryMovementsReport = lazyWithRetry(() => import('./pages/InventoryMovementsReport'));
const InventoryValuationReport = lazyWithRetry(() => import('./pages/InventoryValuationReport'));
const InventoryTurnoverReport = lazyWithRetry(() => import('./pages/InventoryTurnoverReport'));
const CustomerBalancesReport = lazyWithRetry(() => import('./pages/CustomerBalancesReport'));
const CustomerStatementReport = lazyWithRetry(() => import('./pages/CustomerStatementReport'));
const ProviderBalancesReport = lazyWithRetry(() => import('./pages/ProviderBalancesReport'));
const FuelPrices = lazyWithRetry(() => import('./pages/FuelPrices'));
const SalesByCategoryReport = lazyWithRetry(() => import('./pages/SalesByCategoryReport'));
const SalesByPOSReport = lazyWithRetry(() => import('./pages/SalesByPOSReport'));
const SalesDetailReport = lazyWithRetry(() => import('./pages/SalesDetailReport'));
const ArqueosReport = lazyWithRetry(() => import('./pages/ArqueosReport'));
const StoreProfitabilityReport = lazyWithRetry(() => import('./pages/StoreProfitabilityReport'));
const SalesReport = lazyWithRetry(() => import('./pages/SalesReport'));
const SalesDiscountsReport = lazyWithRetry(() => import('./pages/SalesDiscountsReport'));
const TopProductsByCategoryReport = lazyWithRetry(() => import('./pages/TopProductsByCategoryReport'));
const PendingDocumentsDetailedReport = lazyWithRetry(() => import('./pages/PendingDocumentsDetailedReport'));
const ProviderPendingDocumentsDetailedReport = lazyWithRetry(() => import('./pages/ProviderPendingDocumentsDetailedReport'));
const Expenses = lazyWithRetry(() => import('./pages/Expenses'));
const ExpenseReport = lazyWithRetry(() => import('./pages/ExpenseReport'));
const PurchaseReport = lazyWithRetry(() => import('./pages/PurchaseReport'));
const PurchaseChecks = lazyWithRetry(() => import('./pages/PurchaseChecks'));
const PurchaseCheckReport = lazyWithRetry(() => import('./pages/PurchaseCheckReport'));
const Quedan = lazyWithRetry(() => import('./pages/Quedan'));
const QuedanReport = lazyWithRetry(() => import('./pages/QuedanReport'));

// Gas Station Pages
const GasDistributors = lazyWithRetry(() => import('./pages/GasDistributors'));
const Islands = lazyWithRetry(() => import('./pages/Islands'));
const Nozzles = lazyWithRetry(() => import('./pages/Nozzles'));
const Tanks = lazyWithRetry(() => import('./pages/Tanks'));
const GasCloseout = lazyWithRetry(() => import('./pages/GasCloseout'));
const GasOrders = lazyWithRetry(() => import('./pages/GasOrders'));
const GasReadingHistory = lazyWithRetry(() => import('./pages/GasReadingHistory'));
const GasExpenseCategories = lazyWithRetry(() => import('./pages/GasExpenseCategories'));
const GasStationConfig = lazyWithRetry(() => import('./pages/GasStationConfig'));
const SalesConfig = lazyWithRetry(() => import('./pages/SalesConfig'));
const ShiftDTEs = lazyWithRetry(() => import('./pages/ShiftDTEs'));
const GasDespachadores = lazyWithRetry(() => import('./pages/GasDespachadores'));
const GasDespachadorNozzles = lazyWithRetry(() => import('./pages/GasDespachadorNozzles'));
const GasPosTypes = lazyWithRetry(() => import('./pages/GasPosTypes'));
const GasAdvances = lazyWithRetry(() => import('./pages/GasAdvances'));
const GasAdvancesReport = lazyWithRetry(() => import('./pages/GasAdvancesReport'));
const GasTrupput = lazyWithRetry(() => import('./pages/GasTrupput'));
const ReporteVentasCombustible = lazyWithRetry(() => import('./pages/ReporteVentasCombustible'));
const GasCloseoutDetailReport = lazyWithRetry(() => import('./pages/GasCloseoutDetailReport'));
const FuelInventoryReport = lazyWithRetry(() => import('./pages/FuelInventoryReport'));
const GalonajeVendidoReport = lazyWithRetry(() => import('./pages/GalonajeVendidoReport'));
const GasRemesaDeliveries = lazyWithRetry(() => import('./pages/GasRemesaDeliveries'));
const GasCouponLiquidation = lazyWithRetry(() => import('./pages/GasCouponLiquidation'));
const SalesRemesaDeliveries = lazyWithRetry(() => import('./pages/SalesRemesaDeliveries'));
const GasAccumulatedDailyReport = lazyWithRetry(() => import('./pages/GasAccumulatedDailyReport'));
const FuelSalesSummaryReport = lazyWithRetry(() => import('./pages/FuelSalesSummaryReport'));
const GasLubricantsReport = lazyWithRetry(() => import('./pages/GasLubricantsReport'));
const GasComplementariasReport = lazyWithRetry(() => import('./pages/GasComplementariasReport'));
const GasVentasAnalyticsReport = lazyWithRetry(() => import('./pages/GasVentasAnalyticsReport'));
const GasLubricantsComparisonReport = lazyWithRetry(() => import('./pages/GasLubricantsComparisonReport'));

// Control de Pozo Pages
const PozoServicios = lazyWithRetry(() => import('./pages/PozoServicios'));
const PozoDespachos = lazyWithRetry(() => import('./pages/PozoDespachos'));
const PozoCorte = lazyWithRetry(() => import('./pages/PozoCorte'));
const PozoEntregasEfectivo = lazyWithRetry(() => import('./pages/PozoEntregasEfectivo'));

// RRHH Pages
const Afps = lazyWithRetry(() => import('./pages/rh/Afps'));
const Cargos = lazyWithRetry(() => import('./pages/rh/Cargos'));
const DescuentosProgramados = lazyWithRetry(() => import('./pages/rh/DescuentosProgramados'));
const Departamentos = lazyWithRetry(() => import('./pages/rh/Departamentos'));
const AfpTasas = lazyWithRetry(() => import('./pages/rh/AfpTasas'));
const IsssTasas = lazyWithRetry(() => import('./pages/rh/IsssTasas'));
const RentaConfig = lazyWithRetry(() => import('./pages/rh/RentaConfig'));
const AguinaldoConfig = lazyWithRetry(() => import('./pages/rh/AguinaldoConfig'));
const SalarioMinimo = lazyWithRetry(() => import('./pages/rh/SalarioMinimo'));
const TiposContrato = lazyWithRetry(() => import('./pages/rh/TiposContrato'));
const Empleados = lazyWithRetry(() => import('./pages/rh/Empleados'));
const Vacaciones = lazyWithRetry(() => import('./pages/rh/Vacaciones'));
const ConfigRh = lazyWithRetry(() => import('./pages/rh/ConfigRh'));
const Liquidaciones = lazyWithRetry(() => import('./pages/rh/Liquidaciones'));
const Honorarios = lazyWithRetry(() => import('./pages/rh/Honorarios'));
const Aguinaldos = lazyWithRetry(() => import('./pages/rh/Aguinaldos'));
const CuentasPlanillas = lazyWithRetry(() => import('./pages/rh/CuentasPlanillas'));
const Planillas = lazyWithRetry(() => import('./pages/rh/Planillas'));
const Quincena25 = lazyWithRetry(() => import('./pages/rh/Quincena25'));
const ReportesRh = lazyWithRetry(() => import('./pages/rh/ReportesRh'));
const AccionesPersonal = lazyWithRetry(() => import('./pages/rh/AccionesPersonal'));

const VatBookPurchases = lazyWithRetry(() => import('./pages/VatBooks/VatBookPurchases'));
const VatBookSalesTaxpayers = lazyWithRetry(() => import('./pages/VatBooks/VatBookSalesTaxpayers'));
const VatBookSalesConsumers = lazyWithRetry(() => import('./pages/VatBooks/VatBookSalesConsumers'));
const VatBookAnexosIVA = lazyWithRetry(() => import('./pages/VatBooks/VatBookAnexosIVA'));
const VatBookLiquidation = lazyWithRetry(() => import('./pages/VatBooks/VatBookLiquidation'));

// Egg Industrial Processing Pages
const EggDashboard = lazyWithRetry(() => import('./pages/EggIndustrial/Dashboard'));
const EggReception = lazyWithRetry(() => import('./pages/EggIndustrial/Reception'));
const EggProduction = lazyWithRetry(() => import('./pages/EggIndustrial/Production'));
const EggPackaging = lazyWithRetry(() => import('./pages/EggIndustrial/Packaging'));
const EggCostsMaintenance = lazyWithRetry(() => import('./pages/EggIndustrial/CostsMaintenance'));
const EggCosteoPorLibra = lazyWithRetry(() => import('./pages/EggIndustrial/CosteoPorLibra'));
const EggTraceability = lazyWithRetry(() => import('./pages/EggIndustrial/Traceability'));
const EggConfig = lazyWithRetry(() => import('./pages/EggIndustrial/Config'));
const EggProductionCalendar = lazyWithRetry(() => import('./pages/EggIndustrial/ProductionCalendar'));
const EggDispatch = lazyWithRetry(() => import('./pages/EggIndustrial/EggDispatch'));
const EggReports = lazyWithRetry(() => import('./pages/EggIndustrial/Reports'));
const EggInventory = lazyWithRetry(() => import('./pages/EggIndustrial/Inventory'));

// CRM Pages
const CustomerAgreements = lazyWithRetry(() => import('./pages/CRM/CustomerAgreements'));
const CrmConfig = lazyWithRetry(() => import('./pages/CRM/CrmConfig'));
const CrmQuotations = lazyWithRetry(() => import('./pages/CRM/CrmQuotations'));

import Layout from './components/layout/Layout';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30,    // 30 minutes
            retry: (failureCount, error) => {
                if (error?.response?.status === 401) return false;
                return failureCount < 1;
            },
            refetchOnWindowFocus: false,
        },
    },
});

const ProtectedRoute = () => {
    const { user, loading } = useAuth();
    if (loading) return <div>Cargando...</div>;
    if (!user) return <Navigate to="/login" />;
    return <Layout />;
};

function App() {
  useEffect(() => {
    const preventNumberInputScroll = (e) => {
      if (document.activeElement && document.activeElement.type === 'number') {
        e.preventDefault();
        document.activeElement.blur();
      } else if (e.target && e.target.type === 'number') {
        e.preventDefault();
        e.target.blur();
      }
    };
    window.addEventListener('wheel', preventNumberInputScroll, { passive: false });
    return () => window.removeEventListener('wheel', preventNumberInputScroll);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/dte" element={<PublicDTE />} />
                    <Route path="/dte/:codigo" element={<PublicDTE />} />
                    <Route path="/scan/:token" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-xs">Cargando...</div>}><ScanInventory /></Suspense>} />
                    <Route path="/scan-dte/:sessionId" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-xs">Cargando...</div>}><MobileDteScanner /></Suspense>} />
                    
                    {/* Protected Shell */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/companies" element={<Companies />} />
                        <Route path="/branches" element={<Branches />} />
                        <Route path="/pos" element={<POS />} />
                        <Route path="/sistema/filpro" element={<FilproSync />} />
                        <Route path="/filpro" element={<FilproSync />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/products" element={<Products />} />
                        <Route path="/sellers" element={<Sellers />} />
                        <Route path="/users" element={<Users />} />
                        <Route path="/roles" element={<Roles />} />
                        <Route path="/providers" element={<Providers />} />
                        <Route path="/categories" element={<Categories />} />
                        <Route path="/user-access" element={<UserAccess />} />
                        <Route path="/configuracion/smtp" element={<SmtpConfig />} />
                        <Route path="/configuracion/sistema" element={<SystemSettings />} />
                        <Route path="/configuracion/servidor" element={<ServerMetrics />} />
                        <Route path="/configuracion/terminal" element={<ServerTerminal />} />
                        <Route path="/configuracion/logs" element={<Navigate to="/configuracion/servidor" replace />} />
                        <Route path="/configuracion/notificaciones" element={<NotificacionesConfig />} />
                        <Route path="/configuracion/whatsapp" element={<WhatsAppConfig />} />
                        <Route path="/configuracion/modulos-empresa" element={<CompanyModules />} />
                        <Route path="/admin/menu-items" element={<MenuItems />} />
                        <Route path="/inventario/traslados" element={<Transfers />} />
                        <Route path="/inventario/movimientos" element={<InventoryAdjustments />} />
                        <Route path="/inventario/fisico" element={<PhysicalInventory />} />
                        <Route path="/inventario/kardex" element={<Kardex />} />
                        <Route path="/inventario/reportes/stock" element={<InventoryStockReport />} />
                        <Route path="/inventario/reportes/movimientos" element={<InventoryMovementsReport />} />
                        <Route path="/inventario/reportes/valorizacion" element={<InventoryValuationReport />} />
                        <Route path="/inventario/reportes/rotacion" element={<InventoryTurnoverReport />} />

                        {/* Libros de IVA */}
                        <Route path="/iva/compras" element={<VatBookPurchases />} />
                        <Route path="/iva/ventas-ccf" element={<VatBookSalesTaxpayers />} />
                        <Route path="/iva/ventas-fac" element={<VatBookSalesConsumers />} />
                        <Route path="/iva/anexos-iva" element={<VatBookAnexosIVA />} />
                        <Route path="/iva/liquidacion" element={<VatBookLiquidation />} />
                        

                        <Route path="/compras" element={<Purchases />} />
                        <Route path="/compras/gastos" element={<Expenses />} />
                        <Route path="/compras/reportes/compras" element={<PurchaseReport />} />
                        <Route path="/compras/reportes/gastos" element={<ExpenseReport />} />
                        <Route path="/compras/periodo" element={<PurchasePeriod />} />
                        <Route path="/compras/chq-contado" element={<PurchaseChecks />} />
                        <Route path="/compras/reportes/chq-contado" element={<PurchaseCheckReport />} />
                        <Route path="/compras/reportes/cheques-contado" element={<PurchaseCheckReport />} />
                        <Route path="/compras/quedan" element={<Quedan />} />
                        <Route path="/compras/reportes/quedan" element={<QuedanReport />} />
                        <Route path="/ventas/nueva" element={<SalesTerminal />} />
                        <Route path="/ventas/cierre" element={<CashClosing />} />
                        <Route path="/ventas/reportes/ventas" element={<SalesReport />} />
                        <Route path="/ventas/reportes/diarias" element={<DailySalesReport />} />
                        <Route path="/ventas/reportes/cliente" element={<SalesByCustomerReport />} />
                        <Route path="/ventas/reportes/categoria" element={<SalesByCategoryReport />} />
                        <Route path="/ventas/reportes/pos" element={<SalesByPOSReport />} />
                        <Route path="/ventas/reportes/detalle-facturacion" element={<SalesDetailReport />} />
                        <Route path="/ventas/reportes/arqueos" element={<ArqueosReport />} />
                        <Route path="/ventas/reportes/rentabilidad-tienda" element={<StoreProfitabilityReport />} />
                        <Route path="/ventas/reportes/descuentos" element={<SalesDiscountsReport />} />
                        <Route path="/ventas/reportes/top-productos-categoria" element={<TopProductsByCategoryReport />} />
                        <Route path="/ventas/combos" element={<Combos />} />
                        <Route path="/ventas/combustibles" element={<FuelPrices />} />
                        <Route path="/ventas/descuentos" element={<CustomerDiscounts />} />
                        <Route path="/ventas/reglas-descuento" element={<DiscountRules />} />
                        <Route path="/ventas/promociones" element={<Promotions />} />
                        <Route path="/ventas/contingencia" element={<Contingency />} />
                        <Route path="/ventas/retorno" element={<Eret />} />
                        <Route path="/ventas/configuracion" element={<SalesConfig />} />
                        <Route path="/ventas/dtes-turno" element={<ShiftDTEs />} />
                        <Route path="/ventas" element={<SalesHistory />} />
                        <Route path="/seguridad/bitacora" element={<AuditLog />} />
                        <Route path="/seguridad/conectados" element={<ConnectedUsers />} />
                        <Route path="/seguridad/atajos" element={<KeyboardShortcuts />} />
                        <Route path="/changelog" element={<Changelog />} />
                        <Route path="/notificaciones" element={<NotificacionesLista />} />

                        {/* Accounts Receivable (CXC) */}
                        <Route path="/cxc/estado-cuenta" element={<CustomerStatement />} />
                        <Route path="/cxc/abonos" element={<AddPayment />} />
                        <Route path="/cxc/reportes/saldos" element={<CustomerBalancesReport />} />
                        <Route path="/cxc/reportes/documentos-pendientes" element={<PendingDocumentsDetailedReport />} />
                        <Route path="/cxc/reportes/estado-cuenta" element={<CustomerStatementReport />} />

                        {/* Accounts Payable (CXP) */}
                        <Route path="/cxp/estado-cuenta" element={<ProviderStatement />} />
                        <Route path="/cxp/abonos" element={<AddProviderPayment />} />
                        <Route path="/cxp/reportes/saldos" element={<ProviderBalancesReport />} />
                        <Route path="/cxp/reportes/documentos-pendientes" element={<ProviderPendingDocumentsDetailedReport />} />
                        
                        {/* Gas Station */}
                        <Route path="/gas-station/distributors" element={<GasDistributors />} />
                        <Route path="/gas-station/islands" element={<Islands />} />
                        <Route path="/gas-station/nozzles" element={<Nozzles />} />
                        <Route path="/gas-station/tanks" element={<Tanks />} />
                        <Route path="/gas-station/cierre-lecturas" element={<GasCloseout />} />
                        <Route path="/gas-station/pedidos" element={<GasOrders />} />
                        <Route path="/gas-station/historial-lecturas" element={<GasReadingHistory />} />
                        <Route path="/gas-station/expense-categories" element={<GasExpenseCategories />} />
                        <Route path="/gas-station/configuracion" element={<GasStationConfig />} />
                        <Route path="/gas-station/despachadores" element={<GasDespachadores />} />
                        <Route path="/gas-station/despachador-nozzles" element={<GasDespachadorNozzles />} />
                        <Route path="/gas-station/pos-tipos" element={<GasPosTypes />} />
                        <Route path="/gas-station/anticipos" element={<GasAdvances />} />
                        <Route path="/gas-station/trupput" element={<GasTrupput />} />
                        <Route path="/gas-station/entrega-remesas" element={<GasRemesaDeliveries />} />
                        <Route path="/gas-station/liquidacion-cupones" element={<GasCouponLiquidation />} />
                        <Route path="/ventas/entrega-remesas" element={<SalesRemesaDeliveries />} />
                        <Route path="/gas-station/reporte-ventas" element={<ReporteVentasCombustible />} />
                        <Route path="/gas-station/reporte-detalle-cierre" element={<GasCloseoutDetailReport />} />
                        <Route path="/gas-station/reporte-inventario-combustible" element={<FuelInventoryReport />} />
                        <Route path="/gas-station/galonaje-vendido" element={<GalonajeVendidoReport />} />
                        <Route path="/gas-station/reporte-acumulado-diario" element={<GasAccumulatedDailyReport />} />
                        <Route path="/gas-station/reporte-resumen-gln-vendidos" element={<FuelSalesSummaryReport />} />
                        <Route path="/gas-station/reporte-lubricantes-vendidos" element={<GasLubricantsReport />} />
                        <Route path="/gas-station/reporte-complementarias" element={<GasComplementariasReport />} />
                        <Route path="/gas-station/reporte-analitico-ventas" element={<GasVentasAnalyticsReport />} />
                        <Route path="/gas-station/reporte-anticipos" element={<GasAdvancesReport />} />
                        <Route path="/gas-station/reporte-comparativo-lubricantes" element={<GasLubricantsComparisonReport />} />

                        {/* Control de Pozo */}
                        <Route path="/pozo/servicios" element={<PozoServicios />} />
                        <Route path="/pozo/despachos" element={<PozoDespachos />} />
                        <Route path="/pozo/corte" element={<PozoCorte />} />
                        <Route path="/pozo/entregas-efectivo" element={<PozoEntregasEfectivo />} />

                        {/* RRHH */}
                        <Route path="/rh/afps" element={<Afps />} />
                        <Route path="/rh/cargos" element={<Cargos />} />
                        <Route path="/rh/descuentos-programados" element={<DescuentosProgramados />} />
                        <Route path="/rh/departamentos" element={<Departamentos />} />
                        <Route path="/rh/afp-tasas" element={<AfpTasas />} />
                        <Route path="/rh/isss-tasas" element={<IsssTasas />} />
                        <Route path="/rh/renta-config" element={<RentaConfig />} />
                        <Route path="/rh/aguinaldo-config" element={<AguinaldoConfig />} />
                        <Route path="/rh/salario-minimo" element={<SalarioMinimo />} />
                        <Route path="/rh/tipos-contrato" element={<TiposContrato />} />
                        <Route path="/rh/empleados" element={<Empleados />} />
                        <Route path="/rh/planilla-vacaciones" element={<Vacaciones />} />
                        <Route path="/rh/config-rh" element={<ConfigRh />} />
                        <Route path="/rh/liquidaciones" element={<Liquidaciones />} />
                        <Route path="/rh/honorarios" element={<Honorarios />} />
                        <Route path="/rh/aguinaldos" element={<Aguinaldos />} />
                        <Route path="/rh/cuentas-planillas" element={<CuentasPlanillas />} />
                        <Route path="/rh/planillas" element={<Planillas />} />
                        <Route path="/rh/quincena25" element={<Quincena25 />} />
                        <Route path="/rh/acciones-personal" element={<AccionesPersonal />} />
                        <Route path="/rh/reportes" element={<Navigate to="/rh/reportes/isss" replace />} />
<Route path="/rh/reportes/:tipo" element={<ReportesRh />} />

                        {/* Contabilidad */}
                        <Route path="/contabilidad/cuentas" element={<ChartOfAccounts />} />
                        <Route path="/contabilidad/partidas" element={<AccountingEntries />} />
                        <Route path="/contabilidad/contabilizar" element={<AccountingGenerate kinds={['ventas', 'compras']} />} />
                        <Route path="/contabilidad/contabilizar/cxc-cxp" element={<AccountingGenerate kinds={['cxc', 'cxp']} />} />
                        <Route path="/contabilidad/correlativos" element={<AccountingCorrelativos />} />
                        <Route path="/contabilidad/cierre" element={<YearClosing />} />
                        <Route path="/contabilidad/apertura" element={<YearOpening />} />
                        <Route path="/contabilidad/ajustes" element={<AccountingSettings />} />
                        <Route path="/contabilidad/reportes/libro-diario" element={<LibroDiario />} />
                        <Route path="/contabilidad/reportes/libro-diario-mayor" element={<LibroDiarioMayor />} />
                        <Route path="/contabilidad/reportes/libro-mayor" element={<LibroMayor />} />
                        <Route path="/contabilidad/reportes/balance-comprobacion" element={<BalanceComprobacion />} />
                        <Route path="/contabilidad/reportes/estado-resultados" element={<EstadoResultados />} />
                        <Route path="/contabilidad/reportes/balance-general" element={<BalanceGeneral />} />
                        <Route path="/contabilidad/reportes/anexo-balance" element={<AnexoBalance />} />
                        <Route path="/contabilidad/reportes/balance-comparativo" element={<BalanceComparativo />} />
                        <Route path="/contabilidad/reportes/cambios-patrimonio" element={<CambiosPatrimonio />} />
                        <Route path="/contabilidad/reportes/flujo-efectivo" element={<FlujoEfectivo />} />
                        <Route path="/contabilidad/reportes/auxiliar-operaciones" element={<AuxiliarOperaciones />} />
                        <Route path="/contabilidad/reportes/listado-partidas" element={<ListadoPartidas />} />
                        <Route path="/contabilidad/reportes/cedula-auditoria" element={<CedulaAuditoria />} />
                        <Route path="/contabilidad/reportes/retenciones" element={<Retenciones />} />

                        {/* Huevo Industrial / Ovoproductos (ANDELSA) */}
                        <Route path="/industrial/planta" element={<EggDashboard />} />
                        <Route path="/industrial/recepcion" element={<EggReception />} />
                        <Route path="/industrial/produccion" element={<EggProduction />} />
                        <Route path="/industrial/calendario" element={<EggProductionCalendar />} />
                        <Route path="/industrial/despachos" element={<EggDispatch />} />
                        <Route path="/industrial/empaque" element={<EggPackaging />} />
                        <Route path="/industrial/costos-mantenimiento" element={<EggCostsMaintenance />} />
                        <Route path="/industrial/costeo-libra" element={<EggCosteoPorLibra />} />
                        <Route path="/industrial/trazabilidad" element={<EggTraceability />} />
                        <Route path="/industrial/inventario" element={<EggInventory />} />
                        <Route path="/industrial/reportes" element={<EggReports />} />
                        <Route path="/industrial/configuracion" element={<EggConfig />} />
                        <Route path="/egg-industrial/config" element={<Navigate to="/industrial/configuracion?tab=lot-prefixes" replace />} />


                        {/* CRM Comercial */}
                        <Route path="/crm/cotizaciones" element={<CrmQuotations />} />
                        <Route path="/crm/acuerdos" element={<CustomerAgreements />} />
                        <Route path="/crm/configuracion" element={<CrmConfig />} />
                        
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
                <Toaster richColors position="top-right" offset={{ top: 76, right: 24 }} expand visibleToasts={5} duration={4000} />
            </AuthProvider>
        </BrowserRouter>
        </ConfirmProvider>
    </QueryClientProvider>
  )
}

export default App
