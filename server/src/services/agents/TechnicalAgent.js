const BaseAgent = require('./BaseAgent');
const systemHealthTool = require('./tools/systemHealthTool');
const sqlQueryTool = require('./tools/sqlQueryTool');

/**
 * Technical / DevOps Agent
 * Monitoreo de salud del sistema, servidor, MySQL, RAM, CPU, disco y DTE API.
 */
class TechnicalAgent extends BaseAgent {
    constructor() {
        super({
            code: 'tech',
            name: 'Agente Técnico & SysAdmin',
            description: 'Monitoreo de salud del servidor, uso de CPU, memoria RAM, almacenamiento en disco, base de datos MySQL, latencia y disponibilidad del microservicio DTE.',
            requiredPermission: 'manage_system_settings'
        });

        this.registerTool(systemHealthTool);
        this.registerTool(sqlQueryTool);
    }

    getSystemPrompt(_context) {
        return `Eres el Agente Técnico & SysAdmin de Novas SaaS en El Salvador.
Tu responsabilidad es auditar y diagnosticar el estado del servidor, los procesos de Node.js, el pool de conexiones MySQL, el almacenamiento en disco y la disponibilidad del microservicio DTE (puerto 5000).

REGLAS DE OPERACIÓN:
1. Utiliza SIEMPRE la herramienta 'get_system_health' para obtener métricas reales de hardware, sistema operativo, base de datos y latencia.
2. Presenta el diagnóstico estructurado usando semáforos claros:
   - 🟢 Óptimo: Uso de recursos < 75%, latencia BD < 50ms, servicios online.
   - 🟡 Advertencia: Uso de RAM o Disco entre 75% y 89%, o presencia de slow queries.
   - 🔴 Crítico: Disco o RAM >= 90%, caída de base de datos o DTE API fuera de línea.
3. Formatea la respuesta con tablas claras para RAM, Almacenamiento, Conexiones activas de MySQL y tiempos de actividad (Uptime).
4. Si detectas saturación de recursos, brinda recomendaciones preventivas específicas (por ejemplo, depuración de logs o optimización de tablas).
5. Inicia siempre identificándote con tu rol: '🛠️ [Agente Técnico & SysAdmin]:'.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'get_system_health') {
            return await systemHealthTool.execute();
        }
        if (toolName === 'execute_sql_query') {
            return await sqlQueryTool.execute(args, context);
        }
        throw new Error(`Herramienta '${toolName}' no soportada por TechnicalAgent.`);
    }
}

module.exports = TechnicalAgent;
