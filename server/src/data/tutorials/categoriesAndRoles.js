/**
 * Categorías y Guías de Rol para los 15 roles oficiales de SIPE-WEB (y soporte contextual para Planta Industrial).
 */

const TUTORIAL_CATEGORIES = [
    {
        id: 'tienda',
        label: 'Tienda y POS',
        description: 'Facturación DTE, historial y PDFs, contingencia/ERET, productos, promos/combos, clientes, corte de caja y remesas.'
    },
    {
        id: 'pista',
        label: 'Pista / Gasolinera',
        description: 'Cierre de lecturas por despachador, mangueras, tanques, precios, remesas, cupones, anticipos y trupput.'
    },
    {
        id: 'compras',
        label: 'Compras y Gastos',
        description: 'Proveedores, ingreso de facturas/DTE de compra, período de compras, gastos operativos, quedanes y cheques de contado.'
    },
    {
        id: 'inventario',
        label: 'Inventario y Bodega',
        description: 'Traslados entre sucursales, ajustes y movimientos de stock, inventario físico con escáner, Kardex y reportes.'
    },
    {
        id: 'finanzas',
        label: 'Cuentas por Cobrar y Pagar',
        description: 'Estados de cuenta de clientes y proveedores, registro de abonos/pagos, antigüedad de saldos y documentos pendientes.'
    },
    {
        id: 'contabilidad',
        label: 'Contabilidad e IVA',
        description: 'Catálogo de cuentas, partidas, contabilización automática (4 motores), libros legales, estados financieros, cédula de auditoría, cierre/apertura y libros/anexos IVA.'
    },
    {
        id: 'rrhh',
        label: 'Recursos Humanos',
        description: 'Expediente de empleados, contratos, acciones de personal, marcador biométrico, planillas quincenales, vacaciones y reportes.'
    },
    {
        id: 'industrial',
        label: 'Planta Industrial y CRM',
        description: 'Dashboard Andelsa, SCADA, recepción MP, tarimas, sanitización CIP, pasteurización, empaque/Blast Freezer, calendario, contenedores, rutas, LAB-004/COA, insumos, costeo/lb, cubetas, reportes y CRM.'
    },
    {
        id: 'operaciones_admin',
        label: 'Pozo, Seguridad y Soporte',
        description: 'Despachos y corte de pozo, entregas de efectivo, usuarios, roles, accesos multiempresa, tickets de soporte y atajos Ctrl + K.'
    }
];

const ROLE_GUIDES = [
    {
        role: 'Vendedor',
        badge: 'Operación Diaria',
        color: 'indigo',
        summary: 'Atiende el Punto de Venta (POS), consulta facturas DTE y PDFs, actualiza clientes y productos, y entrega remesas.',
        highlights: [
            'Facturar Consumidor Final (01), CCF (03), Nota de Crédito (05) y Sujeto Excluido (14) en POS.',
            'Descargar PDF oficial (RTEE), revisar respuesta de Hacienda y corregir rechazos en Historial.',
            'Crear clientes con DUI/NIT/NRC/Distrito y registrar entregas de remesas de tienda.'
        ],
        industrialBadge: 'Facturación Planta y POS',
        industrialSummary: 'Atiende facturación electrónica DTE, descarga PDFs oficiales, administra clientes y productos industriales.',
        industrialHighlights: [
            'Facturar Consumidor Final (01), CCF (03) y Notas de Crédito (05) desde el Punto de Venta.',
            'Descargar PDF oficial (RTEE), reenviar correos y solventar rechazos de Hacienda.',
            'Mantener fichas fiscales de clientes industriales (NIT, NRC, Distrito) y sucursales.'
        ]
    },
    {
        role: 'Jefe Tienda',
        badge: 'Supervisión Tienda',
        color: 'emerald',
        summary: 'Supervisa apertura y corte de caja, combos, compras y gastos, inventario, cupones, remesas y reportes de tienda.',
        highlights: [
            'Abrir turnos por POS/vendedor y ejecutar el Corte de Caja y Arqueo completo.',
            'Administrar Combos, Productos, Compras, Gastos Operativos, Quedanes y Cheques de Contado.',
            'Controlar Inventario (Traslados, Físico, Kardex), Cupones y Ventas de Tienda por Turno.'
        ]
    },
    {
        role: 'Jefe Pista',
        badge: 'Supervisión Pista',
        color: 'amber',
        summary: 'Dirige los cierres de lecturas de combustibles, asigna mangueras, controla tanques, precios, remesas, créditos y compras.',
        highlights: [
            'Iniciar y cerrar turnos de Lecturas con asignaciones de mangueras y varillaje de tanques.',
            'Liquidar remesas, tarjetas, créditos, vales, cupones, anticipos de clientes y convenios Trupput.',
            'Actualizar precios de combustible, consultar Galonaje/Trupput y gestionar abonos de CXC y compras.'
        ],
        industrialBadge: 'Operación Planta y Logística',
        industrialSummary: 'Supervisa recepción de materia prima, empaque, inventario traducido, despachos de planta, compras y cobranza CXC.',
        industrialHighlights: [
            'Registrar Recepción MP, baja de tarimas y cierres técnicos de empaque y congelado.',
            'Coordinar Despachos y Rutas, Contenedores de Frío, Inventario en Lbs/Kg e Insumos.',
            'Emitir Reportes de Planta Industrial, gestionar compras a proveedores y cobros CXC.'
        ]
    },
    {
        role: 'SuperAdmin',
        badge: 'Control Total',
        color: 'indigo',
        summary: 'Acceso integral a todas las guías operativas, financieras, contables, industriales y de seguridad de la plataforma.',
        highlights: [
            'Supervisar operación comercial completa: Tienda, POS, Pista, Pozo, Compras, Inventario y Finanzas.',
            'Auditar Contabilidad, Libros de IVA, Planillas RRHH y operación industrial de planta.',
            'Administrar usuarios globales, roles, permisos, asignaciones multiempresa y tickets de soporte.'
        ],
        industrialBadge: 'Control Total Planta y ERP',
        industrialSummary: 'Acceso total a todos los flujos de Planta de Huevo Industrial, CRM, Finanzas, Contabilidad, RRHH y Seguridad.',
        industrialHighlights: [
            'Supervisar ciclo completo de planta: SCADA, Recepción MP, Pasteurización, Empaque y Trazabilidad.',
            'Controlar Costeo por Libra, Contenedores, Despachos, Insumos, Reportes y CRM Comercial.',
            'Auditar Facturación DTE, Contabilidad, Libros de IVA, Planillas y Permisos de Usuarios.'
        ]
    },
    {
        role: 'Admin',
        badge: 'Administración General',
        color: 'indigo',
        summary: 'Administra integralmente Tienda, Pista, Compras, Inventario, Contabilidad, RRHH, usuarios y accesos de la empresa.',
        highlights: [
            'Supervisar facturación POS, contingencia DTE, catálogos, cortes de caja y cierres de pista.',
            'Controlar Compras, CXC/CXP, Inventario, Contabilidad automática y Planillas de Recursos Humanos.',
            'Crear usuarios, configurar matrices de permisos por rol y asignar accesos a sucursales.'
        ],
        industrialBadge: 'Administración Planta Industrial',
        industrialSummary: 'Administra integralmente Planta de Huevo Industrial, CRM Comercial, Ventas DTE, Finanzas, RRHH y Seguridad.',
        industrialHighlights: [
            'Supervisar Recepción MP, Producción/Pasteurización, Empaque, Inventario y Trazabilidad 360°.',
            'Configurar prefijos y parámetros de planta, Calendario, Costeo, CRM y Reportes Industriales.',
            'Controlar Facturación POS, Compras, Contabilidad, Planillas RRHH y Roles de acceso.'
        ]
    },
    {
        role: 'Supervisor',
        badge: 'Supervisión Operativa',
        color: 'emerald',
        summary: 'Supervisa la operación diaria de Tienda, Pista, Pozo, Compras, CXC/CXP, Inventario y Planta Industrial.',
        highlights: [
            'Verificar aperturas y cortes de caja, cierres de lecturas de pista y entregas de remesas.',
            'Validar compras, gastos operativos, abonos CXC/CXP, ajustes y tomas de inventario físico.',
            'Dar seguimiento a despachos de pozo, operación industrial, acuerdos CRM y soporte.'
        ],
        industrialBadge: 'Supervisión de Planta y Rutas',
        industrialSummary: 'Supervisa el proceso industrial completo en planta, despachos y rutas, inventarios, compras, cartera y CRM.',
        industrialHighlights: [
            'Monitorear Panel IoT/SCADA, Calendario de Producción, Pasteurización y Empaque/Congelado.',
            'Supervisar Despachos y Rutas, Contenedores de Frío, Insumos y Reportes de Planta.',
            'Validar Acuerdos CRM, Facturación POS, Compras, CXC/CXP e Inventario Físico.'
        ]
    },
    {
        role: 'Gerencia',
        badge: 'Dirección y Auditoría',
        color: 'emerald',
        summary: 'Consulta reportes ejecutivos y supervisa cierres de Tienda, Pista, Pozo, cartera CXC/CXP y operación comercial.',
        highlights: [
            'Auditar DTE emitidos, arqueos de caja, lecturas de pista con bitácora de cambios y precios.',
            'Controlar saldos de Cuentas por Cobrar y Pagar, compras, inventarios y liquidaciones de pozo.',
            'Monitorear indicadores de Planta Industrial, trazabilidad, acuerdos CRM y cotizaciones.'
        ],
        industrialBadge: 'Dirección Planta Industrial',
        industrialSummary: 'Monitorea indicadores de Planta Industrial, costos y márgenes, reportes ejecutivos, cartera CXC/CXP y CRM.',
        industrialHighlights: [
            'Supervisar Panel SCADA, Calendario de Producción, Despachos, Contenedores y Reportes de Planta.',
            'Auditar Facturación DTE, Arqueos, Compras, Gastos, Inventario y Cartera de Clientes/Proveedores.',
            'Dar seguimiento estratégico a Acuerdos de Precios y Cotizaciones del módulo CRM.'
        ]
    },
    {
        role: 'Contador',
        badge: 'Control Fiscal y Contable',
        color: 'violet',
        summary: 'Administra Contabilidad, Libros y Anexos de IVA, Planillas de RRHH, auditoría fiscal DTE, CXC/CXP y conciliación.',
        highlights: [
            'Gestionar Catálogo de Cuentas, Partidas manuales, Contabilización automática y Auditoría.',
            'Emitir Libros de IVA (Compras, CCF, Consumidor), Anexos DTE y Liquidación mensual/Pago a Cuenta.',
            'Calcular Planillas quincenales/vacaciones, revisar DTEs, cierres de pista y saldos CXC/CXP.'
        ],
        industrialBadge: 'Control Contable y Costos Planta',
        industrialSummary: 'Administra Contabilidad, Libros de IVA, Planillas RRHH, Costeo por Libra, Costos de Planta, Inventario y Cartera.',
        industrialHighlights: [
            'Gestionar Contabilidad automática, Partidas, Auditoría IA, Libros y Anexos de IVA y Planillas.',
            'Auditar Costeo por Libra & Simulador, Costos de Planta, Inventario Traducido e Insumos.',
            'Conciliar Facturación DTE, Compras, Baja de Tarimas, Contenedores y Saldos CXC/CXP.'
        ]
    },
    {
        role: 'Operaciones',
        badge: 'Operación Comercial',
        color: 'cyan',
        summary: 'Coordina promociones, combos, compras, inventario, planta industrial, CRM comercial y acciones de personal.',
        highlights: [
            'Configurar combos, promociones vigentes y acuerdos/descuentos por cliente y sucursal.',
            'Supervisar Compras, Traslados, Inventario Físico, Kardex y Cotizaciones/Acuerdos CRM.',
            'Gestionar acciones de personal, contratos laborales y seguimiento operativo de Planta Industrial.'
        ],
        industrialBadge: 'Operaciones Planta y CRM',
        industrialSummary: 'Coordina la operación integral de Planta Industrial, CRM Comercial, Inventarios, Compras y Acciones de Personal.',
        industrialHighlights: [
            'Controlar Recepción MP, Calendario, Producción, Empaque, Despachos, Insumos y Trazabilidad 360°.',
            'Administrar Costeo por Libra, Costos de Planta, Cotizaciones Comerciales y Acuerdos CRM.',
            'Supervisar Combos/Promos, Compras, Kardex, Contratos Laborales y Marcador Digital.'
        ]
    },
    {
        role: 'Bodega',
        badge: 'Logística e Inventarios',
        color: 'teal',
        summary: 'Controla existencias, traslados entre sucursales, movimientos, inventario físico, Kardex, compras y despachos.',
        highlights: [
            'Ejecutar Traslados entre bodegas, Movimientos de ajuste y conteos de Inventario Físico.',
            'Auditar entradas y salidas en Consulta Kardex y Reportes de Stock y Rotación.',
            'Recibir compras de proveedores y controlar inventario, insumos y despachos industriales.'
        ],
        industrialBadge: 'Bodega Frío e Insumos Planta',
        industrialSummary: 'Controla tarimas de materia prima, producto terminado en Lbs/Kg, insumos/empaques/CIP, contenedores y despachos.',
        industrialHighlights: [
            'Gestionar Recepción MP, Baja de Tarimas, Empaque y Contenedores de Frío.',
            'Controlar Inventario Industrial, Insumos y Kárdex, Traslados y Toma de Inventario Físico.',
            'Coordinar Despachos y Rutas de entrega junto con el registro de compras.'
        ]
    },
    {
        role: 'Auxiliar',
        badge: 'Apoyo Administrativo',
        color: 'amber',
        summary: 'Apoya en remesas, lecturas de pista, cupones, anticipos, Trupput, cobros CXC, compras y declaraciones de IVA.',
        highlights: [
            'Registrar entregas de remesas de Tienda y Pista y apoyar en el Cierre e Historial de Lecturas.',
            'Gestionar liquidación de cupones, anticipos de clientes, despachos Trupput y abonos CXC.',
            'Consultar compras, gastos operativos, Libro de Compras y Liquidación de IVA.'
        ]
    },
    {
        role: 'Asistente',
        badge: 'Apoyo de Tienda y Reportes',
        color: 'sky',
        summary: 'Registra entregas de remesas de tienda y consulta reportes operativos de ventas, arqueos y turnos.',
        highlights: [
            'Consolidar boletas bancarias en Ventas → Entrega de Remesas de Tienda.',
            'Consultar Reporte de Arqueos, Ventas de Tienda por Turno y Detalle de Facturación.',
            'Reportar incidencias y usar atajos rápidos en Soporte y Ctrl + K.'
        ]
    },
    {
        role: 'Auditor',
        badge: 'Auditoría Contable y Turnos',
        color: 'slate',
        summary: 'Verifica cuadres contables, contabilización de turnos y bancos, declaraciones de IVA y arqueos de facturación.',
        highlights: [
            'Revisar Auditoría Contable e Impresión de Partidas, así como contabilización de turnos y bancos.',
            'Cruzar Anexos de IVA Compras con el Reporte de Arqueos y Ventas de Tienda por Turno.',
            'Verificar Detalle de Facturación y reportar hallazgos mediante Soporte y Tickets.'
        ]
    },
    {
        role: 'Produccion',
        badge: 'Planta Industrial',
        color: 'cyan',
        summary: 'Opera los procesos de Planta de Huevo Industrial: recepción MP, pasteurización, empaque, calendario, insumos, despachos y marcador.',
        highlights: [
            'Registrar Recepción de Materia Prima, baja de tarimas, lotes de Pasteurización y Empaque/Blast Freezer.',
            'Planificar en Calendario de Producción y controlar Insumos, Contenedores, Costeo y Trazabilidad 360°.',
            'Consultar Panel IoT/SCADA, Despachos y Rutas, Reportes de Planta y Marcador Digital.'
        ]
    },
    {
        role: 'Calidad',
        badge: 'Aseguramiento de Calidad',
        color: 'rose',
        summary: 'Verifica inocuidad, liberación de lotes pasteurizados, limpieza CIP, trazabilidad 360° y control de inventario/CRM.',
        highlights: [
            'Evaluar análisis de calidad (LAB-004), liberar lotes de producción y autorizar excepciones CIP.',
            'Auditar Trazabilidad 360°, Calendario de Producción, Contenedores, Costos y Reportes de Calidad.',
            'Supervisar Inventario Industrial, Insumos, Cotizaciones y Acuerdos Comerciales CRM.'
        ]
    }
];

module.exports = {
    TUTORIAL_CATEGORIES,
    ROLE_GUIDES
};
