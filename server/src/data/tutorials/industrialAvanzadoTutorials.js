/**
 * Tutoriales Fase 3: Cobertura Profunda de ANDELSA — Trazabilidad 360° & Calidad LAB-004,
 * Inventario Traducido & Insumos/Kárdex, y Costeo por Libra & Simulador (#38 - #40)
 */

const INDUSTRIAL_AVANZADO_TUTORIALS = [
    {
        slug: 'industrial-trazabilidad-calidad-coa',
        order: 38,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Trazabilidad 360°, Control de Calidad (LAB-004), Normas COA y Sólidos HE+',
        title: 'ANDELSA: Trazabilidad 360°, Laboratorio LAB-004, Normas COA y Sólidos HE+',
        summary: 'Audita la ruta completa de cada lote desde la granja hasta el cliente final, registra análisis LAB-004, emite Certificados de Análisis (COA) y Cartas de Calidad, y calcula diluciones HE+.',
        outcome: 'Liberar lotes con respaldo microbiológico/fisicoquímico LAB-004, enviar Certificados COA y Cartas de Calidad por correo en multi-lote y formular sólidos HE+ sin errores.',
        duration: '6 min',
        modulePath: '/industrial/trazabilidad',
        roles: ['Calidad', 'Produccion', 'Supervisor', 'Gerencia', 'Operaciones', 'Admin'],
        requiredPermissions: ['manage_traceability', 'manage_egg_quality'],
        coverImage: 'egg-trazabilidad-lab.png',
        prerequisites: [
            'Tener recepciones de Materia Prima o lotes envasados/pasteurizados registrados en Planta Industrial.'
        ],
        steps: [
            {
                title: 'Auditar la Cadena Completa en Trazabilidad de Lotes e Inspección Forense',
                description: 'En Huevo Industrial → Trazabilidad 360° busca por lote proveedor, lote juliano, lote comercial, producto o cliente. Usa los filtros por etapa ("Todos", "Materia Prima", "En Producción", "Inventario Final", "Con Alertas") y presiona el ícono de Lupa en cualquier fila para abrir la Inspección Forense 360°.',
                image: 'egg-trazabilidad.png',
                annotations: [
                    { n: 1, x: 51.3, y: 15.5, w: 48.7, h: 3.2, label: '4 sub-módulos integrados: Trazabilidad de Lotes, Control de Calidad (LAB-004), Normas COA y Sólidos HE+.' },
                    { n: 2, x: 20.9, y: 32, w: 72, h: 4, label: 'Resumen en vivo de libras en Materia Prima, Producción, Inventario y Alertas.' },
                    { n: 3, x: 20.9, y: 45.8, w: 46.2, h: 4.3, label: 'Buscador universal por lote juliano, lote proveedor, producto o cliente facturado.' },
                    { n: 4, x: 24.2, y: 53.4, w: 33.2, h: 3.2, label: 'Filtros rápidos por etapa para ubicar lotes en proceso o alertas activas.' }
                ],
                tip: 'La Inspección Forense muestra en una sola línea de tiempo qué tarimas entraron al quebrado, sus controles de calidad y a qué clientes se despacharon.'
            },
            {
                title: 'Registrar Ensayos de Inocuidad LAB-004, Cartas de Calidad y Envío Multi-Lote',
                description: 'Cambia a la pestaña "Control de Calidad (LAB-004)" y pulsa "+ Nuevo Análisis LAB-004" para documentar análisis microbiológicos y fisicoquímicos (Salmonella, Coliformes, pH, % Sólidos). Puedes filtrar entre Cuarentena, Liberados o Bloqueados HACCP, emitir la Carta de Calidad (PDF/Word/Excel) o descargar el Excel Mario 2025.',
                image: 'egg-trazabilidad-lab.png',
                annotations: [
                    { n: 1, x: 73, y: 30.7, w: 23.1, h: 3.6, label: 'Exportación "Excel Mario 2025" y botón "+ Nuevo Análisis LAB-004".' },
                    { n: 2, x: 21.4, y: 43.4, w: 39.3, h: 3.2, label: 'Filtros de estado: Todos los Ensayos, Cuarentena (Incubación), Liberados Aprobados y Bloqueados HACCP.' },
                    { n: 3, x: 21.1, y: 50, w: 75, h: 16, label: 'Bitácora para aprobar lotes, generar Certificados COA, Cartas de Calidad y enviar correo multi-lote.' }
                ],
                tip: 'Cuando un cliente recibe varios lotes en el mismo despacho, selecciona los ensayos liberados y envíalos unificados en un solo correo con sus COA adjuntos.'
            },
            {
                title: 'Configurar Parámetros y Límites Normativos de Calidad (Normas COA)',
                description: 'En la pestaña "Parámetros & Normas COA" define las tolerancias oficiales por tipo de ovoproducto ("Huevo Entero", "Clara De Huevo", "Yema De Huevo"). Usa "+ Nuevo Parámetro de Calidad" para añadir criterios microbiológicos o fisicoquímicos que aparecerán impresos en cada Certificado COA.',
                image: 'egg-trazabilidad-normas.png',
                annotations: [
                    { n: 1, x: 80.7, y: 30.7, w: 14.5, h: 3.6, label: 'Botón "Nuevo Parámetro de Calidad" para agregar nuevas normas o especificaciones técnicas.' },
                    { n: 2, x: 29.5, y: 42, w: 66.2, h: 3.4, label: 'Filtros por producto (Huevo Entero, Clara, Yema) y buscador de parámetros.' },
                    { n: 3, x: 21.2, y: 58, w: 73.9, h: 33.4, label: 'Tabla de ensayos configurados con límite normativo, lectura típica y botones Editar/Eliminar.' }
                ],
                tip: 'Mantener actualizadas las Normas COA garantiza que todos los certificados emitidos por laboratorio muestren las especificaciones vigentes.'
            },
            {
                title: 'Calcular Diluciones y Balance Hídrico en Calculadora de Sólidos HE+',
                description: 'Abre la pestaña "Calculadora de Sólidos HE+" cuando necesites estandarizar % de sólidos en Huevo Entero Líquido. Ingresa en "PARÁMETROS DE DILUCIÓN HE+" el porcentaje inicial medido, el porcentaje meta y el volumen total en libras para obtener en "FORMULACIÓN & BALANCE HÍDRICO" las libras exactas de huevo y agua purificada.',
                image: 'egg-trazabilidad-solidos.png',
                annotations: [
                    { n: 1, x: 21.1, y: 30.5, w: 22, h: 31, label: 'Parámetros de entrada: % sólidos actual, % sólidos objetivo y libras de lote a formular.' },
                    { n: 2, x: 47.8, y: 30.8, w: 46, h: 31, label: 'Resultado automático de Formulación & Balance Hídrico listo para entregar a Pasteurización.' }
                ],
                tip: 'Verifica el resultado del refractómetro en Planta antes de pulsar formulación para ajustar la dilución con exactitud.'
            }
        ],
        troubleshooting: [
            { issue: 'Un lote aparece como Bloqueado HACCP o no genera Certificado COA', fix: 'Entra a Control de Calidad (LAB-004), revisa si algún parámetro microbiológico excedió la norma y registra aprobación o reinspección.' },
            { issue: 'No salen normas automáticas al llenar un ensayo LAB-004', fix: 'Revisa en Parámetros & Normas COA que existan criterios asignados al tipo de producto exacto (Huevo Entero, Clara o Yema).' }
        ]
    },
    {
        slug: 'industrial-inventario-insumos-kardex',
        order: 39,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Inventario Industrial e Inventario de Insumos',
        title: 'ANDELSA: Inventario Traducido (Lbs/Kg/Uds), Insumos (CIP/Empaques) y Kárdex',
        summary: 'Consulta existencias industriales en la unidad que necesites (Libras, Kilogramos o Unidades), audita lotes julianos con vencimiento, controla empaques/aditivos/CIP y revisa el Kárdex.',
        outcome: 'Evitar desabastecimiento de cubetas, bolsas, etiquetas o químicos CIP y tener trazabilidad exacta de existencias de planta en tiempo real.',
        duration: '5 min',
        modulePath: '/industrial/inventario',
        roles: ['Bodega', 'Produccion', 'Supervisor', 'Gerencia', 'Contador', 'Operaciones', 'Calidad', 'Jefe Pista', 'Admin'],
        requiredPermissions: ['view_egg_inventory', 'manage_egg_supplies'],
        coverImage: 'egg-inventario.png',
        prerequisites: [
            'Contar con lotes envasados o recepciones de materia prima e insumos registrados en planta.'
        ],
        steps: [
            {
                title: 'Consultar Producto Terminado, Materia Prima y Catálogo Traducido',
                description: 'En Huevo Industrial → Inventario Industrial alterna entre las 4 vistas ("Producto Terminado", "Materia Prima", "Mermas y Desperdicios" o "Insumos") y cambia en vivo la unidad arriba a la derecha ("Lbs", "Kg" o "Unidades"). Usa "Ver Lotes" en cada producto para inspeccionar lotes julianos y vencimientos o exporta a PDF/Excel.',
                image: 'egg-inventario.png',
                annotations: [
                    { n: 1, x: 70.2, y: 14, w: 25.2, h: 3.6, label: 'Exportación rápida PDF/Excel y selector instantáneo de medida ("Lbs", "Kg", "Unidades").' },
                    { n: 2, x: 20.9, y: 21.6, w: 78.3, h: 4.8, label: 'Vistas globales del inventario de planta y pestaña de Catálogo Traducido por presentación.' },
                    { n: 3, x: 88.5, y: 72.3, w: 6.4, h: 12, label: 'Botón "Ver Lotes" para consultar existencias por lote juliano y fecha de caducidad.' }
                ],
                tip: 'La conversión a "Lbs" o "Kg" toma automáticamente el peso neto configurado de cada presentación para cuadrar toneladas despachadas.'
            },
            {
                title: 'Administrar Empaques, Aditivos y Químicos CIP en Inventario de Insumos',
                description: 'Entra a Huevo Industrial → Inventario de Insumos. Filtra por categoría ("Empaques", "Aditivos", "Químicos CIP") o estado ("Óptimos", "Bajo Stock", "Agotados"). Crea materiales con "Nuevo Insumo", registra entradas de compra o salidas manuales con "Registrar Entrada / Salida" y usa "Sincronizar Costeo" para actualizar precios.',
                image: 'egg-insumos.png',
                annotations: [
                    { n: 1, x: 60, y: 13.3, w: 34.9, h: 8.4, label: 'Botones PDF, Excel, "Sincronizar Costeo", "Registrar Entrada / Salida" y "Nuevo Insumo".' },
                    { n: 2, x: 20.6, y: 43.8, w: 75.1, h: 3.4, label: 'Filtros por categoría (Empaques, Aditivos, Químicos CIP), nivel de stock y buscador.' }
                ],
                tip: 'Al cerrar un lote en Empaque y Congelado, las cubetas, bolsas y etiquetas configuradas en la fórmula se descuentan automáticamente de aquí.'
            },
            {
                title: 'Auditar Entradas y Salidas en el Kárdex de Movimientos de Insumos',
                description: 'Dentro de Inventario de Insumos presiona el botón derecho "Kárdex de Movimientos" encima de la tabla para ver la bitácora detallada con fecha, código de insumo, tipo de movimiento (Entrada, Salida Manual o Consumo de Empaque), cantidad, stock anterior y nuevo stock.',
                image: 'egg-insumos-kardex.png',
                annotations: [
                    { n: 1, x: 68.9, y: 55.1, w: 27.2, h: 3.2, label: 'Alternador superior de la tabla: "Existencias de Insumos" vs "Kárdex de Movimientos".' },
                    { n: 2, x: 20.9, y: 60.8, w: 75.4, h: 15, label: 'Historial de movimientos con saldo anterior, cantidad movida y saldo resultante.' }
                ],
                tip: 'Usa el filtro "Agotados" junto con "Existencias de Insumos" antes de aprobar órdenes de compra semanales de material de empaque.'
            }
        ],
        troubleshooting: [
            { issue: 'El inventario traducido muestra pesos en cero para una presentación', fix: 'Verifica en Catálogo de Productos o Ajustes de Planta que la presentación tenga su peso neto por unidad en libras/onzas asignado.' },
            { issue: 'Un insumo aparece como Agotado aunque ya llegó factura del proveedor', fix: 'Registra el ingreso en "Registrar Entrada / Salida" o asegúrate de vincular el código del insumo al producto comprado.' }
        ]
    },
    {
        slug: 'industrial-costeo-libra-simulador',
        order: 40,
        category: 'industrial',
        categoryLabel: 'Planta Industrial y CRM',
        requiredModule: 'egg_industrial',
        menuPath: 'Huevo Industrial → Costeo por Libra & Simulador',
        title: 'ANDELSA: Costeo por Libra, Simulador de Margen Libre y Escenarios',
        summary: 'Calcula el costo real por libra de ovoproducto integrando materia prima, rendimiento, mano de obra y empaques; simula márgenes objetivo y compara escenarios guardados.',
        outcome: 'Fijar precios comerciales rentables respaldados por los costos reales de planta y comparar el impacto antes de cerrar acuerdos con clientes.',
        duration: '5 min',
        modulePath: '/industrial/costeo-libra',
        roles: ['Gerencia', 'Contador', 'Operaciones', 'Produccion', 'Supervisor', 'Admin'],
        requiredPermissions: ['manage_industrial_costeo_libra'],
        coverImage: 'egg-costeo.png',
        prerequisites: [
            'Tener configurados rendimientos y costos operativos en Huevo Industrial → Ajustes y precios vigentes de insumos.'
        ],
        steps: [
            {
                title: 'Cargar Parámetros Reales de Planta y usar la Calculadora de Costeo',
                description: 'Abre Huevo Industrial → Costeo por Libra & Simulador. Selecciona el rango de análisis arriba ("Mes Actual", "30 Días", "3 Meses", "Año Actual") para ver el "Costo Actual de Planta" y pulsa "Cargar Parámetros Reales al Simulador" para trasladar automáticamente tu costo por libra real, rendimientos y merma a la calculadora inferior.',
                image: 'egg-costeo.png',
                annotations: [
                    { n: 1, x: 76.3, y: 15.6, w: 18.9, h: 3.9, label: 'Botones "Recalcular" con datos en vivo y "Guardar Escenario" actual.' },
                    { n: 2, x: 75.8, y: 48.2, w: 19.3, h: 3.6, label: 'Botón "Cargar Parámetros Reales al Simulador" para alimentar la calculadora desde la operación real.' },
                    { n: 3, x: 19.9, y: 76.9, w: 80.1, h: 3.9, label: '6 pestañas especializadas: Calculadora, Margen Libre, Metas & Comisiones, Acuerdos, Insumos y Escenarios.' }
                ],
                tip: 'También dispones de la pestaña "Acuerdos con Clientes" ahí mismo para contrastar el precio actual de cada cliente contra tu costo real.'
            },
            {
                title: 'Proyectar Precios de Venta en el Simulador de Margen Libre',
                description: 'Haz clic en "Simulador de Margen Libre" para ingresar precios por libra hipotéticos o descuentos por volumen y visualizar al instante el margen de contribución neto, utilidad mensual proyectada y punto de equilibrio sobre cada presentación.',
                image: 'egg-costeo-margen.png',
                annotations: [
                    { n: 1, x: 32.6, y: 76.9, w: 14.3, h: 3.9, label: 'Pestaña activa "Simulador de Margen Libre" dentro del módulo de Costeo por Libra.' },
                    { n: 2, x: 21.1, y: 88.8, w: 74, h: 8, label: 'Entrada de precio objetivo ($/lb) para probar rentabilidad bruta y neta en segundos.' }
                ],
                tip: 'Si ajustas salarios o energía en Huevo Industrial → Ajustes, presiona "Recalcular" arriba para actualizar inmediatamente tus simulaciones.'
            },
            {
                title: 'Archivar y Comparar Escenarios Guardados e Historial de Tarifas',
                description: 'Después de simular un escenario pulsa "Guardar Escenario" arriba a la derecha. Luego en la pestaña "Escenarios Guardados" puedes alternar entre "Producción Real & Costo/Lb", "Escenarios Simulados" e "Historial de Tarifas Clientes" para auditar decisiones históricas de precios.',
                image: 'egg-costeo-escenarios.png',
                annotations: [
                    { n: 1, x: 89.6, y: 76.9, w: 10.4, h: 3.9, label: 'Pestaña "Escenarios Guardados" para consultar simulaciones históricas.' },
                    { n: 2, x: 63.4, y: 89.6, w: 36.1, h: 3.2, label: 'Vistas comparativas: Producción Real & Costo/Lb, Escenarios Simulados e Historial de Tarifas.' }
                ],
                tip: 'Revisa "Metas & Comisiones" antes de definir incentivos comerciales para asegurarte de que la meta de ventas mantenga el margen mínimo de planta.'
            }
        ],
        troubleshooting: [
            { issue: 'El costo operativo o de planilla sale en $0.00 en la calculadora', fix: 'Entra a Huevo Industrial → Ajustes → Costos y Planillas y pulsa "Cargar desde Planillas RRHH y Gastos Operativos".' },
            { issue: 'Un empaque muestra costo desactualizado en el simulador', fix: 'Ve a Huevo Industrial → Inventario de Insumos y presiona "Sincronizar Costeo".' }
        ]
    }
];

module.exports = INDUSTRIAL_AVANZADO_TUTORIALS;
