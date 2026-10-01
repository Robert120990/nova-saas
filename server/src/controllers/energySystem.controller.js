const energyService = require('../services/energySystem.service');

/**
 * Obtener telemetría en tiempo real de Inversores (Growatt) y Baterías (GESS)
 */
async function getLive(req, res) {
    try {
        const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'ID de empresa no especificado' });
        }
        const telemetry = await energyService.getLiveTelemetry(companyId);
        res.json({ success: true, data: telemetry });
    } catch (error) {
        console.error('[EnergyController.getLive] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Forzar sincronización manual inmediata y registrar snapshot
 */
async function syncNow(req, res) {
    try {
        const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'ID de empresa no especificado' });
        }
        const result = await energyService.recordReading(companyId, 'manual');
        res.json({
            success: true,
            message: 'Sincronización energética completada con éxito',
            data: result
        });
    } catch (error) {
        console.error('[EnergyController.syncNow] Error:', error.message);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

/**
 * Historial de lecturas periódicas con paginación y filtros
 */
async function getHistory(req, res) {
    try {
        const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'ID de empresa no especificado' });
        }
        const { startDate, endDate, limit, page } = req.query;
        const history = await energyService.getReadingsHistory(companyId, {
            startDate,
            endDate,
            limit: limit ? parseInt(limit, 10) : 50,
            page: page ? parseInt(page, 10) : 1
        });
        res.json({ success: true, ...history });
    } catch (error) {
        console.error('[EnergyController.getHistory] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Resúmenes diarios analíticos (generación solar, carga/descarga baterías, ahorros)
 */
async function getDailySummaries(req, res) {
    try {
        const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'ID de empresa no especificado' });
        }
        const { startDate, endDate, limit } = req.query;
        const summaries = await energyService.getDailySummaries(companyId, {
            startDate,
            endDate,
            limit: limit ? parseInt(limit, 10) : 30
        });
        res.json({ success: true, data: summaries });
    } catch (error) {
        console.error('[EnergyController.getDailySummaries] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Obtener configuración y credenciales actuales (con contraseñas enmascaradas)
 */
async function getConfig(req, res) {
    try {
        const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'ID de empresa no especificado' });
        }
        const config = await energyService.getCredentials(companyId);

        // Blindaje Cero Fuga: no enviar contraseñas al frontend
        const masked = {
            ...config,
            growatt_password: '',
            has_growatt_password: !!(config.growatt_password_decrypted || config.growatt_password),
            gess_password: '',
            has_gess_password: !!(config.gess_password_decrypted || config.gess_password)
        };
        delete masked.growatt_password_decrypted;
        delete masked.gess_password_decrypted;

        res.json({ success: true, data: masked });
    } catch (error) {
        console.error('[EnergyController.getConfig] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Actualizar configuración de credenciales y tarifas energéticas
 */
async function updateConfig(req, res) {
    try {
        const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'ID de empresa no especificado' });
        }
        const updated = await energyService.updateCredentials(companyId, req.body);

        const masked = {
            ...updated,
            growatt_password: '',
            has_growatt_password: !!(updated.growatt_password_decrypted || updated.growatt_password),
            gess_password: '',
            has_gess_password: !!(updated.gess_password_decrypted || updated.gess_password)
        };
        delete masked.growatt_password_decrypted;
        delete masked.gess_password_decrypted;

        res.json({
            success: true,
            message: 'Configuración energética guardada y protegida con éxito',
            data: masked
        });
    } catch (error) {
        console.error('[EnergyController.updateConfig] Error:', error.message);
        res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

const energyAnalyticsService = require('../services/energyAnalytics.service');

/**
 * Analítica temporal histórica (Día con curva 5m, Mes día a día, Año mes a mes)
 */
async function getAnalytics(req, res) {
    try {
        const companyId = req.company_id || req.headers['x-company-id'] || req.user?.company_id;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'ID de empresa no especificado' });
        }
        const { period, date, month, year, plantId } = req.query;
        const analytics = await energyAnalyticsService.getAnalyticsData(companyId, {
            period,
            date,
            month,
            year,
            plantId
        });
        res.json({ success: true, data: analytics });
    } catch (error) {
        console.error('[EnergyController.getAnalytics] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Obtener listado de localidades y empresas energéticas accesibles para el usuario
 */
async function getLocations(req, res) {
    try {
        const locations = await energyService.getAvailableLocations(req.user);
        res.json({ success: true, data: locations });
    } catch (error) {
        console.error('[EnergyController.getLocations] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    getLive,
    syncNow,
    getHistory,
    getDailySummaries,
    getConfig,
    updateConfig,
    getAnalytics,
    getLocations
};
