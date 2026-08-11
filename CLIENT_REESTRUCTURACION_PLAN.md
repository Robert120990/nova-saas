# Plan: Reestructuración del frontend por módulos

Estado: PENDIENTE DE EJECUCIÓN
Alcance aprobado por el usuario:
- Mover `pages/` a subcarpetas por módulo
- Reubicar `components/sales/SaleDetailModal.jsx` a `pages/sales/`
- Decidir archivos ambiguos por ruta principal en `App.jsx`
- Mantener nombres actuales de carpetas existentes: `rh/`, `VatBooks/`, `EggIndustrial/`

## Contexto verificado (análisis previo)

- Los ~117 imports de páginas viven SOLO en `App.jsx` (líneas 8-130). Ningún otro archivo importa páginas (0 matches de `../pages/` fuera de App.jsx).
- No hay lazy loading (`React.lazy`/`import()` de páginas): no impacta chunks ni rutas dinámicas.
- No hay aliases de paths en `vite.config.js`: imports relativos, solo cambia profundidad en App.jsx.
- Sidebar usa URLs de menú desde backend (`useMenuItems`), no imports de páginas.
- `components/ui/` tiene 245 imports: es infraestructura compartida, NO se toca.
- `components/layout/`, `hooks/`, `utils/`, `config/`, `context/`: compartidos, NO se tocan.
- `pages/AccountingReports/` (con barrel `index.js`) NO se importa en ningún lado hoy (código en espera).
- PWA/Workbox genera hashes en build: mover archivos no afecta el service worker.

## Mapa de carpetas destino

### 1. `pages/` -> subcarpetas (churn: solo App.jsx)

| Carpeta | Archivos |
|---|---|
| `auth/` | Login, PublicDTE |
| `dashboard/` | Dashboard |
| `admin/` | Companies, Branches, Users, Roles, UserAccess, MenuItems, SmtpConfig, SystemSettings, NotificacionesConfig, NotificacionesLista, WhatsAppConfig, AuditLog, LogViewer, ConnectedUsers, Changelog, Manual |
| `catalogs/` | Customers, Products, Sellers, Providers, Categories, Combos, CustomerDiscounts, DiscountRules, FuelPrices |
| `sales/` | POS, SalesTerminal, SalesHistory, CashClosing, SalesConfig, ShiftDTEs, Contingency, Eret, SalesRemesaDeliveries, Quedan, SaleDetailModal |
| `purchases/` | Purchases, PurchasePeriod, PurchaseChecks, Expenses, ExpenseReport, PurchaseReport |
| `inventory/` | Transfers, InventoryAdjustments, PhysicalInventory, Kardex, ScanInventory |
| `cxc/` | CustomerStatement, AddPayment, CustomerBalancesReport, PendingDocumentsDetailedReport |
| `cxp/` | ProviderStatement, AddProviderPayment, ProviderBalancesReport, ProviderPendingDocumentsDetailedReport |
| `accounting/` | ChartOfAccounts, AccountingEntries, YearClosing, YearOpening, AccountingSettings + carpeta `AccountingReports/` completa |
| `reports/` | DailySalesReport, SalesReport, SalesByCategoryReport, SalesByPOSReport, InventoryStockReport, InventoryMovementsReport |
| `gas/` | GasDistributors, Islands, Nozzles, Tanks, GasCloseout, GasReadingHistory, GasExpenseCategories, GasStationConfig, GasDespachadores, GasDespachadorNozzles, GasPosTypes, GasAdvances, ReporteVentasCombustible, GasCloseoutDetailReport, FuelInventoryReport, GalonajeVendidoReport, GasRemesaDeliveries, GasAccumulatedDailyReport, FuelSalesSummaryReport |
| `rh/` | Se queda como está (18 archivos) |
| `VatBooks/` | Se queda como está (3 archivos) |
| `EggIndustrial/` | Se queda como está (7 archivos) |

Decisiones de archivos ambiguos (por ruta principal en App.jsx):
- `Quedan.jsx` -> `sales/` (ruta `/compras/quedan` pero es venta a clientes)
- `ScanInventory.jsx` -> `inventory/` (ruta principal `/inventario/fisico` pese a `/scan/:token`)

### 2. `components/sales/SaleDetailModal.jsx` -> `pages/sales/SaleDetailModal.jsx`

- Importadores a actualizar: `SalesHistory.jsx` y `ShiftDTEs.jsx` (ambos van a `pages/sales/` tambien)
- Tras el movimiento, `components/sales/` queda vacia y se elimina

### 3. NO se tocan

`components/ui/`, `components/layout/`, `hooks/`, `utils/`, `config/`, `context/`

## Pasos de ejecucion

1. `git mv` de cada archivo a su carpeta destino (preserva historial de renames).
2. Actualizar los imports de `App.jsx` (lineas 8-130) a las nuevas rutas.
3. Actualizar los imports de SaleDetailModal en SalesHistory.jsx y ShiftDTEs.jsx.
4. Eliminar carpeta `components/sales/` si quedo vacia.
5. Verificar con `npm run lint` y `npm run build` (obligatorio por AGENTS.md).
6. Probar rutas criticas en dev: /ventas, /compras, /inventario, /gas-station, /rh, /contabilidad.

## Riesgos residuales

- Commit grande en App.jsx: posible conflicto con branches paralelos.
- Sin lazy loading: sin impacto de chunks ni rutas dinamicas.
