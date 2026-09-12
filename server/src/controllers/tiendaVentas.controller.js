const pool = require('../config/db');
const { getRrsPool } = require('../config/rrsDb');

const getSalesSetting = async (companyId, branchId, key) => {
    const [rows] = await pool.query(
        `SELECT setting_value FROM sales_settings
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = ?`,
        [companyId, branchId || null, branchId || null, key]
    );
    return rows[0]?.setting_value || null;
};

const getPuntosVentaTienda = async (companyId, branchId) => {
    const raw = await getSalesSetting(companyId, branchId, 'puntos_venta_tienda');
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(Number).filter(id => !isNaN(id) && id > 0);
    } catch (e) {
        return [];
    }
};

// GET /sales/tienda/ventas?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&branch_id=...
exports.getVentasByDate = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Debe proporcionar start_date y end_date' });
        }

        const branchId = req.query.branch_id || req.user.branch_id || null;

        let where = `sh.company_id = ? AND sh.estado = 'emitido' AND DATE(sh.created_at) BETWEEN ? AND ?
                     AND NOT EXISTS (SELECT 1 FROM dtes d WHERE d.venta_id = sh.id AND d.status = 'INVALIDADO')`;
        const params = [req.company_id, start_date, end_date];

        if (branchId) {
            where += ` AND sh.branch_id = ?`;
            params.push(branchId);
        }

        const posIds = await getPuntosVentaTienda(req.company_id, branchId);
        if (posIds.length > 0) {
            where += ` AND sh.pos_id IN (?)`;
            params.push(posIds);
        }

        const [rows] = await pool.query(
            `SELECT DATE_FORMAT(sh.created_at, '%Y-%m-%d') AS fecha, ROUND(SUM(sh.total_pagar), 2) AS monto
             FROM sales_headers sh
             WHERE ${where}
             GROUP BY DATE(sh.created_at)
             ORDER BY fecha ASC`,
            params
        );

        // Consultar estado en RRS
        const rrsIdEmpresa = (await getSalesSetting(req.company_id, branchId, 'empresa_rrs')) || '015';
        const rrsMap = new Map();
        try {
            const rrs = getRrsPool();
            const [rrsRows] = await rrs.query(
                `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, ROUND(monto, 2) AS monto
                 FROM ventas_tienda
                 WHERE id_empresa = ? AND fecha BETWEEN ? AND ?`,
                [rrsIdEmpresa, start_date, end_date]
            );
            for (const r of rrsRows) {
                rrsMap.set(r.fecha, parseFloat(r.monto));
            }
        } catch (rrsErr) {
            console.warn('No se pudo verificar el estado en RRS ventas_tienda:', rrsErr.message);
        }

        const fechasSet = new Set(rows.map(r => r.fecha));
        for (const [rrsFecha] of rrsMap.entries()) {
            fechasSet.add(rrsFecha);
        }

        const localMap = new Map();
        for (const r of rows) {
            localMap.set(r.fecha, parseFloat(r.monto));
        }

        const sortedFechas = Array.from(fechasSet).sort();
        const mergedData = sortedFechas.map(fecha => {
            const montoLocal = localMap.has(fecha) ? localMap.get(fecha) : 0;
            const enviadoRrs = rrsMap.has(fecha);
            const montoRrs = enviadoRrs ? rrsMap.get(fecha) : null;
            const diff = enviadoRrs ? Math.round((montoLocal - montoRrs) * 100) / 100 : null;

            return {
                fecha,
                monto: montoLocal,
                enviado_rrs: enviadoRrs,
                monto_rrs: montoRrs,
                diferencia: diff,
                tiene_diferencia: enviadoRrs && Math.abs(diff) >= 0.01
            };
        });

        res.json({ data: mergedData, total: mergedData.length, rrs_empresa: rrsIdEmpresa });
    } catch (error) {
        console.error('Error getVentasByDate:', error);
        res.status(500).json({ message: 'Error al consultar ventas por fecha' });
    }
};

// POST /sales/tienda/ventas/rrs  body: { fecha: 'YYYY-MM-DD', monto: number, branch_id?: number }
exports.sendVentasToRrs = async (req, res) => {
    try {
        const { fecha, monto, branch_id } = req.body || {};
        const branchId = branch_id || req.user.branch_id || null;

        // Normalizar: tolera 'YYYY-MM-DD' o ISO completo (ej: 2026-08-18T00:00:00.000Z)
        const fechaStr = String(fecha || '').trim().substring(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
            return res.status(400).json({ message: 'La fecha debe tener formato YYYY-MM-DD' });
        }
        const montoNum = parseFloat(monto);
        if (isNaN(montoNum) || montoNum < 0) {
            return res.status(400).json({ message: 'El monto debe ser un número válido' });
        }

        const rrsIdEmpresa = (await getSalesSetting(req.company_id, branchId, 'empresa_rrs')) || '015';

        const rrs = getRrsPool();
        const conn = await rrs.getConnection();
        try {
            await conn.beginTransaction();

            // Sobrescribir: si ya hay un registro para esa fecha, se elimina y se reinserta
            await conn.execute(
                'DELETE FROM ventas_tienda WHERE id_empresa = ? AND fecha = ?',
                [rrsIdEmpresa, fechaStr]
            );
            await conn.execute(
                'INSERT INTO ventas_tienda (id_empresa, fecha, monto) VALUES (?, ?, ?)',
                [rrsIdEmpresa, fechaStr, montoNum.toFixed(2)]
            );

            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

        res.json({ message: 'Ventas enviadas a RRS exitosamente', fecha: fechaStr, monto: montoNum, id_empresa: rrsIdEmpresa });
    } catch (error) {
        console.error('Error sendVentasToRrs:', error);
        res.status(500).json({ message: error.message || 'Error al enviar ventas a RRS' });
    }
};