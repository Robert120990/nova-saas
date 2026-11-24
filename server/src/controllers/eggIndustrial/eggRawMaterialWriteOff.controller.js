const writeOffService = require('../../services/eggIndustrial/eggRawMaterialWriteOff.service');

const getTarimaWriteOffs = async (req, res) => {
    try {
        const result = await writeOffService.listWriteOffs(req.company_id, req.query);
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al listar bajas de tarimas.' });
    }
};

const searchTarimaWriteOffInvoices = async (req, res) => {
    try {
        const invoices = await writeOffService.searchAvailableInvoices(req.company_id, req.query);
        res.json({ data: invoices });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al buscar facturas disponibles.' });
    }
};

const createTarimaWriteOff = async (req, res) => {
    try {
        const branchId = req.body.branch_id || req.branch_id || req.user?.branch_id || null;
        const created = await writeOffService.createWriteOff(req.company_id, branchId, req.user, req.body);
        res.status(201).json(created);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al registrar la baja de tarimas.' });
    }
};

const revertTarimaWriteOff = async (req, res) => {
    try {
        const result = await writeOffService.revertWriteOff(
            req.company_id,
            req.params.id,
            req.user,
            req.body?.revert_reason || req.body?.reason || null
        );
        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message || 'Error al revertir la baja de tarimas.' });
    }
};

module.exports = {
    getTarimaWriteOffs,
    searchTarimaWriteOffInvoices,
    createTarimaWriteOff,
    revertTarimaWriteOff
};
