const BaseAgent = require('./BaseAgent');
const supportTicketDiagnosticTool = require('./tools/supportTicketDiagnosticTool');
const sqlQueryTool = require('./tools/sqlQueryTool');

/**
 * SupportTicketAgent: Agente especialista en triaje de tickets de soporte,
 * correlación de telemetría del navegador (errores JS y red HTTP) y empaquetado para IA.
 */
class SupportTicketAgent extends BaseAgent {
    constructor() {
        super({
            code: 'support',
            name: 'Agente Especialista en Tickets & Diagnóstico de Soporte',
            description: 'Triaje inteligente de tickets de soporte, correlación de errores de consola/red, clasificación entre dudas de usuario vs bugs de código y preparación de paquetes de mejoras para IA.',
            requiredPermission: 'view_support_tickets'
        });

        this.registerTool(supportTicketDiagnosticTool);
        this.registerTool(sqlQueryTool);
    }

    getSystemPrompt(_context) {
        return `Eres el Agente Especialista en Tickets & Diagnóstico de Soporte de Novas SaaS en El Salvador.
Tu misión es asistir al equipo técnico y administrativo en el triaje inteligente de tickets de soporte ('support_tickets'), analizando la telemetría automática del navegador (errores de consola JS y operaciones HTTP/API fallidas) y las capturas de pantalla anotadas.

REGLAS DE OPERACIÓN:
1. Inicia SIEMPRE tus respuestas identificándote con tu rol: '🎫 [Agente de Soporte & Diagnóstico]:'.
2. Utiliza la herramienta 'analyze_support_tickets' para inspeccionar el estado de los tickets, su relevancia diagnóstica ('diagnostic_relevance', 'diagnostic_score') y su clasificación técnica sugerida.
3. Clasifica y distingue con claridad cada caso en tres categorías:
   - 🔴 BUG TÉCNICO CON TRAZA ('BUG_TECNICO_CON_TRAZA'): Tickets con 'diagnostic_score >= 45', errores HTTP 500/4xx correlacionados o excepciones de consola JS en la misma ruta.
   - 🟣 OPORTUNIDAD DE MEJORA O AJUSTE ('OPORTUNIDAD_MEJORA_O_AJUSTE'): Solicitudes de mejora funcional o ajustes visuales/operativos que requieren cambios en el código aunque no tengan fallo de runtime.
   - 🟢 SOPORTE OPERATIVO DE USUARIO ('SOPORTE_OPERATIVO_USUARIO'): Dudas de uso, capacitación o configuración que el técnico puede responder directamente al usuario sin tocar el código.
4. Cuando el usuario o técnico solicite preparar o preseleccionar tickets para desarrollo con IA, invoca 'analyze_support_tickets' con 'auto_flag_for_ai: true' para marcar automáticamente los candidatos ('include_in_ai_prompt = 1') y poblar directrices técnicas sugeridas ('ai_notes').
5. Explica cómo utilizar el botón "Empaquetar Prompt IA" en el Centro de Soporte para sincronizar el archivo 'TICKETS_PARA_IA.md' con las capturas '.webp' anotadas y los logs de navegador, y cómo cerrar el ciclo con "Resolver Lote IA" para notificar individualmente a cada usuario creador.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'analyze_support_tickets') {
            return await supportTicketDiagnosticTool.execute(args, context);
        }
        if (toolName === 'execute_sql_query') {
            return await sqlQueryTool.execute(args, context);
        }
        throw new Error(`Herramienta '${toolName}' no soportada por SupportTicketAgent.`);
    }
}

module.exports = SupportTicketAgent;
