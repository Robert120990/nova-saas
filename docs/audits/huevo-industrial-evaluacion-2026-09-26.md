# Evaluación del módulo de huevo industrial

Fecha: 26 de septiembre de 2026. Evaluación histórica de la base `5e6b78af722ba7c7747cea5aae3373d8750929d3`, anterior a las correcciones.

**Estado actualizado:** consultar [correcciones y validación del 27 de septiembre](huevo-industrial-correcciones-2026-09-27.md). Los hallazgos y referencias de líneas siguientes describen la base original, no el código corregido.

**Dictamen:** el módulo tiene una cobertura funcional amplia, pero su coherencia transaccional, autorización y liberación de calidad necesitan correcciones antes de considerarlo confiable como control integral de planta. El frontend compila; eso no garantiza que los flujos operativos funcionen correctamente. Hay fallos reproducibles en inventario, reportes, calidad, retornables y segregación entre empresas.

## Alcance y evidencia

Se revisaron las 12 pantallas de `EggIndustrial`, componentes relacionados, el router con 186 declaraciones de endpoints, controladores industriales y de despacho/costeo/comisiones, servicios de reportes/retornables/WebSocket, integración con ventas y migraciones relevantes. Se siguieron los flujos principales y se inspeccionaron las funciones críticas; no se afirma cobertura exhaustiva de cada rama del código.

La evaluación combina lectura estática, lint, compilación y ejecución aislada de funciones reales con dependencias simuladas. **No se conectó a MySQL, no se ejecutaron migraciones, no se emitieron DTE ni se enviaron correos.** Las observaciones de concurrencia, restricciones físicas de base de datos, despliegue, impresión y comportamiento en navegador requieren validación posterior en un entorno de prueba. No se verificó visualmente a 320/375 px.

| Comprobación | Resultado |
|---|---|
| `npm run lint` del cliente | Pasa: 0 errores y 0 advertencias. |
| `npm run build` del cliente | Pasa: 3,392 módulos transformados. |
| ESLint de 16 archivos seleccionados del backend industrial | 5 errores `no-undef` y 122 advertencias. Los 5 errores son usos de `normalizeCatalogCodes` fuera de alcance. |
| `npm test` del servidor | 1 archivo de pruebas pasa y 10 fallan; el entorno tiene dependencias ausentes, entre ellas `zod` e `ioredis`. No es evidencia de 10 defectos del módulo industrial. |
| Pruebas aisladas de auditoría | 14 casos reproducidos. Ver [script](<C:/Proyects local/SIPEWEBgas/docs/audits/egg-industrial-probes.cjs>). Se ejecuta con `node docs/audits/egg-industrial-probes.cjs`. |
| Pruebas automatizadas de huevo industrial existentes | No se encontraron pruebas específicas en `server/tests/unit`. |

Las pruebas de auditoría comprueban el comportamiento defectuoso actual; cuando se corrija cada problema, sus expectativas deberán convertirse en pruebas del comportamiento correcto. No sustituyen pruebas HTTP ni de MySQL.

## Cobertura funcional y coherencia

| Área | Lo que existe | Evaluación |
|---|---|---|
| Recepción | Proveedores, tarimas, pesos, temperaturas, clasificación, aprobación, documentos | Cobertura amplia; la API crea/edita con aprobación por defecto y el ajuste posterior al consumo necesita reglas de conciliación. |
| Calendario y MRP | Programación, tareas, sugerencias, pedidos, inicio de lotes | El inicio desde calendario no aplica las mismas reglas que producción directa. |
| Producción | Consumo de MP, CIP, ingredientes, pasteurización, mermas, remanentes, cierres | Es el núcleo más sensible: aislamiento, balance, reintentos y estados presentan fallos. |
| Laboratorio | Parámetros, microbiología, fisicoquímica, cuarentena, certificados | Los dictámenes no forman una barrera única de liberación. |
| Envasado y congelación | Varias presentaciones, etiquetas, lotes, ubicaciones y freezer | Producción histórica y stock disponible comparten campos; los cierres pueden alterar estados de calidad. |
| Trazabilidad | Consulta 360, lotes, certificados y enlace comercial | Buena cobertura estructural; se degrada con consumos ajenos, remanentes reasignables y stock histórico mutable. |
| Inventario traducido | Mapeos de productos, unidades, libras/kg y exportación | Función faltante y ruta de exportación no registrada. |
| Costeo y mantenimiento | Costos por lote, CIP, empaques, compras, escenarios y acuerdos | Modelo rico; necesita conciliar costo simulado, real y contable, además de preservar valores cero. |
| Despacho | Rutas, flota, motorista, GPS, entregas y facturación | Integración extensa; faltan garantías finales de calidad/stock y hay errores en retornables y estados de emisión. |
| Comisiones y planillas | Metas, cálculo, tope y transferencia a RH | El período mensual se reutiliza para ambas quincenas. |
| Reportes | MP, producción, empaque, calidad, mermas, PDF/Excel | Contratos de respuesta y fechas incompatibles con la pantalla; rendimiento agregado duplicado. |
| Dashboard | Alertas y telemetría por WebSocket | La telemetría es simulada y global; no constituye monitoreo real de equipos. |

Aspectos aprovechables: la fachada de controladores conserva las rutas, varias operaciones usan transacciones y bloqueos de filas, hay eventos industriales, catálogos comunes en el cliente y las exportaciones Excel revisadas en `eggReportsExport.service.js` usan `excelService.createExcelBuffer`. El problema principal está en las diferencias entre rutas que deberían imponer las mismas reglas.

## Hallazgos prioritarios

P1 = corregir antes de confiar en el flujo afectado. P2 = corrección funcional o de confiabilidad posterior, sin perder seguimiento. La prioridad refleja el impacto potencial del código; no afirma que ya haya ocurrido un incidente.

### H01 · P1 · Editar producción permite afectar materia prima de otra empresa

En `updateProductionBatch` se comprueba que el lote principal pertenece a la empresa, pero se consulta y actualiza cada `raw_material_id` sin `company_id`. Un usuario con acceso a su empresa puede enviar un ID de materia prima ajena y descontarle existencias. El middleware de tenant no protege estas referencias internas.

Evidencia: [validación de MP](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:1005>) y [descuento sin empresa](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:1040>). Prueba aislada: empresa 7 edita su lote usando MP de empresa 8; se acepta y el stock simulado pasa de 100 a 70 lb.

Corrección: validar pertenencia de todos los IDs referenciados y usar filtros de tenant en lecturas y escrituras. Extender el mismo control a proveedor, sucursal, costos, laboratorio, remanentes y empaques. Agregar pruebas de dos empresas con IDs ajenos.

### H02 · P1 · Los endpoints industriales no aplican permisos de operación

La API padre aplica autenticación y tenant, pero monta el router industrial sin `checkPermission`; las rutas del módulo tampoco lo incorporan. Algunos controladores sí tienen verificaciones puntuales para identificadores/reaperturas, pero aprobación de MP, configuración, laboratorio, costos y otros cambios quedan disponibles por API a usuarios autenticados con acceso a la empresa aunque no tengan el permiso del menú. `bypass_cip_check` es un booleano del cliente, sin autorización específica.

Evidencia: [montaje del router](<C:/Proyects local/SIPEWEBgas/server/src/routes/api.routes.js:778>), [rutas](<C:/Proyects local/SIPEWEBgas/server/src/routes/eggIndustrial.routes.js:6>) y [excepción CIP](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:265>).

Corrección: permisos únicos por pantalla/operación, controlados en servidor; separar producir, aprobar calidad, autorizar excepciones, reabrir y facturar. Registrar usuario autenticado y motivo en excepciones.

### H03 · P1 · WebSocket sin autenticación y telemetría compartida

El servicio acepta el upgrade y agrupa conexiones según `company_id` recibido en URL, sin verificar token o acceso. Además, `telemetryState` es un objeto global: comandos de una conexión cambian la simulación que después se transmite a todas las empresas. Un observador puede solicitar el canal de otra empresa si alcanza el endpoint. Esto afecta telemetría y eventos; **no se encontró control físico de maquinaria en este servicio**.

Evidencia: [upgrade y asociación](<C:/Proyects local/SIPEWEBgas/server/src/services/websocket.service.js:39>), [estado global](<C:/Proyects local/SIPEWEBgas/server/src/services/websocket.service.js:12>) y [difusión](<C:/Proyects local/SIPEWEBgas/server/src/services/websocket.service.js:251>). El [dashboard](<C:/Proyects local/SIPEWEBgas/client/src/pages/EggIndustrial/Dashboard.jsx:42>) fija además el puerto 4000, lo que debe comprobarse detrás del proxy/TLS del despliegue.

Corrección: autenticar el handshake, validar empresa/sucursal y permisos de comandos; mantener estado por equipo y empresa. Aislar y rotular el modo simulación y conectar las lecturas reales mediante un contrato independiente.

### H04 · P1 · Finalizar producción equivale a aprobar calidad

`completeProductionBatch` transforma `en_proceso` o `pasteurizado` en `aprobado_calidad` sin consultar análisis ni validar que se completó la pasteurización. El empaque nuevo interpreta ese estado como `liberado`. La API de recepción también usa `status || 'aprobado'` al crear y editar.

Evidencia: [finalización](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:554>), [liberación inicial del empaque](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggPackaging.controller.js:168>) y [recepción](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggReception.controller.js:187>). Reproducido el paso directo desde `en_proceso` sin laboratorio.

Corrección: separar finalización física y dictamen de calidad. La aprobación debe provenir de una operación autorizada y verificable; recepción nueva debe quedar pendiente salvo un flujo explícito de aprobación.

### H05 · P1 · Las reglas de pasteurización no cubren el catálogo

Los umbrales dependen de coincidencias exactas con `huevo entero` y `clara`, o del texto `yema`. El catálogo permite `clara ppg`, `huevo rapido` y mezclas; algunos de estos valores no pasan por ninguna comprobación de temperatura. Reproducido: `clara ppg`, 0 °C y 200 segundos devuelve `haccp_compliant: true`.

Evidencia: [evaluación](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:617>) y [catálogo](<C:/Proyects local/SIPEWEBgas/client/src/constants/eggIndustrialCatalogs.js:11>).

Corrección: perfiles versionados por producto, cobertura obligatoria de cada categoría y validación numérica antes de evaluar. Un producto sin perfil debe quedar pendiente/bloqueado. Esta observación evalúa la consistencia del código; no valida los límites técnicos del proceso alimentario.

### H06 · P1 · Laboratorio libera con rechazo fisicoquímico

`fq_status` se guarda, pero no participa en la decisión de liberación. Con `mb_status='aprobado'` y `fq_status='rechazado'`, el código libera el empaque incluso sin valores numéricos de los análisis. Crear y actualizar repiten la misma decisión. La respuesta de creación también coloca `...req.body` después de los estados calculados y puede devolver al cliente un estado distinto del persistido.

Evidencia: [decisión](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggQualityLab.controller.js:271>) y [respuesta](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggQualityLab.controller.js:330>). Reproducido con la función real y SQL simulado.

Corrección: un único evaluador que exija FQ y MB conformes, resultados requeridos y ausencia de bloqueos vigentes; persistir dictamen y estados relacionados en una transacción. No permitir que el cuerpo reemplace el resultado evaluado.

### H07 · P1 · Cerrar envasado elimina bloqueos y duplica merma

El cierre escribe `status='empaquetado'` incondicionalmente y no comprueba que ya estuviera cerrado. Dos solicitudes sobre 100 lb de líquido y 80 lb envasadas generan dos mermas de 20 lb. Un lote bloqueado pierde ese estado. El freezer también puede sobrescribir el estado general con `congelado`.

Evidencia: [cierre](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggPackaging.controller.js:452>) y [freezer](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggPackaging.controller.js:421>). Reproducidos cierre repetido y pérdida del bloqueo. Hay implementaciones duplicadas de cierre/reapertura en producción y empaque; la fachada termina usando la de empaque.

Corrección: transiciones explícitas, conservación del dictamen sanitario, bloqueo de fila, cierre idempotente y una única implementación compartida.

### H08 · P1 · Despacho altera el histórico producido y no rechaza faltantes

La facturación resta directamente `units_packaged` y `total_batch_weight_lbs`. Esos mismos campos alimentan reportes de producción y cálculo de merma de cierre. Una venta cambia retrospectivamente cuánto parece haberse envasado. El descuento usa `GREATEST(0, saldo - cantidad)` y no exige saldo suficiente, calidad liberada ni vigencia antes de emitir; las consultas de empaque no leen esos atributos.

Evidencia: [selección y descuento del lote](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggDispatch.controller.js:2715>), [descuento](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggDispatch.controller.js:2755>) y [reporte](<C:/Proyects local/SIPEWEBgas/server/src/services/eggReportsExport.service.js:196>). Comprobado por seguimiento de escrituras y lecturas; no se emitió una factura real.

Corrección: conservar producción original y registrar movimientos/reservas/saldo disponible por lote. Validar saldo, calidad, vencimiento y producto antes de facturar; bloquear existencias durante la asignación. Conciliar inventario industrial y comercial mediante movimientos trazables.

### H09 · P1 · El consumo admite cantidades agregadas superiores al stock

Al crear producción, cada partida se valida contra el mismo saldo inicial y después se descuentan todas. Dos partidas de 60 lb de la misma MP con 100 lb disponibles superan las validaciones y registran 120 lb consumidas, dejando cero por truncamiento. Tampoco hay validación completa de cantidades finitas y positivas por partida. Al editar, el descuento no valida saldo y la reversión restaura libras pero no reconcilia las cajas descontadas al crear.

Evidencia: [validación](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:280>), [descuento](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:428>) y [edición](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggProduction.controller.js:1024>). Reproducido el caso 60+60 sobre 100.

Corrección: consolidar por MP/tarima antes de validar, rechazar entradas inválidas, aplicar cambios atómicos y conciliar libras/cajas/tarimas con el mismo movimiento.

### H10 · P1 · Iniciar desde calendario evita controles del flujo principal

`startBatchFromSchedule` crea el lote con la cantidad objetivo como `input_weight_lbs`, sin asignar/consumir MP, sin validar CIP y sin rechazar un programa con `batch_id` o estado ya iniciado. Repetir la solicitud intenta crear otro lote y reemplazar la vinculación del programa.

Evidencia: [inicio de calendario](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggPlanning.controller.js:643>) y [llamada de pantalla](<C:/Proyects local/SIPEWEBgas/client/src/pages/EggIndustrial/ProductionCalendar.jsx:642>). Reproducida la creación repetida con SQL simulado; una restricción adicional del esquema desplegado podría rechazar parte del resultado, pero no sustituye la validación del flujo.

Corrección: usar el mismo servicio de inicio que producción directa, distinguir objetivo de consumo real y hacer la conversión programa→lote única e idempotente.

### H11 · P1 · Inventario traducido/mapeos fallan y la exportación no tiene ruta

`normalizeCatalogCodes` se define dentro de `eggReports.controller.js`, pero se invoca desde `eggPackaging.controller.js` sin importarlo ni exportarlo. Inventario con mapeos existentes devuelve 500; algunas variantes de guardado de mapeos también fallan. Por separado, la pantalla invoca `/inventory-translated/export`, pero el router solo registra `/inventory-translated`.

Evidencia: [uso sin definición](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggPackaging.controller.js:870>), [definición fuera de alcance](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggReports.controller.js:147>), [ruta](<C:/Proyects local/SIPEWEBgas/server/src/routes/eggIndustrial.routes.js:253>) y [exportación de UI](<C:/Proyects local/SIPEWEBgas/client/src/pages/EggIndustrial/Inventory.jsx:66>). Errores detectados por ESLint y reproducidos aisladamente.

Corrección: extraer/importar el helper y registrar el endpoint de exportación con su permiso. Verificar consulta, guardado y descarga con al menos un mapeo real de prueba.

### H12 · P1 · Reportes ignoran fechas y varias pestañas quedan vacías

La pantalla envía `from/to`, mientras los controladores extraen `start_date/end_date`; las fechas nunca llegan a los servicios. La UI lee `res.data.data`, pero MP, empaque, calidad y mermas responden `{rows, summary}`. Solo producción normaliza `data`. El efecto es una pantalla vacía aunque el servicio tenga filas, o exportaciones sin el período elegido.

Evidencia: [parámetros y lectura](<C:/Proyects local/SIPEWEBgas/client/src/pages/EggIndustrial/Reports.jsx:79>) y [controladores](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggReports.controller.js:22>). Reproducido con una fila y un período explícito.

Corrección: un contrato único de filtros y respuesta, uso de `unwrapList` donde corresponda y prueba de equivalencia entre pantalla, PDF y Excel.

### H13 · P2 · Rendimiento de producción suma dos veces el mismo producto

El indicador `liquid_plus_packaged_lbs` suma rendimiento líquido del lote más peso envasado, aunque envasar no reduce el rendimiento líquido histórico. Con entrada de 100 lb, salida líquida de 80 y las mismas 80 envasadas, muestra 160%.

Evidencia: [fórmula](<C:/Proyects local/SIPEWEBgas/server/src/services/eggReportsExport.service.js:254>). Reproducido en el generador real de datos.

Corrección: distinguir rendimiento producido, líquido aún pendiente de envasar, envasado, remanentes y merma. Nunca sumar cantidades que representan etapas sucesivas de la misma masa.

### H14 · P1 · Retornables de facturas con varias partidas quedan incompletos

Despacho llama `recordSaleReturnables` una vez por partida. El servicio aplica idempotencia por `sale_id`: después de registrar la primera, omite las siguientes. Caso reproducido: 10 cubetas + 20 cubetas generan saldo de solo 10 cubetas y tapaderas.

Evidencia: [llamada dentro del ciclo](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggDispatch.controller.js:2538>) y [idempotencia por venta](<C:/Proyects local/SIPEWEBgas/server/src/services/eggReturnableService.js:135>).

Corrección: enviar todos los ítems de la venta en una llamada, o definir idempotencia por partida y agregar consistentemente. Reconciliar saldos históricos antes de confiar en estados de cuenta existentes. Las inferencias de cubetas a partir de texto/cantidad también deben sustituirse por unidad explícita.

### H15 · P1 · Las dos quincenas pueden liquidar las mismas ventas del mes

El cálculo acepta `quincena`, pero consulta siempre del primer al último día del mes. La clave única incluye quincena, por lo que primera y segunda pueden coexistir con la misma base mensual y transferirse a planillas diferentes.

Evidencia: [rango mensual](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggCommissions.controller.js:282>) y [clave única](<C:/Proyects local/SIPEWEBgas/database/migration_v226_egg_sales_commissions_and_goals.sql:105>). Reproducidas ambas consultas con idéntico rango.

Corrección: definir si la comisión es mensual pagada en una quincena o verdaderamente quincenal. En el primer caso debe existir una sola liquidación mensual; en el segundo, dividir fechas y aplicar el tope según la regla acordada. Proteger liquidaciones ya transferidas/pagadas contra recálculos silenciosos.

### H16 · P1 · Fallos/rechazos DTE se guardan como venta emitida

`autoInvoiceDispatchRoute` distingue rechazo y error de emisión, pero el estado final es `contingencia` solo para contingencia y `emitido` para todos los demás casos. Después vincula pedido/parada, descuenta inventario y confirma la transacción. Esto hace que un rechazo/error se trate localmente como venta emitida y pueda bloquear la refacturación por `sale_id` existente.

Evidencia: [emisión y manejo del resultado](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggDispatch.controller.js:2603>) y [estado final](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggDispatch.controller.js:2635>). Revisión del flujo; no se invocó el servicio DTE.

Corrección: modelar por separado reserva comercial, venta y resultado de emisión; reintentos idempotentes por pedido/documento y estado explícito de rechazo/error. Evitar mantener una transacción de varios pedidos abierta durante llamadas externas: un rollback local no deshace documentos que el servicio externo ya aceptó.

### H17 · P2 · Pronóstico devuelve datos de ejemplo como resultado normal

Con menos de cuatro meses de datos o error de consulta, `/forecast` usa una serie fija y devuelve `confidence_interval: '92.4%'` sin calcularlo ni identificar simulación. La consulta suma cantidades de todas las ventas de la empresa y las transforma en una recomendación de libras; además ordena por número de mes, no año-mes.

Evidencia: [pronóstico](<C:/Proyects local/SIPEWEBgas/server/src/controllers/eggIndustrial/eggPlanning.controller.js:21>).

Corrección: respuesta explícita de datos insuficientes, agrupación cronológica año-mes, filtro de productos industriales, conversión de unidades y separación de ventas reales/proyecciones. Retirar el porcentaje de confianza hasta disponer de un método medido.

### H18 · P2 · La confidencialidad de montos no se aplica uniformemente

Hay costos y precios interpolados directamente en componentes, opciones y mensajes sin `<Money>`/`<MoneyInput>`. Un ejemplo son los costos de compra de químicos/empaques y valores del simulador de comisiones. Ocultar importes en otras pantallas no cubre estas representaciones.

Evidencia: [catálogo de costeo](<C:/Proyects local/SIPEWEBgas/client/src/components/egg/costeo/EggCosteoCatalogTab.jsx:162>), [modal CIP](<C:/Proyects local/SIPEWEBgas/client/src/components/egg/costeo/EggCipModal.jsx:54>) y [simulador](<C:/Proyects local/SIPEWEBgas/client/src/components/egg/EggCommissionsSimulator.jsx:198>).

Corrección: aplicar los componentes centralizados también a etiquetas auxiliares, tooltips y entradas; verificar un rol sin `view_amounts`. El permiso de interfaz no reemplaza la autorización de los endpoints financieros.

## Mejoras de coherencia y mantenimiento

1. **Separar estados de proceso, calidad y existencias.** Un lote puede estar envasado y seguir en cuarentena. Estados de producción y congelación no deben reemplazar un bloqueo sanitario. Los eventos deben guardar actor autenticado, motivo, estado anterior/nuevo y entidad afectada.
2. **Balance de masa único.** Entradas de MP + ingredientes + reproceso deben reconciliarse con salida útil + remanentes + mermas. Definir tolerancias y exigir explicación fuera de ellas. La asignación de remanentes debe validar disponibilidad, origen, destino, calidad y cantidades consumidas.
3. **Catálogo común para cliente y servidor.** Evitar que el frontend ofrezca categorías que el backend no interpreta. Unidades, peso por presentación, conversiones, receta y perfil térmico deben usar IDs estables, no coincidencias de texto.
4. **Costeo verificable.** En `eggCosteoLibra.controller.js:1025` y siguientes, expresiones `valor || predeterminado` reemplazan ceros configurados por costos de ejemplo. Usar ausencia explícita y conservar cero válido. El historial en `:1420` une lotes con todos sus registros de costo antes de sumar rendimiento: revisar/preagregar para no multiplicar producción cuando un lote tenga varias filas de costos. Identificar claramente qué proviene de compras reales y qué es supuesto del simulador.
5. **Servicio transaccional por operación.** Unificar creación/edición/inicio de lote, liberación, cierre, empaque y despacho. Los inserts y cambios de estado relacionados deben confirmar o revertirse juntos. No capturar errores de escritura y continuar como si el vínculo se hubiera creado.
6. **Migraciones controladas.** `eggUtils.js:57` y `:306` crean/alteran tablas al cargar el módulo. Mover estas operaciones a migraciones versionadas y agregar un chequeo de compatibilidad de esquema que no escriba durante solicitudes o arranque normal.
7. **Reducir tamaños y duplicación.** Las 12 páginas exceden 350 líneas: Producción 3,694; Recepción 3,039; Trazabilidad 2,665; Calendario 2,656; Despacho 2,648; Configuración 2,596; Costeo 2,020; Costos/Mantenimiento 1,819; Empaque 899; Reportes 838; Inventario 597; Dashboard 468. Controladores como Despacho (2,866), Planificación (2,636) y Producción (1,929) siguen concentrando demasiadas responsabilidades pese a la fachada. Extraer tabs, formularios, modales, cálculos y servicios según AGENTS.md.
8. **Contrato de frontend uniforme.** Estas páginas usan mayormente `useState/useEffect` para datos remotos; `unwrapList` solo aparece en Recepción dentro de las páginas revisadas. Adoptar TanStack Query, claves por empresa/sucursal/filtros, manejo de errores real y cancelación de consultas obsoletas. Centralizar fechas y usar `ReportLayout` para reportes convencionales.
9. **Escalabilidad de consultas.** Paginar listados en servidor; el reporte de producción consulta empaque y materias primas por cada lote. Reemplazar ese patrón por agregaciones/lotes de consultas, mantener filtros indexables y límites de exportación razonables. Mantener Excel y reportes pesados en workers.
10. **Usabilidad móvil.** Validar flujos completos a 320/375 px: tarimas, escáner, partidas, laboratorio y despacho. La compilación no acredita que tablas, modales y barras de acciones sean utilizables en esos anchos.

## Orden recomendado de trabajo

| Etapa | Trabajo | Criterio de aceptación |
|---|---|---|
| 1. Seguridad y liberación | H01–H07; permisos HTTP/WS, pertenencia de IDs y dictamen único | Usuario sin permiso no muta; IDs ajenos rechazados; ninguna operación física levanta un bloqueo; liberación exige resultados válidos. |
| 2. Integridad operativa | H08–H10, H13–H16; movimientos, cierres, calendario, retornables y emisión | Repetir solicitudes no duplica efectos; stock nunca se trunca silenciosamente; ventas no cambian histórico; DTE fallido tiene recuperación explícita. |
| 3. Funciones visibles | H11–H12, H17–H18; inventario, reportes, previsión y montos | Inventario consulta/exporta; fechas y filas coinciden entre UI/PDF/Excel; datos simulados identificados; rol restringido no ve montos. |
| 4. Consolidación | Servicios comunes, modularización, costos y UX | Pantallas/controladores acotados; pruebas del proceso completo y trazabilidad de cada cifra. |

No conviene comenzar por un rediseño visual general: primero deben corregirse autorización, estados y movimientos porque las demás pantallas dependen de esos datos.

## Pruebas de aceptación pendientes

- Dos empresas y dos sucursales: intentar referencias ajenas en MP, lotes, empaques, costos, retornables y despacho; comprobar permisos delegados y conexión WebSocket.
- Ciclo completo en datos de prueba: recepción pendiente → aprobación → CIP → consumo real → pasteurización → laboratorio → envasado → liberación → reserva/despacho → emisión → devolución/invalidación.
- Reintentos y concurrencia: doble clic en iniciar/cerrar/facturar; dos usuarios consumiendo el último saldo; liberación/rechazo simultáneo con despacho.
- Lote de 100 lb con 80 útiles: venta parcial no cambia producido ni merma histórica; remanente no se asigna a dos lotes; presentaciones convierten consistentemente unidades/libras/kg.
- Factura con 10 cubetas de 30 lb y 20 de 32 lb: 30 cubetas y 30 tapaderas; reintento no duplica; reversión comercial ajusta el saldo conforme a la regla operativa.
- Reportes con datos dentro/fuera del período: mismas filas y totales en pantalla, PDF y Excel; sin pérdida de documentos por zona horaria.
- Comisiones y RH: fechas de corte, tope, cambio de vendedor, recálculo, planilla pagada y reintento de transferencia.
- Validación visual móvil, impresión de etiquetas y lectura de QR/códigos con dispositivos reales.

Archivos añadidos por esta evaluación: este informe y el script de pruebas aisladas. No se corrigió código de aplicación, no se hizo commit ni push.
