const { jwt, pool } = require('./salesUtils');

const DTE_API_URL = process.env.DTE_API_URL || 'http://localhost:5000/api';
const DTE_JWT_SECRET = process.env.DTE_JWT_SECRET || process.env.JWT_SECRET;

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

const simulateOutage = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/simulate-outage`, {
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

const triggerAutoClose = async (req, res) => {
    try {
        const token = jwt.sign({ id: req.user.id, username: req.user.username, company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const response = await fetch(`${DTE_API_URL}/contingency/trigger-autoclose`, {
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

// ERET / Retorno proxy endpoints
const normalizeTimeBound = (raw, defaultSeconds = '00') => {
    const clean = String(raw || '').trim();
    if (!clean) return null;
    const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    return `${match[1].padStart(2, '0')}:${match[2]}:${match[3] || defaultSeconds}`;
};

const searchRetornoEligibleDtes = async (req, res) => {
    try {
        const {
            search = '',
            numero = '',
            cliente = '',
            fecha_desde = '',
            fecha_hasta = '',
            hora_desde = '',
            hora_hasta = '',
            tipo_dte = '',
            branch_id = '',
            monto = '',
            page = 1,
            limit = 15
        } = req.query;

        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
        const offset = (safePage - 1) * safeLimit;

        let whereSql = `
            WHERE d.company_id = ?
              AND d.tipo_dte IN ('01', '11', '14')
              AND d.status = 'ACCEPTED'
              AND (s.id IS NULL OR COALESCE(s.estado, '') NOT IN ('anulado', 'anulada', 'invalidado'))
        `;
        const params = [req.company_id];

        if (req.user?.branch_id) {
            whereSql += ' AND COALESCE(d.branch_id, s.branch_id) = ?';
            params.push(req.user.branch_id);
        } else if (branch_id && branch_id !== 'all') {
            whereSql += ' AND COALESCE(d.branch_id, s.branch_id) = ?';
            params.push(branch_id);
        }

        if (['01', '11', '14'].includes(String(tipo_dte).trim())) {
            whereSql += ' AND d.tipo_dte = ?';
            params.push(String(tipo_dte).trim());
        }

        const fDesde = String(fecha_desde || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(fDesde)) {
            whereSql += ' AND COALESCE(s.fecha_emision, DATE(d.created_at)) >= ?';
            params.push(fDesde);
        }

        const fHasta = String(fecha_hasta || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(fHasta)) {
            whereSql += ' AND COALESCE(s.fecha_emision, DATE(d.created_at)) <= ?';
            params.push(fHasta);
        }

        const hDesde = normalizeTimeBound(hora_desde, '00');
        if (hDesde) {
            whereSql += " AND COALESCE(s.hora_emision, TIME_FORMAT(d.created_at, '%H:%i:%s')) >= ?";
            params.push(hDesde);
        }

        const hHasta = normalizeTimeBound(hora_hasta, '59');
        if (hHasta) {
            whereSql += " AND COALESCE(s.hora_emision, TIME_FORMAT(d.created_at, '%H:%i:%s')) <= ?";
            params.push(hHasta);
        }

        const numTerm = String(numero || '').trim();
        if (numTerm) {
            const likeNum = `%${numTerm}%`;
            whereSql += ' AND (d.numero_control LIKE ? OR d.codigo_generacion LIKE ? OR CAST(d.venta_id AS CHAR) = ?)';
            params.push(likeNum, likeNum, numTerm);
        }

        const cliTerm = String(cliente || '').trim();
        if (cliTerm) {
            const likeCli = `%${cliTerm}%`;
            whereSql += ` AND (
                c.nombre LIKE ?
                OR s.cliente_nombre LIKE ?
                OR c.nit LIKE ?
                OR c.numero_documento LIKE ?
                OR (d.venta_id IS NULL AND JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.sujetoExcluido.nombre')) LIKE ?)
            )`;
            params.push(likeCli, likeCli, likeCli, likeCli, likeCli);
        }

        const montoNum = Number(monto);
        if (String(monto || '').trim() !== '' && !Number.isNaN(montoNum) && montoNum > 0) {
            whereSql += ' AND ABS(COALESCE(s.total_pagar, 0) - ?) < 0.01';
            params.push(montoNum);
        }

        const searchTerm = String(search || '').trim();
        if (searchTerm) {
            const likeSearch = `%${searchTerm}%`;
            const isNumericSearch = /^\d+(\.\d{1,2})?$/.test(searchTerm);
            if (isNumericSearch) {
                whereSql += ` AND (
                    d.numero_control LIKE ?
                    OR d.codigo_generacion LIKE ?
                    OR c.nombre LIKE ?
                    OR s.cliente_nombre LIKE ?
                    OR c.nit LIKE ?
                    OR c.numero_documento LIKE ?
                    OR ABS(COALESCE(s.total_pagar, 0) - ?) < 0.01
                )`;
                params.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, Number(searchTerm));
            } else {
                whereSql += ` AND (
                    d.numero_control LIKE ?
                    OR d.codigo_generacion LIKE ?
                    OR c.nombre LIKE ?
                    OR s.cliente_nombre LIKE ?
                    OR c.nit LIKE ?
                    OR c.numero_documento LIKE ?
                    OR (d.venta_id IS NULL AND JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.sujetoExcluido.nombre')) LIKE ?)
                )`;
                params.push(likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch);
            }
        }

        const baseJoins = `
            FROM dtes d
            LEFT JOIN sales_headers s ON s.id = d.venta_id
            LEFT JOIN customers c ON c.id = s.customer_id
            LEFT JOIN branches b ON b.id = COALESCE(d.branch_id, s.branch_id)
        `;

        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${baseJoins} ${whereSql}`, params);

        const [rows] = await pool.query(
            `SELECT d.id,
                    d.codigo_generacion,
                    d.numero_control,
                    d.tipo_dte,
                    d.status,
                    COALESCE(d.branch_id, s.branch_id) AS branch_id,
                    d.venta_id,
                    COALESCE(
                        DATE_FORMAT(s.fecha_emision, '%Y-%m-%d'),
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.identificacion.fecEmi')), 'null'),
                        DATE_FORMAT(d.created_at, '%Y-%m-%d')
                    ) AS fecha_emision,
                    COALESCE(
                        s.hora_emision,
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.identificacion.horEmi')), 'null'),
                        TIME_FORMAT(d.created_at, '%H:%i:%s')
                    ) AS hora_emision,
                    COALESCE(
                        NULLIF(TRIM(c.nombre), ''),
                        NULLIF(TRIM(s.cliente_nombre), ''),
                        NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.receptor.nombre'))), ''),
                        NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.sujetoExcluido.nombre'))), ''),
                        'Consumidor Final'
                    ) AS receptor_nombre,
                    COALESCE(
                        NULLIF(TRIM(c.nit), ''),
                        NULLIF(TRIM(c.numero_documento), ''),
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.receptor.numDocumento')), 'null'),
                        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.sujetoExcluido.numDocumento')), 'null'),
                        ''
                    ) AS receptor_documento,
                    COALESCE(
                        s.total_pagar,
                        CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.resumen.totalPagar')), 'null') AS DECIMAL(12, 2)),
                        CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.json_original, '$.resumen.totalCompra')), 'null') AS DECIMAL(12, 2)),
                        0
                    ) AS total_pagar,
                    COALESCE(b.nombre, 'Central') AS branch_name,
                    COALESCE(JSON_LENGTH(d.json_original, '$.cuerpoDocumento'), 0) AS items_count
             ${baseJoins}
             ${whereSql}
             ORDER BY d.id DESC
             LIMIT ? OFFSET ?`,
            [...params, safeLimit, offset]
        );

        res.json({
            success: true,
            data: rows,
            total,
            page: safePage,
            totalPages: Math.max(1, Math.ceil(total / safeLimit))
        });
    } catch (error) {
        console.error('[SearchRetornoEligibleDtes] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const listRetornos = async (req, res) => {
    try {
        const token = jwt.sign({ id: 0, username: 'system', company_id: req.company_id }, DTE_JWT_SECRET, { expiresIn: '1m' });
        const params = new URLSearchParams({
            search: req.query.search || '',
            page: req.query.page || '1',
            limit: req.query.limit || '10',
            fecha_desde: req.query.fecha_desde || '',
            fecha_hasta: req.query.fecha_hasta || '',
            status: req.query.status || ''
        });
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
    simulateOutage,
    triggerAutoClose,
    listRetornos,
    searchRetornoEligibleDtes,
    emitRetorno,
    getRetornoStatus
};
