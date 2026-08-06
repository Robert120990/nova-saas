const pool = require('../config/db');

const getCustomers = async (req, res) => {
    try {
        const { search, nombre, nit, nrc, page = 1, limit = 15, es_credito, es_anticipado, ids_only } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE c.company_id = ?';
        let params = [req.company_id];

        const getSearchWords = (term) => {
            const words = term.trim().split(/\s+/).filter(Boolean);
            return [...new Set(words)];
        };

        const searchWords = search ? getSearchWords(search) : [];
        searchWords.forEach(word => {
            whereClause += ` AND (c.nombre LIKE ? OR c.nombre_comercial LIKE ? OR c.nit LIKE ? OR c.numero_documento LIKE ? OR c.nrc LIKE ?) `;
            const searchTerm = `%${word}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        });

        const nombreWords = nombre ? getSearchWords(nombre) : [];
        nombreWords.forEach(word => {
            whereClause += ` AND (c.nombre LIKE ? OR c.nombre_comercial LIKE ?) `;
            const searchTerm = `%${word}%`;
            params.push(searchTerm, searchTerm);
        });

        if (nit) {
            whereClause += ` AND c.nit LIKE ? `;
            params.push(`%${nit}%`);
        }

        if (nrc) {
            whereClause += ` AND c.nrc LIKE ? `;
            params.push(`%${nrc}%`);
        }

        if (es_credito === '1') {
            whereClause += ` AND c.es_credito = 1 `;
        }
        if (es_anticipado === '1') {
            whereClause += ` AND c.es_anticipado = 1 `;
        }

        if (ids_only === '1') {
            const [rows] = await pool.query(
                `SELECT c.id FROM customers c ${whereClause} ORDER BY c.nombre ASC`,
                params
            );
            return res.json(rows.map(r => r.id));
        }

        const countQuery = `SELECT COUNT(*) as total FROM customers c ${whereClause}`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0].total;

        const [rows] = await pool.query(`
            SELECT c.*,
                   d.description AS departamento_nombre,
                   m.description AS municipio_nombre,
                   dist.description AS distrito_nombre,
                   a.description AS actividad_nombre,
                   tp.description AS tipo_persona_nombre
            FROM customers c
            LEFT JOIN cat_012_departamento d ON c.departamento = d.code
            LEFT JOIN cat_013_municipio m ON c.municipio = m.code AND c.departamento = m.dep_code
            LEFT JOIN cat_008_distrito dist ON c.distrito = dist.code AND c.departamento = dist.dep_code
            LEFT JOIN cat_019_actividad_economica a ON c.codigo_actividad = a.code
            LEFT JOIN cat_029_tipo_persona tp ON c.tipo_persona = tp.code
            ${whereClause}
            ORDER BY c.nombre ASC LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

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
    'municipio', 'distrito', 'direccion', 'telefono', 'correo', 
    'exento_iva', 'aplica_fovial', 'aplica_cotrans',
    'es_credito', 'es_anticipado'
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
        const duiRegex = /^\d{8}-\d{1}$/;
        if (!nitRegex.test(data.nit) && !duiRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT o DUI inválido' });
        }
    }

    data.company_id = req.company_id;
    if (!data.tipo_persona) data.tipo_persona = '1';
    if (!data.pais) data.pais = '9579';

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
        const duiRegex = /^\d{8}-\d{1}$/;
        if (!nitRegex.test(data.nit) && !duiRegex.test(data.nit)) {
            return res.status(400).json({ message: 'Formato de NIT o DUI inválido' });
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

const deleteBatchCustomers = async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Debe proporcionar un array de IDs' });
    }
    try {
        const [result] = await pool.query(
            'DELETE FROM customers WHERE id IN (?) AND company_id = ?',
            [ids, req.company_id]
        );
        res.json({ message: `${result.affectedRows} cliente(s) eliminado(s)` });
    } catch (error) {
        console.error('Error al eliminar clientes:', error.message);
        res.status(500).json({ message: 'Error al eliminar clientes' });
    }
};

module.exports = { getCustomers, createCustomer, updateCustomer, deleteCustomer, deleteBatchCustomers };
