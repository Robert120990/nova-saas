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

        try {
            const { provider, data: firstResponse } = await aiService.getChatCompletion({
                messages,
                tools,
                systemPrompt
            });

            let toolCalls = firstResponse.tool_calls;

            // DSML fallback if model emitted DSML inside content
            if ((!toolCalls || toolCalls.length === 0) && firstResponse.content) {
                const extracted = aiService.extractDsmlToolCalls(firstResponse.content);
                if (extracted && extracted.length > 0) {
                    toolCalls = extracted;
                    firstResponse.tool_calls = extracted;
                    firstResponse.content = null;
                }
            }

            // If no tools were called, return clean direct content
            if (!toolCalls || toolCalls.length === 0) {
                const cleanContent = aiService.cleanDsmlContent(firstResponse.content || '');
                return {
                    agentCode: this.code,
                    role: 'assistant',
                    content: cleanContent || 'Entendido. ¿En qué más puedo ayudarte?'
                };
            }

            // Execute all requested tools
            const toolResults = [];
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

                let executionResult;
                try {
                    executionResult = await this.executeTool(name, parsedArgs, context);
                } catch (toolError) {
                    console.error(`[${this.name}] Error executing tool '${name}':`, toolError.message);
                    executionResult = { error: toolError.message };
                }

                toolResults.push({
                    tool_call_id: call.id,
                    role: 'tool',
                    name,
                    content: typeof executionResult === 'string' ? executionResult : JSON.stringify(executionResult)
                });
            }

            // Request final synthesis from LLM based on tool results
            const finalResult = await aiService.getFinalResponse(provider, {
                messages: [...messages, firstResponse],
                systemPrompt,
                toolResults
            });

            return {
                agentCode: this.code,
                role: 'assistant',
                content: finalResult.content || '',
                toolResults
            };
        } catch (error) {
            console.error(`[${this.name}] Execution error:`, error.message);
            throw error;
        }
    }
}

module.exports = BaseAgent;
