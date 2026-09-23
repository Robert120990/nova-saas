const pool = require('../config/db');
const { getRrsPool } = require('../config/rrsDb');

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD en la zona horaria de El Salvador (America/El_Salvador)
 */
function getElSalvadorDate(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/El_Salvador',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

/**
 * Obtiene la fecha del día anterior en formato YYYY-MM-DD según la hora de El Salvador
 */
function getYesterdayElSalvador(baseDate = new Date()) {
    const todayStr = getElSalvadorDate(baseDate);
    const [y, m, d] = todayStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().split('T')[0];
}

/**
 * Obtiene la hora y minuto actuales en El Salvador
 */
function getElSalvadorTime(d = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/El_Salvador',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(d);

    return {
        hour: parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10),
        minute: parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10),
        second: parseInt(parts.find(p => p.type === 'second')?.value || '0', 10)
    };
}

/**
 * Obtiene la configuración de puntos de venta de tienda para una sucursal
 */
const getPuntosVentaTienda = async (companyId, branchId) => {
    const [rows] = await pool.query(
        `SELECT setting_value FROM sales_settings
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = 'puntos_venta_tienda'`,
        [companyId, branchId || null, branchId || null]
    );
    const raw = rows[0]?.setting_value;
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(Number).filter(id => !isNaN(id) && id > 0);
    } catch (e) {
        return [];
    }
};

/**
 * Ejecuta la sincronización de ventas de tienda hacia RRS para la fecha indicada (por defecto: día anterior)
 * para todas las sucursales configuradas en sales_settings con 'empresa_rrs'.
 */
async function syncYesterdayVentasTiendaToRrs({ manual = false, targetDate = null } = {}) {
    const fechaAEnviar = targetDate || getYesterdayElSalvador();
    console.log(`[RrsAutoSync] Iniciando sincronización de ventas de tienda para la fecha: ${fechaAEnviar} (manual: ${manual})`);

    // 1. Obtener todas las configuraciones de empresa RRS activas
    const [configs] = await pool.query(`
        SELECT s.company_id, s.branch_id, s.setting_value AS empresa_rrs, b.nombre AS branch_name
        FROM sales_settings s
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.setting_key = 'empresa_rrs' 
          AND s.setting_value IS NOT NULL 
          AND TRIM(s.setting_value) != ''
        ORDER BY s.company_id ASC, s.branch_id ASC
    `);

    if (configs.length === 0) {
        console.log('[RrsAutoSync] No se encontraron sucursales con empresa_rrs configurada. Omitiendo.');
        return { success: true, count: 0, date: fechaAEnviar, results: [] };
    }

    const rrsPool = getRrsPool();
    const results = [];

    for (const conf of configs) {
        const { company_id: companyId, branch_id: branchId, empresa_rrs: rrsIdEmpresa, branch_name: branchName } = conf;
        const sucursalLabel = branchName || `Sucursal ID #${branchId}`;

        try {
            // 2. Calcular la venta del día para la tienda
            let where = `sh.company_id = ? AND sh.estado = 'emitido' AND DATE(sh.created_at) = ?
                         AND NOT EXISTS (SELECT 1 FROM dtes d WHERE d.venta_id = sh.id AND d.status = 'INVALIDADO')`;
            const params = [companyId, fechaAEnviar];

            if (branchId) {
                where += ` AND sh.branch_id = ?`;
                params.push(branchId);
            }

            const posIds = await getPuntosVentaTienda(companyId, branchId);
            if (posIds.length > 0) {
                where += ` AND sh.pos_id IN (?)`;
                params.push(posIds);
            }

            const [rows] = await pool.query(
                `SELECT ROUND(SUM(sh.total_pagar), 2) AS monto
                 FROM sales_headers sh
                 WHERE ${where}`,
                params
            );

            const montoNum = rows[0]?.monto != null ? parseFloat(rows[0].monto) : 0;

            // 3. Enviar a la base de datos RRS (DELETE + INSERT para sobrescribir idéntico al proceso manual)
            const conn = await rrsPool.getConnection();
            try {
                await conn.beginTransaction();

                await conn.execute(
                    'DELETE FROM ventas_tienda WHERE id_empresa = ? AND fecha = ?',
                    [rrsIdEmpresa, fechaAEnviar]
                );

                await conn.execute(
                    'INSERT INTO ventas_tienda (id_empresa, fecha, monto) VALUES (?, ?, ?)',
                    [rrsIdEmpresa, fechaAEnviar, montoNum.toFixed(2)]
                );

                await conn.commit();
            } catch (rrsError) {
                await conn.rollback();
                throw rrsError;
            } finally {
                conn.release();
            }

            console.log(`[RrsAutoSync] ✓ ${sucursalLabel} (Empresa RRS: #${rrsIdEmpresa}): Fecha ${fechaAEnviar}, Monto: $${montoNum.toFixed(2)} -> ENVIADO CON ÉXITO`);
            results.push({
                company_id: companyId,
                branch_id: branchId,
                branch_name: sucursalLabel,
                empresa_rrs: rrsIdEmpresa,
                fecha: fechaAEnviar,
                monto: montoNum,
                status: 'ENVIADO'
            });
        } catch (branchError) {
            console.error(`[RrsAutoSync] ✗ Error al procesar ${sucursalLabel} (RRS #${rrsIdEmpresa}):`, branchError.message);
            results.push({
                company_id: companyId,
                branch_id: branchId,
                branch_name: sucursalLabel,
                empresa_rrs: rrsIdEmpresa,
                fecha: fechaAEnviar,
                error: branchError.message,
                status: 'ERROR'
            });
        }
    }

    const successCount = results.filter(r => r.status === 'ENVIADO').length;
    console.log(`[RrsAutoSync] Sincronización finalizada para ${fechaAEnviar}: ${successCount}/${results.length} sucursales enviadas exitosamente.`);

    return {
        success: successCount > 0 || results.length === 0,
        date: fechaAEnviar,
        total: results.length,
        successCount,
        results
    };
}

// Variables de control para el programador
let cronInterval = null;
let lastSyncedDate = null;
let retryTimer = null;

/**
 * Verifica si al iniciar el servidor ya pasaron las 6:00 AM y si alguna empresa falta de sincronizar
 */
async function checkAndSyncIfMissing(todayStr) {
    try {
        const yesterday = getYesterdayElSalvador();
        const [configs] = await pool.query(`
            SELECT setting_value AS empresa_rrs
            FROM sales_settings
            WHERE setting_key = 'empresa_rrs' AND setting_value IS NOT NULL AND TRIM(setting_value) != ''
        `);
        const rrsEmpresas = configs.map(c => c.empresa_rrs);
        if (rrsEmpresas.length === 0) return;

        const rrsPool = getRrsPool();
        const [rrsRows] = await rrsPool.query(`
            SELECT DISTINCT id_empresa FROM ventas_tienda WHERE fecha = ? AND id_empresa IN (?)
        `, [yesterday, rrsEmpresas]);

        const syncedEmpresas = new Set(rrsRows.map(r => String(r.id_empresa)));
        const missing = rrsEmpresas.filter(id => !syncedEmpresas.has(String(id)));

        if (missing.length > 0) {
            console.log(`[RrsAutoSync] Al iniciar el servidor se detectó que faltan ${missing.length} empresas por sincronizar en RRS para ${yesterday}. Ejecutando sincronización de recuperación...`);
            lastSyncedDate = todayStr;
            await syncYesterdayVentasTiendaToRrs();
        } else {
            console.log(`[RrsAutoSync] Estado inicial verificado: todas las empresas (${rrsEmpresas.length}) ya están sincronizadas en RRS para ${yesterday}.`);
            lastSyncedDate = todayStr;
        }
    } catch (err) {
        console.warn('[RrsAutoSync] No se pudo verificar el estado inicial de sincronización en RRS:', err.message);
    }
}

/**
 * Inicia el cron en segundo plano que revisa periódicamente si son las 6:00 AM en El Salvador
 */
function startRrsAutoSyncCron() {
    if (cronInterval) return;

    console.log('[RrsAutoSync] Servicio de sincronización automática de Ventas Tienda a RRS iniciado (programado diariamente a las 6:00 AM hora SV).');

    // Comprobación inicial de seguridad al arrancar
    const now = new Date();
    const { hour } = getElSalvadorTime(now);
    const todayStr = getElSalvadorDate(now);
    if (hour >= 6) {
        checkAndSyncIfMissing(todayStr);
    }

    // Intervalo de comprobación cada 30 segundos
    cronInterval = setInterval(async () => {
        try {
            const currentTime = new Date();
            const { hour: h, minute: m } = getElSalvadorTime(currentTime);
            const currentDayStr = getElSalvadorDate(currentTime);

            // Se dispara exactamente en la ventana de las 6:00 AM (06:00) si no se ha ejecutado hoy
            if (h === 6 && m === 0 && lastSyncedDate !== currentDayStr) {
                lastSyncedDate = currentDayStr;
                console.log(`[RrsAutoSync] ¡Hora programada alcanzada! (6:00 AM hora El Salvador). Iniciando envío automático...`);

                const res = await syncYesterdayVentasTiendaToRrs();

                // Si falló por problemas de red o conexión a RRS, programar un reintento en 5 minutos
                if (!res.success && !retryTimer) {
                    console.warn('[RrsAutoSync] Se detectaron errores en la sincronización. Programando reintento en 5 minutos...');
                    retryTimer = setTimeout(async () => {
                        retryTimer = null;
                        console.log('[RrsAutoSync] Ejecutando reintento automático de sincronización...');
                        await syncYesterdayVentasTiendaToRrs();
                    }, 5 * 60 * 1000);
                }
            }

            // Si cambia de día, resetear control para el próximo ciclo de las 6:00 AM
            if (lastSyncedDate && lastSyncedDate !== currentDayStr && h < 6) {
                lastSyncedDate = null;
            }
        } catch (e) {
            console.error('[RrsAutoSync] Error en ciclo de verificación del cron:', e.message);
        }
    }, 30 * 1000);
}

/**
 * Detiene el cron en segundo plano
 */
function stopRrsAutoSyncCron() {
    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
    }
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    console.log('[RrsAutoSync] Servicio de sincronización automática detenido.');
}

module.exports = {
    syncYesterdayVentasTiendaToRrs,
    startRrsAutoSyncCron,
    stopRrsAutoSyncCron,
    getYesterdayElSalvador,
    getElSalvadorDate,
    getElSalvadorTime
};
