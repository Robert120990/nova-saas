const pool = require('../config/db');
const { notify } = require('./notification.service');

/**
 * Detector de Ventas Sospechosas
 *
 * Cada 5 minutos escanea las ventas nuevas (id > last_scan_sale_id) de cada
 * sucursal con detección activa y aplica los umbrales configurables:
 *  - monto_maximo: venta única mayor a X
 *  - descuento_maximo_porcentaje: % de descuento sobre el total sin descuento
 *  - montos_redondos: total_pagar múltiplo de 100
 *  - horas_inicio/horas_fin: fuera del horario permitido
 *  - anulaciones_maximas en ventana_anulaciones_min minutos
 *
 * Cada hallazgo encola notify('sale_suspicious', ...) y pasa por las reglas
 * de notificación (canales sistema/correo/whatsapp/telegram).
 */

const DETECT_INTERVAL = 5 * 60 * 1000; // 5 minutos
const SCAN_WINDOW_MINUTES = 60; // solo ventas de la última hora al escanear

async function detectForSettings(s) {
    const { company_id, branch_id, id: settingsId } = s;
    const lastId = parseInt(s.last_scan_sale_id || 0, 10);

    const [sales] = await pool.query(
        `SELECT id, numero_control, cliente_nombre, total_pagar, descuento_general,
                hora_emision, created_at
         FROM sales_headers
         WHERE company_id = ? AND branch_id = ? AND id > ?
           AND estado != 'ANULADO'
           AND created_at >= NOW() - INTERVAL ${SCAN_WINDOW_MINUTES} MINUTE
         ORDER BY id ASC
         LIMIT 500`,
        [company_id, branch_id, lastId]
    );

    const [branchRows] = await pool.query(
        'SELECT nombre FROM branches WHERE id = ? AND company_id = ?',
        [branch_id, company_id]
    );
    const sucursal = branchRows[0]?.nombre || `Sucursal ${branch_id}`;

    let maxId = lastId;

    for (const sale of sales) {
        if (parseInt(sale.id, 10) > maxId) maxId = parseInt(sale.id, 10);

        const total = parseFloat(sale.total_pagar) || 0;
        const descuento = parseFloat(sale.descuento_general) || 0;
        const base = total + descuento;
        const pctDescuento = base > 0 ? (descuento / base) * 100 : 0;
        const hora = String(sale.hora_emision || '').slice(0, 5);
        const motivos = [];

        if (total > parseFloat(s.monto_maximo)) {
            motivos.push(`Monto alto ($${total.toFixed(2)})`);
        }
        if (pctDescuento > parseFloat(s.descuento_maximo_porcentaje)) {
            motivos.push(`Descuento excesivo (${pctDescuento.toFixed(1)}%)`);
        }
        if (s.montos_redondos && total > 0 && total % 100 === 0) {
            motivos.push('Monto múltiplo de $100');
        }
        const ini = String(s.horas_inicio).slice(0, 5);
        const fin = String(s.horas_fin).slice(0, 5);
        if (hora && (hora < ini || hora > fin)) {
            motivos.push(`Fuera de horario (${hora})`);
        }

        if (motivos.length > 0) {
            await notify('sale_suspicious', company_id, branch_id, {
                documento: sale.numero_control || `#${sale.id}`,
                cliente: sale.cliente_nombre || 'Consumidor final',
                monto: total.toFixed(2),
                descuento: descuento.toFixed(2),
                porcentaje_descuento: pctDescuento.toFixed(1),
                hora: hora || '—',
                usuario: '',
                sucursal,
                motivo: motivos.join(', '),
                anulaciones: 0
            });
        }
    }

    // Anulaciones frecuentes (dedup por ventana desde el último escaneo)
    if (parseInt(s.anulaciones_maximas || 0, 10) > 0) {
        const [anulaciones] = await pool.query(
            `SELECT seller_id, COUNT(*) as n
             FROM sales_headers
             WHERE company_id = ? AND branch_id = ?
               AND estado = 'ANULADO'
               AND created_at >= COALESCE(?, NOW() - INTERVAL ? MINUTE)
             GROUP BY seller_id
             HAVING n >= ?`,
            [company_id, branch_id, s.last_scan_at, parseInt(s.ventana_anulaciones_min || 10, 10), parseInt(s.anulaciones_maximas, 10)]
        );
        for (const a of anulaciones) {
            await notify('sale_suspicious', company_id, branch_id, {
                documento: `Vendedor #${a.seller_id}`,
                cliente: '—',
                monto: '0.00',
                descuento: '0.00',
                porcentaje_descuento: '0.0',
                hora: '—',
                usuario: `Vendedor #${a.seller_id}`,
                sucursal,
                motivo: `${a.n} anulaciones en ${s.ventana_anulaciones_min} minutos`,
                anulaciones: a.n
            });
        }
    }

    await pool.query(
        'UPDATE sale_suspicious_settings SET last_scan_sale_id = ?, last_scan_at = NOW() WHERE id = ?',
        [maxId, settingsId]
    );
}

async function runDetection() {
    try {
        const [settings] = await pool.query('SELECT * FROM sale_suspicious_settings WHERE enabled = 1');
        for (const s of settings) {
            try {
                await detectForSettings(s);
            } catch (error) {
                console.error(`[SuspiciousSales] Error en sucursal ${s.branch_id}:`, error.message);
            }
        }
    } catch (error) {
        console.error('[SuspiciousSales] Error en runDetection:', error.message);
    }
}

let intervalHandle = null;

function startSuspiciousSalesDetector() {
    if (intervalHandle) return;
    console.log('[SuspiciousSales] Detector iniciado (cada 5 minutos).');
    intervalHandle = setInterval(runDetection, DETECT_INTERVAL);
    runDetection();
}

function stopSuspiciousSalesDetector() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log('[SuspiciousSales] Detector detenido.');
    }
}

module.exports = { startSuspiciousSalesDetector, stopSuspiciousSalesDetector };
