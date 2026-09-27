const execute = require('../../../services/eggIndustrial/eggPlanning/getMonthlyProductionSuggestions.service');
async function getMonthlyProductionSuggestions(req, res) {
    const result = await execute(req);
    for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
    return res.status(result.status).send(result.body);
}
module.exports = { getMonthlyProductionSuggestions };
