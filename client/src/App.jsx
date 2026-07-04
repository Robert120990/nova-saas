import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Branches from './pages/Branches';
import POS from './pages/POS';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Sellers from './pages/Sellers';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Providers from './pages/Providers';
import Categories from './pages/Categories';
import UserAccess from './pages/UserAccess';
import SmtpConfig from './pages/SmtpConfig';
import SystemSettings from './pages/SystemSettings';
import Transfers from './pages/Transfers';
import InventoryAdjustments from './pages/InventoryAdjustments';
import PhysicalInventory from './pages/PhysicalInventory';
import Kardex from './pages/Kardex';
import Purchases from './pages/Purchases';
import PurchasePeriod from './pages/PurchasePeriod';
import SalesTerminal from './pages/SalesTerminal';
import SalesHistory from './pages/SalesHistory';
import CustomerDiscounts from './pages/CustomerDiscounts';
import DiscountRules from './pages/DiscountRules';
import ChartOfAccounts from './pages/ChartOfAccounts';
import AccountingEntries from './pages/AccountingEntries';
import YearClosing from './pages/YearClosing';
import YearOpening from './pages/YearOpening';
import AccountingSettings from './pages/AccountingSettings';
import DailySalesReport from './pages/DailySalesReport';
import Contingency from './pages/Contingency';
import Eret from './pages/Eret';
import AuditLog from './pages/AuditLog';
import ConnectedUsers from './pages/ConnectedUsers';
import Changelog from './pages/Changelog';
import CashClosing from './pages/CashClosing';
import Combos from './pages/Combos';
import CustomerStatement from './pages/CustomerStatement';
import AddPayment from './pages/AddPayment';
import ProviderStatement from './pages/ProviderStatement';
import AddProviderPayment from './pages/AddProviderPayment';
import InventoryStockReport from './pages/InventoryStockReport';
import InventoryMovementsReport from './pages/InventoryMovementsReport';
import CustomerBalancesReport from './pages/CustomerBalancesReport';
import ProviderBalancesReport from './pages/ProviderBalancesReport';
import FuelPrices from './pages/FuelPrices';
import SalesByCategoryReport from './pages/SalesByCategoryReport';
import SalesByPOSReport from './pages/SalesByPOSReport';
import SalesReport from './pages/SalesReport';
import PendingDocumentsDetailedReport from './pages/PendingDocumentsDetailedReport';
import ProviderPendingDocumentsDetailedReport from './pages/ProviderPendingDocumentsDetailedReport';
import Expenses from './pages/Expenses';
import ExpenseReport from './pages/ExpenseReport';
import PurchaseReport from './pages/PurchaseReport';

// Gas Station Pages
import GasDistributors from './pages/GasDistributors';
import Islands from './pages/Islands';
import Nozzles from './pages/Nozzles';
import Tanks from './pages/Tanks';
import GasCloseout from './pages/GasCloseout';
import GasReadingHistory from './pages/GasReadingHistory';
import GasExpenseCategories from './pages/GasExpenseCategories';
import GasStationConfig from './pages/GasStationConfig';
import GasDespachadores from './pages/GasDespachadores';
import GasDespachadorNozzles from './pages/GasDespachadorNozzles';
import GasPosTypes from './pages/GasPosTypes';
import GasAdvances from './pages/GasAdvances';
import ReporteVentasCombustible from './pages/ReporteVentasCombustible';

// RRHH Pages
import Afps from './pages/rh/Afps';
import Cargos from './pages/rh/Cargos';
import DescuentosProgramados from './pages/rh/DescuentosProgramados';
import Departamentos from './pages/rh/Departamentos';
import AfpTasas from './pages/rh/AfpTasas';
import IsssTasas from './pages/rh/IsssTasas';
import RentaConfig from './pages/rh/RentaConfig';
import AguinaldoConfig from './pages/rh/AguinaldoConfig';
import SalarioMinimo from './pages/rh/SalarioMinimo';
import TiposContrato from './pages/rh/TiposContrato';
import Empleados from './pages/rh/Empleados';
import Vacaciones from './pages/rh/Vacaciones';
import ConfigRh from './pages/rh/ConfigRh';
import Liquidaciones from './pages/rh/Liquidaciones';
import Honorarios from './pages/rh/Honorarios';
import Aguinaldos from './pages/rh/Aguinaldos';
import CuentasPlanillas from './pages/rh/CuentasPlanillas';

import VatBookPurchases from './pages/VatBooks/VatBookPurchases';
import VatBookSalesTaxpayers from './pages/VatBooks/VatBookSalesTaxpayers';
import VatBookSalesConsumers from './pages/VatBooks/VatBookSalesConsumers';

// Egg Industrial Processing Pages
import EggDashboard from './pages/EggIndustrial/Dashboard';
import EggReception from './pages/EggIndustrial/Reception';
import EggProduction from './pages/EggIndustrial/Production';
import EggPackaging from './pages/EggIndustrial/Packaging';
import EggCostsMaintenance from './pages/EggIndustrial/CostsMaintenance';
import EggTraceability from './pages/EggIndustrial/Traceability';
import EggConfig from './pages/EggIndustrial/Config';

import Layout from './components/layout/Layout';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            gcTime: 1000 * 60 * 30,    // 30 minutes
            retry: 1,
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
  return (
    <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    {/* Protected Shell */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/companies" element={<Companies />} />
                        <Route path="/branches" element={<Branches />} />
                        <Route path="/pos" element={<POS />} />
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
                        <Route path="/inventario/traslados" element={<Transfers />} />
                        <Route path="/inventario/movimientos" element={<InventoryAdjustments />} />
                        <Route path="/inventario/fisico" element={<PhysicalInventory />} />
                        <Route path="/inventario/kardex" element={<Kardex />} />
                        <Route path="/inventario/reportes/stock" element={<InventoryStockReport />} />
                        <Route path="/inventario/reportes/movimientos" element={<InventoryMovementsReport />} />

                        {/* Libros de IVA */}
                        <Route path="/iva/compras" element={<VatBookPurchases />} />
                        <Route path="/iva/ventas-ccf" element={<VatBookSalesTaxpayers />} />
                        <Route path="/iva/ventas-fac" element={<VatBookSalesConsumers />} />
                        
                        {/* Procesamiento Industrial de Huevo */}
                        <Route path="/industrial/planta" element={<EggDashboard />} />
                        <Route path="/industrial/recepcion" element={<EggReception />} />
                        <Route path="/industrial/produccion" element={<EggProduction />} />
                        <Route path="/industrial/empaque" element={<EggPackaging />} />
                        <Route path="/industrial/costos-mantenimiento" element={<EggCostsMaintenance />} />
                        <Route path="/industrial/trazabilidad" element={<EggTraceability />} />
                        <Route path="/industrial/configuracion" element={<EggConfig />} />
                        
                        <Route path="/compras" element={<Purchases />} />
                        <Route path="/compras/gastos" element={<Expenses />} />
                        <Route path="/compras/reportes/compras" element={<PurchaseReport />} />
                        <Route path="/compras/reportes/gastos" element={<ExpenseReport />} />
                        <Route path="/compras/periodo" element={<PurchasePeriod />} />
                        <Route path="/ventas/nueva" element={<SalesTerminal />} />
                        <Route path="/ventas/cierre" element={<CashClosing />} />
                        <Route path="/ventas/reportes/ventas" element={<SalesReport />} />
                        <Route path="/ventas/reportes/diarias" element={<DailySalesReport />} />
                        <Route path="/ventas/reportes/categoria" element={<SalesByCategoryReport />} />
                        <Route path="/ventas/reportes/pos" element={<SalesByPOSReport />} />
                        <Route path="/ventas/combos" element={<Combos />} />
                        <Route path="/ventas/combustibles" element={<FuelPrices />} />
                        <Route path="/ventas/descuentos" element={<CustomerDiscounts />} />
                        <Route path="/ventas/reglas-descuento" element={<DiscountRules />} />
                        <Route path="/ventas/contingencia" element={<Contingency />} />
                        <Route path="/ventas/retorno" element={<Eret />} />
                        <Route path="/ventas" element={<SalesHistory />} />
                        <Route path="/seguridad/bitacora" element={<AuditLog />} />
                        <Route path="/seguridad/conectados" element={<ConnectedUsers />} />
                        <Route path="/changelog" element={<Changelog />} />

                        {/* Accounts Receivable (CXC) */}
                        <Route path="/cxc/estado-cuenta" element={<CustomerStatement />} />
                        <Route path="/cxc/abonos" element={<AddPayment />} />
                        <Route path="/cxc/reportes/saldos" element={<CustomerBalancesReport />} />
                        <Route path="/cxc/reportes/documentos-pendientes" element={<PendingDocumentsDetailedReport />} />

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
                        <Route path="/gas-station/historial-lecturas" element={<GasReadingHistory />} />
                        <Route path="/gas-station/expense-categories" element={<GasExpenseCategories />} />
                        <Route path="/gas-station/configuracion" element={<GasStationConfig />} />
                        <Route path="/gas-station/despachadores" element={<GasDespachadores />} />
                        <Route path="/gas-station/despachador-nozzles" element={<GasDespachadorNozzles />} />
                        <Route path="/gas-station/pos-tipos" element={<GasPosTypes />} />
                        <Route path="/gas-station/anticipos" element={<GasAdvances />} />
                        <Route path="/gas-station/reporte-ventas" element={<ReporteVentasCombustible />} />

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

                        {/* Contabilidad */}
                        <Route path="/contabilidad/cuentas" element={<ChartOfAccounts />} />
                        <Route path="/contabilidad/partidas" element={<AccountingEntries />} />
                        <Route path="/contabilidad/cierre" element={<YearClosing />} />
                        <Route path="/contabilidad/apertura" element={<YearOpening />} />
                        <Route path="/contabilidad/ajustes" element={<AccountingSettings />} />
                        
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
                <Toaster richColors position="top-right" />
            </AuthProvider>
        </BrowserRouter>
        </ConfirmProvider>
    </QueryClientProvider>
  )
}

export default App
