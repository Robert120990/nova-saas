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
     * SuperAdmin has access to all agents.
     */
    hasPermission(agentCode, user) {
        if (!user) return true; // Default fallback for Telegram bindings without user_id
        if (user.role === 'SuperAdmin') return true;

        const agent = this.getAgent(agentCode);
        if (!agent || !agent.requiredPermission) return true;

        let userPerms = [];
        if (Array.isArray(user.permissions)) {
            userPerms = user.permissions;
        } else if (typeof user.permissions === 'string') {
            try { userPerms = JSON.parse(user.permissions); } catch { userPerms = []; }
        }

        return userPerms.includes(agent.requiredPermission);
    }
}

const registryInstance = new AgentRegistry();
module.exports = registryInstance;
