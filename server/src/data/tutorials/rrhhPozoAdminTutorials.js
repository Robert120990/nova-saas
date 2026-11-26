/**
 * Tutoriales Fase 2: Recursos Humanos, Control de Pozo, Seguridad y Soporte (#20, #21, #26, #27, #28)
 */

const RRHH_POZO_ADMIN_TUTORIALS = [
    {
        slug: 'rrhh-empleados-contratos-acciones',
        order: 20,
        category: 'rrhh',
        categoryLabel: 'Recursos Humanos',
        requiredModule: 'human_resources',
        menuPath: 'Recursos Humanos → Empleados, Contratos y Acciones',
        title: 'Expediente de Empleados, Contratos, Acciones y Marcador Digital',
        summary: 'Administra el padrón laboral, genera contratos individuales listos para firma en PDF, documenta amonestaciones/acciones de personal y controla marcaciones biométricas.',
        outcome: 'Centralizar la ficha del colaborador, emitir contratos legales y vincular su asistencia del reloj biométrico a planilla.',
        duration: '5 min',
        modulePath: '/rh/empleados',
        roles: ['Contador', 'Operaciones', 'Produccion', 'Admin'],
        requiredPermissions: ['manage_rh_empleados', 'manage_rh_contratos_laborales', 'manage_rh_acciones_personal', 'manage_rh_biometric_attendance'],
        coverImage: 'rh-empleados.png',
        prerequisites: [
            'Tener configurados previamente Departamentos, Cargos y AFPs en Recursos Humanos → Catálogos.'
        ],
        steps: [
            {
                title: 'Crear y filtrar fichas en Empleados',
                description: 'En Recursos Humanos → Empleados filtra por sucursal, departamento, cargo o estado (Activos/Inactivos) y busca por código, nombre o DUI. Presiona "Nuevo Empleado" para completar sus datos personales, cuenta bancaria, AFP/ISSS, salario base y fecha de ingreso.',
                image: 'rh-empleados.png',
                annotations: [
                    { n: 1, x: 86.2, y: 11.6, w: 11.6, h: 3.6, label: 'Botón "Nuevo Empleado" para registrar una contratación en el padrón.' },
                    { n: 2, x: 20.3, y: 18.8, w: 76.7, h: 3.6, label: 'Buscador y filtros por Sucursal, Departamento, Cargo y Estado laboral.' },
                    { n: 3, x: 19.6, y: 25.5, w: 78.1, h: 25, label: 'Listado de empleados con Código, Nombre, DUI, Cargo, Departamento y Acciones.' }
                ],
                tip: 'Completa el Número de Cuenta y AFP desde el inicio para evitar rechazos cuando generes la planilla quincenal y los archivos bancarios.'
            },
            {
                title: 'Emitir Contratos Individuales de Trabajo en PDF',
                description: 'Ingresa a Recursos Humanos → Contrato Laboral y pulsa "Nuevo Contrato Laboral". Selecciona al trabajador para autollenar su ficha, define jornada, horario, lugar de trabajo y cláusulas, y luego utiliza los botones de fila para imprimir el Contrato Oficial en PDF o duplicar uno como plantilla.',
                image: 'rh-contratos.png',
                annotations: [
                    { n: 1, x: 82.1, y: 13.1, w: 14.6, h: 4.5, label: 'Botón "Nuevo Contrato Laboral" para redactar un contrato individual.' },
                    { n: 2, x: 20.5, y: 25.6, w: 56.6, h: 3.8, label: 'Buscador por trabajador, DUI o cargo y filtro de estado (Vigente, Finalizado, Anulado).' },
                    { n: 3, x: 88.4, y: 40.2, w: 8.6, h: 4, label: 'Acciones por contrato: Ver PDF oficial, Editar, Duplicar plantilla o Eliminar.' }
                ],
                tip: 'Usa el botón "Duplicar como plantilla" cuando vayas a contratar varios colaboradores bajo el mismo horario y tipo de puesto.'
            },
            {
                title: 'Documentar Acciones de Personal (Amonestaciones y Permisos)',
                description: 'Abre Recursos Humanos → Acciones de Personal y presiona "Nueva Acción". Elige al empleado, selecciona la medida aplicada (llamado de atención verbal/escrito, suspensión, felicitación o traslado), resume la causa y descarga el acta lista para firmas.',
                image: 'rh-acciones.png',
                annotations: [
                    { n: 1, x: 86.7, y: 13.1, w: 10, h: 4.5, label: 'Botón "Nueva Acción" para levantar un registro o amonestación formal.' },
                    { n: 2, x: 20.5, y: 25.6, w: 56.6, h: 3.8, label: 'Filtros por empleado, causa, correlativo o tipo de sanción/medida.' }
                ],
                tip: 'Todas las acciones emitidas se pueden consultar consolidadas en Recursos Humanos → Reportes → Historial Acciones de Personal.'
            },
            {
                title: 'Controlar asistencia y horas extras en Marcador Digital Biométrico',
                description: 'Si la empresa tiene activo el módulo biométrico, entra a Recursos Humanos → Marcador Digital. Alterna entre las pestañas "Marcaciones del Reloj", "Inasistencias y Permisos" y "Cortes y Horas Extra", o usa "Marcación Manual" / "Reporte Asistencia" cuando requieras justificar una marca o exportar la quincena.',
                image: 'rh-marcador.png',
                annotations: [
                    { n: 1, x: 49.3, y: 13.9, w: 40, h: 9.2, label: 'Herramientas superiores: Nuevo Empleado, Reporte Asistencia, Configurar Reloj y Marcación Manual.' },
                    { n: 2, x: 21.1, y: 26, w: 35.4, h: 3.4, label: 'Pestañas principales: Marcaciones del Reloj, Inasistencias y Permisos, Cortes y Horas Extra.' },
                    { n: 3, x: 30.6, y: 52.4, w: 30.3, h: 3, label: 'Atajos de período (Hoy, Quincena Actual, Quincena Anterior, Este Mes).' }
                ],
                tip: 'Usa "Cortes y Horas Extra" antes de calcular planilla para enviar automáticamente las horas extras o descuentos de ausencia a la quincena abierta.'
            }
        ],
        troubleshooting: [
            { issue: 'No encuentro a un empleado en Marcador Digital', fix: 'Confirma en "Configurar Reloj" o en su ficha de Empleados que tenga asignado su Código Biométrico / UID exacto.' },
            { issue: 'El PDF del contrato aparece con campos vacíos', fix: 'Edita primero al empleado en Recursos Humanos → Empleados y completa DUI, dirección y cargo antes de generar el contrato.' }
        ]
    },
    {
        slug: 'rrhh-planillas-prestaciones-reportes',
        order: 21,
        category: 'rrhh',
        categoryLabel: 'Recursos Humanos',
        requiredModule: 'human_resources',
        menuPath: 'Recursos Humanos → Planillas, Vacaciones y Reportes',
        title: 'Planillas Quincenales, Vacaciones y Reportes Legales (ISSS, AFP, Renta)',
        summary: 'Calcula planillas quincenales con deducciones de ISSS, AFP y Renta, liquida vacaciones de empleados elegibles y genera los reportes legales de ley.',
        outcome: 'Emitir nóminas quincenales exactas con boletas de pago, cerrar períodos y descargar anexos legales de ISSS, AFP e ISR.',
        duration: '5 min',
        modulePath: '/rh/planillas',
        roles: ['Contador', 'Admin'],
        requiredPermissions: ['manage_rh_planillas', 'manage_rh_planilla_vacaciones', 'view_rh_isss_report', 'view_rh_afp_report'],
        coverImage: 'rh-planillas.png',
        prerequisites: [
            'Tener configurados porcentajes de AFP, ISSS, tabla de Renta (ISR) y empleados activos con su salario mensual.'
        ],
        steps: [
            {
                title: 'Calcular, editar y cerrar una Planilla Quincenal',
                description: 'En Recursos Humanos → Planillas presiona "+ Nueva Planilla" (o entra al aviso amarillo "Ver Planilla Abierta" si ya existe una en curso). Ajusta horas extras, comisiones o descuentos programados, verifica las columnas ISSS, AFP y RENTA y cuando esté aprobada pulsa "Cerrar Período" para bloquearla e imprimir boletas y planilla PDF.',
                image: 'rh-planillas.png',
                annotations: [
                    { n: 1, x: 86.3, y: 13.2, w: 10.4, h: 4.3, label: 'Botón "+ Nueva Planilla" para abrir un nuevo período quincenal.' },
                    { n: 2, x: 78.8, y: 24, w: 17.9, h: 3.2, label: 'Banner de planilla abierta: acceso rápido a "Ver Planilla Abierta" y "Cerrar Período".' },
                    { n: 3, x: 84.4, y: 48.5, w: 9, h: 3.8, label: 'Acciones por período: Editar planilla, Eliminar, Cerrar/Pagar e Imprimir PDF Oficial.' }
                ],
                tip: 'El sistema impide crear una segunda planilla si hay otra pendiente de cierre; ciérrala o edítala antes de abrir la siguiente quincena.'
            },
            {
                title: 'Consultar elegibles y calcular Planilla de Vacaciones',
                description: 'Entra a Recursos Humanos → Planilla Vacaciones. Presiona primero "Consultar Elegibles" para ver quiénes cumplen año laboral en la fecha, luego pulsa "Nueva Planilla" para calcular automáticamente los 15 días + 30% de recargo legal y sus retenciones de ISSS/AFP/Renta.',
                image: 'rh-vacaciones.png',
                annotations: [
                    { n: 1, x: 74.8, y: 11.3, w: 12.2, h: 4.3, label: 'Botón "Consultar Elegibles" para identificar personal con vacaciones pendientes.' },
                    { n: 2, x: 87.6, y: 11.4, w: 10.3, h: 4.1, label: 'Botón "Nueva Planilla" para liquidar e imprimir el recibo de vacaciones.' },
                    { n: 3, x: 19.5, y: 19.5, w: 40, h: 4.1, label: 'Filtros por empleado, Año y Mes del historial de vacaciones pagadas.' }
                ],
                tip: 'También dispones de módulos separados en el menú para Aguinaldos, Quincena 25, Liquidaciones y Honorarios.'
            },
            {
                title: 'Generar Planilla ISSS, Planilla AFP, Renta y Constancias',
                description: 'En Recursos Humanos → Reportes selecciona "Planilla de ISSS", "Planilla de AFP", "Informe Mensual de Renta", "Constancia de Sueldo" o "Carta de Renta". Elige Año, Mes y Quincena (o "Todo el Mes (Consolidado)") y haz clic en "GENERAR REPORTE".',
                image: 'rh-reportes.png',
                annotations: [
                    { n: 1, x: 23.5, y: 31, w: 13, h: 22, label: 'Filtros laterales: Año, Mes y alcance (Todo el Mes o Primera/Segunda Quincena).' },
                    { n: 2, x: 23.9, y: 59.2, w: 12.2, h: 7.3, label: 'Botón "GENERAR REPORTE" para previsualizar en PDF y habilitar exportación a Excel.' }
                ],
                tip: 'El modo "Todo el Mes (Consolidado)" suma automáticamente la 1ª y 2ª quincena para presentar tus declaraciones mensuales ante ISSS, AFP y Hacienda.'
            }
        ],
        troubleshooting: [
            { issue: 'No puedo crear una nueva planilla quincenal', fix: 'Revisa si aparece el recuadro amarillo de "planilla abierta pendiente de pago"; entra a editarla o ciérrala con "Cerrar Período".' },
            { issue: 'Un empleado no sale en el cálculo de nueva planilla', fix: 'Verifica en Empleados que su estado sea Activo y que la sucursal o empresa coincida.' }
        ]
    },
    {
        slug: 'control-pozo-operacion-corte',
        order: 28,
        category: 'operaciones_admin',
        categoryLabel: 'Pozo, Seguridad y Soporte',
        requiredModule: 'pozo',
        menuPath: 'Control de Pozo → Despachos, Corte y Entregas de Efectivo',
        title: 'Control de Pozo: Despachos de Agua, Cortes y Entregas de Efectivo',
        summary: 'Registra cada pipa o servicio despachado en pozo con placa y cliente, ejecuta el corte operativo comparando ventas y gastos, y controla entregas de efectivo.',
        outcome: 'Tener trazabilidad total de despachos de pozo, gastos del día, cortes cerrados y efectivo entregado a gerencia o caja.',
        duration: '4 min',
        modulePath: '/pozo/despachos',
        roles: ['Supervisor', 'Gerencia', 'Admin'],
        requiredPermissions: ['manage_pozo_servicios', 'manage_pozo_despachos', 'manage_pozo_corte', 'manage_pozo_entregas_efectivo'],
        coverImage: 'pozo-despachos.png',
        prerequisites: [
            'Tener definidos los tipos de servicio y precios en Control de Pozo → Servicios.'
        ],
        steps: [
            {
                title: 'Definir Servicios y Tarifas en Control de Pozo → Servicios',
                description: 'Antes de registrar pipas, entra a Control de Pozo → Servicios y presiona "Nuevo Servicio" para dar de alta cada concepto (ej. Pipa 10m3, Llenado de Tanque) con su código, descripción y tarifa vigente.',
                image: 'pozo-servicios.png',
                annotations: [
                    { n: 1, x: 87.1, y: 12.6, w: 10.8, h: 3.6, label: 'Botón "Nuevo Servicio" para crear conceptos y tarifas de despacho en pozo.' },
                    { n: 2, x: 19.6, y: 24.3, w: 78.1, h: 25, label: 'Catálogo de servicios con Código, Descripción, Monto y botones de Editar/Eliminar.' }
                ],
                tip: 'Mantén los códigos cortos y claros para seleccionarlos rápidamente al registrar cada camión.'
            },
            {
                title: 'Registrar Despachos diarios de Pozo',
                description: 'En Control de Pozo → Despachos presiona "Nuevo Despacho". Indica la fecha, encargado del turno, cliente, número de placa del camión o pipa, selecciona los servicios prestados y guarda para generar el correlativo del despacho.',
                image: 'pozo-despachos.png',
                annotations: [
                    { n: 1, x: 86.3, y: 12.6, w: 11.5, h: 3.6, label: 'Botón "Nuevo Despacho" para registrar cada servicio realizado en pozo.' },
                    { n: 2, x: 19.5, y: 19.3, w: 25.9, h: 3.4, label: 'Buscador por número de despacho, cliente, placa o encargado.' },
                    { n: 3, x: 88, y: 28, w: 5.5, h: 4, label: 'Acciones por fila: Ver detalle completo, Editar o Eliminar (si no está en corte cerrado).' }
                ],
                tip: 'Anota siempre la placa exacta en cada despacho para facilitar consultas históricas por cliente transportista.'
            },
            {
                title: 'Ejecutar y cerrar el Corte de Pozo',
                description: 'Entra a Control de Pozo → Corte y pulsa "Nuevo Corte". Selecciona la fecha y encargado para consolidar los despachos realizados, añade gastos operativos del pozo si hubo, valida el total neto de ventas menos gastos y guarda/cierra el corte.',
                image: 'pozo-corte.png',
                annotations: [
                    { n: 1, x: 88.2, y: 12.6, w: 9.7, h: 3.6, label: 'Botón "Nuevo Corte" para consolidar ventas y gastos de pozo de una jornada.' },
                    { n: 2, x: 19.6, y: 24.3, w: 78.1, h: 20, label: 'Historial de cortes mostrando Encargado, Estado, Total Ventas, Gastos y Total Neto.' },
                    { n: 3, x: 87.8, y: 28, w: 5.5, h: 4, label: 'Acciones: Ver detalle del corte o Reabrir corte (si tienes permiso de supervisión).' }
                ],
                tip: 'Los cortes cerrados protegen los despachos contra borrados accidentales; solo un usuario con permiso "Cerrar/Reabrir Cortes de Pozo" puede reabrirlos.'
            },
            {
                title: 'Registrar Entregas de Efectivo del Pozo',
                description: 'Abre Control de Pozo → Entregas de Efectivo y presiona "Nueva Entrega" para dejar constancia de quién entrega el dinero recaudado, quién recibe (caja o gerencia), la fecha y el monto exacto entregado.',
                image: 'pozo-entregas.png',
                annotations: [
                    { n: 1, x: 87.3, y: 12.6, w: 10.6, h: 3.6, label: 'Botón "Nueva Entrega" para documentar traslados de efectivo de pozo.' },
                    { n: 2, x: 19.6, y: 24.3, w: 78.1, h: 11, label: 'Registro histórico con Persona Entrega, Persona Recibe, Fecha, Monto y acciones.' }
                ],
                tip: 'Usa el buscador superior para verificar entregas pendientes o cruzar el efectivo recibido contra el último corte cerrado.'
            }
        ],
        troubleshooting: [
            { issue: 'No puedo editar o borrar un despacho de pozo', fix: 'El despacho ya pertenece a un corte cerrado; solicita a Gerencia o Supervisor reabrir temporalmente el corte correspondiente.' },
            { issue: 'No aparece ningún servicio al crear un despacho', fix: 'Registra primero los servicios y tarifas vigentes en Control de Pozo → Servicios.' }
        ]
    },
    {
        slug: 'seguridad-usuarios-roles-accesos',
        order: 29,
        category: 'operaciones_admin',
        categoryLabel: 'Pozo, Seguridad y Soporte',
        requiredModule: null,
        menuPath: 'Seguridad → Usuarios, Accesos de Usuario y Roles',
        title: 'Seguridad: Usuarios, Accesos Multiempresa y Matriz de Roles',
        summary: 'Crea cuentas de usuario, configura exactamente qué módulos y reportes puede ver cada rol y autoriza a qué empresas y sucursales ingresa cada colaborador.',
        outcome: 'Garantizar que cada colaborador entre únicamente a las empresas, sucursales y pantallas autorizadas para su puesto.',
        duration: '5 min',
        modulePath: '/users',
        roles: ['Admin'],
        requiredPermissions: ['manage_users', 'manage_user_access', 'manage_roles'],
        coverImage: 'admin-users.png',
        prerequisites: [
            'Tener creadas las Empresas y Sucursales en Sistema → Empresas / Sucursales.'
        ],
        steps: [
            {
                title: 'Crear integrantes del equipo en Gestión de Usuarios',
                description: 'En Seguridad → Usuarios presiona "Nuevo Integrante". Ingresa Nombre completo, Usuario (login), Correo electrónico, Contraseña temporal, el Rol inicial y las sucursales asignadas. También puedes editar o desactivar cuentas existentes desde la columna Acciones.',
                image: 'admin-users.png',
                annotations: [
                    { n: 1, x: 83.3, y: 12, w: 13.6, h: 4.5, label: 'Botón "Nuevo Integrante" para crear una cuenta nueva en la plataforma.' },
                    { n: 2, x: 19.5, y: 19.5, w: 25.9, h: 3.9, label: 'Buscador por nombre completo, nombre de usuario o correo.' },
                    { n: 3, x: 79.5, y: 30, w: 14, h: 6, label: 'Estado (ACTIVO/INACTIVO) y acciones de Editar o Eliminar usuario.' }
                ],
                tip: 'Los usuarios en SIPE-WEB son globales: una misma persona puede entrar a varias empresas según sus asignaciones en Accesos de Usuario.'
            },
            {
                title: 'Asignar Empresas, Sucursales y Rol en Accesos de Usuario',
                description: 'Abre Seguridad → Accesos de Usuario. Pulsa "Asignar Acceso" para habilitarle una empresa, un rol específico y sus sucursales permitidas a un usuario; o usa "Clonar Accesos" para copiar rápidamente la misma configuración multiempresa de un compañero con puesto similar.',
                image: 'admin-user-access.png',
                annotations: [
                    { n: 1, x: 74.4, y: 11.9, w: 22.4, h: 4.8, label: 'Botones "Clonar Accesos" (copiar matriz de otro usuario) y "Asignar Acceso".' },
                    { n: 2, x: 24.3, y: 24.3, w: 70, h: 2.5, label: 'Filtros globales por usuario, empresa asignada o rol para auditar accesos.' },
                    { n: 3, x: 91.5, y: 38.6, w: 4.5, h: 3.2, label: 'Editar las sucursales/rol de esa empresa o revocar el acceso en el basurero.' }
                ],
                tip: 'Un mismo usuario puede tener rol "Contador" en una empresa y "Supervisor" en otra según su asignación individual.'
            },
            {
                title: 'Personalizar permisos y ocultación de montos en Roles',
                description: 'En Seguridad → Roles elige un rol de la lista izquierda (o crea uno nuevo), define su Dashboard predeterminado y marca o desmarca por módulo las opciones normales, reportes y permisos especiales (por ejemplo "Ver Montos en el Sistema" si deseas ocultar dinero a bodegueros). Al final pulsa "Guardar".',
                image: 'admin-roles.png',
                annotations: [
                    { n: 1, x: 76.9, y: 14.7, w: 17.7, h: 4.1, label: 'Botones "Cancelar" y "Guardar" tras ajustar los permisos del rol seleccionado.' },
                    { n: 2, x: 45.5, y: 28.9, w: 48.3, h: 5.3, label: 'Nombre del rol, descripción del alcance y Dashboard inicial por defecto.' },
                    { n: 3, x: 62, y: 40, w: 31.8, h: 16, label: 'Controles rápidos: "Marcar / Desmarcar Todos" y "TODO EL GRUPO" por módulo.' }
                ],
                tip: 'Si agregas permisos a un rol, pide al usuario conectado recargar su sesión o volver a iniciar sesión para ver los nuevos menús.'
            }
        ],
        troubleshooting: [
            { issue: 'Un usuario nuevo inicia sesión pero no ve la empresa en el selector superior', fix: 'Ve a Seguridad → Accesos de Usuario y confirma que tenga asignación activa en esa empresa y al menos una sucursal marcada.' },
            { issue: 'Un usuario ve asteriscos o signos en lugar de precios y montos', fix: 'Revisa el rol asignado en Seguridad → Roles y habilita el permiso especial "Ver Montos en el Sistema".' }
        ]
    },
    {
        slug: 'crear-ticket-soporte',
        order: 30,
        category: 'operaciones_admin',
        categoryLabel: 'Pozo, Seguridad y Soporte',
        requiredModule: null,
        menuPath: 'Barra Superior (ícono Ticket) / Ctrl+Shift+K / Seguridad → Soporte y Tickets',
        title: 'Cómo Crear un Ticket de Soporte con Captura de Pantalla',
        summary: 'Reporta cualquier error, duda o mejora en segundos enviando captura automática de pantalla, trazos/flechas explicativas y diagnóstico técnico directo a Telegram.',
        outcome: 'Enviar tickets claros y completos para que soporte técnico vea exactamente qué ocurrió en tu pantalla y resuelva tu caso más rápido.',
        duration: '4 min',
        modulePath: '/soporte/tickets',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Auxiliar', 'Asistente', 'Auditor', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: [],
        coverImage: 'quick-ticket-modal.png',
        prerequisites: [
            'Estar en la pantalla donde ocurrió el problema o donde necesitas ayuda (el sistema detectará automáticamente el módulo).'
        ],
        steps: [
            {
                title: 'Abrir un ticket rápido desde cualquier pantalla (3 formas)',
                description: 'Sin salir de donde estás trabajando puedes abrir un ticket de 3 maneras: 1) Presiona las teclas Ctrl + Shift + K; 2) Haz clic en el ícono de Ticket en la barra superior derecha (junto a la campana); o 3) Pulsa Ctrl + K, escribe "ticket: descripción corta" y presiona Enter.',
                image: 'command-palette-ticket.png',
                annotations: [
                    { n: 1, x: 29.8, y: 12.8, w: 40.4, h: 6.2, label: 'Escribe "ticket:" seguido de tu problema (ej. ticket: error al imprimir factura).' },
                    { n: 2, x: 29.8, y: 20.2, w: 40.4, h: 7.5, label: 'Presiona Enter (o clic) para tomar foto automática de la pantalla y abrir el ticket.' }
                ],
                tip: 'Si abres el ticket justo sobre la pantalla donde salió el error, la captura automática saldrá con ese momento exacto ya adjunto.'
            },
            {
                title: 'Completar Tipo, Prioridad, Asunto y señalar la foto con "Dibujar / Señalar"',
                description: 'En la ventana "Centro Inteligente de Tickets" elige el Tipo (Problema / Error, Requerimiento, Mejora o Consulta), la Prioridad y escribe un Asunto claro. En la sección de capturas puedes usar "Dibujar / Señalar" para encerrar en rojo o señalar con flechas el dato con falla, pegar otra imagen con Ctrl + V o subirla desde tu PC. Al terminar pulsa "Crear Ticket y Avisar a Técnicos".',
                image: 'quick-ticket-modal.png',
                annotations: [
                    { n: 1, x: 25, y: 13.8, w: 50, h: 13.2, label: 'Tipo de ticket (Problema, Requerimiento, Mejora, Consulta), Prioridad y Módulo detectado.' },
                    { n: 2, x: 25, y: 27.5, w: 50, h: 19.5, label: 'Asunto breve obligatorio y Explicación de lo que intentabas hacer.' },
                    { n: 3, x: 25, y: 47.8, w: 50, h: 31.8, label: 'Capturas adjuntas (hasta 4): usa "Capturar Pantalla", "Subir Imagen" o "Dibujar / Señalar".' },
                    { n: 4, x: 25, y: 80.5, w: 50, h: 16, label: 'Diagnóstico automático de consola/red (Adjuntar log) y botón "Crear Ticket y Avisar a Técnicos".' }
                ],
                tip: 'Deja marcada la casilla "Adjuntar log": eso envía al equipo técnico los últimos errores de red o navegador sin que tengas que copiar códigos.'
            },
            {
                title: 'Consultar el estado y respuesta de tus tickets en Soporte y Tickets',
                description: 'Para ver el avance de tus reportes entra a Seguridad → Soporte y Tickets. Arriba verás los contadores (Abiertos, En Proceso, Resueltos), puedes filtrar presionando "Mis Tickets" o buscar por código (#TKT-0038), y hacer clic en "Detalle" o sobre la fila para leer respuestas y cerrar el caso.',
                image: 'support-tickets.png',
                annotations: [
                    { n: 1, x: 64.7, y: 19, w: 13.6, h: 4.1, label: 'Botón "Nuevo Ticket con Captura" para levantar un reporte desde esta página.' },
                    { n: 2, x: 19.5, y: 27.7, w: 77.3, h: 9, label: 'Tarjetas resumen clicables: Total Tickets, Abiertos, En Proceso, Resueltos y Urgentes.' },
                    { n: 3, x: 19.6, y: 40.7, w: 76.2, h: 13, label: 'Filtro "Mis Tickets", buscador por código (#TKT-) o asunto, y selectores de estado/prioridad.' }
                ],
                tip: 'Cuando un técnico resuelve o responde tu ticket, recibirás una notificación en la campana superior del sistema.'
            }
        ],
        troubleshooting: [
            { issue: 'La captura automática salió en blanco o no tomó un menú desplegable', fix: 'Toma un recorte con Windows (Win + Shift + S), haz clic dentro de la ventana del ticket y presiona Ctrl + V para pegarlo directo, o usa "Subir Imagen".' },
            { issue: 'Quiero señalar un número o botón específico dentro de la captura', fix: 'Haz clic en el botón morado "Dibujar / Señalar" encima de la miniatura para trazar círculos, flechas y notas de texto antes de enviar.' },
            { issue: 'No sé qué prioridad colocar a mi ticket', fix: 'Usa "Urgente" únicamente si te impide facturar o trabajar hoy; "Media" o "Alta" para errores puntuales con alternativa; "Baja" para mejoras o dudas.' }
        ]
    },
    {
        slug: 'usar-ctrl-k-buscador-calculadora',
        order: 31,
        category: 'operaciones_admin',
        categoryLabel: 'Pozo, Seguridad y Soporte',
        requiredModule: null,
        menuPath: 'Teclado: Ctrl + K (o Lupa superior izquierda)',
        title: 'Cómo Usar Ctrl + K (Buscador Rápido, Calculadora IVA y Atajos)',
        summary: 'Domina el buscador rápido Ctrl + K para abrir cualquier pantalla al instante sin navegar por carpetas, calcular montos con desglose automático de IVA 13% y crear tickets al vuelo.',
        outcome: 'Moverte por todo SIPE-WEB en dos segundos usando el teclado y obtener cálculos de IVA listos para copiar con un clic.',
        duration: '3 min',
        modulePath: '/seguridad/atajos',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Auxiliar', 'Asistente', 'Auditor', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: [],
        coverImage: 'command-palette-search.png',
        prerequisites: [
            'Funciona desde cualquier pantalla del sistema (solo asegúrate de no estar dentro de un visor PDF externo).'
        ],
        steps: [
            {
                title: 'Abrir Ctrl + K y saltar directo a cualquier pantalla',
                description: 'Presiona las teclas Ctrl + K al mismo tiempo (o haz clic en el ícono de Lupa arriba a la izquierda junto al logo SIPE-WEB). Escribe el nombre de cualquier pantalla (ej. "ventas", "corte", "kardex", "compras"), muévete con las flechas ↑ ↓ y presiona Enter para entrar de inmediato sin buscar en el menú lateral.',
                image: 'command-palette-search.png',
                annotations: [
                    { n: 1, x: 29.8, y: 12.8, w: 40.4, h: 6.2, label: 'Barra de búsqueda rápida: escribe cualquier palabra del menú o pulsa ESC para cerrar.' },
                    { n: 2, x: 29.8, y: 20.5, w: 40.4, h: 39.2, label: 'Resultados agrupados por módulo (solo muestra pantallas permitidas para tu rol y empresa).' },
                    { n: 3, x: 29.8, y: 60.2, w: 40.4, h: 4.3, label: 'Guía rápida de teclado: ↑ ↓ para moverte, Enter para abrir y Esc para salir.' }
                ],
                tip: 'También puedes escribir "tutoriales" dentro de Ctrl + K para regresar en un instante a este Centro de Tutoriales desde cualquier parte.'
            },
            {
                title: 'Usar la Calculadora Instantánea con desglose de IVA 13%',
                description: 'Sin abrir la calculadora de Windows, presiona Ctrl + K y escribe directamente cualquier operación matemática (por ejemplo "125*4", "500/1.13" o "150+45.50"). Aparecerá el resultado grande arriba junto con 4 tarjetas interactivas: "+ IVA 13%", "IVA (13%)", "Neto (sin IVA)" e "IVA Desglosado". Haz clic en cualquiera para copiar ese monto al portapapeles.',
                image: 'command-palette-calc.png',
                annotations: [
                    { n: 1, x: 29.8, y: 12.8, w: 40.4, h: 6.2, label: 'Digita tu operación directa (+, -, *, / o paréntesis), por ejemplo "125*4".' },
                    { n: 2, x: 30.2, y: 20.5, w: 39.6, h: 11.5, label: 'Resultado exacto instantáneo y botón "Copiar" (también puedes pulsar Enter).' },
                    { n: 3, x: 31, y: 33, w: 38, h: 7.5, label: 'Tarjetas copiables en 1 clic: + IVA 13%, IVA (13%), Neto (sin IVA) e IVA Desglosado.' }
                ],
                tip: 'El recuadro "Neto (sin IVA)" es ideal cuando el cliente te da un precio total con IVA incluido y necesitas digitar el precio neto en una compra o cotización.'
            },
            {
                title: 'Lanzar un Ticket rápido desde Ctrl + K y ver todos los atajos',
                description: 'Si dentro de Ctrl + K escribes la palabra "ticket" (o "ticket: mi asunto"), la primera opción se convierte en "Crear Ticket de Soporte (Capturar Pantalla)" y al dar Enter toma la foto de fondo automáticamente. Además, puedes consultar todos los atajos del sistema (F3, F4, F10, Ctrl+Shift+K) en Seguridad → Atajos y Trucos.',
                image: 'keyboard-shortcuts.png',
                annotations: [
                    { n: 1, x: 20.6, y: 37.8, w: 75.4, h: 4.8, label: 'Buscador por tecla (F3, Ctrl, Enter) y pestañas por módulo en Seguridad → Atajos y Trucos.' },
                    { n: 2, x: 20.9, y: 58, w: 74.6, h: 12, label: 'Tarjetas explicativas de atajos rápidos y funciones prácticas de cada pantalla.' }
                ],
                tip: 'En el Punto de Venta (POS): F4 busca cliente, F3 busca producto, F10 abre el cobro (Pagar) y Ctrl+K abre el buscador global.'
            }
        ],
        troubleshooting: [
            { issue: 'Presiono Ctrl + K y se abre la barra de direcciones del navegador en vez del buscador del sistema', fix: 'Eso pasa si el cursor estaba fuera de la página (por ejemplo dentro de un visor PDF). Haz clic en cualquier espacio en blanco del sistema y vuelve a pulsar Ctrl + K, o usa el botón de Lupa arriba a la izquierda.' },
            { issue: 'Busco una pantalla en Ctrl + K y dice "Sin resultados"', fix: 'El buscador solo muestra pantallas activas para la empresa seleccionada arriba y permitidas para tu rol actual; revisa el selector de Empresa en la barra superior o escribe "ticket" si necesitas acceso.' }
        ]
    },
    {
        slug: 'dashboard-paneles-energia',
        order: 32,
        category: 'operaciones_admin',
        categoryLabel: 'Pozo, Seguridad y Soporte',
        requiredModule: null,
        menuPath: 'Dashboard → General, Pista, Tienda, Andelsa, DTE y Sistema Energético',
        title: 'Dashboards Ejecutivos, Estadísticas DTE y Sistema Energético Solar',
        summary: 'Consulta en tiempo real los indicadores de ventas, desempeño de pista o tienda, cumplimiento de DTE ante Hacienda y monitoreo de generación solar y baterías (SFV).',
        outcome: 'Tomar decisiones diarias observando ventas del día, estado de envíos DTE y ahorro energético fotovoltaico desde un único tablero.',
        duration: '5 min',
        modulePath: '/dashboard',
        roles: ['Vendedor', 'Jefe Tienda', 'Jefe Pista', 'Supervisor', 'Gerencia', 'Contador', 'Auxiliar', 'Asistente', 'Auditor', 'Operaciones', 'Bodega', 'Produccion', 'Calidad', 'Admin'],
        requiredPermissions: ['view_dashboard', 'view_dashboard_general', 'view_dashboard_pista', 'view_dashboard_tienda', 'view_dashboard_andelsa', 'view_dashboard_server', 'view_dashboard_energy', 'manage_energy_system'],
        coverImage: 'dashboard-main.png',
        prerequisites: [
            'Tener seleccionada arriba la Empresa y Sucursal cuyos indicadores deseas analizar.'
        ],
        steps: [
            {
                title: 'Navegar entre los Tableros Operativos (General, Pista, Tienda, Andelsa y DTE)',
                description: 'Al ingresar a Dashboard verás en la parte superior las pestañas habilitadas para tu rol y empresa (General, Pista, Tienda, Andelsa, Servidor, Sistema Energético y Estadísticas DTE). Cada tablero muestra tarjetas resumen de ventas, comparativos y gráficas actualizadas con el botón "Actualizar".',
                image: 'dashboard-main.png',
                annotations: [
                    { n: 1, x: 20.1, y: 12.1, w: 59.1, h: 4.2, label: 'Pestañas de tableros: General, Pista, Tienda, Andelsa, Servidor, Energía y DTE.' },
                    { n: 2, x: 19.5, y: 21.5, w: 77, h: 32.5, label: 'Botón "Actualizar" y tarjetas KPI (Ventas del Día, Efectivo, Ventas del Mes, Inventario y Clientes).' },
                    { n: 3, x: 19.5, y: 58, w: 77, h: 24, label: 'Panel en tiempo real "Cajas en Línea" con turnos abiertos y efectivo arqueado por sucursal.' }
                ],
                tip: 'En Seguridad → Roles puedes definir qué pestaña del Dashboard abre por defecto cada puesto al iniciar sesión.'
            },
            {
                title: 'Monitorear Generación Solar y Baterías en Sistema Energético',
                description: 'En la pestaña "Sistema Energético" elige la planta solar arriba a la derecha (ej. Andelsa Solar + Baterías o Puma San Martín II), activa el refresco "En Vivo (30s)" o pulsa "Sincronizar Ahora" y cambia entre las sub-pestañas "Monitoreo en Vivo", "Análisis Temporal", "Reporte SFV" e "Historial de Lecturas".',
                image: 'dashboard-energy.png',
                annotations: [
                    { n: 1, x: 20.1, y: 12.1, w: 59.1, h: 4.2, label: 'Selector principal de Dashboard para entrar a "Sistema Energético".' },
                    { n: 2, x: 73.3, y: 23.3, w: 22.1, h: 4.3, label: 'Controles de actualización "En Vivo (30s)", "Sincronizar Ahora" y Configuración solar.' },
                    { n: 3, x: 66.9, y: 35.2, w: 28.9, h: 4.3, label: 'Selector de sitio fotovoltaico (planta solar y baterías).' },
                    { n: 4, x: 19.5, y: 44, w: 56.4, h: 3.6, label: 'Vistas del Sistema Fotovoltaico (SFV): Monitoreo en Vivo, Análisis Temporal, Reporte SFV e Historial.' }
                ],
                tip: 'Desde "Reporte SFV" puedes revisar el ahorro acumulado en kWh y el respaldo de baterías por rango de fechas.'
            }
        ],
        troubleshooting: [
            { issue: 'Solo veo "Estadísticas DTE" y no el Dashboard General o de Pista', fix: 'Tu rol solo tiene activada la vista DTE; solicita al Administrador asignar el permiso correspondiente en Seguridad → Roles.' },
            { issue: 'Las lecturas de energía solar muestran minutos sin actualizar', fix: 'Presiona el botón "Sincronizar Ahora" arriba a la derecha para forzar la lectura más reciente del inversor.' }
        ]
    },
    {
        slug: 'sistema-empresas-cajas-vendedores',
        order: 33,
        category: 'operaciones_admin',
        categoryLabel: 'Pozo, Seguridad y Soporte',
        requiredModule: null,
        menuPath: 'Sistema → Empresas, Sucursales, Puntos de Venta (POS) y Vendedores',
        title: 'Sistema: Empresas, Sucursales, Puntos de Venta (POS) y Vendedores',
        summary: 'Configura la estructura multiempresa base del sistema: razones sociales y DTE, sucursales/establecimientos, terminales POS con impresoras y vendedores con PIN.',
        outcome: 'Dejar operativas nuevas empresas, sucursales, cajas registradoras y vendedores listos para facturar en POS y emitir DTE.',
        duration: '6 min',
        modulePath: '/companies',
        roles: ['Supervisor', 'Gerencia', 'Operaciones', 'Admin'],
        requiredPermissions: ['manage_companies', 'manage_branches', 'manage_pos', 'manage_sellers'],
        coverImage: 'sys-companies.png',
        prerequisites: [
            'Contar con NIT, NRC, razón social, actividad económica y certificado DTE vigente cuando des de alta una empresa.'
        ],
        steps: [
            {
                title: 'Crear o editar Empresas y ejecutar Pruebas DTE en Sistema → Empresas',
                description: 'En Sistema → Empresas administra cada razón social. Desde "Nueva Empresa" ingresas datos fiscales, ambiente Hacienda y certificado; en cada fila cuentas con botones para Pruebas de Acreditación Hacienda (DTE) y para abrir "Configurar módulos" de esa empresa.',
                image: 'sys-companies.png',
                annotations: [
                    { n: 1, x: 73.7, y: 12.2, w: 23.1, h: 4.3, label: 'Botón "Módulos por Empresa" y "Nueva Empresa" para dar de alta una razón social.' },
                    { n: 2, x: 85.1, y: 27.8, w: 11, h: 16, label: 'Acciones por empresa: Pruebas de Acreditación Hacienda (DTE), Configurar módulos, Editar y Eliminar.' }
                ],
                tip: 'Usa el botón de Pruebas de Acreditación Hacienda cuando incorpores una empresa nueva antes de pasarla a producción DTE.'
            },
            {
                title: 'Registrar Sucursales / Establecimientos con código Hacienda',
                description: 'Abre Sistema → Sucursales y pulsa "Nuevo Establecimiento" para crear agencias, gasolineras o plantas. Define código de establecimiento y punto de venta MH, dirección, teléfono y estado.',
                image: 'sys-branches.png',
                annotations: [
                    { n: 1, x: 81.6, y: 11.8, w: 16.3, h: 5, label: 'Botón "Nuevo Establecimiento" para agregar una sucursal a la empresa actual.' },
                    { n: 2, x: 19.6, y: 20.7, w: 78.1, h: 55.6, label: 'Lista de sucursales con código de establecimiento, dirección y acciones de edición.' }
                ],
                tip: 'El código de establecimiento y código POS de 4 caracteres definidos aquí son los que viajan en el número de control de cada DTE.'
            },
            {
                title: 'Configurar Puntos de Venta (POS) y reglas por terminal',
                description: 'Entra a Sistema → Puntos de Venta (POS) y presiona "Nuevo POS". Asocia la caja a una Sucursal, configura si permite descuentos en caja, su impresora térmica asignada y los correlativos internos.',
                image: 'sys-pos.png',
                annotations: [
                    { n: 1, x: 86, y: 11.6, w: 10.9, h: 5, label: 'Botón "Nuevo POS" para dar de alta una caja o terminal de facturación.' },
                    { n: 2, x: 19.5, y: 20.1, w: 77.2, h: 40, label: 'Tabla de terminales con Sucursal, Código, Terminal, permiso de Descuentos, Impresora y Estado.' }
                ],
                tip: 'Si una caja de pista o tienda no debe otorgar rebajas manuales, mantén desactivada la opción de Descuentos en esa terminal POS.'
            },
            {
                title: 'Dar de alta Vendedores con PIN personal de turno',
                description: 'En Sistema → Vendedores presiona "Nuevo Vendedor", asigna su nombre, sucursal y un PIN numérico confidencial. Con ese PIN el cajero podrá abrir y validar su turno en el Punto de Venta.',
                image: 'sys-sellers.png',
                annotations: [
                    { n: 1, x: 85.3, y: 11.6, w: 11.5, h: 3.6, label: 'Botón "Nuevo Vendedor" para registrar cajeros o vendedores autorizados.' },
                    { n: 2, x: 19.5, y: 17.3, w: 25.9, h: 3.4, label: 'Buscador rápido de vendedores por nombre.' },
                    { n: 3, x: 19.5, y: 22.2, w: 77.2, h: 30, label: 'Listado con Nombre, PIN oculto, Sucursal asignada, Estado y Editar/Eliminar.' }
                ],
                tip: 'Cada colaborador debe tener su propio PIN individual para distinguir quién realizó cada venta o cierre de turno.'
            }
        ],
        troubleshooting: [
            { issue: 'El vendedor no puede abrir turno porque no aparece su caja o PIN', fix: 'Confirma que tanto el POS en Sistema → Puntos de Venta como el Vendedor estén Activos y pertenezcan a la misma Sucursal.' },
            { issue: 'Un DTE falla por código de establecimiento o punto de venta inválido', fix: 'Revisa en Sistema → Sucursales que los códigos MH asignados coincidan con los registrados en Hacienda.' }
        ]
    },
    {
        slug: 'rrhh-prestaciones-aguinaldo-liquidaciones',
        order: 36,
        category: 'rrhh',
        categoryLabel: 'Recursos Humanos',
        requiredModule: 'human_resources',
        menuPath: 'Recursos Humanos → Aguinaldos, Quincena 25, Liquidaciones y Honorarios',
        title: 'RRHH: Aguinaldos, Quincena 25, Liquidaciones y Honorarios (ISR 10%)',
        summary: 'Calcula e imprime planillas legales de Aguinaldo anual, Quincena 25 (Ley Especial El Salvador), liquidaciones/finiquitos de personal y recibos de Honorarios con retención 10% ISR.',
        outcome: 'Emitir planillas de prestaciones laborales, constancias y recibos de servicios profesionales cumpliendo la legislación laboral y tributaria salvadoreña.',
        duration: '6 min',
        modulePath: '/rh/aguinaldos',
        roles: ['Contador', 'Auxiliar', 'Gerencia', 'Supervisor', 'Admin'],
        requiredPermissions: ['manage_hr_aguinaldo', 'manage_hr_quincena25', 'manage_hr_liquidaciones', 'manage_hr_honorarios'],
        coverImage: 'rh-aguinaldos.png',
        prerequisites: [
            'Tener actualizada la ficha de cada colaborador (salario base, fecha de ingreso y DUI) en Recursos Humanos → Empleados.'
        ],
        steps: [
            {
                title: 'Generar Planilla de Aguinaldos según antigüedad',
                description: 'Abre Recursos Humanos → Aguinaldos y presiona "Nueva Planilla". El sistema calcula automáticamente los días de aguinaldo según años laborados (15, 19 o 21 días) o proporcionales, aplicando las exenciones legales de Renta (ISR) vigentes.',
                image: 'rh-aguinaldos.png',
                annotations: [
                    { n: 1, x: 87.4, y: 11.6, w: 10.4, h: 3.6, label: 'Botón "Nueva Planilla" para calcular la planilla anual de aguinaldos.' },
                    { n: 2, x: 19.5, y: 19.5, w: 78.2, h: 17, label: 'Filtro por año y tabla con Periodo, Departamento, Empleados y Monto Total calculado.' }
                ],
                tip: 'Verifica previamente las fechas de ingreso en Empleados para asegurar que los cálculos proporcionales salgan exactos.'
            },
            {
                title: 'Calcular y consultar Quincena 25 (Ley Especial)',
                description: 'En Recursos Humanos → Quincena 25 alterna arriba a la derecha entre "Gestión Actual" e "Historial Anual", filtra por departamento o rango y pulsa "Calcular Quincena 25" para proyectar el 50% salarial adicional conforme a la ley.',
                image: 'rh-quincena25.png',
                annotations: [
                    { n: 1, x: 81.1, y: 14.4, w: 15, h: 3.2, label: 'Alternador entre "Gestión Actual" para generar pagos e "Historial Anual".' },
                    { n: 2, x: 20.6, y: 27, w: 76.1, h: 4.1, label: 'Barra de filtros y botón "Calcular Quincena 25".' },
                    { n: 3, x: 19.5, y: 41.1, w: 78.2, h: 37, label: 'Tarjetas resumen de montos y detalle de colaboradores incluidos.' }
                ],
                tip: 'Desde "Historial Anual" puedes reimprimir cualquier boleta o resumen de Quincena 25 pagada anteriormente.'
            },
            {
                title: 'Emitir Liquidaciones y Finiquitos Laborales en PDF',
                description: 'Ve a Recursos Humanos → Liquidaciones y pulsa "Nueva Liquidacion". Elige al colaborador, motivo de retiro (renuncia voluntaria, despido o mutuo acuerdo) y fecha final; luego en cada registro puedes descargar tanto el PDF de cálculo como el Finiquito legal.',
                image: 'rh-liquidaciones.png',
                annotations: [
                    { n: 1, x: 85.5, y: 11.6, w: 12.3, h: 3.6, label: 'Botón "Nueva Liquidacion" para calcular indemnización, vacación y aguinaldo proporcional.' },
                    { n: 2, x: 19.5, y: 19.5, w: 40, h: 4.1, label: 'Buscador por empleado y filtros de Año / Mes.' },
                    { n: 3, x: 91, y: 28, w: 5, h: 10, label: 'Iconos por fila para "Descargar PDF" del detalle y "Descargar Finiquito" listo para firma.' }
                ],
                tip: 'Al guardar una liquidación definitiva recuerda actualizar el estado del colaborador en Empleados si ya causó baja.'
            },
            {
                title: 'Registrar Recibos de Honorarios con Retención 10% de Renta (ISR)',
                description: 'En Recursos Humanos → Honorarios presiona "Nuevo Honorario" para documentar servicios eventuales o profesionales. Al digitar el monto bruto el sistema calcula automáticamente la retención del 10% de Impuesto Sobre la Renta (ISR) y el líquido a pagar.',
                image: 'rh-honorarios.png',
                annotations: [
                    { n: 1, x: 86, y: 11.6, w: 11.8, h: 3.6, label: 'Botón "Nuevo Honorario" para registrar un servicio eventual o profesional.' },
                    { n: 2, x: 19.5, y: 17.3, w: 78.2, h: 17, label: 'Tabla histórica con Número, Fecha, Nombre, DUI/NIT, Concepto, Monto, ISR (10%) y Líquido.' }
                ],
                tip: 'Los datos de DUI/NIT y montos aquí registrados facilitan cuadrar tu F-14 anual y las retenciones mensuales ante Hacienda.'
            }
        ],
        troubleshooting: [
            { issue: 'El aguinaldo o liquidación calcula un salario incorrecto para un empleado', fix: 'Edita primero su salario mensual vigente y fecha de ingreso en Recursos Humanos → Empleados antes de generar la planilla.' },
            { issue: 'El sistema aplica 10% de ISR aunque esperaba otro descuento', fix: 'En Recursos Humanos → Honorarios aplica por ley la retención fija del 10% de Renta sobre servicios sin dependencia laboral.' }
        ]
    },
    {
        slug: 'admin-configuracion-servidor-ia',
        order: 37,
        category: 'operaciones_admin',
        categoryLabel: 'Pozo, Seguridad y Soporte',
        requiredModule: null,
        menuPath: 'Seguridad / Configuración / IA → Bitácora, Sistema, Módulos, Servidor y Tareas IA',
        title: 'Administración Avanzada: Bitácora, Configuración, Módulos, Servidor e IA',
        summary: 'Audita acciones de usuarios en la Bitácora, ajusta parámetros fiscales del sistema, activa módulos por empresa, supervisa el servidor y gestiona Tareas Agénticas de IA.',
        outcome: 'Mantener auditada y optimizada toda la plataforma, controlando módulos habilitados por empresa y monitoreando procesos e IA.',
        duration: '6 min',
        modulePath: '/configuracion/sistema',
        roles: ['Gerencia', 'Auditor', 'Admin'],
        requiredPermissions: ['view_audit_logs', 'manage_settings', 'manage_company_modules', 'view_server_metrics', 'manage_ai_tasks'],
        coverImage: 'cfg-modulos-empresa.png',
        prerequisites: [
            'Acceso reservado para Gerencia, Auditoría o Administradores autorizados según permiso de rol.'
        ],
        steps: [
            {
                title: 'Auditar quién hizo cada movimiento en Seguridad → Bitácora',
                description: 'En Seguridad → Bitácora del Sistema revisa el rastro completo de operaciones (ventas, anulaciones, ediciones de precios o clientes, logins). Filtra arriba por usuario, acción o entidad para ver Fecha/Hora, Descripción exacta, duración y dirección IP.',
                image: 'sec-bitacora.png',
                annotations: [
                    { n: 1, x: 21.1, y: 22.8, w: 74, h: 4.8, label: 'Buscador libre y filtros combinados por Entidad y Acción realizada.' },
                    { n: 2, x: 21.2, y: 29.5, w: 73.9, h: 60, label: 'Tabla de auditoría con Fecha/Hora, Usuario, Acción, Entidad, Descripción, Duración e IP.' }
                ],
                tip: 'Cuando necesites saber quién cambió un precio, un cliente exento o un permiso, la Bitácora guarda el registro exacto con usuario y hora.'
            },
            {
                title: 'Ajustar Parámetros Generales e Impuestos en Configuración del Sistema',
                description: 'Abre Configuración → Configuración del Sistema. Usa la pestaña "Personalización" para datos de apariencia y moneda, y "Impuestos y Libros" para parámetros tributarios e IVA/retenciones; al finalizar pulsa "Guardar Configuración".',
                image: 'cfg-sistema.png',
                annotations: [
                    { n: 1, x: 28.4, y: 22.3, w: 25.2, h: 5.2, label: 'Pestañas "Personalización" e "Impuestos y Libros" con ajustes globales.' },
                    { n: 2, x: 69, y: 78.3, w: 17.7, h: 5.5, label: 'Botón "Guardar Configuración" para aplicar los cambios en el sistema.' }
                ],
                tip: 'Cualquier ajuste fiscal en "Impuestos y Libros" afecta cálculos posteriores de libros e impuestos; valida con Contabilidad antes de modificarlo.'
            },
            {
                title: 'Activar o desactivar Módulos por Empresa',
                description: 'En Configuración → Módulos por Empresa selecciona cualquier empresa de la columna izquierda y activa o desactiva sus módulos especializados (Gasolinera, Huevo Industrial, Contabilidad, RRHH, Pozo) o usa los atajos "Solo Core" y "Activar Todos".',
                image: 'cfg-modulos-empresa.png',
                annotations: [
                    { n: 1, x: 20.6, y: 25.6, w: 22.4, h: 65, label: 'Lista de empresas del sistema; haz clic en una para configurar sus módulos.' },
                    { n: 2, x: 47, y: 25, w: 48.5, h: 65, label: 'Botones "Solo Core" / "Activar Todos" e interruptores individuales de cada módulo.' }
                ],
                tip: 'Ocultar módulos que una empresa no utiliza (por ejemplo Pozo o Huevo Industrial) mantiene su menú lateral limpio y evita confusiones.'
            },
            {
                title: 'Monitorear Estado del Servidor y Microservicios',
                description: 'Si tienes permiso técnico entra a Configuración → Estado del Servidor para vigilar CPU, memoria, almacenamiento y salud de los servicios (Backend Principal, Frontend y API DTE Hacienda), con controles de auto-refresco (3s, 5s, 10s, Pausado), reiniciar o desplegar.',
                image: 'cfg-servidor.png',
                annotations: [
                    { n: 1, x: 74.2, y: 13.6, w: 21.4, h: 3.6, label: 'Controles de refresco automático (3 seg, 5 seg, 10 seg, Pausado) y botón "Actualizar".' },
                    { n: 2, x: 22.5, y: 64, w: 72, h: 34, label: 'Salud de microservicios (API, DTE, Base de datos) y acciones de administración técnica.' }
                ],
                tip: 'Antes de reiniciar el servicio DTE verifica que no haya decenas de facturas transmitiéndose en ese segundo desde Facturación o Pista.'
            },
            {
                title: 'Ejecutar y supervisar Tareas Agénticas de Inteligencia Artificial',
                description: 'En Inteligencia Artificial → Tareas Agénticas puedes lanzar procesos asistidos con "Nueva Tarea Agéntica", filtrar por Estado, Prioridad o Agente, revisar el porcentaje de progreso en vivo y abrir la salida con "Ver Cuadro" o "Ver Texto".',
                image: 'ai-tasks.png',
                annotations: [
                    { n: 1, x: 20.3, y: 36, w: 75.6, h: 3.6, label: 'Botón "Nueva Tarea Agéntica" y buscador por título o descripción.' },
                    { n: 2, x: 25.3, y: 41.6, w: 32.5, h: 3.2, label: 'Filtros rápidos por Estado, Prioridad y tipo de Agente.' },
                    { n: 3, x: 19.6, y: 48.3, w: 80.4, h: 30, label: 'Listado de tareas con Agente/Modo IA, barra de progreso y botones "Ver Cuadro" / "Ver Texto".' }
                ],
                tip: 'Usa "Ver Cuadro" cuando el agente de IA genere comparativos tabulares o resúmenes estructurados listos para analizar.'
            }
        ],
        troubleshooting: [
            { issue: 'Activé un módulo en Módulos por Empresa pero un usuario sigue sin verlo', fix: 'Confirma además que su rol en Seguridad → Roles tenga marcados los permisos de ese módulo y pídele recargar la página (F5).' },
            { issue: 'No encuentro la opción Estado del Servidor o Bitácora en mi menú', fix: 'Son pantallas administrativas o de auditoría; solo aparecen si tu rol tiene asignados los permisos correspondientes.' }
        ]
    }
];

module.exports = RRHH_POZO_ADMIN_TUTORIALS;
