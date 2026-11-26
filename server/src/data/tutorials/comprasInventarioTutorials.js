/**
 * Tutoriales Fase 2: Compras, Gastos e Inventario (#12 - #15)
 */

const COMPRAS_INVENTARIO_TUTORIALS = [
    {
        slug: 'gestion-compras-proveedores',
        order: 12,
        category: 'compras',
        categoryLabel: 'Compras y Gastos',
        requiredModule: 'purchases',
        menuPath: 'Catálogos → Proveedores y Compras',
        title: 'Proveedores, Período de Compras e Ingreso de Compras (DTE / Manual)',
        summary: 'Da de alta proveedores fiscales, fija el mes/año tributario activo, importa facturas DTE de compra automáticamente o digítalas ingresando costo y stock al Kardex.',
        outcome: 'Registrar facturas y Créditos Fiscales de compra validados para que actualicen existencias, costo promedio e IVA Compras.',
        duration: '5 min',
        modulePath: '/compras',
        roles: ['Jefe Tienda', 'Jefe Pista', 'Auxiliar', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_purchases_list', 'manage_purchase_period'],
        coverImage: 'purchases-list.png',
        prerequisites: [
            'Tener definido el Período de Compras activo (Mes y Año tributario) en Compras → Periodo de Compras.',
            'Contar con el archivo JSON DTE del proveedor o su factura física con NIT, NRC y Código de Generación.'
        ],
        steps: [
            {
                title: 'Crear o actualizar Proveedores en el catálogo',
                description: 'En Catálogos → Proveedores verifica si el suplidor existe usando el buscador por nombre, NIT o NRC. Si es nuevo, pulsa "Nuevo Proveedor" para ingresar Razón Social, NIT, NRC, Dirección y Giro, garantizando así un Libro de Compras limpio.',
                image: 'providers-list.png',
                annotations: [
                    { n: 1, x: 85, y: 11.6, w: 11.8, h: 3.6, label: 'Botón "Nuevo Proveedor" para registrar un suplidor comercial o de servicios.' },
                    { n: 2, x: 19.5, y: 17.4, w: 26, h: 3.4, label: 'Buscador instantáneo por nombre, NIT, DUI o NRC.' },
                    { n: 3, x: 86.6, y: 17.3, w: 10.2, h: 3.6, label: 'Botones "EXCEL" y "PDF" para exportar el catálogo completo de proveedores.' },
                    { n: 4, x: 91.5, y: 28, w: 4, h: 7, label: 'Acciones por fila: Editar información fiscal o Eliminar si no tiene documentos.' }
                ],
                tip: 'Si vas a usar la carga automática de DTE JSON de compra, el proveedor también puede crearse automáticamente desde el documento si aún no existe.'
            },
            {
                title: 'Configurar el Período Tributario de Compras',
                description: 'Antes de registrar facturas de un mes nuevo, ingresa a Compras → Periodo de Compras, selecciona el Año y el Mes tributario correspondiente (por ejemplo "11 - NOVIEMBRE") y pulsa "GUARDAR". Todas las nuevas compras y gastos quedarán asignados a ese período fiscal.',
                image: 'purchase-period.png',
                annotations: [
                    { n: 1, x: 45.7, y: 28.9, w: 26, h: 5.5, label: 'Selectores de Año y Mes tributario que regirán el Libro de Compras.' },
                    { n: 2, x: 59.1, y: 40.9, w: 12.5, h: 5.5, label: 'Botón "GUARDAR" para activar el nuevo período operativo de compras.' }
                ],
                tip: 'Si necesitas registrar una factura rezagada (dentro de los 3 meses permitidos por ley), verifica el período activo antes de guardarla.'
            },
            {
                title: 'Importar JSON DTE o registrar una Nueva Compra al inventario',
                description: 'En Compras → Gestión de Compras tienes dos caminos: 1) Botón "IMPORTAR DTE" para cargar el archivo JSON enviado por tu proveedor y ahorrar digitación; 2) "+ NUEVA COMPRA" para elegir proveedor, sucursal de destino, tipo de documento (CCF 03, Factura 01 o Sujeto Excluido 14) y agregar ítems vinculados al inventario.',
                image: 'purchases-list.png',
                annotations: [
                    { n: 1, x: 78.1, y: 11.2, w: 8.9, h: 3.8, label: 'Botón "IMPORTAR DTE" para leer automáticamente el JSON del proveedor.' },
                    { n: 2, x: 87.6, y: 11.2, w: 10.3, h: 3.7, label: 'Botón "+ NUEVA COMPRA" para abrir el formulario de registro manual o mixto.' },
                    { n: 3, x: 20.3, y: 18.9, w: 65.6, h: 3.1, label: 'Buscador por número de control, UUID, factura o nombre de proveedor.' },
                    { n: 4, x: 88.5, y: 29, w: 8, h: 4, label: 'Acciones: Ver detalle, Editar compra, Descargar PDF o Anular.' }
                ],
                tip: 'Si un producto del proveedor aún no está vinculado a tu catálogo, vincúlalo al momento de guardar; si queda sin código interno solo se registrará contablemente y no sumará stock al Kardex.'
            }
        ],
        troubleshooting: [
            { issue: 'Las existencias no subieron tras guardar la compra', fix: 'Revisa el detalle de la compra y verifica que cada ítem esté vinculado a un producto activo del catálogo (y no solo como texto libre).' },
            { issue: 'Una compra apareció en el mes incorrecto del Libro de IVA', fix: 'Verifica el período seleccionado en Compras → Periodo de Compras y edita el período tributario de esa compra si corresponde.' }
        ]
    },
    {
        slug: 'gastos-quedanes-cheques',
        order: 13,
        category: 'compras',
        categoryLabel: 'Compras y Gastos',
        requiredModule: 'purchases',
        menuPath: 'Compras → Gastos Operativos / Quedan / Cheques',
        title: 'Gastos Operativos (con Escáner IA), Quedan y Cheques de Contado',
        summary: 'Registra recibos y facturas de gastos operativos usando escáner QR/IA, programa pagos con Quedan a proveedores y lleva control de Cheques de Contado emitidos.',
        outcome: 'Mantener ordenados los gastos deducibles de IVA y documentar cuándo se recibe y entrega cada Quedan o cheque a proveedores.',
        duration: '5 min',
        modulePath: '/compras/gastos',
        roles: ['Jefe Tienda', 'Jefe Pista', 'Auxiliar', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_expenses', 'manage_purchase_quedan', 'manage_purchase_checks'],
        coverImage: 'expenses-list.png',
        prerequisites: [
            'Contar con el comprobante o DTE del gasto, o con las compras al crédito registradas para agruparlas en un Quedan.'
        ],
        steps: [
            {
                title: 'Registrar Gastos Operativos manualmente o con "ESCANEAR DTE (IA)"',
                description: 'En Compras → Gastos Operativos selecciona el Mes, Año y Sucursal arriba. Pulsa "ESCANEAR DTE (IA)" para capturar directamente desde cámara/PDF/QR del DTE o "REGISTRAR GASTO" para digitar proveedor, categoría contable, montos gravados/exentos e IVA crédito.',
                image: 'expenses-list.png',
                annotations: [
                    { n: 1, x: 74.8, y: 13.2, w: 11.2, h: 3.7, label: 'Botón "ESCANEAR DTE (IA)" para leer facturas electrónicas por QR/cámara o JSON.' },
                    { n: 2, x: 86.5, y: 13.2, w: 11.3, h: 3.7, label: 'Botón "REGISTRAR GASTO" para ingresar servicios, alquileres, energía o Sujeto Excluido (14).' },
                    { n: 3, x: 33.5, y: 21.6, w: 30, h: 3.6, label: 'Filtros por Mes, Año, Sucursal y botón "CAMBIAR ACTIVO" para fijar el período.' },
                    { n: 4, x: 20.9, y: 51, w: 75.4, h: 12, label: 'Listado con Fecha, Documento, Proveedor, Gravadas, IVA Crédito, Total y Estado.' }
                ],
                tip: 'También puedes emitir DTE de Sujeto Excluido (tipo 14) directo al guardar cuando compras bienes o servicios a personas sin IVA.'
            },
            {
                title: 'Generar Quedan para pagos programados a proveedores',
                description: 'Ingresa a Compras → Quedan y haz clic en "Agregar". Elige al proveedor y destino (Tienda/Pista), presiona "Agregar Documento" para anexar las facturas al crédito que cubre ese Quedan y guarda. Cuando el proveedor retire su cheque o pago, usa el botón "Entregar" en Acciones.',
                image: 'purchase-quedan.png',
                annotations: [
                    { n: 1, x: 89.2, y: 11.3, w: 7.7, h: 3.6, label: 'Botón "Agregar" para crear un nuevo Quedan agrupando facturas del proveedor.' },
                    { n: 2, x: 19.5, y: 16.6, w: 51.3, h: 3.5, label: 'Filtros por proveedor, número de Quedan, Sucursal y Destino (Tienda/Pista).' },
                    { n: 3, x: 89.5, y: 27.5, w: 6, h: 3.2, label: 'Acciones por fila: Ver detalle, Entregar pago/cheque o Revertir entrega.' }
                ],
                tip: 'Puedes exportar el resumen formal desde Compras → Reportes → Reporte de Quedanes.'
            },
            {
                title: 'Controlar entregas de Cheques de Contado',
                description: 'En Compras → Cheques de Contado presiona "AGREGAR" para registrar cheques girados en pagos inmediatos indicando proveedor, documento respaldado, destino (Pista o Tienda) y número de cheque; marca "Entregar" al ser retirado y emite el reporte oficial en "REPORTE".',
                image: 'purchase-checks.png',
                annotations: [
                    { n: 1, x: 70.4, y: 11.4, w: 17, h: 3.4, label: 'Accesos a "REPORTE" oficial y catálogo de "PROVEEDORES".' },
                    { n: 2, x: 87.9, y: 11.4, w: 7.8, h: 3.4, label: 'Botón "AGREGAR" para emitir y controlar un cheque de contado.' },
                    { n: 3, x: 90.5, y: 27.3, w: 4, h: 3.2, label: 'Acciones: Entregar cheque con fecha o Revertir entrega si es necesario.' }
                ],
                tip: 'Filtra por "PISTA" o "TIENDA" en el selector superior para separar fácilmente los reportes por operación.'
            }
        ],
        troubleshooting: [
            { issue: 'No encuentro una factura del proveedor para meterla en el Quedan', fix: 'Verifica que la compra esté registrada como Crédito (no Contado) y asignada al mismo proveedor seleccionado.' },
            { issue: 'Guardé un gasto de Sujeto Excluido pero faltó enviarlo a Hacienda', fix: 'Verifica al editar o crear que el interruptor esté en "Transmitir a Hacienda" y no en "Solo Guardar Local".' }
        ]
    },
    {
        slug: 'traslados-ajustes-inventario',
        order: 14,
        category: 'inventario',
        categoryLabel: 'Inventario y Bodega',
        requiredModule: 'inventory',
        menuPath: 'Inventario → Traslados y Movimientos',
        title: 'Traslados entre Sucursales y Movimientos / Ajustes de Inventario',
        summary: 'Mueve mercadería de forma trazable entre bodegas o sucursales y registra entradas/salidas extraordinarias por merma, consumo interno, vencimiento o ajuste.',
        outcome: 'Realizar transferencias entre sucursales y ajustes justificados manteniendo el Kardex exacto en todo momento.',
        duration: '4 min',
        modulePath: '/inventario/traslados',
        roles: ['Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: ['manage_transfers', 'manage_inventory_adjustments'],
        coverImage: 'inventory-transfers.png',
        prerequisites: [
            'Tener configurados los motivos de ajuste en el botón "Motivos" si registrarás una salida o entrada manual.'
        ],
        steps: [
            {
                title: 'Crear un Traslado entre Sucursales',
                description: 'Entra a Inventario → Traslados y pulsa "Nuevo Traslado". Elige la Sucursal Origen y la Sucursal Destino, luego agrega los productos usando el código de barras o pulsando F3 para buscar en el catálogo. Al confirmar, el stock se descuenta de Origen y suma en Destino.',
                image: 'inventory-transfers.png',
                annotations: [
                    { n: 1, x: 88, y: 12.3, w: 9.6, h: 3.6, label: 'Botón "Nuevo Traslado" para iniciar una transferencia de bodega a sucursal.' },
                    { n: 2, x: 20.9, y: 21.9, w: 62.9, h: 4.1, label: 'Buscador por número de documento, sucursal, usuario u observaciones.' },
                    { n: 3, x: 84.9, y: 22, w: 11.5, h: 3.9, label: 'Botones "Excel" y "PDF" para exportar el historial de traslados.' },
                    { n: 4, x: 19.9, y: 30, w: 77.6, h: 11.8, label: 'Tabla de control mostrando Documento, Fecha, Origen, Destino, Ítems y Estado.' }
                ],
                tip: 'Usa F3 dentro de la pestaña Nuevo Traslado para ver rápidamente qué artículos tienen existencia disponible en la sucursal de origen.'
            },
            {
                title: 'Registrar Movimientos de Ajuste (Entradas / Salidas)',
                description: 'Abre Inventario → Movimientos. Si necesitas crear clasificaciones (ej. Consumo Interno, Producto Dañado, Bonificación), presiona primero "Motivos". Luego pulsa "Nuevo Movimiento", selecciona Sucursal, Tipo (Entrada o Salida), Motivo y añade los artículos con F3.',
                image: 'inventory-adjustments.png',
                annotations: [
                    { n: 1, x: 79.4, y: 12.2, w: 6.9, h: 3.9, label: 'Botón "Motivos" para administrar las causas permitidas de entradas y salidas.' },
                    { n: 2, x: 86.8, y: 12.3, w: 11, h: 3.6, label: 'Botón "Nuevo Movimiento" para registrar un ajuste manual de stock.' },
                    { n: 3, x: 20.6, y: 21.9, w: 63.4, h: 4.1, label: 'Buscador por número de documento (AJ-), sucursal u observaciones.' },
                    { n: 4, x: 19.6, y: 30, w: 78.1, h: 20, label: 'Historial de movimientos realizados con tipo, cantidad de ítems y estado.' }
                ],
                tip: 'Todo movimiento o traslado genera un documento numerado y un comprobante imprimible que queda reflejado en el Kardex.'
            }
        ],
        troubleshooting: [
            { issue: 'No me deja agregar productos al traslado', fix: 'Debes seleccionar primero la Sucursal Origen; solo entonces se habilita el buscador (F3) de productos con stock en esa sede.' },
            { issue: 'No aparece ningún Motivo al crear un movimiento', fix: 'Presiona el botón "Motivos" arriba a la derecha en Movimientos de Inventario y crea al menos un motivo activo de Entrada o Salida.' }
        ]
    },
    {
        slug: 'inventario-fisico-kardex-reportes',
        order: 15,
        category: 'inventario',
        categoryLabel: 'Inventario y Bodega',
        requiredModule: 'inventory',
        menuPath: 'Inventario → Inventario Físico, Kardex y Reportes',
        title: 'Inventario Físico (con Escáner Móvil), Kardex y Reportes de Stock',
        summary: 'Ejecuta conteos físicos comparando teórico vs real (incluso escaneando desde celular), rastrea entradas/salidas en el Kardex y emite reportes de existencias.',
        outcome: 'Detectar diferencias de inventario a tiempo, auditar el historial exacto de un producto y generar reportes de stock y rotación.',
        duration: '5 min',
        modulePath: '/inventario/fisico',
        roles: ['Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: ['manage_physical_inventory', 'manage_kardex', 'view_stock_report', 'view_inventory_valuation_report'],
        coverImage: 'physical-inventory.png',
        prerequisites: [
            'Tener acceso a la sucursal donde se realizará la toma física o consulta de Kardex.'
        ],
        steps: [
            {
                title: 'Ejecutar una Toma de Inventario Físico y escanear artículos',
                description: 'En Inventario → Inventario Físico elige la Sucursal en el panel izquierdo, escribe el nombre del auditor y presiona "CARGAR PRODUCTOS". Escanea cada producto en el campo "SCANNER..." (o vincula tu teléfono con el QR de escaneo móvil) y digita la cantidad física contada.',
                image: 'physical-inventory.png',
                annotations: [
                    { n: 1, x: 72.2, y: 15.2, w: 22.1, h: 4.1, label: 'Pestañas "NUEVO CONTEO" (toma activa) e "HISTORIAL" de conteos anteriores.' },
                    { n: 2, x: 23.5, y: 34, w: 13, h: 18, label: 'Panel de configuración: elige Sucursal y escribe el nombre del Auditor responsable.' },
                    { n: 3, x: 23.9, y: 73.6, w: 12.2, h: 7.3, label: 'Botón "CARGAR PRODUCTOS" para traer las existencias teóricas de la sucursal.' },
                    { n: 4, x: 41.6, y: 29, w: 46.5, h: 5, label: 'Barra de escaneo "SCANNER..." y cantidad rápida para contar sin usar ratón.' }
                ],
                tip: 'Tus avances se guardan en borrador automáticamente para no perder el conteo si cierras la pestaña antes de aplicar el cierre.'
            },
            {
                title: 'Auditar movimientos exactos en Consulta de Kardex',
                description: 'Abre Inventario → Consulta Kardex. Selecciona la Sucursal y escanea el código de barras en "ESCANEAR..." o presiona F3 (ícono lupa a la derecha) para buscar el artículo. Verás cronológicamente cada compra, venta, traslado o ajuste con su Costo Unitario y Balance acumulado.',
                image: 'inventory-kardex.png',
                annotations: [
                    { n: 1, x: 20.9, y: 22, w: 18.3, h: 4.1, label: 'Selector de Sucursal donde deseas consultar los movimientos.' },
                    { n: 2, x: 40, y: 22, w: 56, h: 4.1, label: 'Campo "ESCANEAR..." y botón lupa F3 para buscar el producto.' },
                    { n: 3, x: 19.9, y: 29.9, w: 77.6, h: 11.8, label: 'Tabla Kardex: Fecha/Hora, Tipo (Compra/Venta/Ajuste), Documento, Cantidad, Costo y Balance.' }
                ],
                tip: 'Siempre que notes un stock negativo o descuadrado, revisa las últimas líneas del Kardex para identificar si faltó registrar una compra o sobró una salida.'
            },
            {
                title: 'Generar Reportes de Stock, Valorización y Rotación',
                description: 'En Inventario → Reportes tienes "Reporte de Stock", "Movimientos", "Valorización y Márgenes" y "Rotación y Obsolescencia". Elige la Sucursal, marca todas o algunas categorías en "Seleccionar todas" y genera el reporte PDF con descarga Excel.',
                image: 'inventory-stock-report.png',
                annotations: [
                    { n: 1, x: 23.5, y: 31, w: 13, h: 32, label: 'Selector de Sucursal y filtro de Categorías ("Seleccionar todas" o búsqueda).' },
                    { n: 2, x: 40, y: 24, w: 54, h: 66, label: 'Área de vista previa PDF y barra superior para descarga en PDF o Excel.' }
                ],
                tip: 'Usa "Valorización y Márgenes" al cierre de mes para conciliar el valor total del inventario contra la cuenta contable.'
            }
        ],
        troubleshooting: [
            { issue: 'Un producto aparece sin existencias en el Reporte de Stock aunque sí hay en bodega', fix: 'Revisa su Kardex para ver si las compras entraron en otra sucursal distinta o con un código duplicado.' },
            { issue: 'No puedo aplicar el inventario físico si no he cargado productos', fix: 'Pulsa primero "CARGAR PRODUCTOS" después de seleccionar la sucursal para inicializar las líneas de auditoría.' }
        ]
    }
];

module.exports = COMPRAS_INVENTARIO_TUTORIALS;
