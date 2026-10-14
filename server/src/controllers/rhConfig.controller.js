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

const getBancoFormatosConfig = async (req, res) => {
    try {
        const companyId = req.company_id;

        const [branches] = await pool.query(
            `SELECT id, nombre, codigo FROM branches WHERE company_id = ? ORDER BY nombre ASC`,
            [companyId]
        );

        const [departamentos] = await pool.query(
            `SELECT id, codigo, descripcion FROM rh_departamentos WHERE company_id = ? ORDER BY descripcion ASC`,
            [companyId]
        );

        const [configs] = await pool.query(
            `SELECT sucursal_id, departamento_id, formato_banco FROM rh_banco_formatos_config WHERE company_id = ?`,
            [companyId]
        );

        const sucursalesMap = new Map();
        const deptosMap = new Map();

        configs.forEach(c => {
            if (c.sucursal_id && !c.departamento_id) {
                sucursalesMap.set(c.sucursal_id, c.formato_banco);
            } else if (c.departamento_id && !c.sucursal_id) {
                deptosMap.set(c.departamento_id, c.formato_banco);
            }
        });

        const sucursalesList = branches.map(b => ({
            id: b.id,
            nombre: b.nombre,
            codigo: b.codigo,
            formato_banco: sucursalesMap.get(b.id) || 'promerica'
        }));

        const departamentosList = departamentos.map(d => ({
            id: d.id,
            descripcion: d.descripcion,
            codigo: d.codigo,
            formato_banco: deptosMap.get(d.id) || 'promerica'
        }));

        res.json({
            default_format: 'promerica',
            sucursales: sucursalesList,
            departamentos: departamentosList,
            configs
        });
    } catch (error) {
        console.error('[rhConfig getBancoFormatos] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const updateBancoFormatosConfig = async (req, res) => {
    try {
        const companyId = req.company_id;
        const { sucursales = [], departamentos = [] } = req.body;

        await pool.query(
            `DELETE FROM rh_banco_formatos_config WHERE company_id = ?`,
            [companyId]
        );

        const insertValues = [];

        for (const s of sucursales) {
            const format = (s.formato_banco || 'promerica').toLowerCase();
            if (s.id) {
                insertValues.push([companyId, s.id, null, format]);
            }
        }

        for (const d of departamentos) {
            const format = (d.formato_banco || 'promerica').toLowerCase();
            if (d.id) {
                insertValues.push([companyId, null, d.id, format]);
            }
        }

        if (insertValues.length > 0) {
            await pool.query(
                `INSERT INTO rh_banco_formatos_config (company_id, sucursal_id, departamento_id, formato_banco) VALUES ?`,
                [insertValues]
            );
        }

        res.json({ success: true, message: 'Configuración de formatos bancarios guardada con éxito' });
    } catch (error) {
        console.error('[rhConfig updateBancoFormatos] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getConfig, updateConfig, getBancoFormatosConfig, updateBancoFormatosConfig };

