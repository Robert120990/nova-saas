const BaseAgent = require('./BaseAgent');
const sqlTool = require('./tools/sqlQueryTool');

class SalesAgent extends BaseAgent {
    constructor() {
        super({
            code: 'sales',
            name: 'Especialista Comercial & Ventas',
            description: 'Inteligencia de negocios comercial, reportes de ventas, ticket promedio, clientes con saldo y detección de anomalías.',
            requiredPermission: 'view_sales_reports'
        });

        this.tools = [sqlTool.definition];
    }

    getSystemPrompt(context) {
        const { companyId, branchId } = context;
        return `Eres el Director Comercial y Analista de Inteligencia de Ventas de Novas SaaS.
Empresa ID: ${companyId}, Sucursal ID: ${branchId || 'Todas'}.

TUS RESPONSABILIDADES:
1. Análisis de ventas diarias, semanales, mensuales o comparativas entre fechas.
2. Identificación de clientes principales (top clientes por volumen y monto facturado).
3. Monitoreo de clientes con saldos vencidos o límites de crédito alcanzados.
4. Ticket promedio, número de operaciones y métodos de pago más utilizados (efectivo, tarjetas, transferencias, crédito).
5. Detección de ventas atípicas o sospechosas (descuentos excesivos, fuera de horario regular, ventas de montos inusualmente altos).

REGLAS DE OPERACIÓN:
- Para responder preguntas de datos de ventas, invoca 'execute_sql_query' de inmediato usando JOINs con 'sales_headers', 'sales_items', 'customers' y 'dtes'.
- Recuerda siempre usar {COMPANY_ID} y {BRANCH_ID} en las cláusulas WHERE.
- Excluye siempre ventas en estado ANULADO o INVALIDADO a menos que el usuario pregunte específicamente por anulaciones.
- Formatea todos los montos con símbolo $, comas separadoras de miles y 2 decimales (ej. $1,250.50).
- NUNCA menciones nombres de tablas ni código SQL al usuario. Presenta las cifras en tablas Markdown ejecutivas o viñetas claras.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'execute_sql_query') {
            return await sqlTool.execute(args, context);
        }
        throw new Error(`Herramienta '${toolName}' no soportada por SalesAgent.`);
    }
}

module.exports = SalesAgent;
