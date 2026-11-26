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
        menuPath: 'Huevo Industrial → Panel SCADA, Recepción MP y Baja de Tarimas',
        title: 'Planta Industrial: Monitoreo SCADA, Recepción MP y Baja de Tarimas',
        summary: 'Supervisa el Panel IoT/SCADA de pasteurización y frío, registra ingresos de huevo en cáscara/líquido por granja y vincula facturas para dar de baja tarimas.',
        outcome: 'Controlar los puntos críticos de planta y mantener trazabilidad exacta de cada tarima recibida desde granja hasta su facturación o consumo.',
        duration: '5 min',
        modulePath: '/industrial/recepcion',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['view_industrial_dashboard', 'manage_mp_reception', 'manage_egg_tarima_writeoffs'],
        coverImage: 'egg-recepcion.png',
        prerequisites: [
            'Tener configurados proveedores/granjas, tipos de huevo y prefijos de lotes en Huevo Industrial → Ajustes.'
        ],
        steps: [
            {
                title: 'Monitorear temperaturas y puntos críticos en Panel IoT / SCADA',
                description: 'Entra a Huevo Industrial → Panel IoT / SCADA para vigilar en vivo las temperaturas de pasteurización, flujo y tanques pulmón/almacenamiento, así como las alertas de planta. Desde arriba puedes abrir el Calendario de Producción o restablecer lecturas de simulación.',
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
                    { n: 1, x: 84.8, y: 14.8, w: 10.3, h: 4.1, label: 'Botón "Nueva Recepción" para registrar un ingreso de materia prima con sus tarimas.' },
                    { n: 2, x: 73.5, y: 28.3, w: 21.6, h: 3.9, label: 'Buscador por proveedor, lote o tipo de huevo.' },
                    { n: 3, x: 85.2, y: 44.4, w: 14.6, h: 16, label: 'Estado de Calidad (Pendiente / Grado AA/A) y botón para Ver Detalle y Tarimas.' }
                ],
                tip: 'Cada tarima recibe un código único identificable para su traslado en bodega o envío directo a quebrado.'
            },
            {
                title: 'Vincular Facturas y Dar de Baja Tarimas de Materia Prima',
                description: 'En Huevo Industrial → Facturas y Baja de Tarimas selecciona los cuadritos de las tarimas físicas en la pestaña "Lotes y Tarimas Disponibles" (puedes filtrar por Ubicación como Bodega Abajo o Bodega Arriba) y presiona "Vincular Factura / Dar de Baja" para respaldar su salida con la factura de compra o despacho.',
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
            { issue: 'Falta un prefijo de lote al registrar la recepción', fix: 'Configura el prefijo correspondiente en Huevo Industrial → Ajustes antes de guardar el ingreso.' }
        ]
    },
    {
        slug: 'industrial-produccion-empaque-trazabilidad',
        order: 23,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Producción, Empaque y Trazabilidad',
        title: 'Producción, Pasteurización, Empaque y Trazabilidad 360° & Calidad',
        summary: 'Opera lotes de quebrado y pasteurización, registra limpieza CIP, envasado y congelamiento en Blast Freezer, y audita trazabilidad completa con certificados COA.',
        outcome: 'Documentar el rendimiento desde tarima hasta producto terminado envasado con liberación microbiológica y Certificado de Análisis (COA).',
        duration: '6 min',
        modulePath: '/industrial/produccion',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['manage_production', 'manage_packaging', 'manage_traceability', 'manage_egg_quality'],
        coverImage: 'egg-produccion.png',
        prerequisites: [
            'Contar con tarimas de materia prima aprobadas y registro vigente de sanitización CIP (Limpieza en Sitio) o autorización excepcional de Calidad.'
        ],
        steps: [
            {
                title: 'Crear Lotes de Quebrado, Pasteurizar y registrar Sanitización CIP',
                description: 'En Huevo Industrial → Producción y Pasteurización pulsa "+ Iniciar Nueva Producción" para cargar tarimas al quebrado, o "Pasteurizar" para iniciar el proceso térmico sobre lotes formulados. En la pestaña "Registros de Sanitización (CIP)" documenta cada lavado antes del arranque.',
                image: 'egg-produccion.png',
                annotations: [
                    { n: 1, x: 19.8, y: 26.2, w: 23.5, h: 4.5, label: 'Pestañas para alternar entre "Lotes de Producción" y "Registros de Sanitización (CIP)".' },
                    { n: 2, x: 62.5, y: 26.2, w: 35.5, h: 4.5, label: 'Accesos a Calendario de Producción, "+ Iniciar Nueva Producción" y "Pasteurizar".' },
                    { n: 3, x: 76.5, y: 36, w: 19.8, h: 4.2, label: 'Buscador rápido de historial de procesamiento por lote o producto.' }
                ],
                tip: 'Si un lote cerrado o reutilizable requiere ajuste excepcional autorizado, Gerencia/Calidad cuenta con el permiso controlado de edición en el detalle del lote.'
            },
            {
                title: 'Registrar Empaque Final y Congelado (Blast Freezer)',
                description: 'Abre Huevo Industrial → Empaque y Congelado. Presiona "Registrar Envasado" para empacar el lote pasteurizado en sus presentaciones físicas (baldes, bolsas, cajas), consumiendo sus empaques e insumos y cerrando el lote; luego usa "Blast Freezer" para controlar lotes en cámara de congelación rápida.',
                image: 'egg-empaque.png',
                annotations: [
                    { n: 1, x: 76.5, y: 15.2, w: 19.7, h: 3.6, label: 'Botones "Registrar Envasado" (lotes terminados) y "Blast Freezer" (congelado).' },
                    { n: 2, x: 76.7, y: 28.8, w: 19.5, h: 3.9, label: 'Buscador del historial de unidades empacadas por lote o presentación.' }
                ],
                tip: 'Al hacer el cierre técnico de envasado el producto terminado pasa automáticamente al Inventario Industrial disponible para despachos.'
            },
            {
                title: 'Auditar Trazabilidad 360°, Control de Calidad (LAB-004) y COA',
                description: 'Ingresa a Huevo Industrial → Trazabilidad 360°. Usa las pestañas superiores para recorrer la cadena completa en "Trazabilidad de Lotes", evaluar análisis microbiológicos en "Control de Calidad (LAB-004)", configurar normas COA o calcular sólidos en "Calculadora de Sólidos HE+".',
                image: 'egg-trazabilidad.png',
                annotations: [
                    { n: 1, x: 51.3, y: 15.5, w: 48.7, h: 3.2, label: 'Pestañas: Trazabilidad de Lotes, Control de Calidad (LAB-004), Normas COA y Sólidos HE+.' },
                    { n: 2, x: 20.9, y: 32, w: 72, h: 4, label: 'Indicadores globales: libras procesadas en MP, producción, unidades y alertas activas.' },
                    { n: 3, x: 20.9, y: 45.8, w: 46.2, h: 4.3, label: 'Buscador por lote proveedor, lote juliano, lote comercial, producto o cliente.' },
                    { n: 4, x: 24.2, y: 53.4, w: 33.2, h: 3.2, label: 'Filtros por etapa: Todos, Materia Prima, En Producción, Inventario Final o Con Alertas.' }
                ],
                tip: 'Desde cualquier lote liberado por Calidad puedes generar e imprimir el Certificado de Análisis (COA) oficial para el cliente.'
            }
        ],
        troubleshooting: [
            { issue: 'El sistema exige registro de Sanitización CIP antes de producir', fix: 'Ve a la pestaña "Registros de Sanitización (CIP)" para documentar el lavado previo o solicita autorización de excepción CIP al rol Calidad.' },
            { issue: 'Un lote envasado sigue bloqueado para despachos', fix: 'Confirma en Trazabilidad 360° → Control de Calidad (LAB-004) que el análisis de liberación del lote esté aprobado.' }
        ]
    },
    {
        slug: 'industrial-despachos-inventario-insumos',
        order: 24,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Despachos, Inventario, Insumos y Costeo',
        title: 'Despachos y Rutas, Inventario Traducido, Insumos y Costeo por Libra',
        summary: 'Programa pedidos y rutas de entrega con modo motorista, consulta existencias en Libras/Kg/Unidades, gestiona empaques/aditivos/CIP y simula costos por libra.',
        outcome: 'Coordinar entregas a tiempo sin quiebres de empaque o producto terminado y conocer la rentabilidad real por libra producida.',
        duration: '5 min',
        modulePath: '/industrial/despachos',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['manage_egg_dispatch', 'view_egg_inventory', 'manage_egg_supplies', 'manage_industrial_costeo_libra'],
        coverImage: 'egg-despachos.png',
        prerequisites: [
            'Tener lotes envasados disponibles y clientes configurados en el módulo de Clientes o CRM.'
        ],
        steps: [
            {
                title: 'Programar Pedidos y Rutas en Despachos y Rutas',
                description: 'En Huevo Industrial → Despachos y Rutas utiliza las 4 vistas superiores: "1. Calendario de Pedidos" (para registrar con "+ Nuevo Pedido"), "2. Planificador de Rutas & Mapa", "3. Flota y Mantenimiento" y "4. Modo Motorista (Móvil)" para confirmar entregas en campo.',
                image: 'egg-despachos.png',
                annotations: [
                    { n: 1, x: 76.4, y: 20, w: 18.1, h: 3.6, label: 'Accesos directos a "Nuevo Pedido" y "Planificar Ruta".' },
                    { n: 2, x: 21.1, y: 32.7, w: 69.7, h: 3.9, label: '4 etapas del flujo: Calendario de Pedidos, Planificador & Mapa, Flota y Modo Motorista.' },
                    { n: 3, x: 22.2, y: 48.3, w: 47.8, h: 3.6, label: 'Filtros por cliente, estado (Pendientes / En Ruta / Entregados) y prioridad.' }
                ],
                tip: 'Usa las prioridades (Urgentes, Altas, Normales) para organizar el orden de carga en los camiones refrigerados.'
            },
            {
                title: 'Consultar Inventario Industrial en Libras, Kilogramos o Unidades',
                description: 'Abre Huevo Industrial → Inventario Industrial. Puedes alternar arriba entre Producto Terminado, Materia Prima, Mermas y Desperdicios o Insumos; cambiar instantáneamente la unidad de medida entre "Lbs", "Kg" y "Unidades"; pulsar "Ver Lotes" por fila y exportar a PDF o Excel.',
                image: 'egg-inventario.png',
                annotations: [
                    { n: 1, x: 70.2, y: 14, w: 25.2, h: 3.6, label: 'Exportar PDF/Excel y selector inmediato de unidad ("Lbs", "Kg", "Unidades").' },
                    { n: 2, x: 20.9, y: 21.6, w: 78.3, h: 4.8, label: 'Cuatro vistas globales: Producto Terminado, Materia Prima, Mermas e Insumos.' },
                    { n: 3, x: 88.5, y: 72.3, w: 6.4, h: 12, label: 'Botón "Ver Lotes" para inspeccionar lotes julianos y fechas de vencimiento por presentación.' }
                ],
                tip: 'La pestaña "Catálogo Traducido" unifica presentaciones comerciales a equivalentes exactos de peso neto.'
            },
            {
                title: 'Controlar Empaques, Aditivos y Químicos CIP en Inventario de Insumos',
                description: 'En Huevo Industrial → Inventario de Insumos clasifica artículos en Empaques, Aditivos o Químicos CIP y controla alertas de "Bajo Stock" o "Agotados". Usa "Nuevo Insumo" para crear ítems, "Registrar Entrada / Salida" para movimientos y "Sincronizar Costeo" para alimentar el costo unitario.',
                image: 'egg-insumos.png',
                annotations: [
                    { n: 1, x: 60, y: 13.3, w: 34.9, h: 8.4, label: 'Botones PDF, Excel, "Sincronizar Costeo", "Registrar Entrada / Salida" y "Nuevo Insumo".' },
                    { n: 2, x: 20.6, y: 43.8, w: 75.1, h: 3.4, label: 'Filtros por categoría (Empaques, Aditivos, Químicos CIP), nivel de stock y buscador.' },
                    { n: 3, x: 67.9, y: 55.1, w: 27.1, h: 3.2, label: 'Alternador entre "Existencias de Insumos" y "Kárdex de Movimientos".' }
                ],
                tip: 'También tienes Huevo Industrial → Contenedores de Frío (en el menú) para administrar retornables o racks refrigerados prestados a clientes.'
            },
            {
                title: 'Analizar costos reales en Costeo por Libra & Simulador',
                description: 'Ingresa a Huevo Industrial → Costeo por Libra & Simulador para calcular el costo real por libra según materia prima, rendimientos, empaques, CIP y gastos. Presiona "Cargar Parámetros Reales al Simulador" y usa las pestañas de la calculadora para simular márgenes de venta.',
                image: 'egg-costeo.png',
                annotations: [
                    { n: 1, x: 76.3, y: 15.6, w: 18.9, h: 3.9, label: 'Botones "Recalcular" y "Guardar Escenario" para comparar supuestos financieros.' },
                    { n: 2, x: 75.8, y: 48.2, w: 19.3, h: 3.6, label: 'Botón "Cargar Parámetros Reales al Simulador" con promedios de planta.' },
                    { n: 3, x: 19.9, y: 76.9, w: 80.1, h: 3.9, label: 'Pestañas: Calculadora, Simulador Margen Libre, Metas, Acuerdos, Insumos y Escenarios.' }
                ],
                tip: 'Cuando actualices costos de empaques o insumos en Inventario de Insumos, pulsa "Sincronizar Costeo" para verlos reflejados aquí.'
            }
        ],
        troubleshooting: [
            { issue: 'Los insumos figuran en 0 o Agotados tras crearlos', fix: 'Registra su saldo inicial usando el botón "Registrar Entrada / Salida" en Inventario de Insumos.' },
            { issue: 'No puedo asignar un pedido a una ruta', fix: 'Verifica en la pestaña "3. Flota y Mantenimiento" que exista al menos un vehículo y motorista disponible.' }
        ]
    },
    {
        slug: 'industrial-calendario-contenedores',
        order: 25,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Calendario de Producción y Contenedores de Frío',
        title: 'Calendario de Producción y Control de Contenedores de Frío',
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
        menuPath: 'Huevo Industrial → Costeo/Mantenimiento, Reportes y Ajustes',
        title: 'Costos y Envases, Reportes Oficiales y Ajustes de Planta',
        summary: 'Administra costos por lote, cubetas retornables y mantenimiento de equipos; emite los 7 reportes oficiales de planta en PDF/Excel y configura prefijos y rendimientos.',
        outcome: 'Controlar envases retornables, mantener los gastos reales de planta sincronizados con Planillas y descargar todos los reportes oficiales en 1 clic.',
        duration: '5 min',
        modulePath: '/industrial/reportes',
        roles: ['Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['manage_industrial_costs', 'view_egg_reports', 'view_egg_raw_materials_report', 'view_egg_production_report', 'view_egg_packaging_report', 'view_egg_quality_report', 'view_egg_inventory_report', 'manage_industrial_settings'],
        coverImage: 'egg-reportes.png',
        prerequisites: [
            'Tener al menos lotes registrados o parámetros base de costos/prefijos configurados en Ajustes de Planta.'
        ],
        steps: [
            {
                title: 'Gestionar Costos por Lote, Cubetas Retornables y Mantenimiento',
                description: 'En Huevo Industrial → Costeo y Mantenimiento cambia entre las 4 pestañas: "Costos por Lote" (pulsa "Sincronizar Datos Reales" para cargar lotes del rango), "Envases Retornables (Cubetas)" (control de préstamos con clientes), "Mantenimiento de Equipos" y "Proyección de Demanda", o salta directo con "Abrir Costeo por Libra →".',
                image: 'egg-costos-mantenimiento.png',
                annotations: [
                    { n: 1, x: 84.9, y: 14.3, w: 11.5, h: 3.6, label: 'Acceso directo "Abrir Costeo por Libra →" hacia el simulador financiero.' },
                    { n: 2, x: 19.9, y: 39, w: 53, h: 3.9, label: 'Pestañas: Costos por Lote, Envases Retornables (Cubetas), Mantenimiento y Proyección.' },
                    { n: 3, x: 62.9, y: 49.4, w: 12.2, h: 3.2, label: 'Botón "Sincronizar Datos Reales" para calcular el costo real por libra procesada.' }
                ],
                tip: 'Lleva al día la pestaña "Envases Retornables (Cubetas)" para emitir el saldo exacto de cubetas en poder de cada cliente o granja.'
            },
            {
                title: 'Generar los 7 Reportes Oficiales de Huevo Industrial',
                description: 'Entra a Huevo Industrial → Reportes y selecciona el módulo arriba: "Ventas por Producto", "Ventas por Cliente", "Producción", "Materia prima", "Envasado", "Calidad" o "Mermas". Ajusta fechas, producto o cliente, activa si aplica el switch de Notas de Crédito (05) y pulsa "Filtrar", "Descargar XLSX", "Descargar PDF" o "Ver PDF".',
                image: 'egg-reportes.png',
                annotations: [
                    { n: 1, x: 19.5, y: 10.9, w: 54.2, h: 4.1, label: '7 áreas de reporte: Ventas por Producto/Cliente, Producción, Materia Prima, Envasado, Calidad y Mermas.' },
                    { n: 2, x: 20.6, y: 20.5, w: 71.5, h: 5, label: 'Filtros rápidos de Mes, rango Desde/Hasta, Producto, Cliente y tipo de documento fiscal.' },
                    { n: 3, x: 33.7, y: 27.6, w: 61.9, h: 3.9, label: 'Botón "Filtrar" + "Gráficas", "Descargar XLSX" (Excel), "Descargar PDF" y "Ver PDF".' }
                ],
                tip: 'Haz clic sobre cualquier fila de la tabla resumen para desplegar su desglose detallado de facturas, lotes o clientes sin salir de la pantalla.'
            },
            {
                title: 'Configurar Costos Operativos, Prefijos y Rendimientos en Ajustes',
                description: 'En Huevo Industrial → Ajustes tienes 4 pestañas clave: "Costos y Planillas" (presiona "Cargar desde Planillas RRHH y Gastos Operativos" para traer costos reales sin digitar), "Prefijos de Lote por Proveedor", "Rendimientos de Producto" (porcentajes de huevo entero, clara y yema) y "Vinculación de Códigos".',
                image: 'egg-configuracion.png',
                annotations: [
                    { n: 1, x: 47.6, y: 14.3, w: 39, h: 7.3, label: 'Pestañas de configuración: Costos y Planillas, Prefijos de Lote, Rendimientos y Códigos.' },
                    { n: 2, x: 73.7, y: 34.4, w: 22.5, h: 4.3, label: 'Botón verde "Cargar desde Planillas RRHH y Gastos Operativos" para sincronización contable real.' },
                    { n: 3, x: 74.6, y: 51.4, w: 21.6, h: 5.2, label: 'Botón de ayuda explicando cómo se calcula y prorratea cada rubro operativo.' }
                ],
                tip: 'Haz clic en el ícono "(?)" junto a cualquier rubro de costo operativo para ver exactamente de qué cuentas de RRHH o Gastos proviene su cálculo.'
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
