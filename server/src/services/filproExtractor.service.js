const https = require('https');
const pool = require('../config/db');
const { decrypt } = require('../utils/crypto');

class FilproExtractorService {
    constructor() {
        // Cache tokens in memory to avoid repetitive logins and prevent rate-limiting lockouts
        // Map<companyId, { token, refreshToken, expiresAt, filproCompanyId, userId }>
        this.sessionCache = new Map();
        this.apiBaseUrl = 'https://api-filpro-service.apiconsumofel.com/api';
        this.certifierBaseUrl = 'https://certificador.infile.com.sv/api/v1/reporte/reporte_documento';
    }

    /**
     * Internal HTTP request helper for HTTPS endpoints
     */
    async _rawRequest(url, method = 'GET', data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const postData = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;

            const requestHeaders = {
                'User-Agent': 'NovaSaaS-FilproConnector/1.0',
                'Accept': 'application/json',
                ...headers
            };

            if (postData) {
                requestHeaders['Content-Type'] = 'application/json';
                requestHeaders['Content-Length'] = Buffer.byteLength(postData);
            }

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method,
                headers: requestHeaders,
                timeout: 30000
            };

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => { responseBody += chunk; });
                res.on('end', () => {
                    let parsedJson = null;
                    try {
                        parsedJson = JSON.parse(responseBody);
                    } catch (e) {
                        parsedJson = null;
                    }

                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: parsedJson !== null ? parsedJson : responseBody,
                        raw: responseBody
                    });
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Tiempo de espera agotado al conectar con FilPro (timeout 30s)'));
            });

            req.on('error', (err) => {
                reject(new Error(`Error de red al conectar con FilPro: ${err.message}`));
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    /**
     * Get or refresh a valid JWT session for a company
     */
    async getValidSession(companyId, filproEmail, rawOrEncryptedPassword) {
        let password = rawOrEncryptedPassword;
        if (password.includes(':')) {
            const decrypted = decrypt(password);
            if (decrypted) password = decrypted;
        }

        const now = Date.now();

        // 1. If we have an in-memory cached token valid for at least 3 more minutes, reuse it
        const cached = this.sessionCache.get(companyId);
        if (cached && cached.token && cached.expiresAt && cached.expiresAt > (now + 180000)) {
            return cached;
        }

        // 2. Check persistent token cache in database
        try {
            const [dbRows] = await pool.query(
                'SELECT filpro_token, filpro_refresh_token, filpro_token_expires_at, filpro_company_id FROM filpro_connections WHERE company_id = ? LIMIT 1',
                [companyId]
            );
            if (dbRows.length > 0 && dbRows[0].filpro_token && dbRows[0].filpro_token_expires_at > (now + 180000)) {
                const dbSession = {
                    token: dbRows[0].filpro_token,
                    refreshToken: dbRows[0].filpro_refresh_token,
                    expiresAt: Number(dbRows[0].filpro_token_expires_at),
                    filproCompanyId: dbRows[0].filpro_company_id
                };
                this.sessionCache.set(companyId, dbSession);
                return dbSession;
            }
        } catch (dbErr) {
            // ignore DB lookup error
        }

        // 3. If token is close to expiry but we have a refreshToken, try refresh
        const existingRefresh = cached?.refreshToken;
        if (existingRefresh) {
            try {
                const refreshRes = await this._rawRequest(
                    `${this.apiBaseUrl}/security/refresh-token`,
                    'POST',
                    {},
                    {
                        'Authorization': `Bearer ${existingRefresh}`,
                        'X-Previous-Token': cached.token
                    }
                );

                if (refreshRes.statusCode === 200 && refreshRes.body?.token) {
                    const newToken = refreshRes.body.token;
                    const newRefresh = refreshRes.body.refreshToken || existingRefresh;
                    let expiresAt = now + (2 * 3600 * 1000); // fallback 2h

                    try {
                        const payload = JSON.parse(Buffer.from(newToken.split('.')[1], 'base64').toString());
                        if (payload.exp) expiresAt = payload.exp * 1000;
                    } catch (e) {
                        // ignore jwt decode error
                    }

                    const updatedSession = {
                        ...cached,
                        token: newToken,
                        refreshToken: newRefresh,
                        expiresAt
                    };
                    this.sessionCache.set(companyId, updatedSession);

                    // Persist refreshed token to DB
                    await pool.query(
                        'UPDATE filpro_connections SET filpro_token = ?, filpro_refresh_token = ?, filpro_token_expires_at = ? WHERE company_id = ?',
                        [newToken, newRefresh, expiresAt, companyId]
                    );

                    return updatedSession;
                }
            } catch (err) {
                // Refresh failed, fall back to login below
            }
        }

        // 4. Perform fresh login
        const loginRes = await this._rawRequest(
            `${this.apiBaseUrl}/security/login`,
            'POST',
            { email: filproEmail, password: password }
        );

        if (loginRes.statusCode !== 200 || !loginRes.body?.token) {
            const errorMsg = loginRes.body?.mensaje || loginRes.body?.message || `HTTP ${loginRes.statusCode}: Error de autenticación en FilPro`;
            throw new Error(errorMsg);
        }

        const token = loginRes.body.token;
        const refreshToken = loginRes.body.refreshToken || null;
        let userId = loginRes.body.id || null;
        let expiresAt = now + (2 * 3600 * 1000);

        try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (payload.id) userId = payload.id;
            if (payload.exp) expiresAt = payload.exp * 1000;
        } catch (e) {
            // ignore
        }

        // 4. Resolve FilPro companyId from login response or user profile
        let filproCompanyId = null;
        const userObj = loginRes.body.user || {};
        if (Array.isArray(userObj.companies) && userObj.companies.length > 0) {
            filproCompanyId = userObj.companies[0].id;
        } else if (Array.isArray(loginRes.body.companies) && loginRes.body.companies.length > 0) {
            filproCompanyId = loginRes.body.companies[0].id;
        } else if (Array.isArray(userObj.roles) && userObj.roles.length > 0 && userObj.roles[0].companyId) {
            filproCompanyId = userObj.roles[0].companyId;
        }

        // Fallback to getCompaniesByUser if not in login body
        if (!filproCompanyId) {
            try {
                const userCompaniesRes = await this._rawRequest(
                    `${this.apiBaseUrl}/users/getCompaniesByUser`,
                    'POST',
                    { userId: userId },
                    { 'Authorization': `Bearer ${token}` }
                );

                if (userCompaniesRes.statusCode === 200 && Array.isArray(userCompaniesRes.body)) {
                    if (userCompaniesRes.body.length > 0) {
                        filproCompanyId = userCompaniesRes.body[0].companyId || userCompaniesRes.body[0].id;
                    }
                }
            } catch (e) {
                // company resolution fallback
            }
        }

        const session = {
            token,
            refreshToken,
            expiresAt,
            userId,
            filproCompanyId
        };

        this.sessionCache.set(companyId, session);

        // Persist fresh token to DB cache
        try {
            await pool.query(
                'UPDATE filpro_connections SET filpro_token = ?, filpro_refresh_token = ?, filpro_token_expires_at = ?, filpro_company_id = COALESCE(?, filpro_company_id) WHERE company_id = ?',
                [token, refreshToken, expiresAt, filproCompanyId, companyId]
            );
        } catch (dbErr) {
            // ignore DB save error
        }

        return session;
    }

    /**
     * Fetch establishments/branches available in FilPro for the company
     */
    async getEstablishments(companyId, filproEmail, password, forcedFilproCompanyId = null) {
        const session = await this.getValidSession(companyId, filproEmail, password);
        const targetCompanyId = forcedFilproCompanyId || session.filproCompanyId;

        if (!targetCompanyId) {
            return [];
        }

        const res = await this._rawRequest(
            `${this.apiBaseUrl}/configuration/establishment/findByCompanyId`,
            'POST',
            { companyId: targetCompanyId },
            { 'Authorization': `Bearer ${session.token}` }
        );

        if (res.statusCode === 200 && Array.isArray(res.body)) {
            return res.body.map(est => ({
                id: est.id,
                establishmentNumber: est.establishmentNumber || est.codigo || '',
                name: est.name || est.nombre || '',
                address: est.address || est.direccion || '',
                status: est.status || 'ACTIVE'
            }));
        }

        return [];
    }

    /**
     * Query fiscal documents for a specific single day (YYYY-MM-DD)
     */
    async getDocumentsForDay(companyId, filproEmail, password, dateStr, establishmentCode = '', forcedFilproCompanyId = null) {
        const session = await this.getValidSession(companyId, filproEmail, password);
        const targetCompanyId = forcedFilproCompanyId || session.filproCompanyId;

        if (!targetCompanyId) {
            throw new Error('No se pudo identificar el companyId de FilPro para consultar documentos.');
        }

        const [yearStr, monthStr, dayStr] = dateStr.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            throw new Error(`Fecha inválida: ${dateStr}. Debe tener formato YYYY-MM-DD`);
        }

        let page = 1;
        const pageSize = 100;
        let hasMore = true;
        const allDocuments = [];

        while (hasMore) {
            const reqPayload = {
                companyId: targetCompanyId,
                reportId: 6, // Detalle de documentos del día
                year: year,
                month: month,
                day: day,
                establishment: establishmentCode || '',
                page: page,
                totalDocuments: pageSize,
                filter: ''
            };

            const res = await this._rawRequest(
                `${this.apiBaseUrl}/report/fiscalDocumentReport/get-report`,
                'POST',
                reqPayload,
                { 'Authorization': `Bearer ${session.token}` }
            );

            if (res.statusCode !== 200) {
                const msg = res.body?.mensaje || `Error al consultar reporte de DTEs en FilPro (HTTP ${res.statusCode})`;
                throw new Error(msg);
            }

            const reportResponse = res.body?.reportFiscalDocumentResponse?.respuesta;
            const docs = Array.isArray(reportResponse?.resumen_emision) 
                ? reportResponse.resumen_emision 
                : (reportResponse?.documentos || []);

            for (const doc of docs) {
                allDocuments.push({
                    uuid: (doc.uuid || '').trim(),
                    numero_control: (doc.numero_control || '').trim(),
                    tipo_dte_nombre: (doc.tipo_dte_nombre || '').trim(),
                    tipo_dte: this._resolveTipoDteCode(doc.tipo_dte_nombre || doc.numero_control),
                    nombre_receptor: (doc.nombre_receptor || '').trim(),
                    nit_receptor: (doc.nit_receptor || '').trim(),
                    nit_emisor: (doc.nit_emisor || '').trim(),
                    monto_total: parseFloat(doc.monto_total) || 0,
                    status: (doc.status || 'CERTIFICADO').toUpperCase(),
                    fecha_certificacion: doc.fecha_certificacion || null,
                    nombre_establecimiento: (doc.nombre_establecimiento || '').trim(),
                    identificador: doc.identificador || null
                });
            }

            const totalInReport = reportResponse?.total_documentos || 0;
            if (docs.length < pageSize || allDocuments.length >= totalInReport || docs.length === 0) {
                hasMore = false;
            } else {
                page++;
                if (page > 50) break; // safety guard
            }
        }

        return allDocuments;
    }

    /**
     * Download the official DTE JSON certified by Hacienda/Infile for a given UUID
     */
    async downloadOfficialDteJson(uuid) {
        if (!uuid) throw new Error('UUID de DTE es requerido para descargar el JSON oficial.');

        const url = `${this.certifierBaseUrl}?uuid=${encodeURIComponent(uuid)}&formato=json`;
        const res = await this._rawRequest(url, 'GET');

        if (res.statusCode !== 200) {
            throw new Error(`No se pudo descargar el JSON del DTE con UUID ${uuid} (HTTP ${res.statusCode})`);
        }

        if (typeof res.body === 'object' && res.body !== null) {
            return res.body;
        }

        try {
            return JSON.parse(res.raw);
        } catch (e) {
            throw new Error(`El contenido retornado para el UUID ${uuid} no es un JSON válido.`);
        }
    }

    /**
     * Helper to deduce standard 2-digit DTE type from name or control number
     */
    _resolveTipoDteCode(text = '') {
        const upper = text.toUpperCase();
        if (upper.includes('DTE-01') || upper.includes('FACTURA ELECTR')) return '01';
        if (upper.includes('DTE-03') || upper.includes('CRÉDITO FISCAL') || upper.includes('CREDITO FISCAL') || upper.includes('CCF')) return '03';
        if (upper.includes('DTE-04') || upper.includes('REMISIÓN') || upper.includes('REMISION')) return '04';
        if (upper.includes('DTE-05') || upper.includes('NOTA DE CRÉDITO') || upper.includes('NOTA DE CREDITO')) return '05';
        if (upper.includes('DTE-06') || upper.includes('NOTA DE DÉBITO') || upper.includes('NOTA DE DEBITO')) return '06';
        if (upper.includes('DTE-07') || upper.includes('RETENCIÓN') || upper.includes('RETENCION')) return '07';
        if (upper.includes('DTE-08') || upper.includes('LIQUIDACIÓN') || upper.includes('LIQUIDACION')) return '08';
        if (upper.includes('DTE-11') || upper.includes('EXPORTACIÓN') || upper.includes('EXPORTACION')) return '11';
        if (upper.includes('DTE-14') || upper.includes('SUJETO EXCLUIDO')) return '14';
        return '01';
    }
}

module.exports = new FilproExtractorService();
