# ESTRUCTURA_PROYECTO.md

> **GENERADO AUTOMÁTICAMENTE** — no editar a mano.
> Regenerar con: `node scripts/generate-project-structure.js`
> Última generación: 2026-09-24
>
> Mapa exhaustivo de la estructura física del repositorio con la función de
> cada archivo. Para reglas de negocio y convenciones ver AGENTS.md, CLAUDE.md
> y las skills de `.opencode/skills/` (incluyen los `*_RULES.md`).

## 1. Visión general

Sistema multi-empresa (multi-tenant) SaaS para El Salvador con facturación electrónica DTE.

| Componente | Carpeta | Stack | Puerto |
|---|---|---|---|
| Backend principal | `server/` | Node.js + Express + MySQL2 | 4000 |
| Frontend SPA | `client/` | React 18 + Vite + Tailwind + TanStack Query + React Router v7 | 3000 (dev) |
| Microservicio DTE | `dte-api/` | Node.js + Express 5 + ajv + node-forge | 5000 |
| Webhook deploy | `webhook-server.js` | Node http nativo | 7777 |

**Base de datos única compartida:** `db_sistema_saas` (MySQL).
**Multi-tenancy:** header `x-company-id` validado por `tenantMiddleware`.
**Autenticación:** JWT (`Authorization: Bearer`) + permisos granulares por rol.

## 2. Raíz del repositorio

### Documentación

| Archivo | Descripción |
|---|---|
| `AGENTS.md` | Guía para agentes de IA/Codex: arquitectura, comandos y convenciones (duplicado de CLAUDE.md). |
| `CLAUDE.md` | Guía para Claude Code: arquitectura, comandos y convenciones (idéntica a AGENTS.md). |
| `README.md` | README mínimo (título únicamente). La documentación real vive en AGENTS.md y las skills de .opencode/skills/. |
| `ESTRUCTURA_PROYECTO.md` | Este documento: mapa exhaustivo de la estructura física del repo generado por script. |
| `CLIENT_REESTRUCTURACION_PLAN.md` | Plan histórico de reestructuración del cliente (referencia, ya ejecutado). |

### Configuración y despliegue

| Archivo | Descripción |
|---|---|
| `Caddyfile` | Configuración de Caddy (reverse proxy) para producción. |
| `Caddyfile.dev` | Configuración de Caddy para desarrollo local. |
| `Caddyfile.docker` | Configuración de Caddy para despliegue con Docker. |
| `caddy-pm2-wrapper.js` | Wrapper para lanzar caddy.exe bajo PM2 en Windows. |
| `docker-compose.yml` | Orquestación Docker de los servicios. |
| `ecosystem.config.js` | Configuración PM2: procesos server, client, dte-api y webhook. |
| `webhook-server.js` | Servidor webhook de auto-deploy (puerto 7777): al recibir el push, ejecuta git pull y reinicia PM2. |
| `.gitignore` | Archivos ignorados por Git. |

### Directorios auxiliares

| Archivo | Descripción |
|---|---|
| `caddy/` | Binario caddy.exe: reverse proxy local HTTPS. |
| `deploy/` | Scripts de despliegue (setup.ps1). |
| `scripts/` | Scripts utilitarios standalone: importar catálogo contable y preparar turnos/cajas. |
| `cumplientoDTE/` | Material oficial de cumplimiento DTE: manuales PDF de Hacienda, catálogos XLSX y JSON schemas oficiales (svfe-json-schemas). Referencia, no código ejecutable. |

### Skills de proyecto (`.opencode/skills/`)

Cada carpeta = una skill cargable por agentes de IA; incluye su SKILL.md accionable y, cuando aplica, la normativa `*_RULES.md` co-ubicada.

#### `.opencode/skills/`

**`.opencode/skills/catalogo/`**

| Archivo | Descripción |
|---|---|
| `CATALOG_RULES.md` | Convenciones obligatorias para páginas de catálogos/listados (backend paginado + tabla frontend). |
| `SKILL.md` | Skill: crear/modificar catálogos y listados CRUD con búsqueda y paginación. |

**`.opencode/skills/dte/`**

| Archivo | Descripción |
|---|---|
| `DTE_API_RULES.md` | Reglas del ciclo DTE: generate → sign → transmit, contingencia e invalidación. |
| `SKILL.md` | Skill: flujo DTE completo (emitir, firmar, transmitir, contingencia, invalidación, ERET). |

**`.opencode/skills/nuevo-modulo/`**

| Archivo | Descripción |
|---|---|
| `SKILL.md` | Skill: checklist integral para agregar un módulo nuevo punta a punta. |
| `UI_DESIGN_RULES.md` | Convenciones visuales: layout cabecera-detalle, paleta indigo/slate, atajos, tipografía. |

**`.opencode/skills/reporte/`**

| Archivo | Descripción |
|---|---|
| `REPORT_DESIGN_RULES.md` | Convenciones de diseño para páginas de reportes. |
| `SKILL.md` | Skill: páginas de reportes con ReportLayout, PDF y exportación Excel. |

**`.opencode/skills/responsive-check/`**

| Archivo | Descripción |
|---|---|
| `RESPONSIVE_RULES.md` | Reglas OBLIGATORIAS de responsividad móvil (320px-767px) para todo el cliente. |
| `SKILL.md` | Skill: verificar responsividad móvil 320px/375px con Playwright MCP + checklist. |


## 3. `server/` — Backend principal

Express.js, patrón controller → service → model (los modelos son SQL directo en servicios; la carpeta `src/models/` existe pero está vacía).

#### `server/src/` (raíz)
| Archivo | Descripción |
|---|---|
| `index.js` | Punto de entrada del backend Express: middlewares globales, WebSocket y montaje de rutas. |
| `query_docs.js` | Documentación interna de convenciones de queries SQL usadas por el módulo IA. |

#### `server/src/config/`
| Archivo | Descripción |
|---|---|
| `cache.js` | Cache. |
| `db.js` | Pool MySQL principal (db_sistema_saas) usado por todos los servicios. |
| `db.schema.js` | Constantes DB_SCHEMA y AI_QUERY_MAX_ROWS: esquema de tablas expuesto al asistente IA. |
| `redis.js` | Redis. |
| `rrsDb.js` | Pool MySQL hacia la base externa RRS (sistema de la gasolinera). |
| `sentry.js` | Sentry. |
| `upload.js` | Configuración Multer para subida de archivos (uploads/). |

#### `server/src/middlewares/`
| Archivo | Descripción |
|---|---|
| `audit.js` | Middleware de auditoría: registra acciones sensibles en la bitácora. |
| `auth.js` | verifyToken (JWT) y checkPermission: autenticación y permisos granulares por rol. |
| `tenant.js` | tenantMiddleware: aislamiento multi-empresa mediante header x-company-id. |
| `validate.middleware.js` | Validate.middleware. |

#### `server/src/routes/`
| Archivo | Descripción |
|---|---|
| `ai.routes.js` | Rutas del asistente IA (/api/ai): chat y consultas en lenguaje natural. |
| `api.routes.js` | Router principal /api: monta TODOS los módulos con auth + tenant. Punto de referencia de endpoints. |
| `auth.routes.js` | Rutas públicas de autenticación (/api/auth): login, token, recuperación. |
| `eggIndustrial.routes.js` | Rutas del módulo industrial de huevo (/api/egg-industrial). |
| `notification.routes.js` | Rutas de notificaciones internas (/api/notifications). |
| `tax.routes.js` | Rutas de impuestos y libros fiscales (/api/tax). |
| `terminal.routes.js` | Terminal.routes. |
| `whatsapp.routes.js` | Rutas de integración WhatsApp incluidos webhooks entrantes. |

#### `server/src/services/`
| Archivo | Descripción |
|---|---|
| `ai.assistant.js` | Lógica conversacional del asistente IA: prompts, contexto y formateo de respuestas. |
| `ai.service.js` | Clientes de modelos IA (OpenAI/Gemini) y generación SQL segura sobre DB_SCHEMA. |
| `audit.service.js` | Escritura estructurada de eventos en la bitácora de auditoría. |
| `catalogCache.service.js` | Catalog Cache.service. |
| `condition.service.js` | Evaluador genérico de condiciones (evaluate/evaluateAll) usado por reglas de negocio. |
| `crmQuotationDocx.service.js` | Crm Quotation Docx.service. |
| `crmQuotationPdf.service.js` | Crm Quotation Pdf.service. |
| `dte.service.js` | Cliente HTTP hacia dte-api: emitir, firmar, transmitir, contingencia e invalidación. |
| `dteQueryFilters.js` | Filtros SQL reutilizables para consultas de documentos DTE. |
| `eggOriginCertificate.service.js` | Egg Origin Certificate.service. |
| `eggProductionExport.service.js` | Egg Production Export.service. |
| `eggQualityLetterExport.service.js` | Egg Quality Letter Export.service. |
| `eggRawMaterialLabReport.service.js` | Egg Raw Material Lab Report.service. |
| `eggReportsExport.service.js` | Egg Reports Export.service. |
| `excel.service.js` | Generación de archivos Excel (exceljs) para exportaciones. |
| `filproExtractor.service.js` | Filpro Extractor.service. |
| `filproIngestion.service.js` | Filpro Ingestion.service. |
| `gasAdvanceRrs.service.js` | Gas Advance Rrs.service. |
| `gasCloseoutInventory.service.js` | Gas Closeout Inventory.service. |
| `gasCloseoutRrs.service.js` | Lee datos del sistema RRS externo de la gasolinera para los cierres de turno. |
| `loginRateLimit.service.js` | Login Rate Limit.service. |
| `mailer.service.js` | Envío de correos con nodemailer usando SMTP por empresa. |
| `notification.service.js` | Creación y distribución de notificaciones internas (WebSocket + BD). |
| `notificationWorker.js` | Worker que evalúa eventos y dispara notificaciones programadas. |
| `officeDb.service.js` | Pool y helpers de conexión a la BD externa Office. |
| `pdf.modern_rtee.js` | Pdf.modern rtee. |
| `pdf.service.js` | Generación de PDFs (pdfkit/pdf-lib/jspdf): facturas, reportes, etiquetas. |
| `reportWorkerPool.service.js` | Report Worker Pool.service. |
| `rhAccionPersonalPdf.service.js` | Rh Accion Personal Pdf.service. |
| `rhReportPdf.service.js` | Rh Report Pdf.service. |
| `rrsVentasTiendaAutoSync.service.js` | Rrs Ventas Tienda Auto Sync.service. |
| `suspiciousSalesDetector.js` | Detector de ventas sospechosas/anómalas para auditoría. |
| `telegram.service.js` | Envío de mensajes/alertas vía bot de Telegram. |
| `template.service.js` | Plantillas con variables (correo/documentos) y renderizado. |
| `websocket.service.js` | Servidor WebSocket (ws): usuarios conectados y eventos tiempo real. |
| `whatsapp.service.js` | Integración WhatsApp Business: envío de mensajes y PDFs. |

#### `server/src/utils/`
| Archivo | Descripción |
|---|---|
| `asyncHandler.js` | Async Handler. |
| `crypto.js` | Cifrado/descifrado simétrico de credenciales almacenadas (SMTP, certificados). |
| `eggProductResolver.js` | Egg Product Resolver. |
| `inventoryUtils.js` | Helpers de kardex: inserción de movimientos y actualización de existencias. |
| `logger.js` | Logger. |
| `numberToWords.js` | Conversión de montos numéricos a letras (requerido en documentos legales). |
| `reportPdfHelper.js` | Report Pdf Helper. |
| `svfeValidators.js` | Svfe Validators. |

#### `server/src/controllers/`
| Archivo | Descripción |
|---|---|
| `access.controller.js` | Matriz de acceso rol-módulo: qué menús/acciones puede ver cada rol. |
| `accounting.controller.js` | Núcleo contable: catálogo de cuentas, partidas, centros de costo y ciclo contable. |
| `accounting.correlativos.controller.js` | Accounting.correlativos.controller. |
| `accounting.generation.controller.js` | Accounting.generation.controller. |
| `accounting.reports.controller.js` | Reportes contables: balances, libros diario/mayor, estados financieros, anexos. |
| `ai.controller.js` | Asistente IA: recibe pregunta en lenguaje natural, arma contexto de esquema y ejecuta consulta segura. |
| `audit.controller.js` | Consulta de la bitácora de auditoría con filtros. |
| `auth.controller.js` | Login JWT, refresh, cambio y recuperación de contraseña. |
| `branch.controller.js` | CRUD de sucursales por empresa. |
| `catalog.controller.js` | Catálogos ligeros para selects de formularios (agregados por módulo). |
| `category.controller.js` | CRUD de categorías de productos. |
| `changelog.controller.js` | Changelog visible en la UI: novedades por versión. |
| `combo.controller.js` | Combos/promociones: agrupaciones de productos con precio especial. |
| `company.controller.js` | CRUD de empresas (tenants) con datos fiscales NIT/NRC y logo. |
| `crmAgreements.controller.js` | Crm Agreements.controller. |
| `crmQuotation.controller.js` | Crm Quotation.controller. |
| `customer.controller.js` | CRUD de clientes con crédito, límites y datos DTE. |
| `customerBranch.controller.js` | Asignación de clientes permitidos por sucursal. |
| `customerDiscount.controller.js` | Descuentos especiales manuales por cliente/producto. |
| `cxc.controller.js` | Cuentas por cobrar: saldos, abonos, antigüedad. |
| `cxp.controller.js` | Cuentas por pagar a proveedores: saldos y abonos. |
| `dashboard.controller.js` | KPIs del panel principal: ventas del día, top productos, alertas. |
| `discountRules.controller.js` | Reglas automáticas de descuento evaluadas al facturar. |
| `eggCommissions.controller.js` | Egg Commissions.controller. |
| `eggCosteoLibra.controller.js` | Egg Costeo Libra.controller. |
| `eggDispatch.controller.js` | Egg Dispatch.controller. |
| `eggIndustrial.controller.js` | Módulo industrial de huevo: recepción, producción, empaque, costos y trazabilidad. |
| `expense.controller.js` | Gastos y sus categorías por sucursal. |
| `filpro.controller.js` | Filpro.controller. |
| `gasAdvance.controller.js` | Anticipos/suplidos en efectivo de despachadores de gasolinera. |
| `gasCloseout.controller.js` | Cierre de turno de gasolinera: lecturas, cálculo de galonaje, cuadre y remesas. |
| `gasConfig.controller.js` | Configuración global de la estación de servicio (productos combustibles, márgenes). |
| `gasCouponLiquidation.controller.js` | Gas Coupon Liquidation.controller. |
| `gasDespachador.controller.js` | CRUD de despachadores (operadores de isla). |
| `gasDistributor.controller.js` | CRUD de distribuidores mayoristas de combustible. |
| `gasOrder.controller.js` | Gas Order.controller. |
| `gasPosType.controller.js` | Tipos de POS de gasolinera y su comportamiento en cierres. |
| `gasRemesaDelivery.controller.js` | Entrega de remesas de efectivo del cierre de gasolinera. |
| `gasReporte.controller.js` | Reportes operativos de gasolinera (galonaje, acumulados, detalle de cierres). |
| `gasTrupput.controller.js` | Gas Trupput.controller. |
| `inventory.controller.js` | Inventario: existencias por sucursal, movimientos y kardex. |
| `inventoryAdjustment.controller.js` | Ajustes de inventario (entradas/salidas justificadas). |
| `inventoryScan.controller.js` | Toma de inventario físico con escáner/cámara y comparativo vs sistema. |
| `island.controller.js` | CRUD de islas de despacho de combustible. |
| `menuItem.controller.js` | Ítems del menú lateral dinámico y su asociación a roles. |
| `notification.controller.js` | Notificaciones internas: listado, marcado de leídas y configuración de eventos. |
| `nozzle.controller.js` | Surtidores (mangueras): precio por galón, tanque y asignación a despachadores. |
| `officeConnection.controller.js` | Conexión y sincronización con la base de datos externa Office. |
| `period.controller.js` | Períodos contables: apertura/cierre mensual y anual. |
| `pos.controller.js` | Puntos de venta (terminales), impresión y parámetros de caja. |
| `pozo.controller.js` | Operación de pozo: servicios, despachos, cortes y entregas de efectivo. |
| `product.controller.js` | Productos: CRUD, precios por sucursal, códigos de barras, etiquetas. |
| `promotion.controller.js` | Promotion.controller. |
| `provider.controller.js` | CRUD de proveedores con datos de crédito y DTE compra. |
| `purchase.controller.js` | Compras: registro, recepción, DTE de compra y afectación a inventario. |
| `purchaseCheck.controller.js` | Cheques emitidos para pago de compras y su conciliación. |
| `quedan.controller.js` | Quedanes: comprobantes de crédito con proveedores y su pago programado. |
| `rhAccionPersonal.controller.js` | Rh Accion Personal.controller. |
| `rhAfp.controller.js` | CRUD de AFPs (administradoras de fondos de pensión). |
| `rhAfpTasa.controller.js` | Tasas de AFP vigentes por período. |
| `rhAguinaldoConfig.controller.js` | Parámetros de cálculo del aguinaldo. |
| `rhCargo.controller.js` | CRUD de cargos/puestos de trabajo. |
| `rhConfig.controller.js` | Configuración general de Recursos Humanos. |
| `rhCuentaPlanilla.controller.js` | Mapeo de conceptos de planilla a cuentas contables. |
| `rhDepartamento.controller.js` | CRUD de departamentos de la empresa. |
| `rhDescuentoProgramado.controller.js` | Descuentos programados recurrentes a empleados (cuotas). |
| `rhEmpleado.controller.js` | Expediente de empleados: contrato, salario, AFP/ISSS, documentos. |
| `rhHonorarios.controller.js` | Pagos de honorarios profesionales y su retención. |
| `rhIsssTasa.controller.js` | Tasas ISSS vigentes por período. |
| `rhPlanilla.controller.js` | Procesamiento de planillas: cálculo de nómina, rentas, AFP/ISSS y contabilización. |
| `rhPlanillaAguinaldos.controller.js` | Planillas de aguinaldo. |
| `rhPlanillaLiquidaciones.controller.js` | Liquidaciones laborales (fin de relación laboral). |
| `rhPlanillaQuincena25.controller.js` | Rh Planilla Quincena25.controller. |
| `rhPlanillaVacaciones.controller.js` | Planillas de vacaciones. |
| `rhRentaConfig.controller.js` | Tablas de retención de renta (tramos vigentes). |
| `rhReportes.controller.js` | Rh Reportes.controller. |
| `rhSalarioMinimo.controller.js` | Salarios mínimos por sector/período. |
| `rhTipoContrato.controller.js` | Tipos de contrato laboral. |
| `role.controller.js` | Roles y permisos del sistema (incluye view_amounts). |
| `sales.controller.js` | Ventas: creación POS, historial, anulaciones, DTE y reportes base. |
| `salesConfig.controller.js` | Configuración de ventas: numeración, condiciones de pago, mensajes de factura. |
| `salesRemesaDelivery.controller.js` | Entrega de remesas de ventas entre sucursales/cajas. |
| `seller.controller.js` | CRUD de vendedores y sus metas/comisiones. |
| `settings.controller.js` | Configuración global multi-empresa (moneda, formato, features). |
| `shift.controller.js` | Turnos de caja: apertura, cierre y arqueo con denominaciones. |
| `smtp.controller.js` | Configuración SMTP por empresa para envío de correos. |
| `storeProfitability.controller.js` | Store Profitability.controller. |
| `systemMetrics.controller.js` | System Metrics.controller. |
| `tank.controller.js` | Tanques de almacenamiento de combustible y su capacidad/inventario. |
| `tax.controller.js` | Impuestos: IVA, percepciones, retenciones y libros fiscales (IVA ventas/compras). |
| `telegram.controller.js` | Integración bot Telegram: alertas y notificaciones push. |
| `terminal.controller.js` | Terminal.controller. |
| `tiendaVentas.controller.js` | Ventas de tienda/convenience diferenciadas de combustible. |
| `topProductsReport.controller.js` | Top Products Report.controller. |
| `user.controller.js` | Usuarios: CRUD, sesiones activas y restablecimiento. |
| `vatBooks.controller.js` | Libros de IVA: ventas a contribuyentes/consumidor final, compras y anexos. |
| `whatsapp.controller.js` | Envío de documentos/notificaciones vía WhatsApp. |

#### Directorios runtime

| Archivo | Descripción |
|---|---|
| `server/uploads/` | Archivos subidos en runtime (logos, adjuntos). No versionar contenido. |
| `server/certificados-p12pfx/` | Certificados digitales P12/PFX para firma DTE (por empresa). |
| `server/certificados-crt/` | Certificados CRT/llaves derivados. |

## 4. `client/` — Frontend SPA

React 18 + Vite. Estado servidor con TanStack Query (`queryKey: ['recurso', search, page]`).

#### `client/src/` (raíz)
| Archivo | Descripción |
|---|---|
| `App.jsx` | Definición de TODAS las rutas de la app (React Router v7) con guards de auth/permisos. |
| `index.css` | Estilos globales Tailwind: tema indigo/slate, clases utilitarias (.table-cards) y print. |
| `main.jsx` | Bootstrap React: providers (QueryClient, Router, Auth, Sonner) y montaje DOM. |

#### `client/src/context/`
| Archivo | Descripción |
|---|---|
| `AuthContext.jsx` | Estado global de sesión: login/logout, empresa activa y permisos del rol. |
| `ConfirmContext.jsx` | API declarativa window.confirm reemplazada por ConfirmDialog. |

#### `client/src/hooks/`
| Archivo | Descripción |
|---|---|
| `useDirtyTracker.js` | Use Dirty Tracker. |
| `useMenuItems.js` | Construye el menú visible según permisos del rol autenticado. |
| `useWebSocket.js` | Suscripción WebSocket: notificaciones y usuarios conectados en vivo. |

#### `client/src/config/`
| Archivo | Descripción |
|---|---|
| `iconMap.js` | Mapa nombre→icono lucide-react usado por el menú dinámico. |
| `sentry.js` | Sentry. |

#### `client/src/utils/`
| Archivo | Descripción |
|---|---|
| `apiUtils.js` | Api Utils. |
| `closeoutPdf.js` | Genera el PDF del cierre de gasolinera (jspdf). |
| `closeoutPrint.js` | Impresión directa del cierre de gasolinera. |
| `dateUtils.js` | Date Utils. |
| `excelExport.js` | Excel Export. |
| `fuzzySearch.js` | Búsqueda difusa tolerante a errores tipeados. |
| `julianDate.js` | Julian Date. |
| `lazyRetry.js` | Lazy Retry. |
| `pdfPagination.js` | Pdf Pagination. |
| `posCalculations.js` | Pos Calculations. |
| `qzPrint.js` | Impresión física vía QZ Tray (tickets/facturas). |
| `svfeValidators.js` | Svfe Validators. |

#### `client/src/components/`

**`client/src/components/accounting/`**

| Archivo | Descripción |
|---|---|
| `OfficeConnectionTab.jsx` | Pestaña de conexión/sincronización con BD externa Office. |

**`client/src/components/crm/`**

| Archivo | Descripción |
|---|---|
| `QuickCustomerModal.jsx` | Quick Customer Modal. |
| `QuotationModal.jsx` | Quotation Modal. |
| `SendEmailModal.jsx` | Send Email Modal. |
| `SignaturePadModal.jsx` | Signature Pad Modal. |

**`client/src/components/dashboard/`**

| Archivo | Descripción |
|---|---|
| `DashboardAndelsa.jsx` | Dashboard Andelsa. |
| `DashboardDte.jsx` | Dashboard Dte. |
| `DashboardGeneral.jsx` | Dashboard General. |
| `DashboardPista.jsx` | Dashboard Pista. |
| `DashboardServer.jsx` | Dashboard Server. |
| `DashboardTienda.jsx` | Dashboard Tienda. |

**`client/src/components/egg/`**

| Archivo | Descripción |
|---|---|
| `DispatchRouteMap.jsx` | Dispatch Route Map. |
| `DteQrDeliveryScannerModal.jsx` | Dte Qr Delivery Scanner Modal. |
| `EggAddTarimasModal.jsx` | Egg Add Tarimas Modal. |
| `EggBatchStagesModal.jsx` | Egg Batch Stages Modal. |
| `EggBatchWastesModal.jsx` | Egg Batch Wastes Modal. |
| `EggCommissionsSimulator.jsx` | Egg Commissions Simulator. |
| `EggCustomerOrderModal.jsx` | Egg Customer Order Modal. |
| `EggQualityEvaluationModal.jsx` | Egg Quality Evaluation Modal. |
| `EggReceptionDetailModal.jsx` | Egg Reception Detail Modal. |
| `EggRemanenteModal.jsx` | Egg Remanente Modal. |
| `EggSellerGoalsManager.jsx` | Egg Seller Goals Manager. |
| `EggTarimaSearchModal.jsx` | Egg Tarima Search Modal. |
| `ProductionTarimaScannerModal.jsx` | Production Tarima Scanner Modal. |
| `ProviderLotConfigModal.jsx` | Provider Lot Config Modal. |
| `RawMaterialPlannerModal.jsx` | Raw Material Planner Modal. |
| `RouteAutoInvoicingModal.jsx` | Route Auto Invoicing Modal. |
| `TarimaLabelModal.jsx` | Tarima Label Modal. |

**`client/src/components/egg/costeo/`**

| Archivo | Descripción |
|---|---|
| `EggAgreementHistoryModal.jsx` | Egg Agreement History Modal. |
| `EggAgreementModal.jsx` | Egg Agreement Modal. |
| `EggCipModal.jsx` | Egg Cip Modal. |
| `EggCosteoCatalogTab.jsx` | Egg Costeo Catalog Tab. |
| `EggCosteoClientsTab.jsx` | Egg Costeo Clients Tab. |
| `EggCosteoHistoryTab.jsx` | Egg Costeo History Tab. |
| `EggCosteoSimulatorTab.jsx` | Egg Costeo Simulator Tab. |
| `EggPackagingMaterialModal.jsx` | Egg Packaging Material Modal. |
| `EggPlantConfigModal.jsx` | Egg Plant Config Modal. |
| `EggSaveScenarioModal.jsx` | Egg Save Scenario Modal. |
| `index.js` | Index. |

**`client/src/components/egg/packaging/`**

| Archivo | Descripción |
|---|---|
| `EggCloseBatchModal.jsx` | Egg Close Batch Modal. |
| `EggEditPackagingModal.jsx` | Egg Edit Packaging Modal. |
| `EggFreezerModal.jsx` | Egg Freezer Modal. |
| `EggLabelPreviewModal.jsx` | Egg Label Preview Modal. |
| `EggNewPackagingModal.jsx` | Egg New Packaging Modal. |
| `index.js` | Index. |

**`client/src/components/expenses/`**

| Archivo | Descripción |
|---|---|
| `ExpenseDetailModal.jsx` | Expense Detail Modal. |
| `ExpensePeriodModal.jsx` | Expense Period Modal. |

**`client/src/components/gas/`**

| Archivo | Descripción |
|---|---|
| `GasAdelantosModal.jsx` | Gas Adelantos Modal. |
| `GasAnticiposModal.jsx` | Gas Anticipos Modal. |
| `GasCreditosModal.jsx` | Gas Creditos Modal. |
| `GasCuponesModal.jsx` | Gas Cupones Modal. |
| `GasDescuentosModal.jsx` | Gas Descuentos Modal. |
| `GasDiferenciasModal.jsx` | Gas Diferencias Modal. |
| `GasGastosModal.jsx` | Gas Gastos Modal. |
| `GasLubricantesModal.jsx` | Gas Lubricantes Modal. |
| `GasNozzleAssignModal.jsx` | Gas Nozzle Assign Modal. |
| `GasReadingsModal.jsx` | Gas Readings Modal. |
| `GasRemesasModal.jsx` | Gas Remesas Modal. |
| `GasTankReadingsModal.jsx` | Gas Tank Readings Modal. |
| `GasTarjetasModal.jsx` | Gas Tarjetas Modal. |
| `GasTrupputModal.jsx` | Gas Trupput Modal. |
| `GasValesModal.jsx` | Gas Vales Modal. |
| `index.js` | Index. |

**`client/src/components/gas/orders/`**

| Archivo | Descripción |
|---|---|
| `GasOrderConfirmSeenModal.jsx` | Gas Order Confirm Seen Modal. |
| `GasOrderDetailModal.jsx` | Gas Order Detail Modal. |
| `GasOrderMethodModal.jsx` | Gas Order Method Modal. |
| `GasOrderReceiveModal.jsx` | Gas Order Receive Modal. |
| `index.js` | Index. |

**`client/src/components/inventory/`**

| Archivo | Descripción |
|---|---|
| `AdjustmentDetailModal.jsx` | Adjustment Detail Modal. |
| `AdjustmentEditModal.jsx` | Adjustment Edit Modal. |
| `AdjustmentMotivosModal.jsx` | Adjustment Motivos Modal. |
| `index.js` | Index. |
| `KardexOriginModal.jsx` | Kardex Origin Modal. |
| `TransferDetailModal.jsx` | Transfer Detail Modal. |

**`client/src/components/layout/`**

| Archivo | Descripción |
|---|---|
| `Layout.jsx` | Shell de la app autenticada: compone Sidebar + Navbar + Outlet. |
| `Navbar.jsx` | Barra superior: selector de empresa/sucursal, usuario, notificaciones, CommandPalette. |
| `Sidebar.jsx` | Menú lateral dinámico filtrado por permisos del rol (usa useMenuItems). |

**`client/src/components/pos/`**

| Archivo | Descripción |
|---|---|
| `DteTransmittingOverlay.jsx` | Dte Transmitting Overlay. |
| `GeneralDiscountDialog.jsx` | General Discount Dialog. |
| `ItemDiscountDialog.jsx` | Item Discount Dialog. |
| `PosCustomerModal.jsx` | Pos Customer Modal. |
| `PosCustomerSearchModal.jsx` | Pos Customer Search Modal. |
| `PosFuelEntryModal.jsx` | Pos Fuel Entry Modal. |
| `PosLinkedDocModal.jsx` | Pos Linked Doc Modal. |
| `PosLotSelectionModal.jsx` | Pos Lot Selection Modal. |
| `PosProductCatalogModal.jsx` | Pos Product Catalog Modal. |
| `PosSuccessModal.jsx` | Pos Success Modal. |
| `PosSupervisorAuthModal.jsx` | Pos Supervisor Auth Modal. |

**`client/src/components/products/`**

| Archivo | Descripción |
|---|---|
| `ProductLabelModal.jsx` | Modal de impresión de etiquetas/códigos de barras de productos. |
| `ProductPriceAnalysisModal.jsx` | Product Price Analysis Modal. |
| `ProductSearchModal.jsx` | Product Search Modal. |

**`client/src/components/providers/`**

| Archivo | Descripción |
|---|---|
| `ProviderModal.jsx` | Provider Modal. |

**`client/src/components/purchases/`**

| Archivo | Descripción |
|---|---|
| `PurchaseDetailModal.jsx` | Purchase Detail Modal. |
| `QrScanModal.jsx` | Qr Scan Modal. |

**`client/src/components/rh/`**

| Archivo | Descripción |
|---|---|
| `accionPersonalConstants.js` | Accion Personal Constants. |
| `AccionPersonalModal.jsx` | Accion Personal Modal. |
| `EmployeeSearchModal.jsx` | Employee Search Modal. |
| `PlanillaExportModal.jsx` | Planilla Export Modal. |
| `PlanillaReportModal.jsx` | Planilla Report Modal. |

**`client/src/components/sales/`**

| Archivo | Descripción |
|---|---|
| `DiagnosticoDteModal.jsx` | Diagnostico Dte Modal. |
| `DteStatsModal.jsx` | Dte Stats Modal. |
| `EditarClienteDteModal.jsx` | Editar Cliente Dte Modal. |
| `SaleDetailModal.jsx` | Modal de detalle de venta: productos, totales, DTE, acciones. |

**`client/src/components/ui/`**

| Archivo | Descripción |
|---|---|
| `AIAssistant.jsx` | Panel flotante del asistente IA (chat) disponible en toda la app. |
| `CommandPalette.jsx` | Paleta de comandos Ctrl+K: navegación rápida a páginas. |
| `ConditionRow.jsx` | Editor de una condición campo-operador-valor (reglas dinámicas). |
| `ConfirmDialog.jsx` | Diálogo de confirmación global (via ConfirmContext). |
| `ErrorBoundary.jsx` | Boundary que captura errores de render y muestra fallback. |
| `Modal.jsx` | Modal reutilizable con tamaños y cierre por escape/backdrop. |
| `Money.jsx` | Money/MoneyInput: renderiza y captura montos respetando el permiso view_amounts. |
| `NotificationBell.jsx` | Campana de notificaciones en navbar con conteo no leído. |
| `NotificationItem.jsx` | Ítem individual de notificación (lista/campana). |
| `NotificationToast.jsx` | Toast de notificación entrante en tiempo real. |
| `Pagination.jsx` | Paginador estándar de catálogos (page/totalPages). |
| `PdfPageNavigator.jsx` | Pdf Page Navigator. |
| `PdfViewerModal.jsx` | Pdf Viewer Modal. |
| `ReportLayout.jsx` | Layout estándar de reportes: filtros, acciones, exportación. |
| `RuleEditor.jsx` | Editor visual de reglas compuestas por condiciones (descuentos/notificaciones). |
| `SearchableSelect.jsx` | Select con búsqueda integrada (usado en formularios densos). |
| `Table.jsx` | Tabla estándar con estados loading/vacío según CATALOG_RULES. |
| `TemplateEditor.jsx` | Editor de plantillas con inserción de variables (correos/documentos). |
| `VariableBadge.jsx` | Chip visual de variable insertable en editores de plantillas. |

**`client/src/components/users/`**

| Archivo | Descripción |
|---|---|
| `index.js` | Index. |
| `UserAccessAssignModal.jsx` | User Access Assign Modal. |
| `UserAccessBulkRoleModal.jsx` | User Access Bulk Role Modal. |
| `UserAccessCloneModal.jsx` | User Access Clone Modal. |

#### `client/src/pages/`

**`pages/`**

| Archivo | Descripción |
|---|---|
| `AccountingCorrelativos.jsx` | Página de ruta Accounting Correlativos. |
| `AccountingEntries.jsx` | Partidas contables manuales (libro diario) con débitos/créditos. |
| `AccountingGenerate.jsx` | Página de ruta Accounting Generate. |
| `AccountingSettings.jsx` | Configuración contable por empresa: moneda, período activo, parámetros. |
| `AddPayment.jsx` | Registro de abonos de clientes (CxC) con asignación a documentos. |
| `AddProviderPayment.jsx` | Registro de pagos a proveedores (CxP). |
| `ArqueosReport.jsx` | Reporte histórico de arqueos de caja con diferencias. |
| `AuditLog.jsx` | Visor de bitácora de auditoría con filtros por usuario/acción. |
| `Branches.jsx` | Catálogo de sucursales. |
| `CashClosing.jsx` | Cierre de caja del turno POS: conteo, diferencia y arqueo. |
| `Categories.jsx` | Catálogo de categorías de productos. |
| `Changelog.jsx` | Historial de cambios/novedades del sistema. |
| `ChartOfAccounts.jsx` | Catálogo de cuentas contables jerárquico. |
| `Combos.jsx` | Catálogo de combos/promociones de productos. |
| `Companies.jsx` | Administración de empresas (tenants). |
| `CompanyModules.jsx` | Página de ruta Company Modules. |
| `ConnectedUsers.jsx` | Usuarios conectados en tiempo real (WebSocket) y forzado de sesión. |
| `Contingency.jsx` | Emisión masiva de DTE en contingencia y reenvío posterior. |
| `CustomerBalancesReport.jsx` | Reporte de saldos pendientes de clientes. |
| `CustomerDiscounts.jsx` | Descuentos especiales por cliente/producto. |
| `Customers.jsx` | Catálogo de clientes. |
| `CustomerStatement.jsx` | Estado de cuenta de cliente con movimientos y saldos. |
| `CustomerStatementReport.jsx` | Página de ruta Customer Statement Report. |
| `DailySalesReport.jsx` | Ventas consolidadas del día por tipo/sucursal. |
| `Dashboard.jsx` | Panel principal con KPIs, gráficas y accesos rápidos. |
| `DiscountRules.jsx` | Constructor de reglas automáticas de descuento. |
| `Eret.jsx` | Eventos de Retorno (ERET) de DTE ante Hacienda: emisión y respuesta MH. |
| `ExpenseReport.jsx` | Reporte de gastos por categoría/período. |
| `Expenses.jsx` | Registro de gastos operativos. |
| `FilproSync.jsx` | Página de ruta Filpro Sync. |
| `FuelInventoryReport.jsx` | Inventario de combustibles por tanque (galones). |
| `FuelPrices.jsx` | Precios de venta de combustibles por surtidor. |
| `FuelSalesSummaryReport.jsx` | Resumen de ventas de combustible por período. |
| `GalonajeVendidoReport.jsx` | Galonaje vendido por surtidor/despachador. |
| `GasAccumulatedDailyReport.jsx` | Acumulado diario de operación de gasolinera. |
| `GasAdvances.jsx` | Anticipos/suplidos de despachadores. |
| `GasAdvancesReport.jsx` | Página de ruta Gas Advances Report. |
| `GasCloseout.jsx` | Cierre de turno de gasolinera: lecturas, remesas y cuadre. |
| `GasCloseoutDetailReport.jsx` | Detalle de cierres de gasolinera por turno. |
| `GasComplementariasReport.jsx` | Página de ruta Gas Complementarias Report. |
| `GasCouponLiquidation.jsx` | Página de ruta Gas Coupon Liquidation. |
| `GasDespachadores.jsx` | Catálogo de despachadores. |
| `GasDespachadorNozzles.jsx` | Asignación de surtidores a cada despachador. |
| `GasDistributors.jsx` | Catálogo de distribuidores de combustible. |
| `GasExpenseCategories.jsx` | Categorías de gasto exclusivas de gasolinera. |
| `GasLubricantsComparisonReport.jsx` | Página de ruta Gas Lubricants Comparison Report. |
| `GasLubricantsReport.jsx` | Página de ruta Gas Lubricants Report. |
| `GasOrders.jsx` | Página de ruta Gas Orders. |
| `GasPosTypes.jsx` | Tipos de POS de gasolinera. |
| `GasReadingHistory.jsx` | Historial de lecturas de bombas/surtidores. |
| `GasRemesaDeliveries.jsx` | Entrega de remesas de efectivo de gasolinera. |
| `GasStationConfig.jsx` | Configuración general de la estación de servicio. |
| `GasTrupput.jsx` | Página de ruta Gas Trupput. |
| `GasVentasAnalyticsReport.jsx` | Página de ruta Gas Ventas Analytics Report. |
| `InventoryAdjustments.jsx` | Ajustes de inventario con justificación. |
| `InventoryMovementsReport.jsx` | Movimientos de inventario por producto/período. |
| `InventoryStockReport.jsx` | Existencias actuales por sucursal/producto. |
| `InventoryTurnoverReport.jsx` | Página de ruta Inventory Turnover Report. |
| `InventoryValuationReport.jsx` | Página de ruta Inventory Valuation Report. |
| `Islands.jsx` | Catálogo de islas de despacho. |
| `Kardex.jsx` | Kardex por producto: entradas, saldas y saldo corrido. |
| `KeyboardShortcuts.jsx` | Página de ruta Keyboard Shortcuts. |
| `Login.jsx` | Inicio de sesión con selección de empresa. |
| `MenuItems.jsx` | Editor del menú lateral: ítems, orden, iconos y roles. |
| `MobileDteScanner.jsx` | Página de ruta Mobile Dte Scanner. |
| `NotificacionesConfig.jsx` | Configuración de qué eventos disparan notificaciones. |
| `NotificacionesLista.jsx` | Bandeja centralizada de notificaciones. |
| `Nozzles.jsx` | Catálogo de surtidores (mangueras) con precios. |
| `PendingDocumentsDetailedReport.jsx` | Documentos pendientes de pago de clientes (detalle). |
| `PhysicalInventory.jsx` | Toma de inventario físico comparativo. |
| `POS.jsx` | Punto de venta principal: carrito, F3 productos, cobro y DTE. |
| `PozoCorte.jsx` | Cortes de caja del pozo. |
| `PozoDespachos.jsx` | Despachos registrados en el pozo. |
| `PozoEntregasEfectivo.jsx` | Entregas de efectivo del pozo. |
| `PozoServicios.jsx` | Servicios atendidos en el pozo. |
| `Products.jsx` | Catálogo de productos con precios por sucursal y códigos. |
| `Promotions.jsx` | Página de ruta Promotions. |
| `ProviderBalancesReport.jsx` | Saldos pendientes a proveedores. |
| `ProviderPendingDocumentsDetailedReport.jsx` | Documentos pendientes con proveedores (detalle). |
| `Providers.jsx` | Catálogo de proveedores. |
| `ProviderStatement.jsx` | Estado de cuenta de proveedor. |
| `PublicDTE.jsx` | Portal público de consulta de DTE por código de generación (sin login). |
| `PurchaseCheckReport.jsx` | Página de ruta Purchase Check Report. |
| `PurchaseChecks.jsx` | Cheques de pago asociados a compras. |
| `PurchasePeriod.jsx` | Apertura/cierre de períodos de compras. |
| `PurchaseReport.jsx` | Reporte de compras por proveedor/período. |
| `Purchases.jsx` | Registro de compras y recepción de mercadería. |
| `Quedan.jsx` | Quedanes (crédito con proveedores) y su control. |
| `QuedanReport.jsx` | Reporte de quedanes pendientes/pagados. |
| `ReporteVentasCombustible.jsx` | Reporte operativo de ventas de combustible. |
| `Roles.jsx` | Roles y matriz de permisos (incluye view_amounts). |
| `SalesByCategoryReport.jsx` | Ventas agrupadas por categoría. |
| `SalesByCustomerReport.jsx` | Ventas agrupadas por cliente. |
| `SalesByPOSReport.jsx` | Ventas agrupadas por punto de venta. |
| `SalesConfig.jsx` | Parámetros de facturación y condiciones de venta. |
| `SalesDetailReport.jsx` | Detalle línea a línea de ventas. |
| `SalesDiscountsReport.jsx` | Página de ruta Sales Discounts Report. |
| `SalesHistory.jsx` | Historial de ventas con reimpresión/anulación/DTE. |
| `SalesRemesaDeliveries.jsx` | Entrega de remesas de ventas. |
| `SalesReport.jsx` | Reporte general de ventas con totales. |
| `SalesTerminal.jsx` | Terminal de venta rápida (touch) para mostrador. |
| `ScanInventory.jsx` | Escaneo continuo de códigos para toma de inventario. |
| `Sellers.jsx` | Catálogo de vendedores. |
| `ServerMetrics.jsx` | Página de ruta Server Metrics. |
| `ServerTerminal.jsx` | Página de ruta Server Terminal. |
| `ShiftDTEs.jsx` | DTEs emitidos dentro de un turno específico. |
| `SmtpConfig.jsx` | Configuración de servidores SMTP por empresa. |
| `StoreProfitabilityReport.jsx` | Página de ruta Store Profitability Report. |
| `SystemSettings.jsx` | Parámetros globales del sistema. |
| `Tanks.jsx` | Tanques de combustible con capacidad y alarmas. |
| `TopProductsByCategoryReport.jsx` | Página de ruta Top Products By Category Report. |
| `Transfers.jsx` | Traspasos de inventario entre sucursales. |
| `UserAccess.jsx` | Asignación fina de permisos por rol (checkboxes por módulo/acción). |
| `Users.jsx` | Usuarios, sucursales asignadas y estado. |
| `WhatsAppConfig.jsx` | Credenciales y plantillas de WhatsApp. |
| `YearClosing.jsx` | Cierre del año fiscal: validaciones y asiento de cierre. |
| `YearOpening.jsx` | Apertura del año fiscal y saldos iniciales. |

**`client/src/pages/AccountingReports/`**

| Archivo | Descripción |
|---|---|
| `AnexoBalance.jsx` | Anexo del balance general (detalle de cuentas). |
| `AuxiliarOperaciones.jsx` | Auxiliar de operaciones por cuenta. |
| `BalanceComparativo.jsx` | Balance general comparativo entre períodos. |
| `BalanceComprobacion.jsx` | Balance de comprobación de sumas y saldos. |
| `BalanceGeneral.jsx` | Balance general (activo, pasivo, capital). |
| `CambiosPatrimonio.jsx` | Estado de cambios en el patrimonio. |
| `CedulaAuditoria.jsx` | Cédula sumaria/de auditoría contable. |
| `EstadoResultados.jsx` | Estado de resultados (pérdidas y ganancias). |
| `FlujoEfectivo.jsx` | Estado de flujos de efectivo. |
| `index.js` | Barrel de exportación de los reportes contables. |
| `LibroDiario.jsx` | Libro diario cronológico. |
| `LibroDiarioMayor.jsx` | Libro diario-mayor combinado. |
| `LibroMayor.jsx` | Libro mayor por cuenta. |
| `ListadoPartidas.jsx` | Listado de partidas contables con filtros. |
| `Retenciones.jsx` | Reporte de retenciones (renta/IVA). |

**`client/src/pages/CRM/`**

| Archivo | Descripción |
|---|---|
| `CrmConfig.jsx` | Crm Config. |
| `CrmQuotations.jsx` | Crm Quotations. |
| `CustomerAgreements.jsx` | Customer Agreements. |

**`client/src/pages/EggIndustrial/`**

| Archivo | Descripción |
|---|---|
| `Config.jsx` | Configuración del módulo industrial de huevo. |
| `CosteoPorLibra.jsx` | Módulo industrial de huevo: Costeo Por Libra. |
| `CostsMaintenance.jsx` | Costos y mantenimiento de equipos del módulo huevo. |
| `Dashboard.jsx` | Panel del módulo industrial de huevo. |
| `EggDispatch.jsx` | Módulo industrial de huevo: Egg Dispatch. |
| `Inventory.jsx` | Módulo industrial de huevo: Inventory. |
| `Packaging.jsx` | Empaque de huevo procesado. |
| `Production.jsx` | Producción del proceso industrial. |
| `ProductionCalendar.jsx` | Módulo industrial de huevo: Production Calendar. |
| `Reception.jsx` | Recepción de huevo en planta. |
| `Reports.jsx` | Módulo industrial de huevo: Reports. |
| `Traceability.jsx` | Trazabilidad de lotes de recepción a empaque. |

**`client/src/pages/rh/`**

| Archivo | Descripción |
|---|---|
| `AccionesPersonal.jsx` | Recursos Humanos: Acciones Personal. |
| `Afps.jsx` | Catálogo de AFPs. |
| `AfpTasas.jsx` | Tasas AFP por período. |
| `AguinaldoConfig.jsx` | Parámetros de cálculo de aguinaldo. |
| `Aguinaldos.jsx` | Proceso y planilla de aguinaldos. |
| `Cargos.jsx` | Catálogo de cargos. |
| `ConfigRh.jsx` | Configuración general de RRHH. |
| `CuentasPlanillas.jsx` | Cuentas contables por concepto de planilla. |
| `Departamentos.jsx` | Catálogo de departamentos. |
| `DescuentosProgramados.jsx` | Descuentos programados a empleados. |
| `Empleados.jsx` | Expedientes de empleados. |
| `Honorarios.jsx` | Honorarios profesionales y retención. |
| `IsssTasas.jsx` | Tasas ISSS por período. |
| `Liquidaciones.jsx` | Liquidaciones laborales. |
| `Planillas.jsx` | Procesamiento de planillas de nómina. |
| `Quincena25.jsx` | Recursos Humanos: Quincena25. |
| `RentaConfig.jsx` | Tabla de retención de renta. |
| `ReportesRh.jsx` | Recursos Humanos: Reportes Rh. |
| `SalarioMinimo.jsx` | Salarios mínimos por período. |
| `TiposContrato.jsx` | Tipos de contrato laboral. |
| `Vacaciones.jsx` | Gestión y planilla de vacaciones. |

**`client/src/pages/VatBooks/`**

| Archivo | Descripción |
|---|---|
| `VatBookAnexosIVA.jsx` | Anexos del libro de IVA. |
| `VatBookLiquidation.jsx` | Libro fiscal IVA: Vat Book Liquidation. |
| `VatBookPurchases.jsx` | Libro de compras (IVA crédito fiscal). |
| `VatBookSalesConsumers.jsx` | IVA ventas a consumidor final. |
| `VatBookSalesTaxpayers.jsx` | IVA ventas a contribuyentes. |

## 5. `dte-api/` — Microservicio DTE

Ciclo de vida del Documento Tributario Electrónico: `generate → sign → transmit`,
además de contingencia, invalidación, retorno (ERET) y retransmisión.
Se comunica con Hacienda según `HACIENDA_ENV`. Comparte BD con el server principal.
Nota: las carpetas `schemas/`, `signature/` y `repositories/` NO existen; los esquemas
oficiales viven en `cumplientoDTE/svfe-json-schemas/` y la firma en `services/signature/`.

#### `dte-api/src/` (raíz)
| Archivo | Descripción |
|---|---|
| `index.js` | Entrada del microservicio DTE (Express, puerto 5000): monta rutas /api y worker de cola. |

#### `dte-api/src/config/`
| Archivo | Descripción |
|---|---|
| `cache.js` | Cache. |
| `db.js` | Pool MySQL compartido (db_sistema_saas) para documentos DTE. |
| `haciendaConfig.js` | Endpoints y credenciales de Hacienda según HACIENDA_ENV (test|production). |
| `redis.js` | Redis. |
| `sentry.js` | Sentry. |

#### `dte-api/src/middlewares/`
| Archivo | Descripción |
|---|---|
| `audit.js` | Bitácora de operaciones DTE sensibles. |
| `auth.js` | Verifica JWT del main server y header x-company-id. |

#### `dte-api/src/routes/`
| Archivo | Descripción |
|---|---|
| `contingency.routes.js` | Rutas de contingencia (/api/contingency). |
| `invalidation.routes.js` | Rutas de invalidación (/api/invalidation). |
| `retorno.routes.js` | Rutas de evento de retorno (/api/retorno). |
| `retransmission.routes.js` | Rutas de retransmisión (/api/retransmission). |
| `signature.routes.js` | Rutas de firma (/api/signature). |

#### `dte-api/src/controllers/`
| Archivo | Descripción |
|---|---|
| `contingencyController.js` | Endpoints de contingencia: crear evento y listar pendientes. |
| `dteController.js` | Operaciones núcleo: generate, sign, transmit y flujo único emit. |
| `invalidationController.js` | Invalidación de DTE (anulación o rectificación, evento 3). |
| `retornoController.js` | Evento de retorno (ERET) ante Hacienda. |
| `retransmissionController.js` | Retransmisión de documentos fallidos. |
| `signatureController.js` | Firma electrónica del JSON DTE (JWS) con certificado almacenado. |

#### `dte-api/src/services/`

**`services/`**

| Archivo | Descripción |
|---|---|
| `audit.service.js` | Escritura de auditoría local del microservicio. |
| `dteGenerator.js` | Construcción del JSON del DTE por tipo de documento (01,03,05,...). |
| `pdfService.js` | PDF entregable del DTE con QR y resolución. |

**`dte-api/src/services/dte/`**

| Archivo | Descripción |
|---|---|
| `controlNumberService.js` | Generación del número de control oficial (secuencial por tipo/sucursal/PDV). |

**`dte-api/src/services/retorno/`**

| Archivo | Descripción |
|---|---|
| `retornoService.js` | Armado y transmisión del evento de retorno (ERET). |

**`dte-api/src/services/signature/`**

| Archivo | Descripción |
|---|---|
| `externalSignerService.js` | Cliente del firmador externo (microservicio dedicado). |
| `internalSignerService.js` | Firmador interno con node-forge cargando certificado P12/PFX. |
| `signatureService.js` | Orquestador de firma: decide internal/external según SIGNATURE_MODE. |

#### `dte-api/src/utils/`
| Archivo | Descripción |
|---|---|
| `calculations.js` | Cálculos fiscales: IVA, percepción, totales y redondeos oficiales. |
| `logger.js` | Logger. |
| `text.js` | Normalización de texto para XML/JSON de Hacienda. |
| `versionMap.js` | Versión de JSON schema aplicable por tipo de documento. |

#### `dte-api/src/contingency/`
| Archivo | Descripción |
|---|---|
| `contingencyService.js` | Lógica de contingencia: registro de eventos tipo 101 y reenvío. |

#### `dte-api/src/invalidation/`
| Archivo | Descripción |
|---|---|
| `invalidationService.js` | Construcción y envío del JSON de invalidación. |

#### `dte-api/src/jobs/`
| Archivo | Descripción |
|---|---|
| `autoCloseContingency.js` | Auto Close Contingency. |
| `resendContingencyDTE.js` | Job programado que reenvía automáticamente DTE en contingencia. |

#### `dte-api/src/queue/`
| Archivo | Descripción |
|---|---|
| `contingencyQueue.js` | Contingency Queue. |
| `index.js` | Index. |
| `transmissionQueue.js` | Cola persistente de transmisión con reintentos y backoff. |

#### `dte-api/src/transmission/`
| Archivo | Descripción |
|---|---|
| `transmissionService.js` | Comunicación con Hacienda: token JWT MH, envío (recepcionDTE) y consulta. |

#### `dte-api/src/validators/`
| Archivo | Descripción |
|---|---|
| `schemaValidator.js` | Validación ajv del JSON DTE contra los schemas oficiales de MH. |

## 6. `database/` — Migraciones MySQL

Patrón de nombres: `migration_v<N>_<descripcion>.{sql|js}` y un runner `run_migration_v<N>.js` por versión.

- Rango de versiones detectado: **v2 → v229**
- Total de archivos: **432** (177 .sql · 82 .js migración · 171 runners run_migration* · 2 .json · 0 otros)

> Los archivos NO se listan individualmente por su volumen: para conocer el esquema vigente usa
> `SELECT ... FROM information_schema` o revisa `server/src/config/db.schema.js`,
> que expone el esquema consolidado usado por el asistente IA.

## 7. Convenciones esenciales (resumen)

1. **Catálogos/listados**: GET con `search/page/limit` → `{ data, total, page, totalPages }`; frontend `Table`+`Pagination`+debounce 500ms (skill `catalogo`).
2. **Montos**: SIEMPRE `<Money>` / `<MoneyInput>` de `components/ui/Money.jsx` (permiso `view_amounts`). Nunca `toFixed(2)` directo.
3. **Responsive móvil obligatorio** 320px-767px (skill `responsive-check`).
4. **Layout cabecera-detalle** en documentos: grid horizontal arriba, tabla abajo, totales a la derecha, F3 abre buscador de productos (skills `nuevo-modulo` / UI_DESIGN_RULES).
5. **Validación de producto en ventas**: `status === 'activo'` y sucursal incluida en `product.branches`.
6. **Textos de UI en español**, paleta Indigo/Slate, bordes `rounded-xl`/`rounded-2xl`.
7. **DTE**: el main server nunca firma ni transmite; delega en `dte-api` vía `POST /dte/emit` (JWT + x-company-id).
