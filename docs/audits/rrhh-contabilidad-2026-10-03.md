# Revisión de RR. HH., planillas y contabilidad

Fecha: 03/10/2026. Cambios y evidencias disponibles en el entorno local.

Se encontraron rutas capaces de causar sobrescritura de datos, pérdida de cambios pendientes y visualización de información desactualizada. La caché era parte del problema, junto con guardados simultáneos, respuestas tardías y operaciones que sustituían detalles. Esta revisión no identifica cuál de esas rutas produjo cada incidente histórico reportado; para eso hacen falta registros y conciliación de la base real.

## Correcciones de planillas

| Riesgo encontrado | Comportamiento corregido |
| --- | --- |
| Un guardado terminaba mientras el usuario seguía editando y podía dar por guardados cambios posteriores. | La cola envía copias de los datos y guarda en orden. Las ediciones posteriores permanecen pendientes hasta su confirmación. |
| Una respuesta del empleado o período anterior podía reemplazar el formulario actual. | Las cargas y cálculos comprueban contexto y revisión; el desmontaje invalida respuestas pendientes. |
| Regenerar un período podía reemplazar valores manuales. | Un período existente produce conflicto; sincronizar incorpora novedades conservando detalles existentes. |
| Dos pestañas podían sustituir los mismos detalles sin detectar cambios ajenos. | El servidor bloquea la operación y compara una revisión del contenido. La segunda edición obsoleta se rechaza antes de borrar detalles. |
| Un cálculo fallido podía convertirse en importes o retenciones de cero. | Se conserva el formulario y se bloquea el guardado hasta disponer de un cálculo válido. |
| Un importe histórico pequeño podía interpretarse como cantidad de horas. | Cargar respeta el importe registrado. Cantidad y base explícitas, incluido cero, tienen prioridad; inferir cantidades no modifica importes históricos. |
| Cambiar sueldo en el expediente podía modificar la lectura de una planilla histórica. | Se conserva el sueldo registrado y la misma revisión que utiliza el guardado. |
| Excluir un empleado podía vaciar la pantalla antes de confirmar la eliminación. | Los campos se limpian después del éxito; un error conserva formulario y borrador. |
| Cerrar o importar comisiones simultáneamente podía duplicar cuotas o reemplazar valores. | Las operaciones usan bloqueos, transacciones y reversión completa ante fallos. |

El editor conserva un borrador de la planilla normal en `sessionStorage`, separado por usuario y empresa, con su revisión original. Puede recuperarse al recargar o regresar dentro de la misma pestaña. Este respaldo depende del almacenamiento del navegador y no sustituye el guardado en el servidor; si el navegador lo rechaza, se avisa sin interrumpir el guardado. No se promete recuperación después de cerrar la pestaña.

El conflicto permite comparar la edición local con los datos actuales y decidir qué conservar. Una planilla pagada se muestra sin permitir nuevas modificaciones. Navegar, sincronizar, generar, excluir o emitir ciertas vistas espera el guardado pendiente y conserva la edición si este falla.

La importación de comisiones individual y masiva usa el mismo cálculo. Se evita sumar nuevamente el sueldo, se agregan comisiones de vendedores vinculados al mismo empleado y repetir una transferencia conserva el resultado. Eliminar un borrador libera su vinculación para una nueva importación; el fallo de eliminación revierte también esa liberación.

## Otras prestaciones de RR. HH.

Quincena 25 y aguinaldos aíslan consultas por contexto y descartan cálculos tardíos. Cambiar filtros invalida los resultados anteriores.

Vacaciones y liquidaciones tienen pantallas y modales independientes. Editar sin cambiar los datos monetarios conserva las retenciones históricas. Al modificar datos que requieren recálculo, los importes dependientes muestran «Pendiente»; el neto deja de estar disponible hasta finalizar correctamente. Las solicitudes incompletas o con totales inconsistentes se rechazan. Los guardados comprueban empresa, empleado y revisión, y revierten el lote ante una falla.

## Correcciones contables

Las partidas validan cuentas de la empresa, importes finitos, precisión monetaria, ausencia de negativos y equilibrio exacto en centavos. La edición compara una versión del contenido antes de reemplazar líneas. Un fallo de inserción revierte cabecera y detalles.

Los ajustes se guardan como un lote con comparación por clave. El formulario conserva ediciones durante errores o actualización de consultas y muestra las diferencias con otra sesión. Los marcadores internos de generación, cierre y apertura están protegidos. El borrador de conexión a oficina permanece al alternar pestañas.

Las consultas modificadas de partidas, ajustes, catálogos contables, oficina, generación, correlativos y operaciones fiscales incluyen empresa en la clave de caché y en la solicitud. Las lecturas utilizan cancelación. El cambio de contexto global cancela y limpia consultas y desmonta la vista operativa anterior.

La generación automática corrige la inversión de Debe/Haber para importes negativos, conserva IVA ante campos opcionales nulos y produce partidas cuadradas. Su guardado bloquea generación simultánea de la misma operación. Los formularios quedan bloqueados mientras se envían sus datos.

### Cierre, apertura y correlativos

El cierre toma cuentas de resultados del ejercicio y hasta la fecha seleccionada. La apertura toma cuentas de balance del ejercicio anterior. La vista previa y el guardado usan la misma selección. No se acumulan años anteriores por ausencia de un filtro temporal ni se copia una apertura vigente por segunda vez.

Cabecera, líneas, marcador y correlativo se confirman en una transacción. Los cierres/aperturas simultáneos y las partidas históricas sin marcador se detectan como duplicados; anular permite regenerar. Se rechazan partidas vacías o descuadradas y se manejan saldos negativos mediante inversión de columnas.

Los correlativos bloquean por empresa, comparan el valor originalmente leído y guardan todos los meses como un solo lote. Una reserva concurrente invalida la edición antigua. Se usa el sufijo completo después de 999 partidas. Reenumerar omite los números reservados por partidas anuladas y conserva esas partidas.

## Verificación realizada

| Comprobación | Resultado |
| --- | --- |
| Pruebas seleccionadas del backend | **117/117 aprobadas**: persistencia, concurrencia, comisiones, prestaciones, partidas, configuración, generación, fiscal y correlativos. |
| Pruebas del frontend | **15/15 aprobadas**: cola de guardado, recuperación tras errores, contexto, cancelación y lectura de detalles históricos. |
| Suite completa del backend | **237/238 aprobadas**. Falló únicamente la precarga de catálogos de Hacienda por acceso `EACCES` a MySQL desde este entorno. |
| Lint completo del cliente | **0 errores**, 2 advertencias existentes de Fast Refresh en `EggQualityFinishedProductModal.jsx`. |
| Lint de áreas revisadas del backend | **0 errores**, 7 advertencias de variables sin uso en archivos incluidos en el alcance del chequeo. |
| Compilación de producción del cliente | **Aprobada** con `npm run build`; Vite y generación del service worker completados. |

Las pruebas transaccionales del backend utilizan conexiones simuladas, incluidas fallas de inserción/confirmación y solicitudes simultáneas. Comprueban la lógica y el uso de las operaciones transaccionales; no certifican el comportamiento del motor MySQL real.

La revisión visual utilizó componentes reales con una API simulada y datos ficticios, sin enviar registros a la base de negocio. Se comprobaron 320 y 375 píxeles en las pantallas revisadas, además del conflicto de planilla en escritorio. Se verificaron conservación de formularios ante errores, recuperación del borrador normal al regresar, comparación de conflictos y bloqueo de guardados incompletos. No hubo errores de consola en la última sesión de pruebas.

Evidencias:

- [Conflicto de planilla en escritorio](rrhh-contabilidad-evidencia/conflicto-planilla-escritorio.png).
- [Planilla cerrada en móvil](rrhh-contabilidad-evidencia/planilla-cerrada-320.png).
- [Cálculo fallido de vacaciones](rrhh-contabilidad-evidencia/vacaciones-calculo-fallido-320.png).
- [Error de guardado de liquidaciones](rrhh-contabilidad-evidencia/liquidaciones-falla-320.png).
- [Conflicto de ajustes contables](rrhh-contabilidad-evidencia/conflicto-ajustes-320.png).
- [Conflicto de correlativos](rrhh-contabilidad-evidencia/correlativos-conflicto-320.png).
- [Generación contable móvil](rrhh-contabilidad-evidencia/generacion-320.png).
- [Modal de nueva partida](rrhh-contabilidad-evidencia/partida-modal-320.png).
- [Quincena 25](rrhh-contabilidad-evidencia/quincena25-375.png).
- [Aguinaldos](rrhh-contabilidad-evidencia/aguinaldos-375.png).
- [Cierre](rrhh-contabilidad-evidencia/cierre-320.png) y [apertura](rrhh-contabilidad-evidencia/apertura-375.png).

## Validación pendiente en un entorno con base de prueba

1. Confirmar que las tablas participantes usan un motor transaccional y que existen las restricciones esperadas. La consulta de solo lectura a `information_schema` no se ejecutó: la revisión automática de permisos la rechazó por límite de uso.
2. Ejecutar con dos sesiones reales los conflictos de planillas/partidas, importación repetida de comisiones, doble cierre y doble reserva de correlativo. Interrumpir y restablecer la conexión para verificar lo registrado en MySQL.
3. Recorrer el cambio de empresa/sucursal con solicitudes pendientes, volver al formulario y conciliar cabecera, detalles, cuotas, comisiones y reportes.
4. Comparar períodos históricos con respaldos y registros para determinar el alcance de los incidentes anteriores. Estas correcciones no recuperan por sí mismas información ya perdida.
5. Validar las políticas contables del negocio y la normativa aplicable, incluidos reembolsos de notas de crédito y documentos de compra especiales, antes de considerar certificados todos los cálculos fiscales.

Los resultados locales reducen riesgos concretos y reproducibles, pero no justifican afirmar que el sistema funciona «a la perfección» en producción. No se ejecutaron migraciones ni escrituras en la base real, ni se realizaron commits o pushes por parte de este agente. Los cambios permanecen disponibles para revisión local junto con otros cambios existentes del espacio de trabajo.
