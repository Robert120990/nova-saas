# Plan: Reestructuración del Frontend por Módulos (Actualizado y Validado)

**Estado:** PENDIENTE DE EJECUCIÓN (LISTO PARA IMPLEMENTACIÓN SEGURA)  
**Objetivo:** Organizar las 97 páginas de `client/src/pages/` en subcarpetas modulares limpias, eliminando la sobrecarga en la raíz y manteniendo el 100% de la funcionalidad del sistema sin regresiones.

---

## 1. Alcance y Reglas de Arquitectura

1. **Mover las 97 páginas** de `client/src/pages/` a sus respectivas subcarpetas modulares.
2. **Reubicar `components/sales/SaleDetailModal.jsx`** a `pages/sales/SaleDetailModal.jsx` y eliminar la carpeta `components/sales/`.
3. **Mover la carpeta `AccountingReports/`** dentro de `pages/accounting/`.
4. **Mantener intactas** las carpetas existentes que ya estaban modularizadas:
   * `pages/rh/` (18 archivos - Recursos Humanos)
   * `pages/VatBooks/` (3 archivos - Libros de IVA)
   * `pages/EggIndustrial/` (7 archivos - Módulo Avícola/Industrial)
5. **No tocar infraestructura compartida:**
   * `components/ui/` (245+ imports en todo el sistema)
   * `components/layout/`, `hooks/`, `utils/`, `config/`, `context/`

---

## 2. Diagnóstico Técnico y Resolución de Dependencias

> [!CRITICAL]
> **Punto Crítico Resuelto: Profundidad de Imports Internos**  
> Al descender las páginas un nivel (`pages/*.jsx` $\rightarrow$ `pages/<modulo>/*.jsx`), los **333 imports relativos** hacia `../components/`, `../context/`, etc., quedan rotos si no se ajustan.

### Estrategia de Imports
Para garantizar una ejecución limpia y libre de errores humanos, se adoptará la **Opción A (Recomendada y Moderna)** o la **Opción B (Relativa Estricta)**:

* **Opción A (Recomendada - Path Alias `@`):**
  1. Configurar en `client/vite.config.js`:
     ```javascript
     import path from 'path';
     // ...
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src')
       }
     }
     ```
  2. Configurar en `client/jsconfig.json` para autocompletado en el IDE:
     ```json
     {
       "compilerOptions": {
         "baseUrl": ".",
         "paths": {
           "@/*": ["src/*"]
         }
       }
     }
     ```
  3. Reemplazar imports en archivos movidos:
     `'../components/'` $\rightarrow$ `'@/components/'`  
     `'../context/'` $\rightarrow$ `'@/context/'`  
     `'../hooks/'` $\rightarrow$ `'@/hooks/'`  
     `'../utils/'` $\rightarrow$ `'@/utils/'`  
     `'../config/'` $\rightarrow$ `'@/config/'`  

* **Opción B (Rutas Relativas Estrictas):**
  Ajustar en todos los archivos movidos un nivel adicional de profundidad:
  `'../components/'` $\rightarrow$ `'../../components/'`  
  `'../context/'` $\rightarrow$ `'../../context/'`  
  `'../hooks/'` $\rightarrow$ `'../../hooks/'`  
  `'../utils/'` $\rightarrow$ `'../../utils/'`  
  `'../config/'` $\rightarrow$ `'../../config/'`  

---

## 3. Inventario Completo y Mapeo de Destino (97 Archivos Verificados)

| Carpeta Destino | Cant. | Archivos Mapeados |
| :--- | :---: | :--- |
| **`pages/auth/`** | 2 | `Login.jsx`, `PublicDTE.jsx` |
| **`pages/dashboard/`** | 1 | `Dashboard.jsx` |
| **`pages/admin/`** | 15 | `Companies.jsx`, `Branches.jsx`, `Users.jsx`, `Roles.jsx`, `UserAccess.jsx`, `MenuItems.jsx`, `SmtpConfig.jsx`, `SystemSettings.jsx`, `NotificacionesConfig.jsx`, `NotificacionesLista.jsx`, `WhatsAppConfig.jsx`, `AuditLog.jsx`, `LogViewer.jsx`, `ConnectedUsers.jsx`, `Changelog.jsx` |
| **`pages/catalogs/`** | 9 | `Customers.jsx`, `Products.jsx`, `Sellers.jsx`, `Providers.jsx`, `Categories.jsx`, `Combos.jsx`, `CustomerDiscounts.jsx`, `DiscountRules.jsx`, `FuelPrices.jsx` |
| **`pages/sales/`** | 10 + 1 | `POS.jsx`, `SalesTerminal.jsx`, `SalesHistory.jsx`, `CashClosing.jsx`, `SalesConfig.jsx`, `ShiftDTEs.jsx`, `Contingency.jsx`, `Eret.jsx`, `SalesRemesaDeliveries.jsx`, `Quedan.jsx`<br>+ *Reubicado:* `SaleDetailModal.jsx` |
| **`pages/purchases/`** | 6 | `Purchases.jsx`, `PurchasePeriod.jsx`, `PurchaseChecks.jsx`, `Expenses.jsx`, `ExpenseReport.jsx`, `PurchaseReport.jsx` |
| **`pages/inventory/`** | 5 | `Transfers.jsx`, `InventoryAdjustments.jsx`, `PhysicalInventory.jsx`, `Kardex.jsx`, `ScanInventory.jsx` |
| **`pages/cxc/`** | 4 | `CustomerStatement.jsx`, `AddPayment.jsx`, `CustomerBalancesReport.jsx`, `PendingDocumentsDetailedReport.jsx` |
| **`pages/cxp/`** | 4 | `ProviderStatement.jsx`, `AddProviderPayment.jsx`, `ProviderBalancesReport.jsx`, `ProviderPendingDocumentsDetailedReport.jsx` |
| **`pages/accounting/`** | 7 + dir | `ChartOfAccounts.jsx`, `AccountingEntries.jsx`, `AccountingCorrelativos.jsx`, `AccountingGenerate.jsx`, `YearClosing.jsx`, `YearOpening.jsx`, `AccountingSettings.jsx`<br>+ *Subcarpeta completa:* `AccountingReports/` |
| **`pages/reports/`** | 9 | `DailySalesReport.jsx`, `SalesReport.jsx`, `SalesByCategoryReport.jsx`, `SalesByCustomerReport.jsx`, `SalesByPOSReport.jsx`, `SalesDetailReport.jsx`, `InventoryStockReport.jsx`, `InventoryMovementsReport.jsx`, `QuedanReport.jsx` |
| **`pages/gas/`** | 25 | `GasDistributors.jsx`, `Islands.jsx`, `Nozzles.jsx`, `Tanks.jsx`, `GasCloseout.jsx`, `GasReadingHistory.jsx`, `GasExpenseCategories.jsx`, `GasStationConfig.jsx`, `GasDespachadores.jsx`, `GasDespachadorNozzles.jsx`, `GasPosTypes.jsx`, `GasAdvances.jsx`, `ReporteVentasCombustible.jsx`, `GasCloseoutDetailReport.jsx`, `FuelInventoryReport.jsx`, `GalonajeVendidoReport.jsx`, `GasRemesaDeliveries.jsx`, `GasAccumulatedDailyReport.jsx`, `FuelSalesSummaryReport.jsx`, `GasTrupput.jsx`, `ArqueosReport.jsx`, `PozoCorte.jsx`, `PozoDespachos.jsx`, `PozoEntregasEfectivo.jsx`, `PozoServicios.jsx` |
| **`pages/rh/`** | 18 | *(Sin cambios - permanece intacto)* |
| **`pages/VatBooks/`** | 3 | *(Sin cambios - permanece intacto)* |
| **`pages/EggIndustrial/`** | 7 | *(Sin cambios - permanece intacto)* |

*Total exacto: 97 archivos individuales en raíz + 3 carpetas existentes + 1 carpeta reubicada.*

---

## 4. Reubicación Especial de Componente

### `components/sales/SaleDetailModal.jsx` $\rightarrow$ `pages/sales/SaleDetailModal.jsx`
1. **Mover archivo:** `git mv client/src/components/sales/SaleDetailModal.jsx client/src/pages/sales/SaleDetailModal.jsx`.
2. **Actualizar imports internos de SaleDetailModal:**
   * `import Modal from '../ui/Modal'` $\rightarrow$ `../../components/ui/Modal` (o `@/components/ui/Modal`)
   * `import Money from '../ui/Money'` $\rightarrow$ `../../components/ui/Money` (o `@/components/ui/Money`)
3. **Actualizar consumidores:**
   * En `SalesHistory.jsx`: `import SaleDetailModal from './SaleDetailModal'`
   * En `ShiftDTEs.jsx`: `import SaleDetailModal from './SaleDetailModal'`
4. **Eliminar directorio:** Borrar `client/src/components/sales/`.

---

## 5. Pasos de Ejecución Automatizada

Para evitar errores manuales en los ~450 reemplazos de imports, la ejecución debe seguir este orden exacto:

1. **Creación de Subcarpetas:**
   Crear las 11 subcarpetas dentro de `client/src/pages/`: `auth`, `dashboard`, `admin`, `catalogs`, `sales`, `purchases`, `inventory`, `cxc`, `cxp`, `accounting`, `reports`, `gas`.
2. **Movimiento con Git:**
   Ejecutar `git mv` para cada uno de los 97 archivos y para la carpeta `AccountingReports/`. Esto preserva el historial completo de commits en GitHub.
3. **Mover y actualizar `SaleDetailModal.jsx`:**
   Mover a `pages/sales/` y ajustar sus imports internos y los de `SalesHistory` / `ShiftDTEs`.
4. **Ajuste Automatizado de Imports Internos (333 referencias):**
   Ejecutar script Node.js para actualizar en bloque los imports de `../components/`, `../context/`, etc., en todas las páginas movidas.
5. **Actualización de `App.jsx`:**
   Actualizar las líneas 8-130 de `client/src/App.jsx` con las nuevas rutas de las páginas (`./pages/sales/SalesTerminal`, etc.).
6. **Verificación Estricta:**
   * Ejecutar `npm run lint` en `client/`.
   * Ejecutar `npm run build` en `client/` para certificar cero errores de resolución de módulos.
   * Probar rutas principales en el servidor de desarrollo.
