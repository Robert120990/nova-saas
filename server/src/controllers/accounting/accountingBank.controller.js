const { queryBankCheques, queryBankMovements } = require('../../services/accounting/accountingBankQuery.service');
const { buildBankEntryPreview, generateBankEntry, generateBankBatch } = require('../../services/accounting/accountingBankGenerate.service');

const getCheques = async (req, res) => {
    try {
        let { startDate, endDate, status, anulado, month, year } = req.query;
        if (month && year) {
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            const lastDay = new Date(y, m, 0).getDate();
            startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Período requerido (mes y año)' });
        }
        const data = await queryBankCheques(req.company_id, {
            startDate,
            endDate,
            month,
            year,
            status: status || 'all',
            anulado: anulado === '1' || anulado === 'true' ? 1 : 0
        });
        res.json(data);
    } catch (e) {
        console.error('Error in getCheques:', e);
        res.status(500).json({ message: e.message });
    }
};

const getMovements = async (req, res) => {
    try {
        let { startDate, endDate, status, month, year } = req.query;
        if (month && year) {
            const m = parseInt(month, 10);
            const y = parseInt(year, 10);
            const lastDay = new Date(y, m, 0).getDate();
            startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Período requerido (mes y año)' });
        }
        const data = await queryBankMovements(req.company_id, {
            startDate,
            endDate,
            month,
            year,
            status: status || 'all'
        });
        res.json(data);
    } catch (e) {
        console.error('Error in getMovements:', e);
        res.status(500).json({ message: e.message });
    }
};

const previewEntry = async (req, res) => {
    try {
        const { type, id, detallar_iva, tax_detail_mode } = req.body;
        if (!type || id === undefined) {
            return res.status(400).json({ message: 'Tipo (cheque o movimiento) e ID son requeridos' });
        }
        const data = await buildBankEntryPreview(req.company_id, { type, id, detallar_iva, tax_detail_mode });
        res.json(data);
    } catch (e) {
        console.error('Error in previewEntry:', e);
        res.status(500).json({ message: e.message });
    }
};

const generateEntry = async (req, res) => {
    try {
        const { type, id, date, description, entry_type_code, lines } = req.body;
        if (!type || id === undefined || !date || !Array.isArray(lines)) {
            return res.status(400).json({ message: 'Parámetros incompletos para generar partida' });
        }
        const data = await generateBankEntry(req.company_id, req.user?.id, {
            type,
            id,
            date,
            description,
            entry_type_code,
            lines
        });
        res.json(data);
    } catch (e) {
        console.error('Error in generateEntry:', e);
        const status = e.statusCode || 500;
        res.status(status).json({ message: e.message });
    }
};

const generateBatch = async (req, res) => {
    try {
        const { type, ids } = req.body;
        if (!type || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Tipo y lista de IDs son requeridos' });
        }
        const data = await generateBankBatch(req.company_id, req.user?.id, { type, ids });
        res.json(data);
    } catch (e) {
        console.error('Error in generateBatch:', e);
        res.status(500).json({ message: e.message });
    }
};

const { queryReservationMovements, saveReservationCorrelativos } = require('../../services/accounting/accountingBankReservation.service');

const getReservation = async (req, res) => {
    try {
        const { month, year, type } = req.query;
        if (!month || !year) {
            return res.status(400).json({ message: 'Mes y año son requeridos' });
        }
        const data = await queryReservationMovements(req.company_id, {
            month,
            year,
            type: type || 'ingresos'
        });
        res.json(data);
    } catch (e) {
        console.error('Error in getReservation:', e);
        res.status(500).json({ message: e.message });
    }
};

const saveReservation = async (req, res) => {
    try {
        const { month, year, type, items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ message: 'Lista de ítems requerida' });
        }
        const data = await saveReservationCorrelativos(req.company_id, {
            month,
            year,
            type: type || 'ingresos',
            items
        });
        res.json(data);
    } catch (e) {
        console.error('Error in saveReservation:', e);
        res.status(500).json({ message: e.message });
    }
};

module.exports = {
    getCheques,
    getMovements,
    previewEntry,
    generateEntry,
    generateBatch,
    getReservation,
    saveReservation
};
