const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('./excel.service');
const {
    DEFAULT_DAILY_RATE,
    formatYMD,
    addDaysYMD,
    computeBilling,
    computeElapsedDaysSinceReference,
    logIndustrialEvent,
    getContainersOverview
} = require('./eggContainers.service');
const { recalculateAndSyncActiveLedger } = require('./eggContainerDailyLedger.service');

async function getLastAppliedCutoff(companyId) {
    const [rows] = await pool.query(
        `SELECT * FROM egg_storage_container_cutoffs
         WHERE company_id = ? AND status = 'aplicado'
         ORDER BY period_end DESC, id DESC
         LIMIT 1`,
        [companyId]
    );
    return rows[0] || null;
}

async function syncContainerDaysForPeriod(companyId, payload = {}, user = null) {
    const lastCutoff = await getLastAppliedCutoff(companyId);
    const defaultStart = lastCutoff ? addDaysYMD(lastCutoff.period_end, 1) : formatYMD(new Date());
    const periodStart = (lastCutoff && payload.lock_to_last_cutoff !== false)
        ? (formatYMD(payload.period_start) || defaultStart)
        : (formatYMD(payload.period_start) || defaultStart);
    const periodEnd = formatYMD(payload.period_end) || formatYMD(new Date());

    if (periodEnd < periodStart) {
        const err = new Error(`La fecha de corte (${periodEnd}) no puede ser menor al inicio del período (${periodStart}).`);
        err.status = 400;
        throw err;
    }

    const [containers] = await pool.query(
        'SELECT * FROM egg_storage_containers WHERE company_id = ? ORDER BY container_number ASC',
        [companyId]
    );

    const startMs = new Date(`${periodStart}T00:00:00`).getTime();
    const endMs = new Date(`${periodEnd}T00:00:00`).getTime();
    const periodSpanDays = Math.max(1, Math.round((endMs - startMs) / 86400000) + 1);

    for (const c of containers) {
        if (!c.is_active_power) continue;
        const calculatedDays = payload.use_full_period_span
            ? periodSpanDays
            : computeElapsedDaysSinceReference(c.turned_on_at || periodStart, periodStart, periodEnd);

        await pool.query(
            'UPDATE egg_storage_containers SET days_on = ? WHERE id = ? AND company_id = ?',
            [calculatedDays, c.id, companyId]
        );
    }

    await logIndustrialEvent(
        companyId,
        'container.period_days_synced',
        `Días sincronizados según corte del ${periodStart} al ${periodEnd} (${periodSpanDays} día(s) base)`,
        { period_start: periodStart, period_end: periodEnd, period_span_days: periodSpanDays },
        user
    );

    return getContainersOverview(companyId);
}

async function createContainerCutoff(companyId, payload = {}, user = null) {
    const lastCutoff = await getLastAppliedCutoff(companyId);
    const [activeLedger] = await pool.query(
        'SELECT * FROM egg_storage_container_daily_ledger WHERE company_id = ? AND cutoff_id IS NULL ORDER BY entry_date ASC, id ASC',
        [companyId]
    );

    const defaultStart = activeLedger[0]?.entry_date
        ? formatYMD(activeLedger[0].entry_date)
        : (lastCutoff ? addDaysYMD(lastCutoff.period_end, 1) : formatYMD(new Date()));
    const periodStart = formatYMD(payload.period_start) || defaultStart;
    const periodEnd = formatYMD(payload.period_end)
        || (activeLedger.length > 0 ? formatYMD(activeLedger[activeLedger.length - 1].entry_date) : formatYMD(new Date()));

    if (periodEnd < periodStart) {
        const err = new Error(`La fecha de corte (${periodEnd}) no puede ser anterior al inicio (${periodStart}).`);
        err.status = 400;
        throw err;
    }

    const [containers] = await pool.query(
        'SELECT * FROM egg_storage_containers WHERE company_id = ? ORDER BY container_number ASC, id ASC',
        [companyId]
    );

    const overridesMap = {};
    if (Array.isArray(payload.items_override)) {
        for (const ov of payload.items_override) {
            if (ov && ov.container_id) {
                overridesMap[Number(ov.container_id)] = Math.max(0, parseFloat(ov.days_on) || 0);
            }
        }
    }

    const preparedItems = containers.map(c => {
        const daysOn = overridesMap[c.id] !== undefined
            ? overridesMap[c.id]
            : Math.max(0, parseFloat(c.days_on) || 0);
        const rate = parseFloat(c.daily_rate || DEFAULT_DAILY_RATE);
        const billing = computeBilling(daysOn, rate, 0);
        return {
            container: c,
            was_active_power: c.is_active_power ? 1 : 0,
            ...billing,
            notes: c.notes || null
        };
    });

    const openingLbs = parseFloat(lastCutoff?.closing_lbs_balance || 0);
    const totalLbsIn = +activeLedger.reduce((s, r) => s + parseFloat(r.lbs_in || 0), 0).toFixed(2);
    const totalLbsOut = +activeLedger.reduce((s, r) => s + parseFloat(r.lbs_out || 0), 0).toFixed(2);
    const closingLbs = payload.closing_lbs_balance !== undefined
        ? parseFloat(payload.closing_lbs_balance) || 0
        : +(openingLbs + totalLbsIn - totalLbsOut).toFixed(2);

    const loadingUnloadingTotal = payload.loading_unloading_total !== undefined
        ? Math.max(0, parseFloat(payload.loading_unloading_total) || 0)
        : +activeLedger.reduce((s, r) => s + parseFloat(r.loading_unloading_cost || 0), 0).toFixed(2);

    const totalDaysOn = +preparedItems.reduce((acc, it) => acc + it.days_on, 0).toFixed(2);
    const storageSubtotal = +preparedItems.reduce((acc, it) => acc + it.storage_subtotal, 0).toFixed(2);
    const totalSubtotal = +(storageSubtotal + loadingUnloadingTotal).toFixed(2);
    const totalIva = +(totalSubtotal * 0.13).toFixed(2);
    const totalWithIva = +(totalSubtotal + totalIva).toFixed(2);
    const billedCount = preparedItems.filter(it => it.days_on > 0).length;
    const activeCount = preparedItems.filter(it => it.was_active_power === 1).length;
    const defaultRate = preparedItems[0]?.daily_rate || DEFAULT_DAILY_RATE;
    const keepActiveRunning = payload.keep_active_running !== undefined ? (payload.keep_active_running ? 1 : 0) : 1;

    const [numRow] = await pool.query(
        'SELECT COALESCE(MAX(cutoff_number), 0) AS max_num FROM egg_storage_container_cutoffs WHERE company_id = ?',
        [companyId]
    );
    const nextCutoffNum = (numRow[0]?.max_num || 0) + 1;
    const cutoffCode = `CORTE-${String(nextCutoffNum).padStart(4, '0')}`;
    const customerName = payload.customer_name ? String(payload.customer_name).trim() : (lastCutoff?.customer_name || 'ALMACENAMIENTO EN CONTENEDOR');
    const customerId = payload.customer_id ? parseInt(payload.customer_id, 10) || null : (lastCutoff?.customer_id || null);
    const cutoffNotes = payload.notes ? String(payload.notes).trim() : null;

    const [insCutoff] = await pool.query(
        `INSERT INTO egg_storage_container_cutoffs
         (company_id, cutoff_number, cutoff_code, customer_id, customer_name, previous_cutoff_id, previous_cutoff_date,
          period_start, period_end, opening_lbs_balance, total_lbs_in, total_lbs_out, closing_lbs_balance,
          total_containers, billed_containers_count, active_containers_count,
          total_days_on, daily_rate, storage_subtotal, loading_unloading_total, subtotal, iva_amount, total_with_iva,
          keep_active_running, status, notes, user_id, user_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aplicado', ?, ?, ?)`,
        [
            companyId, nextCutoffNum, cutoffCode, customerId, customerName,
            lastCutoff?.id || null, lastCutoff ? formatYMD(lastCutoff.period_end) : null,
            periodStart, periodEnd, openingLbs, totalLbsIn, totalLbsOut, closingLbs,
            containers.length, billedCount, activeCount,
            totalDaysOn, defaultRate, storageSubtotal, loadingUnloadingTotal, totalSubtotal, totalIva, totalWithIva,
            keepActiveRunning, cutoffNotes, user?.id || null, user?.nombre || user?.username || 'Sistema'
        ]
    );

    const cutoffId = insCutoff.insertId;

    // Asociar las filas diarias vigentes a este corte cerrado
    await pool.query(
        'UPDATE egg_storage_container_daily_ledger SET cutoff_id = ? WHERE company_id = ? AND cutoff_id IS NULL',
        [cutoffId, companyId]
    );

    for (const item of preparedItems) {
        const c = item.container;
        await pool.query(
            `INSERT INTO egg_storage_container_cutoff_items
             (cutoff_id, company_id, container_id, container_number, container_code, container_name,
              was_active_power, turned_on_at, turned_off_at, days_on, daily_rate, subtotal, iva_amount, total_with_iva, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cutoffId, companyId, c.id, c.container_number, c.code, c.name,
                item.was_active_power, c.turned_on_at, c.turned_off_at,
                item.days_on, item.daily_rate, item.subtotal, item.iva_amount, item.total_with_iva, item.notes
            ]
        );

        const nextPower = item.was_active_power === 1 && keepActiveRunning ? 1 : 0;
        const nextTurnedOn = addDaysYMD(periodEnd, 1) || periodEnd;
        await pool.query(
            `UPDATE egg_storage_containers
             SET days_on = 0,
                 is_active_power = ?,
                 turned_on_at = ${nextPower === 1 ? '?' : 'turned_on_at'},
                 turned_off_at = ${nextPower === 0 && item.was_active_power === 1 ? 'NOW()' : 'turned_off_at'},
                 last_cutoff_date = ?,
                 last_cutoff_id = ?
             WHERE id = ? AND company_id = ?`,
            nextPower === 1
                ? [nextPower, `${nextTurnedOn} 00:00:00`, periodEnd, cutoffId, c.id, companyId]
                : [nextPower, periodEnd, cutoffId, c.id, companyId]
        );
    }

    await logIndustrialEvent(
        companyId,
        'container.cutoff_created',
        `Estado de Cuenta ${cutoffCode} (${periodStart} al ${periodEnd}): ${closingLbs} lbs, Almacenamiento $${storageSubtotal.toFixed(2)} + Descarga $${loadingUnloadingTotal.toFixed(2)} = $${totalSubtotal.toFixed(2)}`,
        { cutoff_id: cutoffId, cutoff_code: cutoffCode, period_start: periodStart, period_end: periodEnd, closing_lbs: closingLbs, subtotal: totalSubtotal },
        user
    );

    const overview = await getContainersOverview(companyId);
    return { ...overview, created_cutoff_id: cutoffId, created_cutoff_code: cutoffCode };
}

async function revertLastContainerCutoff(companyId, cutoffId, user = null) {
    const lastCutoff = await getLastAppliedCutoff(companyId);
    if (!lastCutoff || Number(lastCutoff.id) !== Number(cutoffId)) {
        const err = new Error('Solo se puede revertir el último corte realizado para mantener la continuidad de fechas y saldos.');
        err.status = 400;
        throw err;
    }

    const [items] = await pool.query(
        'SELECT * FROM egg_storage_container_cutoff_items WHERE cutoff_id = ? AND company_id = ?',
        [cutoffId, companyId]
    );

    for (const item of items) {
        await pool.query(
            `UPDATE egg_storage_containers
             SET days_on = ?, is_active_power = ?, turned_on_at = ?, turned_off_at = ?,
                 last_cutoff_date = ?, last_cutoff_id = ?
             WHERE id = ? AND company_id = ?`,
            [
                item.days_on, item.was_active_power, item.turned_on_at, item.turned_off_at,
                lastCutoff.previous_cutoff_date, lastCutoff.previous_cutoff_id,
                item.container_id, companyId
            ]
        );
    }

    // Devolver las filas diarias al período vigente (cutoff_id = NULL)
    await pool.query('UPDATE egg_storage_container_daily_ledger SET cutoff_id = NULL WHERE cutoff_id = ? AND company_id = ?', [cutoffId, companyId]);
    await pool.query('DELETE FROM egg_storage_container_logs WHERE company_id = ? AND action_type = ? AND notes LIKE ?', [companyId, 'corte_fechas', `${lastCutoff.cutoff_code}%`]);
    await pool.query('DELETE FROM egg_storage_container_cutoff_items WHERE cutoff_id = ? AND company_id = ?', [cutoffId, companyId]);
    await pool.query('DELETE FROM egg_storage_container_cutoffs WHERE id = ? AND company_id = ?', [cutoffId, companyId]);

    await recalculateAndSyncActiveLedger(companyId, true);

    await logIndustrialEvent(
        companyId,
        'container.cutoff_reverted',
        `Revertido corte ${lastCutoff.cutoff_code} (${formatYMD(lastCutoff.period_start)} al ${formatYMD(lastCutoff.period_end)})`,
        { reverted_cutoff_id: cutoffId, cutoff_code: lastCutoff.cutoff_code },
        user
    );

    return getContainersOverview(companyId);
}

async function exportContainerStatementReport(companyId, query = {}, res) {
    const company = await reportPdfHelper.getCompanyInfo(companyId);
    const { cutoff_id, format } = query;
    const overview = await getContainersOverview(companyId);

    let cutData = null;
    if (cutoff_id) {
        cutData = overview.cutoffs.find(c => Number(c.id) === Number(cutoff_id));
        if (!cutData) return res.status(404).json({ message: 'Corte de estado de cuenta no encontrado.' });
    } else {
        const dl = overview.daily_ledger;
        cutData = {
            cutoff_code: 'VIGENTE (ARCHIVO 1.2)',
            customer_name: query.customer_name || overview.cutoff_chain.last_customer_name || 'ALMACENAMIENTO EN CONTENEDOR',
            previous_cutoff_date: overview.cutoff_chain.last_cutoff_date,
            period_start: formatYMD(query.period_start) || overview.cutoff_chain.next_period_start,
            period_end: formatYMD(query.period_end) || overview.cutoff_chain.suggested_period_end,
            opening_lbs_balance: dl.opening_lbs_balance,
            total_lbs_in: dl.totals.total_lbs_in,
            total_lbs_out: dl.totals.total_lbs_out,
            closing_lbs_balance: dl.totals.closing_lbs_balance,
            total_days_on: overview.summary.total_days_on,
            storage_subtotal: overview.summary.storage_subtotal,
            loading_unloading_total: overview.summary.loading_unloading_total,
            subtotal: overview.summary.total_subtotal,
            iva_amount: overview.summary.total_iva,
            total_with_iva: overview.summary.total_with_iva,
            daily_rows: dl.rows,
            items: overview.containers.map(c => ({
                container_code: c.code, container_name: c.name, was_active_power: c.is_active_power,
                days_on: c.days_on, daily_rate: c.daily_rate, subtotal: c.storage_subtotal,
                iva_amount: c.iva_amount, total_with_iva: c.total_with_iva
            }))
        };
    }

    const periodText = `CORTE DEL ${reportPdfHelper.formatDate(cutData.period_start)} AL ${reportPdfHelper.formatDate(cutData.period_end)}`;

    if (format === 'excel') {
        const dailyExcel = [
            {
                entry_date: 'LIBRAS (SALDO INICIAL)', lbs_in: '', lbs_out: '', lbs_balance: cutData.opening_lbs_balance,
                daily_rate: '', containers_count: 'contenedores', days_amount: '', loading_unloading_cost: '',
                withdrawal_count: '', income_count: '', active_containers_list: ''
            },
            ...(cutData.daily_rows || []).map(r => ({
                entry_date: r.entry_date,
                lbs_in: r.lbs_in || '',
                lbs_out: r.lbs_out || '',
                lbs_balance: r.lbs_balance,
                daily_rate: r.daily_rate,
                containers_count: r.containers_count,
                days_amount: r.days_amount,
                loading_unloading_cost: r.loading_unloading_cost,
                withdrawal_count: r.withdrawal_count || '',
                income_count: r.income_count || '',
                active_containers_list: r.active_containers_list
            })),
            {
                entry_date: 'TOTAL', lbs_in: cutData.total_lbs_in, lbs_out: cutData.total_lbs_out,
                lbs_balance: cutData.closing_lbs_balance, daily_rate: '', containers_count: cutData.total_days_on,
                days_amount: cutData.storage_subtotal, loading_unloading_cost: cutData.loading_unloading_total,
                withdrawal_count: '', income_count: '', active_containers_list: ''
            },
            { entry_date: '', lbs_in: '', lbs_out: 'Libras en contenedores', lbs_balance: cutData.closing_lbs_balance },
            { entry_date: '', lbs_in: '', lbs_out: 'Total de libras', lbs_balance: cutData.closing_lbs_balance },
            { entry_date: '', lbs_in: '', lbs_out: 'Almacenamiento contenedores', days_amount: cutData.storage_subtotal },
            { entry_date: '', lbs_in: '', lbs_out: 'Valor por descarga', days_amount: cutData.loading_unloading_total },
            { entry_date: '', lbs_in: '', lbs_out: 'Total Estado de Cuenta', days_amount: cutData.subtotal }
        ];

        const buffer = await excelService.createExcelBuffer({
            title: `ALMACENAMIENTO EN CONTENEDOR - ${periodText}`,
            sheets: [{
                name: 'Almacenamiento Contenedor',
                columns: [
                    { header: 'FECHA', key: 'entry_date', width: 22 },
                    { header: 'Ingreso (Lbs)', key: 'lbs_in', width: 15 },
                    { header: 'Salida (Lbs)', key: 'lbs_out', width: 24 },
                    { header: 'Saldo libras', key: 'lbs_balance', width: 16 },
                    { header: '$ X Día', key: 'daily_rate', width: 12 },
                    { header: '# de contenedores', key: 'containers_count', width: 18 },
                    { header: 'Días $', key: 'days_amount', width: 15 },
                    { header: 'CARGAS Y DESCARGAS', key: 'loading_unloading_cost', width: 20 },
                    { header: 'RETIRO', key: 'withdrawal_count', width: 10 },
                    { header: 'INGRESO', key: 'income_count', width: 10 },
                    { header: 'N° CON.', key: 'active_containers_list', width: 22 }
                ],
                data: dailyExcel
            }]
        });
        return excelService.sendExcelResponse(res, buffer, `estado_cuenta_contenedores_${cutData.period_end}.xlsx`);
    }

    return reportPdfHelper.buildPDF(res, 'landscape', (doc) => {
        const subtitle = `ESTADO DE CUENTA: ${cutData.cutoff_code}  •  ${cutData.customer_name}`;
        let y = reportPdfHelper.renderHeader(doc, company, 'ESTADO DE CUENTA - ALMACENAMIENTO EN CONTENEDOR', periodText, 'landscape', subtitle);

        const cols = [
            { label: 'FECHA', x: 30, w: 68, align: 'left' },
            { label: 'INGRESO (LBS)', x: 98, w: 68, align: 'right' },
            { label: 'SALIDA (LBS)', x: 166, w: 64, align: 'right' },
            { label: 'SALDO LIBRAS', x: 230, w: 74, align: 'right' },
            { label: '$ X DÍA', x: 304, w: 52, align: 'right' },
            { label: '# CONT.', x: 356, w: 48, align: 'center' },
            { label: 'DÍAS $', x: 404, w: 68, align: 'right' },
            { label: 'CARGAS/DESC. $', x: 472, w: 76, align: 'right' },
            { label: 'RETIRO', x: 548, w: 45, align: 'center' },
            { label: 'INGRESO', x: 593, w: 48, align: 'center' },
            { label: 'N° CON.', x: 641, w: 121, align: 'left' }
        ];

        doc.rect(30, y, 732, 14).fill('#f1f5f9');
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, y + 14).lineTo(762, y + 14).stroke();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
        cols.forEach(c => doc.text(c.label, c.x + 2, y + 4, { width: c.w - 4, align: c.align, lineBreak: false }));
        y += 17;

        // Fila inicial: LIBRAS (Saldo anterior)
        doc.rect(30, y - 2, 732, 13).fill('#eef2ff');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text('LIBRAS (SALDO ANT.)', cols[0].x + 2, y, { width: 190, lineBreak: false });
        doc.text(Number(cutData.opening_lbs_balance || 0).toLocaleString('en-US'), cols[3].x + 2, y, { width: cols[3].w - 4, align: 'right', lineBreak: false });
        y += 14;

        (cutData.daily_rows || []).forEach((r, idx) => {
            if (idx % 2 === 1) doc.rect(30, y - 2, 732, 13).fill('#f8fafc');
            doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a');
            doc.text(reportPdfHelper.formatDate(r.entry_date), cols[0].x + 2, y, { width: cols[0].w - 4, lineBreak: false });
            doc.text(r.lbs_in > 0 ? Number(r.lbs_in).toLocaleString('en-US') : '', cols[1].x + 2, y, { width: cols[1].w - 4, align: 'right', lineBreak: false });
            doc.text(r.lbs_out > 0 ? Number(r.lbs_out).toLocaleString('en-US') : '', cols[2].x + 2, y, { width: cols[2].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica-Bold').text(Number(r.lbs_balance || 0).toLocaleString('en-US'), cols[3].x + 2, y, { width: cols[3].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica').text(reportPdfHelper.fmt(r.daily_rate, false), cols[4].x + 2, y, { width: cols[4].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica-Bold').text(String(r.containers_count || 0), cols[5].x + 2, y, { width: cols[5].w - 4, align: 'center', lineBreak: false });
            doc.text(reportPdfHelper.fmt(r.days_amount), cols[6].x + 2, y, { width: cols[6].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica').text(reportPdfHelper.fmt(r.loading_unloading_cost), cols[7].x + 2, y, { width: cols[7].w - 4, align: 'right', lineBreak: false });
            doc.text(r.withdrawal_count > 0 ? String(r.withdrawal_count) : '', cols[8].x + 2, y, { width: cols[8].w - 4, align: 'center', lineBreak: false });
            doc.text(r.income_count > 0 ? String(r.income_count) : '', cols[9].x + 2, y, { width: cols[9].w - 4, align: 'center', lineBreak: false });
            doc.font('Helvetica-Bold').text(r.active_containers_list || '', cols[10].x + 2, y, { width: cols[10].w - 4, lineBreak: false });
            y += 13;
        });

        doc.rect(30, y - 1, 732, 15).fill('#f1f5f9');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTAL', cols[0].x + 2, y + 2, { width: cols[0].w - 4, lineBreak: false });
        doc.text(Number(cutData.closing_lbs_balance || 0).toLocaleString('en-US'), cols[3].x + 2, y + 2, { width: cols[3].w - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(cutData.storage_subtotal, false), cols[6].x + 2, y + 2, { width: cols[6].w - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(cutData.loading_unloading_total, false), cols[7].x + 2, y + 2, { width: cols[7].w - 4, align: 'right', lineBreak: false });
        y += 22;

        // Cuadro Resumen de Conceptos (idéntico al formato del cliente)
        doc.rect(180, y, 420, 74).fill('#f8fafc').stroke('#cbd5e1');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('Libras en contenedores:', 195, y + 8);
        doc.text(`${Number(cutData.closing_lbs_balance || 0).toLocaleString('en-US')} lbs`, 450, y + 8, { width: 135, align: 'right' });
        doc.text('Total de libras:', 195, y + 21);
        doc.text(`${Number(cutData.closing_lbs_balance || 0).toLocaleString('en-US')} lbs`, 450, y + 21, { width: 135, align: 'right' });
        doc.text('Almacenamiento contenedores:', 195, y + 36);
        doc.text(reportPdfHelper.fmt(cutData.storage_subtotal, false), 450, y + 36, { width: 135, align: 'right' });
        doc.text('Valor por descarga (Cargas y Descargas):', 195, y + 49);
        doc.text(reportPdfHelper.fmt(cutData.loading_unloading_total, false), 450, y + 49, { width: 135, align: 'right' });
        doc.fontSize(9).fillColor('#0f172a').text('TOTAL CONCEPTOS (SIN IVA):', 195, y + 61);
        doc.text(reportPdfHelper.fmt(cutData.subtotal, false), 450, y + 61, { width: 135, align: 'right' });
        y += 84;

        reportPdfHelper.renderClosingFooter(doc, 30, y, (cutData.daily_rows || []).length, 'Días Registrados');
        reportPdfHelper.renderPageNumbers(doc);
        doc.end();
    });
}

module.exports = {
    getLastAppliedCutoff,
    syncContainerDaysForPeriod,
    createContainerCutoff,
    revertLastContainerCutoff,
    exportContainerStatementReport
};
