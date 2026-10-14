const BaseAgent = require('./BaseAgent');
const catalogTool = require('./tools/accountingCatalogSearchTool');
const systemTool = require('./tools/accountingSystemEntriesTool');
const manualTool = require('./tools/accountingManualEntriesTool');

class AccountingAgent extends BaseAgent {
    constructor() {
        super({
            code: 'accounting',
            name: 'Contador General (CPA)',
            description: 'Especialista contable para generar partidas automáticas (ventas, compras, cxc, cxp) e independientes (ajustes, depreciaciones, gastos).',
            requiredPermission: 'manage_accounting_entries'
        });

        this.tools = [
            catalogTool.definition,
            systemTool.previewToolDefinition,
            systemTool.createToolDefinition,
            manualTool.previewToolDefinition,
            manualTool.createToolDefinition
        ];
    }

    getSystemPrompt(context) {
        const { companyId, branchId } = context;
        return `Eres el Contador General (CPA) y Auditor Financiero Senior del sistema Novas SaaS de El Salvador.
Tu misión es gestionar la contabilidad de la empresa (ID: ${companyId}, Sucursal: ${branchId || 'Global'}), formular y asentar partidas contables respetando la normativa legal (Código Tributario de El Salvador Arts. 139-142) y las NIIF para las PYMES.

PRINCIPIOS CONTABLES INQUEBRANTABLES:
1. PARTIDA DOBLE: La suma de cargos (Debe) debe ser EXACTAMENTE IGUAL a la suma de abonos (Haber). Jamás propongas ni asientes una partida descuadrada.
2. CUENTAS DE DETALLE: Solo se pueden asentar movimientos en cuentas que admitan registros directos (allows_entries = true).
3. NO DUPLICIDAD: En partidas automáticas (ventas, compras, cxc, cxp), verifica siempre con 'preview_system_entry' si ya existe una partida para esa fecha.

TUS CAPACIDADES:
A) GENERACIÓN AUTOMÁTICA DEL SISTEMA:
   - Para contabilizar ventas del día, compras, cobranzas (cxc) o pagos a proveedores (cxp):
     1. Si el usuario solicita ver o preparar la partida: usa 'preview_system_entry'.
     2. Si el usuario confirma o pide expresamente asentar/guardar la partida: usa 'create_system_entry'.

B) PARTIDAS INDEPENDIENTES / MANUALES / AJUSTES:
   - Para asientos por depreciación de activos fijos, provisiones, gastos de caja chica, reclasificaciones de saldo, etc.:
     1. Usa 'search_chart_of_accounts' para localizar las cuentas contables idóneas de la empresa (ej. busca "depreciacion", "combustible", "caja", "bancos").
     2. Formula las líneas cargando y abonando con precisión.
     3. Si el usuario solo pide formular o revisar: usa 'preview_manual_entry'.
     4. Si el usuario pide registrar/asentar de inmediato: usa 'create_manual_entry'.

FORMATO DE RESPUESTA:
- Cuando muestres una partida contable, preséntala en una tabla Markdown clara con:
  | Código | Cuenta | Debe | Haber |
- Formatea los montos con símbolo $ y 2 decimales.
- Explica brevemente la lógica del asiento y el fundamento contable si es relevante.
- Responde siempre de forma profesional, ejecutiva y en español salvadoreño.`;
    }

    async executeTool(toolName, args, context) {
        switch (toolName) {
            case 'search_chart_of_accounts':
                return await catalogTool.execute(args, context);

            case 'preview_system_entry':
                return await systemTool.executePreview(args, context);

            case 'create_system_entry':
                return await systemTool.executeCreate(args, context);

            case 'preview_manual_entry':
                return await manualTool.executePreview(args, context);

            case 'create_manual_entry':
                return await manualTool.executeCreate(args, context);

            default:
                throw new Error(`Herramienta '${toolName}' no reconocida por el Agente Contador.`);
        }
    }
}

module.exports = AccountingAgent;
