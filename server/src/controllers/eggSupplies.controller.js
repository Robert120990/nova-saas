const eggSuppliesService = require('../services/eggSupplies.service');

const getSuppliesOverview = async (req, res) => {
    try {
        const data = await eggSuppliesService.getSuppliesOverview(req.company_id);
        res.json(data);
    } catch (error) {
        console.error('Error en getSuppliesOverview:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al obtener inventario de insumos.' });
    }
};

const saveSupplyItem = async (req, res) => {
    try {
        const payload = { ...(req.body || {}), id: req.params.id || req.body?.id || null };
        const data = await eggSuppliesService.saveSupplyItem(req.company_id, payload, req.user);
        res.json(data);
    } catch (error) {
        console.error('Error en saveSupplyItem:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al guardar insumo industrial.' });
    }
};

const registerSupplyMovement = async (req, res) => {
    try {
        const data = await eggSuppliesService.registerSupplyMovement(req.company_id, req.body || {}, req.user);
        res.status(201).json(data);
    } catch (error) {
        console.error('Error en registerSupplyMovement:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al registrar movimiento de insumo.' });
    }
};

const syncSuppliesWithCosting = async (req, res) => {
    try {
        const data = await eggSuppliesService.syncSuppliesWithCosting(req.company_id);
        res.json(data);
    } catch (error) {
        console.error('Error en syncSuppliesWithCosting:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al sincronizar insumos con costeo.' });
    }
};

const deleteSupplyItem = async (req, res) => {
    try {
        const data = await eggSuppliesService.deleteSupplyItem(req.company_id, req.params.id);
        res.json(data);
    } catch (error) {
        console.error('Error en deleteSupplyItem:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al eliminar insumo.' });
    }
};

const exportSuppliesReport = async (req, res) => {
    try {
        await eggSuppliesService.exportSuppliesReport(req.company_id, req.query || {}, res);
    } catch (error) {
        console.error('Error en exportSuppliesReport:', error);
        if (!res.headersSent) {
            res.status(error.status || 500).json({ message: error.message || 'Error al exportar reporte de insumos.' });
        }
    }
};

module.exports = {
    getSuppliesOverview,
    saveSupplyItem,
    registerSupplyMovement,
    syncSuppliesWithCosting,
    deleteSupplyItem,
    exportSuppliesReport
};
