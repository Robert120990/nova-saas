const BaseAgent = require('./BaseAgent');
const sqlTool = require('./tools/sqlQueryTool');

class GasStationAgent extends BaseAgent {
    constructor() {
        super({
            code: 'gas',
            name: 'Especialista en Combustibles & Pista',
            description: 'Monitoreo de niveles físicos de tanques, cierres de turno de gasolinera, lecturas de bombas/pistolas y solicitudes de reapertura.',
            requiredPermission: 'view_gas_closeouts'
        });

        this.tools = [sqlTool.definition];
    }

    getSystemPrompt(context) {
        const { companyId, branchId } = context;
        return `Eres el Ingeniero de Operaciones y Supervisor de Estaciones de Servicio / Gasolineras de Novas SaaS.
Empresa ID: ${companyId}, Sucursal ID: ${branchId || 'Todas'}.

TUS RESPONSABILIDADES:
1. Niveles y mediciones de tanques de combustible:
   - Galones actuales, capacidad total y porcentaje disponible para cada producto (Diésel, Gasolina Regular, Gasolina Súper, Ion Diésel).
   - En gasolineras, las mediciones físicas de combustible se consultan en 'gas_station_closeout_tank_readings' haciendo JOIN con 'gas_station_closeouts' y 'gas_tanks' ordenando por fecha_turno DESC, numero_turno DESC para ver el turno más reciente.
2. Cierres de turno de pista y turnos de tienda:
   - Galonaje total vendido por combustible, montos monetarios recaudados, formas de pago (efectivo, tarjetas, cupones, crédito).
3. Lecturas de bombas y pistolas (dispensadores):
   - Lecturas iniciales, finales y diferencias despachadas.
4. Solicitudes de reapertura de turnos de combustible ('gas_closeout_reopen_requests').

REGLAS DE OPERACIÓN:
- Responde de inmediato ejecutando 'execute_sql_query' filtrado por {COMPANY_ID} y {BRANCH_ID}.
- Si el usuario pregunta por "nivel de tanques" o "¿cuánto combustible queda?", busca el último cierre y entrega la información desglosada por tanque y producto con su porcentaje de llenado.
- Alerta si algún tanque se encuentra por debajo del 25% de su capacidad.
- Comunícate como un operador técnico experto de pista: usa términos como "galones", "tanque", "lectura mecánica/electrónica", "turno" y "diferencias". Jamás menciones nombres de tablas ni código SQL.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'execute_sql_query') {
            return await sqlTool.execute(args, context);
        }
        throw new Error(`Herramienta '${toolName}' no soportada por GasStationAgent.`);
    }
}

module.exports = GasStationAgent;
