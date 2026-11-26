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
        menuPath: 'Contabilidad → Catálogo de Cuentas, Partidas Contables y Auditoría Contable',
        title: 'Contabilidad Base: Catálogo de Cuentas, Partidas Manuales y Auditoría IA',
        summary: 'Administra el catálogo jerárquico de cuentas, registra partidas manuales cuadradas, lanza contabilización automática de pólizas (ampliada en #41) y ejecuta Auditoría Contable con IA.',
        outcome: 'Mantener el catálogo contable ordenado, capturar asientos manuales sin errores y detectar partidas descuadradas o faltantes con Auditoría IA.',
        duration: '6 min',
        modulePath: '/contabilidad/partidas',
        roles: ['Contador', 'Auditor', 'Admin'],
        requiredPermissions: ['manage_account_chart', 'manage_accounting_entries', 'manage_accounting_contabilizar_ventas_compras', 'manage_accounting_audit'],
        coverImage: 'accounting-entries.png',
        prerequisites: [
            'Tener configurados los correlativos de partidas y el mapeo de cuentas por defecto en Contabilidad → Ajustes (ver guía #35).'
        ],
        steps: [
            {
                title: 'Administrar el Catálogo de Cuentas Contables',
                description: 'En Contabilidad → Catálogo de Cuentas busca por código o nombre y pulsa "NUEVA CUENTA" para añadir rubros de Activo, Pasivo, Patrimonio, Ingresos, Costos o Gastos indicando su cuenta padre y si permite detalle (movimientos).',
                image: 'accounting-chart.png',
                annotations: [
                    { n: 1, x: 21.6, y: 24.1, w: 17.3, h: 4.8, label: 'Buscador instantáneo de cuentas contables por código o descripción.' },
                    { n: 2, x: 68.9, y: 24.2, w: 10.8, h: 4.5, label: 'Botón "NUEVA CUENTA" (junto a importación/exportación de catálogo).' },
                    { n: 3, x: 21.7, y: 31.7, w: 72.9, h: 25, label: 'Árbol jerárquico: Código, Nombre, Tipo, Padre, si acepta Detalle y Estado.' }
                ],
                tip: 'Solo las cuentas marcadas como "Detalle" pueden recibir movimientos dentro de una partida contable; las cuentas padre totalizan automáticamente.'
            },
            {
                title: 'Crear, consultar e imprimir Partidas Contables Manuales',
                description: 'Entra a Contabilidad → Partidas Contables. Usa "NUEVA PARTIDA" para asientos manuales o ajustes (verificando Débito = Crédito) o filtra cualquier póliza ya contabilizada para ver su detalle, imprimir el comprobante PDF, editar o anular.',
                image: 'accounting-entries.png',
                annotations: [
                    { n: 1, x: 84.1, y: 14.8, w: 11.1, h: 4.5, label: 'Botón "NUEVA PARTIDA" para capturar manualmente un asiento contable.' },
                    { n: 2, x: 21.1, y: 22.3, w: 21.6, h: 4.8, label: 'Buscador por número de partida, descripción o tipo (Diario, Ingreso, Gasto, Ajuste).' },
                    { n: 3, x: 88.5, y: 32.5, w: 6.5, h: 12, label: 'Botones por partida: Ver detalle, Imprimir póliza PDF, Editar o Anular.' }
                ],
                tip: 'Antes de modificar un mes cerrado revisa tus numeraciones en Correlativos de Partidas (#35). Para contabilizar automáticamente Ventas, CxC, Turnos y Bancos consulta #41.'
            },
            {
                title: 'Previsualizar Contabilización Automática desde Ventas y Compras',
                description: 'En Contabilidad → Contabilizar → Ventas/Compras eliges "VENTAS" o "COMPRAS", seleccionas el período y pulsas "Calcular" para generar la propuesta contable. Si deseas conocer los 4 motores completos (CxC/CxP, Cierres de Turno y Bancos/Cheques), abre la guía #41.',
                image: 'accounting-generate.png',
                annotations: [
                    { n: 1, x: 26.1, y: 23, w: 13.4, h: 4, label: 'Selector del flujo a contabilizar (Ventas / Compras).' },
                    { n: 2, x: 28.9, y: 46.4, w: 18.6, h: 3.7, label: 'Enlace directo a "CONFIGURAR EN CUENTAS POR DEFECTO" si falta mapear alguna cuenta.' },
                    { n: 3, x: 81.8, y: 60, w: 8.4, h: 4.5, label: 'Botón "Calcular" para generar la previsualización contable antes de guardar.' }
                ],
                tip: 'Cada motor valida cuentas faltantes y evita duplicar partidas ya contabilizadas en el mismo rango.'
            },
            {
                title: 'Ejecutar la Auditoría Contable y Dictamen Inteligente IA',
                description: 'Antes de emitir estados financieros (#43) o cerrar ejercicio (#35), ingresa a Contabilidad → Auditoría Contable. Presiona "Actualizar" o "Ejecutar Dictamen IA" para detectar partidas descuadradas, cuentas huérfanas o saltos, y exporta los hallazgos a Excel.',
                image: 'accounting-audit.png',
                annotations: [
                    { n: 1, x: 79.2, y: 14.7, w: 16, h: 3.9, label: 'Botones "Actualizar" datos y "Exportar Excel" del hallazgo contable.' },
                    { n: 2, x: 21.1, y: 42, w: 36.8, h: 4.8, label: 'Pestañas: Diagnóstico Inteligente, Catálogo de Cuentas y Partidas Contables.' },
                    { n: 3, x: 80, y: 56.2, w: 13.6, h: 5, label: 'Botón "Ejecutar Dictamen IA" para generar el análisis ejecutivo automático.' }
                ],
                tip: 'Una auditoría limpia certifica que tus Libros Legales (#42) y Estados Financieros (#43) cerrarán sin descuadres.'
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
        menuPath: 'Libros de IVA → Compras, Ventas (CCF / Consumidor), Anexos Compras/Ventas y Liquidación',
        title: 'Libros de IVA Completos, Anexos (Compras / Ventas) y Liquidación F-07',
        summary: 'Genera los tres Libros legales de IVA (Compras, Contribuyentes CCF y Consumidor Final FAC), revisa los Anexos de IVA Compras y Ventas (DTE/Retenciones) y calcula la Liquidación F-07.',
        outcome: 'Preparar cada mes todos los libros legales y archivos Excel/CSV de Hacienda F-07, Retenciones 1% y Pago a Cuenta sin inconsistencias.',
        duration: '6 min',
        modulePath: '/iva/compras',
        roles: ['Auxiliar', 'Auditor', 'Contador', 'Admin'],
        requiredPermissions: ['view_purchase_ledger', 'view_ccf_sales_ledger', 'view_fac_sales_ledger', 'view_iva_anexos', 'view_iva_declaraciones', 'view_vat_liquidation'],
        coverImage: 'iva-purchases.png',
        prerequisites: [
            'Haber validado las compras del período y confirmado que los DTE de venta estén aceptados o resueltos.'
        ],
        steps: [
            {
                title: 'Generar el Libro de Compras (Por Contribuyente o Sucursal)',
                description: 'En Libros de IVA → Libro de Compras elige "Por Contribuyente (Todas las sucursales)" cuando presentes una sola declaración jurídica o "Por Sucursal Actual" para revisión individual. Elige Mes, Año y número de folio inicial y presiona "GENERAR REPORTE".',
                image: 'iva-purchases.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31.8, w: 12.2, h: 16, label: 'Selector de alcance: Por Contribuyente (consolidado) o Por Sucursal Actual.' },
                    { n: 2, x: 23.9, y: 53.2, w: 12.2, h: 25.5, label: 'Filtros de Mes, Año y número de folio de inicio legal.' },
                    { n: 3, x: 23.9, y: 85.1, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para previsualizar en PDF o exportar Excel.' }
                ],
                tip: 'Las notas de crédito de compra y comprobantes excluidos aparecen separados automáticamente en su columna normativa.'
            },
            {
                title: 'Generar Libro de Ventas a Contribuyentes (CCF) y Consumidor Final (FAC)',
                description: 'Abre Libros de IVA → Ventas a Contribuyentes (DTE 03 / NC 05) y Libros de IVA → Ventas a Consumidor (DTE 01 y Exportación 11). En ambos puedes emitir el reporte consolidado por Contribuyente o por Sucursal en PDF/Excel cuidando el folio inicial consecutivo.',
                image: 'iva-ventas-ccf.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31.8, w: 12.2, h: 16, label: 'Modo Contribuyente vs Sucursal en Ventas a Contribuyentes (CCF) y Consumidor (FAC).' },
                    { n: 2, x: 23.9, y: 53.2, w: 12.2, h: 25.5, label: 'Selección de Mes, Año y folio inicial para continuar la foliación legal.' },
                    { n: 3, x: 23.9, y: 85.1, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" (también disponible idéntico en Ventas a Consumidor Final).' }
                ],
                tip: 'Verifica en Libro de Ventas a Consumidor que los rangos diarios de códigos de generación coincidan con los cierres del mes.'
            },
            {
                title: 'Revisar Anexo de IVA Compras, Retenciones 1% y Anticipo 2%',
                description: 'Entra a Libros de IVA → Anexo de IVA Compras. Usa sus 5 pestañas ("Compras", "Anticipo 2% (Tarjetas)", "Retenciones Emitidas (1%)", "Retenciones Recibidas (1%)" y "Percepciones (1%)") filtrando por Año, Mes y Sucursal, y exporta a PDF o Excel.',
                image: 'iva-declaraciones.png',
                annotations: [
                    { n: 1, x: 21.1, y: 22.3, w: 65.1, h: 4.7, label: '5 anexos fiscales: Compras, Anticipo 2% Tarjetas, Retenciones 1% y Percepciones 1%.' },
                    { n: 2, x: 26.3, y: 32, w: 69.2, h: 4.1, label: 'Filtros de Año, Mes, Sucursal Consolidada/Individual, buscador y Exportar PDF/Excel.' },
                    { n: 3, x: 21.1, y: 50.9, w: 75, h: 11.4, label: 'Detalle auditable con código de generación, NIT, NRC, gravadas, exentas, IVA y retención.' }
                ],
                tip: 'Revisa las 5 pestañas antes de cerrar F-07 para no omitir retenciones de tarjetas de crédito o percepciones del 1%.'
            },
            {
                title: 'Revisar Anexo de IVA Ventas DTE y calcular Liquidación F-07',
                description: 'En Libros de IVA → Anexo de IVA Ventas filtra por Tipo de DTE o Contribuyente y exporta el Excel listo para Hacienda. Luego en Libros de IVA → Liquidación IVA y Pago a Cuenta presiona "Actualizar Datos", verifica el remanente en "Ajustar Parámetros" y revisa los totales en "Formularios Hacienda".',
                image: 'iva-anexos.png',
                annotations: [
                    { n: 1, x: 76.6, y: 14.9, w: 18.6, h: 3.6, label: 'Botones "Exportar PDF" y "Exportar Excel" del Anexo de Ventas DTE.' },
                    { n: 2, x: 65, y: 24.7, w: 28.5, h: 3.2, label: 'Alternador entre vista Consolidada ("Por Contribuyente") o Sucursal actual.' },
                    { n: 3, x: 22.5, y: 34.9, w: 71.3, h: 4.1, label: 'Filtros por sucursal, tipo de DTE, correlativo y buscador por cliente/NIT/NRC.' }
                ],
                tip: 'Desde Liquidación IVA y Pago a Cuenta el botón "Formularios Hacienda" resume casilla por casilla tu F-07 mensual y Pago a Cuenta.'
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
        categoryLabel: 'Contabilidad e IVA',
        requiredModule: 'accounting',
        menuPath: 'Contabilidad → Correlativos, Ajustes, Cierre Anual y Apertura de Ejercicio',
        title: 'Contabilidad: Correlativos, Configuraciones, Cierre Anual y Apertura de Ejercicio',
        summary: 'Controla la numeración mensual de partidas, define cuentas contables por defecto y conexión oficina, ejecuta el Cierre Anual de resultados y genera la Partida de Apertura del nuevo año.',
        outcome: 'Mantener correlativos ordenados todo el año, automatizar pólizas con las cuentas mapeadas y cerrar un año fiscal abriendo el siguiente sin descuadres.',
        duration: '6 min',
        modulePath: '/contabilidad/cierre',
        roles: ['Contador', 'Auxiliar', 'Auditor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_accounting_correlativos', 'manage_accounting_adjustments', 'manage_annual_close', 'manage_fiscal_year_open'],
        coverImage: 'acc-cierre-anual.png',
        prerequisites: [
            'Tener cargado el Catálogo de Cuentas y contabilizadas/mayorizadas todas las partidas del período (ver #42 y #43 para reportes).'
        ],
        steps: [
            {
                title: 'Controlar Correlativos Mensuales por Tipo de Partida',
                description: 'En Contabilidad → Correlativos de Partidas elige el tipo de partida (Diario, Ingreso, Egreso, Ajuste, Apertura) y define o ajusta el próximo número por mes con "GUARDAR". Así mantienes consecutiva la numeración contable durante todo el ejercicio.',
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
                description: 'Abre Contabilidad → Ajustes. En sus 4 pestañas ("GENERAL", "CUENTAS POR DEFECTO", "CUENTAS AUXILIARES", "CONEXIÓN OFICINA") mapeas cuentas de IVA débito/crédito, caja, bancos, clientes, proveedores y utilidad para automatizar las pólizas y pulsas "GUARDAR CONFIGURACIÓN".',
                image: 'acc-ajustes.png',
                annotations: [
                    { n: 1, x: 26.5, y: 24.7, w: 52.6, h: 4.1, label: 'Pestañas: General, Cuentas por Defecto, Cuentas Auxiliares y Conexión Oficina.' },
                    { n: 2, x: 27.9, y: 40.9, w: 61.5, h: 39.6, label: 'Mapeo de cuentas contables automáticas y botón "GUARDAR CONFIGURACIÓN".' }
                ],
                tip: 'Al dejar configurada "CONEXIÓN OFICINA", el motor Contabilizar → Bancos / Cheques (#41) descarga cheques y movimientos automáticamente.'
            },
            {
                title: 'Ejecutar el Cierre Contable Anual (Liquidación de Resultados)',
                description: 'Al finalizar diciembre entra a Contabilidad → Cierre Anual. Verifica Año Fiscal y Fecha de Cierre arriba, revisa en la tabla central el saldo acumulado de las Cuentas de Resultado (Ingresos, Costos y Gastos) y la utilidad/pérdida calculada a la derecha, y presiona "GENERAR PARTIDA DE CIERRE".',
                image: 'acc-cierre-anual.png',
                annotations: [
                    { n: 1, x: 25.8, y: 25, w: 63.5, h: 13, label: 'Encabezado de Año Fiscal y Fecha de Cierre contable al 31 de diciembre.' },
                    { n: 2, x: 25.8, y: 40.6, w: 44.7, h: 55, label: 'Resumen automático de saldos en Cuentas de Resultado que quedarán liquidadas a cero.' },
                    { n: 3, x: 71.5, y: 40.6, w: 19.5, h: 31, label: 'Panel "RESULTADO DEL EJERCICIO" con utilidad neta y botón "GENERAR PARTIDA DE CIERRE".' }
                ],
                tip: 'Confirma previamente en Auditoría Contable (#18) y Balance de Comprobación (#43) que todas las partidas de diciembre estén mayorizadas.'
            },
            {
                title: 'Generar la Partida de Apertura de Nuevo Ejercicio Fiscal',
                description: 'Una vez cerrado el año anterior entra a Contabilidad → Apertura de Ejercicio. Selecciona el Nuevo Año (ej. 2027) y Fecha de Apertura (01/01/2027), valida en la tabla los Saldos de Balance trasladados (Activo vs Pasivo + Patrimonio a la derecha) y haz clic en "GENERAR PARTIDA DE APERTURA".',
                image: 'acc-apertura-anio.png',
                annotations: [
                    { n: 1, x: 25.8, y: 25, w: 65, h: 13, label: 'Nuevo Año fiscal a inicializar y Fecha de Apertura (ej. 01/01/2027).' },
                    { n: 2, x: 25.8, y: 40.6, w: 44.7, h: 57, label: 'Tabla de Saldos de Balance trasladados del año anterior por cuenta contable.' },
                    { n: 3, x: 72.5, y: 40.6, w: 17.5, h: 42, label: 'Cuadre Total Activo vs Pasivo + Patrimonio, descripción y botón "GENERAR PARTIDA DE APERTURA".' }
                ],
                tip: 'Verifica que Total Activo coincida exactamente con Total Pasivo + Patrimonio antes de pulsar "GENERAR PARTIDA DE APERTURA".'
            }
        ],
        troubleshooting: [
            { issue: 'En Apertura de Ejercicio el Total Activo difiere de Pasivo + Patrimonio', fix: 'Falta ejecutar o mayorizar el Cierre Anual del ejercicio previo para trasladar el Resultado del Ejercicio al Patrimonio.' },
            { issue: 'No puedo crear partidas automáticas en un mes nuevo', fix: 'Revisa en Contabilidad → Correlativos de Partidas que el mes esté habilitado y en Contabilidad → Ajustes que las cuentas por defecto sigan asignadas.' }
        ]
    }
];

module.exports = FINANZAS_CONTABILIDAD_TUTORIALS;
