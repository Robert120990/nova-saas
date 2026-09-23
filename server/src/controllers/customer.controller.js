const pool = require('../config/db');
const { validateDocumentNumber } = require('../utils/svfeValidators');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('../services/excel.service');

const getCustomers = async (req, res) => {
    try {
        const { search, nombre, nit, nrc, page = 1, limit = 15, es_credito, es_anticipado, es_trupput, ids_only, skip_count, all } = req.query;

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
        if (es_trupput === '1') {
            whereClause += ` AND c.es_trupput = 1 `;
        }

        if (ids_only === '1') {
            const [rows] = await pool.query(
                `SELECT c.id FROM customers c ${whereClause} ORDER BY c.nombre ASC`,
                params
            );
            return res.json(rows.map(r => r.id));
        }

        if (all === 'true' || limit === 'all') {
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
                ORDER BY c.nombre ASC
            `, params);
            return res.json({ data: rows, total: rows.length, page: 1, totalPages: 1 });
        }

        const parsedLimit = Math.max(1, parseInt(limit, 10) || 15);
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;

        let total = 0;
        const shouldSkipCount = skip_count === '1' || skip_count === 'true';
        if (!shouldSkipCount) {
            const countQuery = `SELECT COUNT(*) as total FROM customers c ${whereClause}`;
            const [countResult] = await pool.query(countQuery, params);
            total = countResult[0]?.total || 0;
        }

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
        `, [...params, parsedLimit, offset]);

        if (shouldSkipCount) {
            total = rows.length;
        }

        res.json({
            data: rows,
            total,
            page: parsedPage,
            totalPages: Math.ceil(total / parsedLimit)
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
    'es_credito', 'es_anticipado', 'es_trupput', 'dias_credito'
];

const createCustomer = async (req, res) => {
    const data = {};
    Object.keys(req.body).forEach(key => {
        if (validColumns.includes(key)) {
            data[key] = req.body[key] === '' ? null : req.body[key];
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
        if (!data.tipo_documento || data.tipo_documento === 'NIT' || data.tipo_documento === 'DUI') {
            data.tipo_documento = 'Otro';
        }
        if (!data.departamento) data.departamento = '00';
        if (!data.municipio) data.municipio = '00';
        if (!data.distrito) data.distrito = '00';
    }

    if (data.nit && !isForeign) {
        const nitVal = validateDocumentNumber(data.nit, 'NIT');
        if (!nitVal.isValid) {
            return res.status(400).json({ message: `NIT inválido: ${nitVal.error}` });
        }
    }

    if (data.numero_documento) {
        const docVal = validateDocumentNumber(data.numero_documento, data.tipo_documento);
        if (!docVal.isValid) {
            return res.status(400).json({ message: `Documento inválido: ${docVal.error}` });
        }
    }

    if (data.correo !== undefined) {
        if (data.correo) {
            const correoTrimmed = String(data.correo).trim();
            if (correoTrimmed) {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(correoTrimmed)) {
                    return res.status(400).json({ message: 'El correo electrónico no tiene un formato válido (ejemplo: cliente@dominio.com)' });
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
    // Sin NRC no es contribuyente de IVA; se normaliza a 'otro' (consumidor final)
    if (!data.nrc && (!data.condicion_fiscal || data.condicion_fiscal === 'contribuyente')) {
        data.condicion_fiscal = 'otro';
    } else if (data.nrc && data.condicion_fiscal === 'otro') {
        data.condicion_fiscal = 'contribuyente';
    }

    data.company_id = req.company_id;
    if (!data.tipo_persona) data.tipo_persona = '1';
    if (!data.pais) data.pais = '9579';
    if (data.aplica_fovial === undefined || data.aplica_fovial === null) data.aplica_fovial = 1;
    if (data.aplica_cotrans === undefined || data.aplica_cotrans === null) data.aplica_cotrans = 1;

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

    const isForeign = data.tipo_documento === 'Pasaporte' || 
                      data.tipo_documento === 'Carnet Resident' || 
                      data.tipo_documento === 'Otro' || 
                      data.tipo_documento === '03' || 
                      data.tipo_documento === '02' || 
                      data.tipo_documento === '37' || 
                      data.condicion_fiscal === 'extranjero';

    if (isForeign) {
        data.nit = null;
        if (!data.tipo_documento || data.tipo_documento === 'NIT' || data.tipo_documento === 'DUI') {
            data.tipo_documento = 'Otro';
        }
        if (!data.departamento) data.departamento = '00';
        if (!data.municipio) data.municipio = '00';
        if (!data.distrito) data.distrito = '00';
    }

    if (data.nit && !isForeign) {
        const nitVal = validateDocumentNumber(data.nit, 'NIT');
        if (!nitVal.isValid) {
            return res.status(400).json({ message: `NIT inválido: ${nitVal.error}` });
        }
    }

    if (data.numero_documento) {
        const docVal = validateDocumentNumber(data.numero_documento, data.tipo_documento);
        if (!docVal.isValid) {
            return res.status(400).json({ message: `Documento inválido: ${docVal.error}` });
        }
    }

    if (data.correo !== undefined) {
        if (data.correo) {
            const correoTrimmed = String(data.correo).trim();
            if (correoTrimmed) {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(correoTrimmed)) {
                    return res.status(400).json({ message: 'El correo electrónico no tiene un formato válido (ejemplo: cliente@dominio.com)' });
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
    if (data.nrc !== undefined || data.condicion_fiscal !== undefined) {
        if (!data.nrc && data.condicion_fiscal === 'contribuyente') {
            data.condicion_fiscal = 'otro';
        } else if (data.nrc && data.condicion_fiscal === 'otro') {
            data.condicion_fiscal = 'contribuyente';
        }
    }

    try {
        await pool.query('UPDATE customers SET ? WHERE id = ? AND company_id = ?', [data, id, req.company_id]);
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
            WHERE c.id = ? AND c.company_id = ?
        `, [id, req.company_id]);
        res.json({ message: 'Cliente actualizado', data: rows[0] || null });
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

const getCustomerById = async (req, res) => {
    const { id } = req.params;
    try {
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
            WHERE c.id = ? AND c.company_id = ?
        `, [id, req.company_id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Cliente no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener cliente:', error.message);
        res.status(500).json({ message: 'Error al obtener cliente: ' + error.message });
    }
};

/**
 * Reporte / Catálogo de Clientes en PDF (Landscape) y Excel
 */
const getCustomersReportPDF = async (req, res) => {
    try {
        const { search, condicion_fiscal, es_credito } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let whereClause = 'WHERE c.company_id = ?';
        let params = [companyId];

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

        if (condicion_fiscal) {
            whereClause += ` AND c.condicion_fiscal = ? `;
            params.push(condicion_fiscal);
        }

        if (es_credito === '1') {
            whereClause += ` AND c.es_credito = 1 `;
        }

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
            ORDER BY c.nombre ASC
        `, params);

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Clientes',
                    columns: [
                        { header: 'Nombre / Razón Social', key: 'nombre', width: 35 },
                        { header: 'Nombre Comercial', key: 'comercial', width: 25 },
                        { header: 'Documento', key: 'documento', width: 18 },
                        { header: 'NRC', key: 'nrc', width: 14 },
                        { header: 'Condición Fiscal', key: 'condicion', width: 20 },
                        { header: 'Departamento', key: 'departamento', width: 18 },
                        { header: 'Municipio', key: 'municipio', width: 20 },
                        { header: 'Dirección', key: 'direccion', width: 35 },
                        { header: 'Teléfono', key: 'telefono', width: 15 },
                        { header: 'Correo', key: 'correo', width: 25 },
                        { header: 'Crédito', key: 'credito', width: 16 }
                    ],
                    data: rows.map(c => ({
                        nombre: c.nombre,
                        comercial: c.nombre_comercial || '---',
                        documento: c.nit || c.numero_documento || '---',
                        nrc: c.nrc || '---',
                        condicion: c.condicion_fiscal || 'Consumidor Final',
                        departamento: c.departamento_nombre || c.departamento || '---',
                        municipio: c.municipio_nombre || c.municipio || '---',
                        direccion: c.direccion || '---',
                        telefono: c.telefono || '---',
                        correo: c.correo || '---',
                        credito: c.es_credito ? `SÍ (${c.dias_credito || 0}d)` : 'NO'
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'catalogo-clientes.xlsx');
        }

        const subtitle = `CATÁLOGO GENERAL DE CLIENTES${search ? `   |   BÚSQUEDA: "${search}"` : ''}`;
        const periodText = `GENERADO: ${reportPdfHelper.formatDate(new Date())}`;

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732; // Letter landscape (792 - 60)

        reportPdfHelper.renderHeader(doc, company, 'Catálogo de Clientes', periodText, 'landscape', subtitle);

        const colW = {
            nombre: 175,
            documento: 75,
            nrc: 50,
            condicion: 72,
            ubicacion: 130,
            contacto: 100,
            credito: 130
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 4;
            doc.text('NOMBRE / RAZÓN SOCIAL', x, yPos + 3); x += colW.nombre;
            doc.text('DOCUMENTO', x, yPos + 3); x += colW.documento;
            doc.text('NRC', x, yPos + 3); x += colW.nrc;
            doc.text('CONDICIÓN', x, yPos + 3); x += colW.condicion;
            doc.text('UBICACIÓN', x, yPos + 3); x += colW.ubicacion;
            doc.text('CONTACTO', x, yPos + 3); x += colW.contacto;
            doc.text('COND. CRÉDITO', x, yPos + 3);
            return yPos + 16;
        };

        let currentY = drawTableHeader(doc.y + 4);

        if (rows.length === 0) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron clientes registrados.', startX, currentY + 10);
            currentY += 30;
        } else {
            rows.forEach((c) => {
                if (currentY > 510) {
                    doc.addPage();
                    currentY = drawTableHeader(35);
                }

                doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
                let x = startX + 4;
                doc.text(reportPdfHelper.fitText(doc, c.nombre || '---', colW.nombre - 6), x, currentY, { lineBreak: false }); x += colW.nombre;
                
                doc.font('Helvetica').fillColor('#334155');
                doc.text(reportPdfHelper.fitText(doc, c.nit || c.numero_documento || '---', colW.documento - 6), x, currentY, { lineBreak: false }); x += colW.documento;
                doc.text(reportPdfHelper.fitText(doc, c.nrc || '---', colW.nrc - 6), x, currentY, { lineBreak: false }); x += colW.nrc;
                doc.text(reportPdfHelper.fitText(doc, c.condicion_fiscal || 'Consumidor Final', colW.condicion - 6), x, currentY, { lineBreak: false }); x += colW.condicion;
                
                const ubicacionStr = [c.municipio_nombre || c.municipio, c.departamento_nombre || c.departamento].filter(Boolean).join(', ') || '---';
                doc.text(reportPdfHelper.fitText(doc, ubicacionStr, colW.ubicacion - 6), x, currentY, { lineBreak: false }); x += colW.ubicacion;

                const contactoStr = [c.telefono, c.correo].filter(Boolean).join(' | ') || '---';
                doc.text(reportPdfHelper.fitText(doc, contactoStr, colW.contacto - 6), x, currentY, { lineBreak: false }); x += colW.contacto;

                const creditoStr = c.es_credito ? `Crédito (${c.dias_credito || 0}d)` : 'Contado';
                doc.text(reportPdfHelper.fitText(doc, creditoStr, colW.credito - 6), x, currentY, { lineBreak: false });

                currentY += 12;
            });
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY + 10, rows.length, 'Clientes');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=catalogo-clientes.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al generar reporte de clientes en PDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de clientes: ' + error.message });
    }
};

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, deleteBatchCustomers, getCustomersReportPDF };


