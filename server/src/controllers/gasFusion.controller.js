const pool = require('../config/db');
const fusionService = require('../services/fusionFfc.service');
const fusionAgent = require('../services/fusionAgent.service');

/**
 * Obtener lista de turnos registrados en el controlador Fusion FFC
 * Soporta paginación por limit (por defecto 3 para no saturar la consola Fusion)
 * Identifica cuáles turnos ya han sido utilizados previamente en cierres de gasolinera.
 */
exports.getPeriods = async (req, res) => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        const config = await fusionService.getFusionConfig(req.company_id, branchId);
        const periods = await fusionService.getShiftPeriods(config, req.company_id, branchId);

        // Consultar cuáles turnos de Fusion ya fueron utilizados en algún cierre de la empresa
        const [usedCloseouts] = await pool.query(
            `SELECT id, numero_turno, fecha_turno, estado, fusion_shift_id
             FROM gas_station_closeouts
             WHERE company_id = ? AND fusion_shift_id IS NOT NULL`,
            [req.company_id]
        );

        const usedMap = {};
        for (const c of usedCloseouts) {
            usedMap[c.fusion_shift_id] = {
                closeoutId: c.id,
                numero_turno: c.numero_turno,
                fecha_turno: c.fecha_turno,
                estado: c.estado
            };
        }

        for (const p of periods) {
            p.usedInCloseout = usedMap[p.id] || null;
        }

        const { status, limit = 3 } = req.query;
        let filtered = periods;
        if (status === 'cerrado') filtered = periods.filter(p => p.isClosed);
        else if (status === 'abierto') filtered = periods.filter(p => !p.isClosed);

        const limitNum = Number(limit) > 0 ? Number(limit) : 3;
        const limited = filtered.slice(0, limitNum);
        res.json({ data: limited, total: limited.length, totalAvailable: filtered.length });
    } catch (error) {
        console.error('Error getPeriods Fusion:', error);
        res.status(500).json({ message: error.message || 'Error al obtener los turnos desde el controlador Fusion FFC' });
    }
};

/**
 * Obtener lecturas totalizadoras y ventas de un turno específico de Fusion
 * Realiza el matching automático con las pistolas del cierre e incluye las ventas reportadas en la pestaña "Sales".
 */
exports.getPeriodReadings = async (req, res) => {
    try {
        const { periodId } = req.params;
        const { closeoutId } = req.query;

        let branchId = req.query.branch_id || req.user?.branch_id;
        if (!branchId && closeoutId) {
            const [cRow] = await pool.query('SELECT branch_id FROM gas_station_closeouts WHERE id = ?', [closeoutId]);
            if (cRow.length && cRow[0].branch_id) branchId = cRow[0].branch_id;
        }

        const config = await fusionService.getFusionConfig(req.company_id, branchId);
        const { periodInfo, totalizers, pumpSales } = await fusionService.getPeriodTotalizers(periodId, config, req.company_id, branchId);

        if (!closeoutId) {
            return res.json({
                periodInfo,
                totalizers,
                pumpSales,
                total: totalizers.length
            });
        }

        // Buscar lecturas del cierre en base de datos
        const [readings] = await pool.query(`
            SELECT id, nozzle_id, codigo_pistola, codigo_producto, descripcion_producto,
                   lectura_anterior, lectura_actual
            FROM gas_station_closeout_readings
            WHERE closeout_id = ?
            ORDER BY CAST(codigo_pistola AS UNSIGNED), codigo_pistola ASC
        `, [closeoutId]);

        const matched = [];
        const warnings = [];
        const unmatched = [];

        for (let i = 0; i < totalizers.length; i++) {
            const row = totalizers[i];
            const reading = readings[i];
            const nozzleLabel = `Bomba ${row.pumpId} / Manguera ${row.hoseId}`;

            if (!reading) {
                unmatched.push({
                    row: nozzleLabel,
                    reason: `No hay lectura en la posición ${i + 1} del cierre`
                });
                continue;
            }

            const initialVolume = parseFloat(row.initialVolume) || 0;
            const finalVolume = parseFloat(row.finalVolume) || 0;
            const lecturaAnterior = parseFloat(reading.lectura_anterior) || 0;

            const antDiff = Math.abs(lecturaAnterior - initialVolume);
            if (antDiff >= 0.001) {
                warnings.push({
                    row: nozzleLabel,
                    reading: `${reading.codigo_pistola} — ${reading.descripcion_producto}`,
                    expected: lecturaAnterior,
                    actual: initialVolume,
                    diff: antDiff.toFixed(3)
                });
            }

            matched.push({
                readingId: reading.id,
                nozzle_id: reading.nozzle_id,
                codigo_pistola: reading.codigo_pistola,
                descripcion_producto: reading.descripcion_producto,
                lectura_anterior: lecturaAnterior,
                lectura_actual: finalVolume,
                initial_volume: initialVolume,
                final_volume: finalVolume,
                pumpId: row.pumpId,
                hoseId: row.hoseId
            });
        }

        res.json({
            periodInfo,
            matched,
            warnings,
            unmatched,
            total: totalizers.length,
            totalizers,
            pumpSales
        });
    } catch (error) {
        console.error('Error getPeriodReadings Fusion:', error);
        res.status(500).json({
            message: error.message || 'Error al obtener lecturas del turno desde Fusion'
        });
    }
};

/**
 * Probar conexión con el controlador Fusion
 * Permite probar con datos enviados en el body o con la config guardada de la estación
 */
exports.testConnection = async (req, res) => {
    try {
        let config;
        const { host, username, password, branch_id } = req.body || {};
        if (host && username) {
            let h = host.trim();
            if (!h.startsWith('http://') && !h.startsWith('https://')) h = `https://${h}`;
            let pwd = password;
            // Si no enviaron password en el body pero pasaron branch_id, buscar la guardada
            if (!pwd && branch_id) {
                const saved = await fusionService.getFusionConfig(req.company_id, branch_id);
                pwd = saved.password;
            }
            config = { host: h, username: username.trim(), password: pwd || '' };
        } else {
            const bId = branch_id || req.user?.branch_id;
            config = await fusionService.getFusionConfig(req.company_id, bId);
        }

        const bId = branch_id || req.user?.branch_id;
        const result = await fusionService.testConnection(config, req.company_id, bId);
        res.json({
            success: true,
            message: `Conexión exitosa con el controlador Fusion (${config.host})`,
            result
        });
    } catch (error) {
        console.error('Error testConnection Fusion:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'No se pudo conectar con el controlador Fusion'
        });
    }
};

/**
 * Obtener lista de estaciones (sucursales) de la empresa con sus parámetros de Fusion FFC
 */
exports.getStationConfigs = async (req, res) => {
    try {
        const [branches] = await pool.query(
            `SELECT id, codigo, nombre FROM branches WHERE company_id = ? ORDER BY codigo ASC, id ASC`,
            [req.company_id]
        );

        const [settingsRows] = await pool.query(
            `SELECT branch_id, setting_key, setting_value 
             FROM gas_station_settings 
             WHERE company_id = ? AND setting_key IN ('fusion_host', 'fusion_user', 'fusion_password')`,
            [req.company_id]
        );

        const settingsByBranch = {};
        for (const s of settingsRows) {
            const bId = s.branch_id || 0;
            if (!settingsByBranch[bId]) settingsByBranch[bId] = {};
            settingsByBranch[bId][s.setting_key] = s.setting_value;
        }

        const stations = branches.map(b => {
            const bSettings = settingsByBranch[b.id] || settingsByBranch[0] || {};
            return {
                branch_id: b.id,
                codigo: b.codigo,
                nombre: b.nombre,
                fusion_host: bSettings.fusion_host || '',
                fusion_user: bSettings.fusion_user || '',
                fusion_password: bSettings.fusion_password || '',
                has_password: Boolean(bSettings.fusion_password)
            };
        });

        res.json({ data: stations });
    } catch (error) {
        console.error('Error getStationConfigs Fusion:', error);
        res.status(500).json({ message: 'Error al obtener la configuración de estaciones Fusion' });
    }
};

/**
 * Guardar parámetros de conexión a Fusion FFC para una estación (sucursal)
 */
exports.saveStationConfig = async (req, res) => {
    try {
        const { branch_id, fusion_host, fusion_user, fusion_password } = req.body;
        if (!branch_id) {
            return res.status(400).json({ message: 'El ID de la estación / sucursal es requerido' });
        }

        const toSave = [
            { key: 'fusion_host', val: (fusion_host || '').trim() },
            { key: 'fusion_user', val: (fusion_user || '').trim() }
        ];

        if (fusion_password !== undefined && fusion_password !== null) {
            toSave.push({ key: 'fusion_password', val: String(fusion_password).trim() });
        }

        for (const item of toSave) {
            await pool.query(
                `INSERT INTO gas_station_settings (company_id, branch_id, setting_key, setting_value)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
                [req.company_id, branch_id, item.key, item.val]
            );
        }

        res.json({ success: true, message: 'Parámetros de conexión a Fusion FFC guardados correctamente' });
    } catch (error) {
        console.error('Error saveStationConfig Fusion:', error);
        res.status(500).json({ message: 'Error al guardar la configuración de Fusion' });
    }
};

/**
 * Consultar estado de conexión del conector local de la estación
 */
exports.getAgentStatus = async (req, res) => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        if (!branchId) return res.status(400).json({ message: 'Se requiere branch_id' });
        const status = fusionAgent.getAgentStatus(req.company_id, branchId);
        const agentKey = await fusionAgent.getOrGenerateAgentKey(req.company_id, branchId);
        const config = await fusionService.getFusionConfig(req.company_id, branchId);
        res.json({
            ...status,
            agentKey,
            companyId: Number(req.company_id),
            branchId: Number(branchId),
            fusionHost: config.host,
            serverUrl: `${req.protocol}://${req.get('host')}`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Descargar paquete de configuración config.json para el conector de la estación
 */
exports.getAgentConfig = async (req, res) => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        if (!branchId) return res.status(400).json({ message: 'Se requiere branch_id' });
        const config = await fusionService.getFusionConfig(req.company_id, branchId);
        const agentKey = await fusionAgent.getOrGenerateAgentKey(req.company_id, branchId);
        const payload = {
            serverUrl: `${req.protocol}://${req.get('host')}`,
            companyId: Number(req.company_id),
            branchId: Number(branchId),
            agentKey,
            fusionHost: config.host || 'https://10.19.4.15',
            fusionUser: config.username || 'MANAGER',
            fusionPassword: config.password || 'MANAGER'
        };
        res.setHeader('Content-Disposition', 'attachment; filename="config.json"');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(payload, null, 2));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Descargar iniciador Windows (.bat) para el conector
 */
exports.getAgentLauncher = (req, res) => {
    const bat = `@echo off\r\ntitle Conector Wayne Fusion FFC - SIPE WEB\r\ncolor 0A\r\ncd /d "%~dp0"\r\necho Conector Local Wayne Fusion FFC - SIPE WEB\r\nwhere node >nul 2>nul\r\nif %errorlevel% neq 0 ( echo [ERROR] Node.js no instalado. Descargue desde https://nodejs.org & pause & exit /b 1 )\r\nnode fusion-agent.js\r\nif %errorlevel% neq 0 pause\r\n`;
    res.setHeader('Content-Disposition', 'attachment; filename="iniciar-agente.bat"');
    res.setHeader('Content-Type', 'application/x-bat');
    res.send(bat);
};

/**
 * Descargar archivo fuente fusion-agent.js
 */
exports.getAgentScript = (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const p = path.resolve(__dirname, '../../../scripts/fusion-agent/fusion-agent.js');
    if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', 'attachment; filename="fusion-agent.js"');
        res.setHeader('Content-Type', 'application/javascript');
        return res.sendFile(p);
    }
    res.status(404).json({ message: 'Script conector no encontrado' });
};
