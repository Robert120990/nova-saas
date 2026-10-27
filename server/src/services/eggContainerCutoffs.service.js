const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const excelService = require('./excel.service');
const {
    DEFAULT_DAILY_RATE,
    formatYMD,
    computeBilling,
    computeElapsedDaysSinceReference,
    logIndustrialEvent,
    getContainersOverview
} = require('./eggContainers.service');

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
    const periodStart = (lastCutoff && payload.lock_to_last_cutoff !== false)
        ? formatYMD(lastCutoff.period_end)
        : (formatYMD(payload.period_start) || formatYMD(lastCutoff?.period_end) || formatYMD(new Date()));
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
    const periodSpanDays = Math.max(1, Math.round((endMs - startMs) / 86400000));

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

    // Regla central: los nuevos cortes parten desde el último corte realizado
    const periodStart = (lastCutoff && payload.lock_to_last_cutoff !== false)
        ? formatYMD(lastCutoff.period_end)
        : (formatYMD(payload.period_start) || formatYMD(lastCutoff?.period_end) || formatYMD(new Date()));
    const periodEnd = formatYMD(payload.period_end) || formatYMD(new Date());

    if (!periodStart || !periodEnd) {
        const err = new Error('Debe especificar las fechas del período de corte.');
        err.status = 400;
        throw err;
    }
    if (periodEnd < periodStart) {
        const err = new Error(`La fecha de corte (${periodEnd}) no puede ser anterior al último corte (${periodStart}).`);
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
        const billing = computeBilling(daysOn, rate);
        return {
            container: c,
            was_active_power: c.is_active_power ? 1 : 0,
            ...billing,
            notes: c.notes || null
        };
    });

    const totalDaysOn = +preparedItems.reduce((acc, it) => acc + it.days_on, 0).toFixed(2);
    const totalSubtotal = +preparedItems.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2);
    const totalIva = +preparedItems.reduce((acc, it) => acc + it.iva_amount, 0).toFixed(2);
    const totalWithIva = +preparedItems.reduce((acc, it) => acc + it.total_with_iva, 0).toFixed(2);
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
    const customerName = payload.customer_name ? String(payload.customer_name).trim() : (lastCutoff?.customer_name || null);
    const customerId = payload.customer_id ? parseInt(payload.customer_id, 10) || null : (lastCutoff?.customer_id || null);
    const cutoffNotes = payload.notes ? String(payload.notes).trim() : null;

    const [insCutoff] = await pool.query(
        `INSERT INTO egg_storage_container_cutoffs
         (company_id, cutoff_number, cutoff_code, customer_id, customer_name, previous_cutoff_id, previous_cutoff_date,
          period_start, period_end, total_containers, billed_containers_count, active_containers_count,
          total_days_on, daily_rate, subtotal, iva_amount, total_with_iva, keep_active_running, status, notes, user_id, user_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aplicado', ?, ?, ?)`,
        [
            companyId,
            nextCutoffNum,
            cutoffCode,
            customerId,
            customerName,
            lastCutoff?.id || null,
            lastCutoff ? formatYMD(lastCutoff.period_end) : null,
            periodStart,
            periodEnd,
            containers.length,
            billedCount,
            activeCount,
            totalDaysOn,
            defaultRate,
            totalSubtotal,
            totalIva,
            totalWithIva,
            keepActiveRunning,
            cutoffNotes,
            user?.id || null,
            user?.nombre || user?.username || 'Sistema'
        ]
    );

    const cutoffId = insCutoff.insertId;

    for (const item of preparedItems) {
        const c = item.container;
        await pool.query(
            `INSERT INTO egg_storage_container_cutoff_items
             (cutoff_id, company_id, container_id, container_number, container_code, container_name,
              was_active_power, turned_on_at, turned_off_at, days_on, daily_rate, subtotal, iva_amount, total_with_iva, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cutoffId,
                companyId,
                c.id,
                c.container_number,
                c.code,
                c.name,
                item.was_active_power,
                c.turned_on_at,
                c.turned_off_at,
                item.days_on,
                item.daily_rate,
                item.subtotal,
                item.iva_amount,
                item.total_with_iva,
                item.notes
            ]
        );

        if (item.days_on > 0) {
            await pool.query(
                `INSERT INTO egg_storage_container_logs
                 (company_id, container_id, container_name, action_type, days_on, daily_rate, subtotal, iva_amount, total_with_iva, started_at, ended_at, notes, user_id, user_name)
                 VALUES (?, ?, ?, 'corte_fechas', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    companyId,
                    c.id,
                    c.name,
                    item.days_on,
                    item.daily_rate,
                    item.subtotal,
                    item.iva_amount,
                    item.total_with_iva,
                    `${periodStart} 00:00:00`,
                    `${periodEnd} 23:59:59`,
                    `${cutoffCode} (${reportPdfHelper.formatDate(periodStart)} al ${reportPdfHelper.formatDate(periodEnd)})${customerName ? ` • ${customerName}` : ''}`,
                    user?.id || null,
                    user?.nombre || user?.username || 'Sistema'
                ]
            );
        }

        // Reiniciar días para que el nuevo corte parta limpio desde la fecha de este último corte
        const nextPower = item.was_active_power === 1 && keepActiveRunning ? 1 : 0;
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
                ? [nextPower, `${periodEnd} 00:00:00`, periodEnd, cutoffId, c.id, companyId]
                : [nextPower, periodEnd, cutoffId, c.id, companyId]
        );
    }

    await logIndustrialEvent(
        companyId,
        'container.cutoff_created',
        `Estado de Cuenta ${cutoffCode} (${periodStart} al ${periodEnd}): ${totalDaysOn} día(s), Total c/IVA: $${totalWithIva.toFixed(2)}`,
        { cutoff_id: cutoffId, cutoff_code: cutoffCode, period_start: periodStart, period_end: periodEnd, total_days_on: totalDaysOn, total_with_iva: totalWithIva },
        user
    );

    const overview = await getContainersOverview(companyId);
    return { ...overview, created_cutoff_id: cutoffId, created_cutoff_code: cutoffCode };
}

async function revertLastContainerCutoff(companyId, cutoffId, user = null) {
    const lastCutoff = await getLastAppliedCutoff(companyId);
    if (!lastCutoff || Number(lastCutoff.id) !== Number(cutoffId)) {
        const err = new Error('Solo se puede revertir el último corte realizado para mantener la continuidad de fechas.');
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
             SET days_on = ?,
                 is_active_power = ?,
                 turned_on_at = ?,
                 turned_off_at = ?,
                 last_cutoff_date = ?,
                 last_cutoff_id = ?
             WHERE id = ? AND company_id = ?`,
            [
                item.days_on,
                item.was_active_power,
                item.turned_on_at,
                item.turned_off_at,
                lastCutoff.previous_cutoff_date,
                lastCutoff.previous_cutoff_id,
                item.container_id,
                companyId
            ]
        );
    }

    await pool.query('DELETE FROM egg_storage_container_logs WHERE company_id = ? AND action_type = ? AND notes LIKE ?', [companyId, 'corte_fechas', `${lastCutoff.cutoff_code}%`]);
    await pool.query('DELETE FROM egg_storage_container_cutoff_items WHERE cutoff_id = ? AND company_id = ?', [cutoffId, companyId]);
    await pool.query('DELETE FROM egg_storage_container_cutoffs WHERE id = ? AND company_id = ?', [cutoffId, companyId]);

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
    const { cutoff_id, format, include_zero } = query;

    let headerInfo = null;
    let items = [];

    if (cutoff_id) {
        const [cRows] = await pool.query(
            'SELECT * FROM egg_storage_container_cutoffs WHERE id = ? AND company_id = ?',
            [cutoff_id, companyId]
        );
        if (!cRows.length) {
            return res.status(404).json({ message: 'Corte de estado de cuenta no encontrado.' });
        }
        const cut = cRows[0];
        const [iRows] = await pool.query(
            'SELECT * FROM egg_storage_container_cutoff_items WHERE cutoff_id = ? AND company_id = ? ORDER BY container_number ASC',
            [cutoff_id, companyId]
        );
        headerInfo = {
            code: cut.cutoff_code,
            customer_name: cut.customer_name || 'CLIENTE GENERAL / PLANTA',
            previous_cutoff_date: formatYMD(cut.previous_cutoff_date),
            period_start: formatYMD(cut.period_start),
            period_end: formatYMD(cut.period_end),
            notes: cut.notes || '',
            is_preliminary: false
        };
        items = iRows.map(r => ({
            code: r.container_code,
            name: r.container_name,
            status_label: r.was_active_power ? 'ENCENDIDO' : 'DISPONIBLE / APAGADO',
            days_on: parseFloat(r.days_on || 0),
            daily_rate: parseFloat(r.daily_rate || DEFAULT_DAILY_RATE),
            subtotal: parseFloat(r.subtotal || 0),
            iva_amount: parseFloat(r.iva_amount || 0),
            total_with_iva: parseFloat(r.total_with_iva || 0),
            notes: r.notes || ''
        }));
    } else {
        const overview = await getContainersOverview(companyId);
        const periodStart = formatYMD(query.period_start) || overview.cutoff_chain.next_period_start;
        const periodEnd = formatYMD(query.period_end) || overview.cutoff_chain.suggested_period_end;
        headerInfo = {
            code: 'PRELIMINAR (EN CURSO)',
            customer_name: query.customer_name || overview.cutoff_chain.last_customer_name || 'CLIENTE GENERAL / PLANTA',
            previous_cutoff_date: overview.cutoff_chain.last_cutoff_date,
            period_start: periodStart,
            period_end: periodEnd,
            notes: query.notes || '',
            is_preliminary: true
        };
        items = overview.containers.map(c => ({
            code: c.code,
            name: c.name,
            status_label: c.is_active_power ? 'ENCENDIDO' : 'DISPONIBLE / APAGADO',
            days_on: parseFloat(c.days_on || 0),
            daily_rate: parseFloat(c.daily_rate || DEFAULT_DAILY_RATE),
            subtotal: parseFloat(c.subtotal || 0),
            iva_amount: parseFloat(c.iva_amount || 0),
            total_with_iva: parseFloat(c.total_with_iva || 0),
            notes: c.notes || ''
        }));
    }

    const displayItems = include_zero === '0' ? items.filter(i => i.days_on > 0) : items;
    const totalDays = +displayItems.reduce((s, i) => s + i.days_on, 0).toFixed(2);
    const totalSubtotal = +displayItems.reduce((s, i) => s + i.subtotal, 0).toFixed(2);
    const totalIva = +displayItems.reduce((s, i) => s + i.iva_amount, 0).toFixed(2);
    const totalWithIva = +displayItems.reduce((s, i) => s + i.total_with_iva, 0).toFixed(2);
    const periodText = `CORTE DEL ${reportPdfHelper.formatDate(headerInfo.period_start)} AL ${reportPdfHelper.formatDate(headerInfo.period_end)}`;

    if (format === 'excel') {
        const excelRows = displayItems.map(it => ({
            code: it.code,
            name: it.name,
            status_label: it.status_label,
            days_on: it.days_on,
            daily_rate: it.daily_rate,
            subtotal: it.subtotal,
            iva_amount: it.iva_amount,
            total_with_iva: it.total_with_iva,
            notes: it.notes
        }));
        excelRows.push({
            code: 'TOTAL',
            name: `${headerInfo.code} - ${headerInfo.customer_name}`,
            status_label: periodText,
            days_on: totalDays,
            daily_rate: '',
            subtotal: totalSubtotal,
            iva_amount: totalIva,
            total_with_iva: totalWithIva,
            notes: headerInfo.previous_cutoff_date ? `Último corte: ${reportPdfHelper.formatDate(headerInfo.previous_cutoff_date)}` : ''
        });
        const buffer = await excelService.createExcelBuffer({
            title: `ESTADO DE CUENTA DE CONTENEDORES DE ALMACENAMIENTO (${periodText})`,
            sheets: [{
                name: 'Estado de Cuenta',
                columns: [
                    { header: 'Código', key: 'code', width: 12 },
                    { header: 'Contenedor', key: 'name', width: 24 },
                    { header: 'Estado', key: 'status_label', width: 22 },
                    { header: 'Días Encendido', key: 'days_on', width: 16 },
                    { header: 'Tarifa / Día ($)', key: 'daily_rate', width: 16 },
                    { header: 'Subtotal ($)', key: 'subtotal', width: 16 },
                    { header: 'IVA 13% ($)', key: 'iva_amount', width: 16 },
                    { header: 'Total + IVA ($)', key: 'total_with_iva', width: 18 },
                    { header: 'Observaciones', key: 'notes', width: 28 }
                ],
                data: excelRows
            }]
        });
        return excelService.sendExcelResponse(res, buffer, `estado_cuenta_contenedores_${headerInfo.period_end}.xlsx`);
    }

    return reportPdfHelper.buildPDF(res, 'portrait', (doc) => {
        const subtitle = `ESTADO DE CUENTA: ${headerInfo.code}  •  CLIENTE: ${headerInfo.customer_name}`;
        let y = reportPdfHelper.renderHeader(
            doc,
            company,
            'ESTADO DE CUENTA - ALMACENAMIENTO EN CONTENEDORES DE FRIO',
            periodText,
            'portrait',
            subtitle
        );

        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#334155');
        const chainInfo = headerInfo.previous_cutoff_date
            ? `ORIGEN DE CORTE: Partiendo desde el último corte realizado el ${reportPdfHelper.formatDate(headerInfo.previous_cutoff_date)}`
            : 'ORIGEN DE CORTE: Primer período de corte registrado';
        doc.text(chainInfo, 30, y);
        if (headerInfo.notes) {
            doc.font('Helvetica').fillColor('#475569').text(`Observaciones: ${headerInfo.notes}`, 340, y, { width: 240, align: 'right' });
        }
        y += 14;

        const cols = [
            { label: 'CÓDIGO', x: 30, w: 52, align: 'left' },
            { label: 'CONTENEDOR', x: 82, w: 118, align: 'left' },
            { label: 'ESTADO', x: 200, w: 85, align: 'left' },
            { label: 'DÍAS ENC.', x: 285, w: 52, align: 'right' },
            { label: 'TARIFA/DÍA', x: 337, w: 60, align: 'right' },
            { label: 'SUBTOTAL', x: 397, w: 62, align: 'right' },
            { label: 'IVA (13%)', x: 459, w: 55, align: 'right' },
            { label: 'TOTAL + IVA', x: 514, w: 68, align: 'right' }
        ];

        const drawTableHeader = (topY) => {
            doc.rect(30, topY, 552, 14).fill('#f1f5f9');
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, topY + 14).lineTo(582, topY + 14).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a');
            cols.forEach(c => doc.text(c.label, c.x + 2, topY + 4, { width: c.w - 4, align: c.align, lineBreak: false }));
            return topY + 17;
        };

        y = drawTableHeader(y);

        displayItems.forEach((it, idx) => {
            if (y > 700) {
                doc.addPage();
                y = reportPdfHelper.renderHeader(doc, company, 'ESTADO DE CUENTA - ALMACENAMIENTO EN CONTENEDORES DE FRIO', periodText, 'portrait', subtitle);
                y = drawTableHeader(y);
            }
            if (idx % 2 === 1) {
                doc.rect(30, y - 2, 552, 13).fill('#f8fafc');
            }
            doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
            doc.text(it.code, cols[0].x + 2, y, { width: cols[0].w - 4, lineBreak: false });
            doc.font('Helvetica-Bold').text(reportPdfHelper.fitText(doc, it.name, cols[1].w - 4), cols[1].x + 2, y, { width: cols[1].w - 4, lineBreak: false });
            doc.font('Helvetica').fillColor('#475569').text(it.status_label, cols[2].x + 2, y, { width: cols[2].w - 4, lineBreak: false });
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(String(it.days_on), cols[3].x + 2, y, { width: cols[3].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica').text(reportPdfHelper.fmt(it.daily_rate, false), cols[4].x + 2, y, { width: cols[4].w - 4, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(it.subtotal), cols[5].x + 2, y, { width: cols[5].w - 4, align: 'right', lineBreak: false });
            doc.text(reportPdfHelper.fmt(it.iva_amount), cols[6].x + 2, y, { width: cols[6].w - 4, align: 'right', lineBreak: false });
            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(it.total_with_iva), cols[7].x + 2, y, { width: cols[7].w - 4, align: 'right', lineBreak: false });
            y += 13;
        });

        doc.strokeColor('#94a3b8').lineWidth(0.8).moveTo(30, y + 1).lineTo(582, y + 1).stroke();
        y += 5;
        doc.rect(30, y - 2, 552, 16).fill('#f1f5f9');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('TOTALES DEL CORTE / ESTADO DE CUENTA', cols[0].x + 2, y + 2, { width: 250, lineBreak: false });
        doc.text(`${totalDays} d`, cols[3].x + 2, y + 2, { width: cols[3].w - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(totalSubtotal, false), cols[5].x + 2, y + 2, { width: cols[5].w - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(totalIva, false), cols[6].x + 2, y + 2, { width: cols[6].w - 4, align: 'right', lineBreak: false });
        doc.text(reportPdfHelper.fmt(totalWithIva, false), cols[7].x + 2, y + 2, { width: cols[7].w - 4, align: 'right', lineBreak: false });
        y += 22;

        reportPdfHelper.renderClosingFooter(doc, 30, y, displayItems.length, 'Contenedores');
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
