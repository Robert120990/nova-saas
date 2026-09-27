# Correcciones del módulo de huevo industrial

Fecha de cierre técnico: 27 de septiembre de 2026. Base auditada: `5e6b78af722ba7c7747cea5aae3373d8750929d3`.

Este documento actualiza la [evaluación inicial](huevo-industrial-evaluacion-2026-09-26.md). Las referencias de líneas de aquella evaluación corresponden a la base anterior a la modularización.

## Cambios por hallazgo

| Hallazgo | Corrección implementada |
|---|---|
| H01 · Aislamiento | Validación de referencias de empresa, filtros de tenant y bloqueos en consumo de MP, lotes y empaques. |
| H02 · Permisos | Cada endpoint industrial declara permiso; se consulta el rol asignado en `usuario_empresa`, con excepción de SuperAdmin. Nuevas claves tienen herencia mediante v234. |
| H03 · WebSocket | JWT en subprotocolo, validación de acceso a empresa, caducidad de sesión y permiso separado para simulación. Telemetría aislada por empresa y señalada como demostración. |
| H04 · Finalización | Completar físicamente el lote no concede aprobación de calidad. Reintentos idénticos no repiten efectos. |
| H05 · Pasteurización | Los productos sin perfil reconocido no pueden aprobar HACCP. Se preservan los umbrales existentes; no se ha realizado validación sanitaria de recetas. |
| H06 · Laboratorio | Una única evaluación exige resultados completos y ambos dictámenes aprobados; rechazo FQ o MB bloquea. Resultados ausentes se guardan como desconocidos, sin inventar analista. La liberación exige pasteurización conforme y cerrada. |
| H07 · Cierre | Los cierres conservan bloqueos HACCP, evitan duplicar merma y emplean estados compatibles con el esquema. |
| H08 · Despacho | Producción histórica separada de despachado mediante ledger. Se validan saldo acumulado, unidades, peso, lote específico, vencimiento y liberación antes del descuento. |
| H09 · Consumo | Agrupación de MP repetida, validación de números/cajas y existencias bajo bloqueo. Remanentes asignados protegidos. Un lote procesado no se elimina para devolver su MP. |
| H10 · Calendario | Inicio mediante el flujo de producción, con MP aprobada, sanitización CIP o excepción autorizada y justificada, y protección del vínculo de programación. |
| H11 · Inventario | Normalizador compartido de catálogos, exportación registrada y consulta de saldos disponibles descontando despachos. |
| H12 · Reportes | Contrato de filas compatible, filtros comunes para pantalla/PDF/Excel y columnas alineadas con la respuesta del servidor. Visor y exportación mediante ReportLayout. |
| H13 · Rendimiento | Se elimina la suma duplicada de líquido más producto envasado; las consultas de producción se agrupan. |
| H14 · Retornables | Todas las partidas se registran juntas; bloqueo por cliente y deduplicación por venta. |
| H15 · Comisiones | Una liquidación por vendedor/mes; no se repite en otra quincena ni se recalcula una transferencia. Transferencia bloqueada e idempotente. Se conserva el modelo mensual existente. |
| H16 · DTE | Venta borrador y reserva persistidas antes de la llamada externa. Outbox y conciliación contra Gestión DTE, sin reemisión automática de resultado incierto. El pago se registra después de aceptación/contingencia confirmada. |
| H17 · Pronóstico | Historial real por año/mes; insuficiencia explícita, sin datos de ejemplo ni porcentajes de confianza inventados. |
| H18 · Montos | Money/MoneyInput y formateador de texto que respeta `view_amounts` en opciones, avisos y ayudas. |

Además, las 12 páginas quedan como orquestadores menores de 350 líneas; pestañas y modales se extraen a componentes. Los controladores refactorizados conservan fachadas compatibles y quedan por debajo de 350 líneas. Las operaciones extensas se trasladan a servicios. Costeo respeta valores cero y evita multiplicar producción al unir costos.

## Validación realizada

- Cliente: `npm run lint` y `npm run build` pasan.
- Backend industrial modificado: ESLint sin errores; existen advertencias de código heredado fuera del criterio `--quiet`.
- `node --test server/tests/unit/eggIndustrial.test.js`: 25 pruebas pasan. Cubren tenant, permisos, calidad, stock, reintentos, reportes, retornables, comisiones, outbox, WebSocket y migración reanudable con dependencias simuladas.
- Suite general del servidor: 142 pruebas, 140 pasan y 2 fallan por condiciones del entorno: precarga de catálogos Hacienda sin catálogo disponible y dependencia `pino` ausente en `dte-api`.
- Lint global del servidor: persisten 5 errores `no-useless-escape` ajenos al módulo, en `scripts/import_corina_mendez.js` y `src/controllers/purchase.controller.js`.
- Navegador Edge/Playwright: las 12 rutas a 320 y 375 px cargan sin excepciones JavaScript ni desbordamiento de la página, con respuestas API simuladas. Se abrieron formularios de recepción, producción, calendario y envasado; se inspeccionaron capturas representativas.

Estas pruebas no validan MySQL real, carreras entre procesos, Hacienda, impresoras, lectores, básculas ni equipos de planta. No se ejecutaron migraciones sobre la base real ni se emitieron DTE o correos de prueba.

## Aplicación de v234 antes de habilitar el nuevo código

1. Preparar respaldo verificado y ensayo sobre una copia de la base. Guardar una instantánea por empresa/empaque de `units_packaged` y `total_batch_weight_lbs`, que en el código anterior representan saldo restante.
2. Establecer una ventana sin escrituras industriales y detener los procesos antiguos que puedan despachar o modificar empaques. No mezclar versiones durante el backfill.
3. Con las migraciones anteriores aplicadas y la conexión de servidor configurada, ejecutar desde la raíz:

   ```sh
   node database/run_migration_v234.js
   ```

4. Comprobar que se crearon `egg_dispatch_emissions`, `egg_packaging_movements`, `dispatched_units` y `dispatched_weight_lbs`. Conciliar por empaque que **producido menos despachado coincide con el saldo de la instantánea previa**, tanto en unidades como en libras. Revisar las nuevas claves de permisos y su herencia.
5. Iniciar la versión nueva y probar recepción → producción → laboratorio → envasado → despacho con dos empresas y un usuario de permisos limitados, en el entorno de prueba. Verificar reintentos y reserva después de un rechazo DTE antes de habilitar operación.

El backfill suma únicamente salidas documentadas en eventos `DESPACHO_SALIDA_LOTE`. Los empaques procesados dejan de tener el marcador NULL, por lo que repetir la migración no vuelve a sumar sus salidas. Un evento inválido detectado detiene el proceso y requiere conciliación. Historial incompleto, eventos duplicados o descuentos antiguos truncados pueden impedir reconstruir la producción histórica exacta; conservar el saldo no certifica la exactitud del histórico.

**Despliegue automático:** `deploy/webhook_deploy.sh` recorre los runners y puede ejecutar v234 automáticamente; además ignora errores de migración. El script alternativo `scripts/webhook_deploy.sh` no incluye v234. Antes de usar cualquiera, coordinar la ventana, respaldo y migración explícita anterior. No se cambiaron ni ejecutaron estos scripts ni se verificó qué webhook utiliza el servidor de Robert.

No revertir únicamente el código después de v234: la versión antigua descontaría campos que ahora representan producción. Cualquier reversión requiere detener escrituras y restaurar código y base compatibles desde el respaldo.

## Operación DTE y seguimiento

Un intento `pending` puede emitirse desde la recuperación. Un intento `sending` o `review` exige resolver el documento existente en Gestión DTE y conciliarlo; no genera automáticamente otro documento ni libera la reserva. La conciliación exige un único documento relacionado y aceptación con sello o contingencia reconocida. La aceptación repetida no duplica el pago. Una cancelación con liberación de reserva requiere un flujo explícito posterior; no borrar registros para forzarla.

Quedan como mejoras posteriores: validación sanitaria de perfiles por formulación; balance físico completo con ingredientes, reprocesos y tolerancias aprobadas; conciliación histórica de retornables y comisiones; integración real de telemetría; centralización de fórmulas financieras y mayor cobertura MySQL/HTTP concurrente. La extracción conserva varios hooks extensos con estado local: conviene migrarlos gradualmente a consultas/paginación comunes y separar responsabilidades. Los PDF existentes conservan su diseño; la revisión visual exhaustiva de cada exportación sigue pendiente.
