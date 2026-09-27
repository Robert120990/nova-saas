const { pool } = require('./shared');

const getTraceability360Stats = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { start_date, end_date } = req.query;

        let rmWhere = 'company_id = ?';
        let rmParams = [company_id];
        let batchWhere = 'company_id = ?';
        let batchParams = [company_id];
        let pkgWhere = 'company_id = ?';
        let pkgParams = [company_id];
        let pastWhere = 'company_id = ? AND (haccp_compliant = 0 OR (deviation_description IS NOT NULL AND deviation_description != ""))';
        let pastParams = [company_id];
        let labAlertWhere = 'company_id = ? AND (status = "rechazado" OR status = "cuarentena" OR salmonella_25g = "presencia" OR mesophilic_aerobic_cfu > 10000)';
        let labAlertParams = [company_id];
        let labApprovedWhere = 'company_id = ? AND status = "aprobado"';
        let labApprovedParams = [company_id];

        if (start_date) {
            rmWhere += ' AND DATE(created_at) >= ?';
            rmParams.push(start_date);
            batchWhere += ' AND DATE(started_at) >= ?';
            batchParams.push(start_date);
            pkgWhere += ' AND DATE(created_at) >= ?';
            pkgParams.push(start_date);
            pastWhere += ' AND DATE(created_at) >= ?';
            pastParams.push(start_date);
            labAlertWhere += ' AND DATE(sample_date) >= ?';
            labAlertParams.push(start_date);
            labApprovedWhere += ' AND DATE(sample_date) >= ?';
            labApprovedParams.push(start_date);
        }
        if (end_date) {
            rmWhere += ' AND DATE(created_at) <= ?';
            rmParams.push(end_date);
            batchWhere += ' AND DATE(started_at) <= ?';
            batchParams.push(end_date);
            pkgWhere += ' AND DATE(created_at) <= ?';
            pkgParams.push(end_date);
            pastWhere += ' AND DATE(created_at) <= ?';
            pastParams.push(end_date);
            labAlertWhere += ' AND DATE(sample_date) <= ?';
            labAlertParams.push(end_date);
            labApprovedWhere += ' AND DATE(sample_date) <= ?';
            labApprovedParams.push(end_date);
        }

        const [[rmStats]] = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(weight_lbs), 0) as total_lbs FROM egg_raw_materials WHERE ${rmWhere}`,
            rmParams
        );

        const [[batchStats]] = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(yield_liquid_lbs), 0) as total_yield_lbs FROM egg_production_batches WHERE ${batchWhere}`,
            batchParams
        );

        const [[pkgStats]] = await pool.query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total_batch_weight_lbs - dispatched_weight_lbs), 0) as total_pkg_lbs, COALESCE(SUM(units_packaged - dispatched_units), 0) as total_units FROM egg_packaging_records WHERE ${pkgWhere}`,
            pkgParams
        );

        const [[alertPast]] = await pool.query(
            `SELECT COUNT(*) as count FROM egg_pasteurization_logs WHERE ${pastWhere}`,
            pastParams
        );

        const [[alertLab]] = await pool.query(
            `SELECT COUNT(*) as count FROM egg_lab_micro_logs WHERE ${labAlertWhere}`,
            labAlertParams
        );

        const [[approvedLab]] = await pool.query(
            `SELECT COUNT(*) as count FROM egg_lab_micro_logs WHERE ${labApprovedWhere}`,
            labApprovedParams
        );

        res.json({
            raw_materials: {
                count: rmStats?.count || 0,
                total_lbs: parseFloat(rmStats?.total_lbs || 0)
            },
            production: {
                batches_count: batchStats?.count || 0,
                liquid_yield_lbs: parseFloat(batchStats?.total_yield_lbs || 0)
            },
            packaging: {
                records_count: pkgStats?.count || 0,
                total_pkg_lbs: parseFloat(pkgStats?.total_pkg_lbs || 0),
                total_units: parseInt(pkgStats?.total_units || 0, 10)
            },
            alerts: {
                total_alerts: (alertPast?.count || 0) + (alertLab?.count || 0),
                pasteurization_alerts: alertPast?.count || 0,
                lab_alerts: alertLab?.count || 0
            },
            quality_approved_count: approvedLab?.count || 0
        });
    } catch (error) {
        console.error('Error in getTraceability360Stats:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getTraceability360Stats };
