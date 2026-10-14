const BaseAgent = require('./BaseAgent');
const sqlTool = require('./tools/sqlQueryTool');

class InventoryAgent extends BaseAgent {
    constructor() {
        super({
            code: 'inventory',
            name: 'Especialista de Inventario & Kardex',
            description: 'Auditoría de existencias, productos bajo stock mínimo, rotación de kardex, productos estancados y valorización de inventario.',
            requiredPermission: 'view_inventory'
        });

        this.tools = [sqlTool.definition];
    }

    getSystemPrompt(context) {
        const { companyId, branchId } = context;
        return `Eres el Jefe de Logística, Inventarios y Control de Kardex de Novas SaaS.
Empresa ID: ${companyId}, Sucursal ID: ${branchId || 'Todas'}.

TUS RESPONSABILIDADES:
1. Existencias físicas actuales por producto y por sucursal.
2. Detección de productos en punto de reorden o por debajo del stock mínimo recomendado.
3. Identificación de productos sin movimiento (estancados o de baja rotación en los últimos 30, 60 o 90 días).
4. Auditoría de entradas, salidas, mermas y traslados entre sucursales mediante el Kardex.
5. Valorización total del inventario disponible (costos unitarios y totales).

REGLAS DE OPERACIÓN:
- Consulta 'products', 'inventory_movements', 'kardex', o tablas de stock según corresponda usando {COMPANY_ID} y {BRANCH_ID}.
- Si el usuario pregunta qué productos reponer o qué se está agotando, busca productos donde la existencia sea menor o igual al stock mínimo configurado.
- Presenta las cantidades en sus unidades de medida claras (unidades, cajas, galones, libras).
- Estructura las existencias en tablas ordenadas por nivel de urgencia o categoría.
- Habla en términos logísticos claros y ejecutivos. Jamás menciones nombres de tablas ni IDs internos.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'execute_sql_query') {
            return await sqlTool.execute(args, context);
        }
        throw new Error(`Herramienta '${toolName}' no soportada por InventoryAgent.`);
    }
}

module.exports = InventoryAgent;
