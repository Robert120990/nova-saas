const pool = require('../../config/db');
const { getOfficeConfig, getOfficePool } = require('../officeDb.service');

const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function resolveOfficeEmpresa(officePool, companyId) {
    const [[setting]] = await pool.query(
        "SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = 'oficina_empresa_id'",
        [companyId]
    );
    if (setting?.setting_value) {
        const [rows] = await officePool.query('SELECT id, codigo, nombre FROM empresas WHERE id = ? OR codigo = ?', [setting.setting_value, setting.setting_value]);
        if (rows[0]) return rows[0];
    }

    const [[company]] = await pool.query('SELECT razon_social, nit, nrc FROM companies WHERE id = ?', [companyId]);
    if (!company) return null;

    const [officeEmpresas] = await officePool.query('SELECT id, codigo, nombre FROM empresas');
    const localNorm = normalize(company.razon_social);

    const matched = officeEmpresas.find(oe => {
        const oeNorm = normalize(oe.nombre);
        return oeNorm && (localNorm.includes(oeNorm) || oeNorm.includes(localNorm));
    });

    return matched || officeEmpresas[0] || null;
}

async function queryBankCheques(companyId, { startDate, endDate, month, year, status = 'unposted', anulado = 0 }) {
    if (month && year && (!startDate || !endDate)) {
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        const lastDay = new Date(y, m, 0).getDate();
        startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    const config = await getOfficeConfig(companyId);
    if (!config.host || !config.database) {
        throw new Error('Conexión a oficina no configurada. Configúrala en Ajustes Contables > Conexión Oficina.');
    }

    const officePool = getOfficePool(config);
    const empresa = await resolveOfficeEmpresa(officePool, companyId);
    if (!empresa) {
        throw new Error('No se pudo asociar la empresa actual con una empresa en la base de datos de oficina.');
    }

    const isAnulado = Number(anulado) === 1 ? 1 : 0;
    const [tables] = await officePool.query("SHOW TABLES LIKE 'cheques'");
    const hasChequesTable = tables.length > 0;

    let rows = [];
    if (hasChequesTable) {
        const sql = `
            SELECT c.id, c.fecha, c.cheque, c.valor AS monto, c.a_nombre AS beneficiario, c.concepto,
                   c.cheque_anulado, c.es_pago_contado, c.es_contabilizado, c.num_partida,
                   cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta,
                   b.descripcion AS banco_nombre
            FROM cheques c
            JOIN cuentas_bancarias cb ON c.cuenta_bancaria_id = cb.id
            LEFT JOIN bancos b ON cb.banco_id = b.id
            WHERE c.empresa_id = ?
              AND c.fecha >= ? AND c.fecha <= ?
              AND (c.cheque_anulado = ? OR (? = 0 AND c.cheque_anulado IS NULL))
            ORDER BY c.fecha ASC, c.cheque ASC
        `;
        const params = [empresa.id, startDate, endDate, isAnulado, isAnulado];
        [rows] = await officePool.query(sql, params);
    } else {
        const rrsEmpresaCode = empresa.codigo || 'E-1';
        const sql = `
            SELECT v.id, v.fecha, v.cheque, v.valor AS monto, v.a_nombre AS beneficiario, v.concepto,
                   v.cheque_anulado, v.es_pago_contado, v.es_contabilizado, v.num_partida,
                   cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta,
                   b.descripcion AS banco_nombre
            FROM vouchers v
            LEFT JOIN cuentas_bancarias cb ON cb.numero = v.numero_cuenta AND cb.id_empresa = v.id_empresa
            LEFT JOIN bancos b ON b.id = cb.cod_banco AND b.id_empresa = cb.id_empresa
            WHERE v.id_empresa = ?
              AND STR_TO_DATE(v.fecha, '%d/%m/%Y') >= ? AND STR_TO_DATE(v.fecha, '%d/%m/%Y') <= ?
              AND (v.cheque_anulado = ? OR (? = 0 AND v.cheque_anulado IS NULL))
            ORDER BY STR_TO_DATE(v.fecha, '%d/%m/%Y') ASC, v.cheque ASC
        `;
        const params = [rrsEmpresaCode, startDate, endDate, isAnulado, isAnulado];
        [rows] = await officePool.query(sql, params);
    }

    // Check Nova SaaS accounting_entries for linked entries
    const [localEntries] = await pool.query(
        "SELECT id, number, date, status, description FROM accounting_entries WHERE company_id = ? AND status <> 'voided' AND description LIKE '%CHEQUE%'",
        [companyId]
    );
    const entryByChq = new Map();
    localEntries.forEach(e => {
        const match = (e.description || '').match(/CHEQUE\s*#?\s*([0-9A-Za-z_-]+)/i);
        if (match && match[1]) entryByChq.set(String(match[1]).trim().toLowerCase(), e);
    });

    let mapped = rows.map(r => {
        const rawDate = r.fecha instanceof Date
            ? r.fecha.toISOString().slice(0, 10)
            : (/^\d{2}\/\d{2}\/\d{4}$/.test(String(r.fecha || ''))
                ? r.fecha.split('/').reverse().join('-')
                : String(r.fecha || '').slice(0, 10));

        const chqKey = String(r.cheque || '').trim();
        const localEntry = entryByChq.get(chqKey.toLowerCase());
        const officePartida = r.num_partida && String(r.num_partida).trim() !== '' ? String(r.num_partida).trim() : null;
        const corr = localEntry?.number || officePartida || '';
        const isPosted = Boolean(localEntry);

        const bancoDesc = (r.banco_nombre || '').trim();
        const ctaNum = (r.cuenta_numero || '').trim();
        const ctaNom = (r.cuenta_nombre || '').trim();
        const cuentaLabel = [bancoDesc, ctaNum, ctaNom].filter(Boolean).join(' - ');

        return {
            id: r.id,
            fecha: rawDate,
            cheque: chqKey,
            cuenta_numero: ctaNum,
            cuenta_nombre: ctaNom,
            banco_nombre: bancoDesc,
            cuenta_label: cuentaLabel || ctaNum || 'Sin cuenta',
            cuenta_cod_cta: (r.cuenta_cod_cta || '').trim(),
            beneficiario: (r.a_nombre || r.beneficiario || '').trim(),
            monto: parseFloat(r.monto) || 0,
            concepto: (r.concepto || '').trim(),
            condicion: (r.es_pago_contado === 1 || r.es_pago_contado === '1') ? 'CONTADO' : 'CREDITO',
            cheque_anulado: Boolean(r.cheque_anulado),
            es_contabilizado: isPosted,
            corr,
            existing_entry_id: localEntry?.id || null
        };
    });

    if (status === 'unposted') {
        mapped = mapped.filter(r => !r.es_contabilizado);
    } else if (status === 'posted') {
        mapped = mapped.filter(r => r.es_contabilizado);
    }

    return mapped;
}

async function queryBankMovements(companyId, { startDate, endDate, month, year, status = 'unposted' }) {
    if (month && year && (!startDate || !endDate)) {
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        const lastDay = new Date(y, m, 0).getDate();
        startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    const config = await getOfficeConfig(companyId);
    if (!config.host || !config.database) {
        throw new Error('Conexión a oficina no configurada. Configúrala en Ajustes Contables > Conexión Oficina.');
    }

    const officePool = getOfficePool(config);
    const empresa = await resolveOfficeEmpresa(officePool, companyId);
    if (!empresa) {
        throw new Error('No se pudo asociar la empresa actual con una empresa en la base de datos de oficina.');
    }

    const [cols] = await officePool.query("DESCRIBE movimientos_bancarios");
    const hasEmpresaId = cols.some(c => c.Field === 'empresa_id');
    const isDateType = cols.find(c => c.Field === 'fecha')?.Type?.startsWith('date');

    let rows = [];
    if (hasEmpresaId) {
        const sql = `
            SELECT m.id, m.fecha, m.documento AS referencia, m.concepto, m.monto, m.cargo, m.abono,
                   m.es_contabilizado, m.num_partida,
                   tr.codigo AS tipo_remesa_codigo, tr.descripcion AS tipo_remesa_desc,
                   cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta,
                   b.descripcion AS banco_nombre
            FROM movimientos_bancarios m
            JOIN cuentas_bancarias cb ON m.cuenta_bancaria_id = cb.id
            LEFT JOIN bancos b ON cb.banco_id = b.id
            LEFT JOIN tipos_remesas tr ON m.tipo_remesa_id = tr.id
            WHERE m.empresa_id = ?
              AND m.fecha >= ? AND m.fecha <= ?
            ORDER BY m.fecha ASC, m.id ASC
        `;
        const params = [empresa.id, startDate, endDate];
        [rows] = await officePool.query(sql, params);
    } else {
        const rrsEmpresaCode = empresa.codigo || 'E-1';
        const dateFilter = isDateType
            ? 'm.fecha >= ? AND m.fecha <= ?'
            : "STR_TO_DATE(m.fecha, '%d/%m/%Y') >= ? AND STR_TO_DATE(m.fecha, '%d/%m/%Y') <= ?";

        const sql = `
            SELECT m.id, m.fecha, m.documento AS referencia, m.concepto, m.monto, m.cargo, m.abono,
                   m.es_contabilizado, m.num_partida, m.cod_remesa AS tipo_remesa_codigo,
                   tr.descripcion AS tipo_remesa_desc,
                   cb.numero AS cuenta_numero, cb.nombre AS cuenta_nombre, cb.cod_cta AS cuenta_cod_cta,
                   b.descripcion AS banco_nombre
            FROM movimientos_bancarios m
            LEFT JOIN cuentas_bancarias cb ON cb.numero = m.numero_cuenta AND cb.id_empresa = m.id_empresa
            LEFT JOIN bancos b ON b.id = cb.cod_banco AND b.id_empresa = cb.id_empresa
            LEFT JOIN tipos_remesas tr ON tr.id = m.cod_remesa AND tr.id_empresa = m.id_empresa
            WHERE m.id_empresa = ? AND ${dateFilter}
            ${isDateType ? 'ORDER BY m.fecha ASC, m.id ASC' : "ORDER BY STR_TO_DATE(m.fecha, '%d/%m/%Y') ASC, m.id ASC"}
        `;
        const params = [rrsEmpresaCode, startDate, endDate];
        [rows] = await officePool.query(sql, params);
    }

    const [localEntries] = await pool.query(
        "SELECT id, number, date, status, description FROM accounting_entries WHERE company_id = ? AND status <> 'voided' AND description LIKE '%DOC%'",
        [companyId]
    );
    const entryByDoc = new Map();
    localEntries.forEach(e => {
        const match = (e.description || '').match(/DOC\s*#?\s*([0-9A-Za-z_-]+)/i);
        if (match && match[1]) entryByDoc.set(String(match[1]).trim().toLowerCase(), e);
    });

    let mapped = rows.map(r => {
        const rawDate = r.fecha instanceof Date
            ? r.fecha.toISOString().slice(0, 10)
            : (/^\d{2}\/\d{2}\/\d{4}$/.test(String(r.fecha || ''))
                ? r.fecha.split('/').reverse().join('-')
                : String(r.fecha || '').slice(0, 10));

        const docKey = String(r.referencia || '').trim();
        const localEntry = entryByDoc.get(docKey.toLowerCase());
        const officePartida = r.num_partida && String(r.num_partida).trim() !== '' ? String(r.num_partida).trim() : null;
        const corr = localEntry?.number || officePartida || '';
        const isPosted = Boolean(localEntry);

        const bancoDesc = (r.banco_nombre || '').trim();
        const ctaNum = (r.cuenta_numero || '').trim();
        const ctaNom = (r.cuenta_nombre || '').trim();
        const cuentaLabel = [bancoDesc, ctaNum, ctaNom].filter(Boolean).join(' - ');

        const tipoCod = String(r.tipo_remesa_codigo || '').trim();
        const tipoDesc = (r.tipo_remesa_desc || '').trim();
        const tipoMovimiento = tipoCod && tipoDesc ? `${tipoCod} - ${tipoDesc}` : (tipoDesc || tipoCod || 'MOVIMIENTO');

        return {
            id: r.id,
            fecha: rawDate,
            referencia: docKey,
            tipo_movimiento: tipoMovimiento,
            tipo_codigo: tipoCod,
            cuenta_numero: ctaNum,
            cuenta_nombre: ctaNom,
            banco_nombre: bancoDesc,
            cuenta_label: cuentaLabel || ctaNum || 'Sin cuenta',
            cuenta_cod_cta: (r.cuenta_cod_cta || '').trim(),
            concepto: (r.concepto || '').trim(),
            monto: parseFloat(r.monto || r.cargo || r.abono) || 0,
            cargo: parseFloat(r.cargo) || 0,
            abono: parseFloat(r.abono) || 0,
            es_contabilizado: isPosted,
            corr,
            existing_entry_id: localEntry?.id || null
        };
    });

    if (status === 'unposted') {
        mapped = mapped.filter(r => !r.es_contabilizado);
    } else if (status === 'posted') {
        mapped = mapped.filter(r => r.es_contabilizado);
    }

    return mapped;
}

module.exports = {
    resolveOfficeEmpresa,
    queryBankCheques,
    queryBankMovements
};
