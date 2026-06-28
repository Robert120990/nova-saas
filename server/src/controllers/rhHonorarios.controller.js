const pool = require('../config/db');
const { numberToWords } = require('../utils/numberToWords');

const TABLE = 'rh_honorarios';
const LABEL = 'Honorario';

const getNextCode = async (req, res) => {
    try {
        const [maxResult] = await pool.query(
            `SELECT COALESCE(MAX(CAST(numero AS UNSIGNED)), 0) + 1 as next FROM ${TABLE} WHERE company_id = ?`,
            [req.company_id]
        );
        const nextCode = String(maxResult[0].next).padStart(5, '0');
        res.json({ numero: nextCode });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getHonorarios = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT * FROM ${TABLE} WHERE company_id = ?`;
        let params = [req.company_id];

        if (search) {
            query += ` AND (nombre LIKE ? OR num_dui LIKE ? OR num_nit LIKE ? OR concepto LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM (${query}) as sub`, params);
        const total = countResult[0].total;

        query += ` ORDER BY fecha DESC, id DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(query, params);
        res.json({ data: rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getHonorario = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`SELECT * FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createHonorario = async (req, res) => {
    try {
        const { numero, fecha, nombre, num_dui, num_nit, concepto, monto, renta_isr, liquido_pagar } = req.body;

        const [result] = await pool.query(
            `INSERT INTO ${TABLE} (company_id, numero, fecha, nombre, num_dui, num_nit, concepto, monto, renta_isr, liquido_pagar)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, numero, fecha, nombre, num_dui || null, num_nit || null, concepto || null,
             monto || 0, renta_isr || 0, liquido_pagar || 0]
        );
        res.status(201).json({ id: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'El numero de honorario ya existe en esta empresa' });
        }
        res.status(500).json({ message: error.message });
    }
};

const updateHonorario = async (req, res) => {
    try {
        const { id } = req.params;
        const { numero, fecha, nombre, num_dui, num_nit, concepto, monto, renta_isr, liquido_pagar } = req.body;

        const [result] = await pool.query(
            `UPDATE ${TABLE} SET numero = ?, fecha = ?, nombre = ?, num_dui = ?, num_nit = ?, concepto = ?, monto = ?, renta_isr = ?, liquido_pagar = ?
             WHERE id = ? AND company_id = ?`,
            [numero, fecha, nombre, num_dui || null, num_nit || null, concepto || null,
             monto || 0, renta_isr || 0, liquido_pagar || 0, id, req.company_id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ id });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'El numero de honorario ya existe en esta empresa' });
        }
        res.status(500).json({ message: error.message });
    }
};

const deleteHonorario = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query(`DELETE FROM ${TABLE} WHERE id = ? AND company_id = ?`, [id, req.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        res.json({ message: `${LABEL} eliminado` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const exportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT h.*, comp.razon_social as company_name, comp.nit as company_nit, comp.logo_url
             FROM ${TABLE} h
             JOIN companies comp ON h.company_id = comp.id
             WHERE h.id = ? AND h.company_id = ?`,
            [id, req.company_id]
        );

        if (rows.length === 0) return res.status(404).json({ message: `${LABEL} no encontrado` });
        const p = rows[0];

        const pdfData = {
            company_name: p.company_name,
            company_nit: p.company_nit,
            logo_url: p.logo_url,
            numero: p.numero,
            fecha: p.fecha,
            nombre: p.nombre,
            num_dui: p.num_dui,
            num_nit: p.num_nit,
            concepto: p.concepto,
            monto: p.monto,
            renta_isr: p.renta_isr,
            liquido_pagar: p.liquido_pagar,
            monto_letras: numberToWords(parseFloat(p.liquido_pagar))
        };

        const { generateHonorarioPDF } = require('../services/pdf.service');
        const pdfBuffer = await generateHonorarioPDF(pdfData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Honorario_${p.numero}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[Honorarios PDF] Error:', error);
        res.status(500).json({ message: 'Error al generar PDF' });
    }
};

module.exports = {
    getNextCode, getHonorarios, getHonorario, createHonorario, updateHonorario, deleteHonorario, exportPDF
};
