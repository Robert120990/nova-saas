const pool = require('../config/db');

const getProviders = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT p.*,
                   d.description AS departamento_nombre,
                   m.description AS municipio_nombre,
                   a.description AS actividad_nombre,
                   tp.description AS tipo_persona_nombre
            FROM providers p
            LEFT JOIN cat_012_departamento d ON p.departamento = d.code
            LEFT JOIN cat_013_municipio m ON p.municipio = m.code AND p.departamento = m.dep_code
            LEFT JOIN cat_019_actividad_economica a ON p.codigo_actividad = a.code
            LEFT JOIN cat_029_tipo_persona tp ON p.tipo_persona = tp.code
            WHERE p.company_id = ?
        `;
        let params = [req.company_id];

        if (search) {
            query += ` AND (p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.numero_documento LIKE ?) `;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY p.nombre ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener proveedores' });
    }
};

const validColumns = [
    'company_id', 'tipo_persona', 'pais', 'nombre', 'nombre_comercial', 
    'tipo_documento', 'numero_documento', 'nit', 'nrc', 
    'codigo_actividad', 'departamento', 'municipio', 'direccion', 
    'telefono', 'correo', 'tipo_contribuyente', 'es_gran_contribuyente', 'exento_iva'
];

const createProvider = async (req, res) => {
    const data = {};
    Object.keys(req.body).forEach(key => {
        if (validColumns.includes(key)) {
            data[key] = req.body[key] === '' ? null : req.body[key];
        }
    });

    if (data.nit) {
        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (!nitRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT inválido (0000-000000-000-0)' });
        }
    }

    data.company_id = req.company_id;
    if (!data.tipo_persona) data.tipo_persona = '1';
    if (!data.pais) data.pais = '9300';

    try {
        const [result] = await pool.query('INSERT INTO providers SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        console.error('Error al crear proveedor:', error.message, error.sqlMessage || '');
        res.status(500).json({ message: 'Error al crear proveedor: ' + (error.sqlMessage || error.message) });
    }
};

const updateProvider = async (req, res) => {
    const { id } = req.params;
    const data = {};
    Object.keys(req.body).forEach(key => {
        if (validColumns.includes(key)) {
            data[key] = req.body[key] === '' ? null : req.body[key];
        }
    });

    if (data.nit) {
        const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
        if (!nitRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT inválido (0000-000000-000-0)' });
        }
    }

    try {
        await pool.query('UPDATE providers SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        res.json({ message: 'Proveedor actualizado' });
    } catch (error) {
        console.error('Error al actualizar proveedor:', error.message, error.sqlMessage || '');
        res.status(500).json({ message: 'Error al actualizar proveedor: ' + (error.sqlMessage || error.message) });
    }
};

const deleteProvider = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM providers WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Proveedor eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar proveedor' });
    }
};

module.exports = { getProviders, createProvider, updateProvider, deleteProvider };
