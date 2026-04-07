/**
 * Signature Test Controller
 */

const { signWithInternalSigner } = require('../services/signature/internalSignerService');
const { signWithExternalSigner } = require('../services/signature/externalSignerService');
const pool = require('../../config/db');

async function testInternal(req, res) {
    const { dteJson, password } = req.body;
    try {
        const [company] = await pool.query('SELECT certificate_path, certificate_password FROM companies WHERE id = ?', [req.company_id]);
        if (!company[0].certificate_path) throw new Error('Certificado no configurado');

        const result = await signWithInternalSigner(
            dteJson || { test: "data" },
            company[0].certificate_path,
            password || company[0].certificate_password
        );

        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

async function testExternal(req, res) {
    const { dteJson, nit, password } = req.body;
    try {
        const [company] = await pool.query('SELECT nit, certificate_password FROM companies WHERE id = ?', [req.company_id]);
        
        const result = await signWithExternalSigner(
            dteJson || { test: "data" },
            nit || company[0].nit,
            password || company[0].certificate_password
        );

        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = { testInternal, testExternal };
