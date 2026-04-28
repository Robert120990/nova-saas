import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';

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
import DailySalesReport from './pages/DailySalesReport';
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

import VatBookPurchases from './pages/VatBooks/VatBookPurchases';
import VatBookSalesTaxpayers from './pages/VatBooks/VatBookSalesTaxpayers';
import VatBookSalesConsumers from './pages/VatBooks/VatBookSalesConsumers';

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
                        <Route path="/ventas" element={<SalesHistory />} />
                        
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
                        
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
                <Toaster richColors position="top-right" />
            </AuthProvider>
        </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
