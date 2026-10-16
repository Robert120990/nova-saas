const AccountingAgent = require('./AccountingAgent');
const FiscalDteAgent = require('./FiscalDteAgent');
const SalesAgent = require('./SalesAgent');
const InventoryAgent = require('./InventoryAgent');
const GasStationAgent = require('./GasStationAgent');
const OperationsAgent = require('./OperationsAgent');
const TechnicalAgent = require('./TechnicalAgent');

/**
 * Registry holding singleton instances of specialized agents.
 */
class AgentRegistry {
    constructor() {
        this.agents = new Map();
        this.initAgents();
    }

    initAgents() {
        const accounting = new AccountingAgent();
        const dte = new FiscalDteAgent();
        const sales = new SalesAgent();
        const inventory = new InventoryAgent();
        const gas = new GasStationAgent();
        const operations = new OperationsAgent();
        const tech = new TechnicalAgent();

        this.register(accounting);
        this.register(dte);
        this.register(sales);
        this.register(inventory);
        this.register(gas);
        this.register(operations);
        this.register(tech);
    }

    register(agent) {
        this.agents.set(agent.code, agent);
    }

    getAgent(code) {
        if (code === 'technical') {
            return this.agents.get('technical') || this.agents.get('tech') || null;
        }
        return this.agents.get(code) || null;
    }

    getAllAgents() {
        return Array.from(this.agents.values()).map(a => ({
            code: a.code,
            name: a.name,
            description: a.description,
            requiredPermission: a.requiredPermission
        }));
    }

    /**
     * Checks if a user has permission to interact with a specific agent.
     * Supports both (user, agentCode) and (agentCode, user) signatures.
     */
    canUserAccessAgent(userOrCode, codeOrUser) {
        let user = userOrCode;
        let agentCode = codeOrUser;
        if (typeof userOrCode === 'string') {
            agentCode = userOrCode;
            user = codeOrUser;
        }

        if (!user || typeof user !== 'object') return false;

        const agent = this.getAgent(agentCode);
        if (!agent) return false;

        let userPerms = [];
        if (Array.isArray(user.permissions)) {
            userPerms = user.permissions;
        } else if (typeof user.permissions === 'string') {
            try { userPerms = JSON.parse(user.permissions); } catch { userPerms = []; }
        }

        // Strict restriction for TechnicalAgent ('tech' / 'technical')
        if (agent.code === 'technical' || agent.code === 'tech' || agentCode === 'technical' || agentCode === 'tech') {
            if (Array.isArray(user.allowed_agents)) {
                const allowedInList = user.allowed_agents.includes(agent.code) ||
                    user.allowed_agents.includes('technical') ||
                    user.allowed_agents.includes('tech') ||
                    user.allowed_agents.includes('all');
                if (!allowedInList) return false;
            }
            return user.role === 'SuperAdmin' || userPerms.includes('manage_server_terminal');
        }

        // Evaluate explicit allowed_agents list FIRST (before checking user.role === 'Admin')
        if (Array.isArray(user.allowed_agents)) {
            return user.allowed_agents.includes(agent.code) || user.allowed_agents.includes('all');
        }

        if (user.role === 'SuperAdmin' || user.role === 'Admin' || user.is_system_task) return true;

        if (!agent.requiredPermission) return true;

        return userPerms.includes(agent.requiredPermission);
    }

    hasPermission(agentCode, user) {
        return this.canUserAccessAgent(user, agentCode);
    }
}

const registryInstance = new AgentRegistry();
module.exports = registryInstance;

