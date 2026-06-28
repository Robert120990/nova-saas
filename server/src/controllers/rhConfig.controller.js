const pool = require('../config/db');

const TABLE = 'rh_config';

const getConfig = async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE company_id = ?`, [req.company_id]);
        if (rows.length === 0) {
            await pool.query(`INSERT INTO ${TABLE} (company_id) VALUES (?)`, [req.company_id]);
            return res.json({ id: null, company_id: req.company_id, responsable_nombre: '', firma_url: '', sello_url: '', notario_nombre: '', notario_domicilio: '', notario_departamento: '' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateConfig = async (req, res) => {
    try {
        const { responsable_nombre, notario_nombre, notario_domicilio, notario_departamento } = req.body;
        const data = {
            responsable_nombre: responsable_nombre || '',
            notario_nombre: notario_nombre || '',
            notario_domicilio: notario_domicilio || '',
            notario_departamento: notario_departamento || ''
        };

        if (req.files) {
            if (req.files.firma && req.files.firma.length > 0) {
                data.firma_url = '/uploads/' + req.files.firma[0].filename;
            }
            if (req.files.sello && req.files.sello.length > 0) {
                data.sello_url = '/uploads/' + req.files.sello[0].filename;
            }
        }

        const [existing] = await pool.query(`SELECT id FROM ${TABLE} WHERE company_id = ?`, [req.company_id]);

        if (existing.length === 0) {
            data.company_id = req.company_id;
            const [result] = await pool.query(`INSERT INTO ${TABLE} SET ?`, [data]);
            res.json({ id: result.insertId, ...data });
        } else {
            await pool.query(`UPDATE ${TABLE} SET ? WHERE company_id = ?`, [data, req.company_id]);
            const [updated] = await pool.query(`SELECT * FROM ${TABLE} WHERE company_id = ?`, [req.company_id]);
            res.json(updated[0]);
        }
    } catch (error) {
        console.error('[rhConfig update] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getConfig, updateConfig };
