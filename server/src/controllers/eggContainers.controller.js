const eggContainersService = require('../services/eggContainers.service');
const eggContainerCutoffsService = require('../services/eggContainerCutoffs.service');

const getContainersOverview = async (req, res) => {
    try {
        const data = await eggContainersService.getContainersOverview(req.company_id);
        res.json(data);
    } catch (error) {
        console.error('Error en getContainersOverview:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al obtener contenedores industriales.' });
    }
};

const addContainer = async (req, res) => {
    try {
        const data = await eggContainersService.addContainer(req.company_id, req.body || {}, req.user);
        res.status(201).json(data);
    } catch (error) {
        console.error('Error en addContainer:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al adicionar contenedor.' });
    }
};

const toggleContainerPower = async (req, res) => {
    try {
        const data = await eggContainersService.toggleContainerPower(
            req.company_id,
            req.params.id,
            req.body || {},
            req.user
        );
        res.json(data);
    } catch (error) {
        console.error('Error en toggleContainerPower:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al cambiar estado del contenedor.' });
    }
};

const updateContainer = async (req, res) => {
    try {
        const data = await eggContainersService.updateContainer(
            req.company_id,
            req.params.id,
            req.body || {},
            req.user
        );
        res.json(data);
    } catch (error) {
        console.error('Error en updateContainer:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al actualizar contenedor.' });
    }
};

const resetContainerCycle = async (req, res) => {
    try {
        const data = await eggContainersService.resetContainerCycle(
            req.company_id,
            req.params.id,
            req.body || {},
            req.user
        );
        res.json(data);
    } catch (error) {
        console.error('Error en resetContainerCycle:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al reiniciar ciclo del contenedor.' });
    }
};

const updateGlobalDailyRate = async (req, res) => {
    try {
        const { daily_rate } = req.body || {};
        const data = await eggContainersService.updateGlobalDailyRate(req.company_id, daily_rate);
        res.json(data);
    } catch (error) {
        console.error('Error en updateGlobalDailyRate:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al actualizar tarifa diaria.' });
    }
};

const deleteContainer = async (req, res) => {
    try {
        const data = await eggContainersService.deleteContainer(req.company_id, req.params.id);
        res.json(data);
    } catch (error) {
        console.error('Error en deleteContainer:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al eliminar contenedor.' });
    }
};

const syncContainerDaysForPeriod = async (req, res) => {
    try {
        const data = await eggContainerCutoffsService.syncContainerDaysForPeriod(req.company_id, req.body || {}, req.user);
        res.json(data);
    } catch (error) {
        console.error('Error en syncContainerDaysForPeriod:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al sincronizar días del período.' });
    }
};

const createContainerCutoff = async (req, res) => {
    try {
        const data = await eggContainerCutoffsService.createContainerCutoff(req.company_id, req.body || {}, req.user);
        res.status(201).json(data);
    } catch (error) {
        console.error('Error en createContainerCutoff:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al generar corte por fechas.' });
    }
};

const revertLastContainerCutoff = async (req, res) => {
    try {
        const data = await eggContainerCutoffsService.revertLastContainerCutoff(req.company_id, req.params.id, req.user);
        res.json(data);
    } catch (error) {
        console.error('Error en revertLastContainerCutoff:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al revertir el último corte.' });
    }
};

const exportContainerStatementReport = async (req, res) => {
    try {
        await eggContainerCutoffsService.exportContainerStatementReport(req.company_id, req.query || {}, res);
    } catch (error) {
        console.error('Error en exportContainerStatementReport:', error);
        if (!res.headersSent) {
            res.status(error.status || 500).json({ message: error.message || 'Error al exportar estado de cuenta.' });
        }
    }
};

module.exports = {
    getContainersOverview,
    addContainer,
    toggleContainerPower,
    updateContainer,
    resetContainerCycle,
    updateGlobalDailyRate,
    deleteContainer,
    syncContainerDaysForPeriod,
    createContainerCutoff,
    revertLastContainerCutoff,
    exportContainerStatementReport
};
