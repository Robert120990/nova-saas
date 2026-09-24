const pool = require('../config/db');
const cache = require('../config/cache');

const getDepartments = async (req, res) => {
    try {
        const rows = await cache.getOrSet('cat:012:departamentos', async () => {
            const [dbRows] = await pool.query('SELECT * FROM cat_012_departamento ORDER BY code');
            return dbRows;
        }, 86400);
        res.json(rows);
    } catch {
        res.status(500).json({ message: 'Error al obtener departamentos' });
    }
};

const getMunicipalities = async (req, res) => {
    const { dep_code } = req.query;
    const cacheKey = dep_code ? `cat:013:municipios:${dep_code}` : 'cat:013:municipios:all';
    try {
        const rows = await cache.getOrSet(cacheKey, async () => {
            let query = 'SELECT * FROM cat_013_municipio';
            let params = [];
            if (dep_code) {
                query += ' WHERE dep_code = ?';
                params.push(dep_code);
            }
            query += ' ORDER BY code';
            const [dbRows] = await pool.query(query, params);
            return dbRows;
        }, 86400);
        res.json(rows);
    } catch {
        res.status(500).json({ message: 'Error al obtener municipios' });
    }
};

const getActividades = async (req, res) => {
    try {
        const rows = await cache.getOrSet('cat:019:actividades', async () => {
            const [dbRows] = await pool.query('SELECT * FROM cat_019_actividad_economica ORDER BY code');
            return dbRows;
        }, 86400);
        res.json(rows);
    } catch {
        res.status(500).json({ message: 'Error al obtener actividades económicas' });
    }
};

const getDistritos = async (req, res) => {
    const { dep_code } = req.query;
    const cacheKey = dep_code ? `cat:008:distritos:${dep_code}` : 'cat:008:distritos:all';
    try {
        const rows = await cache.getOrSet(cacheKey, async () => {
            let query = 'SELECT * FROM cat_008_distrito';
            let params = [];
            if (dep_code) {
                query += ' WHERE dep_code = ?';
                params.push(dep_code);
            }
            query += ' ORDER BY code';
            const [dbRows] = await pool.query(query, params);
            return dbRows;
        }, 86400);
        res.json(rows);
    } catch {
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
        const rows = await cache.getOrSet(`cat:generic:${table}`, async () => {
            const [dbRows] = await pool.query(`SELECT * FROM \`${table}\` ORDER BY 1`);
            return dbRows;
        }, 86400);
        res.json(rows);
    } catch (error) {
        console.error(`Error al consultar catálogo ${table}:`, error.message);
        res.status(500).json({ message: 'Error al obtener catálogo solicitado' });
    }
};

const getCatalogStatus = (req, res) => {
    const { getPreloadStatus } = require('../services/catalogCache.service');
    res.json(getPreloadStatus());
};

const refreshCatalogs = async (req, res) => {
    try {
        const { preloadHaciendaCatalogs } = require('../services/catalogCache.service');
        const status = await preloadHaciendaCatalogs();
        res.json({ message: 'Catálogos de Hacienda recargados exitosamente', status });
    } catch {
        res.status(500).json({ message: 'Error recargando catálogos' });
    }
};

module.exports = {
    getDepartments,
    getMunicipalities,
    getActividades,
    getDistritos,
    getGenericCatalog,
    getCatalogStatus,
    refreshCatalogs
};
