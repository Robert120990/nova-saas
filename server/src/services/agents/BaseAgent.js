const aiService = require('../ai.service');

/**
 * BaseAgent: Abstract class providing standard execution,
 * LLM invocation, tool execution, and error handling for all agents.
 */
class BaseAgent {
    constructor({ code, name, description, requiredPermission = null }) {
        this.code = code;
        this.name = name;
        this.description = description;
        this.requiredPermission = requiredPermission;
        this.tools = [];
    }

    /**
     * Register a tool definition in this agent.
     * @param {Object} tool
     */
    registerTool(tool) {
        if (!this.tools) this.tools = [];
        const def = tool?.definition || {
            name: tool?.name,
            description: tool?.description,
            parameters: tool?.parameters
        };
        this.tools.push(def);
    }

    /**
     * Get the specialized system prompt for this agent.
     * Subclasses must override this method.
     * @param {Object} _context { companyId, branchId, user, session }
     * @returns {string}
     */
    getSystemPrompt(_context) {
        throw new Error(`[BaseAgent] getSystemPrompt() must be implemented by ${this.constructor.name}`);
    }

    /**
     * Handle execution of a registered tool call.
     * Subclasses override this method to provide specific handlers.
     * @param {string} toolName
     * @param {Object} _args
     * @param {Object} _context
     * @returns {Promise<any>}
     */
    async executeTool(toolName, _args, _context) {
        throw new Error(`[BaseAgent] Tool '${toolName}' not implemented in ${this.constructor.name}`);
    }

    /**
     * Main execution entry point for the agent.
     * @param {Object} opts { messages: Array, context: Object }
     * @returns {Promise<{ content: string, toolResults?: Array, agentCode: string }>}
     */
    async execute({ messages, context }) {
        const systemPrompt = this.getSystemPrompt(context);
        const tools = this.tools || [];
        const maxTurns = 5;
        let turn = 0;
        let currentMessages = [...messages];
        const accumulatedToolResults = [];
        let lastProvider = 'deepseek';

        try {
            while (turn < maxTurns) {
                turn++;
                const { provider, data: response } = await aiService.getChatCompletion({
                    messages: currentMessages,
                    tools,
                    systemPrompt
                });
                lastProvider = provider || lastProvider;

                let toolCalls = response.tool_calls;

                // DSML fallback if model emitted DSML inside content
                if ((!toolCalls || toolCalls.length === 0) && response.content) {
                    const extracted = aiService.extractDsmlToolCalls(response.content);
                    if (extracted && extracted.length > 0) {
                        toolCalls = extracted;
                        response.tool_calls = extracted;
                        response.content = null;
                    }
                }

                // If no tools were called, the agent produced its final response
                if (!toolCalls || toolCalls.length === 0) {
                    const cleanContent = aiService.cleanDsmlContent(response.content || '');
                    return {
                        agentCode: this.code,
                        role: 'assistant',
                        content: cleanContent || 'Tarea completada exitosamente.',
                        toolResults: accumulatedToolResults
                    };
                }

                // Execute all requested tools in this turn
                const turnToolMessages = [];
                for (const call of toolCalls) {
                    const name = call.function.name;
                    let parsedArgs = {};
                    try {
                        parsedArgs = typeof call.function.arguments === 'string'
                            ? JSON.parse(call.function.arguments)
                            : (call.function.arguments || {});
                    } catch {
                        parsedArgs = {};
                    }

                    if (context?.onStepLog) {
                        await context.onStepLog(
                            this.code,
                            'tool_call',
                            `Ejecutando herramienta '${name}'...`,
                            { toolName: name, args: parsedArgs }
                        ).catch(() => {});
                    }

                    let executionResult;
                    try {
                        executionResult = await this.executeTool(name, parsedArgs, context);
                    } catch (toolError) {
                        console.error(`[${this.name}] Error executing tool '${name}':`, toolError.message);
                        executionResult = { error: toolError.message };
                    }

                    if (context?.onStepLog) {
                        const rowCount = executionResult?.rowCount ?? (Array.isArray(executionResult) ? executionResult.length : null);
                        await context.onStepLog(
                            this.code,
                            'tool_result',
                            rowCount !== null
                                ? `Herramienta '${name}' completada con ${rowCount} registros.`
                                : (executionResult?.error
                                    ? `Herramienta '${name}' finalizó con advertencia: ${executionResult.error}`
                                    : `Herramienta '${name}' ejecutada exitosamente.`),
                            { toolName: name, hasError: !!executionResult?.error }
                        ).catch(() => {});
                    }

                    const toolContentStr = typeof executionResult === 'string'
                        ? executionResult
                        : JSON.stringify(executionResult);

                    const toolMessage = {
                        tool_call_id: call.id,
                        role: 'tool',
                        name,
                        content: toolContentStr
                    };

                    turnToolMessages.push(toolMessage);
                    accumulatedToolResults.push(toolMessage);
                }

                // Append assistant message with tool calls AND all tool responses
                currentMessages.push({
                    role: 'assistant',
                    content: response.content || null,
                    tool_calls: response.tool_calls
                });
                for (const tm of turnToolMessages) {
                    currentMessages.push(tm);
                }
            }

            // If max turns reached, synthesize final response
            const finalResult = await aiService.getFinalResponse(lastProvider, {
                messages: currentMessages,
                systemPrompt,
                toolResults: accumulatedToolResults
            });

            return {
                agentCode: this.code,
                role: 'assistant',
                content: finalResult.content || '',
                toolResults: accumulatedToolResults
            };
        } catch (error) {
            console.error(`[${this.name}] Execution error:`, error.message);
            throw error;
        }
    }
}

module.exports = BaseAgent;
