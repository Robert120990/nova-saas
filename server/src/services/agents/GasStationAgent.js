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
   - En gasolineras, las mediciones físicas de combustible se consultan en 'gas_station_closeout_tank_readings' haciendo JOIN con 'gas_station_closeouts' (c.id = r.closeout_id) y 'gas_station_tanks' (t.id = r.tank_id) ordenando por fecha_turno DESC, numero_turno DESC para ver el turno más reciente.
   - También puedes consultar la tabla 'gas_station_tanks' haciendo JOIN con 'branches' para conocer la lista de tanques registrados, su capacidad y tipo de combustible.
2. Cierres de turno de pista y turnos de tienda:
   - Galonaje total vendido por combustible, montos monetarios recaudados, formas de pago (efectivo, tarjetas, cupones, crédito).
3. Lecturas de bombas y pistolas (dispensadores):
   - Lecturas iniciales, finales y diferencias despachadas.
4. Solicitudes de reapertura de turnos de combustible ('gas_closeout_reopen_requests').

REGLAS DE OPERACIÓN:
- Responde de inmediato ejecutando 'execute_sql_query' filtrado por {COMPANY_ID} y {BRANCH_ID}.
- CONSULTA DE NIVELES DE TANQUE:
  Para consultar las lecturas y niveles más recientes, ejecuta:
  SELECT b.nombre AS sucursal, t.codigo, t.descripcion AS tanque, t.tipo_combustible, t.capacidad, r.lectura_actual AS galones_actuales, ROUND((r.lectura_actual / NULLIF(t.capacidad, 0)) * 100, 1) AS porcentaje_llenado, c.fecha_turno, c.numero_turno
  FROM gas_station_closeout_tank_readings r
  JOIN gas_station_closeouts c ON c.id = r.closeout_id
  JOIN gas_station_tanks t ON t.id = r.tank_id
  JOIN branches b ON b.id = c.branch_id
  WHERE c.company_id = {COMPANY_ID}
  ORDER BY c.fecha_turno DESC, c.numero_turno DESC
  LIMIT 50;
- Si no hay lecturas de cierres registradas, consulta directamente 'gas_station_tanks' con JOIN a 'branches' para mostrar los tanques y capacidades instaladas.
- IMPORTANTE MYSQL: NUNCA generes subconsultas con 'IN (SELECT ... LIMIT N)' ya que MySQL no las soporta; usa JOINs directos.
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
