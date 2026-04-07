const pool = require('../config/db');

const getDepartments = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cat_012_departamento ORDER BY code');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener departamentos' });
    }
};

const getMunicipalities = async (req, res) => {
    const { dep_code } = req.query;
    try {
        let query = 'SELECT * FROM cat_013_municipio';
        let params = [];
        if (dep_code) {
            query += ' WHERE dep_code = ?';
            params.push(dep_code);
        }
        query += ' ORDER BY code';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener municipios' });
    }
};

const getActividades = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cat_019_actividad_economica ORDER BY code');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener actividades econ\u00F3micas' });
    }
};

const getGenericCatalog = async (req, res) => {
    const { table } = req.params;
    // Allow any table starting with cat_ to avoid maintaining a whitelist for 30+ tables
    if (!table.startsWith('cat_')) {
        return res.status(400).json({ message: 'Cat\u00E1logo no permitido' });
    }
    try {
        const [rows] = await pool.query(`SELECT * FROM ${table} ORDER BY code`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cat\u00E1logo ' + table });
    }
};

module.exports = { getDepartments, getMunicipalities, getActividades, getGenericCatalog };
