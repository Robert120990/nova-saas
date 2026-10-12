const pool = require('../../config/db');

function safeParseJson(str, fallback = []) {
    if (!str) return fallback;
    if (typeof str !== 'string') return str;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

async function getStations(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.query.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;

        let query = "SELECT * FROM restaurant_stations WHERE company_id = ? AND is_active = 1";
        const params = [companyId];

        if (branchId) {
            query += " AND (branch_id = ? OR branch_id IS NULL)";
            params.push(branchId);
        }

        query += " ORDER BY id ASC";

        const [rows] = await pool.query(query, params);
        const formatted = rows.map(r => ({
            ...r,
            category_ids: safeParseJson(r.category_ids, [])
        }));

        res.json({ success: true, data: formatted });
    } catch (err) {
        console.error('Error in getStations:', err);
        res.status(500).json({ success: false, message: 'Error al obtener estaciones' });
    }
}

async function createStation(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const branchId = req.body?.branch_id || req.branch_id || req.branchId || req.user?.branch_id || null;
        const { name, printer_ip_or_name, category_ids } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre de la estación es obligatorio' });
        }

        const catIdsJson = Array.isArray(category_ids) ? JSON.stringify(category_ids.map(Number)) : null;

        const [result] = await pool.query(
            "INSERT INTO restaurant_stations (company_id, branch_id, name, printer_ip_or_name, category_ids) VALUES (?, ?, ?, ?, ?)",
            [companyId, branchId, name.trim(), printer_ip_or_name?.trim() || null, catIdsJson]
        );

        res.status(201).json({
            success: true,
            message: 'Estación creada exitosamente',
            data: { id: result.insertId, name: name.trim(), category_ids: category_ids || [] }
        });
    } catch (err) {
        console.error('Error in createStation:', err);
        res.status(500).json({ success: false, message: 'Error al crear estación' });
    }
}

async function updateStation(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const { name, printer_ip_or_name, category_ids, is_active } = req.body;

        const catIdsJson = category_ids !== undefined
            ? (Array.isArray(category_ids) ? JSON.stringify(category_ids.map(Number)) : null)
            : undefined;

        let query = "UPDATE restaurant_stations SET name = COALESCE(?, name), printer_ip_or_name = COALESCE(?, printer_ip_or_name), is_active = COALESCE(?, is_active)";
        const params = [name?.trim(), printer_ip_or_name?.trim(), is_active];

        if (catIdsJson !== undefined) {
            query += ", category_ids = ?";
            params.push(catIdsJson);
        }

        query += " WHERE id = ? AND company_id = ?";
        params.push(id, companyId);

        await pool.query(query, params);

        res.json({ success: true, message: 'Estación actualizada con éxito' });
    } catch (err) {
        console.error('Error in updateStation:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar estación' });
    }
}

async function deleteStation(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;

        await pool.query("UPDATE restaurant_stations SET is_active = 0 WHERE id = ? AND company_id = ?", [id, companyId]);
        res.json({ success: true, message: 'Estación eliminada con éxito' });
    } catch (err) {
        console.error('Error in deleteStation:', err);
        res.status(500).json({ success: false, message: 'Error al eliminar estación' });
    }
}

module.exports = {
    getStations,
    createStation,
    updateStation,
    deleteStation
};
