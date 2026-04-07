const pool = require('../config/db');

const getCustomers = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        console.log(`[DEBUG] getCustomers: company_id=${req.company_id}, search=${search}, page=${page}`);
        let query = `
            SELECT c.*,
                   d.description AS departamento_nombre,
                   m.description AS municipio_nombre,
                   a.description AS actividad_nombre,
                   tp.description AS tipo_persona_nombre
            FROM customers c
            LEFT JOIN cat_012_departamento d ON c.departamento = d.code
            LEFT JOIN cat_013_municipio m ON c.municipio = m.code AND c.departamento = m.dep_code
            LEFT JOIN cat_019_actividad_economica a ON c.codigo_actividad = a.code
            LEFT JOIN cat_029_tipo_persona tp ON c.tipo_persona = tp.code
            WHERE c.company_id = ?
        `;
        let params = [req.company_id];

        if (search) {
            query += ` AND (c.nombre LIKE ? OR c.nombre_comercial LIKE ? OR c.nit LIKE ? OR c.numero_documento LIKE ?) `;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        // Final query with pagination
        query += ` ORDER BY c.nombre ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        console.log(`[DEBUG] getCustomers: found ${rows.length} rows, total=${total}`);
        res.json({
            data: rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener clientes' });
    }
};

const validColumns = [
    'company_id', 'tipo_persona', 'tipo_contribuyente', 'nombre', 'nombre_comercial', 
    'tipo_documento', 'numero_documento', 'nit', 'nrc', 
    'codigo_actividad', 'condicion_fiscal', 'pais', 'departamento', 
    'municipio', 'direccion', 'telefono', 'correo', 
    'aplica_iva', 'exento_iva', 'aplica_fovial', 'aplica_cotrans'
];

const createCustomer = async (req, res) => {
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
        const [result] = await pool.query('INSERT INTO customers SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        console.error('Error al crear cliente:', error.message, error.sqlMessage || '');
        res.status(500).json({ message: 'Error al crear cliente: ' + (error.sqlMessage || error.message) });
    }
};

const updateCustomer = async (req, res) => {
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
        await pool.query('UPDATE customers SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        res.json({ message: 'Cliente actualizado' });
    } catch (error) {
        console.error('Error al actualizar cliente:', error.message, error.sqlMessage || '');
        res.status(500).json({ message: 'Error al actualizar cliente: ' + (error.sqlMessage || error.message) });
    }
};

const deleteCustomer = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM customers WHERE id = ? AND company_id = ?', [id, req.company_id]);
        res.json({ message: 'Cliente eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar cliente' });
    }
};

module.exports = { getCustomers, createCustomer, updateCustomer, deleteCustomer };
