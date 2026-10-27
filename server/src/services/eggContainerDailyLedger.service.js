const pool = require('../config/db');
const { DEFAULT_DAILY_RATE, formatYMD, logIndustrialEvent } = require('./eggContainers.service');

function parseContainerNumbers(listStr) {
    if (!listStr) return [];
    const matches = String(listStr).match(/\d+/g);
    if (!matches) return [];
    const unique = Array.from(new Set(matches.map(n => parseInt(n, 10)).filter(n => n > 0)));
    return unique.sort((a, b) => a - b);
}

function formatContainerNumbers(nums) {
    return (Array.isArray(nums) ? nums : []).join(',');
}

async function getOpeningLbsFromLastCutoff(companyId) {
    const [rows] = await pool.query(
        `SELECT id, cutoff_code, period_end, closing_lbs_balance
         FROM egg_storage_container_cutoffs
         WHERE company_id = ? AND status = 'aplicado'
         ORDER BY period_end DESC, id DESC
         LIMIT 1`,
        [companyId]
    );
    if (!rows.length) return { opening_lbs: 0, last_cutoff: null };
    return {
        opening_lbs: parseFloat(rows[0].closing_lbs_balance || 0),
        last_cutoff: rows[0]
    };
}

async function recalculateAndSyncActiveLedger(companyId, syncContainersFromLedger = true) {
    const { opening_lbs } = await getOpeningLbsFromLastCutoff(companyId);

    const [rows] = await pool.query(
        `SELECT * FROM egg_storage_container_daily_ledger
         WHERE company_id = ? AND cutoff_id IS NULL
         ORDER BY entry_date ASC, id ASC`,
        [companyId]
    );

    let runningBalance = opening_lbs;
    const daysCountByContainerNumber = {};
    const firstDateByContainerNumber = {};
    let lastActiveSet = new Set();

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const lbsIn = Math.max(0, parseFloat(r.lbs_in) || 0);
        const lbsOut = Math.max(0, parseFloat(r.lbs_out) || 0);
        runningBalance = +(runningBalance + lbsIn - lbsOut).toFixed(2);

        const parsedNums = parseContainerNumbers(r.active_containers_list);
        const normalizedList = parsedNums.length > 0 ? formatContainerNumbers(parsedNums) : (r.active_containers_list || '');
        const containersCount = parsedNums.length > 0
            ? parsedNums.length
            : Math.max(0, parseInt(r.containers_count, 10) || 0);
        const rate = Math.max(0, parseFloat(r.daily_rate || DEFAULT_DAILY_RATE));
        const daysAmount = +(containersCount * rate).toFixed(2);

        await pool.query(
            `UPDATE egg_storage_container_daily_ledger
             SET lbs_balance = ?,
                 containers_count = ?,
                 days_amount = ?,
                 active_containers_list = ?
             WHERE id = ? AND company_id = ?`,
            [runningBalance, containersCount, daysAmount, normalizedList, r.id, companyId]
        );

        const dateStr = formatYMD(r.entry_date);
        parsedNums.forEach(num => {
            daysCountByContainerNumber[num] = (daysCountByContainerNumber[num] || 0) + 1;
            if (!firstDateByContainerNumber[num] && dateStr) {
                firstDateByContainerNumber[num] = `${dateStr} 00:00:00`;
            }
        });

        if (i === rows.length - 1) {
            lastActiveSet = new Set(parsedNums);
        }
    }

    if (syncContainersFromLedger && rows.length > 0) {
        const [containers] = await pool.query(
            'SELECT id, container_number FROM egg_storage_containers WHERE company_id = ?',
            [companyId]
        );
        for (const c of containers) {
            const num = c.container_number;
            const daysOn = daysCountByContainerNumber[num] || 0;
            const isActive = lastActiveSet.has(num) ? 1 : 0;
            const firstOn = firstDateByContainerNumber[num] || null;
            await pool.query(
                `UPDATE egg_storage_containers
                 SET days_on = ?,
                     is_active_power = ?,
                     turned_on_at = COALESCE(?, turned_on_at)
                 WHERE id = ? AND company_id = ?`,
                [daysOn, isActive, firstOn, c.id, companyId]
            );
        }
    }
}

async function getDailyLedgerData(companyId) {
    const { opening_lbs } = await getOpeningLbsFromLastCutoff(companyId);

    const [rows] = await pool.query(
        `SELECT * FROM egg_storage_container_daily_ledger
         WHERE company_id = ? AND cutoff_id IS NULL
         ORDER BY entry_date ASC, id ASC`,
        [companyId]
    );

    let runningBalance = opening_lbs;
    let totalLbsIn = 0;
    let totalLbsOut = 0;
    let totalContainerDays = 0;
    let storageSubtotal = 0;
    let loadingUnloadingTotal = 0;
    let totalWithdrawals = 0;
    let totalIncomes = 0;

    const formattedRows = rows.map(r => {
        const lbs_in = parseFloat(r.lbs_in || 0);
        const lbs_out = parseFloat(r.lbs_out || 0);
        runningBalance = +(runningBalance + lbs_in - lbs_out).toFixed(2);
        const daily_rate = parseFloat(r.daily_rate || DEFAULT_DAILY_RATE);
        const parsedNums = parseContainerNumbers(r.active_containers_list);
        const containers_count = parsedNums.length > 0 ? parsedNums.length : (parseInt(r.containers_count, 10) || 0);
        const days_amount = +(containers_count * daily_rate).toFixed(2);
        const loading_unloading_cost = parseFloat(r.loading_unloading_cost || 0);
        const withdrawal_count = parseInt(r.withdrawal_count, 10) || 0;
        const income_count = parseInt(r.income_count, 10) || 0;

        totalLbsIn += lbs_in;
        totalLbsOut += lbs_out;
        totalContainerDays += containers_count;
        storageSubtotal += days_amount;
        loadingUnloadingTotal += loading_unloading_cost;
        totalWithdrawals += withdrawal_count;
        totalIncomes += income_count;

        return {
            ...r,
            entry_date: formatYMD(r.entry_date),
            lbs_in,
            lbs_out,
            lbs_balance: runningBalance,
            daily_rate,
            containers_count,
            days_amount,
            loading_unloading_cost,
            withdrawal_count,
            income_count,
            active_containers_list: parsedNums.length > 0 ? formatContainerNumbers(parsedNums) : (r.active_containers_list || ''),
            active_container_numbers: parsedNums
        };
    });

    const storage_subtotal = +storageSubtotal.toFixed(2);
    const loading_unloading_total = +loadingUnloadingTotal.toFixed(2);
    const concepts_total = +(storage_subtotal + loading_unloading_total).toFixed(2);
    const iva_amount = +(concepts_total * 0.13).toFixed(2);
    const total_with_iva = +(concepts_total + iva_amount).toFixed(2);

    return {
        opening_lbs_balance: +opening_lbs.toFixed(2),
        rows: formattedRows,
        totals: {
            opening_lbs_balance: +opening_lbs.toFixed(2),
            total_lbs_in: +totalLbsIn.toFixed(2),
            total_lbs_out: +totalLbsOut.toFixed(2),
            closing_lbs_balance: +runningBalance.toFixed(2),
            total_days_logged: formattedRows.length,
            total_container_days: totalContainerDays,
            storage_subtotal,
            loading_unloading_total,
            concepts_total,
            iva_amount,
            total_with_iva,
            total_withdrawals: totalWithdrawals,
            total_incomes: totalIncomes
        }
    };
}

async function saveDailyLedgerRow(companyId, payload = {}, user = null) {
    const entryDate = formatYMD(payload.entry_date) || formatYMD(new Date());
    const lbsIn = Math.max(0, parseFloat(payload.lbs_in) || 0);
    const lbsOut = Math.max(0, parseFloat(payload.lbs_out) || 0);
    const dailyRate = Math.max(0, parseFloat(payload.daily_rate ?? DEFAULT_DAILY_RATE) || DEFAULT_DAILY_RATE);
    const loadingCost = Math.max(0, parseFloat(payload.loading_unloading_cost) || 0);
    const withdrawalCount = Math.max(0, parseInt(payload.withdrawal_count, 10) || 0);
    const incomeCount = Math.max(0, parseInt(payload.income_count, 10) || 0);

    let listStr = payload.active_containers_list !== undefined ? String(payload.active_containers_list).trim() : '';
    if (!listStr && !payload.id) {
        // Si no se especificó lista al crear nueva fila, tomar los contenedores actualmente encendidos
        const [activeConts] = await pool.query(
            'SELECT container_number FROM egg_storage_containers WHERE company_id = ? AND is_active_power = 1 ORDER BY container_number ASC',
            [companyId]
        );
        listStr = activeConts.map(c => c.container_number).join(',');
    }

    const parsedNums = parseContainerNumbers(listStr);
    const normalizedList = parsedNums.length > 0 ? formatContainerNumbers(parsedNums) : listStr;
    const containersCount = parsedNums.length > 0
        ? parsedNums.length
        : Math.max(0, parseInt(payload.containers_count, 10) || 0);
    const daysAmount = +(containersCount * dailyRate).toFixed(2);
    const notes = payload.notes ? String(payload.notes).trim() : null;

    if (payload.id) {
        await pool.query(
            `UPDATE egg_storage_container_daily_ledger
             SET entry_date = ?, lbs_in = ?, lbs_out = ?, daily_rate = ?,
                 containers_count = ?, days_amount = ?, loading_unloading_cost = ?,
                 withdrawal_count = ?, income_count = ?, active_containers_list = ?, notes = ?
             WHERE id = ? AND company_id = ? AND cutoff_id IS NULL`,
            [
                entryDate, lbsIn, lbsOut, dailyRate,
                containersCount, daysAmount, loadingCost,
                withdrawalCount, incomeCount, normalizedList, notes,
                payload.id, companyId
            ]
        );
    } else {
        // Verificar si ya existe una fila para esa fecha en el corte activo
        const [existingDate] = await pool.query(
            'SELECT id FROM egg_storage_container_daily_ledger WHERE company_id = ? AND cutoff_id IS NULL AND entry_date = ? LIMIT 1',
            [companyId, entryDate]
        );
        if (existingDate.length > 0) {
            await pool.query(
                `UPDATE egg_storage_container_daily_ledger
                 SET lbs_in = ?, lbs_out = ?, daily_rate = ?,
                     containers_count = ?, days_amount = ?, loading_unloading_cost = ?,
                     withdrawal_count = ?, income_count = ?, active_containers_list = ?, notes = ?
                 WHERE id = ? AND company_id = ?`,
                [
                    lbsIn, lbsOut, dailyRate,
                    containersCount, daysAmount, loadingCost,
                    withdrawalCount, incomeCount, normalizedList, notes,
                    existingDate[0].id, companyId
                ]
            );
        } else {
            await pool.query(
                `INSERT INTO egg_storage_container_daily_ledger
                 (company_id, cutoff_id, entry_date, lbs_in, lbs_out, lbs_balance, daily_rate,
                  containers_count, days_amount, loading_unloading_cost, withdrawal_count, income_count, active_containers_list, notes)
                 VALUES (?, NULL, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    companyId, entryDate, lbsIn, lbsOut, dailyRate,
                    containersCount, daysAmount, loadingCost,
                    withdrawalCount, incomeCount, normalizedList, notes
                ]
            );
        }
    }

    await recalculateAndSyncActiveLedger(companyId, true);

    await logIndustrialEvent(
        companyId,
        'container.daily_row_saved',
        `Registro diario ${entryDate}: Ingreso ${lbsIn} lbs, Salida ${lbsOut} lbs, ${containersCount} contenedor(es) [${normalizedList}], Almacenamiento $${daysAmount}, Descarga $${loadingCost}`,
        { entry_date: entryDate, lbs_in: lbsIn, lbs_out: lbsOut, containers_count: containersCount, active_containers_list: normalizedList },
        user
    );
}

async function deleteDailyLedgerRow(companyId, rowId) {
    await pool.query(
        'DELETE FROM egg_storage_container_daily_ledger WHERE id = ? AND company_id = ? AND cutoff_id IS NULL',
        [rowId, companyId]
    );
    await recalculateAndSyncActiveLedger(companyId, true);
}

module.exports = {
    parseContainerNumbers,
    formatContainerNumbers,
    getOpeningLbsFromLastCutoff,
    recalculateAndSyncActiveLedger,
    getDailyLedgerData,
    saveDailyLedgerRow,
    deleteDailyLedgerRow
};
