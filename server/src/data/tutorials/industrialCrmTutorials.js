/**
 * Tutoriales Fase 2: Planta de Huevo Industrial y CRM Comercial (#22 - #25)
 */

const INDUSTRIAL_CRM_TUTORIALS = [
    {
        slug: 'industrial-recepcion-baja-tarimas',
        order: 22,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Dashboard Planta Andelsa / Huevo Industrial → Panel SCADA, Recepción MP y Baja de Tarimas',
        title: 'ANDELSA: Dashboard Planta, Monitoreo SCADA, Recepción MP y Baja de Tarimas',
        summary: 'Supervisa indicadores diarios en Dashboard Andelsa, monitorea el Panel IoT/SCADA, registra ingresos de huevo por granja en Recepción MP y vincula facturas para dar de baja tarimas.',
        outcome: 'Controlar el arranque diario de planta, los puntos críticos de temperatura y la trazabilidad exacta de cada tarima recibida desde granja.',
        duration: '6 min',
        modulePath: '/industrial/recepcion',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['view_dashboard_andelsa', 'view_industrial_dashboard', 'manage_mp_reception', 'manage_egg_tarima_writeoffs'],
        coverImage: 'dashboard-andelsa.png',
        prerequisites: [
            'Tener configurados proveedores/granjas, tipos de huevo y prefijos de lotes en Huevo Industrial → Ajustes.'
        ],
        steps: [
            {
                title: 'Revisar KPIs diarios de Planta en Dashboard → Dashboard Planta Andelsa',
                description: 'Al ingresar a Dashboard → pestaña "Andelsa" ves al instante el Costo Promedio del Mes ($/lb), Lotes en Proceso, Despachos de Hoy y Mañana, Liberaciones de Calidad pendientes, Preparación de Bodega para los próximos 7 días y el Pipeline de Lotes Activos en pasteurizadora.',
                image: 'dashboard-andelsa.png',
                annotations: [
                    { n: 1, x: 40.8, y: 12.1, w: 8.1, h: 4.2, label: 'Pestaña "Andelsa" en el Dashboard principal (también configurable como inicio automático del rol).' },
                    { n: 2, x: 20, y: 31, w: 76, h: 17, label: 'Indicadores ejecutivos: Costo Promedio/lb, Lotes en Proceso, Despachos y Liberación de Calidad.' },
                    { n: 3, x: 20, y: 49, w: 76, h: 45, label: 'Control de Despacho Hoy/Mañana, Preparación de Bodega (7 días) y Pipeline de Lotes Activos.' }
                ],
                tip: 'Desde Preparación Bodega (Próx. 7 días) anticipas cuánta materia prima (MP) e insumos debes alistar según pedidos confirmados.'
            },
            {
                title: 'Monitorear temperaturas y puntos críticos (PCC) en Panel IoT / SCADA',
                description: 'Entra a Huevo Industrial → Panel IoT / SCADA para vigilar en vivo las temperaturas de pasteurización, flujo y tanques pulmón/almacenamiento, así como las alertas térmicas. Arriba puedes abrir el Calendario de Producción o restablecer lecturas de simulación.',
                image: 'egg-planta.png',
                annotations: [
                    { n: 1, x: 70.3, y: 22.3, w: 24.8, h: 5.7, label: 'Accesos a "Calendario de Producción" y "Restablecer Lecturas".' },
                    { n: 2, x: 21.1, y: 36.9, w: 54.2, h: 25, label: 'Esquema de Etapas del Proceso Productivo y Puntos Críticos de Control (PCC).' },
                    { n: 3, x: 80.4, y: 36.9, w: 14.7, h: 48, label: 'Panel derecho de Control de Equipos & Pruebas de alerta térmica.' }
                ],
                tip: 'Vigila que los Tanques Pulmón se mantengan dentro de la banda segura de frío antes de enviar producto a envasado.'
            },
            {
                title: 'Registrar Recepción de Materia Prima (Huevo en Cáscara / Líquido)',
                description: 'Abre Huevo Industrial → Recepción MP y pulsa "Nueva Recepción". Ingresa granja/proveedor, lote de granja, tipo de huevo, cantidad de cajas y peso en libras por tarima; la fila quedará pendiente de revisión hasta recibir aprobación de Calidad (LAB-004).',
                image: 'egg-recepcion.png',
                annotations: [
                    { n: 1, x: 84.8, y: 14.8, w: 10.3, h: 4.1, label: 'Botón "Nueva Recepción" para registrar un ingreso de materia prima (MP) con sus tarimas.' },
                    { n: 2, x: 73.5, y: 28.3, w: 21.6, h: 3.9, label: 'Buscador por proveedor, lote o tipo de huevo.' },
                    { n: 3, x: 85.2, y: 44.4, w: 14.6, h: 16, label: 'Estado de Calidad (Pendiente / Grado AA/A) y botón para Ver Detalle y Tarimas.' }
                ],
                tip: 'Cada tarima recibe un código único identificable para su traslado entre bodegas o envío directo a quebrado.'
            },
            {
                title: 'Vincular Facturas y Dar de Baja Tarimas de Materia Prima',
                description: 'En Huevo Industrial → Facturas y Baja de Tarimas selecciona las tarimas físicas en la pestaña "Lotes y Tarimas Disponibles" (puedes filtrar por Ubicación como Bodega Abajo o Bodega Arriba) y presiona "Vincular Factura / Dar de Baja" para respaldar su consumo o liquidación contra la factura de compra.',
                image: 'egg-baja-tarimas.png',
                annotations: [
                    { n: 1, x: 73.2, y: 14.1, w: 22.2, h: 4.1, label: 'Botón "Actualizar" y acceso principal "Vincular Factura / Dar de Baja".' },
                    { n: 2, x: 19.5, y: 38.5, w: 61.6, h: 14, label: 'Pestañas Disponibles/Historial, buscador por lote/tarima y filtro por bodega.' },
                    { n: 3, x: 20.6, y: 72, w: 75, h: 25, label: 'Tarjetas interactivas por tarima (#01, #02...) mostrando cajas, libras y estado.' }
                ],
                tip: 'Todas las bajas registradas quedan consultables en la pestaña "Historial de Bajas y Facturas" sin alterar los lotes ya cerrados.'
            }
        ],
        troubleshooting: [
            { issue: 'Una tarima recibida no aparece disponible para producción', fix: 'Revisa en Recepción MP si su evaluación de Calidad sigue en "Pendiente Calidad"; Calidad debe aprobarla primero.' },
            { issue: 'Falta un prefijo de lote al registrar la recepción', fix: 'Configura el prefijo correspondiente en Huevo Industrial → Ajustes → Prefijos de Lote por Proveedor.' }
        ]
    },
    {
        slug: 'industrial-produccion-empaque-trazabilidad',
        order: 23,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Producción y Pasteurización, Sanitización CIP y Empaque / Blast Freezer',
        title: 'ANDELSA: Sanitización CIP, Producción, Pasteurización y Empaque / Congelado',
        summary: 'Documenta lavados CIP previos al arranque, opera lotes de quebrado y pasteurización, gestiona ediciones controladas de lotes cerrados/reutilizables y registra Empaque y Blast Freezer.',
        outcome: 'Completar el ciclo productivo desde sanitización CIP y quebrado hasta producto terminado envasado o congelado, listo en inventario.',
        duration: '6 min',
        modulePath: '/industrial/produccion',
        roles: ['Produccion', 'Calidad', 'Supervisor', 'Gerencia', 'Operaciones', 'Bodega', 'Admin'],
        requiredPermissions: ['manage_production', 'manage_packaging', 'manage_egg_production_lots', 'manage_egg_closed_batch_edit', 'manage_egg_cip_exception'],
        coverImage: 'egg-produccion.png',
        prerequisites: [
            'Contar con tarimas de materia prima (MP) aprobadas por Calidad y lavado CIP vigente (o autorización excepcional de Calidad).'
        ],
        steps: [
            {
                title: 'Documentar Limpieza y Sanitización CIP antes de arrancar planta',
                description: 'En Huevo Industrial → Producción y Pasteurización abre la pestaña "Registros de Sanitización (CIP)". Selecciona el equipo (Pasteurizador de Placas, Quebradora, Centrífuga, Tanques Pulmón), registra el químico CIP (ej. Ácido Peracético), temperatura, minutos y resultado ("Completado y Aprobado") antes de iniciar corrida.',
                image: 'egg-produccion-cip.png',
                annotations: [
                    { n: 1, x: 29.9, y: 26.5, w: 13.7, h: 3.6, label: 'Pestaña "Registros de Sanitización (CIP)" para validar limpieza pre-operacional.' },
                    { n: 2, x: 21.1, y: 36.3, w: 22, h: 61, label: 'Formulario "REGISTRAR LIMPIEZA CIP": equipo, químico, temperatura, tiempo y estado.' },
                    { n: 3, x: 47.5, y: 36.3, w: 47.7, h: 50, label: 'Historial de sanitizaciones CIP recientes y estado de aprobación para arrancar.' }
                ],
                tip: 'Si necesitas operar por contingencia sin registro CIP reciente, el rol Calidad cuenta con el permiso especial para autorizar una Excepción CIP.'
            },
            {
                title: 'Crear Lotes de Quebrado, Pasteurizar y editar lotes controlados',
                description: 'Regresa a la pestaña "Lotes de Producción". Pulsa "+ Iniciar Nueva Producción" para cargar tarimas al quebrado y "Pasteurizar" para iniciar el proceso térmico sobre lotes formulados. Al abrir el detalle de un lote puedes realizar cierres de pasteurización o ediciones autorizadas de lotes cerrados/reutilizables con bitácora de impacto.',
                image: 'egg-produccion.png',
                annotations: [
                    { n: 1, x: 19.8, y: 26.2, w: 23.5, h: 4.5, label: 'Alternador entre "Lotes de Producción" y "Registros de Sanitización (CIP)".' },
                    { n: 2, x: 62.5, y: 26.2, w: 35.5, h: 4.5, label: 'Accesos a Calendario de Producción, "+ Iniciar Nueva Producción" y "Pasteurizar".' },
                    { n: 3, x: 76.5, y: 36, w: 19.8, h: 4.2, label: 'Buscador rápido del historial de procesamiento por lote juliano, comercial o producto.' }
                ],
                tip: 'Toda modificación excepcional sobre un lote cerrado o reutilizable queda auditada automáticamente en la bitácora del lote con sus afectaciones.'
            },
            {
                title: 'Registrar Empaque Final y Congelado rápido (Blast Freezer)',
                description: 'Abre Huevo Industrial → Empaque y Congelado. Presiona "Registrar Envasado" para empacar el lote pasteurizado en baldes, bolsas o cajas (descontando automáticamente los empaques de Insumos y enviando producto terminado a Inventario). Si el producto va congelado, usa el botón "Blast Freezer" para registrar el ciclo de congelación.',
                image: 'egg-empaque.png',
                annotations: [
                    { n: 1, x: 76.5, y: 15.2, w: 19.7, h: 3.6, label: 'Botones "Registrar Envasado" (producto terminado) y "Blast Freezer" (cámara de congelación).' },
                    { n: 2, x: 76.7, y: 28.8, w: 19.5, h: 3.9, label: 'Buscador del historial de unidades empacadas por lote o presentación comercial.' }
                ],
                tip: 'Una vez completado el envasado y congelado, el departamento de Calidad realiza la evaluación final LAB-004 y liberación COA en Trazabilidad 360° (guía #38).'
            }
        ],
        troubleshooting: [
            { issue: 'El sistema exige registro de Sanitización CIP antes de iniciar producción', fix: 'Documenta el lavado en la pestaña "Registros de Sanitización (CIP)" como Completado y Aprobado o solicita autorización de excepción CIP a Calidad.' },
            { issue: 'No puedo editar un lote ya cerrado o reutilizable', fix: 'Esa acción requiere el permiso específico "Editar Lotes Cerrados y Reutilizables" reservado para supervisión o Gerencia.' }
        ]
    },
    {
        slug: 'industrial-despachos-inventario-insumos',
        order: 24,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Despachos y Rutas (Pedidos, Planificador, Flota y Modo Motorista)',
        title: 'ANDELSA: Despachos y Rutas (Pedidos, Planificador, Flota y Modo Motorista)',
        summary: 'Administra todo el flujo logístico en sus 4 etapas: Calendario de Pedidos, Planificador de Rutas & Mapa con Facturación Automática DTE, Flota y Mantenimiento, y Modo Motorista con QR.',
        outcome: 'Coordinar pedidos diarios, armar rutas óptimas por camión, facturar automáticamente toda una ruta con lotes asignados y confirmar entregas en campo con QR.',
        duration: '6 min',
        modulePath: '/industrial/despachos',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['manage_egg_dispatch', 'manage_egg_commissions'],
        coverImage: 'egg-despachos.png',
        prerequisites: [
            'Tener lotes envasados disponibles en Inventario Industrial y vehículos/motoristas registrados en la pestaña Flota.'
        ],
        steps: [
            {
                title: '1. Programar Pedidos de Clientes en Calendario de Pedidos',
                description: 'En Huevo Industrial → Despachos y Rutas (pestaña "1. Calendario de Pedidos") pulsa "+ Nuevo Pedido" para registrar entregas con cliente, productos/libras, fecha comprometida y prioridad (Urgente, Alta, Normal). Usa los filtros por estado ("Pendientes / En Ruta / Entregados") para organizar la carga.',
                image: 'egg-despachos.png',
                annotations: [
                    { n: 1, x: 76.4, y: 20, w: 18.1, h: 3.6, label: 'Accesos rápidos "+ Nuevo Pedido" y "Planificar Ruta".' },
                    { n: 2, x: 21.1, y: 32.7, w: 69.7, h: 3.9, label: 'Las 4 etapas logísticas: Pedidos, Planificador & Mapa, Flota y Modo Motorista.' },
                    { n: 3, x: 22.2, y: 48.3, w: 47.8, h: 3.6, label: 'Filtros por cliente, estado de entrega y prioridad del despacho.' }
                ],
                tip: 'Marca los pedidos con prioridad "Urgente" o "Alta" para que el planificador los priorice al armar los viajes del día.'
            },
            {
                title: '2. Planificar Rutas, Asignar Lotes y Facturar en Bloque',
                description: 'Pasa a la pestaña "2. Planificador de Rutas & Mapa". Elige una ruta en el selector o crea una con "+ Crear Nueva Ruta" asignando camión, motorista y pedidos; luego desde el detalle de la ruta asignas los lotes específicos y ejecutas la Facturación Automática de Ruta para emitir los DTEs en serie.',
                image: 'egg-despachos-rutas.png',
                annotations: [
                    { n: 1, x: 37.1, y: 32.8, w: 17.8, h: 3.6, label: 'Pestaña "2. Planificador de Rutas & Mapa" para organizar paradas y cargas.' },
                    { n: 2, x: 30.9, y: 42.3, w: 16, h: 4.1, label: 'Selector de ruta activa (y acceso derecho "+ Crear Nueva Ruta").' },
                    { n: 3, x: 85, y: 42.5, w: 10.1, h: 3.6, label: 'Botón "+ Crear Nueva Ruta" para consolidar pedidos de un viaje.' }
                ],
                tip: 'Al facturar automáticamente una ruta puedes elegir qué lotes específicos se descargan en cada factura y previsualizar/imprimir todo el legajo en PDF.'
            },
            {
                title: '3. Controlar Vehículos Refrigerados y Mantenimientos en Flota',
                description: 'En la pestaña "3. Flota y Mantenimiento" administras las unidades de reparto refrigeradas (`C-104928`, etc.) con "+ Agregar Vehículo", controlas el odómetro y registras servicios preventivos o correctivos con "Registrar Mantenimiento" para evitar fallas de cadena de frío.',
                image: 'egg-despachos-flota.png',
                annotations: [
                    { n: 1, x: 55.5, y: 32.8, w: 15.1, h: 3.6, label: 'Pestaña "3. Flota y Mantenimiento" para unidades y talleres.' },
                    { n: 2, x: 71.8, y: 40.8, w: 23.4, h: 3.6, label: 'Botones "+ Agregar Vehículo" y "Registrar Mantenimiento".' },
                    { n: 3, x: 21.1, y: 48, w: 74, h: 38, label: 'Tarjetas por camión con placa/edición y tabla de mantenimientos programados.' }
                ],
                tip: 'Registra siempre la fecha próxima de cambio de aceite o revisión de termoking para anticipar mantenimientos.'
            },
            {
                title: '4. Confirmar Entregas en Campo con Modo Motorista y Escáner QR',
                description: 'Abre la pestaña "4. Modo Motorista (Móvil)" desde el teléfono o tablet del reparto. Muestra al motorista asignado sus paradas de entrega del día con el escáner QR de DTE y botón de confirmación para cerrar la ruta en vivo.',
                image: 'egg-despachos-motorista.png',
                annotations: [
                    { n: 1, x: 71.3, y: 32.8, w: 19.5, h: 3.6, label: 'Pestaña "4. Modo Motorista (Móvil)" optimizada para entregas en ruta.' },
                    { n: 2, x: 21.1, y: 43, w: 74, h: 45, label: 'Vista operativa de entregas del día con lectura de QR DTE y confirmación.' }
                ],
                tip: 'Cuando la entrega se confirma en Modo Motorista, el pedido pasa automáticamente a Entregado en el Dashboard de Andelsa.'
            }
        ],
        troubleshooting: [
            { issue: 'No puedo crear una ruta porque no aparecen camiones ni motoristas', fix: 'Entra primero a la pestaña "3. Flota y Mantenimiento" y da de alta el vehículo con "+ Agregar Vehículo".' },
            { issue: 'Falta un lote al ejecutar la Facturación Automática de Ruta', fix: 'Confirma que el lote ya haya cerrado su etapa en Empaque y que tenga unidades disponibles en Inventario Industrial.' }
        ]
    },
    {
        slug: 'industrial-calendario-contenedores',
        order: 25,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Calendario de Producción y Contenedores de Frío',
        title: 'ANDELSA: Calendario de Producción y Control de Contenedores de Frío',
        summary: 'Planifica corridas diarias según pedidos y sugerencias IA de materia prima, y controla la ocupación, días encendidos y cortes de cobro de contenedores de frío.',
        outcome: 'Programar la planta según demanda real de clientes y facturar/liquidar correctamente los días de almacenamiento en contenedores refrigerados.',
        duration: '5 min',
        modulePath: '/industrial/calendario',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['manage_production_calendar', 'manage_egg_containers', 'manage_egg_returnables'],
        coverImage: 'egg-calendario.png',
        prerequisites: [
            'Tener configurados perfiles de formulación y tarimas de materia prima disponibles (o pedidos registrados en Despachos).'
        ],
        steps: [
            {
                title: 'Programar lotes y materia prima en Calendario de Producción',
                description: 'En Huevo Industrial → Calendario de Producción visualiza en vista "Mes" o "Lista / Agenda" los pedidos pendientes y lotes programados. Arriba dispones de "Sugerencias IA", "Pedidos Clientes", "Despachos y Rutas", "Planificador Materia Prima" y "+ Nueva Producción" para asignar fecha, volumen en libras y fórmula.',
                image: 'egg-calendario.png',
                annotations: [
                    { n: 1, x: 54.5, y: 13.8, w: 34.4, h: 8.1, label: 'Botones superiores: "Sugerencias IA", "Pedidos Clientes", "Despachos y Rutas", "Planificador Materia Prima" y "+ Nueva Producción".' },
                    { n: 2, x: 20.5, y: 41.5, w: 64.6, h: 8.5, label: 'Controles de mes, vista "Mes" / "Lista / Agenda", buscador y filtros por perfil y estado.' },
                    { n: 3, x: 42, y: 59.5, w: 22, h: 26, label: 'Celdas diarias con pedidos/lotes programados y botones rápidos para programar en esa fecha.' }
                ],
                tip: 'Usa "Sugerencias IA" cuando tengas pedidos próximos a vencer: calcula automáticamente cuántas tarimas y libras de materia prima necesitas preparar.'
            },
            {
                title: 'Monitorear uso y generar corte en Contenedores de Frío',
                description: 'Abre Huevo Industrial → Contenedores de Frío. Arriba visualizas la tarifa diaria configurada y el panel "ESTADO DE CUENTA AL CLIENTE • CORTE POR FECHAS" con botones "Vista Previa PDF", "Excel" y "Realizar Corte por Fechas". Abajo cada tarjeta ("Contenedor #1", etc.) muestra si está ENCENDIDO o disponible para editar o cerrar su ciclo.',
                image: 'egg-contenedores.png',
                annotations: [
                    { n: 1, x: 68.1, y: 13.4, w: 27.3, h: 5.5, label: 'Tarifa base diaria configurada y botón "+ Adicionar Contenedor".' },
                    { n: 2, x: 20.5, y: 26, w: 75, h: 19, label: 'Panel de Estado de Cuenta y Corte por Fechas: Vista Previa PDF, Excel y "Realizar Corte por Fechas".' },
                    { n: 3, x: 20.5, y: 76, w: 75, h: 22, label: 'Tarjetas de Contenedores (#01 al #10) con estado de encendido, fecha inicio y acciones de cierre.' }
                ],
                tip: 'Usa el botón "Aplicar 7d a Encendidos" o ajusta la fecha HASTA antes de pulsar "Realizar Corte por Fechas" para liquidar el período exacto sin reiniciar manualmente uno por uno.'
            }
        ],
        troubleshooting: [
            { issue: 'No aparecen pedidos de clientes dentro del Calendario de Producción', fix: 'Confirma que el pedido esté creado en Despachos y Rutas (o usa el ícono "+" en la celda del día para registrarlo directo en el calendario).' },
            { issue: 'Un contenedor sigue sumando días aunque ya se desocupó', fix: 'Haz clic en el botón de cierre/reinicio (flecha circular) en la esquina de la tarjeta de ese contenedor o ejecuta el Corte por Fechas.' }
        ]
    },
    {
        slug: 'industrial-costos-reportes-config',
        order: 26,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Costeo/Mantenimiento, Envases Retornables, Reportes y Ajustes',
        title: 'ANDELSA: Costos, Cubetas Retornables, 7 Reportes Oficiales y Ajustes de Planta',
        summary: 'Administra costos por lote, control de cubetas y tapaderas retornables, mantenimiento de equipos; emite los 7 reportes oficiales de planta en PDF/Excel y configura prefijos y rendimientos.',
        outcome: 'Conciliar cubetas prestadas con clientes, sincronizar gastos reales de planillas RRHH con Costeo y descargar los 7 reportes oficiales de ANDELSA en 1 clic.',
        duration: '6 min',
        modulePath: '/industrial/reportes',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['manage_industrial_costs', 'view_egg_reports', 'view_egg_raw_materials_report', 'view_egg_production_report', 'view_egg_packaging_report', 'view_egg_quality_report', 'view_egg_inventory_report', 'manage_industrial_settings', 'manage_egg_returnables'],
        coverImage: 'egg-reportes.png',
        prerequisites: [
            'Tener al menos lotes registrados o parámetros base de costos/prefijos configurados en Huevo Industrial → Ajustes.'
        ],
        steps: [
            {
                title: 'Analizar Costos por Lote, Mantenimiento y Proyección de Demanda',
                description: 'En Huevo Industrial → Costeo y Mantenimiento entra a "Costos por Lote" y pulsa "Sincronizar Datos Reales" para cargar el costo real por libra de cada lote del rango. Desde las otras pestañas gestionas Mantenimiento de Equipos y Proyección de Demanda, o saltas directo con "Abrir Costeo por Libra →".',
                image: 'egg-costos-mantenimiento.png',
                annotations: [
                    { n: 1, x: 84.9, y: 14.3, w: 11.5, h: 3.6, label: 'Acceso directo "Abrir Costeo por Libra →" hacia el simulador financiero.' },
                    { n: 2, x: 19.9, y: 39, w: 53, h: 3.9, label: 'Pestañas: Costos por Lote, Envases Retornables (Cubetas), Mantenimiento y Proyección.' },
                    { n: 3, x: 62.9, y: 49.4, w: 12.2, h: 3.2, label: 'Botón "Sincronizar Datos Reales" para calcular el costo real por libra procesada.' }
                ],
                tip: 'Consulta las guías #38, #39 y #40 para el detalle avanzado de Trazabilidad/LAB-004, Inventario/Insumos y Costeo por Libra.'
            },
            {
                title: 'Controlar Envases Retornables (Cubetas y Tapaderas por Cliente)',
                description: 'En la pestaña "Envases Retornables (Cubetas)" controlas cubetas (+) prestadas, devoluciones (-), saldos netos y descuadres de tapaderas por cliente. Pulsa "Sincronizar Facturación Automática" para cruzar envíos facturados y usa el filtro "Con Descuadre de Tapas" o "Con Saldo Pendiente".',
                image: 'egg-costos-cubetas.png',
                annotations: [
                    { n: 1, x: 29.9, y: 39, w: 15.4, h: 3.9, label: 'Pestaña "Envases Retornables (Cubetas)" para control de préstamo y devolución.' },
                    { n: 2, x: 62.5, y: 49.2, w: 20, h: 8.6, label: 'Botones "Sincronizar Facturación Automática", "Recargar saldos" y "Registrar Cliente para Envases".' },
                    { n: 3, x: 20.6, y: 82.4, w: 75.1, h: 3.9, label: 'Buscador de cliente y filtros rápidos: Todos, Con Saldo Pendiente y Con Descuadre de Tapas.' }
                ],
                tip: 'Sincroniza después de emitir facturación de rutas para que cada cubeta entregada se sume al saldo del cliente automáticamente.'
            },
            {
                title: 'Generar los 7 Reportes Oficiales de Huevo Industrial (PDF y Excel)',
                description: 'Entra a Huevo Industrial → Reportes y selecciona el módulo arriba: "Ventas por Producto", "Ventas por Cliente", "Producción", "Materia prima", "Envasado", "Calidad" o "Mermas". Ajusta fechas, activa si aplica Notas de Crédito (05) y pulsa "Filtrar", "Gráficas", "Descargar XLSX", "Descargar PDF" o "Ver PDF".',
                image: 'egg-reportes.png',
                annotations: [
                    { n: 1, x: 19.5, y: 10.9, w: 54.2, h: 4.1, label: '7 áreas de reporte: Ventas por Producto/Cliente, Producción, Materia Prima, Envasado, Calidad y Mermas.' },
                    { n: 2, x: 20.6, y: 20.5, w: 71.5, h: 5, label: 'Filtros rápidos de Mes, rango Desde/Hasta, Producto, Cliente y Criterio de Documentos.' },
                    { n: 3, x: 33.7, y: 27.6, w: 61.9, h: 3.9, label: 'Botón "Filtrar", "Gráficas", "Descargar XLSX" (Excel), "Descargar PDF" y "Ver PDF".' }
                ],
                tip: 'Haz clic sobre cualquier fila de la tabla resumen para desplegar su desglose detallado de facturas, lotes o clientes sin salir de la pantalla.'
            },
            {
                title: 'Configurar Costos Operativos y Planillas RRHH en Huevo Industrial → Ajustes',
                description: 'En Huevo Industrial → Ajustes → "Costos y Planillas" presionas "Cargar desde Planillas RRHH y Gastos Operativos" para traer costos reales de nómina y planta sin digitarlos a mano. También dispones de la pestaña "Rendimientos de Producto" (% entero/clara/yema) y "Vinculación de Códigos".',
                image: 'egg-configuracion.png',
                annotations: [
                    { n: 1, x: 47.6, y: 14.3, w: 39, h: 7.3, label: '4 pestañas de configuración: Costos y Planillas, Prefijos de Lote, Rendimientos y Códigos.' },
                    { n: 2, x: 73.7, y: 34.4, w: 22.5, h: 4.3, label: 'Botón verde "Cargar desde Planillas RRHH y Gastos Operativos" para sincronización contable real.' },
                    { n: 3, x: 74.6, y: 51.4, w: 21.6, h: 5.2, label: 'Ayuda contextual "(?)" explicando exactamente cómo se calcula y prorratea cada rubro.' }
                ],
                tip: 'Haz clic en "(?)" junto a cualquier rubro para confirmar de qué departamento RRHH o cuenta contable proviene su cálculo.'
            },
            {
                title: 'Parametrizar Prefijos de Lote, Taras y Empaques por Granja / Proveedor',
                description: 'Cambia a la pestaña "Prefijos de Lote por Proveedor" dentro de Ajustes para definir el prefijo automático (ej. `GRJ-`), taras base por tarima y empaque habitual de cada proveedor con "+ Asignar Prefijo a Proveedor". Esto acelera la captura diaria en Recepción MP.',
                image: 'egg-config-prefijos.png',
                annotations: [
                    { n: 1, x: 57.4, y: 14.3, w: 15, h: 3.4, label: 'Pestaña "Prefijos de Lote por Proveedor" en Configuración de Parámetros.' },
                    { n: 2, x: 80.9, y: 31.7, w: 14.2, h: 4.1, label: 'Botón "Asignar Prefijo a Proveedor" para agregar una regla de recepción por granja.' },
                    { n: 3, x: 21.2, y: 42.6, w: 73.9, h: 57.4, label: 'Tabla de reglas con Prefijo, Taras base por tarima, Empaque habitual y botones Editar/Eliminar.' }
                ],
                tip: 'Con las taras base por tarima configuradas aquí, Recepción MP descuenta el peso del empaque plástico automáticamente.'
            }
        ],
        troubleshooting: [
            { issue: 'El Reporte de Ventas por Producto incluye o no remisiones pendientes', fix: 'Cambia el selector "CRITERIO DE DOCUMENTOS" arriba a la derecha entre "Facturado + Remisiones Pendientes" y "Solo Facturación Fiscal (01, 03, 11)".' },
            { issue: 'Los costos fijos en Ajustes están desactualizados respecto al último mes', fix: 'Presiona el botón verde "Cargar desde Planillas RRHH y Gastos Operativos" para refrescarlos con la nómina y gastos reales.' }
        ]
    },
    {
        slug: 'crm-cotizaciones-acuerdos',
        order: 27,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'crm',
        menuPath: 'CRM → Cotizador Comercial y Acuerdos con Clientes',
        title: 'CRM Comercial: Cotizador de Clientes y Acuerdos de Precios',
        summary: 'Elabora cotizaciones comerciales con control de margen y exportación PDF/Word, alerta cotizaciones delicadas y administra acuerdos de precios pactados por cliente.',
        outcome: 'Estandarizar las propuestas comerciales con margen validado y aplicar en POS los precios pactados por libra o unidad con cada cliente.',
        duration: '4 min',
        modulePath: '/crm/cotizaciones',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: ['manage_crm_quotes', 'manage_customer_agreements', 'manage_crm_settings'],
        coverImage: 'crm-cotizaciones.png',
        prerequisites: [
            'Tener configurados los parámetros base de margen y vigencia en CRM → Configuración de CRM.'
        ],
        steps: [
            {
                title: 'Crear y gestionar propuestas en el Cotizador Comercial',
                description: 'En CRM → Cotizador Comercial haz clic en "Nueva Cotización". Selecciona el cliente, agrega los productos/presentaciones con su precio ofertado y observa el cálculo de Margen antes de guardar. En el listado puedes filtrar por estado (Borrador, Enviada, Aprobada, Delicadas, Vencida) y descargar en PDF o Word.',
                image: 'crm-cotizaciones.png',
                annotations: [
                    { n: 1, x: 84.8, y: 14.3, w: 10.4, h: 4.1, label: 'Botón "Nueva Cotización" para elaborar una propuesta comercial con cálculo de margen.' },
                    { n: 2, x: 61.3, y: 35.9, w: 32.8, h: 3.2, label: 'Filtros rápidos de seguimiento: Todos, Borrador, Enviada, Aprobada, Delicadas y Vencida.' },
                    { n: 3, x: 86.1, y: 54.1, w: 2.5, h: 3.2, label: 'Acción directa para abrir el PDF oficial de la cotización.' }
                ],
                tip: 'Las cotizaciones marcadas como "Delicadas" son propuestas con margen ajustado o próximas a vencer que requieren seguimiento prioritario.'
            },
            {
                title: 'Registrar Acuerdos de Precios con Clientes',
                description: 'Entra a CRM → Acuerdos con Clientes y presiona "Nuevo Acuerdo". Puedes incluir múltiples productos o presentaciones distintas para un mismo cliente definiendo Precio Pactado ($/lb), Precio en POS ($/unidad), volumen mensual esperado, términos de pago y vigencia.',
                image: 'crm-acuerdos.png',
                annotations: [
                    { n: 1, x: 57.5, y: 11.7, w: 36.5, h: 8.5, label: 'Accesos a Configuración CRM, Simulador de Costeo, Calendario y botón "Nuevo Acuerdo".' },
                    { n: 2, x: 20.9, y: 42.6, w: 74.1, h: 3.9, label: 'Buscador por cliente o producto y filtro de estado (Todos, Activos, Inactivos).' },
                    { n: 3, x: 90, y: 57.4, w: 4.5, h: 3.2, label: 'Acciones por fila: Editar acuerdo/productos o Eliminar acuerdo.' }
                ],
                tip: 'Una vez activo el acuerdo, el precio pactado por unidad se respeta automáticamente al facturarle a ese cliente en el POS.'
            },
            {
                title: 'Ajustar Parámetros de Margen y Plazos en Configuración de CRM',
                description: 'En CRM → Configuración de CRM puedes definir la meta mínima de rentabilidad, márgenes recomendados, precios de referencia para simulaciones y la política de días de validez por defecto para nuevas cotizaciones y acuerdos.',
                image: 'crm-config.png',
                annotations: [
                    { n: 1, x: 76.5, y: 14.2, w: 18.6, h: 4.3, label: 'Acceso directo a "Ver Acuerdos" y botón "Guardar Cambios".' },
                    { n: 2, x: 21.1, y: 27.4, w: 74.1, h: 45, label: 'Parámetros de Margen y Políticas de Plazos aplicados a las nuevas cotizaciones.' }
                ],
                tip: 'Actualiza los márgenes mínimos cuando cambien tus costos logísticos para que el cotizador alerte a tiempo a los vendedores.'
            }
        ],
        troubleshooting: [
            { issue: 'El precio especial del acuerdo no aparece en el POS', fix: 'Verifica que el acuerdo esté en estado Activo, dentro de su vigencia y que el producto exacto esté agregado en la lista del acuerdo.' },
            { issue: 'Una cotización muestra margen negativo o alerta roja', fix: 'Revisa el costo de referencia en CRM → Configuración de CRM o sincroniza desde Costeo por Libra.' }
        ]
    }
];

module.exports = INDUSTRIAL_CRM_TUTORIALS;
