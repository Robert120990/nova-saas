/**
 * Tutoriales Fase 1 + Mejoras + Eventos MH: Tienda, POS y Pista / Gasolinera (#1 - #11)
 */

const TIENDA_PISTA_TUTORIALS = [
    {
        slug: 'facturar-pos',
        order: 1,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Ventas → Punto de Venta (POS)',
        title: 'Cómo Facturar en el Punto de Venta (POS)',
        summary: 'Desde el desbloqueo con clave de vendedor hasta el cobro, selección de Factura o Crédito Fiscal, emisión electrónica (DTE) ante Hacienda e impresión de ticket.',
        outcome: 'Emitir ventas válidas al contado o al crédito con envío automático del comprobante por correo y ticket impreso.',
        duration: '5 min',
        modulePath: '/ventas/nueva',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_pos_terminal'],
        coverImage: 'pos-terminal.png',
        prerequisites: [
            'Tener un turno abierto en la sucursal actual (si falta, un encargado lo abre en Ventas → Corte de Caja).',
            'El producto debe estar en estado Activo y habilitado para la sucursal donde estás facturando.'
        ],
        steps: [
            {
                title: 'Desbloquear el terminal con tu clave personal de vendedor',
                description: 'Al entrar a Ventas → Punto de Venta (POS) aparece la ventana "Acceso Logística". Elige el Tipo de Documento inicial (Factura 01 para consumidor final o Crédito Fiscal 03 para empresa/contribuyente), escribe tu Contraseña de Vendedor y haz clic en "INICIAR TERMINAL".',
                image: 'pos-terminal-access.png',
                annotations: [
                    { n: 1, x: 36, y: 42, w: 28, h: 7, label: 'Tipo de Documento inicial (Factura 01, Crédito Fiscal 03, Nota de Crédito 05, Exportación 11).' },
                    { n: 2, x: 36, y: 55, w: 28, h: 8, label: 'Contraseña personal de vendedor vinculada al turno abierto en Corte de Caja.' },
                    { n: 3, x: 36, y: 65, w: 28, h: 7, label: 'Botón "INICIAR TERMINAL" para validar tu turno y entrar a facturar.' }
                ],
                tip: 'Si ves el aviso "Debe abrir un turno para vender", pide al Jefe de Tienda que abra turno o te agregue a la lista de vendedores del turno activo.'
            },
            {
                title: 'Elegir cliente (F4), documento y agregar productos (F3 o lector)',
                description: 'Arriba selecciona el cliente con la tecla F4 (o presiona la lupa para buscar por sucursal o vehículo/flota) y verifica el "TIPO DOCUMENTO". Luego escanea el código de barras en "SCAN...", presiona F3 o haz clic en la lupa para elegir productos del catálogo y ajustar cantidades.',
                image: 'pos-terminal.png',
                annotations: [
                    { n: 1, x: 20, y: 9.5, w: 38, h: 12.5, label: 'Selector de Cliente (F4), lupa de búsqueda, crear cliente rápido (+) y editar datos.' },
                    { n: 2, x: 58.5, y: 10, w: 37.5, h: 16, label: 'Selector de Tipo de Documento DTE, sucursal de despacho (camión) y referencia DTE (F9).' },
                    { n: 3, x: 20, y: 31, w: 55, h: 6.5, label: 'Barra rápida: Código de barras (SCAN), lupa (F3), nota opcional, cantidad y botón Agregar (+).' },
                    { n: 4, x: 19.5, y: 38.2, w: 55.7, h: 15, label: 'Carrito editable: aumenta o disminuye cantidad (- / +), revisa descuentos o elimina líneas.' },
                    { n: 5, x: 76.5, y: 29.5, w: 20.5, h: 48, label: 'Totales en tiempo real (Gravado, IVA 13%, FOVIAL/COTRANS, Retención) y botón "PAGAR (F10)".' }
                ],
                tip: 'La tecla F3 abre el catálogo visual desde cualquier lugar de la pantalla y muestra únicamente los productos con precio configurado en tu sucursal.'
            },
            {
                title: 'Cobrar (F10), transmitir a Hacienda y verificar el estado en Historial',
                description: 'Presiona F10 ("PAGAR (F10)") para elegir Contado (Efectivo, Tarjeta o Transferencia) o Crédito. Al confirmar, el sistema transmite el Documento Tributario Electrónico (DTE) al Ministerio de Hacienda, asigna su Número de Control e imprime el ticket. Puedes verificar su entrega en Ventas → Historial de Ventas.',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 41, y: 40, w: 17, h: 10, label: 'Código de Generación (UUID) y Número de Control oficial asignado ante Hacienda.' },
                    { n: 2, x: 73, y: 44, w: 10, h: 5, label: 'Insignia "ACEPTADO" en verde y sobre verde indicando que el correo salió al cliente.' },
                    { n: 3, x: 88, y: 44, w: 7, h: 5, label: 'Botones por fila: Ojo (ver detalle), PDF rojo (descargar factura) y menú de acciones.' }
                ],
                tip: 'Si la factura supera $200.00 en Consumidor Final o es Crédito Fiscal (03), verifica antes de cobrar que el cliente tenga DUI/NIT/NRC completo.'
            }
        ],
        troubleshooting: [
            { issue: 'No encuentro un producto en el buscador del POS', fix: 'Confirma en Catálogos → Productos que el artículo esté Activo y marcado para tu sucursal actual con precio definido.' },
            { issue: 'Hacienda rechaza al emitir Crédito Fiscal (03)', fix: 'Revisa que el cliente tenga NIT, NRC, Actividad Económica y Distrito completos (sin ceros ficticios).' }
        ]
    },
    {
        slug: 'ver-dte-descargar-pdf',
        order: 2,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Ventas → Historial de Ventas',
        title: 'Ver Facturas DTE, Descargar PDF y Corregir Rechazos de Hacienda',
        summary: 'Consulta ventas emitidas, descarga el PDF oficial (RTEE = Representación Gráfica), revisa el JSON y reenvía correos o soluciona rechazos sin salir del historial.',
        outcome: 'Localizar cualquier factura en segundos, entregar su PDF/JSON al cliente y resolver rechazos tributarios.',
        duration: '5 min',
        modulePath: '/ventas',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['view_sales_history'],
        coverImage: 'sales-history.png',
        prerequisites: [
            'Contar con permiso de Historial de Ventas en tu rol.'
        ],
        steps: [
            {
                title: 'Filtrar documentos por fecha, cliente, número o estado en Hacienda',
                description: 'En Ventas → Historial de Ventas usa el buscador por nombre de cliente, Código de Generación (UUID) o Número de Control. También puedes usar los botones rápidos ("Hoy", "Ayer", "Esta Semana", "Este Mes") y filtrar por Tipo de Documento o Estado MH (Aceptado, Rechazado, Anulado).',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 64, y: 23, w: 23, h: 5, label: 'Atajos de fechas (Hoy, Ayer, Esta Semana, Este Mes) para filtrar con un clic.' },
                    { n: 2, x: 21, y: 31, w: 74, h: 6, label: 'Filtros combinables: Buscador de texto, Fecha Desde/Hasta, Tipo de Documento y Estado MH.' },
                    { n: 3, x: 22, y: 39, w: 66, h: 4, label: 'Columnas ordenables: haz clic en Fecha, Sucursal, Documento, Cliente, Estado o Total.' }
                ],
                tip: 'Haz clic en la cabecera "FECHA" o "TOTAL" para cambiar entre orden ascendente y descendente.'
            },
            {
                title: 'Ver detalle, descargar PDF (RTEE), ver JSON o reenviar correo',
                description: 'En la columna Acciones tienes tres botones: 1) Ojo morado para abrir el detalle completo (productos, pagos, sello de recepción MH); 2) Botón rojo PDF para abrir o descargar la factura en PDF; 3) Menú de tres puntos para descargar el JSON DTE, reenviar correo al cliente, reimprimir ticket o anular/invalidar.',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 88, y: 45, w: 2.5, h: 4, label: 'Botón Ojo: muestra productos facturados, forma de pago y respuesta oficial de Hacienda.' },
                    { n: 2, x: 90.5, y: 45, w: 2.5, h: 4, label: 'Botón PDF Rojo: abre la Representación Gráfica (RTEE) lista para guardar o imprimir.' },
                    { n: 3, x: 93, y: 45, w: 2.5, h: 4, label: 'Menú (tres puntos): Ver JSON, Reenviar Correo, Solventar Rechazo, Regenerar o Anular.' }
                ],
                tip: 'El ícono de sobre en verde junto a "ACEPTADO" confirma que el cliente ya recibió automáticamente el PDF y JSON en su correo.'
            },
            {
                title: 'Usar Diagnóstico IA y "Solventar / Corregir DTE" ante rechazos',
                description: 'Si una venta aparece como "RECHAZADO", haz clic sobre la insignia roja o elige "Solventar / Corregir DTE" en el menú de acciones. El asistente te indicará el motivo exacto (por ejemplo Distrito faltante, DUI inválido o diferencia de centavos) para corregirlo y retransmitirlo en el momento.',
                image: 'sales-history.png',
                annotations: [
                    { n: 1, x: 73, y: 44, w: 9, h: 5, label: 'Insignia de Estado MH: si figura en rojo (Rechazado), haz clic para ver el diagnóstico.' },
                    { n: 2, x: 93, y: 44, w: 3, h: 5, label: 'Menú de acciones con acceso directo a "Solventar / Corregir DTE" y "Regenerar DTE".' }
                ],
                tip: 'Si Hacienda indicó número de control duplicado (código 004), selecciona "Guardar y Regenerar (Nuevo Control)" dentro de Solventar.'
            }
        ],
        troubleshooting: [
            { issue: 'El cliente reporta que no le llegó el correo con su factura', fix: 'En el menú de tres puntos revisa el correo del receptor con "Solventar / Corregir DTE" → Cliente y luego pulsa "Reenviar Correo".' },
            { issue: 'Rechazo por diferencia de aproximación o centavos (código 003)', fix: 'Abre "Solventar / Corregir DTE" → pestaña Montos y usa el botón "Recalcular y Cuadrar Automáticamente".' }
        ]
    },
    {
        slug: 'crear-productos-categorias',
        order: 3,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Catálogos → Categorías / Productos',
        title: 'Crear Productos, Categorías y Precios por Sucursal',
        summary: 'Da de alta artículos o servicios, asigna códigos de barras para el escáner, define precios por sucursal, marca exención de IVA y organízalos en categorías.',
        outcome: 'Tener tu catálogo de artículos bien clasificado y disponible para vender inmediatamente en el POS y en Compras.',
        duration: '4 min',
        modulePath: '/products',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Auxiliar', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: ['manage_products', 'manage_categories'],
        coverImage: 'products-list.png',
        prerequisites: [
            'Definir primero la Categoría en Catálogos → Categorías si el producto pertenece a una familia nueva.'
        ],
        steps: [
            {
                title: 'Crear y ordenar primero las Categorías',
                description: 'Entra a Catálogos → Categorías para agrupar tus productos (por ejemplo: Bebidas, Snacks, Lubricantes, Combustibles). Haz clic en "+ Nueva Categoría" para crear una nueva o utiliza los botones de acción de cada fila para editar.',
                image: 'categories-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón "+ Nueva Categoría" para registrar familias de productos.' },
                    { n: 2, x: 21, y: 20, w: 28, h: 5, label: 'Buscador rápido de categorías por nombre.' },
                    { n: 3, x: 85, y: 31, w: 8, h: 5, label: 'Acciones para editar nombre o eliminar categorías sin artículos asociados.' }
                ],
                tip: 'Una buena clasificación de categorías hace mucho más útiles los reportes de Ventas por Categoría y Rentabilidad de Tienda.'
            },
            {
                title: 'Registrar el producto y habilitar sucursales con precio de venta',
                description: 'Ve a Catálogos → Productos y haz clic en "+ Nuevo Producto". Ingresa Código interno, Código de barras (para lector POS), Nombre, Categoría y Unidad de medida. Indica si es Exento de IVA o Combustible, escribe el precio de venta (IVA incluido) y marca las sucursales donde estará habilitado.',
                image: 'products-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón "+ Nuevo Producto" para abrir la ficha completa de creación.' },
                    { n: 2, x: 55, y: 12, w: 28, h: 6, label: 'Accesos rápidos: "Rentabilidad y Precios" e "Imprimir Etiquetas" de código de barras.' },
                    { n: 3, x: 21, y: 18, w: 43, h: 5, label: 'Buscador por código o nombre y filtro desplegable por Categoría.' },
                    { n: 4, x: 86, y: 28, w: 8, h: 5, label: 'Acciones por producto: Imprimir etiqueta, Editar ficha o Desactivar.' }
                ],
                tip: 'No olvides marcar la casilla de cada sucursal donde se venderá el producto; si queda desmarcada, el POS de esa sucursal no lo mostrará.'
            }
        ],
        troubleshooting: [
            { issue: 'El sistema indica que el código de barras ya existe', fix: 'Busca ese código en Catálogos → Productos para editar el producto existente y actualizar su precio o activar la sucursal faltante.' },
            { issue: 'El producto sale con precio $0.00 en la tabla', fix: 'Edita el producto, ve a la sección de precios por sucursal e ingresa su precio de venta con IVA incluido.' }
        ]
    },
    {
        slug: 'combos-promociones-descuentos',
        order: 4,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Ventas → Descuentos y Promos',
        title: 'Combos de Productos, Promociones y Descuentos por Cliente',
        summary: 'Arma combos que rebajan múltiples artículos del inventario, crea ofertas comerciales automáticas (2x1, segunda unidad, escalas) y tarifas especiales por cliente.',
        outcome: 'Aplicar promociones, paquetes combo y convenios corporativos automáticamente en el Punto de Venta cumpliendo normas DTE.',
        duration: '5 min',
        modulePath: '/ventas/combos',
        roles: ['Jefe Tienda', 'Operaciones', 'Supervisor', 'Gerencia', 'Contador', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_combos', 'manage_sales_promotions', 'manage_customer_discounts', 'manage_discount_rules'],
        coverImage: 'combos-list.png',
        prerequisites: [
            'Haber creado previamente cada producto individual que integrará el combo o la promoción.'
        ],
        steps: [
            {
                title: 'Crear Combos de Productos',
                description: 'En Ventas → Descuentos y Promos → Combos de Productos haz clic en "+ Nuevo Combo". Define nombre, código/barra (en mayúsculas para búsqueda rápida en POS), sucursal y precio final del paquete; luego añade los productos componentes y sus cantidades.',
                image: 'combos-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón "+ Nuevo Combo" para armar un paquete vendible con código propio.' },
                    { n: 2, x: 21, y: 20, w: 33, h: 6, label: 'Buscador por nombre o código de barras del combo.' },
                    { n: 3, x: 21, y: 29, w: 76, h: 7, label: 'Tabla resumen: sucursal asignada, código, cantidad de ítems incluidos y precio final.' }
                ],
                tip: 'Al facturar un combo en el POS, el sistema rebaja del Kardex las existencias reales de cada producto componente automáticamente.'
            },
            {
                title: 'Configurar Promociones Comerciales automáticas en POS',
                description: 'Entra a Ventas → Descuentos y Promos → Promociones y pulsa "+ NUEVA PROMOCIÓN". Selecciona la mecánica (2x1, segunda unidad con descuento, paquete o escala), elige los productos participantes, las fechas de vigencia y las sucursales activas.',
                image: 'promotions-list.png',
                annotations: [
                    { n: 1, x: 81, y: 16, w: 14, h: 6, label: 'Botón "+ NUEVA PROMOCIÓN" para configurar campañas automáticas.' },
                    { n: 2, x: 21, y: 26, w: 74, h: 10, label: 'Recordatorio tributario: el descuento se refleja automáticamente en el campo montoDescu del DTE.' },
                    { n: 3, x: 21, y: 38, w: 74, h: 6, label: 'Filtros por nombre, tipo de oferta, sucursal y estado (Activa / Inactiva).' }
                ],
                tip: 'Cuando el cajero alcanza la cantidad mínima en el carrito del POS, la promoción se calcula sola en tiempo real.'
            },
            {
                title: 'Administrar Descuentos por Cliente (convenios)',
                description: 'Abre Ventas → Descuentos y Promos → Descuentos por Cliente para establecer descuentos fijos o precios especiales por galón/artículo para clientes frecuentes o de flota en sucursales específicas.',
                image: 'customer-discounts.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 6, label: 'Botón para crear un nuevo acuerdo de descuento por cliente y sucursal.' },
                    { n: 2, x: 21, y: 22, w: 75, h: 8, label: 'Lista de convenios vigentes mostrando cliente, producto, sucursal y descuento aplicado.' }
                ],
                tip: 'Para que aplique en caja, el vendedor solo debe seleccionar al cliente con F4 antes de agregar o cobrar los productos.'
            },
            {
                title: 'Crear Reglas de Descuento automáticas por producto y vigencia',
                description: 'Ve a Ventas → Descuentos y Promos → Reglas de Descuento y pulsa "NUEVA REGLA". Elige el producto, define si el descuento es por Porcentaje o Monto Fijo, establece las fechas de vigencia y guarda; el POS aplicará la rebaja automáticamente mientras la regla esté Activa.',
                image: 'discount-rules.png',
                annotations: [
                    { n: 1, x: 84.4, y: 15.7, w: 11, h: 4.5, label: 'Botón "NUEVA REGLA" para configurar promociones por fechas sobre un producto.' },
                    { n: 2, x: 22, y: 25.1, w: 73.4, h: 11.8, label: 'Tabla de reglas con Producto, Tipo, Valor, Vigencia, Estado y Acciones.' }
                ],
                tip: 'Las reglas por rango de fechas te permiten programar ofertas de fin de semana sin tener que modificar manualmente el precio base.'
            }
        ],
        troubleshooting: [
            { issue: 'La promoción no se activa en el POS', fix: 'Confirma que la fecha/hora actual, el día de la semana y la sucursal estén marcados como activos dentro de la promoción.' },
            { issue: 'El código de barra de un combo no responde en el lector', fix: 'Edita el combo y verifica su código de barras sin espacios; el sistema acepta búsquedas sin importar mayúsculas/minúsculas.' }
        ]
    },
    {
        slug: 'gestion-clientes',
        order: 5,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Catálogos → Clientes',
        title: 'Crear y Configurar Clientes (DUI, NIT, NRC, Distrito y Flotas)',
        summary: 'Registra clientes naturales, empresas contribuyentes o extranjeros cumpliendo todos los catálogos de Hacienda para facturar sin rechazos.',
        outcome: 'Mantener un padrón limpio de clientes con ubicación fiscal exacta, sucursales y vehículos/flotas autorizados.',
        duration: '4 min',
        modulePath: '/customers',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Auxiliar', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: ['manage_customers'],
        coverImage: 'customers-list.png',
        prerequisites: [
            'Contar con DUI o NIT/NRC, correo electrónico y giro (Actividad Económica) si el cliente requiere Crédito Fiscal (03).'
        ],
        steps: [
            {
                title: 'Buscar para evitar duplicados y registrar un cliente nuevo',
                description: 'Ingresa a Catálogos → Clientes. Antes de crear, busca por nombre, DUI, NIT o NRC en la barra superior para verificar si ya existe. Si es nuevo, presiona "+ Nuevo Cliente". También puedes descargar todo el padrón en botones "EXCEL" y "PDF".',
                image: 'customers-list.png',
                annotations: [
                    { n: 1, x: 84, y: 12, w: 14, h: 5, label: 'Botón "+ Nuevo Cliente" para abrir la ficha fiscal completa.' },
                    { n: 2, x: 21, y: 18, w: 29, h: 5, label: 'Buscador rápido por nombre, razón social, DUI, NIT o NRC.' },
                    { n: 3, x: 42, y: 31, w: 17, h: 8, label: 'Columna Ubicación: confirma que muestre Distrito, Municipio y Departamento oficiales.' },
                    { n: 4, x: 87, y: 31, w: 9, h: 6, label: 'Acciones: Editar ficha, Sucursales del cliente (edificios), Flotas/Vehículos (camión) y Eliminar.' }
                ],
                tip: 'Usa los íconos de edificios y camión en la columna Acciones para agregar múltiples sucursales de entrega y placas autorizadas por cliente.'
            },
            {
                title: 'Completar datos fiscales obligatorios ante Hacienda',
                description: 'Para Crédito Fiscal (03) son obligatorios: Razón Social, NIT válido (14 o 9 dígitos homologado), NRC, Actividad Económica, Departamento, Municipio y Distrito. Para Factura (01) de $200.00 o más es obligatorio DUI o NIT. Verifica también la Condición Fiscal (Contribuyente, Gran Contribuyente o Exento IVA).',
                image: 'customers-list.png',
                annotations: [
                    { n: 1, x: 67, y: 31, w: 10, h: 6, label: 'Columna Documento: revisa que DUI (9 dígitos) o NIT no tengan guiones incorrectos ni ceros.' },
                    { n: 2, x: 78, y: 31, w: 9, h: 6, label: 'Condición Fiscal (Contribuyente / Exento) y condición de pago (Contado o días de crédito).' }
                ],
                tip: 'Si un documento fue rechazado por Distrito faltante, corrige el cliente aquí y luego reintenta desde Historial de Ventas → Solventar DTE.'
            }
        ],
        troubleshooting: [
            { issue: 'Hacienda devuelve error en [receptor.direccion.distrito]', fix: 'Edita al cliente (y su sucursal si facturaste a una sucursal secundaria) y selecciona Departamento → Municipio → Distrito del catálogo desplegable.' },
            { issue: 'El sistema cobra IVA a un cliente exento o viceversa', fix: 'Edita el cliente y verifica su Condición Fiscal (Contribuyente vs Exento IVA) antes de volver a emitir o regenerar.' }
        ]
    },
    {
        slug: 'corte-de-caja-tienda',
        order: 6,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Ventas → Corte de Caja',
        title: 'Cómo Hacer el Corte de Caja (Apertura, Arqueo y Cierre)',
        summary: 'Abre turnos por punto de venta, asigna cajeros autorizados, realiza el arqueo detallado de efectivo/tarjetas/remesas y cierra la caja.',
        outcome: 'Cuadrar cada turno de tienda comparando el monto vendido en sistema contra el efectivo y comprobantes físicos.',
        duration: '5 min',
        modulePath: '/ventas/cierre',
        roles: ['Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_cash_closure'],
        coverImage: 'cash-closing.png',
        prerequisites: [
            'Tener configurados los Puntos de Venta (POS) y vendedores activos en la sucursal.'
        ],
        steps: [
            {
                title: 'Abrir un turno de caja ("NUEVA APERTURA")',
                description: 'En Ventas → Corte de Caja presiona "NUEVA APERTURA". Elige el Punto de Venta (ej. Tienda 1, Tienda 2), selecciona al Vendedor Responsable, marca a los cajeros adicionales del turno y registra el Fondo Inicial en efectivo con el que abre la gaveta.',
                image: 'cash-closing.png',
                annotations: [
                    { n: 1, x: 60, y: 16, w: 18, h: 6, label: 'Botón "NUEVA APERTURA" para habilitar un turno en un punto de venta.' },
                    { n: 2, x: 79, y: 16, w: 16, h: 6, label: 'Botón "VENTAS TIENDA" para consultar el resumen consolidado de tienda por fecha.' },
                    { n: 3, x: 23, y: 28, w: 35, h: 29, label: 'Tarjetas de Turnos Activos mostrando POS, responsable, fecha de apertura y fondo inicial.' }
                ],
                tip: 'Incluye a todos los cajeros que usarán esa caja para que sus contraseñas personales puedan desbloquear el POS.'
            },
            {
                title: 'Finalizar el turno y capturar el Arqueo detallado',
                description: 'Al terminar la jornada haz clic en "FINALIZAR TURNO" en la tarjeta del POS correspondiente. En el asistente de arqueo registra: Ingresos adicionales, Gastos de caja, Lotes de Tarjeta/POS, Remesas y el Efectivo físico contado por denominación.',
                image: 'cash-closing.png',
                annotations: [
                    { n: 1, x: 24, y: 51, w: 32, h: 5, label: 'Botón "FINALIZAR TURNO" para abrir el formulario de arqueo y cierre.' },
                    { n: 2, x: 23, y: 74, w: 72, h: 20, label: 'Historial de Turnos con Ventas, Esperado, Contado, Diferencia (+/-) y estado del Arqueo.' }
                ],
                tip: 'Si se emitió alguna factura adicional mientras llenabas el arqueo, presiona el botón de actualizar/recalcular ventas antes de cerrar definitivamente.'
            },
            {
                title: 'Validar diferencias e imprimir el Comprobante de Corte',
                description: 'Al guardar, el turno pasa al Historial de Turnos con estado "Realizado". Revisa la columna Diferencia y usa las acciones de la derecha para ver la hoja de arqueo, imprimir el comprobante o cruzarlo luego en Reportes → Reporte de Arqueos.',
                image: 'cash-closing.png',
                annotations: [
                    { n: 1, x: 67, y: 78, w: 22, h: 16, label: 'Columnas financieras: Ventas, Esperado, Contado, Diferencia y estado Realizado/Pendiente.' },
                    { n: 2, x: 87, y: 63, w: 8, h: 5, label: 'Botones de búsqueda por texto y filtro por fecha sobre el historial de turnos.' }
                ],
                tip: 'Un estado "Realizado" en verde confirma que el turno quedó liquidado y listo para entrega de remesas.'
            }
        ],
        troubleshooting: [
            { issue: 'El cajero no puede ingresar al POS con su clave aunque el turno esté abierto', fix: 'En Corte de Caja edita el turno activo y verifica que ese vendedor esté agregado dentro del equipo autorizado.' },
            { issue: 'La venta esperada no coincide porque faltó cerrar el turno correcto', fix: 'Verifica en la tarjeta activa la fecha/hora de inicio y qué POS corresponde a cada cajero.' }
        ]
    },
    {
        slug: 'remesas-reportes-tienda',
        order: 7,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Ventas → Entrega de Remesas y Reportes',
        title: 'Entrega de Remesas y Reportes Operativos de Tienda',
        summary: 'Consolida las remesas en efectivo de turnos de Tienda con su boleta bancaria y genera reportes oficiales en PDF y Excel por turno o arqueo.',
        outcome: 'Documentar cada depósito bancario de Tienda sin diferencias y consultar reportes por turno en PDF o Excel.',
        duration: '4 min',
        modulePath: '/ventas/entrega-remesas',
        roles: ['Vendedor', 'Jefe Tienda', 'Auxiliar', 'Asistente', 'Auditor', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_sales_remesa_delivery', 'view_sales_tienda_shift_report', 'view_arqueos_report'],
        coverImage: 'sales-remesas.png',
        prerequisites: [
            'Tener al menos un turno de Tienda cerrado con remesa registrada o contar con el número de boleta bancaria.'
        ],
        steps: [
            {
                title: 'Registrar Entrega de Remesas de Tienda',
                description: 'Ingresa a Ventas → Entrega de Remesas y pulsa "+ Nueva Entrega". Indica la persona responsable que deposita, el número de boleta/referencia bancaria, marca los sobres o turnos incluidos y verifica el Monto Entregado contra lo reportado en los arqueos.',
                image: 'sales-remesas.png',
                annotations: [
                    { n: 1, x: 86, y: 12, w: 12, h: 5, label: 'Botón "+ Nueva Entrega" para registrar la boleta bancaria de remesas de tienda.' },
                    { n: 2, x: 19, y: 18, w: 27, h: 5, label: 'Buscador por responsable o número de boleta bancaria.' },
                    { n: 3, x: 20, y: 28, w: 75, h: 10, label: 'Historial de entregas: Referencia, N° de Remesas, Monto Entregado, Diferencia y botones Ver/PDF.' }
                ],
                tip: 'Con el ícono de impresora en Acciones puedes descargar el acta de entrega en PDF para archivo de caja o contabilidad.'
            },
            {
                title: 'Emitir el reporte Ventas de Tienda por Turno y Arqueos',
                description: 'Abre Ventas → Reportes → Ventas de Tienda por Turno (o Reporte de Arqueos). Elige la sucursal y las fechas (o atajos Hoy, Ayer, Este Mes), activa "Modo Comparativo" si quieres desglosar cada factura del turno y genera la vista previa PDF o exporta a Excel.',
                image: 'store-shift-report.png',
                annotations: [
                    { n: 1, x: 21, y: 23, w: 14, h: 13, label: 'Interruptor "Modo Comparativo" (desglosa DTEs del turno) y atajos de fechas.' },
                    { n: 2, x: 21, y: 40, w: 14, h: 25, label: 'Filtros de Sucursal, Fecha Inicio y Fecha Fin de apertura del turno.' },
                    { n: 3, x: 40, y: 23, w: 54, h: 66, label: 'Visor PDF integrado con botón Expandir en cabecera y descarga en Excel.' }
                ],
                tip: 'El reporte "Ventas de Tienda por Turno" lee exclusivamente los puntos de venta de Tienda para facilitar el cuadre diario.'
            }
        ],
        troubleshooting: [
            { issue: 'No encuentro ventas de combustible en Ventas de Tienda por Turno', fix: 'Es esperado: este reporte filtra solo los POS de Tienda; para pista usa Gasolinera → Reportes.' },
            { issue: 'Aparece diferencia al consolidar una remesa', fix: 'Revisa los montos individuales de cada turno seleccionado antes de confirmar o anota la explicación en el campo Comentario.' }
        ]
    },
    {
        slug: 'eventos-mh-contingencia-eret',
        order: 8,
        category: 'tienda',
        categoryLabel: 'Tienda y POS',
        requiredModule: 'sales',
        menuPath: 'Ventas → Eventos MH y DTEs por Turno',
        title: 'Contingencia DTE, Eventos de Retorno (ERET) y DTEs por Turno',
        summary: 'Aprende cómo actuar cuando falla el internet o Hacienda (Contingencia), cómo registrar devoluciones o rechazos mediante ERET y cómo reasignar DTEs a otro turno.',
        outcome: 'Mantener la facturación continua sin pérdidas ante caídas de red, emitir ERET correctamente y cuadrar DTEs entre turnos.',
        duration: '5 min',
        modulePath: '/ventas/contingencia',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_dte_contingency', 'manage_dte_return', 'manage_dte_shift_change'],
        coverImage: 'sales-contingency.png',
        prerequisites: [
            'Tener permisos de Contingencia DTE, Retorno/ERET o DTEs por Turno asignados según tu rol.'
        ],
        steps: [
            {
                title: 'Activar y cerrar Contingencia cuando no hay conexión con Hacienda',
                description: 'Si falla el internet o los servidores del Ministerio de Hacienda no responden, entra a Ventas → Eventos MH → Contingencia DTE y presiona "ACTIVAR CONTINGENCIA" eligiendo el motivo. El POS seguirá emitiendo documentos guardándolos localmente; al volver la red, finaliza el evento para transmitir todo el lote en automático.',
                image: 'sales-contingency.png',
                annotations: [
                    { n: 1, x: 74.4, y: 15.9, w: 16.7, h: 4.5, label: 'Botón "ACTIVAR CONTINGENCIA" para iniciar o cerrar el período de contingencia.' },
                    { n: 2, x: 26.4, y: 46.1, w: 64.6, h: 11.8, label: 'Historial de Contingencias con fechas de inicio/fin, motivo oficial y estado de envío.' }
                ],
                tip: 'Mientras una contingencia está activa no detengas la venta en caja: todos los DTE pendientes se envían automáticamente cuando cierras el evento.'
            },
            {
                title: 'Registrar un Evento de Retorno (ERET)',
                description: 'Cuando necesites notificar a Hacienda una devolución o aceptación parcial fuera de plazo de invalidación (o según flujo ERET autorizado), abre Ventas → Eventos MH → Retorno / ERET y pulsa "NUEVO ERET". Busca la factura por fecha, hora, cliente o número, indica el motivo y transmite el evento.',
                image: 'sales-eret.png',
                annotations: [
                    { n: 1, x: 87.6, y: 11.8, w: 10.2, h: 4.1, label: 'Botón "NUEVO ERET" para buscar el DTE afectado y transmitir el evento.' },
                    { n: 2, x: 21.1, y: 38.8, w: 75, h: 4.5, label: 'Buscador por código, control o cliente y filtro de estado ante Hacienda.' },
                    { n: 3, x: 21.2, y: 45, w: 74.9, h: 11.8, label: 'Tabla de Eventos de Retorno emitidos con DTE original, sello y acciones PDF.' }
                ],
                tip: 'Usa siempre el buscador avanzado por rango de fecha y hora para ubicar el DTE exacto antes de transmitir el ERET.'
            },
            {
                title: 'Mover o verificar DTEs por Turno',
                description: 'Si un vendedor facturó temporalmente en otro turno o necesitas revisar qué facturas pertenecen a un cierre específico, ingresa a Ventas → DTEs por Turno, presiona "SELECCIONAR TURNO" y reasigna los comprobantes que correspondan al turno correcto para cuadrar el corte de caja.',
                image: 'sales-shift-dtes.png',
                annotations: [
                    { n: 1, x: 81.8, y: 23.1, w: 14.3, h: 4.1, label: 'Botón "SELECCIONAR TURNO" para cargar los DTEs emitidos en ese turno.' }
                ],
                tip: 'Verifica el resultado inmediatamente en Reportes → Ventas de Tienda por Turno o Reporte de Arqueos.'
            }
        ],
        troubleshooting: [
            { issue: 'Los DTE acumulados en contingencia no se envían al volver internet', fix: 'Ingresa a Contingencia DTE y finaliza/cierra el evento activo para que se dispare el informe a Hacienda y el reenvío de la cola.' },
            { issue: 'No encuentro un DTE en Nuevo ERET', fix: 'Amplía el rango de fechas o filtra por nombre parcial del cliente o los últimos dígitos del número de control.' }
        ]
    },
    {
        slug: 'cierre-lecturas-pista',
        order: 9,
        category: 'pista',
        categoryLabel: 'Pista / Gasolinera',
        requiredModule: 'gas_station',
        menuPath: 'Gasolinera → Cierre Lecturas',
        title: 'Cómo Hacer el Cierre de Lecturas de Pista (Paso a Paso)',
        summary: 'Abre el turno de pista, asigna mangueras por despachador, digita lecturas finales, registra varillaje de tanques, liquida medios de pago y cierra el turno.',
        outcome: 'Generar un cierre de pista cuadrado sin diferencias ocultas entre galones despachados, tanques y dinero recibido.',
        duration: '7 min',
        modulePath: '/gas-station/cierre-lecturas',
        roles: ['Jefe Pista', 'Auxiliar', 'Supervisor', 'Gerencia', 'Contador', 'Admin'],
        requiredPermissions: ['manage_gas_readings_closure'],
        coverImage: 'gas-closeout-sheet.png',
        prerequisites: [
            'Confirmar en Ventas → Precios de Combustible que los precios por galón estén actualizados antes de abrir el turno.',
            'Tener definida la asignación en Gasolinera → Catálogos → Mangueras x Despachador y los comprobantes físicos del turno.'
        ],
        steps: [
            {
                title: 'Iniciar un nuevo Cierre de Lecturas de pista',
                description: 'Entra a Gasolinera → Cierre Lecturas. En la parte superior verás el último turno cerrado para seguir el correlativo. Selecciona el Vendedor responsable, confirma Fecha y Número de Turno (1, 2 o 3), agrega a los Despachadores del turno y haz clic en "Iniciar Lectura".',
                image: 'gas-closeout.png',
                annotations: [
                    { n: 1, x: 42, y: 29, w: 35, h: 6, label: 'Referencia del Último Turno cerrado para evitar turnos repetidos o saltos.' },
                    { n: 2, x: 42, y: 37, w: 35, h: 24, label: 'Selector de Vendedor responsable, Fecha de Turno y Número de Turno.' },
                    { n: 3, x: 42, y: 63, w: 35, h: 10, label: 'Despachadores del turno (con enlace "Configurar Mangueras") y botón "Iniciar Lectura".' }
                ],
                tip: 'Si un pistero cambió de isla ese día, haz clic en "Configurar Mangueras" antes de iniciar para que sus galones se asignen bien.'
            },
            {
                title: 'Capturar Lecturas de Mangueras, Tanques y Lubricantes',
                description: 'En la hoja de trabajo usa la botonera derecha "OPCIONES DEL TURNO". Entra primero a "LECTURAS" para digitar los numeradores finales de cada manguera (o sincronizar desde Fusion FFC), luego registra el varillaje físico en "TANQUES" y si vendieron aceites o aditivos agrégalos en "LUBRICANTES".',
                image: 'gas-closeout-sheet.png',
                annotations: [
                    { n: 1, x: 19.5, y: 18, w: 56.5, h: 33, label: 'Resumen en tiempo real por combustible: Precio, Galones vendidos y Total en dólares.' },
                    { n: 2, x: 78, y: 22.5, w: 18, h: 7.5, label: 'Botón "LECTURAS" (mangueras) y botón "GASTOS" operativos de pista.' },
                    { n: 3, x: 78, y: 52, w: 18, h: 14, label: 'Acceso a "LUBRICANTES" (arriba derecha) y "TANQUES" (varillaje físico abajo izquierda).' }
                ],
                tip: 'Compara siempre el total de galones con la línea informativa de Fusion FFC (si tu estación usa controlador) antes de avanzar a los pagos.'
            },
            {
                title: 'Registrar Remesas, Tarjetas, Cupones, Créditos, Vales y Trupput',
                description: 'Desde la botonera derecha carga todos los documentos recibidos durante el turno: REMESAS, TARJETAS, CUPONES, CRÉDITOS, VALES, DESCUENTOS, ADELANTOS, ANTICIPOS DESP., CHEQUES y TRUPPUT. Cada ventana suma automáticamente en el cuadro EGRESOS.',
                image: 'gas-closeout-sheet.png',
                annotations: [
                    { n: 1, x: 20, y: 53, w: 28, h: 33, label: 'Panel INGRESOS: suma automática de Combustible + Lubricantes del turno.' },
                    { n: 2, x: 49, y: 53, w: 27, h: 43, label: 'Panel EGRESOS: desglose de Créditos, Vales, Remesas, Tarjetas, Cupones, Anticipos y Gastos.' },
                    { n: 3, x: 78, y: 30, w: 18, h: 46, label: 'Botones de descarga: Cupones, Créditos, Vales, Descuentos, Anticipos, Trupput, Remesas y Tarjetas.' }
                ],
                tip: 'Usa el botón "LECTURAS/VTAS" (al pie de la botonera) para ver el balance individual de cada despachador e identificar rápido quién tiene sobrante o faltante.'
            },
            {
                title: 'Validar el cuadre, Cerrar Turno e Imprimir el PDF oficial',
                description: 'Revisa al pie la comparación entre TOTAL INGRESOS y TOTAL EGRESOS. Cuando las diferencias estén justificadas y cuadradas, cambia el estado en la parte superior derecha para finalizar como "CERRADO" e imprime el comprobante PDF desde el ícono de impresora.',
                image: 'gas-closeout-sheet.png',
                annotations: [
                    { n: 1, x: 86, y: 12, w: 11, h: 5, label: 'Estado del turno (ABIERTO / CERRADO) e ícono impresora para generar PDF del cierre.' },
                    { n: 2, x: 49, y: 94, w: 27, h: 5, label: 'Comparación final de TOTAL EGRESOS frente a TOTAL INGRESOS.' }
                ],
                tip: 'Una vez CERRADO, el turno queda bloqueado contra cambios accidentales; cualquier reapertura posterior queda auditada con motivo y usuario.'
            }
        ],
        troubleshooting: [
            { issue: 'Aparece diferencia negativa en un despachador en LECTURAS/VTAS', fix: 'Verifica si el despachador registró sus vales/créditos/tarjetas bajo otro nombre o si faltó ingresar una remesa en efectivo.' },
            { issue: 'El precio de un combustible no corresponde al turno actual', fix: 'Actualiza la pizarra en Ventas → Precios de Combustible y utiliza el botón de actualización de precios dentro del cierre.' }
        ]
    },
    {
        slug: 'historial-lecturas-reportes-pista',
        order: 10,
        category: 'pista',
        categoryLabel: 'Pista / Gasolinera',
        requiredModule: 'gas_station',
        menuPath: 'Gasolinera → Historial de Lecturas y Reportes',
        title: 'Historial de Lecturas, Precios de Combustible y Reportes de Pista',
        summary: 'Consulta cierres pasados con su auditoría de cambios, actualiza precios de venta por estación y emite los reportes oficiales de galonaje e inventario.',
        outcome: 'Supervisar cierres cerrados, actualizar pizarras de precios por sucursal y descargar reportes de combustible en PDF y Excel.',
        duration: '4 min',
        modulePath: '/gas-station/historial-lecturas',
        roles: ['Jefe Pista', 'Auxiliar', 'Supervisor', 'Gerencia', 'Contador', 'Admin'],
        requiredPermissions: ['view_gas_readings_history', 'view_gas_fuel_sales_report', 'manage_gas_readings_closure'],
        coverImage: 'gas-readings-history.png',
        prerequisites: [
            'Tener acceso al Historial de Lecturas, Precios de Combustible o Reportes de Gasolinera.'
        ],
        steps: [
            {
                title: 'Buscar cierres en el Historial de Lecturas y revisar cambios',
                description: 'En Gasolinera → Historial de Lecturas filtra por turno o vendedor. La tabla muestra Galones Vendidos, Total Monto, Diferencia (+/-), estado de envío RRS y una etiqueta en "CAMBIOS" si fue reabierto. En Acciones puedes abrir el cierre (ojo), imprimir PDF o gestionar el candado.',
                image: 'gas-readings-history.png',
                annotations: [
                    { n: 1, x: 20, y: 18, w: 29, h: 5, label: 'Buscador rápido por número de turno o nombre del vendedor responsable.' },
                    { n: 2, x: 49, y: 25, w: 26, h: 16, label: 'Columnas clave: Galones Vendidos, Total Monto, Diferencia y estado RRS.' },
                    { n: 3, x: 84, y: 29, w: 12, h: 6, label: 'Acciones: Candado (reapertura autorizada), Envío RRS, Ver cierre e Imprimir PDF.' }
                ],
                tip: 'Si ves la insignia "1 CAMBIO" en la columna CAMBIOS, haz clic para consultar qué usuario reabrió o modificó el cierre y por qué motivo.'
            },
            {
                title: 'Actualizar Precios de Combustible por sucursal',
                description: 'Abre Ventas → Precios de Combustible. La pantalla muestra únicamente los combustibles de tu sucursal activa (Puma San Martin II, Shell, etc.). Edita el campo "PRECIO VENTA ($)" en cada tipo y haz clic en "Guardar Cambios".',
                image: 'fuel-prices.png',
                annotations: [
                    { n: 1, x: 80, y: 11, w: 17, h: 6, label: 'Botón "Guardar Cambios" para aplicar de inmediato los nuevos precios vigentes.' },
                    { n: 2, x: 83, y: 29, w: 12, h: 12, label: 'Campos editables de Precio Venta ($) por cada combustible de la estación.' }
                ],
                tip: 'Cada sucursal administra su propia lista de precios; asegúrate en la barra superior de estar ubicado en la estación correcta.'
            },
            {
                title: 'Emitir el reporte Lecturas - Ventas y los reportes gerenciales de Pista',
                description: 'En Gasolinera → Reportes → Lecturas - Ventas (y demás reportes de pista como Detalle del Cierre, Inventario Combustible, Galonaje Vendido y Cierre Diario), selecciona la Fecha y el Número de Turno (deja 0 para incluir todos los turnos del día) y presiona "Consultar" para ver o exportar.',
                image: 'gas-fuel-sales-report.png',
                annotations: [
                    { n: 1, x: 20, y: 18, w: 18, h: 9, label: 'Filtros de Fecha del cierre y Número de Turno (0 = todos los turnos del día).' },
                    { n: 2, x: 38.3, y: 22.4, w: 7.2, h: 3.2, label: 'Botón "Consultar" para cargar el comparativo completo en pantalla y habilitar exportación.' }
                ],
                tip: 'Utiliza "Inventario Combustible" para contrastar las existencias teóricas del sistema contra el varillaje físico registrado en tanques.'
            }
        ],
        troubleshooting: [
            { issue: 'El botón de edición aparece bloqueado dentro de un cierre', fix: 'Por auditoría los turnos CERRADOS no permiten edición directa; solicita a Gerencia o SuperAdmin reabrirlo desde el ícono candado.' },
            { issue: 'No aparecen datos al consultar Lecturas - Ventas', fix: 'Confirma que el Turno sea 0 (todos) o coincida con el número exacto del cierre en esa fecha.' }
        ]
    },
    {
        slug: 'remesas-cupones-anticipos-pista',
        order: 11,
        category: 'pista',
        categoryLabel: 'Pista / Gasolinera',
        requiredModule: 'gas_station',
        menuPath: 'Gasolinera → Entrega de Remesas / Cupones / Anticipos / Trupput',
        title: 'Remesas de Pista, Cupones, Anticipos de Clientes y Trupput',
        summary: 'Consolida depósitos bancarios de pista, concilia cupones físicos contra lo reportado por despachadores, gestiona saldos prepagados y recargas Trupput.',
        outcome: 'Controlar al centavo cada medio especial de cobro y depósito bancario en la operación de gasolinera.',
        duration: '5 min',
        modulePath: '/gas-station/entrega-remesas',
        roles: ['Jefe Pista', 'Jefe Tienda', 'Auxiliar', 'Supervisor', 'Gerencia', 'Contador', 'Admin'],
        requiredPermissions: ['manage_gas_remesa_delivery', 'manage_gas_coupon_liquidation', 'manage_gas_advances', 'manage_gas_trupput'],
        coverImage: 'gas-remesas.png',
        prerequisites: [
            'Tener cierres de lecturas guardados donde se hayan ingresado remesas, cupones, anticipos o despachos Trupput.'
        ],
        steps: [
            {
                title: 'Consolidar y entregar Remesas de Pista',
                description: 'En Gasolinera → Entrega de Remesas haz clic en "+ Nueva Entrega". Marca las remesas provenientes de los cierres de pista, escribe el número de boleta del banco y el nombre del responsable, y confirma para generar el comprobante imprimible en PDF.',
                image: 'gas-remesas.png',
                annotations: [
                    { n: 1, x: 86, y: 12, w: 12, h: 5, label: 'Botón "+ Nueva Entrega" para consolidar remesas de pista en una boleta bancaria.' },
                    { n: 2, x: 20, y: 28, w: 76, h: 12, label: 'Historial de entregas: Fecha, Responsable, Boleta/Referencia, N° Remesas, Monto y PDF.' }
                ],
                tip: 'Desde la lupa o impresora de Acciones puedes revisar qué sobres exactos de cada turno respaldan un depósito bancario.'
            },
            {
                title: 'Conciliar Liquidación de Cupones (Sistema vs Físico)',
                description: 'Entra a Gasolinera → Liquidación de Cupones y pulsa "+ Nueva Liquidación". El sistema carga los cupones digitados en los turnos de pista para que ingreses el conteo físico recibido y controles cualquier faltante o diferencia acumulada.',
                image: 'gas-coupons.png',
                annotations: [
                    { n: 1, x: 84, y: 14, w: 13, h: 6, label: 'Botón "+ Nueva Liquidación" para iniciar un arqueo de cupones.' },
                    { n: 2, x: 20, y: 22, w: 76, h: 10, label: 'Tarjetas resumen: Total Sistema, Total Físico Recibido, Diferencia Acumulada y Actas.' }
                ],
                tip: 'Puedes filtrar por Distribuidora, Sucursal y rango de fechas antes de crear o auditar actas.'
            },
            {
                title: 'Administrar Anticipos de Clientes de Combustible',
                description: 'En Gasolinera → Anticipos de Clientes haz clic en "+ Nuevo Anticipo" para registrar pagos por adelantado de clientes flotilleros. La tabla muestra cuánto abonó el cliente, cuánto ha consumido en cierres de pista y su saldo disponible en verde.',
                image: 'gas-advances.png',
                annotations: [
                    { n: 1, x: 79, y: 11, w: 19, h: 5, label: 'Botón "Ver Reporte" (resumen PDF) y botón "+ Nuevo Anticipo" para abonos prepagados.' },
                    { n: 2, x: 19.5, y: 22.5, w: 78, h: 20, label: 'Listado con Desglose de Pago, Total abonado, Disponible en verde, Utilizado e impresión PDF.' }
                ],
                tip: 'Cada vez que en un cierre de lecturas se carga un consumo en ANTICIPOS DESP., el saldo disponible de ese cliente baja automáticamente.'
            },
            {
                title: 'Controlar Trupput (Prepago por Galonaje)',
                description: 'En Gasolinera → Trupput (Galonaje) presiona "+ Nueva Recarga" para registrar galones prepagados por clientes con tarifa pactada. Conforme el cliente retira combustible en los cierres de pista, el sistema descuenta los galones utilizados del saldo disponible.',
                image: 'gas-trupput.png',
                annotations: [
                    { n: 1, x: 87, y: 11.5, w: 11, h: 4.5, label: 'Botón "+ Nueva Recarga" para acreditar galones prepagados a un cliente Trupput.' },
                    { n: 2, x: 19.5, y: 22, w: 78, h: 13, label: 'Tabla de control: Cliente, Galones pactados, Precio, Monto, Disponible y Usado.' }
                ],
                tip: 'Verifica que el cliente esté configurado como Trupput para que aparezca al registrar despachos dentro del Cierre de Lecturas.'
            }
        ],
        troubleshooting: [
            { issue: 'No aparecen cupones disponibles para liquidar', fix: 'Confirma que el rango de fechas DESDE / HASTA incluya los turnos donde se ingresaron cupones y que la sucursal seleccionada coincida.' },
            { issue: 'El saldo disponible de un anticipo no disminuye', fix: 'Asegúrate de haber ingresado el consumo del cliente dentro de "ANTICIPOS DESP." en el Cierre de Lecturas y guardado el turno.' }
        ]
    },
    {
        slug: 'gasolinera-catalogos-config-pedidos',
        order: 34,
        category: 'pista',
        categoryLabel: 'Gasolinera y Pista',
        requiredModule: 'gas_station',
        menuPath: 'Gasolinera → Catálogos (Mangueras, Tanques, Despachadores) y Pedidos',
        title: 'Gasolinera: Catálogos de Pista, Mangueras por Despachador y Pedidos',
        summary: 'Administra el catálogo maestro de pistolas/mangueras y tanques subterráneos, asigna mangueras habituales a cada despachador y da seguimiento a pedidos de combustible.',
        outcome: 'Mantener actualizada la configuración física de la estación (islas, tanques y mangueras) y controlar los pedidos de pipa recibidos.',
        duration: '5 min',
        modulePath: '/gas-station/nozzles',
        roles: ['Jefe Pista', 'Supervisor', 'Gerencia', 'Operaciones', 'Admin'],
        requiredPermissions: ['manage_gas_nozzles', 'manage_gas_tanks', 'manage_gas_islands', 'manage_gas_attendants', 'manage_gas_attendant_nozzles', 'view_gas_orders', 'manage_gas_settings'],
        coverImage: 'gas-nozzles.png',
        prerequisites: [
            'Tener creados los productos de combustible (Regular, Súper, Diésel) e impuestos FOVIAL/COTRANS en Inventario.'
        ],
        steps: [
            {
                title: 'Configurar Mangueras / Pistolas y Tanques de Combustible',
                description: 'En Gasolinera → Catálogos abre "Pistolas / Mangueras" o "Tanques". Usa "Nueva Pistola" para vincular el código de bomba, isla y producto de combustible, y "Nuevo Tanque" para definir capacidad nominal, reserva mínima y combustible almacenado en cada tanque.',
                image: 'gas-nozzles.png',
                annotations: [
                    { n: 1, x: 87.7, y: 11.6, w: 10.1, h: 3.6, label: 'Botón "Nueva Pistola" para registrar mangueras nuevas asociadas a una isla y producto.' },
                    { n: 2, x: 19.6, y: 22.3, w: 78.1, h: 35, label: 'Catálogo de pistolas mostrando Código, Descripción, Tipo, Isla, Producto y Acciones.' }
                ],
                tip: 'Cada tanque también se administra desde Gasolinera → Catálogos → Tanques usando el botón "Nuevo Tanque" para mantener las capacidades reales de varilla.'
            },
            {
                title: 'Revisar Tanques Subterráneos y Reservas',
                description: 'Entra a Gasolinera → Catálogos → Tanques para consultar capacidad máxima y nivel de reserva por combustible. Estos topes permiten calcular faltantes de inventario y pedidos de reposición.',
                image: 'gas-tanks.png',
                annotations: [
                    { n: 1, x: 87.4, y: 11.6, w: 10.5, h: 3.6, label: 'Botón "Nuevo Tanque" para agregar un tanque de almacenamiento subterráneo.' },
                    { n: 2, x: 19.6, y: 22.3, w: 78.1, h: 18.1, label: 'Listado de tanques con Capacidad, Reserva mínima, Combustible y botones Editar/Eliminar.' }
                ],
                tip: 'Mantén exacto el dato de Reserva de cada tanque para que los alertas de nivel bajo te avisen antes de quedarte sin producto.'
            },
            {
                title: 'Asignar Mangueras Habituales a cada Despachador',
                description: 'En Gasolinera → Catálogos → Mangueras por Despachador selecciona al pistero en el desplegable superior y marca las pistolas/islas que opera normalmente. Así, al cargar lecturas de turno, el sistema preasignará sus bombas automáticamente.',
                image: 'gas-attendant-nozzles.png',
                annotations: [
                    { n: 1, x: 31.4, y: 26.8, w: 54.5, h: 4.2, label: 'Selector de Despachador: elige al pistero para editar sus mangueras asignadas.' }
                ],
                tip: 'Puedes actualizar las islas y despachadores activos desde Gasolinera → Catálogos → Islas y Despachadores antes de hacer esta asignación.'
            },
            {
                title: 'Dar seguimiento a Pedidos de Combustible en Pista',
                description: 'Ingresa a Gasolinera → Pedidos de Combustible para consultar los pedidos programados y recibidos. Usa las pestañas de estado ("Pendientes / Vistos", "Recibidos", "Todos"), el buscador por proveedor o pipa, y presiona "Actualizar" para ver descargas confirmadas.',
                image: 'gas-orders.png',
                annotations: [
                    { n: 1, x: 87.1, y: 17.6, w: 7.2, h: 3.6, label: 'Botón "Actualizar" para refrescar el estado de pedidos y descargas.' },
                    { n: 2, x: 23.1, y: 46.1, w: 71.4, h: 3.9, label: 'Pestañas por estado (Pendientes / Vistos, Recibidos, Todos) y filtros de fecha.' },
                    { n: 3, x: 21.8, y: 55.1, w: 73.8, h: 14.6, label: 'Tabla de pedidos de pipa con detalle de galones solicitados vs recibidos.' }
                ],
                tip: 'Los parámetros generales de la estación (tipos de combustible y tolerancias) se ajustan en Gasolinera → Configuración.'
            }
        ],
        troubleshooting: [
            { issue: 'Una manguera nueva no aparece al registrar lecturas de turno', fix: 'Verifica que la manguera tenga asignada una Isla activa y el producto correcto de combustible en Gasolinera → Catálogos → Pistolas.' },
            { issue: 'Un pedido de pipa ya llegó pero sigue como pendiente', fix: 'Confirma que la descarga haya sido marcada como recibida desde la compra o recepción de tanques y pulsa "Actualizar".' }
        ]
    }
];

module.exports = TIENDA_PISTA_TUTORIALS;
