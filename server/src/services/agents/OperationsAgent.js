const BaseAgent = require('./BaseAgent');
const { logAuditAction, updateAuditAction, getAuditAction } = require('./agentSessionService');

class OperationsAgent extends BaseAgent {
    constructor() {
        super({
            code: 'operations',
            name: 'Agente de Operaciones & Automatización',
            description: 'Gestor de acciones operativas aprobadas mediante Human-in-the-Loop y tareas automatizadas en segundo plano.',
            requiredPermission: null
        });

        this.tools = [
            {
                name: 'propose_action_for_approval',
                description: 'Registra una acción operativa delicada (ej. asentar partida contable, reaperturar turno, retransmitir DTE) para requerir confirmación del usuario antes de ejecutarla.',
                parameters: {
                    type: 'object',
                    properties: {
                        action_type: { type: 'string', description: 'Tipo de acción: post_system_entry, post_manual_entry, reopen_shift, retry_dte' },
                        description: { type: 'string', description: 'Resumen descriptivo de la acción para el usuario.' },
                        payload: { type: 'object', description: 'Parámetros necesarios para ejecutar la acción tras ser aprobada.' }
                    },
                    required: ['action_type', 'description', 'payload']
                }
            }
        ];
    }

    getSystemPrompt(context) {
        const { companyId, branchId } = context;
        return `Eres el Agente de Operaciones y Control de Ejecución (Human-in-the-Loop) de Novas SaaS.
Empresa ID: ${companyId}, Sucursal ID: ${branchId || 'Todas'}.

Tu función es garantizar que ninguna acción de mutación o modificación delicada se aplique al sistema sin la confirmación explícita del usuario responsable.
Cuando un usuario proponga o solicite una acción crítica, registra la propuesta mediante 'propose_action_for_approval' para que el sistema presente los botones interactivos de aprobación correspondientes en Telegram o Web.`;
    }

    async executeTool(toolName, args, context) {
        if (toolName === 'propose_action_for_approval') {
            const auditId = await logAuditAction({
                sessionId: context.session?.id || null,
                companyId: context.companyId,
                branchId: context.branchId || null,
                agentCode: args.agent_code || this.code,
                actionType: args.action_type,
                description: args.description,
                payload: args.payload,
                status: 'pending_approval'
            });

            return {
                status: 'pending_approval',
                audit_id: auditId,
                message: `Acción registrada para confirmación: ${args.description}. ID de auditoría: #${auditId}.`
            };
        }

        throw new Error(`Herramienta '${toolName}' no soportada por OperationsAgent.`);
    }

    /**
     * Executes an action that was previously approved by the user (HitL callback)
     */
    async executeApprovedAction(auditId, user, channel = 'telegram') {
        const audit = await getAuditAction(auditId);
        if (!audit) throw new Error(`Registro de auditoría #${auditId} no encontrado.`);
        if (audit.status === 'executed') throw new Error(`La acción #${auditId} ya fue ejecutada previamente.`);
        if (audit.status === 'rejected') throw new Error(`La acción #${auditId} fue rechazada.`);

        let result = null;
        try {
            if (audit.action_type === 'post_system_entry') {
                const systemTool = require('./tools/accountingSystemEntriesTool');
                result = await systemTool.executeCreate(audit.payload, {
                    companyId: audit.company_id,
                    branchId: audit.branch_id,
                    user
                });
            } else if (audit.action_type === 'post_manual_entry') {
                const manualTool = require('./tools/accountingManualEntriesTool');
                result = await manualTool.executeCreate(audit.payload, {
                    companyId: audit.company_id,
                    branchId: audit.branch_id,
                    user
                });
            } else {
                throw new Error(`Tipo de acción '${audit.action_type}' no soportada para ejecución.`);
            }

            await updateAuditAction(auditId, {
                status: 'executed',
                approvedByUserId: user?.id || null,
                approvedVia: channel,
                executionResult: result
            });

            return { success: true, result };
        } catch (error) {
            await updateAuditAction(auditId, {
                status: 'failed',
                approvedByUserId: user?.id || null,
                approvedVia: channel,
                executionResult: { error: error.message }
            });
            throw error;
        }
    }
}

module.exports = OperationsAgent;
