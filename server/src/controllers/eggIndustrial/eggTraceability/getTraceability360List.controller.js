const execute = require('../../../services/eggIndustrial/eggTraceability/getTraceability360List.service');
async function getTraceability360List(req, res) {
    const result = await execute(req);
    for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
    return res.status(result.status).send(result.body);
}
module.exports = { getTraceability360List };
