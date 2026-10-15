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
- Para responder preguntas de datos de ventas y comparativas, invoca 'execute_sql_query' de inmediato usando JOINs con:
  * 'sales_headers': Ventas y DTEs (id, fecha_emision, total_pagar, estado, shift_id, tipo_documento, numero_control, codigo_generacion, company_id, branch_id).
  * 'pos_shifts': Turnos y arqueos de caja (id, shift_date, start_time, end_time, total_sales, cash_sales, card_sales, actual_cash, expected_cash, difference, status, arqueado, company_id, branch_id, pos_id).
  * 'points_of_sale': Cajas y puntos de venta (id, nombre, company_id, branch_id).
  * 'sales_items': Detalle de productos vendidos.
  * 'customers': Clientes.
- Recuerda siempre usar {COMPANY_ID} y {BRANCH_ID} en las cláusulas WHERE.
- Excluye siempre ventas en estado ANULADO o INVALIDADO a menos que el usuario pregunte específicamente por anulaciones.
- DIFERENCIACIÓN TIENDA VS PISTA EN GASOLINERAS:
  En 'points_of_sale', los puntos de venta se identifican por nombre (ej. 'Tienda 1', 'Tienda 2', 'PISTA 1', etc.).
  Si la consulta solicita 'tienda', haz JOIN con 'points_of_sale' y filtra por pos.nombre LIKE '%Tienda%' (o excluye '%Pista%').
- COMPARATIVO ARQUEOS VS DTES POR DÍA:
  Para cuadros comparativos por día entre arqueos y DTEs:
  1) Ejecuta una consulta de arqueos agrupada por 'shift_date':
     SELECT p.shift_date as fecha, SUM(p.total_sales) as total_arqueo, COUNT(p.id) as turnos
     FROM pos_shifts p
     JOIN points_of_sale pos ON p.pos_id = pos.id
     WHERE p.company_id = {COMPANY_ID} AND p.branch_id = {BRANCH_ID}
       AND p.shift_date BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-31'
       AND pos.nombre LIKE '%Tienda%'
     GROUP BY p.shift_date ORDER BY p.shift_date;
  2) Ejecuta una consulta de ventas/DTEs agrupada por DATE(s.fecha_emision):
     SELECT DATE(s.fecha_emision) as fecha, SUM(s.total_pagar) as total_dte, COUNT(s.id) as cantidad_dtes
     FROM sales_headers s
     JOIN points_of_sale pos ON s.pos_id = pos.id
     WHERE s.company_id = {COMPANY_ID} AND s.branch_id = {BRANCH_ID}
       AND s.fecha_emision BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-31'
       AND s.estado NOT IN ('ANULADO', 'INVALIDADO')
       AND pos.nombre LIKE '%Tienda%'
     GROUP BY DATE(s.fecha_emision) ORDER BY fecha;
  3) Une los datos día a día, calcula la diferencia (Arqueo - DTE) y presenta la tabla Markdown completa día por día con los totales del mes y estado de conciliación.
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
