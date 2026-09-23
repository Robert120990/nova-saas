const {
    mailerService,
    pool,
    dteService,
    pdfService,
    aiService,
    path,
    fs,
    jwt,
    getEffectiveProductId,
    getLubricantCategoryIds,
    isLubricantProduct,
    excelService,
    notificationService,
    dteValidoExistsSql,
    dteLatestColSql,
    reportPdfHelper,
    validateDocumentNumber,
    isValidDocumentNumber,
    dteTypeNames,
    getDteTypeName,
    FALLBACK_ACTIVIDAD,
    resolveActividadOficial
} = require('./salesUtils');


// --- CONTINGENCIA Y EVENTOS DE RETORNO (ERET) ---
const getContingencyStatus = async (req, res) => {
    try {
        const token = jwt.sign({ id: 0, username: 'system', company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/status`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const startContingency = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id, branch_id: req.user.branch_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const stopContingency = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/stop/${req.params.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ERET / Retorno proxy endpoints
const listRetornos = async (req, res) => {
    try {
        const token = jwt.sign({ id: 0, username: 'system', company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const params = new URLSearchParams({ search: req.query.search || '', page: req.query.page || '1', limit: req.query.limit || '10' });
        const response = await fetch(`${DTE_API_URL}/retorno?${params}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const emitRetorno = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id, branch_id: req.user.branch_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/retorno/emit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getRetornoStatus = async (req, res) => {
    try {
        const token = jwt.sign({ id: 0, username: 'system', company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/retorno/status/${req.params.codigoGeneracion}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': req.company_id }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


module.exports = {
    getContingencyStatus,
    startContingency,
    stopContingency,
    listRetornos,
    emitRetorno,
    getRetornoStatus
};
