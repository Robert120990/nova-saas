const BaseAgent = require('./BaseAgent');
const sqlTool = require('./tools/sqlQueryTool');
const aiService = require('../ai.service');
const { searchRelevantKnowledge } = require('../ai/knowledgeSearchService');

class FiscalDteAgent extends BaseAgent {
    constructor() {
        super({
            code: 'dte',
            name: 'Especialista Fiscal & DTE',
            description: 'Experto en Documentos Tributarios Electrónicos (DTE), normativa SVFE de El Salvador, plazos de anulación, contingencia y diagnósticos MH.',
            requiredPermission: 'view_sales_dte'
        });

        this.tools = [
            sqlTool.definition,
            {
                name: 'diagnose_mh_rejection',
                description: 'Diagnostica un código o mensaje de rechazo emitido por el Ministerio de Hacienda para un DTE y sugiere los pasos exactos de corrección.',
                parameters: {
                    type: 'object',
                    properties: {
                        error_message: { type: 'string', description: 'Mensaje o código de error devuelto por Hacienda.' },
                        tipo_dte: { type: 'string', description: 'Tipo de DTE (01 Factura, 03 Crédito Fiscal, etc.)' }
                    },
                    required: ['error_message']
                }
            }
        ];
    }

    getSystemPrompt(context) {
        const { companyId, branchId, userQuery } = context;

        let dynamicRag = '';
        if (userQuery) {
            const docs = searchRelevantKnowledge(userQuery, { limit: 2, minScore: 8 });
            if (docs.length > 0) {
                dynamicRag = `\nDOCUMENTACIÓN OFICIAL RECUPERADA (MINISTERIO DE HACIENDA):\n` +
                    docs.map(d => `[${d.documento} - Pág ${d.pagina}]: ${d.contenido}`).join('\n\n');
            }
        }

        return `Eres el Especialista Fiscal y Auditor Tributario Senior en Facturación Electrónica (SVFE / DTE) de El Salvador para Novas SaaS.
Empresa ID: ${companyId}, Sucursal ID: ${branchId || 'Todas'}.

CONOCIMIENTO NORMATIVO CLAVE:
1. CATÁLOGO CAT-002:
   - 01: Factura Electrónica (Consumidor Final). Plazo de anulación: HASTA 3 MESES.
   - 03: Comprobante de Crédito Fiscal (CCF - entre contribuyentes). Plazo de anulación: HASTA EL 10° DÍA HÁBIL DEL MES SIGUIENTE.
   - 04: Nota de Remisión.
   - 05: Nota de Crédito (ajustes a CCF o cuando vence el plazo de invalidación).
   - 14: Factura Sujeto Excluido. Plazo de anulación: HASTA 3 MESES.
2. EVENTO DE CONTINGENCIA:
   - Plazo legal estricto: HASTA 24 HORAS tras restablecerse el servicio o cesar la causa de fuerza mayor.
   - Modelo de Facturación: 2 (Diferido), Tipo Transmisión: 2 (Contingencia).
3. CONSULTAS DE ESTADO:
   - Usa 'execute_sql_query' para consultar la tabla 'dtes' haciendo JOIN con 'sales_headers' filtrando por {COMPANY_ID}.
   - NUNCA expongas nombres de tablas o columnas técnicas en tu respuesta final. Habla de Documentos, Fechas, Códigos de Generación, Sellos y Estados (Aceptado, Rechazado, Contingencia).
${dynamicRag}

Responde de forma ejecutiva, formal y con exactitud jurídica en español salvadoreño.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'execute_sql_query') {
            return await sqlTool.execute(args, context);
        }
        if (toolName === 'diagnose_mh_rejection') {
            const diag = await aiService.diagnoseDteError({
                errorData: args.error_message,
                dteInfo: { tipo_documento: args.tipo_dte }
            });
            return diag.data;
        }
        throw new Error(`Herramienta '${toolName}' no reconocida por FiscalDteAgent.`);
    }
}

module.exports = FiscalDteAgent;
