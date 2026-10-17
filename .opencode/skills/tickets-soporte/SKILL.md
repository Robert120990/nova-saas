---
name: tickets-soporte
description: Arquitectura del módulo de Tickets de Soporte Técnico, compresión WebP ultra-liviana, motor de telemetría/relevancia del navegador, empaquetado de Prompts para IA (TICKETS_PARA_IA.md) y colaboración Multi-Agente.
---

# Skill: Módulo de Tickets de Soporte & Diagnóstico IA (`tickets-soporte`)

Esta guía documenta la arquitectura integral del sistema de **Tickets de Soporte Técnico** en SIPEWEBgas, diseñado para conectar a los usuarios operativos, el equipo de soporte técnico (vía Web y Telegram) y el ecosistema de agentes de Inteligencia Artificial.

---

## 1. Arquitectura Modular (< 350 líneas por archivo)

### Frontend (`client/src/`)
- **`pages/SupportTickets.jsx`**: Pantalla principal del Centro de Soporte con KPIs de estado, filtros por prioridad/tipo/estado y acceso a modales especializados.
- **`components/support/`**:
  - `SupportTicketButton.jsx`: Botón flotante/cabecera accesible desde cualquier pantalla para reportar incidentes en contexto.
  - `CreateTicketModal.jsx`: Modal de creación con captura automática de ruta, pegado de imágenes (`Ctrl+V`) y adjunto automático de telemetría.
  - `ScreenshotAnnotatorModal.jsx`: Editor en lienzo HTML5 Canvas para señalar errores con rectángulos, flechas y texto antes de adjuntar.
  - `TicketDetailModal.jsx`: Hilo de conversación en tiempo real (WebSocket + Telegram), cambio de estado, visor de telemetría y curación individual para IA (`include_in_ai_prompt`, `ai_notes`).
  - `AiPromptBundleModal.jsx`: Consola técnica para filtrar tickets reales de código/mejora, excluir dudas de usuario, sincronizar `TICKETS_PARA_IA.md` y resolver lotes masivamente.
  - `ResolvedTicketPopupModal.jsx`: Modal emergente celebratorio que notifica exclusivamente al usuario creador cuando su ticket pasa a `resuelto`.
- **`utils/`**:
  - `imageCompression.js`: Compresión cliente en HTML5 Canvas a formato **`image/webp`** (`maxDimension = 1280`, `quality = 0.72`), reduciendo capturas de 3-5 MB a ~40-90 KB.
  - `browserDiagnostics.js`: Interceptor en memoria de errores de consola (`console.error`, `window.onerror`, `unhandledrejection`) y fallos HTTP/Axios (`status >= 400` o errores de red) con motor de puntuación de correlación (`0-100%`).

### Backend (`server/src/`)
- **`controllers/ticket.controller.js`**: CRUD de tickets, estadísticas, comentarios y acuse de recibo del usuario creador.
- **`controllers/ticketAiBundle.controller.js`**: Curación técnica para IA (`PUT /api/tickets/:id/ai-review`), generación del documento `TICKETS_PARA_IA.md` (`POST /api/tickets/ai-bundle/generate`) y cierre en lote con notificación individual (`POST /api/tickets/ai-bundle/resolve-batch`).
- **`services/ticket.service.js`**: Persistencia en `support_tickets` y `support_ticket_messages`, emisión de eventos WebSocket (`ticket_created`, `ticket_updated`, `ticket_resolved`, `ticket_message`) y notificaciones internas.
- **`services/ticketTelegram.service.js`**: Integración bidireccional con Telegram para técnicos autorizados (`/tickets`, `/tkt`, `/tomar`, `/responder`, `/resolver`).

---

## 2. Motor de Telemetría del Navegador y Relevancia Diagnóstica

Cada vez que un usuario abre `CreateTicketModal`, `browserDiagnostics.js` evalúa las últimas operaciones fallidas de red y consola frente a la ruta actual (`page_url`) y descripción:

1. **Correlación Alta (`alta`, score >= 70)**: Fallos HTTP `500/4xx` o excepciones JS ocurridos en la misma pantalla en los últimos minutos.
2. **Correlación Media (`media`, score 40-69)**: Errores recientes en rutas relacionadas o advertencias de red.
3. **Correlación Baja / Sin Errores (`baja` / `sin_errores`, score < 40)**: Indica que no hubo fallo técnico de ejecución (frecuente en dudas operativas o solicitudes de mejora).

---

## 3. Flujo de Empaquetado para IA (`TICKETS_PARA_IA.md`)

Para evitar contaminar el desarrollo con simples dudas de capacitación:
1. El técnico revisa los tickets abiertos y marca **`Incluir en Prompt IA`** (`include_in_ai_prompt = 1`) únicamente en bugs reales o mejoras aprobadas, añadiendo una **Directriz Técnica (`ai_notes`)**.
2. Desde **`AiPromptBundleModal`**, al pulsar **"Guardar y Generar TICKETS_PARA_IA.md"**, el backend escribe en la raíz del proyecto el archivo `TICKETS_PARA_IA.md` con:
   - Descripción original del usuario y directriz técnica del revisor.
   - Rutas locales a las capturas `.webp` (`server/uploads/ticket-...webp`), indicando si incluyen trazos/flechas de señalización.
   - Resumen de fallos HTTP y errores de consola JS con su porcentaje de correlación.
3. El desarrollador o asistente de código lee `TICKETS_PARA_IA.md`, inspecciona las capturas `.webp` livianas, aplica la solución y finalmente usa **"Resolver Lote IA"** para cerrar los tickets y notificar a cada autor.

---

## 4. Ecosistema Multi-Agente (`SupportTicketAgent` + `TechnicalAgent` + `SupervisorAgent`)

- **`SupportTicketAgent` (`code: 'support'`)**:
  - Archivo: `server/src/services/agents/SupportTicketAgent.js`
  - Permiso requerido: `view_support_tickets`
  - Herramientas registradas:
    - `analyze_support_tickets` (`server/src/services/agents/tools/supportTicketDiagnosticTool.js`)
    - `execute_sql_query` (`server/src/services/agents/tools/sqlQueryTool.js`)
  - Capacidades: Clasifica automáticamente los tickets en `BUG_TECNICO_CON_TRAZA`, `OPORTUNIDAD_MEJORA_O_AJUSTE` y `SOPORTE_OPERATIVO_USUARIO`. Con `auto_flag_for_ai: true`, preselecciona en base de datos los tickets técnicos y redacta `ai_notes` sugeridas.
- **`TechnicalAgent` (`code: 'tech'`)**:
  - Además de `get_system_health`, integra `analyze_support_tickets` para correlacionar picos de RAM/CPU, lentitud de MySQL o caídas del microservicio DTE con reportes recientes de usuarios.
- **`SupervisorAgent` (`code: 'supervisor'`)**:
  - Enruta automáticamente cualquier consulta sobre `support_tickets`, errores reportados por usuarios, telemetría de navegador o preparación de `TICKETS_PARA_IA.md` hacia el especialista `'support'`.
