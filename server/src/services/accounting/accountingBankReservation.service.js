const pool = require('../../config/db');
const { getOfficeConfig, getOfficePool } = require('../officeDb.service');
const { resolveOfficeEmpresa } = require('./accountingBankQuery.service');

const parseFormattedDate = (d) => {
    if (!d) return 0;
    if (d instanceof Date) return d.getTime();
    const str = String(d).trim();
    if (str.includes('/')) {
        const [day, mon, yr] = str.split('/');
        return new Date(`${yr}-${mon}-${day}`).getTime();
    }
    return new Date(str).getTime();
};

const formatDateOutput = (d) => {
    if (!d) return '';
    if (d instanceof Date) {
        const day = String(d.getUTCDate()).padStart(2, '0');
        const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yr = d.getUTCFullYear();
        return `${day}/${mon}/${yr}`;
    }
    const str = String(d).trim();
    if (str.includes('/')) return str;
    if (str.includes('-')) {
        const parts = str.slice(0, 10).split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str;
};

/**
 * High-performance batch updater using SQL CASE WHEN in chunks.
 */
async function batchUpdate(poolConn, tableName, idCol, valCol, items, extraWhereSql = '', extraParams = [], extraSetSql = '') {
    if (!items || !items.length) return 0;
    const CHUNK_SIZE = 200;
    let totalUpdated = 0;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const cases = chunk.map(() => `WHEN ${idCol} = ? THEN ?`).join(' ');
        const params = [];
        chunk.forEach(it => params.push(it.id, (it.num || '').trim()));
        const ids = chunk.map(it => it.id);
        params.push(ids, ...extraParams);
        const extraSet = extraSetSql ? `, ${extraSetSql}` : '';
        const sql = `UPDATE ${tableName} SET ${valCol} = CASE ${cases} END ${extraSet} WHERE ${idCol} IN (?) ${extraWhereSql}`;
        const [res] = await poolConn.query(sql, params);
        totalUpdated += (res.affectedRows || chunk.length);
    }
    return totalUpdated;
}

/**
 * Queries movements for reservation of accounting correlatives.
 */
async function queryReservationMovements(companyId, { month, year, type = 'ingresos' }) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (!m || !y) throw new Error('Mes y año requeridos');

    const config = await getOfficeConfig(companyId);
    if (!config.host || !config.database) {
        throw new Error('Conexión a oficina no configurada. Configúrala en Ajustes Contables > Conexión Oficina.');
    }

    const officePool = getOfficePool(config);
    const empresa = await resolveOfficeEmpresa(officePool, companyId);
    if (!empresa) {
        throw new Error('No se pudo asociar la empresa actual con una empresa en la base de datos de oficina.');
    }

    const mm = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();
    const startDate = `${y}-${mm}-01`;
    const endDate = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;

    const [chqTables] = await officePool.query("SHOW TABLES LIKE 'cheques'");
    const hasChequesTable = chqTables.length > 0;

    const [mbCols] = await officePool.query("DESCRIBE movimientos_bancarios");
    const hasEmpresaId = mbCols.some(c => c.Field === 'empresa_id');
    const isDateType = mbCols.find(c => c.Field === 'fecha')?.Type?.startsWith('date');
    const hasMbLlave = mbCols.some(c => c.Field === 'llave');
    const empresaCode = empresa.codigo || 'E-1';

    if (type === 'ingresos') {
        let rows = [];
        if (hasEmpresaId) {
            const sql = `
                SELECT m.id, m.fecha, m.documento AS referencia, 
                       COALESCE(m.monto, m.cargo, m.abono, 0) AS monto,
                       m.concepto, m.num_partida AS num,
                       ${hasMbLlave ? 'm.llave' : "CONCAT('MVB', LPAD(m.id, 17, '0'))"} AS llave,
                       'movimiento' AS origen
                FROM movimientos_bancarios m
                LEFT JOIN tipos_remesas tr ON m.tipo_remesa_id = tr.id
                WHERE m.empresa_id = ?
                  AND m.fecha >= ? AND m.fecha <= ?
                  AND (tr.codigo IN ('01', 'RM') OR m.cargo > 0)
                ORDER BY m.fecha ASC, m.id ASC
            `;
            [rows] = await officePool.query(sql, [empresa.id, startDate, endDate]);
        } else {
            const dateFilter = isDateType
                ? 'm.fecha >= ? AND m.fecha <= ?'
                : "STR_TO_DATE(m.fecha, '%d/%m/%Y') >= ? AND STR_TO_DATE(m.fecha, '%d/%m/%Y') <= ?";
            const sql = `
                SELECT m.id, m.fecha, m.documento AS referencia, 
                       COALESCE(m.monto, m.cargo, m.abono, 0) AS monto,
                       m.concepto, m.num_partida AS num,
                       ${hasMbLlave ? 'm.llave' : "CONCAT('MVB', LPAD(m.id, 17, '0'))"} AS llave,
                       'movimiento' AS origen
                FROM movimientos_bancarios m
                WHERE m.id_empresa = ? AND ${dateFilter}
                  AND (m.cod_remesa = '01' OR m.cargo > 0)
                ORDER BY ${isDateType ? 'm.fecha ASC' : "STR_TO_DATE(m.fecha, '%d/%m/%Y') ASC"}, m.id ASC
            `;
            [rows] = await officePool.query(sql, [empresaCode, startDate, endDate]);
        }

        return rows.map(r => ({
            id: r.id,
            fecha: formatDateOutput(r.fecha),
            referencia: String(r.referencia || '').trim(),
            monto: parseFloat(r.monto) || 0,
            concepto: String(r.concepto || '').trim(),
            llave: String(r.llave || `MVB${String(r.id).padStart(17, '0')}`).trim(),
            num: String(r.num || '').trim(),
            origen: 'movimiento'
        }));
    }

    if (type === 'egresos') {
        let rowsMb = [];
        if (hasEmpresaId) {
            const sql = `
                SELECT m.id, m.fecha, m.documento AS referencia, 
                       COALESCE(m.monto, m.abono, m.cargo, 0) AS monto,
                       m.concepto, m.num_partida AS num,
                       ${hasMbLlave ? 'm.llave' : "CONCAT('MVB', LPAD(m.id, 17, '0'))"} AS llave,
                       'movimiento' AS origen
                FROM movimientos_bancarios m
                LEFT JOIN tipos_remesas tr ON m.tipo_remesa_id = tr.id
                WHERE m.empresa_id = ?
                  AND m.fecha >= ? AND m.fecha <= ?
                  AND (tr.codigo NOT IN ('01', 'RM') OR m.abono > 0)
                ORDER BY m.fecha ASC, m.id ASC
            `;
            [rowsMb] = await officePool.query(sql, [empresa.id, startDate, endDate]);
        } else {
            const dateFilter = isDateType
                ? 'm.fecha >= ? AND m.fecha <= ?'
                : "STR_TO_DATE(m.fecha, '%d/%m/%Y') >= ? AND STR_TO_DATE(m.fecha, '%d/%m/%Y') <= ?";
            const sql = `
                SELECT m.id, m.fecha, m.documento AS referencia, 
                       COALESCE(m.monto, m.abono, m.cargo, 0) AS monto,
                       m.concepto, m.num_partida AS num,
                       ${hasMbLlave ? 'm.llave' : "CONCAT('MVB', LPAD(m.id, 17, '0'))"} AS llave,
                       'movimiento' AS origen
                FROM movimientos_bancarios m
                WHERE m.id_empresa = ? AND ${dateFilter}
                  AND (m.cod_remesa <> '01' OR m.abono > 0)
                ORDER BY ${isDateType ? 'm.fecha ASC' : "STR_TO_DATE(m.fecha, '%d/%m/%Y') ASC"}, m.id ASC
            `;
            [rowsMb] = await officePool.query(sql, [empresaCode, startDate, endDate]);
        }

        let rowsChq = [];
        if (hasChequesTable) {
            const [chqCols] = await officePool.query("DESCRIBE cheques");
            const hasChqLlave = chqCols.some(c => c.Field === 'llave');
            const sql = `
                SELECT c.id, c.fecha, c.cheque AS referencia,
                       c.valor AS monto, c.concepto, c.num_partida AS num,
                       ${hasChqLlave ? 'c.llave' : "CONCAT('CHQ', LPAD(c.id, 17, '0'))"} AS llave,
                       'cheque' AS origen
                FROM cheques c
                WHERE c.empresa_id = ?
                  AND c.fecha >= ? AND c.fecha <= ?
                  AND (c.cheque_anulado = 0 OR c.cheque_anulado IS NULL)
                ORDER BY c.fecha ASC, c.cheque ASC
            `;
            [rowsChq] = await officePool.query(sql, [empresa.id, startDate, endDate]);
        } else {
            const sql = `
                SELECT v.id, v.fecha, v.cheque AS referencia,
                       v.valor AS monto, v.concepto, v.num_partida AS num,
                       COALESCE(v.llave, CONCAT('CHQ', LPAD(v.id, 17, '0'))) AS llave,
                       'cheque' AS origen
                FROM vouchers v
                WHERE v.id_empresa = ?
                  AND STR_TO_DATE(v.fecha, '%d/%m/%Y') >= ? AND STR_TO_DATE(v.fecha, '%d/%m/%Y') <= ?
                  AND (v.cheque_anulado = 0 OR v.cheque_anulado IS NULL)
                ORDER BY STR_TO_DATE(v.fecha, '%d/%m/%Y') ASC, v.cheque ASC
            `;
            [rowsChq] = await officePool.query(sql, [empresaCode, startDate, endDate]);
        }

        const combined = [...rowsMb, ...rowsChq].map(r => ({
            id: r.id,
            fecha: formatDateOutput(r.fecha),
            rawDate: r.fecha,
            referencia: String(r.referencia || '').trim(),
            monto: parseFloat(r.monto) || 0,
            concepto: String(r.concepto || '').trim(),
            llave: String(r.llave || '').trim(),
            num: String(r.num || '').trim(),
            origen: r.origen
        }));

        combined.sort((a, b) => {
            const da = parseFormattedDate(a.rawDate || a.fecha);
            const db = parseFormattedDate(b.rawDate || b.fecha);
            if (da !== db) return da - db;
            if (a.num && b.num) return a.num.localeCompare(b.num);
            if (a.num) return -1;
            if (b.num) return 1;
            return (a.llave || '').localeCompare(b.llave || '');
        });

        return combined;
    }

    if (type === 'diario') {
        const [pTables] = await officePool.query("SHOW TABLES LIKE 'cabecera_partidas'");
        if (pTables.length > 0) {
            const sqlDiario = `
                SELECT corr AS id, fecha, '' AS referencia, 
                       COALESCE(cargo, abono, 0) AS monto, 
                       concepto, cod_partida AS llave, correlativo AS num, 'diario' AS origen
                FROM cabecera_partidas
                WHERE id_empresa = ?
                  AND cod_tipo_partida = '03'
                  AND (
                    CASE WHEN fecha LIKE '%/%/%' 
                         THEN STR_TO_DATE(fecha, '%d/%m/%Y') 
                         ELSE CAST(fecha AS DATE) 
                    END BETWEEN ? AND ?
                  )
                ORDER BY 
                  CASE WHEN fecha LIKE '%/%/%' 
                       THEN STR_TO_DATE(fecha, '%d/%m/%Y') 
                       ELSE CAST(fecha AS DATE) 
                  END ASC, cod_partida ASC
            `;
            const [rowsDiario] = await officePool.query(sqlDiario, [empresaCode, startDate, endDate]);
            return rowsDiario.map(r => ({
                id: r.id,
                fecha: formatDateOutput(r.fecha),
                referencia: '',
                monto: parseFloat(r.monto) || 0,
                concepto: String(r.concepto || '').trim(),
                llave: String(r.llave || '').trim(),
                num: String(r.num || '').trim(),
                origen: 'diario'
            }));
        }

        const sqlSaas = `
            SELECT e.id, e.date AS fecha, '' AS referencia,
                   COALESCE(e.total_debit, e.total_credit, 0) AS monto,
                   e.description AS concepto,
                   CONCAT('ASG', LPAD(e.id, 17, '0')) AS llave,
                   e.number AS num,
                   'diario' AS origen
            FROM accounting_entries e
            JOIN entry_types et ON e.entry_type_id = et.id
            WHERE e.company_id = ?
              AND (et.code = 'DIARIO' OR et.name LIKE '%Diaria%' OR e.description LIKE '%CIERRE%')
              AND e.date >= ? AND e.date <= ?
              AND e.status <> 'voided'
            ORDER BY e.date ASC, e.id ASC
        `;
        const [saasRows] = await pool.query(sqlSaas, [companyId, startDate, endDate]);
        return saasRows.map(r => ({
            id: r.id,
            fecha: formatDateOutput(r.fecha),
            referencia: '',
            monto: parseFloat(r.monto) || 0,
            concepto: String(r.concepto || '').trim(),
            llave: String(r.llave || `ASG${String(r.id).padStart(17, '0')}`).trim(),
            num: String(r.num || '').trim(),
            origen: 'diario'
        }));
    }

    return [];
}

/**
 * Persists updated correlatives to the database using ultrafast batch CASE updates.
 */
async function saveReservationCorrelativos(companyId, { month, year, type, items = [] }) {
    const validItems = (Array.isArray(items) ? items : []).filter(
        it => it.id && it.num !== undefined && String(it.num).trim() !== ''
    );
    if (!validItems.length) return { success: true, updated_count: 0 };

    const config = await getOfficeConfig(companyId);
    if (!config.host || !config.database) throw new Error('Conexión a oficina no configurada');

    const officePool = getOfficePool(config);
    const empresa = await resolveOfficeEmpresa(officePool, companyId);
    if (!empresa) throw new Error('Empresa no encontrada en base de datos de oficina');

    const [chqTables] = await officePool.query("SHOW TABLES LIKE 'cheques'");
    const hasChequesTable = chqTables.length > 0;

    const [mbCols] = await officePool.query("DESCRIBE movimientos_bancarios");
    const hasEmpresaId = mbCols.some(c => c.Field === 'empresa_id');
    const empresaCode = empresa.codigo || 'E-1';

    const [pTables] = await officePool.query("SHOW TABLES LIKE 'cabecera_partidas'");
    const hasOfficePartidas = pTables.length > 0;

    const chqItems = validItems.filter(it => it.origen === 'cheque' || type === 'cheque');
    const movItems = validItems.filter(it => it.origen === 'movimiento' || type === 'ingresos');
    const diarioItems = validItems.filter(it => it.origen === 'diario' || type === 'diario');

    let updatedCount = 0;

    if (chqItems.length > 0) {
        if (hasChequesTable) {
            updatedCount += await batchUpdate(
                officePool, 'cheques', 'id', 'num_partida', chqItems,
                'AND empresa_id = ?', [empresa.id], 'es_reservado = 1'
            );
        } else {
            updatedCount += await batchUpdate(
                officePool, 'vouchers', 'id', 'num_partida', chqItems,
                'AND id_empresa = ?', [empresaCode], 'es_reservado = 1'
            );
        }
    }

    if (movItems.length > 0) {
        if (hasEmpresaId) {
            updatedCount += await batchUpdate(
                officePool, 'movimientos_bancarios', 'id', 'num_partida', movItems,
                'AND empresa_id = ?', [empresa.id]
            );
        } else {
            updatedCount += await batchUpdate(
                officePool, 'movimientos_bancarios', 'id', 'num_partida', movItems,
                'AND id_empresa = ?', [empresaCode]
            );
        }
    }

    if (diarioItems.length > 0) {
        if (hasOfficePartidas) {
            updatedCount += await batchUpdate(
                officePool, 'cabecera_partidas', 'corr', 'correlativo', diarioItems,
                'AND id_empresa = ?', [empresaCode]
            );
        } else {
            updatedCount += await batchUpdate(
                pool, 'accounting_entries', 'id', 'number', diarioItems,
                'AND company_id = ?', [companyId]
            );
        }
    }

    // Safely update correlativos counter
    if (month && year) {
        const m = parseInt(month, 10);
        const y = parseInt(year, 10);
        const mm = String(m).padStart(2, '0');

        let maxSeq = 0;
        validItems.forEach(it => {
            const n = String(it.num || '').trim();
            if (n.startsWith(mm)) {
                const seq = parseInt(n.slice(mm.length), 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            } else if (/^\d+$/.test(n)) {
                const seq = parseInt(n, 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
        });

        if (maxSeq > 0) {
            if (hasOfficePartidas) {
                try {
                    const [corrTables] = await officePool.query("SHOW TABLES LIKE 'correlativos_mensuales'");
                    if (corrTables.length > 0) {
                        const codTipo = type === 'ingresos' ? '02' : (type === 'egresos' ? '01' : '03');
                        const [existing] = await officePool.query(
                            'SELECT corr FROM correlativos_mensuales WHERE id_empresa = ? AND cod_tipo_partida = ? AND ejercicio = ? AND codigo_mes = ?',
                            [empresaCode, codTipo, y, mm]
                        );
                        if (existing.length > 0) {
                            await officePool.query('UPDATE correlativos_mensuales SET correlativo = ? WHERE corr = ?', [maxSeq, existing[0].corr]);
                        } else {
                            await officePool.query(
                                'INSERT INTO correlativos_mensuales (id_empresa, cod_tipo_partida, ejercicio, codigo_mes, correlativo) VALUES (?, ?, ?, ?, ?)',
                                [empresaCode, codTipo, y, mm, maxSeq]
                            );
                        }
                    }
                } catch (e) {
                    console.warn('Could not update correlativos_mensuales:', e.message);
                }
            } else {
                try {
                    const entryTypeId = type === 'diario' ? 1 : (type === 'ingresos' ? 2 : 3);
                    await pool.query(
                        `INSERT INTO accounting_entry_correlativos (company_id, entry_type_id, year, month, current_number)
                         VALUES (?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE current_number = VALUES(current_number)`,
                        [companyId, entryTypeId, y, m, maxSeq]
                    );
                } catch (e) {
                    console.warn('Could not update accounting_entry_correlativos:', e.message);
                }
            }
        }
    }

    return {
        success: true,
        message: `${updatedCount} correlativo(s) guardado(s) exitosamente`,
        updated_count: updatedCount
    };
}

module.exports = { queryReservationMovements, saveReservationCorrelativos };
