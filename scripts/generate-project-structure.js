/**
 * Generador de ESTRUCTURA_PROYECTO.md
 * ===================================
 * Recorre el repositorio y genera un mapa exhaustivo de la estructura del
 * proyecto con descripciones en español, pensado para que cualquier modelo
 * de IA (o humano nuevo) entienda dónde vive cada cosa.
 *
 * Uso:  node scripts/generate-project-structure.js
 * Salida: ESTRUCTURA_PROYECTO.md en la raíz del repo.
 *
 * Reglas:
 * - Las descripciones curadas viven en NOTES (clave = ruta relativa POSIX).
 * - Todo archivo no anotado recibe una descripción automática derivada de su nombre.
 * - El script NUNCA inventa archivos: lista lo que existe en disco.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT_DIR, 'ESTRUCTURA_PROYECTO.md');

/* ============================================================================
 * 1. ANOTACIONES CURADAS
 *    Clave: ruta relativa desde la raíz del repo con separadores POSIX.
 * ========================================================================== */
const NOTES = {
  // ---------- Raíz ----------
  'AGENTS.md': 'Guía para agentes de IA/Codex: arquitectura, comandos y convenciones (duplicado de CLAUDE.md).',
  'CLAUDE.md': 'Guía para Claude Code: arquitectura, comandos y convenciones (idéntica a AGENTS.md).',
  'README.md': 'README mínimo (título únicamente). La documentación real vive en AGENTS.md y los *_RULES.md.',
  'ESTRUCTURA_PROYECTO.md': 'Este documento: mapa exhaustivo de la estructura física del repo generado por script.',
  'CATALOG_RULES.md': 'Convenciones obligatorias para páginas de catálogos/listados (backend paginado + tabla frontend).',
  'DTE_API_RULES.md': 'Reglas del ciclo DTE: generate → sign → transmit, contingencia e invalidación.',
  'REPORT_DESIGN_RULES.md': 'Convenciones de diseño para páginas de reportes.',
  'RESPONSIVE_RULES.md': 'Reglas OBLIGATORIAS de responsividad móvil (320px-767px) para todo el cliente.',
  'UI_DESIGN_RULES.md': 'Convenciones visuales: layout cabecera-detalle, paleta indigo/slate, atajos, tipografía.',
  'CLIENT_REESTRUCTURACION_PLAN.md': 'Plan histórico de reestructuración del cliente (referencia, ya ejecutado).',
  'Caddyfile': 'Configuración de Caddy (reverse proxy) para producción.',
  'Caddyfile.dev': 'Configuración de Caddy para desarrollo local.',
  'Caddyfile.docker': 'Configuración de Caddy para despliegue con Docker.',
  'caddy-pm2-wrapper.js': 'Wrapper para lanzar caddy.exe bajo PM2 en Windows.',
  'docker-compose.yml': 'Orquestación Docker de los servicios.',
  'ecosystem.config.js': 'Configuración PM2: procesos server, client, dte-api y webhook.',
  'vercel.json': 'Configuración de despliegue del cliente en Vercel.',
  'webhook-server.js': 'Servidor webhook de auto-deploy (puerto 7777): al recibir el push, ejecuta git pull y reinicia PM2.',
  '.gitignore': 'Archivos ignorados por Git.',

  // ---------- scripts/ ----------
  'scripts/generate-project-structure.js': 'Este script: regenera ESTRUCTURA_PROYECTO.md a partir del estado real del repo.',
  'scripts/import_chart.js': 'Importa el catálogo de cuentas contables desde archivo externo.',
  'scripts/setup_shifts.js': 'Inicializa datos de turnos/cajas para el módulo POS.',
  'deploy/setup.ps1': 'Script PowerShell de instalación/despliegue del sistema en Windows Server.',

  // ---------- server/src raíz ----------
  'server/src/index.js': 'Punto de entrada del backend Express: middlewares globales, WebSocket y montaje de rutas.',
  'server/src/query_docs.js': 'Documentación interna de convenciones de queries SQL usadas por el módulo IA.',
  'server/src/test_width.js': 'Script de prueba manual (ancho de columnas); utilitario de desarrollo.',

  // ---------- server/src/config ----------
  'server/src/config/db.js': 'Pool MySQL principal (db_sistema_saas) usado por todos los servicios.',
  'server/src/config/db.schema.js': 'Constantes DB_SCHEMA y AI_QUERY_MAX_ROWS: esquema de tablas expuesto al asistente IA.',
  'server/src/config/rrsDb.js': 'Pool MySQL hacia la base externa RRS (sistema de la gasolinera).',
  'server/src/config/upload.js': 'Configuración Multer para subida de archivos (uploads/).',

  // ---------- server/src/middlewares ----------
  'server/src/middlewares/auth.js': 'verifyToken (JWT) y checkPermission: autenticación y permisos granulares por rol.',
  'server/src/middlewares/tenant.js': 'tenantMiddleware: aislamiento multi-empresa mediante header x-company-id.',
  'server/src/middlewares/audit.js': 'Middleware de auditoría: registra acciones sensibles en la bitácora.',

  // ---------- server/src/routes ----------
  'server/src/routes/api.routes.js': 'Router principal /api: monta TODOS los módulos con auth + tenant. Punto de referencia de endpoints.',
  'server/src/routes/auth.routes.js': 'Rutas públicas de autenticación (/api/auth): login, token, recuperación.',
  'server/src/routes/ai.routes.js': 'Rutas del asistente IA (/api/ai): chat y consultas en lenguaje natural.',
  'server/src/routes/tax.routes.js': 'Rutas de impuestos y libros fiscales (/api/tax).',
  'server/src/routes/notification.routes.js': 'Rutas de notificaciones internas (/api/notifications).',
  'server/src/routes/manual.routes.js': 'Rutas del manual de usuario (/api/manual).',
  'server/src/routes/eggIndustrial.routes.js': 'Rutas del módulo industrial de huevo (/api/egg-industrial).',
  'server/src/routes/whatsapp.routes.js': 'Rutas de integración WhatsApp incluidos webhooks entrantes.',

  /* ---------- server/src/controllers ---------- */
  'access.controller.js': 'Matriz de acceso rol-módulo: qué menús/acciones puede ver cada rol.',
  'accounting.controller.js': 'Núcleo contable: catálogo de cuentas, partidas, centros de costo y ciclo contable.',
  'accounting.reports.controller.js': 'Reportes contables: balances, libros diario/mayor, estados financieros, anexos.',
  'ai.controller.js': 'Asistente IA: recibe pregunta en lenguaje natural, arma contexto de esquema y ejecuta consulta segura.',
  'audit.controller.js': 'Consulta de la bitácora de auditoría con filtros.',
  'auth.controller.js': 'Login JWT, refresh, cambio y recuperación de contraseña.',
  'branch.controller.js': 'CRUD de sucursales por empresa.',
  'catalog.controller.js': 'Catálogos ligeros para selects de formularios (agregados por módulo).',
  'category.controller.js': 'CRUD de categorías de productos.',
  'changelog.controller.js': 'Changelog visible en la UI: novedades por versión.',
  'combo.controller.js': 'Combos/promociones: agrupaciones de productos con precio especial.',
  'company.controller.js': 'CRUD de empresas (tenants) con datos fiscales NIT/NRC y logo.',
  'customer.controller.js': 'CRUD de clientes con crédito, límites y datos DTE.',
  'customerBranch.controller.js': 'Asignación de clientes permitidos por sucursal.',
  'customerDiscount.controller.js': 'Descuentos especiales manuales por cliente/producto.',
  'cxc.controller.js': 'Cuentas por cobrar: saldos, abonos, antigüedad.',
  'cxp.controller.js': 'Cuentas por pagar a proveedores: saldos y abonos.',
  'dashboard.controller.js': 'KPIs del panel principal: ventas del día, top productos, alertas.',
  'discountRules.controller.js': 'Reglas automáticas de descuento evaluadas al facturar.',
  'eggIndustrial.controller.js': 'Módulo industrial de huevo: recepción, producción, empaque, costos y trazabilidad.',
  'expense.controller.js': 'Gastos y sus categorías por sucursal.',
  'gasAdvance.controller.js': 'Anticipos/suplidos en efectivo de despachadores de gasolinera.',
  'gasCloseout.controller.js': 'Cierre de turno de gasolinera: lecturas, cálculo de galonaje, cuadre y remesas.',
  'gasConfig.controller.js': 'Configuración global de la estación de servicio (productos combustibles, márgenes).',
  'gasDespachador.controller.js': 'CRUD de despachadores (operadores de isla).',
  'gasDistributor.controller.js': 'CRUD de distribuidores mayoristas de combustible.',
  'gasPosType.controller.js': 'Tipos de POS de gasolinera y su comportamiento en cierres.',
  'gasRemesaDelivery.controller.js': 'Entrega de remesas de efectivo del cierre de gasolinera.',
  'gasReporte.controller.js': 'Reportes operativos de gasolinera (galonaje, acumulados, detalle de cierres).',
  'inventory.controller.js': 'Inventario: existencias por sucursal, movimientos y kardex.',
  'inventoryAdjustment.controller.js': 'Ajustes de inventario (entradas/salidas justificadas).',
  'inventoryScan.controller.js': 'Toma de inventario físico con escáner/cámara y comparativo vs sistema.',
  'island.controller.js': 'CRUD de islas de despacho de combustible.',
  'manual.controller.js': 'Contenido del manual de usuario integrado (secciones y artículos).',
  'menuItem.controller.js': 'Ítems del menú lateral dinámico y su asociación a roles.',
  'notification.controller.js': 'Notificaciones internas: listado, marcado de leídas y configuración de eventos.',
  'nozzle.controller.js': 'Surtidores (mangueras): precio por galón, tanque y asignación a despachadores.',
  'officeConnection.controller.js': 'Conexión y sincronización con la base de datos externa Office.',
  'period.controller.js': 'Períodos contables: apertura/cierre mensual y anual.',
  'pos.controller.js': 'Puntos de venta (terminales), impresión y parámetros de caja.',
  'pozo.controller.js': 'Operación de pozo: servicios, despachos, cortes y entregas de efectivo.',
  'product.controller.js': 'Productos: CRUD, precios por sucursal, códigos de barras, etiquetas.',
  'provider.controller.js': 'CRUD de proveedores con datos de crédito y DTE compra.',
  'purchase.controller.js': 'Compras: registro, recepción, DTE de compra y afectación a inventario.',
  'purchaseCheck.controller.js': 'Cheques emitidos para pago de compras y su conciliación.',
  'quedan.controller.js': 'Quedanes: comprobantes de crédito con proveedores y su pago programado.',
  'rhAfp.controller.js': 'CRUD de AFPs (administradoras de fondos de pensión).',
  'rhAfpTasa.controller.js': 'Tasas de AFP vigentes por período.',
  'rhAguinaldoConfig.controller.js': 'Parámetros de cálculo del aguinaldo.',
  'rhCargo.controller.js': 'CRUD de cargos/puestos de trabajo.',
  'rhConfig.controller.js': 'Configuración general de Recursos Humanos.',
  'rhCuentaPlanilla.controller.js': 'Mapeo de conceptos de planilla a cuentas contables.',
  'rhDepartamento.controller.js': 'CRUD de departamentos de la empresa.',
  'rhDescuentoProgramado.controller.js': 'Descuentos programados recurrentes a empleados (cuotas).',
  'rhEmpleado.controller.js': 'Expediente de empleados: contrato, salario, AFP/ISSS, documentos.',
  'rhHonorarios.controller.js': 'Pagos de honorarios profesionales y su retención.',
  'rhIsssTasa.controller.js': 'Tasas ISSS vigentes por período.',
  'rhPlanilla.controller.js': 'Procesamiento de planillas: cálculo de nómina, rentas, AFP/ISSS y contabilización.',
  'rhPlanillaAguinaldos.controller.js': 'Planillas de aguinaldo.',
  'rhPlanillaLiquidaciones.controller.js': 'Liquidaciones laborales (fin de relación laboral).',
  'rhPlanillaVacaciones.controller.js': 'Planillas de vacaciones.',
  'rhRentaConfig.controller.js': 'Tablas de retención de renta (tramos vigentes).',
  'rhSalarioMinimo.controller.js': 'Salarios mínimos por sector/período.',
  'rhTipoContrato.controller.js': 'Tipos de contrato laboral.',
  'role.controller.js': 'Roles y permisos del sistema (incluye view_amounts).',
  'sales.controller.js': 'Ventas: creación POS, historial, anulaciones, DTE y reportes base.',
  'salesConfig.controller.js': 'Configuración de ventas: numeración, condiciones de pago, mensajes de factura.',
  'salesRemesaDelivery.controller.js': 'Entrega de remesas de ventas entre sucursales/cajas.',
  'seller.controller.js': 'CRUD de vendedores y sus metas/comisiones.',
  'settings.controller.js': 'Configuración global multi-empresa (moneda, formato, features).',
  'shift.controller.js': 'Turnos de caja: apertura, cierre y arqueo con denominaciones.',
  'smtp.controller.js': 'Configuración SMTP por empresa para envío de correos.',
  'tank.controller.js': 'Tanques de almacenamiento de combustible y su capacidad/inventario.',
  'tax.controller.js': 'Impuestos: IVA, percepciones, retenciones y libros fiscales (IVA ventas/compras).',
  'telegram.controller.js': 'Integración bot Telegram: alertas y notificaciones push.',
  'tiendaVentas.controller.js': 'Ventas de tienda/convenience diferenciadas de combustible.',
  'user.controller.js': 'Usuarios: CRUD, sesiones activas y restablecimiento.',
  'vatBooks.controller.js': 'Libros de IVA: ventas a contribuyentes/consumidor final, compras y anexos.',
  'whatsapp.controller.js': 'Envío de documentos/notificaciones vía WhatsApp.',

  // ---------- server/src/services ----------
  'ai.assistant.js': 'Lógica conversacional del asistente IA: prompts, contexto y formateo de respuestas.',
  'ai.service.js': 'Clientes de modelos IA (OpenAI/Gemini) y generación SQL segura sobre DB_SCHEMA.',
  'audit.service.js': 'Escritura estructurada de eventos en la bitácora de auditoría.',
  'condition.service.js': 'Evaluador genérico de condiciones (evaluate/evaluateAll) usado por reglas de negocio.',
  'dte.service.js': 'Cliente HTTP hacia dte-api: emitir, firmar, transmitir, contingencia e invalidación.',
  'dteQueryFilters.js': 'Filtros SQL reutilizables para consultas de documentos DTE.',
  'excel.service.js': 'Generación de archivos Excel (exceljs) para exportaciones.',
  'gasCloseoutRrs.service.js': 'Lee datos del sistema RRS externo de la gasolinera para los cierres de turno.',
  'mailer.service.js': 'Envío de correos con nodemailer usando SMTP por empresa.',
  'notification.service.js': 'Creación y distribución de notificaciones internas (WebSocket + BD).',
  'notificationWorker.js': 'Worker que evalúa eventos y dispara notificaciones programadas.',
  'officeDb.service.js': 'Pool y helpers de conexión a la BD externa Office.',
  'pdf.service.js': 'Generación de PDFs (pdfkit/pdf-lib/jspdf): facturas, reportes, etiquetas.',
  'suspiciousSalesDetector.js': 'Detector de ventas sospechosas/anómalas para auditoría.',
  'telegram.service.js': 'Envío de mensajes/alertas vía bot de Telegram.',
  'template.service.js': 'Plantillas con variables (correo/documentos) y renderizado.',
  'websocket.service.js': 'Servidor WebSocket (ws): usuarios conectados y eventos tiempo real.',
  'whatsapp.service.js': 'Integración WhatsApp Business: envío de mensajes y PDFs.',

  // ---------- server/src/utils ----------
  'crypto.js': 'Cifrado/descifrado simétrico de credenciales almacenadas (SMTP, certificados).',
  'inventoryUtils.js': 'Helpers de kardex: inserción de movimientos y actualización de existencias.',
  'numberToWords.js': 'Conversión de montos numéricos a letras (requerido en documentos legales).',

  // ---------- client raíz ----------
  'client/src/main.jsx': 'Bootstrap React: providers (QueryClient, Router, Auth, Sonner) y montaje DOM.',
  'client/src/App.jsx': 'Definición de TODAS las rutas de la app (React Router v7) con guards de auth/permisos.',
  'client/src/index.css': 'Estilos globales Tailwind: tema indigo/slate, clases utilitarias (.table-cards) y print.',

  // ---------- client/src/components/layout ----------
  'client/src/components/layout/Layout.jsx': 'Shell de la app autenticada: compone Sidebar + Navbar + Outlet.',
  'client/src/components/layout/Sidebar.jsx': 'Menú lateral dinámico filtrado por permisos del rol (usa useMenuItems).',
  'client/src/components/layout/Navbar.jsx': 'Barra superior: selector de empresa/sucursal, usuario, notificaciones, CommandPalette.',

  // ---------- client/src/components/ui ----------
  'client/src/components/ui/AIAssistant.jsx': 'Panel flotante del asistente IA (chat) disponible en toda la app.',
  'client/src/components/ui/CommandPalette.jsx': 'Paleta de comandos Ctrl+K: navegación rápida a páginas.',
  'client/src/components/ui/ConditionRow.jsx': 'Editor de una condición campo-operador-valor (reglas dinámicas).',
  'client/src/components/ui/ConfirmDialog.jsx': 'Diálogo de confirmación global (via ConfirmContext).',
  'client/src/components/ui/ErrorBoundary.jsx': 'Boundary que captura errores de render y muestra fallback.',
  'client/src/components/ui/Modal.jsx': 'Modal reutilizable con tamaños y cierre por escape/backdrop.',
  'client/src/components/ui/Money.jsx': 'Money/MoneyInput: renderiza y captura montos respetando el permiso view_amounts.',
  'client/src/components/ui/NotificationBell.jsx': 'Campana de notificaciones en navbar con conteo no leído.',
  'client/src/components/ui/NotificationItem.jsx': 'Ítem individual de notificación (lista/campana).',
  'client/src/components/ui/NotificationToast.jsx': 'Toast de notificación entrante en tiempo real.',
  'client/src/components/ui/Pagination.jsx': 'Paginador estándar de catálogos (page/totalPages).',
  'client/src/components/ui/ReportLayout.jsx': 'Layout estándar de reportes: filtros, acciones, exportación.',
  'client/src/components/ui/RuleEditor.jsx': 'Editor visual de reglas compuestas por condiciones (descuentos/notificaciones).',
  'client/src/components/ui/SearchableSelect.jsx': 'Select con búsqueda integrada (usado en formularios densos).',
  'client/src/components/ui/Table.jsx': 'Tabla estándar con estados loading/vacío según CATALOG_RULES.',
  'client/src/components/ui/TemplateEditor.jsx': 'Editor de plantillas con inserción de variables (correos/documentos).',
  'client/src/components/ui/VariableBadge.jsx': 'Chip visual de variable insertable en editores de plantillas.',

  // ---------- client/src/components otros ----------
  'client/src/components/accounting/OfficeConnectionTab.jsx': 'Pestaña de conexión/sincronización con BD externa Office.',
  'client/src/components/products/ProductLabelModal.jsx': 'Modal de impresión de etiquetas/códigos de barras de productos.',
  'client/src/components/sales/SaleDetailModal.jsx': 'Modal de detalle de venta: productos, totales, DTE, acciones.',

  // ---------- client/src/context, hooks, utils, config ----------
  'client/src/context/AuthContext.jsx': 'Estado global de sesión: login/logout, empresa activa y permisos del rol.',
  'client/src/context/ConfirmContext.jsx': 'API declarativa window.confirm reemplazada por ConfirmDialog.',
  'client/src/hooks/useMenuItems.js': 'Construye el menú visible según permisos del rol autenticado.',
  'client/src/hooks/useWebSocket.js': 'Suscripción WebSocket: notificaciones y usuarios conectados en vivo.',
  'client/src/utils/closeoutPdf.js': 'Genera el PDF del cierre de gasolinera (jspdf).',
  'client/src/utils/closeoutPrint.js': 'Impresión directa del cierre de gasolinera.',
  'client/src/utils/fuzzySearch.js': 'Búsqueda difusa tolerante a errores tipeados.',
  'client/src/utils/qzPrint.js': 'Impresión física vía QZ Tray (tickets/facturas).',
  'client/src/config/iconMap.js': 'Mapa nombre→icono lucide-react usado por el menú dinámico.',

  /* ================= CLIENT PAGES ================= */
  'AccountingEntries.jsx': 'Partidas contables manuales (libro diario) con débitos/créditos.',
  'AccountingSettings.jsx': 'Configuración contable por empresa: moneda, período activo, parámetros.',
  'AddPayment.jsx': 'Registro de abonos de clientes (CxC) con asignación a documentos.',
  'AddProviderPayment.jsx': 'Registro de pagos a proveedores (CxP).',
  'ArqueosReport.jsx': 'Reporte histórico de arqueos de caja con diferencias.',
  'AuditLog.jsx': 'Visor de bitácora de auditoría con filtros por usuario/acción.',
  'Branches.jsx': 'Catálogo de sucursales.',
  'CashClosing.jsx': 'Cierre de caja del turno POS: conteo, diferencia y arqueo.',
  'Categories.jsx': 'Catálogo de categorías de productos.',
  'Changelog.jsx': 'Historial de cambios/novedades del sistema.',
  'ChartOfAccounts.jsx': 'Catálogo de cuentas contables jerárquico.',
  'Combos.jsx': 'Catálogo de combos/promociones de productos.',
  'Companies.jsx': 'Administración de empresas (tenants).',
  'ConnectedUsers.jsx': 'Usuarios conectados en tiempo real (WebSocket) y forzado de sesión.',
  'Contingency.jsx': 'Emisión masiva de DTE en contingencia y reenvío posterior.',
  'CustomerBalancesReport.jsx': 'Reporte de saldos pendientes de clientes.',
  'CustomerDiscounts.jsx': 'Descuentos especiales por cliente/producto.',
  'Customers.jsx': 'Catálogo de clientes.',
  'CustomerStatement.jsx': 'Estado de cuenta de cliente con movimientos y saldos.',
  'DailySalesReport.jsx': 'Ventas consolidadas del día por tipo/sucursal.',
  'Dashboard.jsx': 'Panel principal con KPIs, gráficas y accesos rápidos.',
  'DiscountRules.jsx': 'Constructor de reglas automáticas de descuento.',
  'Eret.jsx': 'Eventos de Retorno (ERET) de DTE ante Hacienda: emisión y respuesta MH.',
  'ExpenseReport.jsx': 'Reporte de gastos por categoría/período.',
  'Expenses.jsx': 'Registro de gastos operativos.',
  'FuelInventoryReport.jsx': 'Inventario de combustibles por tanque (galones).',
  'FuelPrices.jsx': 'Precios de venta de combustibles por surtidor.',
  'FuelSalesSummaryReport.jsx': 'Resumen de ventas de combustible por período.',
  'GalonajeVendidoReport.jsx': 'Galonaje vendido por surtidor/despachador.',
  'GasAccumulatedDailyReport.jsx': 'Acumulado diario de operación de gasolinera.',
  'GasAdvances.jsx': 'Anticipos/suplidos de despachadores.',
  'GasCloseout.jsx': 'Cierre de turno de gasolinera: lecturas, remesas y cuadre.',
  'GasCloseoutDetailReport.jsx': 'Detalle de cierres de gasolinera por turno.',
  'GasDespachadores.jsx': 'Catálogo de despachadores.',
  'GasDespachadorNozzles.jsx': 'Asignación de surtidores a cada despachador.',
  'GasDistributors.jsx': 'Catálogo de distribuidores de combustible.',
  'GasExpenseCategories.jsx': 'Categorías de gasto exclusivas de gasolinera.',
  'GasPosTypes.jsx': 'Tipos de POS de gasolinera.',
  'GasReadingHistory.jsx': 'Historial de lecturas de bombas/surtidores.',
  'GasRemesaDeliveries.jsx': 'Entrega de remesas de efectivo de gasolinera.',
  'GasStationConfig.jsx': 'Configuración general de la estación de servicio.',
  'InventoryAdjustments.jsx': 'Ajustes de inventario con justificación.',
  'InventoryMovementsReport.jsx': 'Movimientos de inventario por producto/período.',
  'InventoryStockReport.jsx': 'Existencias actuales por sucursal/producto.',
  'Islands.jsx': 'Catálogo de islas de despacho.',
  'Kardex.jsx': 'Kardex por producto: entradas, saldas y saldo corrido.',
  'Login.jsx': 'Inicio de sesión con selección de empresa.',
  'LogViewer.jsx': 'Visor de logs técnicos del servidor.',
  'Manual.jsx': 'Manual de usuario integrado navegable.',
  'MenuItems.jsx': 'Editor del menú lateral: ítems, orden, iconos y roles.',
  'NotificacionesConfig.jsx': 'Configuración de qué eventos disparan notificaciones.',
  'NotificacionesLista.jsx': 'Bandeja centralizada de notificaciones.',
  'Nozzles.jsx': 'Catálogo de surtidores (mangueras) con precios.',
  'PendingDocumentsDetailedReport.jsx': 'Documentos pendientes de pago de clientes (detalle).',
  'PhysicalInventory.jsx': 'Toma de inventario físico comparativo.',
  'POS.jsx': 'Punto de venta principal: carrito, F3 productos, cobro y DTE.',
  'PozoCorte.jsx': 'Cortes de caja del pozo.',
  'PozoDespachos.jsx': 'Despachos registrados en el pozo.',
  'PozoEntregasEfectivo.jsx': 'Entregas de efectivo del pozo.',
  'PozoServicios.jsx': 'Servicios atendidos en el pozo.',
  'Products.jsx': 'Catálogo de productos con precios por sucursal y códigos.',
  'ProviderBalancesReport.jsx': 'Saldos pendientes a proveedores.',
  'ProviderPendingDocumentsDetailedReport.jsx': 'Documentos pendientes con proveedores (detalle).',
  'Providers.jsx': 'Catálogo de proveedores.',
  'ProviderStatement.jsx': 'Estado de cuenta de proveedor.',
  'PublicDTE.jsx': 'Portal público de consulta de DTE por código de generación (sin login).',
  'PurchaseChecks.jsx': 'Cheques de pago asociados a compras.',
  'PurchasePeriod.jsx': 'Apertura/cierre de períodos de compras.',
  'PurchaseReport.jsx': 'Reporte de compras por proveedor/período.',
  'Purchases.jsx': 'Registro de compras y recepción de mercadería.',
  'Quedan.jsx': 'Quedanes (crédito con proveedores) y su control.',
  'QuedanReport.jsx': 'Reporte de quedanes pendientes/pagados.',
  'ReporteVentasCombustible.jsx': 'Reporte operativo de ventas de combustible.',
  'Roles.jsx': 'Roles y matriz de permisos (incluye view_amounts).',
  'SalesByCategoryReport.jsx': 'Ventas agrupadas por categoría.',
  'SalesByCustomerReport.jsx': 'Ventas agrupadas por cliente.',
  'SalesByPOSReport.jsx': 'Ventas agrupadas por punto de venta.',
  'SalesConfig.jsx': 'Parámetros de facturación y condiciones de venta.',
  'SalesDetailReport.jsx': 'Detalle línea a línea de ventas.',
  'SalesHistory.jsx': 'Historial de ventas con reimpresión/anulación/DTE.',
  'SalesRemesaDeliveries.jsx': 'Entrega de remesas de ventas.',
  'SalesReport.jsx': 'Reporte general de ventas con totales.',
  'SalesTerminal.jsx': 'Terminal de venta rápida (touch) para mostrador.',
  'ScanInventory.jsx': 'Escaneo continuo de códigos para toma de inventario.',
  'Sellers.jsx': 'Catálogo de vendedores.',
  'ShiftDTEs.jsx': 'DTEs emitidos dentro de un turno específico.',
  'SmtpConfig.jsx': 'Configuración de servidores SMTP por empresa.',
  'SystemSettings.jsx': 'Parámetros globales del sistema.',
  'Tanks.jsx': 'Tanques de combustible con capacidad y alarmas.',
  'Transfers.jsx': 'Traspasos de inventario entre sucursales.',
  'UserAccess.jsx': 'Asignación fina de permisos por rol (checkboxes por módulo/acción).',
  'Users.jsx': 'Usuarios, sucursales asignadas y estado.',
  'WhatsAppConfig.jsx': 'Credenciales y plantillas de WhatsApp.',
  'YearClosing.jsx': 'Cierre del año fiscal: validaciones y asiento de cierre.',
  'YearOpening.jsx': 'Apertura del año fiscal y saldos iniciales.',

  // AccountingReports/
  'AccountingReports/index.js': 'Barrel de exportación de los reportes contables.',
  'AccountingReports/AnexoBalance.jsx': 'Anexo del balance general (detalle de cuentas).',
  'AccountingReports/AuxiliarOperaciones.jsx': 'Auxiliar de operaciones por cuenta.',
  'AccountingReports/BalanceComparativo.jsx': 'Balance general comparativo entre períodos.',
  'AccountingReports/BalanceComprobacion.jsx': 'Balance de comprobación de sumas y saldos.',
  'AccountingReports/BalanceGeneral.jsx': 'Balance general (activo, pasivo, capital).',
  'AccountingReports/CambiosPatrimonio.jsx': 'Estado de cambios en el patrimonio.',
  'AccountingReports/CedulaAuditoria.jsx': 'Cédula sumaria/de auditoría contable.',
  'AccountingReports/EstadoResultados.jsx': 'Estado de resultados (pérdidas y ganancias).',
  'AccountingReports/FlujoEfectivo.jsx': 'Estado de flujos de efectivo.',
  'AccountingReports/LibroDiario.jsx': 'Libro diario cronológico.',
  'AccountingReports/LibroDiarioMayor.jsx': 'Libro diario-mayor combinado.',
  'AccountingReports/LibroMayor.jsx': 'Libro mayor por cuenta.',
  'AccountingReports/ListadoPartidas.jsx': 'Listado de partidas contables con filtros.',
  'AccountingReports/Retenciones.jsx': 'Reporte de retenciones (renta/IVA).',

  // EggIndustrial/
  'EggIndustrial/Config.jsx': 'Configuración del módulo industrial de huevo.',
  'EggIndustrial/CostsMaintenance.jsx': 'Costos y mantenimiento de equipos del módulo huevo.',
  'EggIndustrial/Dashboard.jsx': 'Panel del módulo industrial de huevo.',
  'EggIndustrial/Packaging.jsx': 'Empaque de huevo procesado.',
  'EggIndustrial/Production.jsx': 'Producción del proceso industrial.',
  'EggIndustrial/Reception.jsx': 'Recepción de huevo en planta.',
  'EggIndustrial/Traceability.jsx': 'Trazabilidad de lotes de recepción a empaque.',

  // rh/
  'rh/Afps.jsx': 'Catálogo de AFPs.',
  'rh/AfpTasas.jsx': 'Tasas AFP por período.',
  'rh/AguinaldoConfig.jsx': 'Parámetros de cálculo de aguinaldo.',
  'rh/Aguinaldos.jsx': 'Proceso y planilla de aguinaldos.',
  'rh/Cargos.jsx': 'Catálogo de cargos.',
  'rh/ConfigRh.jsx': 'Configuración general de RRHH.',
  'rh/CuentasPlanillas.jsx': 'Cuentas contables por concepto de planilla.',
  'rh/Departamentos.jsx': 'Catálogo de departamentos.',
  'rh/DescuentosProgramados.jsx': 'Descuentos programados a empleados.',
  'rh/Empleados.jsx': 'Expedientes de empleados.',
  'rh/Honorarios.jsx': 'Honorarios profesionales y retención.',
  'rh/IsssTasas.jsx': 'Tasas ISSS por período.',
  'rh/Liquidaciones.jsx': 'Liquidaciones laborales.',
  'rh/Planillas.jsx': 'Procesamiento de planillas de nómina.',
  'rh/RentaConfig.jsx': 'Tabla de retención de renta.',
  'rh/SalarioMinimo.jsx': 'Salarios mínimos por período.',
  'rh/TiposContrato.jsx': 'Tipos de contrato laboral.',
  'rh/Vacaciones.jsx': 'Gestión y planilla de vacaciones.',

  // VatBooks/
  'VatBooks/VatBookAnexosIVA.jsx': 'Anexos del libro de IVA.',
  'VatBooks/VatBookPurchases.jsx': 'Libro de compras (IVA crédito fiscal).',
  'VatBooks/VatBookSalesConsumers.jsx': 'IVA ventas a consumidor final.',
  'VatBooks/VatBookSalesTaxpayers.jsx': 'IVA ventas a contribuyentes.',

  /* ================= DTE-API ================= */
  'dte-api/src/index.js': 'Entrada del microservicio DTE (Express, puerto 5000): monta rutas /api y worker de cola.',
  'dte-api/src/config/db.js': 'Pool MySQL compartido (db_sistema_saas) para documentos DTE.',
  'dte-api/src/config/haciendaConfig.js': 'Endpoints y credenciales de Hacienda según HACIENDA_ENV (test|production).',
  'dte-api/src/contingency/contingencyService.js': 'Lógica de contingencia: registro de eventos tipo 101 y reenvío.',
  'dte-api/src/controllers/dteController.js': 'Operaciones núcleo: generate, sign, transmit y flujo único emit.',
  'dte-api/src/controllers/signatureController.js': 'Firma electrónica del JSON DTE (JWS) con certificado almacenado.',
  'dte-api/src/controllers/invalidationController.js': 'Invalidación de DTE (anulación o rectificación, evento 3).',
  'dte-api/src/controllers/retornoController.js': 'Evento de retorno (ERET) ante Hacienda.',
  'dte-api/src/controllers/retransmissionController.js': 'Retransmisión de documentos fallidos.',
  'dte-api/src/controllers/contingencyController.js': 'Endpoints de contingencia: crear evento y listar pendientes.',
  'dte-api/src/invalidation/invalidationService.js': 'Construcción y envío del JSON de invalidación.',
  'dte-api/src/jobs/resendContingencyDTE.js': 'Job programado que reenvía automáticamente DTE en contingencia.',
  'dte-api/src/middlewares/auth.js': 'Verifica JWT del main server y header x-company-id.',
  'dte-api/src/middlewares/audit.js': 'Bitácora de operaciones DTE sensibles.',
  'dte-api/src/queue/transmissionQueue.js': 'Cola persistente de transmisión con reintentos y backoff.',
  'dte-api/src/routes/contingency.routes.js': 'Rutas de contingencia (/api/contingency).',
  'dte-api/src/routes/invalidation.routes.js': 'Rutas de invalidación (/api/invalidation).',
  'dte-api/src/routes/retorno.routes.js': 'Rutas de evento de retorno (/api/retorno).',
  'dte-api/src/routes/retransmission.routes.js': 'Rutas de retransmisión (/api/retransmission).',
  'dte-api/src/routes/signature.routes.js': 'Rutas de firma (/api/signature).',
  'dte-api/src/services/audit.service.js': 'Escritura de auditoría local del microservicio.',
  'dte-api/src/services/dteGenerator.js': 'Construcción del JSON del DTE por tipo de documento (01,03,05,...).',
  'dte-api/src/services/pdfService.js': 'PDF entregable del DTE con QR y resolución.',
  'dte-api/src/services/dte/controlNumberService.js': 'Generación del número de control oficial (secuencial por tipo/sucursal/PDV).',
  'dte-api/src/services/retorno/retornoService.js': 'Armado y transmisión del evento de retorno (ERET).',
  'dte-api/src/services/signature/signatureService.js': 'Orquestador de firma: decide internal/external según SIGNATURE_MODE.',
  'dte-api/src/services/signature/internalSignerService.js': 'Firmador interno con node-forge cargando certificado P12/PFX.',
  'dte-api/src/services/signature/externalSignerService.js': 'Cliente del firmador externo (microservicio dedicado).',
  'dte-api/src/transmission/transmissionService.js': 'Comunicación con Hacienda: token JWT MH, envío (recepcionDTE) y consulta.',
  'dte-api/src/utils/calculations.js': 'Cálculos fiscales: IVA, percepción, totales y redondeos oficiales.',
  'dte-api/src/utils/text.js': 'Normalización de texto para XML/JSON de Hacienda.',
  'dte-api/src/utils/versionMap.js': 'Versión de JSON schema aplicable por tipo de documento.',
  'dte-api/src/validators/schemaValidator.js': 'Validación ajv del JSON DTE contra los schemas oficiales de MH.',

  /* ---------- Directorios (descripción cuando se listan como ítems) ---------- */
  '__dir__/caddy': 'Binario caddy.exe: reverse proxy local HTTPS.',
  '__dir__/deploy': 'Scripts de despliegue (setup.ps1).',
  '__dir__/scripts': 'Scripts utilitarios standalone: importar catálogo contable y preparar turnos/cajas.',
  '__dir__/cumplientoDTE': 'Material oficial de cumplimiento DTE: manuales PDF de Hacienda, catálogos XLSX y JSON schemas oficiales (svfe-json-schemas). Referencia, no código ejecutable.',
  '__dir__/database': 'Migraciones MySQL versionadas (ver sección propia más abajo).',
  '__dir__/server/uploads': 'Archivos subidos en runtime (logos, adjuntos). No versionar contenido.',
  '__dir__/server/certificados-p12pfx': 'Certificados digitales P12/PFX para firma DTE (por empresa).',
  '__dir__/server/certificados-crt': 'Certificados CRT/llaves derivados.',
};

/* Descripciones por directorio cuando un archivo no tiene nota exacta. */
const DIR_HINTS = {
  'client/src/pages': 'Página de ruta',
  'client/src/pages/rh': 'Recursos Humanos:',
  'client/src/pages/EggIndustrial': 'Módulo industrial de huevo:',
  'client/src/pages/AccountingReports': 'Reporte contable:',
  'client/src/pages/VatBooks': 'Libro fiscal IVA:',
};

/* ============================================================================
 * 2. HELPERS DE SISTEMA DE ARCHIVOS
 * ========================================================================== */
const toPosix = (p) => p.split(path.sep).join('/');
const existsDir = (rel) => fs.existsSync(path.join(ROOT_DIR, rel)) &&
  fs.statSync(path.join(ROOT_DIR, rel)).isDirectory();

/** Lista archivos inmediatos (no recursivo) de un dir relativo, ordenados. */
function listFiles(baseRel) {
  const abs = path.join(ROOT_DIR, baseRel);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .map((n) => toPosix(path.join(baseRel, n)));
}

/** Recorre recursivamente; devuelve [{dir, files}] con '.' primero. */
function walkFiles(baseRel) {
  const absBase = path.join(ROOT_DIR, baseRel);
  const result = [{ dir: '.', files: [] }];
  if (!fs.existsSync(absBase)) return result;

  const walk = (relSub) => {
    const entries = fs.readdirSync(path.join(absBase, relSub), { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.isDirectory()) {
        result.push({ dir: relSub === '.' ? e.name : `${relSub}/${e.name}`, files: [] });
        walk(relSub === '.' ? e.name : `${relSub}/${e.name}`);
      } else if (e.isFile()) {
        const bucket = relSub === '.' ? result[0] : result.find((r) => r.dir === relSub);
        bucket.files.push(e.name);
      }
    }
  };
  walk('.');
  return result;
}

/* ============================================================================
 * 3. RESOLUCIÓN DE DESCRIPCIONES
 * ========================================================================== */
function humanize(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const words = stem
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function describe(relPosix) {
  // 1. Coincidencia por sufijo: prueba la ruta completa y luego recorta
  //    segmentos iniciales ('client/src/pages/rh/Afps.jsx' → 'rh/Afps.jsx').
  const segs = relPosix.split('/');
  for (let i = 0; i < segs.length; i++) {
    const cand = segs.slice(i).join('/');
    if (NOTES[cand]) return NOTES[cand];
  }
  // 2. Pista por directorio padre.
  const fileName = segs[segs.length - 1];
  const parentDir = segs.slice(0, -1).join('/');
  const hint = DIR_HINTS[parentDir];
  if (hint) return `${hint} ${humanize(fileName)}.`;
  return `${humanize(fileName)}.`;
}

function describeDir(relDir) {
  const key = `__dir__/${relDir}`;
  if (NOTES[key]) return NOTES[key];
  return humanize(relDir.split('/').pop()) + '.';
}

/* ============================================================================
 * 4. RENDERIZADO MARKDOWN
 * ========================================================================== */
const mdTable = (rows) => {
  if (!rows.length) return '_Sin archivos._';
  const lines = ['| Archivo | Descripción |', '|---|---|'];
  for (const r of rows) lines.push(`| \`${r.file}\` | ${r.desc} |`);
  return lines.join('\n');
};

const renderGroup = ({ title, base, recursive }) => {
  const out = [`#### ${title}`];
  const blocks = recursive ? walkFiles(base) : null;

  if (!recursive) {
    const files = listFiles(base);
    out.push(mdTable(files.map((f) => ({
      file: f.split('/').pop(),
      desc: describe(f),
    }))));
    out.push('');
    return out.join('\n');
  }

  for (const block of blocks) {
    if (!block.files.length) continue;
    const label = block.dir === '.' ? '`' + base.split('/').pop() + '/`' : '`' + base + '/' + block.dir + '/`';
    const dirNote = NOTES[`__dir__/${base}/${block.dir}`];
    out.push('');
    out.push(dirNote ? `**${label}** — ${dirNote}` : `**${label}**`);
    out.push('');
    out.push(mdTable(block.files.map((f) => {
      const full = block.dir === '.' ? `${base}/${f}` : `${base}/${block.dir}/${f}`;
      return { file: f, desc: describe(full) };
    })));
  }
  out.push('');
  return out.join('\n');
};

/* ============================================================================
 * 5. ESTADÍSTICAS database/
 * ========================================================================== */
function databaseStats() {
  const dirAbs = path.join(ROOT_DIR, 'database');
  if (!fs.existsSync(dirAbs)) return null;
  const files = fs.readdirSync(dirAbs);
  let minV = Infinity, maxV = 0;
  let sql = 0, js = 0, json = 0, other = 0, runners = 0;
  for (const f of files) {
    if (!fs.statSync(path.join(dirAbs, f)).isFile()) continue;
    const m = f.match(/migration_v(\d+)[._]/i);
    if (m) { const v = parseInt(m[1], 10); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
    if (f.endsWith('.sql')) sql++;
    else if (f.endsWith('.js')) {
      if (/^run_migration/i.test(f)) runners++;
      else js++;
    }
    else if (f.endsWith('.json')) json++;
    else other++;
  }
  const total = sql + js + runners + json + other;
  return { minV: maxV ? minV : 0, maxV, sql, js, json, other, runners, total,
    hasRunners: runners > 0 };
}

/* ============================================================================
 * 6. DOCUMENTO
 * ========================================================================== */
function buildDocument() {
  const today = new Date().toISOString().slice(0, 10);

  /* --- Encabezado --- */
  const parts = [];
  parts.push(`# ESTRUCTURA_PROYECTO.md

> **GENERADO AUTOMÁTICAMENTE** — no editar a mano.
> Regenerar con: \`node scripts/generate-project-structure.js\`
> Última generación: ${today}
>
> Mapa exhaustivo de la estructura física del repositorio con la función de
> cada archivo. Para reglas de negocio y convenciones ver AGENTS.md,
> CLAUDE.md y los \`*_RULES.md\` de la raíz.
`);

  /* --- 1. Visión general --- */
  parts.push(`## 1. Visión general

Sistema multi-empresa (multi-tenant) SaaS para El Salvador con facturación electrónica DTE.

| Componente | Carpeta | Stack | Puerto |
|---|---|---|---|
| Backend principal | \`server/\` | Node.js + Express + MySQL2 | 4000 |
| Frontend SPA | \`client/\` | React 18 + Vite + Tailwind + TanStack Query + React Router v7 | 3000 (dev) |
| Microservicio DTE | \`dte-api/\` | Node.js + Express 5 + ajv + node-forge | 5000 |
| Webhook deploy | \`webhook-server.js\` | Node http nativo | 7777 |

**Base de datos única compartida:** \`db_sistema_saas\` (MySQL).
**Multi-tenancy:** header \`x-company-id\` validado por \`tenantMiddleware\`.
**Autenticación:** JWT (\`Authorization: Bearer\`) + permisos granulares por rol.
`);

  /* --- 2. Raíz --- */
  const rootFiles = [
    'AGENTS.md', 'CLAUDE.md', 'README.md', 'ESTRUCTURA_PROYECTO.md',
    'CATALOG_RULES.md', 'CLIENT_REESTRUCTURACION_PLAN.md', 'DTE_API_RULES.md',
    'REPORT_DESIGN_RULES.md', 'RESPONSIVE_RULES.md', 'UI_DESIGN_RULES.md',
  ].filter((f) => fs.existsSync(path.join(ROOT_DIR, f)));

  const rootConfigs = [
    'Caddyfile', 'Caddyfile.dev', 'Caddyfile.docker', 'caddy-pm2-wrapper.js',
    'docker-compose.yml', 'ecosystem.config.js', 'vercel.json',
    'webhook-server.js', '.gitignore',
  ].filter((f) => fs.existsSync(path.join(ROOT_DIR, f)));

  const rootDirs = ['caddy', 'deploy', 'scripts', 'cumplientoDTE']
    .filter(existsDir);

  let sec = ['## 2. Raíz del repositorio', '', '### Documentación', '', mdTable(rootFiles.map((f) => ({ file: f, desc: describe(f) }))), '', '### Configuración y despliegue', '', mdTable(rootConfigs.map((f) => ({ file: f, desc: describe(f) })))];
  if (rootDirs.length) {
    sec.push('', '### Directorios auxiliares', '');
    sec.push(mdTable(rootDirs.map((d) => ({ file: `${d}/`, desc: describeDir(d) }))));  }
  parts.push(sec.join('\n') + '\n');

  /* --- 3. server/ --- */
  const srv = ['## 3. `server/` — Backend principal', '',
    'Express.js, patrón controller → service → model (los modelos son SQL directo en servicios; la carpeta `src/models/` existe pero está vacía).',
    ''];
  srv.push(renderGroup({ title: '`server/src/` (raíz)', base: 'server/src', recursive: false }));
  srv.push(renderGroup({ title: '`server/src/config/`', base: 'server/src/config', recursive: false }));
  srv.push(renderGroup({ title: '`server/src/middlewares/`', base: 'server/src/middlewares', recursive: false }));
  srv.push(renderGroup({ title: '`server/src/routes/`', base: 'server/src/routes', recursive: false }));
  srv.push(renderGroup({ title: '`server/src/services/`', base: 'server/src/services', recursive: false }));
  srv.push(renderGroup({ title: '`server/src/utils/`', base: 'server/src/utils', recursive: false }));
  srv.push(renderGroup({ title: '`server/src/controllers/`', base: 'server/src/controllers', recursive: false }));
  const extraServerDirs = ['uploads', 'certificados-p12pfx', 'certificados-crt'].filter((d) => existsDir(`server/${d}`));
  if (extraServerDirs.length) {
    srv.push('#### Directorios runtime');
    srv.push('');
    srv.push(mdTable(extraServerDirs.map((d) => ({ file: `server/${d}/`, desc: describeDir(`server/${d}`) }))));
    srv.push('');
  }
  parts.push(srv.join('\n'));

  /* --- 4. client/ --- */
  const cli = ['## 4. `client/` — Frontend SPA', '',
    'React 18 + Vite. Estado servidor con TanStack Query (`queryKey: [\'recurso\', search, page]`).',
    ''];
  cli.push(renderGroup({ title: '`client/src/` (raíz)', base: 'client/src', recursive: false }));
  cli.push(renderGroup({ title: '`client/src/context/`', base: 'client/src/context', recursive: false }));
  cli.push(renderGroup({ title: '`client/src/hooks/`', base: 'client/src/hooks', recursive: false }));
  cli.push(renderGroup({ title: '`client/src/config/`', base: 'client/src/config', recursive: false }));
  cli.push(renderGroup({ title: '`client/src/utils/`', base: 'client/src/utils', recursive: false }));
  cli.push(renderGroup({ title: '`client/src/components/`', base: 'client/src/components', recursive: true }));
  cli.push(renderGroup({ title: '`client/src/pages/`', base: 'client/src/pages', recursive: true }));
  parts.push(cli.join('\n'));

  /* --- 5. dte-api/ --- */
  const dte = ['## 5. `dte-api/` — Microservicio DTE', '',
    'Ciclo de vida del Documento Tributario Electrónico: `generate → sign → transmit`,',
    'además de contingencia, invalidación, retorno (ERET) y retransmisión.',
    'Se comunica con Hacienda según `HACIENDA_ENV`. Comparte BD con el server principal.',
    'Nota: las carpetas `schemas/`, `signature/` y `repositories/` NO existen; los esquemas',
    'oficiales viven en `cumplientoDTE/svfe-json-schemas/` y la firma en `services/signature/`.',
    ''];
  dte.push(renderGroup({ title: '`dte-api/src/` (raíz)', base: 'dte-api/src', recursive: false }));
  dte.push(renderGroup({ title: '`dte-api/src/config/`', base: 'dte-api/src/config', recursive: false }));
  dte.push(renderGroup({ title: '`dte-api/src/middlewares/`', base: 'dte-api/src/middlewares', recursive: false }));
  dte.push(renderGroup({ title: '`dte-api/src/routes/`', base: 'dte-api/src/routes', recursive: false }));
  dte.push(renderGroup({ title: '`dte-api/src/controllers/`', base: 'dte-api/src/controllers', recursive: false }));
  dte.push(renderGroup({ title: '`dte-api/src/services/`', base: 'dte-api/src/services', recursive: true }));
  dte.push(renderGroup({ title: '`dte-api/src/utils/`', base: 'dte-api/src/utils', recursive: false }));
  const singleDirs = ['contingency', 'invalidation', 'jobs', 'queue', 'transmission', 'validators']
    .filter((d) => existsDir(`dte-api/src/${d}`));
  for (const d of singleDirs) {
    dte.push(renderGroup({ title: `\`dte-api/src/${d}/\``, base: `dte-api/src/${d}`, recursive: false }));
  }
  parts.push(dte.join('\n'));

  /* --- 6. database/ --- */
  const st = databaseStats();
  const dbSec = ['## 6. `database/` — Migraciones MySQL', ''];
  if (st) {
    dbSec.push(
      `Patrón de nombres: \`migration_v<N>_<descripcion>.{sql|js}\` y un runner \`run_migration_v<N>.js\` por versión.`,
      '',
      `- Rango de versiones detectado: **v${st.minV || 'v8'} → v${st.maxV}**`,
      `- Total de archivos: **${st.total}** (${st.sql} .sql · ${st.js} .js migración · ${st.runners} runners run_migration* · ${st.json} .json · ${st.other} otros)`,
      '',
      '> Los archivos NO se listan individualmente por su volumen: para conocer el esquema vigente usa',
      '> `SELECT ... FROM information_schema` o revisa `server/src/config/db.schema.js`,',
      '> que expone el esquema consolidado usado por el asistente IA.',
      ''
    );
  }
  parts.push(dbSec.join('\n'));

  /* --- 7. Convenciones clave --- */
  parts.push(`## 7. Convenciones esenciales (resumen)

1. **Catálogos/listados**: GET con \`search/page/limit\` → \`{ data, total, page, totalPages }\`; frontend \`Table\`+\`Pagination\`+debounce 500ms (ver CATALOG_RULES.md).
2. **Montos**: SIEMPRE \`<Money>\` / \`<MoneyInput>\` de \`components/ui/Money.jsx\` (permiso \`view_amounts\`). Nunca \`toFixed(2)\` directo.
3. **Responsive móvil obligatorio** 320px-767px (ver RESPONSIVE_RULES.md).
4. **Layout cabecera-detalle** en documentos: grid horizontal arriba, tabla abajo, totales a la derecha, F3 abre buscador de productos (ver UI_DESIGN_RULES.md).
5. **Validación de producto en ventas**: \`status === 'activo'\` y sucursal incluida en \`product.branches\`.
6. **Textos de UI en español**, paleta Indigo/Slate, bordes \`rounded-xl\`/\`rounded-2xl\`.
7. **DTE**: el main server nunca firma ni transmite; delega en \`dte-api\` vía \`POST /dte/emit\` (JWT + x-company-id).
`);

  return parts.join('\n');
}

/* ============================================================================
 * MAIN
 * ========================================================================== */
try {
  const doc = buildDocument();
  fs.writeFileSync(OUT_FILE, doc, 'utf8');
  console.log(`OK -> ${path.relative(process.cwd(), OUT_FILE)} (${(doc.length / 1024).toFixed(1)} KB)`);
} catch (err) {
  console.error('Error generando estructura:', err);
  process.exitCode = 1;
}
