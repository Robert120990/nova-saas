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

    const mm = String(m).padStart(2, '0');
    const lastDay = new Date(y, m, 0).getDate();
    const startDate = `${y}-${mm}-01`;
    const endDate = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;

    // === GESTIÓN LOCAL DE PARTIDAS DE DIARIO (CIERRES DE TURNO / CAJA DE NOVA SAAS) ===
    if (type === 'diario') {
        const [closeouts] = await pool.query(
            `SELECT 
                c.fecha_turno,
                c.branch_id,
                b.nombre AS branch_name,
                b.codigo AS branch_code,
                COUNT(DISTINCT c.id) AS total_turnos,
                COALESCE(
                    (SELECT SUM(r.monto) 
                     FROM gas_station_closeout_readings r 
                     JOIN gas_station_closeouts c2 ON r.closeout_id = c2.id 
                     WHERE c2.company_id = c.company_id AND c2.branch_id = c.branch_id AND c2.fecha_turno = c.fecha_turno), 0
                ) +
                COALESCE(
                    (SELECT SUM(l.total) 
                     FROM gas_station_closeout_lubricant_readings l 
                     JOIN gas_station_closeouts c3 ON l.closeout_id = c3.id 
                     WHERE c3.company_id = c.company_id AND c3.branch_id = c.branch_id AND c3.fecha_turno = c.fecha_turno), 0
                ) AS total_monto
            FROM gas_station_closeouts c
            LEFT JOIN branches b ON c.branch_id = b.id
            WHERE c.company_id = ? AND c.fecha_turno >= ? AND c.fecha_turno <= ?
            GROUP BY c.fecha_turno, c.branch_id, b.nombre, b.codigo
            ORDER BY c.fecha_turno ASC, c.branch_id ASC`,
            [companyId, startDate, endDate]
        );

        const [reservedSettings] = await pool.query(
            `SELECT setting_key, setting_value FROM accounting_settings 
             WHERE company_id = ? AND setting_key LIKE 'RESERVA_CORRELATIVO_CIERRE_%'`,
            [companyId]
        );
        const reservedMap = new Map();
        reservedSettings.forEach(s => reservedMap.set(s.setting_key, (s.setting_value || '').trim()));

        const [entries] = await pool.query(
            `SELECT id, branch_id, date, number FROM accounting_entries 
             WHERE company_id = ? AND date >= ? AND date <= ? AND status <> 'voided' 
               AND (description LIKE '%CIERRE%' OR description LIKE '%TURNO%')`,
            [companyId, startDate, endDate]
        );
        const entriesMap = new Map();
        entries.forEach(e => {
            const dStr = e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10);
            entriesMap.set(`${e.branch_id}_${dStr}`, (e.number || '').trim());
        });

        const items = [];
        const seenKeys = new Set();

        for (const c of closeouts) {
            const dStr = c.fecha_turno instanceof Date ? c.fecha_turno.toISOString().slice(0, 10) : String(c.fecha_turno).slice(0, 10);
            const llave = `CIERRE_${c.branch_id}_${dStr}`;
            seenKeys.add(llave);

            const generatedNumber = entriesMap.get(`${c.branch_id}_${dStr}`);
            const reservedNumber = reservedMap.get(`RESERVA_CORRELATIVO_${llave}`);
            const num = generatedNumber || reservedNumber || '';
            const branchLabel = c.branch_name ? `${c.branch_code ? c.branch_code + ' - ' : ''}${c.branch_name}`.trim() : `SUCURSAL #${c.branch_id}`;

            items.push({
                id: llave,
                fecha: formatDateOutput(c.fecha_turno),
                rawDate: c.fecha_turno,
                referencia: branchLabel,
                monto: parseFloat(c.total_monto) || 0,
                concepto: `CIERRE DE TURNO DEL DIA ${formatDateOutput(c.fecha_turno)} - ${c.branch_name || 'SUCURSAL'}`,
                llave,
                num,
                origen: 'diario'
            });
        }

        // Si existen partidas ya generadas que no provienen de gas_station_closeouts
        for (const e of entries) {
            const dStr = e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10);
            const llave = `CIERRE_${e.branch_id}_${dStr}`;
            if (!seenKeys.has(llave)) {
                seenKeys.add(llave);
                items.push({
                    id: llave,
                    fecha: formatDateOutput(e.date),
                    rawDate: e.date,
                    referencia: `SUCURSAL #${e.branch_id}`,
                    monto: 0,
                    concepto: `PARTIDA DE CIERRE #${e.number}`,
                    llave,
                    num: e.number || '',
                    origen: 'diario'
                });
            }
        }

        return items;
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

    const [chqTables] = await officePool.query("SHOW TABLES LIKE 'cheques'");
    const hasChequesTable = chqTables.length > 0;

    const [mbCols] = await officePool.query("DESCRIBE movimientos_bancarios");
    const hasEmpresaId = mbCols.some(c => c.Field === 'empresa_id');
    const isDateType = mbCols.find(c => c.Field === 'fecha')?.Type?.startsWith('date');
    const hasMbLlave = mbCols.some(c => c.Field === 'llave');
    const empresaCode = empresa.codigo || 'E-1';

    // Fetch local entries from Nova SaaS to associate already generated correlatives
    const [localEntries] = await pool.query(
        "SELECT id, number, date, status, description FROM accounting_entries WHERE company_id = ? AND date >= ? AND date <= ? AND status <> 'voided'",
        [companyId, startDate, endDate]
    );
    const entryByChq = new Map();
    const entryByDoc = new Map();
    localEntries.forEach(e => {
        const chqMatch = (e.description || '').match(/CHEQUE\s*#?\s*([0-9A-Za-z_-]+)/i);
        if (chqMatch && chqMatch[1]) entryByChq.set(String(chqMatch[1]).trim().toLowerCase(), e);

        const docMatch = (e.description || '').match(/DOC(?:UMENTO)?\s*#?\s*([0-9A-Za-z_-]+)/i);
        if (docMatch && docMatch[1]) entryByDoc.set(String(docMatch[1]).trim().toLowerCase(), e);
    });

    // Fetch local saved reservations from Nova SaaS accounting_settings
    const [reservedSettings] = await pool.query(
        "SELECT setting_key, setting_value FROM accounting_settings WHERE company_id = ? AND setting_key LIKE 'RESERVA_CORRELATIVO_%'",
        [companyId]
    );
    const reservedMap = new Map();
    reservedSettings.forEach(s => reservedMap.set(s.setting_key, (s.setting_value || '').trim()));

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

        return rows.map(r => {
            const docKey = String(r.referencia || '').trim();
            const localEntry = entryByDoc.get(docKey.toLowerCase());
            const llave = String(r.llave || `MVB${String(r.id).padStart(17, '0')}`).trim();
            const reserved = reservedMap.get(`RESERVA_CORRELATIVO_${llave}`)
                || reservedMap.get(`RESERVA_CORRELATIVO_${r.id}`)
                || (docKey ? reservedMap.get(`RESERVA_CORRELATIVO_DOC_${docKey.toLowerCase()}`) : null);
            const num = localEntry?.number || reserved || String(r.num || '').trim();

            return {
                id: r.id,
                fecha: formatDateOutput(r.fecha),
                referencia: docKey,
                monto: parseFloat(r.monto) || 0,
                concepto: String(r.concepto || '').trim(),
                llave,
                num,
                origen: 'movimiento'
            };
        });
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

        const mappedMb = rowsMb.map(r => {
            const docKey = String(r.referencia || '').trim();
            const localEntry = entryByDoc.get(docKey.toLowerCase());
            const llave = String(r.llave || `MVB${String(r.id).padStart(17, '0')}`).trim();
            const reserved = reservedMap.get(`RESERVA_CORRELATIVO_${llave}`)
                || reservedMap.get(`RESERVA_CORRELATIVO_${r.id}`)
                || (docKey ? reservedMap.get(`RESERVA_CORRELATIVO_DOC_${docKey.toLowerCase()}`) : null);
            const num = localEntry?.number || reserved || String(r.num || '').trim();

            return {
                id: r.id,
                fecha: formatDateOutput(r.fecha),
                rawDate: r.fecha,
                referencia: docKey,
                monto: parseFloat(r.monto) || 0,
                concepto: String(r.concepto || '').trim(),
                llave,
                num,
                origen: 'movimiento'
            };
        });

        const mappedChq = rowsChq.map(r => {
            const chqKey = String(r.referencia || '').trim();
            const localEntry = entryByChq.get(chqKey.toLowerCase());
            const llave = String(r.llave || `CHQ${String(r.id).padStart(17, '0')}`).trim();
            const reserved = reservedMap.get(`RESERVA_CORRELATIVO_${llave}`)
                || reservedMap.get(`RESERVA_CORRELATIVO_${r.id}`)
                || (chqKey ? reservedMap.get(`RESERVA_CORRELATIVO_CHQ_${chqKey.toLowerCase()}`) : null);
            const num = localEntry?.number || reserved || String(r.num || '').trim();

            return {
                id: r.id,
                fecha: formatDateOutput(r.fecha),
                rawDate: r.fecha,
                referencia: chqKey,
                monto: parseFloat(r.monto) || 0,
                concepto: String(r.concepto || '').trim(),
                llave,
                num,
                origen: 'cheque'
            };
        });

        const combined = [...mappedMb, ...mappedChq];
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

    // === GESTIÓN LOCAL DE PARTIDAS DE DIARIO (CIERRES DE TURNO / CAJA DE NOVA SAAS) ===
    if (type === 'diario') {
        let updatedCount = 0;
        let maxSeq = 0;
        const mm = String(month || new Date().getMonth() + 1).padStart(2, '0');
        const yy = String(year || new Date().getFullYear()).slice(-2);
        const prefixYYMM = `${yy}${mm}`;

        for (const it of validItems) {
            const numVal = String(it.num || '').trim();
            if (!numVal) continue;

            const settingKey = String(it.llave || it.id).startsWith('RESERVA_') 
                ? String(it.llave || it.id) 
                : `RESERVA_CORRELATIVO_${it.llave || it.id}`;

            await pool.query(
                `INSERT INTO accounting_settings (company_id, setting_key, setting_value) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [companyId, settingKey, numVal]
            );

            // Sincronizar número si la partida ya fue generada previamente en accounting_entries
            const llave = String(it.llave || it.id);
            if (llave.startsWith('CIERRE_')) {
                const parts = llave.split('_');
                if (parts.length >= 3) {
                    const branchId = Number(parts[1]);
                    const dateStr = parts.slice(2).join('_');
                    await pool.query(
                        `UPDATE accounting_entries SET number = ? 
                         WHERE company_id = ? AND branch_id = ? AND date = ? AND status <> 'voided' 
                           AND (description LIKE '%CIERRE%' OR description LIKE '%TURNO%')`,
                        [numVal, companyId, branchId, dateStr]
                    );
                }
            } else if (llave.startsWith('ASG')) {
                const entryId = parseInt(llave.replace('ASG', ''), 10);
                if (entryId) {
                    await pool.query(
                        `UPDATE accounting_entries SET number = ? WHERE id = ? AND company_id = ?`,
                        [numVal, entryId, companyId]
                    );
                }
            }

            if (numVal.startsWith(prefixYYMM) && numVal.length > 4) {
                const seq = parseInt(numVal.slice(4), 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            } else if (numVal.startsWith(mm) && numVal.length > 2) {
                const seq = parseInt(numVal.slice(2), 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            } else if (/^\d+$/.test(numVal)) {
                const seq = parseInt(numVal, 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
            }
            updatedCount++;
        }

        // Actualizar contador mensual en accounting_entry_correlativos para tipo DIARIO
        if (maxSeq > 0 && month && year) {
            try {
                const [[et]] = await pool.query("SELECT id FROM entry_types WHERE code = 'DIARIO' LIMIT 1");
                const diarioTypeId = et ? et.id : 1;
                await pool.query(
                    `INSERT INTO accounting_entry_correlativos (company_id, entry_type_id, year, month, current_number)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE current_number = GREATEST(current_number, VALUES(current_number))`,
                    [companyId, diarioTypeId, Number(year), Number(month), maxSeq + 1]
                );
            } catch (e) {
                console.warn('Could not update accounting_entry_correlativos for diario:', e.message);
            }
        }

        return {
            success: true,
            message: `${updatedCount} correlativo(s) de diario guardado(s) exitosamente`,
            updated_count: updatedCount
        };
    }

    // === GESTIÓN DE INGRESOS / EGRESOS (BANCOS Y CHEQUES) ===
    let updatedCount = 0;
    let maxSeq = 0;
    const mm = String(month || new Date().getMonth() + 1).padStart(2, '0');
    const yy = String(year || new Date().getFullYear()).slice(-2);
    const prefixYYMM = `${yy}${mm}`;

    // 1. Guardar de forma ultra-rápida en accounting_settings de Nova SaaS en un único batch
    const settingsRows = [];
    for (const it of validItems) {
        const numVal = String(it.num || '').trim();
        if (!numVal) continue;

        const settingKey = String(it.llave || it.id).startsWith('RESERVA_') 
            ? String(it.llave || it.id) 
            : `RESERVA_CORRELATIVO_${it.llave || it.id}`;

        settingsRows.push([companyId, settingKey, numVal]);

        // Si se envió referencia (número de cheque o documento), indexar también por referencia
        const refStr = String(it.referencia || '').trim();
        if (refStr) {
            const prefixRef = it.origen === 'cheque' ? 'CHQ' : 'DOC';
            settingsRows.push([companyId, `RESERVA_CORRELATIVO_${prefixRef}_${refStr.toLowerCase()}`, numVal]);
        }

        if (numVal.startsWith(prefixYYMM) && numVal.length > 4) {
            const seq = parseInt(numVal.slice(4), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        } else if (numVal.startsWith(mm) && numVal.length > 2) {
            const seq = parseInt(numVal.slice(2), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        } else if (/^\d+$/.test(numVal)) {
            const seq = parseInt(numVal, 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
        updatedCount++;
    }

    if (settingsRows.length > 0) {
        await pool.query(
            `INSERT INTO accounting_settings (company_id, setting_key, setting_value) 
             VALUES ? 
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [settingsRows]
        );
    }

    // Sincronizar partidas ya existentes de forma rápida solo para los items con referencia modificada
    const itemsWithRef = validItems.filter(it => it.referencia && it.num);
    if (itemsWithRef.length > 0 && itemsWithRef.length <= 50) {
        for (const it of itemsWithRef) {
            const refStr = String(it.referencia).trim();
            const numVal = String(it.num).trim();
            if (it.origen === 'cheque') {
                await pool.query(
                    `UPDATE accounting_entries SET number = ? 
                     WHERE company_id = ? AND status <> 'voided' AND description LIKE ?`,
                    [numVal, companyId, `%CHEQUE%${refStr}%`]
                );
            } else {
                await pool.query(
                    `UPDATE accounting_entries SET number = ? 
                     WHERE company_id = ? AND status <> 'voided' AND (description LIKE ? OR description LIKE ?)`,
                    [numVal, companyId, `%DOC%${refStr}%`, `%DOCUMENTO%${refStr}%`]
                );
            }
        }
    }

    // 2. Actualizar contador en accounting_entry_correlativos de Nova SaaS
    if (maxSeq > 0 && month && year) {
        try {
            const targetTypeCode = type === 'ingresos' ? 'INGRESO' : 'GASTO';
            const [[et]] = await pool.query('SELECT id FROM entry_types WHERE code = ? LIMIT 1', [targetTypeCode]);
            const entryTypeId = et ? et.id : (type === 'ingresos' ? 2 : 3);
            await pool.query(
                `INSERT INTO accounting_entry_correlativos (company_id, entry_type_id, year, month, current_number)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE current_number = GREATEST(current_number, VALUES(current_number))`,
                [companyId, entryTypeId, Number(year), Number(month), maxSeq + 1]
            );
        } catch (e) {
            console.warn('Could not update accounting_entry_correlativos:', e.message);
        }
    }

    // 3. Sincronizar defensivamente con base de datos de oficina (sin que un fallo en oficina rompa la reserva)
    try {
        const config = await getOfficeConfig(companyId);
        if (config.host && config.database) {
            const officePool = getOfficePool(config);
            const empresa = await resolveOfficeEmpresa(officePool, companyId);
            if (empresa) {
                const [chqTables] = await officePool.query("SHOW TABLES LIKE 'cheques'");
                const hasChequesTable = chqTables.length > 0;
                const [mbCols] = await officePool.query("DESCRIBE movimientos_bancarios");
                const hasEmpresaId = mbCols.some(c => c.Field === 'empresa_id');
                const empresaCode = empresa.codigo || 'E-1';

                const chqItems = validItems.filter(it => it.origen === 'cheque' || type === 'cheque');
                const movItems = validItems.filter(it => it.origen === 'movimiento' || type === 'ingresos');

                if (chqItems.length > 0) {
                    if (hasChequesTable) {
                        await batchUpdate(
                            officePool, 'cheques', 'id', 'num_partida', chqItems,
                            'AND empresa_id = ?', [empresa.id], 'es_reservado = 1'
                        );
                    } else {
                        await batchUpdate(
                            officePool, 'vouchers', 'id', 'num_partida', chqItems,
                            'AND id_empresa = ?', [empresaCode], 'es_reservado = 1'
                        );
                    }
                }

                if (movItems.length > 0) {
                    if (hasEmpresaId) {
                        await batchUpdate(
                            officePool, 'movimientos_bancarios', 'id', 'num_partida', movItems,
                            'AND empresa_id = ?', [empresa.id]
                        );
                    } else {
                        await batchUpdate(
                            officePool, 'movimientos_bancarios', 'id', 'num_partida', movItems,
                            'AND id_empresa = ?', [empresaCode]
                        );
                    }
                }
            }
        }
    } catch (officeErr) {
        console.warn('Sincronización externa con base de datos de oficina no aplicada:', officeErr.message);
    }

    return {
        success: true,
        message: `${updatedCount} correlativo(s) guardado(s) exitosamente`,
        updated_count: updatedCount
    };
}

module.exports = { queryReservationMovements, saveReservationCorrelativos };
