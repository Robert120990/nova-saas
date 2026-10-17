const BaseAgent = require('./BaseAgent');
const agentRegistry = require('./agentRegistry');

class SupervisorAgent extends BaseAgent {
    constructor() {
        super({
            code: 'supervisor',
            name: 'Supervisor de Inteligencia de Negocios',
            description: 'Orquestador central que clasifica peticiones, verifica permisos y delega tareas a agentes especializados.',
            requiredPermission: null
        });

        this.tools = [
            {
                name: 'delegate_to_agent',
                description: 'Delega una tarea o consulta a un agente especializado con el rol adecuado.',
                parameters: {
                    type: 'object',
                    properties: {
                        target_agent_code: {
                            type: 'string',
                            enum: ['accounting', 'dte', 'sales', 'inventory', 'gas', 'operations', 'tech', 'support'],
                            description: 'Código del agente especialista: accounting (Contador CPA), dte (Fiscal DTE), sales (Ventas), inventory (Inventario/Kardex), gas (Combustibles/Tanques), operations (Operaciones), tech (Técnico SysAdmin/Servidor), support (Tickets de Soporte & Diagnóstico).'
                        },
                        subtask_prompt: {
                            type: 'string',
                            description: 'La instrucción o pregunta detallada y clara que el agente especialista debe resolver.'
                        }
                    },
                    required: ['target_agent_code', 'subtask_prompt']
                }
            }
        ];
    }

    getSystemPrompt(context) {
        const { companyId, branchId, user } = context;
        const availableAgents = agentRegistry.getAllAgents();
        const agentsDesc = availableAgents
            .map(a => `- [${a.code}] ${a.name}: ${a.description}`)
            .join('\n');

        return `Eres el Agente Supervisor y Orquestador de Inteligencia de Negocios de Novas SaaS en El Salvador.
Empresa ID: ${companyId}, Sucursal ID: ${branchId || 'Todas'}. Usuario: ${user?.nombre || 'Operador'}.

AGENTES ESPECIALISTAS DISPONIBLES:
${agentsDesc}

REGLAS DE ENCAMINAMIENTO (ROUTING):
1. CONTABILIDAD Y PARTIDAS ('accounting'):
   - Peticiones para generar o revisar partidas de ventas, compras, cobranzas (cxc), pagos (cxp), ajustes, depreciaciones, cuentas de catálogo o principio de partida doble. Delega SIEMPRE a 'accounting'.
2. FACTURACIÓN ELECTRÓNICA Y DTE ('dte'):
   - Dudas de normativa SVFE de El Salvador, plazos de anulación/invalidación (10 días hábiles vs 3 meses), eventos de contingencia (plazo de 24 horas), diagnósticos de rechazos de Hacienda o estados técnicos de transmisión de DTEs en tabla 'dtes'. Delega a 'dte'.
3. VENTAS Y COMERCIAL ('sales'):
   - Consultas de cifras de ventas, facturación, ticket promedio, arqueos de caja / turnos POS ('pos_shifts'), cuadros comparativos diarios entre arqueos y DTEs emitidos, ventas por producto/cliente o clientes con saldo. Delega SIEMPRE a 'sales'.
4. INVENTARIO Y KARDEX ('inventory'):
   - Existencias de productos, stock bajo, productos estancados o valorización de inventario. Delega a 'inventory'.
5. COMBUSTIBLES Y PISTA ('gas'):
   - Niveles físicos de tanques, galones de combustible, cierres de turno de pista de gasolinera ('gas_station_closeouts') o bombas. Delega a 'gas'.
6. OPERACIONES Y ACCIONES ('operations'):
   - Confirmación o ejecución de tareas operativas delicadas.
7. SALUD DEL SISTEMA Y SERVIDOR ('tech'):
   - Consultas de rendimiento del servidor, CPU, memoria RAM, almacenamiento en disco, salud de la base de datos MySQL, lentitud, latencia o disponibilidad del microservicio DTE. Delega a 'tech'.
8. TICKETS DE SOPORTE, DIAGNÓSTICO DE ERRORES DE USUARIO Y PAQUETES IA ('support'):
   - Consultas sobre tickets de soporte ('support_tickets'), errores reportados por usuarios, capturas de pantalla, logs de navegador/red en tickets o preparación del paquete de tickets para IA. Delega SIEMPRE a 'support'.

REGLA DE IDENTIFICACIÓN OBLIGATORIA:
- Cuando recibas el resultado del agente especialista, presenta la respuesta iniciando con su distintivo formal, por ejemplo:
  '**[⚖️ Agente Contador CPA]:**' o '**[⛽ Agente de Combustibles & Pistas]:**' o '**[🛠️ Agente Técnico & SysAdmin]:**' o '**[📈 Agente Comercial]:**' o '**[🎫 Agente de Soporte & Diagnóstico]:**'.
- De esta manera el usuario sabrá de inmediato y sin ambigüedades qué especialista lo atendió.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'delegate_to_agent') {
            const { target_agent_code, subtask_prompt } = args;

            // Verificar permiso RBAC
            if (!agentRegistry.hasPermission(target_agent_code, context.user)) {
                return {
                    error: `Acceso restringido: El usuario no cuenta con el permiso requerido para interactuar con el agente '${target_agent_code}'.`
                };
            }

            const targetAgent = agentRegistry.getAgent(target_agent_code);
            if (!targetAgent) {
                return { error: `Agente con código '${target_agent_code}' no existe en el sistema.` };
            }

            console.log(`[Supervisor] Delegando a '${targetAgent.name}' (${target_agent_code})...`);

            const isAutonomous = !!context?.user?.is_system_task;
            const promptForSubagent = isAutonomous
                ? `[MODO AUTÓNOMO EN SEGUNDO PLANO - EJECUTA TODAS LAS CONSULTAS SQL Y HERRAMIENTAS DIRECTAMENTE HASTA OBTENER LAS CIFRAS DEFINITIVAS SIN PEDIR CONFIRMACIÓN]:\n${subtask_prompt}`
                : subtask_prompt;

            const subagentResult = await targetAgent.execute({
                messages: [{ role: 'user', content: promptForSubagent }],
                context: {
                    ...context,
                    userQuery: subtask_prompt
                }
            });

            if (context) {
                context._delegatedAgent = targetAgent;
                context._delegatedToolResults = subagentResult.toolResults || [];
            }

            return {
                status: 'success',
                delegated_to: targetAgent.name,
                agent_code: target_agent_code,
                findings: subagentResult.content,
                tool_results: subagentResult.toolResults || []
            };
        }

        throw new Error(`Herramienta '${toolName}' no soportada por SupervisorAgent.`);
    }

    async execute(params) {
        const result = await super.execute(params);
        if (params?.context?._delegatedAgent) {
            result.agentCode = params.context._delegatedAgent.code;
            result.agentName = params.context._delegatedAgent.name;
        }
        if (params?.context?._delegatedToolResults?.length > 0) {
            result.toolResults = [
                ...(result.toolResults || []),
                ...params.context._delegatedToolResults
            ];
        }
        return result;
    }

    /**
     * High-level entry point handling multi-turn sessions and routing
     */
    async handleUserMessage({ text, session, user }) {
        const context = {
            companyId: session.company_id,
            branchId: session.branch_id,
            user,
            session
        };

        const result = await this.execute({
            messages: [{ role: 'user', content: text }],
            context
        });

        if (context._delegatedAgent) {
            result.agentCode = context._delegatedAgent.code;
            result.agentName = context._delegatedAgent.name;
        }

        return result;
    }
}

const supervisorInstance = new SupervisorAgent();
module.exports = supervisorInstance;
