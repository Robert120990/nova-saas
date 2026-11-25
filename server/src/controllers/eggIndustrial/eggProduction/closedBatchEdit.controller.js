const { pool } = require('./shared');
const closedBatchEditService = require('../../../services/eggIndustrial/eggClosedBatchEdit.service');

const parseJsonCol = (raw, fallback) => {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return fallback; }
};

const previewBatchEdit = async (req, res) => {
    try {
        const preview = await closedBatchEditService.previewBatchEdit(req, req.params.id, req.company_id, req.body || {});
        res.json(preview);
    } catch (error) {
        console.error('Error in previewBatchEdit:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};

const getBatchModificationLogs = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.user?.company_id;
        const [rows] = await pool.query(
            `SELECT * FROM egg_batch_modification_logs
             WHERE batch_id = ? AND company_id = ?
             ORDER BY created_at DESC, id DESC`,
            [id, companyId]
        );
        const mapped = rows.map(r => ({
            ...r,
            was_closed: Boolean(r.was_closed),
            changes: parseJsonCol(r.changes_json, []),
            impacts: parseJsonCol(r.impacts_json, {}),
            before_snapshot: parseJsonCol(r.before_snapshot_json, null),
            after_snapshot: parseJsonCol(r.after_snapshot_json, null)
        }));
        res.json(mapped);
    } catch (error) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
            return res.json([]);
        }
        console.error('Error in getBatchModificationLogs:', error);
        res.status(error.status || 500).json({ message: error.message });
    }
};

module.exports = {
    previewBatchEdit,
    getBatchModificationLogs
};
