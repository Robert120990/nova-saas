const execute = require('../../services/eggIndustrial/eggDispatch/autoInvoiceDispatchRoute.service');
async function autoInvoiceDispatchRoute(req, res) {
    const result = await execute(req);
    for (const [key, value] of Object.entries(result.headers || {})) res.setHeader(key, value);
    return res.status(result.status).send(result.body);
}
module.exports = { autoInvoiceDispatchRoute };
