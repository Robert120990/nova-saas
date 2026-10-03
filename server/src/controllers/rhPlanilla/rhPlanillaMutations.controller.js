const { executePayrollMutation } = require('../../services/rhPayroll/transaction.service');
const persistence = require('../../services/rhPayroll/persistence.service');
const period = require('../../services/rhPayroll/period.service');
const generation = require('../../services/rhPayroll/generation.service');
const synchronization = require('../../services/rhPayroll/synchronization.service');
const calculation = require('../../services/rhPayroll/calculation.service');
const commissions = require('../../services/rhPayroll/commissions.service');
const mutation = (handler) => async (req, res) => {
    const result = await executePayrollMutation(handler, req);
    res.status(result.statusCode).json(result.body);
};

module.exports = {
    createPlanilla: mutation(persistence.createPlanilla),
    updatePlanilla: mutation(persistence.updatePlanilla),
    deletePlanilla: mutation(persistence.deletePlanilla),
    pagarPlanilla: mutation(period.pagarPlanilla),
    cerrarPeriodo: mutation(period.cerrarPeriodo),
    eliminarPeriodo: mutation(period.eliminarPeriodo),
    generarPlanilla: mutation(generation.generarPlanilla),
    sincronizarPlanilla: mutation(synchronization.sincronizarPlanilla),
    calcular: mutation(calculation.calcular),
    syncIndustrialCommissions: mutation(commissions.syncIndustrialCommissions),
};
