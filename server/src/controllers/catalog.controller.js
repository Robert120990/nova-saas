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

const getDistritos = async (req, res) => {
    const { dep_code } = req.query;
    try {
        let query = 'SELECT * FROM cat_008_distrito';
        let params = [];
        if (dep_code) {
            query += ' WHERE dep_code = ?';
            params.push(dep_code);
        }
        query += ' ORDER BY code';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener distritos' });
    }
};

const getGenericCatalog = async (req, res) => {
    const { table } = req.params;
    
    // Validar estrictamente que solo contenga cat_ seguido de caracteres alfanuméricos y guiones bajos (máximo 64 chars)
    const validTablePattern = /^cat_[a-zA-Z0-9_]{1,60}$/;
    if (!validTablePattern.test(table)) {
        return res.status(400).json({ message: 'Catálogo no permitido o formato inválido' });
    }

    try {
        const [rows] = await pool.query(`SELECT * FROM \`${table}\` ORDER BY code`);
        res.json(rows);
    } catch (error) {
        console.error(`Error al consultar catálogo ${table}:`, error.message);
        res.status(500).json({ message: 'Error al obtener catálogo solicitado' });
    }
};

module.exports = { getDepartments, getMunicipalities, getActividades, getDistritos, getGenericCatalog };
