/**
 * Catálogo oficial de tutoriales operativos — Fase 1: Tienda y Pista (Gasolinera)
 * Coordenadas porcentuales (x, y, w, h) calibradas sobre capturas reales 1480x880.
 */

const TUTORIAL_CATEGORIES = [
    {
        id: 'tienda',
        label: 'Tienda y POS',
        description: 'Facturación DTE, historial y PDFs, productos, promos/combos, clientes, corte de caja y remesas.'
    },
    {
        id: 'pista',
        label: 'Pista / Gasolinera',
        description: 'Cierre de lecturas por despachador, mangueras, tanques, precios, remesas, cupones, anticipos y trupput.'
    }
];

const ROLE_GUIDES = [
    {
        role: 'Vendedor',
        badge: 'Operación Diaria',
        color: 'indigo',
        summary: 'Atiende el Punto de Venta, consulta DTEs y PDFs, administra productos y clientes, y entrega remesas.',
        highlights: [
            'Facturar Consumidor Final (01), CCF (03), Nota de Crédito (05) y Retención (07) en POS.',
            'Descargar PDF (RTEE), ver respuesta de Hacienda y corregir rechazos desde Historial.',
            'Crear/actualizar clientes con DUI/NIT/NRC/Distrito y registrar entregas de remesas.'
        ]
    },
    {
        role: 'Jefe Tienda',
        badge: 'Supervisión Tienda',
        color: 'emerald',
        summary: 'Supervisa apertura y corte de caja, combos, inventario, compras, remesas y reportes de tienda.',
        highlights: [
            'Abrir turnos por POS/vendedor y ejecutar el Corte de Caja y Arqueo completo.',
            'Configurar Combos, Productos, Categorías y Liquidación de Cupones.',
            'Revisar Ventas de Tienda por Turno, Arqueos y Rentabilidad de Tienda.'
        ]
    },
    {
        role: 'Jefe Pista',
        badge: 'Supervisión Pista',
        color: 'amber',
        summary: 'Dirige los cierres de lecturas de combustibles, asigna mangueras, controla tanques, remesas y créditos.',
        highlights: [
            'Iniciar y cerrar turnos de Lecturas con asignaciones de mangueras y varillaje de tanques.',
            'Liquidar remesas, tarjetas, créditos, vales, cupones, adelantos y lubricantes.',
            'Actualizar precios de combustible y consultar reportes de Galonaje, Inventario y Trupput.'
        ]
    },
    {
        role: 'SuperAdmin',
        badge: 'Control Total',
        color: 'indigo',
        summary: 'Acceso completo a todas las guías operativas de Tienda, POS, Pista y supervisión financiera.',
        highlights: [
            'Supervisar facturación POS, resolución de rechazos DTE y catálogos multicompañía.',
            'Auditar cortes de caja de Tienda, entregas de remesas y promociones vigentes.',
            'Controlar cierres de lecturas de Pista, precios de combustible, cupones y trupput.'
        ]
    },
    {
        role: 'Admin',
        badge: 'Administración General',
        color: 'indigo',
        summary: 'Administra integralmente los procesos de Tienda, facturación DTE, catálogos, cortes y operación de Pista.',
        highlights: [
            'Configurar productos, categorías, clientes, combos y promociones en todas las sucursales.',
            'Supervisar turnos de POS, arqueos de caja, entregas de remesas y corrección de DTE.',
            'Validar cierres de lecturas de Pista, precios de combustibles, anticipos y convenios.'
        ]
    },
    {
        role: 'Supervisor',
        badge: 'Supervisión Operativa',
        color: 'emerald',
        summary: 'Supervisa la operación diaria de Tienda y Pista, validando arqueos, lecturas y cumplimiento DTE.',
        highlights: [
            'Verificar aperturas y cortes de caja en Tienda junto con la entrega de remesas.',
            'Revisar rechazos DTE, clientes fiscales y aplicación correcta de combos/promociones.',
            'Controlar cierres de lecturas de Pista, precios vigentes y liquidación de cupones.'
        ]
    },
    {
        role: 'Gerencia',
        badge: 'Dirección y Auditoría',
        color: 'emerald',
        summary: 'Consulta reportes ejecutivos, supervisa cierres de Tienda y Pista y audita indicadores de ventas.',
        highlights: [
            'Auditar DTE emitidos, combos/promociones, cortes de caja y remesas de Tienda.',
            'Revisar cierres de lecturas de Pista, historial con bitácora de cambios y precios.',
            'Monitorear liquidaciones de cupones, anticipos de combustible y convenios Trupput.'
        ]
    },
    {
        role: 'Contador',
        badge: 'Control Fiscal y Contable',
        color: 'indigo',
        summary: 'Verifica documentos tributarios electrónicos (DTE), fichas fiscales de clientes y cierres para conciliación.',
        highlights: [
            'Consultar y descargar PDF/JSON DTE en Historial de Ventas y validar respuestas MH.',
            'Revisar datos fiscales obligatorios de clientes (NIT, NRC, Distrito y Giro).',
            'Conciliar historial de lecturas de Pista, diferencias de cierre y reportes contables.'
        ]
    },
    {
        role: 'Auxiliar',
        badge: 'Apoyo Administrativo',
        color: 'amber',
        summary: 'Apoya en registro de remesas, seguimiento de lecturas de pista, liquidación de cupones y anticipos.',
        highlights: [
            'Registrar entregas de remesas de Tienda y consultar reportes por turno.',
            'Apoyar en cierres de lecturas de Pista y verificación en Historial de Lecturas.',
            'Gestionar remesas de pista, conciliación de cupones, anticipos y Trupput.'
        ]
    },
    {
        role: 'Operaciones',
        badge: 'Operación Comercial',
        color: 'emerald',
        summary: 'Coordina la oferta comercial de combos, promociones vigentes y acuerdos de descuento para Tienda y POS.',
        highlights: [
            'Estructurar combos de productos y vigencias promocionales por sucursal.',
            'Mantener acuerdos de precios y descuentos corporativos en POS.',
            'Coordinar con Tienda la correcta ejecución de campañas comerciales.'
        ]
    }
];

const TUTORIALS_CATALOG = [
    // =========================================================================
    // FASE 1A: TIENDA Y POS
    // =========================================================================
    {
        slug: 'facturar-pos',
        order: 1,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        title: 'Cómo Facturar en el Punto de Venta (POS)',
        summary: 'Desde el desbloqueo con clave de vendedor hasta el cobro, selección de Factura o Crédito Fiscal, emisión electrónica DTE e impresión de ticket.',
        duration: '5 min',
        modulePath: '/ventas/nueva',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Admin'],
        requiredPermissions: ['manage_pos_terminal'],
        coverImage: 'pos-terminal.png',
        prerequisites: [
            'Tener un turno abierto en la sucursal o iniciar con un vendedor asignado al turno activo.',
            'El producto debe estar en estado Activo y habilitado para la sucursal actual.'
        ],
        steps: [
            {
                title: 'Desbloquear el terminal con tu clave de vendedor',
                description: 'Al ingresar a Ventas → Punto de Venta (POS), aparece la ventana "Acceso Logística". Selecciona el tipo de documento inicial (Factura 01 o Crédito Fiscal 03), digita tu contraseña personal de vendedor y presiona "INICIAR TERMINAL".',
                image: 'pos-terminal-access.png',
                annotations: [
                    { n: 1, x: 36, y: 42, w: 28, h: 7, label: 'Tipo de Documento inicial (Factura 01, CCF 03, NC 05, FEX 11).' },
                    { n: 2, x: 36, y: 55, w: 28, h: 8, label: 'Contraseña de Vendedor asignado al turno activo en Corte de Caja.' },
                    { n: 3, x: 36, y: 65, w: 28, h: 7, label: 'Botón INICIAR TERMINAL para validar turno e ingresar a facturar.' }
                ],
                tip: 'Si aparece el aviso "Debe abrir un turno para vender", pide a Jefe de Tienda o abre primero el turno en Ventas → Corte de Caja.'
            },
            {
                title: 'Elegir cliente (F4), tipo de documento y agregar productos (F3 / escáner)',
                description: 'En el encabezado elige el cliente con F4 (o usa la lupa para buscar por sucursal/flota) y verifica el Tipo de Documento. Luego escanea el código de barras en SCAN, presiona F3 o haz clic en la lupa de producto para abrir el catálogo visual y sumar unidades al carrito.',
                image: 'pos-terminal.png',
                annotations: [
                    { n: 1, x: 20, y: 12, w: 38, h: 10, label: 'Selector de Cliente (F4), lupa de búsqueda, crear rápido (+) y editar.' },
                    { n: 2, x: 58, y: 12, w: 20, h: 7, label: 'Selector de Tipo de Documento DTE (01 Factura, 03 CCF, 05 NC, 11 FEX).' },
                    { n: 3, x: 20, y: 31, w: 54, h: 7, label: 'Barra rápida: Código de barras / Lupa (F3), cantidad, precio y botón Agregar.' },
                    { n: 4, x: 20, y: 40, w: 54, h: 20, label: 'Carrito editable: ajusta cantidad (- / +), descuento o elimina ítems.' },
                    { n: 5, x: 77, y: 29, w: 20, h: 48, label: 'Resumen en tiempo real (Gravado, IVA 13%, Retención/Percepción) y PAGAR (F10).' }
                ],
                tip: 'Usa F3 desde cualquier campo para abrir el catálogo visual completo con precios de tu sucursal, incluso desde el celular.'
            },
            {
                title: 'Verificar el pago, emitir DTE y consultar la factura en Historial',
                description: 'Presiona F10 ("PAGAR") para seleccionar Contado (Efectivo, Tarjeta, Transferencia) o Crédito. El sistema transmite automáticamente el DTE a Hacienda, genera el Número de Control y permite reimprimir ticket o enviar el correo.',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 41, y: 40, w: 17, h: 10, label: 'Código de Generación y Número de Control oficial asignado por Hacienda.' },
                    { n: 2, x: 73, y: 44, w: 10, h: 5, label: 'Insignia ACEPTADO + ícono verde de correo enviado al cliente.' },
                    { n: 3, x: 88, y: 44, w: 7, h: 5, label: 'Acciones rápidas: Ojo (ver detalle), PDF rojo (RTEE) y menú (tres puntos).' }
                ],
                tip: 'Si una venta a Crédito Fiscal o Factura requiere sucursal o placa de flota específica del cliente, selecciónala antes de presionar F10.'
            }
        ],
        troubleshooting: [
            { issue: 'No encuentro un producto en el buscador POS', fix: 'Verifica en Catálogos → Productos que esté Activo y marcado para tu sucursal actual.' },
            { issue: 'Error de Hacienda al emitir CCF (03)', fix: 'Confirma que el cliente tenga NIT, NRC, Distrito y Actividad Económica completos.' }
        ]
    },
    {
        slug: 'ver-dte-descargar-pdf',
        order: 2,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        title: 'Ver DTE, Descargar PDF y Corregir Rechazos de Hacienda',
        summary: 'Consulta documentos emitidos, visualiza o descarga la Representación Gráfica (PDF), inspecciona el JSON/respuesta MH, reenvía correos y resuelve rechazos en el mismo historial.',
        duration: '5 min',
        modulePath: '/ventas',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Admin'],
        requiredPermissions: ['view_sales_history'],
        coverImage: 'sales-history.png',
        prerequisites: [
            'Permiso de consulta en Ventas → Historial de Ventas.'
        ],
        steps: [
            {
                title: 'Filtrar documentos por fecha, tipo de DTE, cliente o estado',
                description: 'Usa la barra de filtros en Historial de Ventas: puedes buscar por nombre, número de control o UUID, usar botones rápidos (Hoy, Ayer, Esta Semana, Este Mes) y filtrar por Tipo de Documento o Estado MH (Aceptado, Rechazado, Anulado).',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 64, y: 23, w: 23, h: 5, label: 'Atajos de rango de fechas (Hoy, Ayer, Esta Semana, Este Mes).' },
                    { n: 2, x: 21, y: 31, w: 74, h: 6, label: 'Filtros combinables: Buscador, Fecha Desde/Hasta, Tipo DTE y Estado MH.' },
                    { n: 3, x: 22, y: 39, w: 66, h: 4, label: 'Cabeceras ordenables por Fecha, Sucursal, Documento, Cliente, Estado o Total.' }
                ],
                tip: 'Para descargar el PDF oficial inmediatamente, haz clic directo en el ícono rojo de PDF en la columna Acciones.'
            },
            {
                title: 'Ver Detalle DTE, descargar PDF (RTEE), JSON y reenviar correo',
                description: 'En cada fila tienes: 1) Ojo morado para abrir el detalle completo (ítems, pagos, Sello de Recepción y Respuesta MH); 2) Ícono rojo PDF para abrir/descargar la Representación Gráfica; 3) Menú de tres puntos para ver JSON DTE, reenviar correo al cliente, reimprimir ticket o anular/invalidar dentro del plazo legal.',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 88, y: 45, w: 2.5, h: 4, label: 'Botón Ojo: abre detalle de venta, respuesta de Hacienda y XML/JSON.' },
                    { n: 2, x: 90.5, y: 45, w: 2.5, h: 4, label: 'Botón PDF Rojo: abre la Representación Gráfica (RTEE) lista para descargar.' },
                    { n: 3, x: 93, y: 45, w: 2.5, h: 4, label: 'Menú Acciones: Ver JSON, Reenviar Correo, Solventar Rechazo, Regenerar o Anular.' }
                ],
                tip: 'El sobre verde junto a "ACEPTADO" confirma que el correo con PDF y JSON ya fue enviado automáticamente al cliente.'
            },
            {
                title: 'Diagnosticar con IA y "Solventar / Corregir DTE" en caso de rechazo',
                description: 'Si un documento aparece como "RECHAZADO IA", haz clic en esa insignia o elige "Solventar / Corregir DTE" en el menú de acciones. Desde ahí mismo puedes corregir datos del cliente (incluido Distrito), recalcular aproximaciones/redondeos en 1 clic, corregir documentos relacionados de Notas de Crédito/Retención o completar campos de Exportación (FEX), y volver a transmitir.',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 73, y: 44, w: 9, h: 5, label: 'Insignia de Estado MH: si está en rojo (Rechazado), haz clic para abrir Diagnóstico IA.' },
                    { n: 2, x: 93, y: 44, w: 3, h: 5, label: 'En el menú desplegable encontrarás "Solventar / Corregir DTE" y "Regenerar DTE".' }
                ],
                tip: 'Si Hacienda rechazó por número de control duplicado (código 004), usa "Guardar y Regenerar (Nuevo Control)".'
            }
        ],
        troubleshooting: [
            { issue: 'El cliente dice no haber recibido su factura', fix: 'Verifica su correo en el botón Solventar / Corregir Cliente y luego pulsa "Reenviar Correo" en el menú de 3 puntos.' },
            { issue: 'Rechazo por aproximación o diferencia de centavos (003)', fix: 'Abre "Solventar / Corregir DTE" → pestaña Montos y pulsa "Recalcular y Cuadrar Automáticamente".' }
        ]
    },
    {
        slug: 'crear-productos-categorias',
        order: 3,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        title: 'Crear Productos, Categorías y Precios por Sucursal',
        summary: 'Aprende a dar de alta nuevos artículos o servicios, asignar códigos de barras, precios por sucursal, exención de IVA y organizarlos en categorías.',
        duration: '4 min',
        modulePath: '/products',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Admin'],
        requiredPermissions: ['manage_products', 'manage_categories'],
        coverImage: 'products-list.png',
        prerequisites: [
            'Definir previamente la Categoría del producto en Catálogos → Categorías si aún no existe.'
        ],
        steps: [
            {
                title: 'Organizar primero las Categorías',
                description: 'Ingresa a Catálogos → Categorías para agrupar tus productos (por ejemplo: Abarrotes, Bebidas, Lubricantes, Combustibles). Haz clic en "+ Nueva Categoría" para crear o editar una existente.',
                image: 'categories-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón "+ Nueva Categoría" para registrar familias de productos.' },
                    { n: 2, x: 21, y: 20, w: 28, h: 5, label: 'Buscador instantáneo de categorías.' },
                    { n: 3, x: 85, y: 31, w: 8, h: 5, label: 'Acciones para editar nombre o eliminar categorías sin productos.' }
                ],
                tip: 'Una buena clasificación por categorías mejora el reporte Ventas por Categoría y el análisis de rentabilidad.'
            },
            {
                title: 'Crear un producto y asignar código, categoría, estado y precios',
                description: 'Ve a Catálogos → Productos y pulsa "+ Nuevo Producto". Completa Código interno, Código de barras (para lector POS), Nombre, Categoría, Unidad de medida, si es Exento de IVA o Combustible, y asigna el precio de venta (IVA incluido) habilitando las sucursales donde se venderá.',
                image: 'products-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón "+ Nuevo Producto" para abrir el formulario de creación.' },
                    { n: 2, x: 55, y: 12, w: 28, h: 6, label: 'Herramientas de Rentabilidad y Precios e Impresión de Etiquetas de código.' },
                    { n: 3, x: 21, y: 18, w: 43, h: 5, label: 'Buscador por código/nombre y filtro desplegable por categoría.' },
                    { n: 4, x: 86, y: 28, w: 8, h: 5, label: 'Acciones por fila: Imprimir etiqueta, Editar producto o Desactivar.' }
                ],
                tip: 'Recuerda activar la casilla de cada sucursal donde el producto estará disponible; de lo contrario el POS no permitirá facturarlo ahí.'
            }
        ],
        troubleshooting: [
            { issue: 'El código de barras ya existe', fix: 'Usa el buscador en Catálogos → Productos para ubicar el artículo existente y actualizar su precio o sucursal.' }
        ]
    },
    {
        slug: 'combos-promociones-descuentos',
        order: 4,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        title: 'Combos de Productos, Promociones y Descuentos',
        summary: 'Configura paquetes (combos) que descargan múltiples ítems de inventario, ofertas comerciales por fecha (2x1, paquetes, escalas) y descuentos específicos por cliente.',
        duration: '5 min',
        modulePath: '/ventas/combos',
        roles: ['Jefe Tienda', 'Operaciones', 'Supervisor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_combos', 'manage_sales_promotions', 'manage_customer_discounts', 'manage_discount_rules'],
        coverImage: 'combos-list.png',
        prerequisites: [
            'Tener creados previamente los productos individuales que integrarán el combo o promoción.'
        ],
        steps: [
            {
                title: 'Crear Combos de Productos',
                description: 'En Ventas → Descuentos y Promos → Combos de Productos, presiona "+ Nuevo Combo". Define el nombre, código/barra, sucursal y precio final del paquete, luego añade cada producto componente con su cantidad exacta.',
                image: 'combos-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón "+ Nuevo Combo" para armar un paquete vendible desde el POS.' },
                    { n: 2, x: 21, y: 20, w: 33, h: 6, label: 'Buscador por nombre o código de barras del combo.' },
                    { n: 3, x: 21, y: 29, w: 76, h: 7, label: 'Tabla de combos: muestra sucursal, código, ítems incluidos y precio final.' }
                ],
                tip: 'Al facturar un combo en el POS, el sistema rebaja automáticamente el stock de cada producto componente del paquete.'
            },
            {
                title: 'Configurar Promociones Comerciales automáticas en POS',
                description: 'Ingresa a Ventas → Descuentos y Promos → Promociones y haz clic en "+ NUEVA PROMOCIÓN". Selecciona la mecánica (2x1, segunda unidad con descuento, paquetes o escalas), define los productos participantes, fechas de vigencia y sucursales.',
                image: 'promotions-list.png',
                annotations: [
                    { n: 1, x: 81, y: 16, w: 14, h: 6, label: 'Botón "+ NUEVA PROMOCIÓN" para crear ofertas automáticas.' },
                    { n: 2, x: 21, y: 26, w: 74, h: 10, label: 'Aviso normativo: las promociones aplican descuento oficial DTE en montoDescu.' },
                    { n: 3, x: 21, y: 38, w: 74, h: 6, label: 'Filtros por nombre, tipo de oferta, sucursal y estado.' }
                ],
                tip: 'Las promociones vigentes se detectan en tiempo real dentro del carrito del POS al alcanzar la cantidad mínima configurada.'
            },
            {
                title: 'Administrar Descuentos por Cliente (convenios)',
                description: 'En Ventas → Descuentos y Promos → Descuentos por Cliente puedes fijar tarifas o descuentos por galón/producto para clientes corporativos o convenios de flota por sucursal.',
                image: 'customer-discounts.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón para asignar un nuevo descuento personalizado por cliente y sucursal.' },
                    { n: 2, x: 21, y: 22, w: 75, h: 8, label: 'Listado de acuerdos vigentes mostrando cliente, producto, sucursal y valor aplicado.' }
                ],
                tip: 'Asegúrate de elegir al cliente correcto con F4 en el POS para que el sistema aplique su tarifa especial automáticamente.'
            }
        ],
        troubleshooting: [
            { issue: 'La promoción no se aplica al vender', fix: 'Revisa que la fecha actual y el día de la semana estén dentro de la vigencia de la promoción y que la sucursal esté marcada.' }
        ]
    },
    {
        slug: 'gestion-clientes',
        order: 5,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        title: 'Crear y Configurar Clientes (DUI, NIT, NRC, Distrito y Sucursales)',
        summary: 'Registra clientes locales o extranjeros cumpliendo al 100% con los catálogos oficiales de Hacienda para evitar rechazos al facturar.',
        duration: '4 min',
        modulePath: '/customers',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Contador', 'Admin'],
        requiredPermissions: ['manage_customers'],
        coverImage: 'customers-list.png',
        prerequisites: [
            'Tener a la mano DUI o NIT/NRC y giro comercial si el cliente solicita Crédito Fiscal (03).'
        ],
        steps: [
            {
                title: 'Consultar, filtrar y crear nuevo cliente',
                description: 'Abre Catálogos → Clientes. Usa el buscador superior para verificar que el cliente no esté duplicado antes de pulsar "+ Nuevo Cliente". También puedes exportar el padrón completo a Excel o PDF.',
                image: 'customers-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 5, label: 'Botón "+ Nuevo Cliente" para abrir el formulario completo del receptor.' },
                    { n: 2, x: 21, y: 18, w: 29, h: 5, label: 'Buscador rápido por nombre, DUI, NIT o NRC.' },
                    { n: 3, x: 42, y: 31, w: 17, h: 8, label: 'Verifica que la Ubicación incluya Distrito, Municipio y Departamento válidos.' },
                    { n: 4, x: 87, y: 31, w: 9, h: 6, label: 'Acciones: Editar ficha, gestionar Sucursales, Flotas/Vehículos o eliminar.' }
                ],
                tip: 'Desde la columna Acciones (ícono de edificios y camión) puedes agregar sucursales múltiples y vehículos de flota del cliente.'
            },
            {
                title: 'Datos obligatorios para evitar rechazos de Hacienda',
                description: 'Para Crédito Fiscal (CCF 03) son obligatorios: Nombre/Razón Social, NIT válido (14 dígitos o 9 homologado), NRC sin ceros ficticios, Actividad Económica (CAT-019), Departamento, Municipio y Distrito (CAT-008). Para Factura (01) de $200.00 o más es obligatorio DUI o NIT.',
                image: 'customers-list.png',
                annotations: [
                    { n: 1, x: 67, y: 31, w: 10, h: 6, label: 'Columna Documento: verifica que DUI (9 dígitos) o NIT (14/9 dígitos) no sean ceros.' },
                    { n: 2, x: 78, y: 31, w: 9, h: 6, label: 'Condición Fiscal (Contribuyente, Gran Contribuyente, Exento IVA) y plazo de crédito.' }
                ],
                tip: 'Si olvidaste llenar el Distrito antes de emitir un DTE y fue rechazado, puedes corregirlo directo en Historial → Solventar DTE.'
            }
        ],
        troubleshooting: [
            { issue: 'Hacienda rechaza por [receptor.direccion.distrito]', fix: 'Edita el cliente (o su sucursal asignada) y selecciona explícitamente Departamento → Municipio → Distrito del catálogo.' }
        ]
    },
    {
        slug: 'corte-de-caja-tienda',
        order: 6,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        title: 'Cómo Hacer el Corte de Caja (Apertura, Arqueo y Cierre de Turno)',
        summary: 'Flujo paso a paso para abrir turno por punto de venta, supervisar turnos activos, registrar el arqueo detallado y emitir el cierre financiero.',
        duration: '5 min',
        modulePath: '/ventas/cierre',
        roles: ['Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_cash_closure'],
        coverImage: 'cash-closing.png',
        prerequisites: [
            'Tener configurados los Puntos de Venta (POS) y vendedores activos en la sucursal.'
        ],
        steps: [
            {
                title: 'Abrir un Nuevo Turno (Apertura de Caja)',
                description: 'En Ventas → Corte de Caja, haz clic en "NUEVA APERTURA". Selecciona el Punto de Venta (ej. Tienda 1, Tienda 2), el vendedor responsable, los vendedores adicionales que podrán facturar en ese turno y el Fondo Inicial en efectivo.',
                image: 'cash-closing.png',
                annotations: [
                    { n: 1, x: 60, y: 16, w: 18, h: 6, label: 'Botón "NUEVA APERTURA" para habilitar un turno en un POS.' },
                    { n: 2, x: 79, y: 16, w: 16, h: 6, label: 'Botón "VENTAS TIENDA" para consultar/enviar el resumen por fecha.' },
                    { n: 3, x: 23, y: 28, w: 35, h: 29, label: 'Tarjetas de Turnos Activos con responsable, hora de inicio y fondo inicial.' }
                ],
                tip: 'Asegúrate de asignar a todos los cajeros del turno para que sus contraseñas funcionen en el terminal POS sin bloqueos.'
            },
            {
                title: 'Finalizar Turno y capturar el Arqueo de Efectivo y Movimientos',
                description: 'Al concluir la jornada, presiona "FINALIZAR TURNO" sobre la tarjeta correspondiente. Se abrirá el modal de Arqueo con pestañas para registrar: Ingresos adicionales, Gastos de caja, Tarjetas/POS, Remesas, Puntos y el Efectivo físico contado en caja.',
                image: 'cash-closing.png',
                annotations: [
                    { n: 1, x: 24, y: 51, w: 32, h: 5, label: 'Botón "FINALIZAR TURNO" para abrir el asistente de arqueo y cierre.' },
                    { n: 2, x: 23, y: 74, w: 72, h: 20, label: 'Historial de Turnos con Ventas, Esperado, Contado, Diferencia y estado de Arqueo.' }
                ],
                tip: 'Si se emitieron ventas adicionales antes de confirmar, utiliza el botón de recálculo/refresco en el modal de cierre antes de guardar.'
            },
            {
                title: 'Revisar diferencias e imprimir el Comprobante de Corte',
                description: 'Una vez cerrado el turno, aparecerá en el Historial de Turnos mostrando Ventas, Total Esperado, Monto Contado y Diferencia (+/-). Desde las acciones del historial puedes imprimir el ticket de cierre, consultar el desglose por categorías o revisar el cuadre en Reportes → Reporte de Arqueos.',
                image: 'cash-closing.png',
                annotations: [
                    { n: 1, x: 67, y: 78, w: 22, h: 16, label: 'Columnas financieras: Ventas, Esperado, Contado y Diferencia del turno.' },
                    { n: 2, x: 87, y: 63, w: 8, h: 5, label: 'Filtros de búsqueda por texto o rango de fechas sobre turnos históricos.' }
                ],
                tip: 'Un turno con estado "Realizado" en la columna Arqueo indica que su liquidación financiera quedó cerrada.'
            }
        ],
        troubleshooting: [
            { issue: 'El vendedor no puede entrar al POS tras abrir turno', fix: 'Edita los vendedores asignados del turno activo desde Corte de Caja e incluye al vendedor en la lista.' }
        ]
    },
    {
        slug: 'remesas-reportes-tienda',
        order: 7,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        title: 'Entrega de Remesas y Reportes Operativos de Tienda',
        summary: 'Registra depósitos bancarios/remesas entregadas desde Tienda y genera reportes oficiales en PDF y Excel por turno.',
        duration: '4 min',
        modulePath: '/ventas/entrega-remesas',
        roles: ['Vendedor', 'Jefe Tienda', 'Auxiliar', 'Supervisor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_sales_remesa_delivery', 'view_sales_tienda_shift_report', 'view_arqueos_report'],
        coverImage: 'sales-remesas.png',
        prerequisites: [
            'Haber cerrado turnos de caja con remesas pendientes de entregar o contar con boleta bancaria.'
        ],
        steps: [
            {
                title: 'Registrar Entrega de Remesas de Tienda',
                description: 'En Ventas → Entrega de Remesas, haz clic en "+ Nueva Entrega". Indica la persona responsable, número de boleta/referencia, selecciona las remesas de los turnos incluidos y verifica el Monto Entregado contra el esperado.',
                image: 'sales-remesas.png',
                annotations: [
                    { n: 1, x: 86, y: 12, w: 12, h: 5, label: 'Botón "+ Nueva Entrega" para consolidar boletas de remesas de tienda.' },
                    { n: 2, x: 19, y: 18, w: 27, h: 5, label: 'Buscador por responsable o número de referencia bancaria.' },
                    { n: 3, x: 20, y: 28, w: 75, h: 10, label: 'Tabla con Referencia, N° de Remesas, Monto Entregado, Diferencia y Acciones PDF.' }
                ],
                tip: 'Desde la columna Acciones (impresora) puedes descargar el acta comprobante en PDF de cada entrega de remesas.'
            },
            {
                title: 'Generar Reporte Ventas de Tienda por Turno y Arqueos',
                description: 'Ve a Ventas → Reportes → Ventas de Tienda por Turno (o Reporte de Arqueos). Elige la sucursal, fechas de apertura o atajos rápidos (Hoy, Ayer, Este Mes), activa "Modo Comparativo" si deseas desglosar cada DTE del turno y genera la vista previa en PDF o exporta a Excel.',
                image: 'store-shift-report.png',
                annotations: [
                    { n: 1, x: 21, y: 23, w: 14, h: 13, label: 'Switch de "Modo Comparativo" y atajos rápidos de período.' },
                    { n: 2, x: 21, y: 40, w: 14, h: 25, label: 'Filtros de Sucursal, Fecha Inicio y Fecha Fin de apertura de turno.' },
                    { n: 3, x: 40, y: 23, w: 54, h: 66, label: 'Visor interactivo PDF (con botón Expandir y descarga Excel).' }
                ],
                tip: 'Este reporte cuadra exactamente la facturación de Tienda agrupada por cada turno de caja.'
            }
        ],
        troubleshooting: [
            { issue: 'No aparecen ventas de Pista en Ventas de Tienda por Turno', fix: 'Es correcto: este reporte lee únicamente los puntos de venta clasificados como Tienda.' }
        ]
    },

    // =========================================================================
    // FASE 1B: PISTA / GASOLINERA
    // =========================================================================
    {
        slug: 'cierre-lecturas-pista',
        order: 8,
        category: 'pista',
        categoryLabel: 'Pista / Gasolinera',
        title: 'Cómo Hacer el Cierre de Lecturas de Pista (Paso a Paso)',
        summary: 'Guía completa de operación de pista: apertura de turno, asignación de mangueras por despachador, captura de lecturas, varillaje de tanques, liquidación de medios de pago y cierre oficial.',
        duration: '7 min',
        modulePath: '/gas-station/cierre-lecturas',
        roles: ['Jefe Pista', 'Auxiliar', 'Supervisor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_gas_readings_closure'],
        coverImage: 'gas-closeout-sheet.png',
        prerequisites: [
            'Verificar que los Precios de Combustible vigentes estén actualizados antes de iniciar el cierre.',
            'Tener las asignaciones de Mangueras x Despachador y la lista física de depósitos/vales del turno.'
        ],
        steps: [
            {
                title: 'Iniciar un nuevo Cierre de Lecturas',
                description: 'Entra a Gasolinera → Cierre Lecturas. El sistema muestra la referencia del Último Turno cerrado. Selecciona el Vendedor responsable, confirma la Fecha de Turno y el Número de Turno (1, 2 o 3), agrega a los Despachadores del Turno y presiona "Iniciar Lectura".',
                image: 'gas-closeout.png',
                annotations: [
                    { n: 1, x: 42, y: 29, w: 35, h: 6, label: 'Referencia del Último Turno cerrado para continuar el correlativo correcto.' },
                    { n: 2, x: 42, y: 37, w: 35, h: 24, label: 'Selector de Vendedor responsable, Fecha del Turno y Número de Turno.' },
                    { n: 3, x: 42, y: 63, w: 35, h: 10, label: 'Asignar Despachadores del Turno y botón "Iniciar Lectura".' }
                ],
                tip: 'Si necesitas editar las mangueras asignadas a un pistero, usa el enlace rápido "Configurar Mangueras" arriba del selector.'
            },
            {
                title: 'Capturar Lecturas de Mangueras y Medición de Tanques',
                description: 'Dentro de la hoja de Cierre de Lecturas, utiliza la botonera derecha ("OPCIONES DEL TURNO"). Ingresa primero en LECTURAS para digitar la lectura final de cada manguera por isla/producto (o sincronizar desde Fusion si aplica) y luego registra TANQUES (varillaje, saldo y reserva).',
                image: 'gas-closeout-sheet.png',
                annotations: [
                    { n: 1, x: 20, y: 18, w: 56, h: 32, label: 'Resumen automático de Lecturas: Precio, Galones vendidos y Total en dólares.' },
                    { n: 2, x: 78, y: 22, w: 18, h: 14, label: 'Botón LECTURAS (mangueras inicial/final) y GASTOS operativos del turno.' },
                    { n: 3, x: 78, y: 58, w: 18, h: 14, label: 'Botón TANQUES (medición física y reserva) y LUBRICANTES vendidos.' }
                ],
                tip: 'Verifica que el precio mostrado en cada combustible coincida con la pizarra; si hubo cambio de precio usa la opción de sincronización.'
            },
            {
                title: 'Registrar Remesas, Tarjetas, Créditos, Cupones, Vales, Adelantos y Trupput',
                description: 'En la misma botonera derecha captura todos los descargos de pista: REMESAS (depósitos de caja), TARJETAS (lotes por tipo de POS), CRÉDITOS, CUPONES, VALES, DESCUENTOS, ADELANTOS, ANTICIPOS DESP., CHEQUES y TRUPPUT.',
                image: 'gas-closeout-sheet.png',
                annotations: [
                    { n: 1, x: 20, y: 53, w: 28, h: 33, label: 'Panel INGRESOS: suma automáticamente Combustible + Lubricantes.' },
                    { n: 2, x: 49, y: 53, w: 27, h: 43, label: 'Panel EGRESOS: suma Remesas, Tarjetas, Cupones, Créditos, Anticipos y Gastos.' },
                    { n: 3, x: 78, y: 31, w: 18, h: 38, label: 'Accesos a Cupones, Créditos, Vales, Descuentos, Trupput, Remesas y Tarjetas.' }
                ],
                tip: 'El botón "LECTURAS/VTAS" te permite revisar en un solo cuadro si el efectivo + documentos cuadran contra la venta de mangueras por despachador.'
            },
            {
                title: 'Validar cuadre, Cerrar Turno e Imprimir Comprobante',
                description: 'Verifica la diferencia final entre Ingresos y Egresos en la parte inferior y el detalle por despachador. Cuando esté cuadrado, pulsa el botón de Cierre en la parte superior derecha para bloquear el turno como "CERRADO" e imprimir el reporte PDF desde el ícono de impresora.',
                image: 'gas-closeout-sheet.png',
                annotations: [
                    { n: 1, x: 86, y: 12, w: 11, h: 5, label: 'Estado del turno (ABIERTO / CERRADO) y menú de impresión de PDF oficial.' },
                    { n: 2, x: 49, y: 94, w: 27, h: 5, label: 'Comparación final de Total Egresos vs Total Ingresos del turno.' }
                ],
                tip: 'Si un cierre ya fue finalizado y un gerente/administrador autoriza una corrección posterior, el botón de reapertura queda auditado en Historial de Lecturas.'
            }
        ],
        troubleshooting: [
            { issue: 'Faltan galones o hay diferencia en un despachador', fix: 'Revisa en LECTURAS que las mangueras estén asignadas al pistero correcto y verifica si olvidaste cargar un lote en TARJETAS o REMESAS.' },
            { issue: 'Diferencia por cambio de precio a mitad de turno', fix: 'Asegúrate de actualizar el precio en Ventas → Precios de Combustible antes de abrir el siguiente turno.' }
        ]
    },
    {
        slug: 'historial-lecturas-reportes-pista',
        order: 9,
        category: 'pista',
        categoryLabel: 'Pista / Gasolinera',
        title: 'Historial de Lecturas, Precios de Combustible y Reportes de Pista',
        summary: 'Consulta cierres pasados, audita cambios, actualiza precios de combustible por sucursal y consulta reportes gerenciales de galonaje e inventario.',
        duration: '4 min',
        modulePath: '/gas-station/historial-lecturas',
        roles: ['Jefe Pista', 'Auxiliar', 'Supervisor', 'Gerencia', 'Contador', 'Admin'],
        requiredPermissions: ['view_gas_readings_history', 'manage_fuel_prices', 'view_gas_fuel_sales_report'],
        coverImage: 'gas-readings-history.png',
        prerequisites: [
            'Contar con permiso de Historial de Lecturas y/o Precios de Combustible.'
        ],
        steps: [
            {
                title: 'Consultar el Historial de Lecturas y reimprimir cierres',
                description: 'En Gasolinera → Historial de Lecturas puedes buscar por turno o vendedor, ver galones vendidos, monto total, diferencia (+/-), estado de envío RRS e historial de cambios. En Acciones tienes: Ver hoja (Ojo), Imprimir PDF (Impresora) y reabrir/auditar si tienes permiso.',
                image: 'gas-readings-history.png',
                annotations: [
                    { n: 1, x: 20, y: 18, w: 29, h: 5, label: 'Buscador rápido de cierres por número de turno o responsable.' },
                    { n: 2, x: 49, y: 25, w: 26, h: 16, label: 'Columnas de Galones Vendidos, Total Monto, Diferencia y estado RRS.' },
                    { n: 3, x: 84, y: 29, w: 12, h: 6, label: 'Acciones: Candado (estado/reapertura), RRS, Ver cierre completo e Imprimir PDF.' }
                ],
                tip: 'La columna "CAMBIOS" muestra una etiqueta si un cierre cerrado tuvo alguna modificación auditada.'
            },
            {
                title: 'Actualizar Precios de Combustible por sucursal',
                description: 'Ingresa a Ventas → Precios de Combustible. Cada sucursal maneja su propia pizarra de precios (Diesel, Regular, Super, etc.). Modifica el "PRECIO VENTA ($)" requerido y haz clic en "Guardar Cambios".',
                image: 'fuel-prices.png',
                annotations: [
                    { n: 1, x: 80, y: 11, w: 17, h: 6, label: 'Botón "Guardar Cambios" para aplicar los nuevos precios en POS y Pista.' },
                    { n: 2, x: 83, y: 29, w: 12, h: 12, label: 'Campos de Precio Venta ($) editables por cada combustible de la sucursal.' }
                ],
                tip: 'Los precios actualizados aplican de inmediato tanto para facturación en POS como para nuevos cierres de lecturas.'
            },
            {
                title: 'Reportes esenciales de Pista',
                description: 'Desde Gasolinera → Reportes puedes emitir en PDF/Excel: "Lecturas - Ventas", "Detalle del Cierre", "Inventario Combustible" (varillaje vs teórico), "Galonaje Vendido", "Cierre Diario", "Lubricantes Vendidos" y "Auditoría de Lubricantes".',
                image: 'gas-readings-history.png',
                annotations: [
                    { n: 1, x: 2, y: 69, w: 14, h: 28, label: 'Menú lateral Gasolinera con accesos directos a Cierre, Historial, Trupput y Reportes.' }
                ],
                tip: 'Usa "Detalle del Cierre" para conciliación contable y "Inventario Combustible" para detectar pérdidas o ganancias térmicas en tanques.'
            }
        ],
        troubleshooting: [
            { issue: 'No puedo editar un cierre de lecturas del historial', fix: 'Un cierre CERRADO queda bloqueado por auditoría; solicita a Gerencia/Admin la reapertura con motivo desde el candado.' }
        ]
    },
    {
        slug: 'remesas-cupones-anticipos-pista',
        order: 10,
        category: 'pista',
        categoryLabel: 'Pista / Gasolinera',
        title: 'Remesas de Pista, Liquidación de Cupones, Anticipos y Trupput',
        summary: 'Administra los flujos operativos complementarios de Gasolinera: consolidación de remesas de pista, arqueo de cupones, saldos anticipados y despachos Trupput.',
        duration: '5 min',
        modulePath: '/gas-station/entrega-remesas',
        roles: ['Jefe Pista', 'Jefe Tienda', 'Auxiliar', 'Supervisor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_gas_remesa_delivery', 'manage_gas_coupon_liquidation', 'manage_gas_advances', 'manage_gas_trupput'],
        coverImage: 'gas-remesas.png',
        prerequisites: [
            'Tener cierres de lecturas registrados donde se hayan ingresado remesas, cupones o despachos.'
        ],
        steps: [
            {
                title: 'Consolidar y entregar Remesas de Pista',
                description: 'En Gasolinera → Entrega de Remesas, presiona "+ Nueva Entrega" para agrupar las remesas provenientes de los cierres de pista, ingresar el número de boleta bancaria y generar su comprobante firmado.',
                image: 'gas-remesas.png',
                annotations: [
                    { n: 1, x: 86, y: 12, w: 12, h: 5, label: 'Botón "+ Nueva Entrega" para registrar entregas bancarias de pista.' },
                    { n: 2, x: 20, y: 28, w: 76, h: 12, label: 'Historial de entregas con referencia bancaria, cantidad de remesas y monto total.' }
                ],
                tip: 'Cada fila permite ver qué turnos y sobres exactos integran esa boleta de depósito e imprimir el respaldo PDF.'
            },
            {
                title: 'Liquidación de Cupones (Sistema vs Físico)',
                description: 'Abre Gasolinera → Liquidación de Cupones y pulsa "+ Nueva Liquidación". Concilia los cupones reportados en los turnos de pista contra los cupones físicos contados en sobre para controlar diferencias.',
                image: 'gas-coupons.png',
                annotations: [
                    { n: 1, x: 84, y: 14, w: 13, h: 6, label: 'Botón "+ Nueva Liquidación" para conciliar cupones de pista vs físicos.' },
                    { n: 2, x: 20, y: 22, w: 76, h: 10, label: 'Tarjetas resumen: Total Sistema, Total Físico Recibido y Diferencia Acumulada.' }
                ],
                tip: 'Tanto Jefe de Tienda como Jefe de Pista pueden consultar y liquidar cupones según los permisos asignados.'
            },
            {
                title: 'Controlar Anticipos de Clientes de Combustible',
                description: 'En Gasolinera → Anticipos de Clientes registra abonos prepagados por clientes flotilleros y monitorea el saldo disponible que van consumiendo en despachos de pista.',
                image: 'gas-advances.png',
                annotations: [
                    { n: 1, x: 82, y: 12, w: 16, h: 6, label: 'Botón para registrar un nuevo pago anticipado de cliente.' },
                    { n: 2, x: 20, y: 24, w: 75, h: 14, label: 'Panel de control de montos abonados, consumidos y saldos vigentes.' }
                ],
                tip: 'Cuando el cliente despacha contra anticipo en un cierre de lecturas, el saldo se descuenta de forma trazable.'
            },
            {
                title: 'Registrar y controlar Trupput (Galonaje por convenio)',
                description: 'En Gasolinera → Trupput (Galonaje) lleva el registro de galones despachados bajo convenios de Trupput, con opción de configurar clientes Trupput y conciliar contra los cierres de pista.',
                image: 'gas-trupput.png',
                annotations: [
                    { n: 1, x: 75, y: 12, w: 22, h: 6, label: 'Accesos para registrar movimiento Trupput y gestionar convenios.' },
                    { n: 2, x: 20, y: 24, w: 75, h: 15, label: 'Tabla operativa de despachos Trupput por fecha, cliente y galonaje.' }
                ],
                tip: 'Los despachos Trupput ingresados dentro del cierre de lecturas quedan reflejados automáticamente en este módulo.'
            }
        ],
        troubleshooting: [
            { issue: 'No aparecen cupones por liquidar', fix: 'Verifica el rango de fechas en los filtros o confirma que el cierre de lecturas donde se ingresaron los cupones ya esté guardado.' }
        ]
    }
];

module.exports = {
    TUTORIAL_CATEGORIES,
    ROLE_GUIDES,
    TUTORIALS_CATALOG
};
