/**
 * Tutoriales Fase 3: Cobertura Profunda de Contabilidad — Contabilización Automática (4 motores),
 * Libros Legales & Auxiliares, Estados Financieros Oficiales y Auditoría/Retenciones (#41 - #44)
 */

const CONTABILIDAD_AVANZADA_TUTORIALS = [
    {
        slug: 'contabilidad-contabilizar-automatico',
        order: 41,
        category: 'contabilidad',
        categoryLabel: 'Contabilidad e IVA',
        requiredModule: 'accounting',
        menuPath: 'Contabilidad → Contabilizar (Ventas/Compras, CxC/CxP, Cierres de Turno y Bancos)',
        title: 'Contabilidad: Contabilización Automática (Ventas, CxC/CxP, Turnos y Bancos)',
        summary: 'Genera partidas contables automáticas sin digitación manual desde los cuatro motores del sistema: Ventas/Compras, Cobros CxC y Pagos CxP, Cierres de Turno y Cheques/Bancos de oficina.',
        outcome: 'Mantener la contabilidad diaria al día transformando operaciones facturadas, recibos, lecturas de pista y cheques emitidos en partidas cuadradas.',
        duration: '6 min',
        modulePath: '/contabilidad/contabilizar',
        roles: ['Contador', 'Auxiliar', 'Auditor', 'Admin'],
        requiredPermissions: [
            'manage_accounting_contabilizar_ventas_compras',
            'manage_accounting_contabilizar_cxc_cxp',
            'manage_accounting_contabilizar_turnos',
            'manage_accounting_contabilizar_bancos'
        ],
        coverImage: 'acc-contabilizar-bancos.png',
        prerequisites: [
            'Tener configuradas las Cuentas por Defecto y Conexión Oficina en Contabilidad → Ajustes.'
        ],
        steps: [
            {
                title: 'Contabilizar Ventas y Compras por Día o Período',
                description: 'En Contabilidad → Contabilizar → Ventas/Compras elige la pestaña "VENTAS" o "COMPRAS", selecciona el rango de fechas y sucursal, y presiona "Calcular". El sistema agrupa cuentas por defecto (caja, bancos, ingresos gravados/exentos, IVA débito/crédito, FOVIAL/COTRANS) y genera el borrador listo para contabilizar.',
                image: 'accounting-generate.png',
                annotations: [
                    { n: 1, x: 26.1, y: 23, w: 13.4, h: 4, label: 'Pestañas superiores para alternar entre contabilización de VENTAS y COMPRAS.' },
                    { n: 2, x: 28.9, y: 46.4, w: 18.6, h: 3.7, label: 'Acceso rápido a "CONFIGURAR EN CUENTAS POR DEFECTO" si falta mapear alguna cuenta.' },
                    { n: 3, x: 81.8, y: 60, w: 8.4, h: 4.5, label: 'Botón "Calcular" para construir las partidas automáticas y validarlas antes de guardar.' }
                ],
                tip: 'Revisa los totales de débito y crédito propuestos en la vista previa antes de confirmar la creación definitiva de la póliza.'
            },
            {
                title: 'Contabilizar Abonos de CxC y Pagos a Proveedores (CxC / CxP)',
                description: 'Abre Contabilidad → Contabilizar → CxC/CxP. Cambia entre las pestañas "CXC" (recibos de cobro a clientes) y "CXP" (egresos pagados a proveedores), define la fecha a contabilizar y pulsa "Calcular" para generar la partida cruzando cuentas por cobrar/pagar contra caja o bancos.',
                image: 'acc-contabilizar-cxc-cxp.png',
                annotations: [
                    { n: 1, x: 26.1, y: 23, w: 9.6, h: 4, label: 'Pestañas para elegir el flujo CXC (Clientes) o CXP (Proveedores).' },
                    { n: 2, x: 28.9, y: 39, w: 18.6, h: 3.7, label: 'Enlace directo a Cuentas por Defecto para cuentas puente de clientes y proveedores.' },
                    { n: 3, x: 81.8, y: 52.6, w: 8.4, h: 4.5, label: 'Botón "Calcular" para consolidar los recibos/egresos pendientes del día.' }
                ],
                tip: 'Si un abono ya fue contabilizado previamente en ese día, el motor evita duplicarlo automáticamente.'
            },
            {
                title: 'Contabilizar Cierres de Turno de Estación (Pista y Tienda)',
                description: 'Ingresa a Contabilidad → Contabilizar → Cierres de Turno. Selecciona la Sucursal, elige el tipo de partida contable que deseas emitir (ej. Diario o Ajuste) y presiona "Calcular Borrador" para transformar las lecturas de bombas, ventas de tienda, vales, tarjetas, remesas y diferencias del turno en una póliza lista.',
                image: 'acc-contabilizar-turnos.png',
                annotations: [
                    { n: 1, x: 22, y: 25.9, w: 38.5, h: 3.6, label: 'Selector de Sucursal / Estación cuyos turnos cerrados deseas contabilizar.' },
                    { n: 2, x: 71.6, y: 25.9, w: 23.7, h: 3.6, label: 'Tipo de Partida y botón "Calcular Borrador" desde las liquidaciones del turno.' }
                ],
                tip: 'Asegúrate de que el turno de gasolinera o tienda haya sido cerrado y liquidado primero para que aparezcan todas sus remesas y arqueos.'
            },
            {
                title: 'Contabilizar Cheques y Movimientos Bancarios (Conexión Oficina)',
                description: 'En Contabilidad → Contabilizar → Bancos / Cheques alterna arriba entre "CHEQUES PENDIENTES", "MOVIMIENTOS BANCARIOS" y "RESERVA DE CORRELATIVOS". Filtra por Mes, Año, Estado o beneficiario, pulsa "CONSULTAR", marca los cheques emitidos o anulados deseados y contabilízalos en lote sin duplicar correlativos.',
                image: 'acc-contabilizar-bancos.png',
                annotations: [
                    { n: 1, x: 21.1, y: 22.3, w: 56.9, h: 4.1, label: 'Modos principales: Cheques Pendientes, Movimientos Bancarios y Reserva de Correlativos.' },
                    { n: 2, x: 22.2, y: 33.3, w: 71.9, h: 4.1, label: 'Filtros por Mes, Año, Estado (Pendientes/Contabilizados), buscador y botón "CONSULTAR".' },
                    { n: 3, x: 21.1, y: 45.7, w: 74, h: 16.2, label: 'Tabla de cheques emitidos/anulados desde oficina con casilla de selección múltiple.' }
                ],
                tip: 'Usa la pestaña "RESERVA DE CORRELATIVOS" cuando necesites apartar o sincronizar números de partida de cheques antes de emitir cierres mensuales.'
            }
        ],
        troubleshooting: [
            { issue: 'El botón Calcular muestra error de cuenta faltante', fix: 'Haz clic en el enlace azul "CONFIGURAR EN CUENTAS POR DEFECTO" e indica la cuenta de detalle correspondiente en General o Cuentas por Defecto.' },
            { issue: 'Bancos / Cheques no descarga cheques desde la base de oficina', fix: 'Verifica en Contabilidad → Ajustes → pestaña "CONEXIÓN OFICINA" que la empresa tenga credenciales válidas de acceso.' }
        ]
    },
    {
        slug: 'contabilidad-libros-legales-auxiliares',
        order: 42,
        category: 'contabilidad',
        categoryLabel: 'Contabilidad e IVA',
        requiredModule: 'accounting',
        menuPath: 'Contabilidad → Reportes → Libro Diario, Diario Mayor, Libro Mayor, Auxiliar e Impresión',
        title: 'Contabilidad: Libros Legales (Diario y Mayor), Auxiliar e Impresión de Partidas',
        summary: 'Emite los libros contables legales en PDF o Excel: Libro Diario, Libro Diario Mayor, Libro Mayor, Auxiliar de Operaciones, Listado de Partidas e Impresión de Pólizas.',
        outcome: 'Respaldar cada cierre mensual con los libros oficiales impresos y revisar el detalle cuenta por cuenta cuando se necesite conciliar diferencias.',
        duration: '5 min',
        modulePath: '/contabilidad/reportes/libro-diario',
        roles: ['Contador', 'Auditor', 'Gerencia', 'Admin'],
        requiredPermissions: [
            'view_accounting_libro_diario',
            'view_accounting_libro_diario_mayor',
            'view_accounting_libro_mayor',
            'view_accounting_auxiliar_operaciones',
            'view_accounting_listado_partidas',
            'view_accounting_impresion_partidas'
        ],
        coverImage: 'acc-libro-diario.png',
        prerequisites: [
            'Contar con partidas registradas/mayorizadas en el período contable a consultar.'
        ],
        steps: [
            {
                title: 'Emitir Libro Diario y Libro Diario Mayor Oficial',
                description: 'Ingresa a Contabilidad → Reportes → Libro Diario (o Libro Diario Mayor para ver saldos resumidos diarios). En el panel izquierdo define rango de fechas o mes y filtra por tipo de partida si deseas (Todas, Ajuste, Apertura, Cierre), luego pulsa "GENERAR REPORTE" para obtener la vista previa PDF o exportar a Excel.',
                image: 'acc-libro-diario.png',
                annotations: [
                    { n: 1, x: 23.9, y: 52.1, w: 12.2, h: 5, label: 'Selector de Tipo de Partida para incluir todos los diarios o aislar cierres/ajustes.' },
                    { n: 2, x: 23.9, y: 63.6, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para renderizar el Libro Diario en formato legal.' },
                    { n: 3, x: 40, y: 24, w: 54, h: 66, label: 'Visor del reporte generado con opción Expandir y descarga PDF / Excel.' }
                ],
                tip: 'Usa Libro Diario Mayor cuando necesites folios legales mensuales foliados listos para encuadernación fiscal.'
            },
            {
                title: 'Consultar Movimientos por Cuenta en el Libro Mayor',
                description: 'Abre Contabilidad → Reportes → Libro Mayor. Selecciona el período y el rango de cuentas de mayor que deseas revisar y haz clic en "GENERAR REPORTE" para ver por cada rubro su saldo anterior, débitos del mes, créditos del mes y saldo final.',
                image: 'acc-libro-mayor.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31, w: 12.2, h: 28, label: 'Parámetros de período y cuentas contables de Mayor en el panel lateral.' },
                    { n: 2, x: 23.9, y: 62.2, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para construir el Libro Mayor completo.' }
                ],
                tip: 'Compara el saldo final de las cuentas de Bancos e IVA del Libro Mayor contra el Auxiliar de Operaciones cuando detectes diferencias.'
            },
            {
                title: 'Rastrear Comprobantes en el Auxiliar de Operaciones',
                description: 'Ve a Contabilidad → Reportes → Auxiliar de Operaciones. Elige una cuenta contable específica (ej. Caja General, Bancos, Inventarios o Clientes) y el rango de fechas, y presiona "GENERAR REPORTE" para listar cada partida individual, su concepto y saldo corrido línea por línea.',
                image: 'acc-auxiliar-operaciones.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31, w: 12.2, h: 36, label: 'Selección de Cuenta Contable de detalle y rango de fechas del auxiliar.' },
                    { n: 2, x: 23.9, y: 71.2, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para imprimir o exportar el auxiliar a Excel.' }
                ],
                tip: 'El Auxiliar de Operaciones en Excel es la herramienta más rápida para conciliar estados de cuenta bancarios o cuentas de anticipos.'
            },
            {
                title: 'Imprimir Pólizas en Lote y Consultar el Listado de Partidas',
                description: 'En Contabilidad → Reportes → Impresión de Partidas elige entre el formato "NORMAL (DETALLADA)" (cada línea exacta) o "MAYORIZADA (4 DÍGITOS)" (agrupada a nivel de cuenta mayor), filtra el tipo/rango y presiona "GENERAR REPORTE". También tienes "Listado de Partidas" para auditar rápidamente estados (Mayorizadas, Borrador o Anuladas).',
                image: 'acc-impresion-partidas.png',
                annotations: [
                    { n: 1, x: 23.9, y: 33.1, w: 12.1, h: 25.8, label: 'Modo de impresión: NORMAL (Detallada) o MAYORIZADA (Agrupada a 4 dígitos).' },
                    { n: 2, x: 23.9, y: 84.9, w: 12.2, h: 14.5, label: 'Filtro de Tipo de Partida y botón "GENERAR REPORTE" para imprimir el lote de pólizas.' }
                ],
                tip: 'Revisa "Listado de Partidas" filtrando por estado "Borrador" antes de cerrar mes para no dejar asientos sin mayorizar.'
            }
        ],
        troubleshooting: [
            { issue: 'Una partida reciente no aparece en Libro Diario ni Libro Mayor', fix: 'Verifica en Listado de Partidas o Partidas Contables que su estado sea Mayorizada/Contabilizada y no esté en Borrador.' },
            { issue: 'El Auxiliar de Operaciones sale muy extenso para revisar en pantalla', fix: 'Filtra por cuenta de detalle específica o descarga en Excel desde la barra superior del reporte.' }
        ]
    },
    {
        slug: 'contabilidad-estados-financieros',
        order: 43,
        category: 'contabilidad',
        categoryLabel: 'Contabilidad e IVA',
        requiredModule: 'accounting',
        menuPath: 'Contabilidad → Reportes → Balance de Comprobación, Estado de Resultados, Balance General, Comparativo, Patrimonio y Flujo de Efectivo',
        title: 'Contabilidad: Estados Financieros Oficiales (Comprobación, Resultados, Balance y Flujo)',
        summary: 'Genera la suite completa de estados financieros en PDF y Excel: Balance de Comprobación, Estado de Resultados, Balance General con Anexos, Balance Comparativo, Cambios en el Patrimonio y Flujo de Efectivo.',
        outcome: 'Emitir estados financieros cuadrados, comparativos interanuales y reportes oficiales bajo norma contable listos para gerencia, bancos y auditoría externa.',
        duration: '6 min',
        modulePath: '/contabilidad/reportes/balance-general',
        roles: ['Contador', 'Auditor', 'Gerencia', 'Supervisor', 'Admin'],
        requiredPermissions: [
            'view_accounting_balance_comprobacion',
            'view_accounting_estado_resultados',
            'view_accounting_balance_general',
            'view_accounting_anexo_balance',
            'view_accounting_balance_comparativo',
            'view_accounting_cambios_patrimonio',
            'view_accounting_flujo_efectivo'
        ],
        coverImage: 'acc-balance-comprobacion.png',
        prerequisites: [
            'Tener contabilizadas las operaciones del mes y validada la Auditoría Contable sin partidas descuadradas.'
        ],
        steps: [
            {
                title: 'Validar Sumas Iguales en el Balance de Comprobación',
                description: 'Abre Contabilidad → Reportes → Balance de Comprobación. Selecciona el Mes, el Nivel de cuenta (Nivel 1 a Nivel 5+) y el Formato ("Cargos y Abonos" mostrando Saldo Inicial, Movimientos y Saldo Final, o "Por Niveles"), y presiona "GENERAR REPORTE" para verificar que el Debe y Haber cuadren exactos.',
                image: 'acc-balance-comprobacion.png',
                annotations: [
                    { n: 1, x: 23.9, y: 41.5, w: 12.2, h: 27.4, label: 'Filtros: Mes de corte, Nivel de agrupación y Formato (Cargos/Abonos o Por Niveles).' },
                    { n: 2, x: 23.9, y: 75.4, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para visualizar el balance en PDF o descargarlo a Excel.' }
                ],
                tip: 'Genera primero la Balanza de Comprobación en Formato "Cargos y Abonos" antes de emitir el Estado de Resultados o Balance General.'
            },
            {
                title: 'Emitir el Estado de Resultados (Pérdidas y Ganancias)',
                description: 'Ve a Contabilidad → Reportes → Estado de Resultados. Elige el Mes y el Nivel de detalle que deseas mostrar en Ingresos, Costos de Venta, Gastos de Operación y Utilidad Neta antes/después de reserva e impuesto, y pulsa "GENERAR REPORTE".',
                image: 'acc-estado-resultados.png',
                annotations: [
                    { n: 1, x: 23.9, y: 41.5, w: 12.2, h: 15.3, label: 'Selector de Mes de corte y Nivel de desglose para cuentas de resultado.' },
                    { n: 2, x: 23.9, y: 63.3, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para obtener la vista previa con firmas oficiales.' }
                ],
                tip: 'En nivel 3 o 4 presentas un Estado de Resultados ejecutivo limpio; usa nivel 5 cuando revises gasto por gasto internamente.'
            },
            {
                title: 'Generar Balance General Oficial y Anexo de Balance',
                description: 'Entra a Contabilidad → Reportes → Balance General (y usa "Anexo de Balance" cuando requieras el detalle de subcuentas de cada rubro). Selecciona Mes, Nivel y Formato, pulsa "GENERAR REPORTE" y valida la ecuación Activo = Pasivo + Patrimonio en el visor derecho.',
                image: 'acc-balance-general.png',
                annotations: [
                    { n: 1, x: 23.5, y: 41, w: 13, h: 42, label: 'Configuración de Mes, Nivel, Formato y botón "GENERAR REPORTE".' },
                    { n: 2, x: 40, y: 24, w: 54, h: 66, label: 'Visor del Balance General listo para expandir, imprimir o descargar en PDF/Excel.' }
                ],
                tip: 'Si el resultado del ejercicio no aparece reflejado dentro del Patrimonio mensual, confirma que las cuentas de resultado estén correctamente clasificadas en el Catálogo.'
            },
            {
                title: 'Analizar Variaciones en el Balance Comparativo',
                description: 'En Contabilidad → Reportes → Balance Comparativo selecciona los meses/años a contrastar y el Nivel contable y pulsa "GENERAR REPORTE" para obtener lado a lado los saldos de dos períodos junto con su variación absoluta ($) y porcentual (%).',
                image: 'acc-balance-comparativo.png',
                annotations: [
                    { n: 1, x: 23.9, y: 51.6, w: 12.2, h: 15.4, label: 'Selectores de período comparativo y Nivel de cuentas a contrastar.' },
                    { n: 2, x: 23.9, y: 73.4, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" con cálculo automático de variaciones.' }
                ],
                tip: 'Excelente para juntas de Gerencia comparando la situación financiera de fin de mes contra el cierre del año anterior.'
            },
            {
                title: 'Emitir Flujo de Efectivo y Cambios en el Patrimonio Neto',
                description: 'Abre Contabilidad → Reportes → Flujo de Efectivo (o Cambios en el Patrimonio). Elige Año y Mes y pulsa "GENERAR REPORTE" para emitir los estados complementarios obligatorios mostrando origen y aplicación de fondos por actividades de operación, inversión y financiamiento.',
                image: 'acc-flujo-efectivo.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31.4, w: 12.2, h: 14.4, label: 'Filtros de Año y Mes aplicables tanto a Flujo de Efectivo como a Cambios en el Patrimonio.' },
                    { n: 2, x: 23.9, y: 52.3, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para generar el documento formal en PDF o Excel.' }
                ],
                tip: 'Emite estos dos reportes al cierre anual después de registrar la Partida de Cierre y distribución de utilidades o reserva legal.'
            }
        ],
        troubleshooting: [
            { issue: 'El Balance General muestra diferencia entre Activo y Pasivo + Capital', fix: 'Ejecuta primero Contabilidad → Auditoría Contable para ubicar cualquier partida descuadrada o sin mayorizar en el período.' },
            { issue: 'Falta detalle de subcuentas al presentar los estados a un banco', fix: 'Acompaña el Balance General generando el reporte Contabilidad → Reportes → Anexo de Balance para ese mismo mes.' }
        ]
    },
    {
        slug: 'contabilidad-auditoria-retenciones',
        order: 44,
        category: 'contabilidad',
        categoryLabel: 'Contabilidad e IVA',
        requiredModule: 'accounting',
        menuPath: 'Contabilidad → Reportes → Cédula de Auditoría y Retenciones (IVA / ISR)',
        title: 'Contabilidad: Cédula de Auditoría por Cuenta y Reporte de Retenciones (IVA / ISR)',
        summary: 'Genera papeles de trabajo de auditoría contable cuenta por cuenta (Cédula de Auditoría) y consolida mensualmente las retenciones y percepciones de IVA (1%) e Impuesto Sobre la Renta (ISR).',
        outcome: 'Preparar evidencia documental exacta para auditores externos/fiscales y cuadrar retenciones mensuales F-07 / F-14 antes de presentar declaraciones.',
        duration: '4 min',
        modulePath: '/contabilidad/reportes/cedula-auditoria',
        roles: ['Contador', 'Auditor', 'Gerencia', 'Admin'],
        requiredPermissions: ['view_accounting_cedula_auditoria', 'view_accounting_retenciones'],
        coverImage: 'acc-retenciones.png',
        prerequisites: [
            'Contar con cuentas contables con movimientos y documentos sujetos a retención o percepción en el mes.'
        ],
        steps: [
            {
                title: 'Generar Cédula de Auditoría por Cuenta Contable',
                description: 'En Contabilidad → Reportes → Cédula de Auditoría elige la cuenta contable o rubro bajo examen y el período de corte, luego presiona "GENERAR REPORTE" para obtener la cédula analítica sumaria con composición de saldos, referencias y totales listos para papel de trabajo.',
                image: 'acc-cedula-auditoria.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31, w: 12.2, h: 28, label: 'Selección de cuenta contable y rango/mes sujeto a inspección en Cédula de Auditoría.' },
                    { n: 2, x: 23.9, y: 62.2, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para descargar la cédula formal en PDF o Excel.' }
                ],
                tip: 'Úsala al cierre trimestral o anual para documentar saldos de cuentas de balance significativas como Bancos, Cuentas por Cobrar y Proveedores.'
            },
            {
                title: 'Consolidar Retenciones de IVA (1%) e Impuesto Sobre la Renta (ISR)',
                description: 'Abre Contabilidad → Reportes → Retenciones. Selecciona Año, Mes y el filtro "Tipo de Retención" ("Todas las retenciones", "IVA Retenido / Percepción (1%)" o "Impuesto sobre la Renta (ISR)") y haz clic en "GENERAR REPORTE" para cruzar lo contabilizado contra tus declaraciones.',
                image: 'acc-retenciones.png',
                annotations: [
                    { n: 1, x: 23.9, y: 31.4, w: 12.2, h: 23.9, label: 'Filtros por Año, Mes y Tipo de Retención (Todas, IVA 1% o ISR Renta).' },
                    { n: 2, x: 23.9, y: 61.7, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para visualizar y exportar el detalle de retenciones.' }
                ],
                tip: 'Cruza este reporte con Libros de IVA → Anexo de IVA Compras y Recursos Humanos → Honorarios antes de enviar F-07 y F-14.'
            }
        ],
        troubleshooting: [
            { issue: 'Una retención de renta o IVA 1% no figura en el reporte mensual', fix: 'Confirma que el comprobante o recibo de honorarios pertenezca al mes consultado y que su póliza o documento esté contabilizado.' },
            { issue: 'Necesito editar los datos de una cédula de auditoría en hoja de cálculo', fix: 'Usa el botón Exportar Excel del visor superior tras pulsar "GENERAR REPORTE".' }
        ]
    }
];

module.exports = CONTABILIDAD_AVANZADA_TUTORIALS;
