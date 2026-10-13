const pool = require('../../config/db');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

async function findIvaCreditoAccount(companyId) {
    const [[setting]] = await pool.query(
        "SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = 'CUENTA_IVA_CREDITO'",
        [companyId]
    );
    if (setting?.setting_value) {
        const [[acc]] = await pool.query(
            "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND (id = ? OR code = ?) AND allows_entries = 1",
            [companyId, setting.setting_value, setting.setting_value]
        );
        if (acc) return acc;
    }
    const [rows] = await pool.query(
        "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND allows_entries = 1 AND active = 1 AND (code = '11090101' OR code = '110206' OR name LIKE '%Crédito Fiscal por Compras%' OR name LIKE '%IVA CREDITO FISCAL%') ORDER BY (code = '11090101') DESC LIMIT 1",
        [companyId]
    );
    return rows[0] || null;
}

async function findRetencionAccount(companyId) {
    const [[setting]] = await pool.query(
        "SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key IN ('CUENTA_IVA_RETENIDO', 'CUENTA_RETENCIONES_IVA')",
        [companyId]
    );
    if (setting?.setting_value) {
        const [[acc]] = await pool.query(
            "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND (id = ? OR code = ?) AND allows_entries = 1",
            [companyId, setting.setting_value, setting.setting_value]
        );
        if (acc) return acc;
    }
    const [rows] = await pool.query(
        "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND allows_entries = 1 AND active = 1 AND (code = '21040203' OR code = '2106020201' OR code LIKE '2108%' OR name LIKE '%Retenciones IVA%' OR name LIKE '%IVA Retenido%') ORDER BY (code = '21040203') DESC LIMIT 1",
        [companyId]
    );
    return rows[0] || null;
}

async function findPercepcionAccount(companyId) {
    const [[setting]] = await pool.query(
        "SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = 'CUENTA_IVA_PERCIBIDO'",
        [companyId]
    );
    if (setting?.setting_value) {
        const [[acc]] = await pool.query(
            "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND (id = ? OR code = ?) AND allows_entries = 1",
            [companyId, setting.setting_value, setting.setting_value]
        );
        if (acc) return acc;
    }
    const [rows] = await pool.query(
        "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND allows_entries = 1 AND active = 1 AND (code = '11090103' OR code = '1102010305' OR name LIKE '%PERCEPCIONES 1%' OR name LIKE '%RETENCIONES 1%') ORDER BY (code = '11090103') DESC LIMIT 1",
        [companyId]
    );
    return rows[0] || null;
}

function calculateTaxBreakdown({ monto, detallarIva = true, taxDetailMode = 'none' }) {
    const totalPaid = round2(monto);
    if (!detallarIva || totalPaid <= 0) {
        return { subtotal: totalPaid, iva: 0, retPer: 0, totalPaid, taxDetailMode: 'none' };
    }

    let subtotal = 0;
    let iva = 0;
    let retPer = 0;

    if (taxDetailMode === 'retencion') {
        subtotal = round2(totalPaid / 1.12);
        retPer = round2(subtotal * 0.01);
        iva = round2(subtotal * 0.13);
        const diff = round2((subtotal + iva - retPer) - totalPaid);
        if (diff !== 0) subtotal = round2(subtotal - diff);
    } else if (taxDetailMode === 'percepcion') {
        subtotal = round2(totalPaid / 1.14);
        retPer = round2(subtotal * 0.01);
        iva = round2(subtotal * 0.13);
        const diff = round2((subtotal + iva + retPer) - totalPaid);
        if (diff !== 0) subtotal = round2(subtotal - diff);
    } else {
        subtotal = round2(totalPaid / 1.13);
        iva = round2(totalPaid - subtotal);
    }

    return { subtotal, iva, retPer, totalPaid, taxDetailMode };
}

const officeSchemaCache = new Map();

async function fetchOfficeBankDoc(officePool, type, id) {
    if (type === 'cheque') {
        let hasChequesTable = officeSchemaCache.get('has_cheques_table');
        if (hasChequesTable === undefined) {
            const [tables] = await officePool.query("SHOW TABLES LIKE 'cheques'");
            hasChequesTable = tables.length > 0;
            officeSchemaCache.set('has_cheques_table', hasChequesTable);
        }

        if (hasChequesTable) {
            const [rows] = await officePool.query(`
                SELECT c.*, cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta, b.descripcion AS banco_nombre
                FROM cheques c
                JOIN cuentas_bancarias cb ON c.cuenta_bancaria_id = cb.id
                LEFT JOIN bancos b ON cb.banco_id = b.id
                WHERE c.id = ?
            `, [id]);
            return rows[0] || null;
        }
        const [rows] = await officePool.query(`
            SELECT v.*, cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta, b.descripcion AS banco_nombre
            FROM vouchers v
            LEFT JOIN cuentas_bancarias cb ON cb.numero = v.numero_cuenta AND cb.id_empresa = v.id_empresa
            LEFT JOIN bancos b ON b.id = cb.cod_banco AND b.id_empresa = cb.id_empresa
            WHERE v.id = ? OR v.llave = ?
        `, [id, id]);
        return rows[0] || null;
    }

    let hasEmpresaId = officeSchemaCache.get('mov_has_empresa_id');
    if (hasEmpresaId === undefined) {
        const [cols] = await officePool.query("DESCRIBE movimientos_bancarios");
        hasEmpresaId = cols.some(c => c.Field === 'empresa_id');
        officeSchemaCache.set('mov_has_empresa_id', hasEmpresaId);
    }

    if (hasEmpresaId) {
        const [rows] = await officePool.query(`
            SELECT m.*, m.documento AS referencia, tr.codigo AS tipo_remesa_codigo, tr.descripcion AS tipo_remesa_desc,
                   cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta, b.descripcion AS banco_nombre
            FROM movimientos_bancarios m
            JOIN cuentas_bancarias cb ON m.cuenta_bancaria_id = cb.id
            LEFT JOIN bancos b ON cb.banco_id = b.id
            LEFT JOIN tipos_remesas tr ON m.tipo_remesa_id = tr.id
            WHERE m.id = ?
        `, [id]);
        return rows[0] || null;
    }
    const [rows] = await officePool.query(`
        SELECT m.*, m.documento AS referencia, m.cod_remesa AS tipo_remesa_codigo, tr.descripcion AS tipo_remesa_desc,
               cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta, b.descripcion AS banco_nombre
        FROM movimientos_bancarios m
        LEFT JOIN cuentas_bancarias cb ON cb.numero = m.numero_cuenta AND cb.id_empresa = m.id_empresa
        LEFT JOIN bancos b ON b.id = cb.cod_banco AND b.id_empresa = cb.id_empresa
        LEFT JOIN tipos_remesas tr ON tr.id = m.cod_remesa AND tr.id_empresa = m.id_empresa
        WHERE m.id = ? OR m.llave = ?
    `, [id, id]);
    return rows[0] || null;
}

async function findCajaGeneralAccount(companyId) {
    const [settings] = await pool.query(
        "SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key IN ('CUENTA_CAJA', 'CUENTA_CHEQUES') ORDER BY (setting_key = 'CUENTA_CAJA') DESC LIMIT 1",
        [companyId]
    );
    if (settings[0]?.setting_value) {
        const val = settings[0].setting_value;
        const [[acc]] = await pool.query(
            "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND (id = ? OR code = ?) AND allows_entries = 1",
            [companyId, val, val]
        );
        if (acc) return acc;
    }
    const [rows] = await pool.query(
        "SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND allows_entries = 1 AND active = 1 AND (code = '110101' OR name LIKE '%CAJA GENERAL%') ORDER BY (code = '110101') DESC LIMIT 1",
        [companyId]
    );
    return rows[0] || null;
}

async function findCounterpartAccount(companyId, searchTerms = []) {
    for (const term of searchTerms) {
        const clean = (term || '').replace(/[,.-].*$/, '').trim();
        if (clean.length < 3) continue;
        const [rows] = await pool.query(
            'SELECT id, code, name FROM chart_of_accounts WHERE company_id = ? AND allows_entries = 1 AND active = 1 AND name LIKE ? LIMIT 1',
            [companyId, `%${clean.slice(0, 20)}%`]
        );
        if (rows[0]) return rows[0];
    }
    return await findCajaGeneralAccount(companyId);
}

async function getEntryTypeIdByCode(code) {
    const [[row]] = await pool.query('SELECT id FROM entry_types WHERE code = ?', [code]);
    return row ? row.id : 1;
}

module.exports = {
    findIvaCreditoAccount,
    findRetencionAccount,
    findPercepcionAccount,
    findCajaGeneralAccount,
    findCounterpartAccount,
    getEntryTypeIdByCode,
    calculateTaxBreakdown,
    fetchOfficeBankDoc,
    round2
};
