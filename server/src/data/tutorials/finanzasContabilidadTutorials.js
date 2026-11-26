/**
 * Tutoriales Fase 2: Cuentas por Cobrar, Cuentas por Pagar, Contabilidad e IVA (#16 - #19)
 */

const FINANZAS_CONTABILIDAD_TUTORIALS = [
    {
        slug: 'cuentas-por-cobrar-abonos',
        order: 16,
        category: 'finanzas',
        categoryLabel: 'Cuentas por Cobrar y Pagar',
        requiredModule: 'sales',
        menuPath: 'Cuentas por Cobrar → Consulta, Abonos y Reportes',
        title: 'Cuentas por Cobrar: Estados de Cuenta, Abonos y Saldos',
        summary: 'Consulta la cartera pendiente por cliente, revisa antigüedad de saldos, anticipos y consumos Trupput, aplica abonos parciales o totales e imprime reportes de cobro.',
        outcome: 'Controlar exactamente cuánto debe cada cliente de crédito y registrar recibos de abono cuadrados contra sus facturas.',
        duration: '5 min',
        modulePath: '/cxc/estado-cuenta',
        roles: ['Jefe Pista', 'Auxiliar', 'Supervisor', 'Gerencia', 'Contador', 'Bodega', 'Admin'],
        requiredPermissions: ['view_customer_statement', 'manage_cxc_payments', 'view_cxc_balances', 'view_cxc_statement_report'],
        coverImage: 'cxc-statement.png',
        prerequisites: [
            'Haber emitido ventas con condición de pago "Crédito" desde el POS o registrado documentos por cobrar del cliente.'
        ],
        steps: [
            {
                title: 'Revisar el Estado de Cuenta integral del Cliente',
                description: 'Entra a Cuentas por Cobrar → Consulta de Cliente. Elige la Sucursal y busca al cliente. Tienes 4 pestañas clave: "ESTADO DE CUENTA", "ANTIGÜEDAD DE SALDOS", "ANTICIPOS" y "TRUPPUT". Arriba a la derecha puedes exportar a Excel, PDF o enviárselo directo por correo.',
                image: 'cxc-statement.png',
                annotations: [
                    { n: 1, x: 21.1, y: 24.5, w: 36.7, h: 4, label: 'Selector de Sucursal y campo de búsqueda del cliente de crédito.' },
                    { n: 2, x: 34, y: 34.6, w: 49.2, h: 4.1, label: 'Pestañas: Estado de Cuenta, Antigüedad de Saldos, Anticipos y Trupput.' },
                    { n: 3, x: 77.4, y: 11.4, w: 20.4, h: 4.5, label: 'Botones "REPORTE FORMAL", Exportar Excel, PDF y Enviar por Correo.' }
                ],
                tip: 'Usa "Enviar por Correo" cuando necesites enviarle al cliente su estado de cuenta formal con detalle de facturas vencidas.'
            },
            {
                title: 'Registrar Abonos o Pagos de Clientes',
                description: 'Abre Cuentas por Cobrar → Abonos / Pagos (pestaña "NUEVO ABONO"). Selecciona Sucursal y Cliente para listar sus facturas con saldo pendiente; ingresa el monto a abonar por documento, elige Método de Pago (Efectivo, Transferencia, Cheque, Tarjeta), referencia y pulsa "GUARDAR RECIBO".',
                image: 'cxc-payments.png',
                annotations: [
                    { n: 1, x: 80.6, y: 12.1, w: 16.9, h: 3.2, label: 'Cambiar entre "NUEVO ABONO" y "HISTORIAL" de recibos emitidos.' },
                    { n: 2, x: 19.5, y: 22.6, w: 58.4, h: 20, label: 'Selector de sucursal/cliente y tabla de facturas pendientes con monto a abonar.' },
                    { n: 3, x: 80.5, y: 46, w: 15.9, h: 36, label: 'Panel derecho de liquidación: total a aplicar, método de pago, notas y "GUARDAR RECIBO".' }
                ],
                tip: 'En la pestaña "HISTORIAL" puedes reimprimir cualquier recibo anterior en PDF o anular un abono registrado por error.'
            },
            {
                title: 'Emitir reportes de Saldos, Documentos Pendientes y Consumo',
                description: 'En Cuentas por Cobrar → Reportes elige "Saldos de Clientes", "Documentos Pendientes", "Estado de Cuenta Detallado" o "Consumo Detallado por Período". Selecciona la Sucursal y haz clic en "GENERAR REPORTE" para visualizarlo en PDF o bajarlo a Excel.',
                image: 'cxc-balances-report.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31.4, w: 12.2, h: 12, label: 'Filtro de Sucursal, cliente opcional y fecha de corte para el reporte.' },
                    { n: 2, x: 23.9, y: 76.1, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para construir la vista previa PDF y descarga Excel.' },
                    { n: 3, x: 40, y: 24, w: 54, h: 66, label: 'Visor del reporte oficial con botón Expandir en la parte superior.' }
                ],
                tip: 'Usa "Consumo Detallado por Período" para facturación periódica de flotas mostrando placas, galones y productos despachados.'
            }
        ],
        troubleshooting: [
            { issue: 'No aparecen facturas pendientes al buscar un cliente en Abonos', fix: 'Confirma que las facturas se hayan emitido como Crédito (condición 2) en la misma sucursal seleccionada arriba.' },
            { issue: 'El sistema no me deja guardar un recibo por monto $0.00', fix: 'Marca la casilla o escribe el monto de abono dentro de la fila del documento pendiente en la tabla izquierda.' }
        ]
    },
    {
        slug: 'cuentas-por-pagar-proveedores',
        order: 17,
        category: 'finanzas',
        categoryLabel: 'Cuentas por Cobrar y Pagar',
        requiredModule: 'purchases',
        menuPath: 'Cuentas por Pagar → Consulta, Abonos y Reportes',
        title: 'Cuentas por Pagar: Consulta de Proveedores, Pagos y Saldos',
        summary: 'Monitorea deudas vigentes y vencidas con proveedores, registra egresos por abonos o liquidación total y genera reportes oficiales de CXP.',
        outcome: 'Evitar recargos por facturas de proveedores vencidas y respaldar cada pago realizado con su comprobante de egreso.',
        duration: '4 min',
        modulePath: '/cxp/estado-cuenta',
        roles: ['Jefe Tienda', 'Supervisor', 'Gerencia', 'Contador', 'Admin'],
        requiredPermissions: ['view_provider_statement', 'manage_cxp_payments', 'view_cxp_balances', 'view_cxp_pending_docs'],
        coverImage: 'cxp-statement.png',
        prerequisites: [
            'Tener registradas las compras al crédito en el módulo de Compras.'
        ],
        steps: [
            {
                title: 'Consultar el Estado de Cuenta y Antigüedad por Proveedor',
                description: 'Abre Cuentas por Pagar → Consulta de Proveedor. Elige la Sucursal y selecciona el Proveedor para revisar sus documentos en "ESTADO DE CUENTA" o su vencimiento por plazos en "ANTIGÜEDAD DE SALDOS", con exportación directa a Excel y PDF.',
                image: 'cxp-statement.png',
                annotations: [
                    { n: 1, x: 21.1, y: 24.5, w: 36.7, h: 4, label: 'Selector de Sucursal y buscador de proveedor para cargar su cartera.' },
                    { n: 2, x: 43.8, y: 34.6, w: 29.5, h: 4.1, label: 'Pestañas: "ESTADO DE CUENTA" y "ANTIGÜEDAD DE SALDOS".' },
                    { n: 3, x: 88.6, y: 11.4, w: 9.2, h: 4.5, label: 'Botones para Exportar Excel, Exportar PDF o Enviar detalle por correo al proveedor.' }
                ],
                tip: 'Revisa "ANTIGÜEDAD DE SALDOS" cada semana para priorizar las facturas próximas a vencer.'
            },
            {
                title: 'Registrar Abonos o Pagos a Proveedores',
                description: 'Ve a Cuentas por Pagar → Abonos / Pagos en la pestaña "NUEVO PAGO". Selecciona Sucursal y Proveedor, escribe el monto a pagar frente a cada factura pendiente, indica el método (Efectivo, Transferencia, Cheque, Tarjeta) y notas del comprobante, y haz clic en "CONFIRMAR EGRESO".',
                image: 'cxp-payments.png',
                annotations: [
                    { n: 1, x: 79.6, y: 12.1, w: 16.9, h: 3.6, label: 'Botones superiores para alternar entre "NUEVO PAGO" e "HISTORIAL" de egresos.' },
                    { n: 2, x: 19.5, y: 23.5, w: 57.5, h: 22, label: 'Selección de sucursal/proveedor y tabla de facturas por pagar.' },
                    { n: 3, x: 80.4, y: 62.5, w: 14.7, h: 31, label: 'Panel de cierre del pago: monto total, forma de pago, notas y "CONFIRMAR EGRESO".' }
                ],
                tip: 'Si pagaste con cheque o transferencia bancaria, anota el número de referencia en "NOTAS DE PAGO..." para facilitar la conciliación bancaria.'
            },
            {
                title: 'Emitir el reporte de Saldos de Proveedores',
                description: 'En Cuentas por Pagar → Reportes → Saldos de Proveedores (y Documentos por Pagar) elige la sucursal y fecha de corte y pulsa "GENERAR REPORTE" para descargar el consolidado en PDF o Excel.',
                image: 'cxp-balances-report.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31.4, w: 12.2, h: 12, label: 'Filtros laterales de sucursal y rango/corte de deuda.' },
                    { n: 2, x: 23.9, y: 76.1, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para obtener la vista previa PDF o Excel.' }
                ],
                tip: 'Cruza este reporte con tu Balance General al cierre contable de cada mes.'
            }
        ],
        troubleshooting: [
            { issue: 'Una compra al crédito pagada mediante Quedan sigue abierta en CXP', fix: 'Registra el pago correspondiente en Abonos / Pagos de CXP vinculando el número de cheque del Quedan.' },
            { issue: 'El botón CONFIRMAR EGRESO aparece inhabilitado', fix: 'Verifica haber digitado un monto mayor a cero en al menos una factura pendiente del proveedor.' }
        ]
    },
    {
        slug: 'contabilidad-partidas-contabilizar',
        order: 18,
        category: 'contabilidad',
        categoryLabel: 'Contabilidad e IVA',
        requiredModule: 'accounting',
        menuPath: 'Contabilidad → Catálogo, Partidas, Contabilizar y Auditoría',
        title: 'Contabilidad: Catálogo de Cuentas, Partidas, Contabilización y Auditoría',
        summary: 'Administra el catálogo contable, registra partidas manuales cuadradas, contabiliza en lote ventas/compras/turnos/bancos y ejecuta la Auditoría Contable con IA.',
        outcome: 'Mantener la contabilidad cuadrada, generar pólizas automáticas sin doble digitación y emitir estados financieros confiables.',
        duration: '6 min',
        modulePath: '/contabilidad/partidas',
        roles: ['Contador', 'Auditor', 'Admin'],
        requiredPermissions: ['manage_account_chart', 'manage_accounting_entries', 'manage_accounting_contabilizar_ventas_compras', 'manage_accounting_audit'],
        coverImage: 'accounting-entries.png',
        prerequisites: [
            'Tener configurados los correlativos de partidas y el mapeo de cuentas por defecto en Contabilidad → Ajustes.'
        ],
        steps: [
            {
                title: 'Administrar el Catálogo de Cuentas',
                description: 'En Contabilidad → Catálogo de Cuentas puedes buscar cuentas por código o nombre y pulsar "NUEVA CUENTA" para añadir rubros de Activo, Pasivo, Patrimonio, Ingresos, Costos o Gastos indicando su cuenta padre y si permite detalle (movimientos).',
                image: 'accounting-chart.png',
                annotations: [
                    { n: 1, x: 21.6, y: 24.1, w: 17.3, h: 4.8, label: 'Buscador instantáneo de cuentas contables por código o descripción.' },
                    { n: 2, x: 68.9, y: 24.2, w: 10.8, h: 4.5, label: 'Botón "NUEVA CUENTA" (junto a opciones de importación/exportación).' },
                    { n: 3, x: 21.7, y: 31.7, w: 72.9, h: 25, label: 'Árbol jerárquico: Código, Nombre, Tipo, Padre, si acepta Detalle y Estado.' }
                ],
                tip: 'Recuerda que solo las cuentas marcadas como "Detalle" pueden recibir movimientos dentro de una partida contable.'
            },
            {
                title: 'Crear, consultar e imprimir Partidas Contables',
                description: 'Entra a Contabilidad → Partidas Contables. Usa "NUEVA PARTIDA" para asientos manuales (verificando que Débito = Crédito) o busca cualquier asiento ya contabilizado. En Acciones puedes ver el detalle, imprimir la póliza PDF, editar o anular.',
                image: 'accounting-entries.png',
                annotations: [
                    { n: 1, x: 84.1, y: 14.8, w: 11.1, h: 4.5, label: 'Botón "NUEVA PARTIDA" para capturar manualmente un asiento contable.' },
                    { n: 2, x: 21.1, y: 22.3, w: 21.6, h: 4.8, label: 'Buscador por número de partida, descripción o tipo (Ingreso, Gasto, Diario).' },
                    { n: 3, x: 88.5, y: 32.5, w: 6.5, h: 12, label: 'Botones por partida: Ver, Imprimir póliza PDF, Editar o Anular.' }
                ],
                tip: 'Antes de anular o editar un mes pasado, verifica las fechas permitidas y correlativos en Contabilidad → Correlativos de Partidas.'
            },
            {
                title: 'Contabilizar automáticamente Ventas, Compras, CxC/CxP, Turnos y Bancos',
                description: 'En Contabilidad → Contabilizar elige el módulo ("VENTAS", "COMPRAS", "CxC/CxP", "Cierres de Turno" o "Bancos / Cheques"), selecciona el rango de fechas y pulsa "Calcular". El sistema propone las partidas con base en tus cuentas configuradas para que las revises y las contabilices en bloque.',
                image: 'accounting-generate.png',
                annotations: [
                    { n: 1, x: 26.1, y: 23, w: 13.4, h: 4, label: 'Selector del flujo a contabilizar (Ventas / Compras u otros submenús).' },
                    { n: 2, x: 28.9, y: 46.4, w: 18.6, h: 3.7, label: 'Enlace directo a "CONFIGURAR EN CUENTAS POR DEFECTO" si falta mapear alguna cuenta.' },
                    { n: 3, x: 81.8, y: 60, w: 8.4, h: 4.5, label: 'Botón "Calcular" para generar la previsualización contable antes de guardar.' }
                ],
                tip: 'Si falta mapear una cuenta (ej. IVA Débito o Combustible), el aviso en pantalla te lleva directo a configurarla sin perder tu trabajo.'
            },
            {
                title: 'Ejecutar la Auditoría Contable y Dictamen Inteligente',
                description: 'Antes de emitir estados financieros o cerrar el mes, ingresa a Contabilidad → Auditoría Contable. Presiona "Actualizar" o "Ejecutar Dictamen IA" para detectar partidas descuadradas, cuentas huérfanas o saltos, y exporta el diagnóstico a Excel si necesitas revisión.',
                image: 'accounting-audit.png',
                annotations: [
                    { n: 1, x: 79.2, y: 14.7, w: 16, h: 3.9, label: 'Botones "Actualizar" datos y "Exportar Excel" del hallazgo contable.' },
                    { n: 2, x: 21.1, y: 42, w: 36.8, h: 4.8, label: 'Pestañas: Diagnóstico Inteligente, Catálogo de Cuentas y Partidas Contables.' },
                    { n: 3, x: 80, y: 56.2, w: 13.6, h: 5, label: 'Botón "Ejecutar Dictamen IA" para generar el análisis ejecutivo automático.' }
                ],
                tip: 'Una auditoría en estado "Limpio / Favorable" indica que tus balances de Comprobación, Estado de Resultados y Balance General están listos.'
            }
        ],
        troubleshooting: [
            { issue: 'El botón Calcular en Contabilizar indica cuentas sin asignar', fix: 'Haz clic en "CONFIGURAR EN CUENTAS POR DEFECTO", asigna las cuentas contables faltantes de venta, compra, caja o IVA y vuelve a Calcular.' },
            { issue: 'No puedo guardar una partida manual', fix: 'Confirma que la suma de Débitos sea exactamente igual a la suma de Créditos y que todas las líneas usen cuentas de detalle.' }
        ]
    },
    {
        slug: 'libros-iva-declaraciones',
        order: 19,
        category: 'contabilidad',
        categoryLabel: 'Contabilidad e IVA',
        requiredModule: 'accounting',
        menuPath: 'Libros de IVA → Compras, Ventas, Anexos y Liquidación',
        title: 'Libros de IVA, Anexos DTE y Liquidación Mensual (F-07 / Pago a Cuenta)',
        summary: 'Genera los libros legales de Compras, Contribuyentes y Consumidor Final, exporta anexos en formato oficial de Hacienda y calcula tu declaración mensual F-07.',
        outcome: 'Preparar cada mes los Libros de IVA, Anexos en Excel/CSV y el borrador cuadrado de Liquidación IVA y Pago a Cuenta.',
        duration: '5 min',
        modulePath: '/iva/compras',
        roles: ['Auxiliar', 'Auditor', 'Contador', 'Admin'],
        requiredPermissions: ['view_purchase_ledger', 'view_ccf_sales_ledger', 'view_fac_sales_ledger', 'view_iva_anexos', 'view_vat_liquidation'],
        coverImage: 'iva-purchases.png',
        prerequisites: [
            'Haber cerrado o validado las compras/gastos del mes y verificado que todos los DTE de venta estén aceptados por Hacienda.'
        ],
        steps: [
            {
                title: 'Generar Libros Legales de IVA (Compras, CCF y Consumidor)',
                description: 'En Libros de IVA elige "Libro de Compras", "Ventas a Contribuyentes" o "Ventas a Consumidor". Elige si lo generarás consolidado "Por Contribuyente (Todas las sucursales)" o solo "Por Sucursal Actual", selecciona Mes, Año y número de folio inicial y presiona "GENERAR REPORTE".',
                image: 'iva-purchases.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31.8, w: 12.2, h: 16, label: 'Modo Consolidado por Contribuyente o por Sucursal Actual + selector de alcance.' },
                    { n: 2, x: 23.9, y: 53.2, w: 12.2, h: 25.5, label: 'Filtros de Mes, Año y número de folio de inicio de impresión.' },
                    { n: 3, x: 23.9, y: 85.1, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para previsualizar el libro legal en PDF o exportar a Excel.' }
                ],
                tip: 'Usa siempre el modo "Por Contribuyente" cuando presentes la declaración unificada de la empresa con varias estaciones o sucursales.'
            },
            {
                title: 'Revisar y exportar Anexos de IVA Ventas y Compras',
                description: 'Abre Libros de IVA → Anexo de IVA Ventas (o Anexo de IVA Compras). Puedes filtrar por Tipo de DTE, sucursal o contribuyente, verificar los 3 códigos oficiales (Código de Generación, N° Control y Sello MH) y pulsar "Exportar Excel" para cargar los anexos.',
                image: 'iva-anexos.png',
                annotations: [
                    { n: 1, x: 76.6, y: 14.9, w: 18.6, h: 3.6, label: 'Botones "Exportar PDF" y "Exportar Excel" listos para revisión o carga tributaria.' },
                    { n: 2, x: 65, y: 24.7, w: 28.5, h: 3.2, label: 'Alternador rápido entre vista Consolidada ("Por Contribuyente") o Sucursal actual.' },
                    { n: 3, x: 22.5, y: 34.9, w: 71.3, h: 4.1, label: 'Filtros por sucursal, tipo de DTE, correlativo y buscador por cliente/NIT/NRC.' }
                ],
                tip: 'Revisa que ningún DTE del mes figure en estado Rechazado o Pendiente antes de descargar el Excel definitivo del anexo.'
            },
            {
                title: 'Calcular la Liquidación Mensual de IVA y Pago a Cuenta',
                description: 'Ingresa a Libros de IVA → Liquidación IVA y Pago a Cuenta. Selecciona Año, Mes y el modo consolidado ("Por Contribuyente"), pulsa "Actualizar Datos" y revisa los débitos, créditos, remanente anterior y porcentajes desde "Ajustar Parámetros" o "Formularios Hacienda".',
                image: 'iva-liquidation.png',
                annotations: [
                    { n: 1, x: 57, y: 16.5, w: 32.8, h: 8.6, label: 'Botones "Formularios Hacienda", "Ajustar Parámetros", "Exportar PDF" y "Exportar Excel".' },
                    { n: 2, x: 22.2, y: 42.3, w: 72.9, h: 4.3, label: 'Filtros de Año, Mes, Consolidado/Sucursal y botón "Actualizar Datos".' }
                ],
                tip: 'Si traes remanente de crédito fiscal del mes pasado, verifícalo en "Ajustar Parámetros" para que cuadre el monto final a pagar o nuevo remanente.'
            }
        ],
        troubleshooting: [
            { issue: 'Una compra del mes no aparece en el Libro de Compras', fix: 'Confirma que su período tributario en Compras corresponda al mes consultado y que el tipo de documento sea gravado/contribuyente (no recibo simple).' },
            { issue: 'La suma de Anexos de IVA no coincide con el Libro de Ventas', fix: 'Revisa si hay DTEs rechazados o anulados en Historial de Ventas que deban excluirse o solventarse.' }
        ]
    },
    {
        slug: 'contabilidad-cierre-estados-financieros',
        order: 35,
        category: 'contabilidad',
        categoryLabel: 'Contabilidad y Fiscal',
        requiredModule: 'accounting',
        menuPath: 'Contabilidad → Correlativos, Ajustes, Reportes Financieros y Cierre Anual',
        title: 'Contabilidad: Correlativos, Configuraciones, Balance y Cierre Anual',
        summary: 'Controla la numeración mensual de partidas, define cuentas contables por defecto y conexión oficina, emite Balance General / Estado de Resultados y ejecuta el Cierre Anual.',
        outcome: 'Emitir estados financieros oficiales en PDF o Excel con correlativos ordenados y realizar el cierre contable de fin de año sin descuadres.',
        duration: '6 min',
        modulePath: '/contabilidad/cierre',
        roles: ['Contador', 'Auxiliar', 'Auditor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_accounting_correlativos', 'manage_accounting_adjustments', 'view_accounting_balance_general', 'view_accounting_estado_resultados', 'manage_annual_close', 'manage_fiscal_year_open'],
        coverImage: 'acc-cierre-anual.png',
        prerequisites: [
            'Tener cargado el Catálogo de Cuentas y contabilizadas las partidas mensuales del ejercicio.'
        ],
        steps: [
            {
                title: 'Controlar Correlativos Mensuales por Tipo de Partida',
                description: 'En Contabilidad → Correlativos de Partidas elige el tipo de partida (Diario, Ingreso, Egreso, Ajuste, Apertura) y define o ajusta el próximo número por mes con "GUARDAR". Así mantienes consecutiva la numeración contable todo el año.',
                image: 'acc-correlativos.png',
                annotations: [
                    { n: 1, x: 31.5, y: 29.3, w: 26.1, h: 4.4, label: 'Selector del Tipo de Partida contable cuyo correlativo mensual deseas revisar o inicializar.' },
                    { n: 2, x: 76.9, y: 40.8, w: 8, h: 3.7, label: 'Botón "GUARDAR" para fijar los correlativos modificados.' },
                    { n: 3, x: 30.1, y: 46.4, w: 56.1, h: 50, label: 'Tabla de los 12 meses mostrando Próximo Número, Último Usado, Partidas emitidas y Estado.' }
                ],
                tip: 'Revisa los correlativos al iniciar cada ejercicio fiscal antes de generar la partida de apertura o las pólizas automáticas de enero.'
            },
            {
                title: 'Configurar Cuentas por Defecto, Auxiliares y Conexión Oficina',
                description: 'Abre Contabilidad → Configuraciones de Contabilidad. En sus pestañas ("GENERAL", "CUENTAS POR DEFECTO", "CUENTAS AUXILIARES", "CONEXIÓN OFICINA") vincula cuentas de IVA débito/crédito, caja, bancos y resultados para automatizar los asientos y pulsa "GUARDAR CONFIGURACIÓN".',
                image: 'acc-ajustes.png',
                annotations: [
                    { n: 1, x: 26.5, y: 24.7, w: 52.6, h: 4.1, label: 'Pestañas de configuración: General, Cuentas por Defecto, Cuentas Auxiliares y Conexión Oficina.' },
                    { n: 2, x: 27.9, y: 40.9, w: 61.5, h: 39.6, label: 'Parámetros fiscales, cuentas contables mapeadas y botón "GUARDAR CONFIGURACIÓN".' }
                ],
                tip: 'Una vez mapeadas las cuentas en "CUENTAS POR DEFECTO", las pólizas de ventas y compras toman automáticamente cada rubro sin digitación manual.'
            },
            {
                title: 'Generar Balance General y Estado de Resultados',
                description: 'Ve a Contabilidad → Balance General (o Estado de Resultados / Balanza de Comprobación). Selecciona el Mes de corte, el Nivel de detalle de cuentas y el Formato (PDF o Excel) y haz clic en "GENERAR REPORTE" para obtener la vista previa oficial.',
                image: 'acc-balance-general.png',
                annotations: [
                    { n: 1, x: 23.5, y: 41, w: 13, h: 42, label: 'Panel izquierdo de parámetros: Mes, Nivel de agrupación, Formato y botón "GENERAR REPORTE".' },
                    { n: 2, x: 40, y: 24, w: 54, h: 66, label: 'Visor del estado financiero generado listo para imprimir o descargar en PDF/Excel.' }
                ],
                tip: 'Usa nivel 4 o superior cuando necesites validar subcuentas detalladas de bancos o inventarios, y nivel 2 o 3 para resúmenes gerenciales.'
            },
            {
                title: 'Ejecutar el Cierre Contable Anual y Apertura de Ejercicio',
                description: 'Al finalizar el año entra a Contabilidad → Cierre Contable Anual (y luego a Apertura Año Fiscal). Verifica el Año Fiscal y Fecha de Cierre arriba, revisa en el cuadro central el saldo de las Cuentas de Resultado (Ingresos, Costos y Gastos) y la utilidad calculada a la derecha, y presiona "GENERAR PARTIDA DE CIERRE".',
                image: 'acc-cierre-anual.png',
                annotations: [
                    { n: 1, x: 25.8, y: 25, w: 63.5, h: 13, label: 'Encabezado de Año Fiscal y Fecha de Cierre contable.' },
                    { n: 2, x: 25.8, y: 40.6, w: 44.7, h: 55, label: 'Resumen automático de saldos en Cuentas de Resultado acumuladas en el año.' },
                    { n: 3, x: 71.5, y: 40.6, w: 19.5, h: 31, label: 'Panel "RESULTADO DEL EJERCICIO" con utilidad/pérdida neta y botón "GENERAR PARTIDA DE CIERRE".' }
                ],
                tip: 'Antes de pulsar "GENERAR PARTIDA DE CIERRE", confirma en Mayor y Balanza que todas las partidas de diciembre estén contabilizadas (estado Mayorizada).'
            }
        ],
        troubleshooting: [
            { issue: 'El Balance General no cuadra (Activo distinto de Pasivo + Capital)', fix: 'Verifica si existen partidas en borrador sin mayorizar en ese mes o si falta generar la partida de cierre de resultado.' },
            { issue: 'No puedo crear partidas automáticas en un mes nuevo', fix: 'Revisa en Contabilidad → Correlativos de Partidas que el mes esté habilitado y en Contabilidad → Configuraciones de Contabilidad que las cuentas por defecto sigan asignadas.' }
        ]
    }
];

module.exports = FINANZAS_CONTABILIDAD_TUTORIALS;
