const pool = require('../config/db');

const TABLE = 'rh_config';

const getConfig = async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE company_id = ?`, [req.company_id]);
        if (rows.length === 0) {
            await pool.query(`INSERT INTO ${TABLE} (company_id) VALUES (?)`, [req.company_id]);
            return res.json({
                id: null,
                company_id: req.company_id,
                responsable_nombre: '',
                firma_url: '',
                sello_url: '',
                notario_nombre: '',
                notario_domicilio: '',
                notario_departamento: '',
                calculo_renta_modo: 'segunda_quincena'
            });
        }
        res.json({
            ...rows[0],
            calculo_renta_modo: rows[0].calculo_renta_modo || 'segunda_quincena'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateConfig = async (req, res) => {
    try {
        const {
            responsable_nombre,
            notario_nombre,
            notario_domicilio,
            notario_departamento,
            calculo_renta_modo,
            patrono_nombre,
            patrono_edad,
            patrono_sexo,
            patrono_estado_civil,
            patrono_profesion,
            patrono_direccion,
            patrono_nacionalidad,
            patrono_dui,
            patrono_dui_extendido,
            patrono_nit
        } = req.body;
        const data = {};

        if (responsable_nombre !== undefined) data.responsable_nombre = responsable_nombre || '';
        if (notario_nombre !== undefined) data.notario_nombre = notario_nombre || '';
        if (notario_domicilio !== undefined) data.notario_domicilio = notario_domicilio || '';
        if (notario_departamento !== undefined) data.notario_departamento = notario_departamento || '';
        if (calculo_renta_modo !== undefined) {
            data.calculo_renta_modo = calculo_renta_modo === 'cada_quincena' ? 'cada_quincena' : 'segunda_quincena';
        }
        if (patrono_nombre !== undefined) data.patrono_nombre = patrono_nombre || '';
        if (patrono_edad !== undefined) data.patrono_edad = patrono_edad !== '' && patrono_edad !== null ? parseInt(patrono_edad, 10) : null;
        if (patrono_sexo !== undefined) data.patrono_sexo = patrono_sexo || 'MASCULINO';
        if (patrono_estado_civil !== undefined) data.patrono_estado_civil = patrono_estado_civil || 'CASADO';
        if (patrono_profesion !== undefined) data.patrono_profesion = patrono_profesion || '';
        if (patrono_direccion !== undefined) data.patrono_direccion = patrono_direccion || '';
        if (patrono_nacionalidad !== undefined) data.patrono_nacionalidad = patrono_nacionalidad || 'SALVADOREÑA';
        if (patrono_dui !== undefined) data.patrono_dui = patrono_dui || '';
        if (patrono_dui_extendido !== undefined) data.patrono_dui_extendido = patrono_dui_extendido || '';
        if (patrono_nit !== undefined) data.patrono_nit = patrono_nit || '';

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
            if (data.responsable_nombre === undefined) data.responsable_nombre = '';
            if (data.notario_nombre === undefined) data.notario_nombre = '';
            if (data.notario_domicilio === undefined) data.notario_domicilio = '';
            if (data.notario_departamento === undefined) data.notario_departamento = '';
            if (data.calculo_renta_modo === undefined) data.calculo_renta_modo = 'segunda_quincena';
            const [result] = await pool.query(`INSERT INTO ${TABLE} SET ?`, [data]);
            res.json({ id: result.insertId, ...data });
        } else {
            if (Object.keys(data).length > 0) {
                await pool.query(`UPDATE ${TABLE} SET ? WHERE company_id = ?`, [data, req.company_id]);
            }
            const [updated] = await pool.query(`SELECT * FROM ${TABLE} WHERE company_id = ?`, [req.company_id]);
            res.json({
                ...updated[0],
                calculo_renta_modo: updated[0].calculo_renta_modo || 'segunda_quincena'
            });
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

