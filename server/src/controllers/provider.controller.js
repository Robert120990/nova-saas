const pool = require('../config/db');
const { validateDocumentNumber } = require('../utils/svfeValidators');

const getProviders = async (req, res) => {
    try {
        const { search, page = 1, limit = 15, es_credito, all } = req.query;

        let query = `
            SELECT p.*,
                   d.description AS departamento_nombre,
                   m.description AS municipio_nombre,
                   dist.description AS distrito_nombre,
                   a.description AS actividad_nombre,
                   tp.description AS tipo_persona_nombre
            FROM providers p
            LEFT JOIN cat_012_departamento d ON p.departamento = d.code
            LEFT JOIN cat_013_municipio m ON p.municipio = m.code AND p.departamento = m.dep_code
            LEFT JOIN cat_008_distrito dist ON p.distrito = dist.code AND p.departamento = dist.dep_code
            LEFT JOIN cat_019_actividad_economica a ON p.codigo_actividad = a.code
            LEFT JOIN cat_029_tipo_persona tp ON p.tipo_persona = tp.code
            WHERE p.company_id = ?
        `;
        let params = [req.company_id];

        if (es_credito === '1') {
            query += ' AND p.es_credito = 1';
        }

        const getSearchWords = (term) => {
            const words = term.trim().split(/\s+/).filter(Boolean);
            return [...new Set(words)];
        };

        const searchWords = search ? getSearchWords(search) : [];
        searchWords.forEach(word => {
            query += ` AND (p.nombre LIKE ? OR p.nombre_comercial LIKE ? OR p.nit LIKE ? OR p.nrc LIKE ? OR p.numero_documento LIKE ?) `;
            const searchTerm = `%${word}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        });

        // Retornar lista completa sin paginar si se solicita all=true o limit=all
        if (all === 'true' || limit === 'all') {
            query += ` ORDER BY p.nombre ASC`;
            const [rows] = await pool.query(query, params);
            return res.json({
                data: rows,
                total: rows.length,
                page: 1,
                totalPages: 1
            });
        }

        const parsedLimit = Math.max(1, parseInt(limit, 10) || 15);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;

        // Count total for pagination
        const countQuery = `SELECT COUNT(*) as total FROM (${query}) as sub`;
        const [countResult] = await pool.query(countQuery, params);
        const total = countResult[0]?.total || 0;

        // Final query with pagination
        query += ` ORDER BY p.nombre ASC LIMIT ? OFFSET ?`;
        params.push(parsedLimit, offset);

        const [rows] = await pool.query(query, params);
        res.json({
            data: rows,
            total,
            page: parsedPage,
            totalPages: Math.ceil(total / parsedLimit)
        });
    } catch (error) {
        console.error('Error al obtener proveedores:', error);
        res.status(500).json({ message: 'Error al obtener proveedores' });
    }
};

const validColumns = [
    'company_id', 'tipo_persona', 'pais', 'nombre', 'nombre_comercial', 
    'tipo_documento', 'numero_documento', 'nit', 'nrc', 
    'codigo_actividad', 'condicion_fiscal', 'departamento', 'municipio', 'distrito', 'direccion', 
    'telefono', 'correo', 'tipo_contribuyente', 'es_gran_contribuyente', 'exento_iva', 'es_credito', 'dias_credito'
];

const sanitizeProviderPayload = (body, companyId) => {
    const data = {};
    Object.keys(body).forEach(key => {
        if (validColumns.includes(key)) {
            data[key] = body[key] === '' ? null : body[key];
        }
    });

    const isForeign = data.tipo_documento === 'Pasaporte' || 
                      data.tipo_documento === 'Carnet Resident' || 
                      data.tipo_documento === 'Otro' || 
                      data.tipo_documento === '03' || 
                      data.tipo_documento === '02' || 
                      data.tipo_documento === '37' || 
                      data.condicion_fiscal === 'extranjero';

    if (isForeign) {
        data.nit = null;
        data.nrc = null;
        if (!data.tipo_documento || data.tipo_documento === 'NIT' || data.tipo_documento === 'DUI') {
            data.tipo_documento = 'Otro';
        }
        if (!data.departamento) data.departamento = '00';
        if (!data.municipio) data.municipio = '00';
        if (!data.distrito) data.distrito = '00';
        data.condicion_fiscal = 'extranjero';
    }

    if (data.nit && !isForeign) {
        const nitVal = validateDocumentNumber(data.nit, 'NIT');
        if (!nitVal.isValid) {
            throw new Error(`NIT inválido: ${nitVal.error}`);
        }
    }

    if (data.numero_documento) {
        const docVal = validateDocumentNumber(data.numero_documento, data.tipo_documento);
        if (!docVal.isValid) {
            throw new Error(`Documento inválido: ${docVal.error}`);
        }
    }

    if (data.correo !== undefined) {
        if (data.correo) {
            const correoTrimmed = String(data.correo).trim();
            if (correoTrimmed) {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(correoTrimmed)) {
                    throw new Error('El correo electrónico no tiene un formato válido (ejemplo: proveedor@dominio.com)');
                }
                data.correo = correoTrimmed;
            } else {
                data.correo = null;
            }
        } else {
            data.correo = null;
        }
    }

    if (data.codigo_actividad) {
        const actStr = String(data.codigo_actividad).trim();
        if (actStr.length === 4 && /^\d+$/.test(actStr)) {
            data.codigo_actividad = actStr.padStart(5, '0');
        }
    }

    // Normalización de condición fiscal según NRC:
    if (!data.nrc && (!data.condicion_fiscal || data.condicion_fiscal === 'contribuyente')) {
        data.condicion_fiscal = 'otro';
    } else if (data.nrc && data.condicion_fiscal === 'otro') {
        data.condicion_fiscal = 'contribuyente';
    }

    // Sincronización con tipo_contribuyente y es_gran_contribuyente
    if (data.condicion_fiscal === 'gran contribuyente') {
        data.es_gran_contribuyente = 1;
        data.tipo_contribuyente = 'Gran Contribuyente';
    } else if (data.condicion_fiscal === 'extranjero') {
        data.es_gran_contribuyente = 0;
        data.tipo_contribuyente = 'No Domiciliado';
    } else if (data.condicion_fiscal === 'exento IVA') {
        data.es_gran_contribuyente = 0;
        data.exento_iva = 1;
        data.tipo_contribuyente = 'Otro';
    } else {
        data.es_gran_contribuyente = 0;
        data.tipo_contribuyente = data.condicion_fiscal === 'contribuyente' ? 'Contribuyente' : 'Otro';
    }

    data.company_id = companyId;
    if (!data.tipo_persona) {
        data.tipo_persona = (data.tipo_documento === 'NIT' || data.nrc) ? '2' : '1';
    }
    if (!data.pais) data.pais = '9579';

    if (data.departamento) data.departamento = String(data.departamento).trim() || null;
    if (data.municipio) data.municipio = String(data.municipio).trim() || null;
    if (data.distrito) data.distrito = String(data.distrito).trim() || null;
    if (data.direccion) data.direccion = String(data.direccion).trim() || null;

    return data;
};

const createProvider = async (req, res) => {
    try {
        const data = sanitizeProviderPayload(req.body, req.company_id);
        const [result] = await pool.query('INSERT INTO providers SET ?', [data]);
        res.status(201).json({ id: result.insertId, ...data });
    } catch (error) {
        console.error('Error al crear proveedor:', error.message, error.sqlMessage || '');
        const statusCode = error.message.includes('inválido') || error.message.includes('formato') ? 400 : 500;
        res.status(statusCode).json({ message: error.message });
    }
};

const updateProvider = async (req, res) => {
    const { id } = req.params;
    try {
        const data = sanitizeProviderPayload(req.body, req.company_id);
        await pool.query('UPDATE providers SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
        res.json({ message: 'Proveedor actualizado', data });
    } catch (error) {
        console.error('Error al actualizar proveedor:', error.message, error.sqlMessage || '');
        const statusCode = error.message.includes('inválido') || error.message.includes('formato') ? 400 : 500;
        res.status(statusCode).json({ message: error.message });
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
