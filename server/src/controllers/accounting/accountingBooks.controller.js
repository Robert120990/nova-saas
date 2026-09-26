const pool = require('../../config/db');
const {
    MONTH_NAMES,
    getCompanyInfo,
    getSignatures,
    formatDate,
    fmt,
    getLastDayOfMonth,
    renderHeader,
    renderSignatures,
    renderClosingFooter,
    renderPageNumbers,
    buildPDF,
    buildExcelResponse
} = require('./accountingReportUtils');

// =============================================================================
// 1. LIBRO DIARIO
// =============================================================================

const getLibroDiario = async (req, res) => {
    try {
        const { start_date, end_date, entry_type_id } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        let query = `
            SELECT e.id as entry_id, e.date, e.number, e.description as entry_desc,
                   et.id as entry_type_id, et.code as entry_type_code, et.name as entry_type_name,
                   l.id as line_id, l.account_id, a.code as account_code, a.name as account_name,
                   l.description as line_desc, l.debit, l.credit
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            JOIN chart_of_accounts a ON l.account_id = a.id
            LEFT JOIN entry_types et ON e.entry_type_id = et.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
        `;
        const params = [req.company_id, start_date, end_date];

        if (entry_type_id && entry_type_id !== 'all' && entry_type_id !== 'TODAS') {
            query += ' AND e.entry_type_id = ?';
            params.push(entry_type_id);
        }

        query += ' ORDER BY e.date ASC, e.number ASC, e.id ASC, l.id ASC';

        const [rows] = await pool.query(query, params);

        const periodText = `DEL ${formatDate(start_date)} AL ${formatDate(end_date)}`;

        // Group rows by journal entry
        const entriesMap = new Map();
        let grandTotalDebit = 0;
        let grandTotalCredit = 0;

        for (const r of rows) {
            const eid = r.entry_id;
            if (!entriesMap.has(eid)) {
                entriesMap.set(eid, {
                    number: r.number || 'S/N',
                    date: formatDate(r.date),
                    entry_type: r.entry_type_name || 'DIARIO',
                    description: r.entry_desc || '',
                    lines: [],
                    totalDebit: 0,
                    totalCredit: 0
                });
            }
            const d = parseFloat(r.debit || 0);
            const c = parseFloat(r.credit || 0);
            const entry = entriesMap.get(eid);
            entry.totalDebit += d;
            entry.totalCredit += c;
            grandTotalDebit += d;
            grandTotalCredit += c;

            entry.lines.push({
                code: r.account_code,
                name: r.account_name,
                description: r.line_desc || '',
                debit: d,
                credit: c
            });
        }

        const entries = Array.from(entriesMap.values());

        if (req.query.format === 'excel') {
            const rowsForExcel = [];
            for (const ent of entries) {
                for (const l of ent.lines) {
                    rowsForExcel.push({
                        partida: ent.number,
                        fecha: ent.date,
                        tipo: ent.entry_type,
                        concepto_partida: ent.description,
                        codigo: l.code,
                        cuenta: l.name,
                        concepto_linea: l.description,
                        debe: l.debit,
                        haber: l.credit
                    });
                }
            }
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Partida', key: 'partida', width: 14 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Tipo', key: 'tipo', width: 18 },
                { header: 'Concepto Partida', key: 'concepto_partida', width: 30 },
                { header: 'Código', key: 'codigo', width: 15 },
                { header: 'Cuenta', key: 'cuenta', width: 30 },
                { header: 'Concepto Línea', key: 'concepto_linea', width: 30 },
                { header: 'Debe', key: 'debe', width: 14 },
                { header: 'Haber', key: 'haber', width: 14 }
            ], `Libro_Diario_${start_date}_al_${end_date}.xlsx`);
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Libro Diario', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;
            const colW = { code: 75, name: 175, desc: 142, debit: 80, credit: 80 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('CÓDIGO', x, yPos + 3); x += colW.code;
                doc.text('CUENTA', x, yPos + 3); x += colW.name;
                doc.text('CONCEPTO', x, yPos + 3); x += colW.desc;
                doc.text('DEBE', x, yPos + 3, { align: 'right', width: colW.debit - 6 }); x += colW.debit;
                doc.text('HABER', x, yPos + 3, { align: 'right', width: colW.credit - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            if (entries.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron partidas contables en el período seleccionado.', startX, y + 10);
                y += 30;
            } else {
                for (const ent of entries) {
                    if (y > 680) {
                        doc.addPage();
                        renderHeader(doc, company, 'Libro Diario', periodText, 'portrait');
                        y = drawTableHeader(doc.y + 4);
                    }

                    // Entry Header Box
                    doc.rect(startX, y, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`PARTIDA Nº: ${ent.number}`, startX + 4, y + 3);
                    doc.text(`FECHA: ${ent.date}`, startX + 130, y + 3);
                    doc.text(`TIPO: ${ent.entry_type}`, startX + 230, y + 3);
                    if (ent.description) {
                        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#334155');
                        doc.text(`CONCEPTO: ${ent.description.substring(0, 50)}`, startX + 350, y + 3, { width: 195, ellipsis: true });
                    }
                    y += 16;

                    // Lines
                    for (const l of ent.lines) {
                        if (y > 700) {
                            doc.addPage();
                            renderHeader(doc, company, 'Libro Diario', periodText, 'portrait');
                            y = drawTableHeader(doc.y + 4);
                        }
                        doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                        let lx = startX + 4;
                        doc.text(l.code, lx, y, { width: colW.code }); lx += colW.code;
                        doc.text((l.name || '').substring(0, 32), lx, y, { width: colW.name - 4 }); lx += colW.name;
                        doc.text((l.description || ent.description || '').substring(0, 26), lx, y, { width: colW.desc - 4 }); lx += colW.desc;
                        doc.text(fmt(l.debit), lx, y, { align: 'right', width: colW.debit - 6 }); lx += colW.debit;
                        doc.text(fmt(l.credit), lx, y, { align: 'right', width: colW.credit - 6 });
                        y += 11;
                    }

                    // Subtotal of entry
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.code + colW.name + colW.desc, y).lineTo(startX + contentWidth, y).stroke();
                    y += 2;
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`TOTAL PARTIDA ${ent.number}:`, startX + 4, y);
                    doc.text(fmt(ent.totalDebit), startX + colW.code + colW.name + colW.desc, y, { align: 'right', width: colW.debit - 6 });
                    doc.text(fmt(ent.totalCredit), startX + colW.code + colW.name + colW.desc + colW.debit, y, { align: 'right', width: colW.credit - 6 });
                    y += 14;
                }

                // Grand Totals
                if (y > 670) {
                    doc.addPage();
                    renderHeader(doc, company, 'Libro Diario', periodText, 'portrait');
                    y = doc.y + 10;
                }
                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                y += 4;
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('TOTAL GENERAL:', startX + 4, y);
                doc.text(fmt(grandTotalDebit), startX + colW.code + colW.name + colW.desc, y, { align: 'right', width: colW.debit - 6 });
                doc.text(fmt(grandTotalCredit), startX + colW.code + colW.name + colW.desc + colW.debit, y, { align: 'right', width: colW.credit - 6 });
                y += 18;
            }

            renderClosingFooter(doc, startX, y, entries.length, 'Partidas');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getLibroDiario Error]:', e);
        res.status(500).json({ message: e.message });
    }
};


// =============================================================================
// 2. LIBRO DIARIO MAYOR
// =============================================================================

const getLibroDiarioMayor = async (req, res) => {
    try {
        let { year, month, start_date, end_date } = req.query;
        if (!year && !start_date) {
            year = new Date().getFullYear();
        }

        let fDesde, fHasta, periodText;
        if (year && month) {
            const m = parseInt(month);
            const y = parseInt(year);
            const lastD = getLastDayOfMonth(y, m);
            fDesde = `${y}-${String(m).padStart(2, '0')}-01`;
            fHasta = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
            periodText = `CORRESPONDIENTE AL MES DE ${MONTH_NAMES[m]} DE ${y}`;
        } else if (year) {
            const y = parseInt(year);
            fDesde = `${y}-01-01`;
            fHasta = `${y}-12-31`;
            periodText = `EJERCICIO FISCAL ${y}`;
        } else {
            fDesde = start_date;
            fHasta = end_date;
            periodText = `DEL ${formatDate(start_date)} AL ${formatDate(end_date)}`;
        }

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        // Fetch all posted transactions within the period
        const [rows] = await pool.query(`
            SELECT d.id as line_id, d.account_id, a.code as account_code, a.name as account_name,
                   t.nature, c.date, c.number as num_correl,
                   d.description as line_desc, c.description as entry_desc,
                   d.debit, d.credit
            FROM accounting_entry_lines d
            INNER JOIN accounting_entries c ON d.entry_id = c.id
            INNER JOIN chart_of_accounts a ON d.account_id = a.id
            INNER JOIN account_types t ON a.account_type_id = t.id
            WHERE c.company_id = ? AND c.status = 'posted' AND c.date BETWEEN ? AND ?
            ORDER BY a.code ASC, c.date ASC, c.number ASC, d.id ASC
        `, [req.company_id, fDesde, fHasta]);

        // Group by account
        const accountMap = new Map();
        let grandTotalCargos = 0;
        let grandTotalAbonos = 0;

        for (const r of rows) {
            const code = r.account_code;
            if (!accountMap.has(code)) {
                accountMap.set(code, {
                    code,
                    name: r.account_name,
                    nature: r.nature || 'debit',
                    initialBalance: 0,
                    movimientos: [],
                    totalCargos: 0,
                    totalAbonos: 0,
                    saldoFinal: 0
                });
            }
            const acc = accountMap.get(code);
            const cargo = parseFloat(r.debit || 0);
            const abono = parseFloat(r.credit || 0);
            acc.totalCargos += cargo;
            acc.totalAbonos += abono;
            grandTotalCargos += cargo;
            grandTotalAbonos += abono;

            const net = acc.nature === 'debit' ? (cargo - abono) : (abono - cargo);
            acc.saldoFinal += net;

            acc.movimientos.push({
                fecha: formatDate(r.date),
                corr: r.num_correl || 'S/N',
                concepto: r.line_desc || r.entry_desc || '',
                cargo,
                abono,
                saldo: acc.saldoFinal
            });
        }

        const accounts = Array.from(accountMap.values());

        if (req.query.format === 'excel') {
            const rowsForExcel = [];
            accounts.forEach(acc => {
                acc.movimientos.forEach(m => {
                    rowsForExcel.push({
                        cuenta: acc.code,
                        nombre_cuenta: acc.name,
                        fecha: m.fecha,
                        correlativo: m.corr,
                        concepto: m.concepto,
                        cargo: m.cargo,
                        abono: m.abono,
                        saldo: m.saldo
                    });
                });
            });
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 14 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 32 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Correlativo', key: 'correlativo', width: 14 },
                { header: 'Concepto', key: 'concepto', width: 35 },
                { header: 'Cargo', key: 'cargo', width: 14 },
                { header: 'Abono', key: 'abono', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 }
            ], `Libro_Diario_Mayor_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'landscape', (doc) => {
            renderHeader(doc, company, 'Libro Diario Mayor', periodText, 'landscape');

            const startX = 30;
            const contentWidth = 732;
            const colW = { fecha: 65, corr: 65, desc: 342, cargo: 85, abono: 85, saldo: 90 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('FECHA', x, yPos + 3); x += colW.fecha;
                doc.text('CORR.', x, yPos + 3); x += colW.corr;
                doc.text('CONCEPTO', x, yPos + 3); x += colW.desc;
                doc.text('CARGOS', x, yPos + 3, { align: 'right', width: colW.cargo - 6 }); x += colW.cargo;
                doc.text('ABONOS', x, yPos + 3, { align: 'right', width: colW.abono - 6 }); x += colW.abono;
                doc.text('SALDO', x, yPos + 3, { align: 'right', width: colW.saldo - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            if (accounts.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron movimientos registrados en el período seleccionado.', startX, y + 10);
                y += 30;
            } else {
                for (const acc of accounts) {
                    if (y > 510) {
                        doc.addPage();
                        renderHeader(doc, company, 'Libro Diario Mayor', periodText, 'landscape');
                        y = drawTableHeader(doc.y + 4);
                    }

                    // Account Header Banner
                    doc.rect(startX, y, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`CUENTA: ${acc.code} - ${acc.name}`, startX + 4, y + 3);
                    doc.text(`SALDO INICIAL: ${fmt(acc.initialBalance)}`, startX + contentWidth - 170, y + 3, { align: 'right', width: 165 });
                    y += 16;

                    // Transactions
                    for (const m of acc.movimientos) {
                        if (y > 530) {
                            doc.addPage();
                            renderHeader(doc, company, 'Libro Diario Mayor', periodText, 'landscape');
                            y = drawTableHeader(doc.y + 4);
                        }
                        doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                        let lx = startX + 4;
                        doc.text(m.fecha, lx, y, { width: colW.fecha }); lx += colW.fecha;
                        doc.text(m.corr, lx, y, { width: colW.corr }); lx += colW.corr;
                        doc.text((m.concepto || '').substring(0, 60), lx, y, { width: colW.desc - 6 }); lx += colW.desc;
                        doc.text(fmt(m.cargo), lx, y, { align: 'right', width: colW.cargo - 6 }); lx += colW.cargo;
                        doc.text(fmt(m.abono), lx, y, { align: 'right', width: colW.abono - 6 }); lx += colW.abono;
                        doc.text(fmt(m.saldo), lx, y, { align: 'right', width: colW.saldo - 6 });
                        y += 11;
                    }

                    // Subtotal of account
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.fecha + colW.corr + colW.desc, y).lineTo(startX + contentWidth, y).stroke();
                    y += 2;
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`TOTALES CUENTA ${acc.code}:`, startX + 4, y);
                    let sx = startX + colW.fecha + colW.corr + colW.desc;
                    doc.text(fmt(acc.totalCargos), sx, y, { align: 'right', width: colW.cargo - 6 }); sx += colW.cargo;
                    doc.text(fmt(acc.totalAbonos), sx, y, { align: 'right', width: colW.abono - 6 }); sx += colW.abono;
                    doc.text(fmt(acc.saldoFinal), sx, y, { align: 'right', width: colW.saldo - 6 });
                    y += 14;
                }

                // Grand Totals
                if (y > 500) {
                    doc.addPage();
                    renderHeader(doc, company, 'Libro Diario Mayor', periodText, 'landscape');
                    y = doc.y + 10;
                }
                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                y += 4;
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('TOTAL GENERAL:', startX + 4, y);
                let gx = startX + colW.fecha + colW.corr + colW.desc;
                doc.text(fmt(grandTotalCargos), gx, y, { align: 'right', width: colW.cargo - 6 }); gx += colW.cargo;
                doc.text(fmt(grandTotalAbonos), gx, y, { align: 'right', width: colW.abono - 6 });
                y += 18;
            }

            renderClosingFooter(doc, startX, y, accounts.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'landscape');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getLibroDiarioMayor Error]:', e);
        res.status(500).json({ message: e.message });
    }
};


// =============================================================================
// 3. LIBRO MAYOR
// =============================================================================

const getLibroMayor = async (req, res) => {
    try {
        const { start_date, end_date, account_id } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        let ctaFilter = '';
        const params = [req.company_id, start_date, end_date];
        const openParams = [req.company_id, start_date];

        if (account_id && account_id !== 'all') {
            ctaFilter = ' AND a.id = ?';
            params.push(account_id);
            openParams.push(account_id);
        }

        // Opening Balances prior to start_date
        const [openBalances] = await pool.query(`
            SELECT a.id, a.code, a.name, t.nature,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted' AND e.date < ?
            WHERE a.company_id = ? AND a.active = 1 ${ctaFilter}
            GROUP BY a.id
            HAVING balance != 0
        `, [start_date, req.company_id, ...(account_id && account_id !== 'all' ? [account_id] : [])]);

        const openMap = new Map();
        openBalances.forEach(o => {
            openMap.set(o.code, parseFloat(o.balance || 0));
        });

        // Period movements
        const [movements] = await pool.query(`
            SELECT a.id as account_id, a.code as account_code, a.name as account_name, t.nature,
                   e.date, e.number as num_correl, e.description as entry_desc,
                   l.description as line_desc, l.debit, l.credit
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN account_types t ON a.account_type_id = t.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ? ${ctaFilter}
            ORDER BY a.code ASC, e.date ASC, e.number ASC, l.id ASC
        `, params);

        const periodText = `DEL ${formatDate(start_date)} AL ${formatDate(end_date)}`;

        // Group by account
        const accountMap = new Map();

        // Seed with accounts that have opening balances
        for (const o of openBalances) {
            accountMap.set(o.code, {
                code: o.code,
                name: o.name,
                nature: o.nature || 'debit',
                initialBalance: parseFloat(o.balance || 0),
                movimientos: [],
                totalDebits: 0,
                totalCredits: 0,
                saldoFinal: parseFloat(o.balance || 0)
            });
        }

        // Add movements
        for (const m of movements) {
            const code = m.account_code;
            if (!accountMap.has(code)) {
                accountMap.set(code, {
                    code,
                    name: m.account_name,
                    nature: m.nature || 'debit',
                    initialBalance: openMap.get(code) || 0,
                    movimientos: [],
                    totalDebits: 0,
                    totalCredits: 0,
                    saldoFinal: openMap.get(code) || 0
                });
            }
            const acc = accountMap.get(code);
            const deb = parseFloat(m.debit || 0);
            const cred = parseFloat(m.credit || 0);
            acc.totalDebits += deb;
            acc.totalCredits += cred;
            const net = acc.nature === 'debit' ? (deb - cred) : (cred - deb);
            acc.saldoFinal += net;

            acc.movimientos.push({
                fecha: formatDate(m.date),
                corr: m.num_correl || 'S/N',
                concepto: m.line_desc || m.entry_desc || '',
                debit: deb,
                credit: cred,
                saldo: acc.saldoFinal
            });
        }

        const accounts = Array.from(accountMap.values());

        if (req.query.format === 'excel') {
            const rowsForExcel = [];
            accounts.forEach(acc => {
                acc.movimientos.forEach(m => {
                    rowsForExcel.push({
                        cuenta: acc.code,
                        nombre_cuenta: acc.name,
                        fecha: m.fecha,
                        correlativo: m.corr,
                        concepto: m.concepto,
                        debito: m.debit,
                        credito: m.credit,
                        saldo: m.saldo
                    });
                });
            });
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 14 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 32 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Correlativo', key: 'correlativo', width: 14 },
                { header: 'Concepto', key: 'concepto', width: 35 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 }
            ], `Libro_Mayor_${start_date}_al_${end_date}.xlsx`);
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Libro Mayor', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;
            const colW = { fecha: 55, corr: 55, desc: 222, debit: 70, credit: 70, saldo: 80 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('FECHA', x, yPos + 3); x += colW.fecha;
                doc.text('CORR.', x, yPos + 3); x += colW.corr;
                doc.text('CONCEPTO', x, yPos + 3); x += colW.desc;
                doc.text('DÉBITO', x, yPos + 3, { align: 'right', width: colW.debit - 6 }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos + 3, { align: 'right', width: colW.credit - 6 }); x += colW.credit;
                doc.text('SALDO', x, yPos + 3, { align: 'right', width: colW.saldo - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            if (accounts.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron movimientos registrados en el período.', startX, y + 10);
                y += 30;
            } else {
                for (const acc of accounts) {
                    if (y > 680) {
                        doc.addPage();
                        renderHeader(doc, company, 'Libro Mayor', periodText, 'portrait');
                        y = drawTableHeader(doc.y + 4);
                    }

                    // Account Header Banner
                    doc.rect(startX, y, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`CUENTA: ${acc.code} - ${acc.name}`, startX + 4, y + 3);
                    doc.text(`SALDO INICIAL: ${fmt(acc.initialBalance)}`, startX + contentWidth - 170, y + 3, { align: 'right', width: 165 });
                    y += 16;

                    for (const m of acc.movimientos) {
                        if (y > 700) {
                            doc.addPage();
                            renderHeader(doc, company, 'Libro Mayor', periodText, 'portrait');
                            y = drawTableHeader(doc.y + 4);
                        }
                        doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                        let lx = startX + 4;
                        doc.text(m.fecha, lx, y, { width: colW.fecha }); lx += colW.fecha;
                        doc.text(m.corr, lx, y, { width: colW.corr }); lx += colW.corr;
                        doc.text((m.concepto || '').substring(0, 36), lx, y, { width: colW.desc - 6 }); lx += colW.desc;
                        doc.text(fmt(m.debit), lx, y, { align: 'right', width: colW.debit - 6 }); lx += colW.debit;
                        doc.text(fmt(m.credit), lx, y, { align: 'right', width: colW.credit - 6 }); lx += colW.credit;
                        doc.text(fmt(m.saldo), lx, y, { align: 'right', width: colW.saldo - 6 });
                        y += 11;
                    }

                    // Subtotals
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.fecha + colW.corr + colW.desc, y).lineTo(startX + contentWidth, y).stroke();
                    y += 2;
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`TOTALES CUENTA ${acc.code}:`, startX + 4, y);
                    let sx = startX + colW.fecha + colW.corr + colW.desc;
                    doc.text(fmt(acc.totalDebits), sx, y, { align: 'right', width: colW.debit - 6 }); sx += colW.debit;
                    doc.text(fmt(acc.totalCredits), sx, y, { align: 'right', width: colW.credit - 6 }); sx += colW.credit;
                    doc.text(fmt(acc.saldoFinal), sx, y, { align: 'right', width: colW.saldo - 6 });
                    y += 14;
                }
            }

            renderClosingFooter(doc, startX, y, accounts.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getLibroMayor Error]:', e);
        res.status(500).json({ message: e.message });
    }
};


// =============================================================================
// 9. AUXILIAR DE OPERACIONES
// =============================================================================

const getAuxiliarOperaciones = async (req, res) => {
    try {
        const { start_date, end_date, account_from, account_to } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const periodText = `DEL ${formatDate(start_date)} AL ${formatDate(end_date)}`;

        let queryTx = `
            SELECT d.id as line_id, d.account_id, a.code as account_code, a.name as account_name,
                   t.nature, c.date, c.number as num_correl,
                   d.description as line_desc, c.description as entry_desc,
                   et.name as entry_type_name, d.debit, d.credit
            FROM accounting_entry_lines d
            INNER JOIN accounting_entries c ON d.entry_id = c.id
            INNER JOIN chart_of_accounts a ON d.account_id = a.id
            INNER JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN entry_types et ON c.entry_type_id = et.id
            WHERE c.company_id = ? AND c.status = 'posted' AND c.date BETWEEN ? AND ?
        `;
        const qParams = [req.company_id, start_date, end_date];

        if (account_from) {
            queryTx += ' AND a.code >= ?';
            qParams.push(account_from.trim());
        }
        if (account_to) {
            queryTx += ' AND a.code <= ?';
            qParams.push(account_to.trim());
        }

        queryTx += ' ORDER BY a.code ASC, c.date ASC, c.number ASC, d.id ASC';

        const [txRows] = await pool.query(queryTx, qParams);

        // Initial balances prior to start_date
        let queryInit = `
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as sum_debit,
                   COALESCE(SUM(l.credit), 0) as sum_credit
            FROM accounting_entry_lines l
            INNER JOIN chart_of_accounts a ON l.account_id = a.id
            INNER JOIN accounting_entries c ON l.entry_id = c.id
            WHERE c.company_id = ? AND c.status = 'posted' AND c.date < ?
        `;
        const initParams = [req.company_id, start_date];
        if (account_from) { queryInit += ' AND a.code >= ?'; initParams.push(account_from.trim()); }
        if (account_to) { queryInit += ' AND a.code <= ?'; initParams.push(account_to.trim()); }
        queryInit += ' GROUP BY a.code';

        const [initRows] = await pool.query(queryInit, initParams);

        const initMap = new Map();
        for (const r of initRows) {
            const code = r.code;
            const isDebit = !code.startsWith('2') && !code.startsWith('3') && !code.startsWith('5');
            const d = parseFloat(r.sum_debit || 0);
            const c = parseFloat(r.sum_credit || 0);
            initMap.set(code, isDebit ? (d - c) : (c - d));
        }

        // Group by account
        const accountMap = new Map();
        for (const r of txRows) {
            const code = r.account_code;
            if (!accountMap.has(code)) {
                const initBal = initMap.get(code) || 0;
                accountMap.set(code, {
                    code,
                    name: r.account_name,
                    nature: r.nature || 'debit',
                    initialBalance: initBal,
                    movimientos: [],
                    totalCargos: 0,
                    totalAbonos: 0,
                    saldoFinal: initBal
                });
            }

            const acc = accountMap.get(code);
            const cargo = parseFloat(r.debit || 0);
            const abono = parseFloat(r.credit || 0);
            acc.totalCargos += cargo;
            acc.totalAbonos += abono;

            const net = acc.nature === 'debit' ? (cargo - abono) : (abono - cargo);
            acc.saldoFinal += net;

            acc.movimientos.push({
                fecha: formatDate(r.date),
                tipoPartida: `${r.num_correl || ''} ${r.entry_type_name || ''}`.trim(),
                concepto: r.line_desc || r.entry_desc || '',
                cargo,
                abono,
                saldo: acc.saldoFinal
            });
        }

        const accounts = Array.from(accountMap.values());
        let grandCargos = 0;
        let grandAbonos = 0;
        accounts.forEach(a => {
            grandCargos += a.totalCargos;
            grandAbonos += a.totalAbonos;
        });

        if (req.query.format === 'excel') {
            const rowsForExcel = [];
            accounts.forEach(a => {
                a.movimientos.forEach(m => {
                    rowsForExcel.push({
                        cuenta: a.code,
                        nombre: a.name,
                        fecha: m.fecha,
                        partida_tipo: m.tipoPartida,
                        concepto: m.concepto,
                        cargo: m.cargo,
                        abono: m.abono,
                        saldo: m.saldo
                    });
                });
            });
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 14 },
                { header: 'Nombre', key: 'nombre', width: 32 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Partida / Tipo', key: 'partida_tipo', width: 18 },
                { header: 'Concepto', key: 'concepto', width: 35 },
                { header: 'Cargo', key: 'cargo', width: 14 },
                { header: 'Abono', key: 'abono', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 }
            ], `Auxiliar_Operaciones_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'landscape', (doc) => {
            renderHeader(doc, company, 'Auxiliar de Operaciones', periodText, 'landscape');

            const startX = 30;
            const contentWidth = 732;
            const colW = { fecha: 65, tipo: 95, desc: 302, cargo: 90, abono: 90, saldo: 90 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('FECHA', x, yPos + 3); x += colW.fecha;
                doc.text('TIPO / PARTIDA', x, yPos + 3); x += colW.tipo;
                doc.text('CONCEPTO', x, yPos + 3); x += colW.desc;
                doc.text('CARGO', x, yPos + 3, { align: 'right', width: colW.cargo - 6 }); x += colW.cargo;
                doc.text('ABONO', x, yPos + 3, { align: 'right', width: colW.abono - 6 }); x += colW.abono;
                doc.text('SALDO', x, yPos + 3, { align: 'right', width: colW.saldo - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            if (accounts.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron transacciones en el rango de cuentas y fechas seleccionado.', startX, y + 10);
                y += 30;
            } else {
                for (const a of accounts) {
                    if (y > 510) {
                        doc.addPage();
                        renderHeader(doc, company, 'Auxiliar de Operaciones', periodText, 'landscape');
                        y = drawTableHeader(doc.y + 4);
                    }

                    // Account Banner
                    doc.rect(startX, y, contentWidth, 14).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`CUENTA: ${a.code} - ${a.name}`, startX + 4, y + 3);
                    doc.text(`SALDO INICIAL: ${fmt(a.initialBalance)}`, startX + contentWidth - 170, y + 3, { align: 'right', width: 165 });
                    y += 16;

                    for (const m of a.movimientos) {
                        if (y > 530) {
                            doc.addPage();
                            renderHeader(doc, company, 'Auxiliar de Operaciones', periodText, 'landscape');
                            y = drawTableHeader(doc.y + 4);
                        }
                        doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                        let lx = startX + 4;
                        doc.text(m.fecha, lx, y, { width: colW.fecha }); lx += colW.fecha;
                        doc.text(m.tipoPartida, lx, y, { width: colW.tipo - 4 }); lx += colW.tipo;
                        doc.text((m.concepto || '').substring(0, 54), lx, y, { width: colW.desc - 6 }); lx += colW.desc;
                        doc.text(fmt(m.cargo), lx, y, { align: 'right', width: colW.cargo - 6 }); lx += colW.cargo;
                        doc.text(fmt(m.abono), lx, y, { align: 'right', width: colW.abono - 6 }); lx += colW.abono;
                        doc.text(fmt(m.saldo), lx, y, { align: 'right', width: colW.saldo - 6 });
                        y += 11;
                    }

                    // Subtotal of account
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX + colW.fecha + colW.tipo + colW.desc, y).lineTo(startX + contentWidth, y).stroke();
                    y += 2;
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`TOTALES CUENTA ${a.code}:`, startX + 4, y);
                    let sx = startX + colW.fecha + colW.tipo + colW.desc;
                    doc.text(fmt(a.totalCargos), sx, y, { align: 'right', width: colW.cargo - 6 }); sx += colW.cargo;
                    doc.text(fmt(a.totalAbonos), sx, y, { align: 'right', width: colW.abono - 6 }); sx += colW.abono;
                    doc.text(fmt(a.saldoFinal), sx, y, { align: 'right', width: colW.saldo - 6 });
                    y += 14;
                }

                // Grand Totals
                if (y > 500) {
                    doc.addPage();
                    renderHeader(doc, company, 'Auxiliar de Operaciones', periodText, 'landscape');
                    y = doc.y + 10;
                }
                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                y += 4;
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('TOTAL GENERAL:', startX + 4, y);
                let gx = startX + colW.fecha + colW.tipo + colW.desc;
                doc.text(fmt(grandCargos), gx, y, { align: 'right', width: colW.cargo - 6 }); gx += colW.cargo;
                doc.text(fmt(grandAbonos), gx, y, { align: 'right', width: colW.abono - 6 });
                y += 18;
            }

            renderClosingFooter(doc, startX, y, accounts.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'landscape');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getAuxiliarOperaciones Error]:', e);
        res.status(500).json({ message: e.message });
    }
};


// =============================================================================
// 10. LISTADO DE PARTIDAS
// =============================================================================

const getListadoPartidas = async (req, res) => {
    try {
        const { start_date, end_date, entry_type_id, status } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const periodText = `DEL ${formatDate(start_date)} AL ${formatDate(end_date)}`;

        let query = `
            SELECT e.id, e.date, e.number, e.description, e.status, e.total_debit, e.total_credit,
                   et.name as entry_type_name
            FROM accounting_entries e
            LEFT JOIN entry_types et ON e.entry_type_id = et.id
            WHERE e.company_id = ? AND e.date BETWEEN ? AND ?
        `;
        const params = [req.company_id, start_date, end_date];

        if (entry_type_id && entry_type_id !== 'all') {
            query += ' AND e.entry_type_id = ?';
            params.push(entry_type_id);
        }
        if (status && status !== 'all') {
            query += ' AND e.status = ?';
            params.push(status);
        }

        query += ' ORDER BY e.date ASC, e.number ASC, e.id ASC';

        const [rows] = await pool.query(query, params);

        let totalDebit = 0;
        let totalCredit = 0;
        rows.forEach(r => {
            totalDebit += parseFloat(r.total_debit || 0);
            totalCredit += parseFloat(r.total_credit || 0);
        });

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                numero: r.number,
                fecha: formatDate(r.date),
                tipo: r.entry_type_name || 'DIARIO',
                concepto: r.description || '',
                debito: parseFloat(r.total_debit || 0),
                credito: parseFloat(r.total_credit || 0),
                estado: r.status === 'posted' ? 'Mayorizada' : (r.status === 'draft' ? 'Borrador' : 'Anulada')
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Número', key: 'numero', width: 14 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Tipo', key: 'tipo', width: 18 },
                { header: 'Concepto', key: 'concepto', width: 35 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Estado', key: 'estado', width: 14 }
            ], `Listado_Partidas_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Listado de Partidas Contables', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;
            const colW = { num: 65, fecha: 55, tipo: 85, desc: 177, debit: 55, credit: 55, status: 60 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('NÚMERO', x, yPos + 3); x += colW.num;
                doc.text('FECHA', x, yPos + 3); x += colW.fecha;
                doc.text('TIPO', x, yPos + 3); x += colW.tipo;
                doc.text('CONCEPTO', x, yPos + 3); x += colW.desc;
                doc.text('DÉBITO', x, yPos + 3, { align: 'right', width: colW.debit - 4 }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos + 3, { align: 'right', width: colW.credit - 4 }); x += colW.credit;
                doc.text('ESTADO', x, yPos + 3, { align: 'center', width: colW.status });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            if (rows.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron partidas registradas con los filtros seleccionados.', startX, y + 10);
                y += 30;
            } else {
                for (const r of rows) {
                    if (y > 700) {
                        doc.addPage();
                        renderHeader(doc, company, 'Listado de Partidas Contables', periodText, 'portrait');
                        y = drawTableHeader(doc.y + 4);
                    }
                    doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                    let x = startX + 4;
                    doc.text(r.number, x, y, { width: colW.num }); x += colW.num;
                    doc.text(formatDate(r.date), x, y, { width: colW.fecha }); x += colW.fecha;
                    doc.text(r.entry_type_name || 'DIARIO', x, y, { width: colW.tipo - 4 }); x += colW.tipo;
                    doc.text((r.description || '').substring(0, 32), x, y, { width: colW.desc - 6 }); x += colW.desc;
                    doc.text(fmt(r.total_debit), x, y, { align: 'right', width: colW.debit - 4 }); x += colW.debit;
                    doc.text(fmt(r.total_credit), x, y, { align: 'right', width: colW.credit - 4 }); x += colW.credit;

                    const stText = r.status === 'posted' ? 'Mayorizada' : (r.status === 'draft' ? 'Borrador' : 'Anulada');
                    doc.text(stText, x, y, { align: 'center', width: colW.status });
                    y += 11;
                }

                // Grand Totals
                if (y > 680) {
                    doc.addPage();
                    renderHeader(doc, company, 'Listado de Partidas Contables', periodText, 'portrait');
                    y = doc.y + 10;
                }
                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                y += 4;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('TOTAL GENERAL:', startX + 4, y);
                let gx = startX + colW.num + colW.fecha + colW.tipo + colW.desc;
                doc.text(fmt(totalDebit), gx, y, { align: 'right', width: colW.debit - 4 }); gx += colW.debit;
                doc.text(fmt(totalCredit), gx, y, { align: 'right', width: colW.credit - 4 });
                y += 18;
            }

            renderClosingFooter(doc, startX, y, rows.length, 'Partidas');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getListadoPartidas Error]:', e);
        res.status(500).json({ message: e.message });
    }
};


// =============================================================================
// 14. REPORTE DE RETENCIONES
// =============================================================================

const getRetenciones = async (req, res) => {
    try {
        const { year, month, retention_type } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const y = parseInt(year);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const lastD = getLastDayOfMonth(y, m);
        const periodStart = `${y}-${String(m).padStart(2, '0')}-01`;
        const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const periodText = `MES DE ${MONTH_NAMES[m]} DE ${y}`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        let ctaFilter = `
            (a.name LIKE '%retenci%' OR a.name LIKE '%iva retenido%' OR a.name LIKE '%isr%'
             OR a.name LIKE '%perceb%' OR a.name LIKE '%percepci%' OR a.code LIKE '2102%' OR a.code LIKE '2103%')
        `;

        if (retention_type === 'iva') {
            ctaFilter = `(a.name LIKE '%iva%' OR a.name LIKE '%percep%')`;
        } else if (retention_type === 'isr') {
            ctaFilter = `(a.name LIKE '%isr%' OR a.name LIKE '%renta%')`;
        }

        const [retAccounts] = await pool.query(`
            SELECT a.id, a.code, a.name, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.company_id = ? AND a.active = 1 AND ${ctaFilter}
            ORDER BY a.code ASC
        `, [req.company_id]);

        if (retAccounts.length === 0) {
            return buildPDF(res, 'portrait', (doc) => {
                renderHeader(doc, company, 'Reporte Oficial de Retenciones (IVA / ISR)', periodText, 'portrait');
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron cuentas contables asociadas a retenciones (IVA/ISR) en el catálogo de la empresa.', 30, doc.y + 10);
                renderSignatures(doc, signatures, company, 'portrait');
                renderPageNumbers(doc);
                doc.end();
            });
        }

        const ids = retAccounts.map(a => a.id);
        const [lines] = await pool.query(`
            SELECT a.id as account_id, a.code, a.name, t.nature,
                   COALESCE(SUM(l.debit), 0) as total_debit,
                   COALESCE(SUM(l.credit), 0) as total_credit,
                   CASE WHEN t.nature = 'debit'
                       THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                       ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                   END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            WHERE a.id IN (${ids.join(',')}) AND a.company_id = ?
            GROUP BY a.id
            ORDER BY a.code ASC
        `, [periodStart, periodEnd, req.company_id]);

        let grandDebit = 0;
        let grandCredit = 0;
        let grandBalance = 0;

        lines.forEach(l => {
            grandDebit += parseFloat(l.total_debit || 0);
            grandCredit += parseFloat(l.total_credit || 0);
            grandBalance += parseFloat(l.balance || 0);
        });

        if (req.query.format === 'excel') {
            const rowsForExcel = lines.map(l => ({
                codigo: l.code,
                cuenta: l.name,
                debito: parseFloat(l.total_debit || 0),
                credito: parseFloat(l.total_credit || 0),
                saldo: parseFloat(l.balance || 0)
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Cuenta', key: 'cuenta', width: 35 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Saldo Retenido', key: 'saldo', width: 16 }
            ], `Retenciones_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Reporte Oficial de Retenciones (IVA / ISR)', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;
            const colW = { code: 80, name: 252, debit: 70, credit: 70, saldo: 80 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('CÓDIGO', x, yPos + 3); x += colW.code;
                doc.text('NOMBRE DE LA CUENTA', x, yPos + 3); x += colW.name;
                doc.text('DÉBITO', x, yPos + 3, { align: 'right', width: colW.debit - 4 }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos + 3, { align: 'right', width: colW.credit - 4 }); x += colW.credit;
                doc.text('SALDO RETENIDO', x, yPos + 3, { align: 'right', width: colW.saldo - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            for (const l of lines) {
                if (y > 700) {
                    doc.addPage();
                    renderHeader(doc, company, 'Reporte Oficial de Retenciones (IVA / ISR)', periodText, 'portrait');
                    y = drawTableHeader(doc.y + 4);
                }
                doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                let x = startX + 4;
                doc.text(l.code, x, y, { width: colW.code }); x += colW.code;
                doc.text(l.name.substring(0, 42), x, y, { width: colW.name - 6 }); x += colW.name;
                doc.text(fmt(l.total_debit), x, y, { align: 'right', width: colW.debit - 4 }); x += colW.debit;
                doc.text(fmt(l.total_credit), x, y, { align: 'right', width: colW.credit - 4 }); x += colW.credit;
                doc.text(fmt(l.balance), x, y, { align: 'right', width: colW.saldo - 6 });
                y += 11;
            }

            // Totals
            if (y > 680) {
                doc.addPage();
                renderHeader(doc, company, 'Reporte Oficial de Retenciones (IVA / ISR)', periodText, 'portrait');
                y = doc.y + 10;
            }
            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            y += 4;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL GENERAL:', startX + 4, y);
            let gx = startX + colW.code + colW.name;
            doc.text(fmt(grandDebit), gx, y, { align: 'right', width: colW.debit - 4 }); gx += colW.debit;
            doc.text(fmt(grandCredit), gx, y, { align: 'right', width: colW.credit - 4 }); gx += colW.credit;
            doc.text(fmt(grandBalance), gx, y, { align: 'right', width: colW.saldo - 6 });
            y += 18;

            renderClosingFooter(doc, startX, y, lines.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getRetenciones Error]:', e);
        res.status(500).json({ message: e.message });
    }
};


module.exports = {
    getLibroDiario,
    getLibroDiarioMayor,
    getLibroMayor,
    getAuxiliarOperaciones,
    getListadoPartidas,
    getRetenciones
};
