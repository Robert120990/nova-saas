const pool = require('../config/db');
const { validateDocumentNumber } = require('../utils/svfeValidators');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('../services/excel.service');

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

/**
 * Reporte / Catálogo de Proveedores en PDF (Landscape) y Excel
 */
const getProvidersReportPDF = async (req, res) => {
    try {
        const { search, es_credito } = req.query;
        const companyId = req.company_id || req.user?.company_id;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

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
        let params = [companyId];

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

        query += ` ORDER BY p.nombre ASC`;

        const [rows] = await pool.query(query, params);

        if (req.query.format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                sheets: [{
                    name: 'Proveedores',
                    columns: [
                        { header: 'Proveedor / Razón Social', key: 'nombre', width: 35 },
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
                    data: rows.map(p => ({
                        nombre: p.nombre,
                        comercial: p.nombre_comercial || '---',
                        documento: p.nit || p.numero_documento || '---',
                        nrc: p.nrc || '---',
                        condicion: p.condicion_fiscal || 'Contribuyente',
                        departamento: p.departamento_nombre || p.departamento || '---',
                        municipio: p.municipio_nombre || p.municipio || '---',
                        direccion: p.direccion || '---',
                        telefono: p.telefono || '---',
                        correo: p.correo || '---',
                        credito: p.es_credito ? `SÍ (${p.dias_credito || 0}d)` : 'NO'
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'catalogo-proveedores.xlsx');
        }

        const subtitle = `CATÁLOGO GENERAL DE PROVEEDORES${search ? `   |   BÚSQUEDA: "${search}"` : ''}`;
        const periodText = `GENERADO: ${reportPdfHelper.formatDate(new Date())}`;

        const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');
        const startX = 30;
        const contentWidth = 732; // Letter landscape (792 - 60)

        reportPdfHelper.renderHeader(doc, company, 'Catálogo de Proveedores', periodText, 'landscape', subtitle);

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
            doc.text('PROVEEDOR / RAZÓN SOCIAL', x, yPos + 3); x += colW.nombre;
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
            doc.text('No se encontraron proveedores registrados.', startX, currentY + 10);
            currentY += 30;
        } else {
            rows.forEach((p) => {
                if (currentY > 510) {
                    doc.addPage();
                    currentY = drawTableHeader(35);
                }

                doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
                let x = startX + 4;
                doc.text(reportPdfHelper.fitText(doc, p.nombre || '---', colW.nombre - 6), x, currentY, { lineBreak: false }); x += colW.nombre;
                
                doc.font('Helvetica').fillColor('#334155');
                doc.text(reportPdfHelper.fitText(doc, p.nit || p.numero_documento || '---', colW.documento - 6), x, currentY, { lineBreak: false }); x += colW.documento;
                doc.text(reportPdfHelper.fitText(doc, p.nrc || '---', colW.nrc - 6), x, currentY, { lineBreak: false }); x += colW.nrc;
                doc.text(reportPdfHelper.fitText(doc, p.condicion_fiscal || 'Contribuyente', colW.condicion - 6), x, currentY, { lineBreak: false }); x += colW.condicion;
                
                const ubicacionStr = [p.municipio_nombre || p.municipio, p.departamento_nombre || p.departamento].filter(Boolean).join(', ') || '---';
                doc.text(reportPdfHelper.fitText(doc, ubicacionStr, colW.ubicacion - 6), x, currentY, { lineBreak: false }); x += colW.ubicacion;

                const contactoStr = [p.telefono, p.correo].filter(Boolean).join(' | ') || '---';
                doc.text(reportPdfHelper.fitText(doc, contactoStr, colW.contacto - 6), x, currentY, { lineBreak: false }); x += colW.contacto;

                const creditoStr = p.es_credito ? `Crédito (${p.dias_credito || 0}d)` : 'Contado';
                doc.text(reportPdfHelper.fitText(doc, creditoStr, colW.credito - 6), x, currentY, { lineBreak: false });

                currentY += 12;
            });
        }

        reportPdfHelper.renderClosingFooter(doc, startX, currentY + 10, rows.length, 'Proveedores');
        reportPdfHelper.renderPageNumbers(doc);

        doc.end();
        const pdfBuffer = await getBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=catalogo-proveedores.pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error al generar reporte de proveedores en PDF:', error);
        res.status(500).json({ message: 'Error al generar reporte de proveedores: ' + error.message });
    }
};

module.exports = { getProviders, createProvider, updateProvider, deleteProvider, getProvidersReportPDF };

