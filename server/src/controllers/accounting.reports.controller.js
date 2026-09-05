const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const excelService = require('../services/excel.service');

// === HELPERS ===

async function getCompanyInfo(companyId) {
    const [rows] = await pool.query('SELECT id, razon_social, nombre_comercial, nit, direccion FROM companies WHERE id = ?', [companyId]);
    return rows[0] || { razon_social: 'EMPRESA', nit: '---', direccion: '' };
}

async function getSignatures(companyId) {
    const [rows] = await pool.query(
        `SELECT setting_key, setting_value FROM accounting_settings 
         WHERE company_id = ? AND setting_key IN ('contador_nombre','contador_dui','auditor_nombre','auditor_dui')`,
        [companyId]
    );
    const sig = { contador_nombre: '', contador_dui: '', auditor_nombre: '', auditor_dui: '' };
    rows.forEach(r => { sig[r.setting_key] = r.setting_value || ''; });
    return sig;
}

function renderHeader(doc, company, title, periodText) {
    doc.fontSize(16).font('Helvetica-Bold').text(company.razon_social?.toUpperCase() || 'EMPRESA', { align: 'center' });
    if (company.nit) doc.fontSize(9).font('Helvetica').text(`NIT: ${company.nit}`, { align: 'center' });
    if (company.direccion) doc.fontSize(8).font('Helvetica').text(company.direccion, { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(13).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center', underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    if (periodText) doc.text(periodText, { align: 'center' });
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-SV')}`, { align: 'center' });
    doc.moveDown(1);
}

function renderSignatures(doc, signatures) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 70) {
        doc.addPage();
    }
    const colW = 180;
    const margin = 70;
    const leftX = margin;
    const rightX = doc.page.width - margin - colW;

    const sigY = doc.page.height - doc.page.margins.bottom - 55;

    doc.moveTo(leftX, sigY).lineTo(leftX + colW, sigY).stroke();
    doc.moveTo(rightX, sigY).lineTo(rightX + colW, sigY).stroke();

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(signatures.contador_nombre || '____________________', leftX, sigY + 5, { align: 'center', width: colW });
    doc.text(signatures.auditor_nombre || '____________________', rightX, sigY + 5, { align: 'center', width: colW });

    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    doc.text(`Contador${signatures.contador_dui ? ` DUI: ${signatures.contador_dui}` : ''}`, leftX, sigY + 18, { align: 'center', width: colW });
    doc.text(`Auditor${signatures.auditor_dui ? ` DUI: ${signatures.auditor_dui}` : ''}`, rightX, sigY + 18, { align: 'center', width: colW });
    doc.fillColor('black');
}

function renderPageNumbers(doc) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8');
        doc.text(`Página ${i + 1} de ${range.count}`, 30, doc.page.height - doc.page.margins.bottom - 15, { align: 'center', width: doc.page.width - 60 });
        doc.fillColor('black');
    }
}

function monthFilter(year, month, alias) {
    const a = alias || 'e';
    if (month) return `${a}.status = 'posted' AND YEAR(${a}.date) = ? AND MONTH(${a}.date) = ?`;
    return `${a}.status = 'posted' AND YEAR(${a}.date) = ?`;
}

function buildPDF(res, buildContent) {
    const doc = new PDFDocument({ margin: 30, size: 'LETTER', layout: 'landscape', bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(result);
    });
    try { buildContent(doc); } catch (e) { console.error(e); doc.end(); }
}

function fiscalYearMonthParams(year, month) {
    const params = [year];
    if (month) params.push(parseInt(month));
    return params;
}

function formatDate(d) {
    if (!d) return '---';
    if (typeof d === 'string') {
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '---';
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

function fmt(num) {
    return `$${parseFloat(num || 0).toFixed(2)}`;
}

function buildExcelResponse(res, rows, columns, filename) {
    return excelService.createExcelBuffer({
        sheets: [{ name: 'Reporte', columns, data: rows }]
    }).then(buffer => excelService.sendExcelResponse(res, buffer, filename));
}

// === REPORTE 1: LIBRO DIARIO ===

const getLibroDiario = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        const [entries] = await pool.query(`
            SELECT e.date, e.number, e.description as entry_desc, e.total_debit, e.total_credit,
                   l.account_id, a.code as account_code, a.name as account_name,
                   l.description as line_desc, l.debit, l.credit, et.name as entry_type
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            JOIN chart_of_accounts a ON l.account_id = a.id
            LEFT JOIN entry_types et ON e.entry_type_id = et.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            ORDER BY e.date, e.id, l.id
        `, [req.company_id, start_date, end_date]);

        if (req.query.format === 'excel') {
            const rowsForExcel = entries.map(r => ({
                fecha: formatDate(r.date),
                numero: r.number || '---',
                tipo: r.entry_type || '',
                cuenta: r.account_code || '',
                nombre_cuenta: r.account_name || '',
                descripcion: r.line_desc || '',
                debito: parseFloat(r.debit || 0),
                credito: parseFloat(r.credit || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Número', key: 'numero', width: 14 },
                { header: 'Tipo', key: 'tipo', width: 12 },
                { header: 'Cuenta', key: 'cuenta', width: 12 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 25 },
                { header: 'Descripción', key: 'descripcion', width: 30 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
            ], `Libro_Diario_${start_date}_${end_date}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Libro Diario', `Período: ${start_date} al ${end_date}`);

            const startX = 20;
            let y = doc.y;
            const colW = { date: 55, num: 80, type: 70, account: 75, name: 140, desc: 160, debit: 75, credit: 75 };
            const totalW = Object.values(colW).reduce((a, b) => a + b, 0);

            const drawHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('FECHA', x, yPos); x += colW.date;
                doc.text('NÚMERO', x, yPos); x += colW.num;
                doc.text('TIPO', x, yPos); x += colW.type;
                doc.text('CTA', x, yPos); x += colW.account;
                doc.text('NOMBRE CUENTA', x, yPos); x += colW.name;
                doc.text('DESCRIPCIÓN', x, yPos); x += colW.desc;
                doc.text('DÉBITO', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos, { align: 'right', width: colW.credit });
                doc.moveTo(startX, yPos + 10).lineTo(startX + totalW, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let entryDate = null;
            let subDebit = 0, subCredit = 0;

            entries.forEach((row, i) => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }

                if (row.date !== entryDate) {
                    if (entryDate !== null) {
                        doc.font('Helvetica-Bold');
                        doc.text(formatDate(entryDate), startX + colW.date + colW.num + colW.type + colW.account + colW.name + colW.desc - 20, y, { align: 'right' });
                        doc.text(fmt(subDebit), startX + totalW - colW.debit - colW.credit, y, { align: 'right', width: colW.debit });
                        doc.text(fmt(subCredit), startX + totalW - colW.credit, y, { align: 'right', width: colW.credit });
                        y += 12;
                        doc.moveTo(startX, y).lineTo(startX + totalW, y).stroke();
                        y += 5;
                        subDebit = 0; subCredit = 0;
                    }
                    entryDate = row.date;
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(formatDate(row.date), startX, y);
                    doc.fillColor('black');
                } else {
                    doc.fontSize(7.5).font('Helvetica');
                    doc.text('', startX, y);
                }

                let x = startX + colW.date;
                doc.text(row.number || '---', x, y, { width: colW.num - 2 }); x += colW.num;
                doc.text(row.entry_type || '', x, y, { width: colW.type - 2 }); x += colW.type;
                doc.text(row.account_code || '', x, y, { width: colW.account - 2 }); x += colW.account;
                doc.text((row.account_name || '').substring(0, 25), x, y, { width: colW.name - 2 }); x += colW.name;
                doc.text((row.line_desc || '').substring(0, 30), x, y, { width: colW.desc - 2 }); x += colW.desc;
                doc.text(fmt(row.debit), x, y, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text(fmt(row.credit), x, y, { align: 'right', width: colW.credit });

                subDebit += parseFloat(row.debit || 0);
                subCredit += parseFloat(row.credit || 0);
                y += 10;

                if (i === entries.length - 1) {
                    doc.font('Helvetica-Bold');
                    doc.text(formatDate(entryDate), startX + colW.date + colW.num + colW.type + colW.account + colW.name + colW.desc - 20, y, { align: 'right' });
                    doc.text(fmt(subDebit), startX + totalW - colW.debit - colW.credit, y, { align: 'right', width: colW.debit });
                    doc.text(fmt(subCredit), startX + totalW - colW.credit, y, { align: 'right', width: colW.credit });
                    y += 12;
                    doc.moveTo(startX, y).lineTo(startX + totalW, y).stroke();
                    y += 10;
                }
            });

            if (entries.length === 0) {
                doc.fontSize(10).font('Helvetica').text('No se encontraron partidas en el período seleccionado.', startX, y);
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 2: LIBRO DIARIO MAYOR ===

const getLibroDiarioMayor = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        const [rows] = await pool.query(`
            SELECT e.date, e.number, e.description as entry_desc,
                   a.code as account_code, a.name as account_name,
                   l.debit, l.credit
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            JOIN chart_of_accounts a ON l.account_id = a.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            ORDER BY a.code, e.date, e.id
        `, [req.company_id, start_date, end_date]);

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                cuenta: r.account_code || '',
                nombre: r.account_name || '',
                fecha: formatDate(r.date),
                numero: r.number || '---',
                descripcion: r.entry_desc || '',
                debito: parseFloat(r.debit || 0),
                credito: parseFloat(r.credit || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 12 },
                { header: 'Nombre', key: 'nombre', width: 25 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Número', key: 'numero', width: 14 },
                { header: 'Descripción', key: 'descripcion', width: 30 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
            ], `Libro_Diario_Mayor_${start_date}_${end_date}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Libro Diario Mayor', `Período: ${start_date} al ${end_date}`);

            const startX = 20;
            let y = doc.y;
            const colW = { account: 75, name: 150, date: 50, num: 75, desc: 185, debit: 70, credit: 70 };
            const totalW = Object.values(colW).reduce((a, b) => a + b, 0);

            const drawHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('CUENTA', x, yPos); x += colW.account;
                doc.text('NOMBRE', x, yPos); x += colW.name;
                doc.text('FECHA', x, yPos); x += colW.date;
                doc.text('NÚMERO', x, yPos); x += colW.num;
                doc.text('DESCRIPCIÓN', x, yPos); x += colW.desc;
                doc.text('DÉBITO', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos, { align: 'right', width: colW.credit });
                doc.moveTo(startX, yPos + 10).lineTo(startX + totalW, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let currentAccount = null;
            let accDebit = 0, accCredit = 0;

            rows.forEach((row, i) => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }

                if (row.account_code !== currentAccount) {
                    if (currentAccount !== null) {
                        doc.font('Helvetica-Bold');
                        doc.text('SUBTOTAL:', startX + colW.account + colW.name + colW.date + colW.num + colW.desc - 50, y, { align: 'right' });
                        doc.text(fmt(accDebit), startX + totalW - colW.debit - colW.credit, y, { align: 'right', width: colW.debit });
                        doc.text(fmt(accCredit), startX + totalW - colW.credit, y, { align: 'right', width: colW.credit });
                        y += 12;
                        doc.moveTo(startX, y).lineTo(startX + totalW, y).stroke();
                        y += 5;
                        accDebit = 0; accCredit = 0;
                    }
                    currentAccount = row.account_code;
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(row.account_code, startX, y);
                    doc.text(row.account_name, startX + colW.account, y);
                    doc.fillColor('black');
                }

                doc.fontSize(7.5).font('Helvetica');
                let x = startX + colW.account + colW.name;
                doc.text(formatDate(row.date), x, y, { width: colW.date - 2 }); x += colW.date;
                doc.text(row.number || '---', x, y, { width: colW.num - 2 }); x += colW.num;
                doc.text((row.entry_desc || '').substring(0, 32), x, y, { width: colW.desc - 2 }); x += colW.desc;
                doc.text(fmt(row.debit), x, y, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text(fmt(row.credit), x, y, { align: 'right', width: colW.credit });

                accDebit += parseFloat(row.debit || 0);
                accCredit += parseFloat(row.credit || 0);
                y += 10;

                if (i === rows.length - 1) {
                    doc.font('Helvetica-Bold');
                    doc.text('SUBTOTAL:', startX + colW.account + colW.name + colW.date + colW.num + colW.desc - 50, y, { align: 'right' });
                    doc.text(fmt(accDebit), startX + totalW - colW.debit - colW.credit, y, { align: 'right', width: colW.debit });
                    doc.text(fmt(accCredit), startX + totalW - colW.credit, y, { align: 'right', width: colW.credit });
                    y += 12;
                    doc.moveTo(startX, y).lineTo(startX + totalW, y).stroke();
                }
            });

            if (rows.length === 0) {
                doc.fontSize(10).font('Helvetica').text('No se encontraron movimientos en el período.', startX, y);
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 3: LIBRO MAYOR ===

const getLibroMayor = async (req, res) => {
    try {
        const { start_date, end_date, account_id } = req.query;
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        let accountFilter = '';
        const params = [req.company_id, start_date, end_date];
        const openParams = [start_date, req.company_id];
        if (account_id && account_id !== 'all') {
            accountFilter = ' AND a.id = ?';
            params.push(account_id);
            openParams.push(account_id);
        }

        // Saldos iniciales (antes del período)
        const [openBalances] = await pool.query(`
            SELECT a.id, a.code, a.name, t.nature, a.account_type_id,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted' AND e.date < ?
            WHERE a.company_id = ? AND a.active = 1 ${accountFilter}
            GROUP BY a.id
            HAVING balance != 0
            ORDER BY a.code
        `, openParams);

        // Movimientos del período
        const [movements] = await pool.query(`
            SELECT a.id, a.code, a.name, t.nature,
                   e.date, e.number, e.description as entry_desc,
                   l.debit, l.credit
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN account_types t ON a.account_type_id = t.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            ${account_id && account_id !== 'all' ? 'AND a.id = ?' : ''}
            ORDER BY a.code, e.date, e.id
        `, params);

        if (req.query.format === 'excel') {
            const openMap = {};
            openBalances.forEach(o => { openMap[o.id] = parseFloat(o.balance || 0); });
            const runningMap = { ...openMap };

            const rowsForExcel = [];

            movements.forEach(r => {
                if (!runningMap[r.id]) runningMap[r.id] = parseFloat(openMap[r.id] || 0);

                const debit = parseFloat(r.debit || 0);
                const credit = parseFloat(r.credit || 0);

                if (r.nature === 'debit') {
                    runningMap[r.id] = runningMap[r.id] + debit - credit;
                } else {
                    runningMap[r.id] = runningMap[r.id] + credit - debit;
                }

                rowsForExcel.push({
                    cuenta: `${r.code} - ${r.name}`,
                    nombre: r.name || '',
                    fecha: formatDate(r.date),
                    numero: r.number || '---',
                    descripcion: r.entry_desc || '',
                    debito: debit.toFixed(2),
                    credito: credit.toFixed(2),
                    saldo: runningMap[r.id].toFixed(2)
                });
            });

            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 20 },
                { header: 'Nombre', key: 'nombre', width: 25 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Número', key: 'numero', width: 14 },
                { header: 'Descripción', key: 'descripcion', width: 30 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 },
            ], `Libro_Mayor_${start_date}_${end_date}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Libro Mayor', `Período: ${start_date} al ${end_date}`);

            const startX = 20;
            let y = doc.y;
            const colW = { account: 70, name: 140, fecha: 45, num: 70, desc: 185, debit: 65, credit: 65, saldo: 70 };
            const totalW = Object.values(colW).reduce((a, b) => a + b, 0);

            const drawHeader = (yPos) => {
                doc.fontSize(7).font('Helvetica-Bold');
                let x = startX;
                doc.text('CUENTA', x, yPos); x += colW.account;
                doc.text('NOMBRE', x, yPos); x += colW.name;
                doc.text('FECHA', x, yPos); x += colW.fecha;
                doc.text('NÚMERO', x, yPos); x += colW.num;
                doc.text('DESCRIPCIÓN', x, yPos); x += colW.desc;
                doc.text('DÉBITO', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('SALDO', x, yPos, { align: 'right', width: colW.saldo });
                doc.moveTo(startX, yPos + 10).lineTo(startX + totalW, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let currentAccount = null;
            let runningBalance = 0;

            const openMap = {};
            openBalances.forEach(o => { openMap[o.id] = parseFloat(o.balance || 0); });

            movements.forEach((row, i) => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }

                if (row.id !== currentAccount) {
                    runningBalance = openMap[row.id] || 0;
                    currentAccount = row.id;
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(`${row.code} - ${row.name}`, startX, y);
                    doc.fillColor('black');
                    y += 12;

                    if (runningBalance !== 0) {
                        doc.fontSize(7.5).font('Helvetica');
                        doc.text('', startX, y);
                        doc.text('SALDO INICIAL', startX + colW.account + colW.name + colW.fecha + colW.num, y, { width: colW.desc - 2 });
                        doc.text(fmt(runningBalance), startX + totalW - colW.saldo, y, { align: 'right', width: colW.saldo });
                        y += 10;
                    }
                }

                doc.fontSize(7.5).font('Helvetica');
                let x = startX + colW.account + colW.name;
                doc.text(formatDate(row.date), x, y, { width: colW.fecha - 2 }); x += colW.fecha;
                doc.text(row.number || '---', x, y, { width: colW.num - 2 }); x += colW.num;
                doc.text((row.entry_desc || '').substring(0, 30), x, y, { width: colW.desc - 2 }); x += colW.desc;
                doc.text(fmt(row.debit), x, y, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text(fmt(row.credit), x, y, { align: 'right', width: colW.credit }); x += colW.credit;

                const nature = row.nature || 'debit';
                if (nature === 'debit') runningBalance += parseFloat(row.debit || 0) - parseFloat(row.credit || 0);
                else runningBalance += parseFloat(row.credit || 0) - parseFloat(row.debit || 0);
                doc.text(fmt(runningBalance), x, y, { align: 'right', width: colW.saldo });
                y += 10;
            });

            if (movements.length === 0 && openBalances.length === 0) {
                doc.text('No se encontraron movimientos en el período.', startX, y);
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 4: ESTADO DE RESULTADOS ===

const getEstadoResultados = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const params = fiscalYearMonthParams(year, month);

        const [rows] = await pool.query(`
            SELECT a.id, a.code, a.name, t.name as type_name, t.nature, a.account_type_id,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND ${monthFilter(year, month, 'e')}
            WHERE a.company_id = ? AND a.account_type_id IN (4,5,6) AND a.active = 1 AND a.allows_entries = 1
            GROUP BY a.id
            HAVING balance != 0
            ORDER BY a.account_type_id, a.code
        `, [...params, req.company_id]);

        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                codigo: r.code || '',
                nombre_cuenta: r.name || '',
                saldo: parseFloat(r.balance || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 40 },
                { header: 'Saldo', key: 'saldo', width: 16 },
            ], `Estado_Resultados_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Estado de Resultados', `Período: ${periodText}`);

            const startX = 30;
            let y = doc.y;
            const colW = { code: 80, name: 320, total: 120 };

            const drawHeader = (yPos) => {
                doc.fontSize(8).font('Helvetica-Bold');
                doc.text('CÓDIGO', startX, yPos);
                doc.text('NOMBRE DE LA CUENTA', startX + colW.code, yPos);
                doc.text('SALDO', startX + colW.code + colW.name, yPos, { align: 'right', width: colW.total });
                doc.moveTo(startX, yPos + 10).lineTo(startX + colW.code + colW.name + colW.total, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let totalIngresos = 0, totalCostos = 0, totalGastos = 0;
            let currentType = 0;

            rows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }

                if (row.account_type_id !== currentType) {
                    currentType = row.account_type_id;
                    const typeNames = { 4: 'INGRESOS', 5: 'COSTOS', 6: 'GASTOS' };
                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(typeNames[currentType] || 'OTROS', startX, y);
                    doc.fillColor('black');
                    y += 12;
                }

                doc.fontSize(8).font('Helvetica');
                doc.text(row.code, startX, y);
                doc.text(row.name, startX + colW.code, y);
                doc.text(fmt(row.balance), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                y += 10;

                const b = parseFloat(row.balance || 0);
                if (currentType === 4) totalIngresos += b;
                else if (currentType === 5) totalCostos += b;
                else if (currentType === 6) totalGastos += b;
            });

            if (rows.length === 0) {
                doc.text('No hay datos en el período seleccionado.', startX, y);
                y += 15;
            } else {
                y += 10;
                doc.moveTo(startX, y).lineTo(startX + colW.code + colW.name + colW.total, y).stroke();
                y += 10;
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('TOTAL INGRESOS', startX + colW.code, y);
                doc.text(fmt(totalIngresos), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                y += 12;
                doc.text('TOTAL COSTOS Y GASTOS', startX + colW.code, y);
                doc.text(fmt(totalCostos + totalGastos), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                y += 12;
                doc.moveTo(startX, y).lineTo(startX + colW.code + colW.name + colW.total, y).stroke();
                y += 10;
                const resultado = totalIngresos - totalCostos - totalGastos;
                doc.fontSize(11).font('Helvetica-Bold').fillColor(resultado >= 0 ? '#059669' : '#dc2626');
                doc.text('RESULTADO DEL EJERCICIO', startX + colW.code, y);
                doc.text(fmt(resultado), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                doc.fillColor('black');
            }

            y += 30;
            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 5: BALANCE GENERAL ===

const getBalanceGeneral = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const params = fiscalYearMonthParams(year, month);

        const [rows] = await pool.query(`
            SELECT a.id, a.code, a.name, t.name as type_name, t.nature, a.account_type_id,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND ${monthFilter(year, month, 'e')}
            WHERE a.company_id = ? AND a.account_type_id IN (1,2,3) AND a.active = 1 AND a.allows_entries = 1
            GROUP BY a.id
            HAVING balance != 0
            ORDER BY a.account_type_id, a.code
        `, [...params, req.company_id]);

        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                codigo: r.code || '',
                nombre_cuenta: r.name || '',
                saldo: parseFloat(r.balance || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 40 },
                { header: 'Saldo', key: 'saldo', width: 16 },
            ], `Balance_General_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Balance General', `Período: ${periodText}`);

            const startX = 30;
            let y = doc.y;
            const colW = { code: 80, name: 320, total: 120 };

            const drawHeader = (yPos) => {
                doc.fontSize(8).font('Helvetica-Bold');
                doc.text('CÓDIGO', startX, yPos);
                doc.text('NOMBRE DE LA CUENTA', startX + colW.code, yPos);
                doc.text('SALDO', startX + colW.code + colW.name, yPos, { align: 'right', width: colW.total });
                doc.moveTo(startX, yPos + 10).lineTo(startX + colW.code + colW.name + colW.total, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let totalActivo = 0, totalPasivo = 0, totalPatrimonio = 0;

            rows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }
                const b = parseFloat(row.balance || 0);

                if (row.account_type_id === 1) totalActivo += b;
                else if (row.account_type_id === 2) totalPasivo += b;
                else if (row.account_type_id === 3) totalPatrimonio += b;

                doc.fontSize(8).font('Helvetica');
                doc.text(row.code, startX, y);
                doc.text(row.name, startX + colW.code, y);
                doc.text(fmt(b), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                y += 10;
            });

            if (rows.length === 0) {
                doc.text('No hay datos en el período seleccionado.', startX, y);
                y += 15;
            } else {
                y += 10;
                doc.moveTo(startX, y).lineTo(startX + colW.code + colW.name + colW.total, y).stroke();
                y += 12;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
                doc.text('TOTAL ACTIVO', startX + colW.code, y);
                doc.text(fmt(totalActivo), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                y += 12;
                doc.text('TOTAL PASIVO', startX + colW.code, y);
                doc.text(fmt(totalPasivo), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                y += 12;
                doc.text('TOTAL PATRIMONIO', startX + colW.code, y);
                doc.text(fmt(totalPatrimonio), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                y += 12;
                doc.moveTo(startX, y).lineTo(startX + colW.code + colW.name + colW.total, y).stroke();
                y += 10;
                doc.fontSize(11).font('Helvetica-Bold').fillColor(totalActivo === totalPasivo + totalPatrimonio ? '#059669' : '#dc2626');
                doc.text('TOTAL PASIVO + PATRIMONIO', startX + colW.code, y);
                doc.text(fmt(totalPasivo + totalPatrimonio), startX + colW.code + colW.name, y, { align: 'right', width: colW.total });
                doc.fillColor('black');
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 6: ANEXO AL BALANCE GENERAL ===

const getAnexoBalance = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const params = fiscalYearMonthParams(year, month);
        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;

        const [rows] = await pool.query(`
            SELECT a.id, a.code, a.name, t.name as type_name, t.nature, a.account_type_id,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND ${monthFilter(year, month, 'e')}
            WHERE a.company_id = ? AND a.account_type_id IN (1,2,3) AND a.active = 1
            GROUP BY a.id
            HAVING balance != 0 OR total_debit > 0 OR total_credit > 0
            ORDER BY a.account_type_id, a.code
        `, [...params, req.company_id]);

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                codigo: r.code || '',
                nombre_cuenta: r.name || '',
                debitos: parseFloat(r.total_debit || 0),
                creditos: parseFloat(r.total_credit || 0),
                saldo: parseFloat(r.balance || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 35 },
                { header: 'Débitos', key: 'debitos', width: 14 },
                { header: 'Créditos', key: 'creditos', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 },
            ], `Anexo_Balance_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Anexo al Balance General', `Período: ${periodText}`);

            const startX = 20;
            let y = doc.y;
            const colW = { code: 70, name: 180, debit: 75, credit: 75, balance: 80 };

            const drawHeader = (yPos, extraMsg) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('CÓDIGO', x, yPos); x += colW.code;
                doc.text('NOMBRE CUENTA', x, yPos); x += colW.name;
                doc.text('DÉBITOS', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITOS', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('SALDO', x, yPos, { align: 'right', width: colW.balance });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 480, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let currentType = 0;

            rows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }

                if (row.account_type_id !== currentType) {
                    currentType = row.account_type_id;
                    const names = { 1: 'ACTIVO', 2: 'PASIVO', 3: 'PATRIMONIO' };
                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(names[currentType] || 'OTROS', startX, y);
                    doc.fillColor('black');
                    y += 12;
                }

                doc.fontSize(7.5).font('Helvetica');
                doc.text(row.code, startX, y);
                doc.text((row.name || '').substring(0, 30), startX + colW.code, y);
                doc.text(fmt(row.total_debit), startX + colW.code + colW.name, y, { align: 'right', width: colW.debit });
                doc.text(fmt(row.total_credit), startX + colW.code + colW.name + colW.debit, y, { align: 'right', width: colW.credit });
                doc.text(fmt(row.balance), startX + colW.code + colW.name + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
                y += 10;
            });

            if (rows.length === 0) {
                doc.text('No hay datos en el período seleccionado.', startX, y);
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 7: AUXILIAR DE OPERACIONES ===

const getAuxiliarOperaciones = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        const [rows] = await pool.query(`
            SELECT a.code, a.name, t.name as type_name, a.account_type_id,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            WHERE a.company_id = ? AND a.account_type_id IN (4,5,6) AND a.active = 1
            GROUP BY a.id
            HAVING balance != 0 OR total_debit > 0 OR total_credit > 0
            ORDER BY a.account_type_id, a.code
        `, [start_date, end_date, req.company_id]);

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                codigo: r.code || '',
                nombre_cuenta: r.name || '',
                debitos: parseFloat(r.total_debit || 0),
                creditos: parseFloat(r.total_credit || 0),
                saldo: parseFloat(r.balance || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 35 },
                { header: 'Débitos', key: 'debitos', width: 14 },
                { header: 'Créditos', key: 'creditos', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 },
            ], `Auxiliar_Operaciones_${start_date}_${end_date}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Auxiliar de Operaciones', `Período: ${start_date} al ${end_date}`);

            const startX = 20;
            let y = doc.y;
            const colW = { code: 70, name: 200, debit: 75, credit: 75, balance: 80 };

            const drawHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('CÓDIGO', x, yPos); x += colW.code;
                doc.text('NOMBRE CUENTA', x, yPos); x += colW.name;
                doc.text('DÉBITOS', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITOS', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('SALDO', x, yPos, { align: 'right', width: colW.balance });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 500, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let currentType = 0;

            rows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }

                if (row.account_type_id !== currentType) {
                    currentType = row.account_type_id;
                    const names = { 4: 'INGRESOS', 5: 'COSTOS', 6: 'GASTOS' };
                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
                    doc.text(names[currentType] || 'OTROS', startX, y);
                    doc.fillColor('black');
                    y += 12;
                }

                doc.fontSize(7.5).font('Helvetica');
                doc.text(row.code, startX, y);
                doc.text((row.name || '').substring(0, 35), startX + colW.code, y);
                doc.text(fmt(row.total_debit), startX + colW.code + colW.name, y, { align: 'right', width: colW.debit });
                doc.text(fmt(row.total_credit), startX + colW.code + colW.name + colW.debit, y, { align: 'right', width: colW.credit });
                doc.text(fmt(row.balance), startX + colW.code + colW.name + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
                y += 10;
            });

            if (rows.length === 0) doc.text('No hay datos en el período seleccionado.', startX, y);
            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 8: BALANCE DE COMPROBACIÓN ===

const getBalanceComprobacion = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const params = fiscalYearMonthParams(year, month);
        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;

        const [rows] = await pool.query(`
            SELECT a.id, a.code, a.name, t.name as type_name, t.nature, a.account_type_id,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND ${monthFilter(year, month, 'e')}
            WHERE a.company_id = ? AND a.active = 1 AND a.allows_entries = 1
            GROUP BY a.id
            HAVING total_debit > 0 OR total_credit > 0
            ORDER BY a.code
        `, [...params, req.company_id]);

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                codigo: r.code || '',
                nombre_cuenta: r.name || '',
                debito: parseFloat(r.total_debit || 0),
                credito: parseFloat(r.total_credit || 0),
                saldo: parseFloat(r.balance || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 35 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 },
            ], `Balance_Comprobacion_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Balance de Comprobación', `Período: ${periodText}`);

            const startX = 20;
            let y = doc.y;
            const colW = { code: 70, name: 200, debit: 75, credit: 75, balance: 75 };

            const drawHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('CÓDIGO', x, yPos); x += colW.code;
                doc.text('NOMBRE CUENTA', x, yPos); x += colW.name;
                doc.text('DÉBITO', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('SALDO', x, yPos, { align: 'right', width: colW.balance });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 495, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let sumDebit = 0, sumCredit = 0;

            rows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }
                const d = parseFloat(row.total_debit || 0);
                const c = parseFloat(row.total_credit || 0);
                sumDebit += d; sumCredit += c;

                doc.fontSize(7.5).font('Helvetica');
                doc.text(row.code, startX, y);
                doc.text((row.name || '').substring(0, 35), startX + colW.code, y);
                doc.text(fmt(d), startX + colW.code + colW.name, y, { align: 'right', width: colW.debit });
                doc.text(fmt(c), startX + colW.code + colW.name + colW.debit, y, { align: 'right', width: colW.credit });
                doc.text(fmt(row.balance), startX + colW.code + colW.name + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
                y += 10;
            });

            if (rows.length === 0) {
                doc.text('No hay datos en el período seleccionado.', startX, y);
            } else {
                y += 10;
                doc.moveTo(startX, y).lineTo(startX + 495, y).stroke();
                y += 12;
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('TOTALES', startX + colW.code, y);
                doc.text(fmt(sumDebit), startX + colW.code + colW.name, y, { align: 'right', width: colW.debit });
                doc.text(fmt(sumCredit), startX + colW.code + colW.name + colW.debit, y, { align: 'right', width: colW.credit });
                const diff = sumDebit - sumCredit;
                doc.text(fmt(diff), startX + colW.code + colW.name + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 9: LISTADO DE PARTIDAS ===

const getListadoPartidas = async (req, res) => {
    try {
        const { start_date, end_date, entry_type_id } = req.query;
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        let typeFilter = '';
        const params = [req.company_id, start_date, end_date];
        if (entry_type_id && entry_type_id !== 'all') {
            typeFilter = ' AND e.entry_type_id = ?';
            params.push(entry_type_id);
        }

        const [rows] = await pool.query(`
            SELECT e.id, e.date, e.number, e.description, e.total_debit, e.total_credit,
                   et.name as entry_type_name, e.status, e.created_at
            FROM accounting_entries e
            LEFT JOIN entry_types et ON e.entry_type_id = et.id
            WHERE e.company_id = ? AND e.date BETWEEN ? AND ? ${typeFilter}
            ORDER BY e.date, e.id
        `, params);

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                fecha: formatDate(r.date),
                numero: r.number || '---',
                tipo: r.entry_type_name || '',
                descripcion: r.description || '',
                debito: parseFloat(r.total_debit || 0),
                credito: parseFloat(r.total_credit || 0),
                estado: r.status === 'posted' ? 'CONTABILIZADO' : r.status === 'draft' ? 'BORRADOR' : 'ANULADO',
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Número', key: 'numero', width: 14 },
                { header: 'Tipo', key: 'tipo', width: 14 },
                { header: 'Descripción', key: 'descripcion', width: 35 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Estado', key: 'estado', width: 16 },
            ], `Listado_Partidas_${start_date}_${end_date}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Listado de Partidas', `Período: ${start_date} al ${end_date}`);

            const startX = 20;
            let y = doc.y;
            const colW = { fecha: 45, num: 65, type: 70, desc: 215, debit: 70, credit: 70, status: 55 };

            const drawHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('FECHA', x, yPos); x += colW.fecha;
                doc.text('NÚMERO', x, yPos); x += colW.num;
                doc.text('TIPO', x, yPos); x += colW.type;
                doc.text('DESCRIPCIÓN', x, yPos); x += colW.desc;
                doc.text('DÉBITO', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('ESTADO', x, yPos, { align: 'center', width: colW.status });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 590, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let totalDebit = 0, totalCredit = 0;

            rows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }
                const d = parseFloat(row.total_debit || 0);
                const c = parseFloat(row.total_credit || 0);
                totalDebit += d; totalCredit += c;

                doc.fontSize(7.5).font('Helvetica');
                let x = startX;
                doc.text(formatDate(row.date), x, y); x += colW.fecha;
                doc.text(row.number || '---', x, y); x += colW.num;
                doc.text(row.entry_type_name || '', x, y, { width: colW.type - 2 }); x += colW.type;
                doc.text((row.description || '').substring(0, 35), x, y, { width: colW.desc - 2 }); x += colW.desc;
                doc.text(fmt(d), x, y, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text(fmt(c), x, y, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text(row.status === 'posted' ? 'CONTABILIZADO' : row.status === 'draft' ? 'BORRADOR' : 'ANULADO', x, y, { align: 'center', width: colW.status, fontSize: 6 });
                y += 10;
            });

            if (rows.length === 0) {
                doc.text('No hay partidas en el período seleccionado.', startX, y);
            } else {
                y += 10;
                doc.moveTo(startX, y).lineTo(startX + 590, y).stroke();
                y += 12;
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('TOTALES', startX + colW.fecha + colW.num + colW.type + colW.desc - 30, y, { align: 'right' });
                doc.text(fmt(totalDebit), startX + colW.fecha + colW.num + colW.type + colW.desc, y, { align: 'right', width: colW.debit });
                doc.text(fmt(totalCredit), startX + colW.fecha + colW.num + colW.type + colW.desc + colW.debit, y, { align: 'right', width: colW.credit });
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 10: ESTADO DE CAMBIOS EN EL PATRIMONIO NETO ===

const getCambiosPatrimonio = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const params = fiscalYearMonthParams(year, month);
        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;

        const [rows] = await pool.query(`
            SELECT a.code, a.name,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND ${monthFilter(year, month, 'e')}
            WHERE a.company_id = ? AND a.account_type_id = 3 AND a.active = 1
            GROUP BY a.id
            HAVING total_debit > 0 OR total_credit > 0
            ORDER BY a.code
        `, [...params, req.company_id]);

        // Saldo inicial (antes del período) de cuentas patrimoniales
        const [openRows] = await pool.query(`
            SELECT a.id, a.code, a.name, t.nature,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(prev_l.debit), 0) - COALESCE(SUM(prev_l.credit), 0)
                    ELSE COALESCE(SUM(prev_l.credit), 0) - COALESCE(SUM(prev_l.debit), 0)
                END as opening
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines prev_l ON a.id = prev_l.account_id
            LEFT JOIN accounting_entries prev_e ON prev_l.entry_id = prev_e.id 
                AND prev_e.status = 'posted'
                AND (prev_e.date < ? OR (YEAR(prev_e.date) < ?))
            WHERE a.company_id = ? AND a.account_type_id = 3 AND a.active = 1
            GROUP BY a.id
            HAVING opening != 0
            ORDER BY a.code
        `, month ? [`${year}-${String(month).padStart(2, '0')}-01`, year, req.company_id] : [`${year}-01-01`, year, req.company_id]);

        const openMap = {};
        openRows.forEach(o => { openMap[o.code] = parseFloat(o.opening || 0); });

        if (req.query.format === 'excel') {
            const openMap = {};
            openRows.forEach(o => { openMap[o.code] = parseFloat(o.opening || 0); });
            const rowsForExcel = rows.map(r => ({
                codigo: r.code || '',
                cuenta: r.name || '',
                saldo_inicial: openMap[r.code] || 0,
                debitos: parseFloat(r.total_debit || 0),
                creditos: parseFloat(r.total_credit || 0),
                saldo_final: parseFloat(r.balance || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Cuenta', key: 'cuenta', width: 35 },
                { header: 'S. Inicial', key: 'saldo_inicial', width: 14 },
                { header: 'Débitos', key: 'debitos', width: 14 },
                { header: 'Créditos', key: 'creditos', width: 14 },
                { header: 'S. Final', key: 'saldo_final', width: 14 },
            ], `Cambios_Patrimonio_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Estado de Cambios en el Patrimonio Neto', `Período: ${periodText}`);

            const startX = 25;
            let y = doc.y;
            const colW = { code: 70, name: 200, opening: 80, debit: 75, credit: 75, closing: 80 };

            const drawHeader = (yPos) => {
                doc.fontSize(7).font('Helvetica-Bold');
                let x = startX;
                doc.text('CÓDIGO', x, yPos); x += colW.code;
                doc.text('CUENTA', x, yPos); x += colW.name;
                doc.text('S. INICIAL', x, yPos, { align: 'right', width: colW.opening }); x += colW.opening;
                doc.text('DÉBITOS', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITOS', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('S. FINAL', x, yPos, { align: 'right', width: colW.closing });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 580, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let totalOpen = 0, totalClose = 0;

            rows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }
                const open = openMap[row.code] || 0;
                const d = parseFloat(row.total_debit || 0);
                const c = parseFloat(row.total_credit || 0);
                const nature = 'credit'; // patrimonio es acreedor
                const close = open + (nature === 'credit' ? c - d : d - c);
                totalOpen += open; totalClose += close;

                doc.fontSize(7.5).font('Helvetica');
                doc.text(row.code, startX, y);
                doc.text((row.name || '').substring(0, 32), startX + colW.code, y);
                doc.text(fmt(open), startX + colW.code + colW.name, y, { align: 'right', width: colW.opening });
                doc.text(fmt(d), startX + colW.code + colW.name + colW.opening, y, { align: 'right', width: colW.debit });
                doc.text(fmt(c), startX + colW.code + colW.name + colW.opening + colW.debit, y, { align: 'right', width: colW.credit });
                doc.text(fmt(close), startX + colW.code + colW.name + colW.opening + colW.debit + colW.credit, y, { align: 'right', width: colW.closing });
                y += 10;
            });

            if (rows.length === 0) {
                doc.text('No hay movimientos patrimoniales en el período.', startX, y);
            } else {
                y += 10;
                doc.moveTo(startX, y).lineTo(startX + 580, y).stroke();
                y += 12;
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('TOTAL PATRIMONIO NETO', startX + colW.code, y);
                doc.text(fmt(totalOpen), startX + colW.code + colW.name, y, { align: 'right', width: colW.opening });
                doc.text(fmt(totalClose), startX + colW.code + colW.name + colW.opening + colW.debit + colW.credit, y, { align: 'right', width: colW.closing });
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 11: ESTADO DE FLUJO DE EFECTIVO ===

const getFlujoEfectivo = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;

        // Cuentas de efectivo (tipo 1, código que empieza con 11)
        const [cashAccounts] = await pool.query(
            `SELECT id, code, name FROM chart_of_accounts 
             WHERE company_id = ? AND account_type_id = 1 AND code LIKE '11%' AND active = 1`,
            [req.company_id]
        );

        // Saldo inicial de efectivo
        const cashIds = cashAccounts.map(c => c.id);
        let cashFilter = 'AND 1 = 0';
        if (cashIds.length > 0) {
            cashFilter = `AND a.id IN (${cashIds.join(',')})`;
        }

        // Determinar fecha de inicio para el período
        const startDate = month ? `${year}-${String(month).padStart(2, '0')}-01` : `${year}-01-01`;
        let endDate;
        if (month) {
            const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
            endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else {
            endDate = `${year}-12-31`;
        }

        // Saldo inicial antes del período
        const [beginCash] = await pool.query(`
            SELECT COALESCE(SUM(
                CASE WHEN t.nature = 'debit'
                    THEN l.debit - l.credit
                    ELSE l.credit - l.debit
                END
            ), 0) as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted' AND e.date < ?
            WHERE a.company_id = ? ${cashFilter}
        `, [startDate, req.company_id]);

        // Saldo final hasta la fecha
        const [endCash] = await pool.query(`
            SELECT COALESCE(SUM(
                CASE WHEN t.nature = 'debit'
                    THEN l.debit - l.credit
                    ELSE l.credit - l.debit
                END
            ), 0) as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted' AND e.date <= ?
            WHERE a.company_id = ? ${cashFilter}
        `, [endDate, req.company_id]);

        // Movimientos por tipo de cuenta para clasificar flujo
        const [movements] = await pool.query(`
            SELECT a.account_type_id, t.name as type_name, t.nature,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            WHERE a.company_id = ? AND a.active = 1 AND a.id NOT IN (${cashIds.length > 0 ? cashIds.join(',') : '0'})
            GROUP BY a.account_type_id
        `, [startDate, endDate, req.company_id]);

        if (req.query.format === 'excel') {
            const movMap = {};
            movements.forEach(m => { movMap[m.account_type_id] = m; });
            const getNet = (typeId) => {
                const m = movMap[typeId];
                if (!m) return 0;
                if (m.nature === 'debit') return parseFloat(m.total_credit) - parseFloat(m.total_debit);
                return parseFloat(m.total_debit) - parseFloat(m.total_credit);
            };
            const opIncome = getNet(4);
            const opCost = getNet(5);
            const opExpense = getNet(6);
            const operatingFlow = opIncome + opCost + opExpense;
            const investingFlow = getNet(1);
            const financingFlow = getNet(3) + getNet(2);
            const netFlow = operatingFlow + investingFlow + financingFlow;
            const beginBal = parseFloat(beginCash[0]?.balance || 0);
            const endBal = parseFloat(endCash[0]?.balance || 0);
            const rowsForExcel = [
                { concepto: 'ACTIVIDADES DE OPERACIÓN', monto: operatingFlow },
                { concepto: '  Ingresos', monto: opIncome },
                { concepto: '  Costos', monto: opCost },
                { concepto: '  Gastos', monto: opExpense },
                { concepto: 'ACTIVIDADES DE INVERSIÓN', monto: investingFlow },
                { concepto: '  Activos no corrientes', monto: investingFlow },
                { concepto: 'ACTIVIDADES DE FINANCIAMIENTO', monto: financingFlow },
                { concepto: '  Pasivos (financiamiento)', monto: getNet(2) },
                { concepto: '  Patrimonio', monto: getNet(3) },
                { concepto: 'RESUMEN', monto: 0 },
                { concepto: '  Saldo inicial de efectivo', monto: beginBal },
                { concepto: '  Variación neta del período', monto: netFlow },
                { concepto: '  Saldo final de efectivo', monto: endBal },
            ];
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Concepto', key: 'concepto', width: 40 },
                { header: 'Monto', key: 'monto', width: 16 },
            ], `Flujo_Efectivo_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Estado de Flujo de Efectivo', `Período: ${periodText}`);

            const startX = 30;
            let y = doc.y;
            const indent = 15;
            const colLabel = 300;
            const colVal = 120;

            const section = (label, amount, color) => {
                if (y > 510) { doc.addPage(); y = 30; }
                doc.fontSize(8).font('Helvetica-Bold').fillColor(color || '#4f46e5');
                doc.text(label, startX, y);
                doc.text(fmt(amount), startX + colLabel, y, { align: 'right', width: colVal });
                doc.fillColor('black');
                y += 14;
                return y;
            };

            const line = (label, amount, ind = 0) => {
                if (y > 510) { doc.addPage(); y = 30; }
                doc.fontSize(8).font('Helvetica');
                doc.text(label, startX + ind * indent, y);
                doc.text(fmt(amount), startX + colLabel, y, { align: 'right', width: colVal });
                y += 11;
                return y;
            };

            const total = (label, amount) => {
                if (y > 510) { doc.addPage(); y = 30; }
                doc.moveTo(startX, y).lineTo(startX + colLabel + colVal, y).stroke();
                y += 8;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b');
                doc.text(label, startX, y);
                doc.text(fmt(amount), startX + colLabel, y, { align: 'right', width: colVal });
                doc.fillColor('black');
                y += 14;
                return y;
            };

            const movMap = {};
            movements.forEach(m => { movMap[m.account_type_id] = m; });

            const getNet = (typeId) => {
                const m = movMap[typeId];
                if (!m) return 0;
                if (m.nature === 'debit') return parseFloat(m.total_credit) - parseFloat(m.total_debit);
                return parseFloat(m.total_debit) - parseFloat(m.total_credit);
            };

            // Operating: types 4,5,6
            const opIncome = getNet(4);  // ingresos
            const opCost = getNet(5);    // costos
            const opExpense = getNet(6); // gastos
            const operatingFlow = opIncome + opCost + opExpense;
            y = section('ACTIVIDADES DE OPERACIÓN', operatingFlow);
            y = line('Ingresos', opIncome, 1);
            y = line('Costos', opCost, 1);
            y = line('Gastos', opExpense, 1);
            y = total('Efectivo neto en operación', operatingFlow);

            // Investing: non-current assets (type 1 with code > 11)
            const investingFlow = getNet(1); 
            y = section('ACTIVIDADES DE INVERSIÓN', investingFlow);
            y = line('Activos no corrientes', investingFlow, 1);
            y = total('Efectivo neto en inversión', investingFlow);

            // Financing: equity (type 3) and long-term liabilities
            const financingFlow = getNet(3) + getNet(2);
            y = section('ACTIVIDADES DE FINANCIAMIENTO', financingFlow);
            y = line('Pasivos (financiamiento)', getNet(2), 1);
            y = line('Patrimonio', getNet(3), 1);
            y = total('Efectivo neto en financiamiento', financingFlow);

            const netFlow = operatingFlow + investingFlow + financingFlow;
            const beginBal = parseFloat(beginCash[0]?.balance || 0);
            const endBal = parseFloat(endCash[0]?.balance || 0);

            y = section('RESUMEN', 0);
            y = line('Saldo inicial de efectivo', beginBal, 1);
            y = line('Variación neta del período', netFlow, 1);
            y = total('Saldo final de efectivo', endBal);

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 12: BALANCE GENERAL COMPARATIVO ===

const getBalanceComparativo = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;
        const prevYear = parseInt(year) - 1;

        const runQuery = async (y, m) => {
            const params = fiscalYearMonthParams(y, m);
            const [rows] = await pool.query(`
                SELECT a.code, a.name, t.nature, a.account_type_id,
                    CASE WHEN t.nature = 'debit'
                        THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                        ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                    END as balance
                FROM chart_of_accounts a
                JOIN account_types t ON a.account_type_id = t.id
                LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
                LEFT JOIN accounting_entries e ON l.entry_id = e.id AND ${monthFilter(y, m, 'e')}
                WHERE a.company_id = ? AND a.account_type_id IN (1,2,3) AND a.active = 1 AND a.allows_entries = 1
                GROUP BY a.id
                HAVING balance != 0
                ORDER BY a.code
            `, [...params, req.company_id]);
            return rows;
        };

        const currentRows = await runQuery(year, month);
        const prevRows = await runQuery(prevYear, month);

        const prevMap = {};
        prevRows.forEach(r => { prevMap[r.code] = parseFloat(r.balance || 0); });

        if (req.query.format === 'excel') {
            const rowsForExcel = currentRows.map(r => {
                const curr = parseFloat(r.balance || 0);
                const prev = prevMap[r.code] || 0;
                const vari = curr - prev;
                const pct = prev !== 0 ? (vari / Math.abs(prev)) * 100 : 0;
                return {
                    codigo: r.code || '',
                    nombre: r.name || '',
                    actual: curr,
                    anterior: prev,
                    variacion: vari,
                    porcentaje: pct,
                };
            });
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Nombre', key: 'nombre', width: 30 },
                { header: periodText, key: 'actual', width: 14 },
                { header: String(prevYear), key: 'anterior', width: 14 },
                { header: 'Variación', key: 'variacion', width: 14 },
                { header: '%', key: 'porcentaje', width: 12 },
            ], `Balance_Comparativo_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Balance General Comparativo', `Período: ${periodText} vs ${prevYear}`);

            const startX = 20;
            let y = doc.y;
            const colW = { code: 65, name: 180, curr: 72, prev: 72, var: 72, pct: 60 };

            const drawHeader = (yPos) => {
                doc.fontSize(7).font('Helvetica-Bold');
                let x = startX;
                doc.text('CTA', x, yPos); x += colW.code;
                doc.text('NOMBRE CUENTA', x, yPos); x += colW.name;
                doc.text(periodText, x, yPos, { align: 'right', width: colW.curr }); x += colW.curr;
                doc.text(String(prevYear), x, yPos, { align: 'right', width: colW.prev }); x += colW.prev;
                doc.text('VARIACIÓN', x, yPos, { align: 'right', width: colW.var }); x += colW.var;
                doc.text('%', x, yPos, { align: 'right', width: colW.pct });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 521, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let totalCurr = 0, totalPrev = 0;

            currentRows.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }
                const curr = parseFloat(row.balance || 0);
                const prev = prevMap[row.code] || 0;
                const vari = curr - prev;
                const pct = prev !== 0 ? ((vari / Math.abs(prev)) * 100) : 0;
                totalCurr += curr; totalPrev += prev;

                doc.fontSize(7).font('Helvetica');
                doc.text(row.code, startX, y);
                doc.text((row.name || '').substring(0, 28), startX + colW.code, y);
                doc.text(fmt(curr), startX + colW.code + colW.name, y, { align: 'right', width: colW.curr });
                doc.text(fmt(prev), startX + colW.code + colW.name + colW.curr, y, { align: 'right', width: colW.prev });
                doc.font(vari >= 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(vari >= 0 ? '#059669' : '#dc2626');
                doc.text(`${vari >= 0 ? '+' : ''}${fmt(vari)}`, startX + colW.code + colW.name + colW.curr + colW.prev, y, { align: 'right', width: colW.var });
                doc.font('Helvetica').fillColor('black');
                doc.text(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, startX + colW.code + colW.name + colW.curr + colW.prev + colW.var, y, { align: 'right', width: colW.pct });
                y += 10;
            });

            if (currentRows.length === 0) {
                doc.text('No hay datos.', startX, y);
            } else {
                y += 10;
                doc.moveTo(startX, y).lineTo(startX + 521, y).stroke();
                y += 10;
                doc.fontSize(8).font('Helvetica-Bold');
                doc.text('TOTAL', startX + colW.code + colW.name - 30, y, { align: 'right' });
                doc.text(fmt(totalCurr), startX + colW.code + colW.name, y, { align: 'right', width: colW.curr });
                doc.text(fmt(totalPrev), startX + colW.code + colW.name + colW.curr, y, { align: 'right', width: colW.prev });
                const totVar = totalCurr - totalPrev;
                const totPct = totalPrev !== 0 ? (totVar / Math.abs(totalPrev)) * 100 : 0;
                doc.fillColor(totVar >= 0 ? '#059669' : '#dc2626');
                doc.text(`${totVar >= 0 ? '+' : ''}${fmt(totVar)}`, startX + colW.code + colW.name + colW.curr + colW.prev, y, { align: 'right', width: colW.var });
                doc.fillColor('black');
                doc.text(`${totPct >= 0 ? '+' : ''}${totPct.toFixed(1)}%`, startX + colW.code + colW.name + colW.curr + colW.prev + colW.var, y, { align: 'right', width: colW.pct });
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 13: CÉDULA DE AUDITORÍA POR CUENTA ===

const getCedulaAuditoria = async (req, res) => {
    try {
        const { account_id, start_date, end_date } = req.query;
        if (!account_id || account_id === 'all') return res.status(400).json({ message: 'Debe seleccionar una cuenta' });
        if (!start_date || !end_date) return res.status(400).json({ message: 'Rango de fechas requerido' });

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        const [[account]] = await pool.query(`
            SELECT a.*, t.name as type_name, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.id = ? AND a.company_id = ?
        `, [account_id, req.company_id]);
        if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });

        // Saldo antes del período
        const [[opening]] = await pool.query(`
            SELECT COALESCE(
                CASE WHEN ? = 'debit'
                    THEN SUM(l.debit) - SUM(l.credit)
                    ELSE SUM(l.credit) - SUM(l.debit)
                END, 0) as balance
            FROM accounting_entry_lines l
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE l.account_id = ? AND e.company_id = ? AND e.status = 'posted' AND e.date < ?
        `, [account.nature, account_id, req.company_id, start_date]);

        // Movimientos del período
        const [movements] = await pool.query(`
            SELECT e.date, e.number, e.description, et.name as entry_type,
                   l.debit, l.credit, l.description as line_desc
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            LEFT JOIN entry_types et ON e.entry_type_id = et.id
            WHERE l.account_id = ? AND e.company_id = ? AND e.status = 'posted'
              AND e.date BETWEEN ? AND ?
            ORDER BY e.date, e.id
        `, [account_id, req.company_id, start_date, end_date]);

        if (req.query.format === 'excel') {
            const isDebitNature = account.nature === 'debit';
            let running = parseFloat(opening.balance || 0);
            const rowsForExcel = [];
            rowsForExcel.push({
                fecha: 'SALDO INICIAL',
                numero: '',
                tipo: '',
                descripcion: '',
                debito: 0,
                credito: 0,
                saldo: running,
            });
            for (const row of movements) {
                const d = parseFloat(row.debit || 0);
                const c = parseFloat(row.credit || 0);
                if (isDebitNature) running += d - c;
                else running += c - d;
                rowsForExcel.push({
                    fecha: formatDate(row.date),
                    numero: row.number || '---',
                    tipo: row.entry_type || '',
                    descripcion: row.description || row.line_desc || '',
                    debito: d,
                    credito: c,
                    saldo: running,
                });
            }
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Fecha', key: 'fecha', width: 14 },
                { header: 'Número', key: 'numero', width: 14 },
                { header: 'Tipo', key: 'tipo', width: 12 },
                { header: 'Descripción', key: 'descripcion', width: 30 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 },
            ], `Cedula_Auditoria_${account.code}_${start_date}_${end_date}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Cédula de Auditoría', `Cuenta: ${account.code} - ${account.name}`);
            doc.fontSize(9).font('Helvetica');
            doc.text(`Tipo: ${account.type_name} | Período: ${start_date} al ${end_date}`, { align: 'center' });
            doc.moveDown(1);

            const startX = 20;
            let y = doc.y;
            const colW = { fecha: 50, num: 65, type: 60, desc: 175, debit: 70, credit: 70, balance: 70 };

            const drawHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('FECHA', x, yPos); x += colW.fecha;
                doc.text('NÚMERO', x, yPos); x += colW.num;
                doc.text('TIPO', x, yPos); x += colW.type;
                doc.text('DESCRIPCIÓN', x, yPos); x += colW.desc;
                doc.text('DÉBITO', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('SALDO', x, yPos, { align: 'right', width: colW.balance });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 560, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);
            let running = parseFloat(opening.balance || 0);

            // Mostrar saldo inicial
            doc.fontSize(7.5).font('Helvetica-Bold');
            doc.text('SALDO INICIAL', startX + colW.fecha + colW.num + colW.type, y, { width: colW.desc - 2 });
            doc.text(fmt(running), startX + colW.fecha + colW.num + colW.type + colW.desc + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
            y += 10;

            const isDebitNature = account.nature === 'debit';

            movements.forEach(row => {
                if (y > 510) { doc.addPage(); y = drawHeader(30); }
                const d = parseFloat(row.debit || 0);
                const c = parseFloat(row.credit || 0);
                if (isDebitNature) running += d - c;
                else running += c - d;

                doc.fontSize(7.5).font('Helvetica');
                let x = startX;
                doc.text(formatDate(row.date), x, y); x += colW.fecha;
                doc.text(row.number || '---', x, y); x += colW.num;
                doc.text(row.entry_type || '', x, y, { width: colW.type - 2 }); x += colW.type;
                doc.text((row.description || row.line_desc || '').substring(0, 28), x, y, { width: colW.desc - 2 }); x += colW.desc;
                doc.text(fmt(d), x, y, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text(fmt(c), x, y, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text(fmt(running), x, y, { align: 'right', width: colW.balance });
                y += 10;
            });

            y += 5;
            doc.moveTo(startX, y).lineTo(startX + 560, y).stroke();
            y += 10;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#4f46e5');
            doc.text('SALDO FINAL', startX + colW.fecha + colW.num + colW.type, y, { width: colW.desc - 2 });
            doc.text(fmt(running), startX + colW.fecha + colW.num + colW.type + colW.desc + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
            doc.fillColor('black');

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

// === REPORTE 14: REPORTE DE RETENCIONES (IVA/ISR) ===

const getRetenciones = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) return res.status(400).json({ message: 'Año requerido' });
        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const params = fiscalYearMonthParams(year, month);
        const periodText = month ? `${year} - Mes ${month}` : `Año ${year}`;

        // Buscar cuentas relacionadas con retenciones
        const [retencionAccounts] = await pool.query(`
            SELECT id, code, name, account_type_id
            FROM chart_of_accounts 
            WHERE company_id = ? AND active = 1 AND (
                name LIKE '%retenci%' OR name LIKE '%iva retenido%' OR name LIKE '%isr%'
                OR name LIKE '%perceb%' OR name LIKE '%percepci%'
            )
            ORDER BY code
        `, [req.company_id]);

        if (retencionAccounts.length === 0) {
            return buildPDF(res, (doc) => {
                renderHeader(doc, company, 'Reporte de Retenciones (IVA/ISR)', `Período: ${periodText}`);
                doc.text('No se encontraron cuentas de retenciones configuradas en el catálogo.', 30, doc.y);
                doc.moveDown();
                doc.text('Para usar este reporte, las cuentas de retenciones deben contener en su nombre:', 30, doc.y);
                doc.text('"retención", "iva retenido", "isr", "percepción"', 30, doc.y);
                renderSignatures(doc, signatures);
                renderPageNumbers(doc);
                doc.end();
            });
        }

        const ids = retencionAccounts.map(a => a.id);
        const [movements] = await pool.query(`
            SELECT a.id, a.code, a.name, a.account_type_id, t.nature,
                COALESCE(SUM(l.debit), 0) as total_debit,
                COALESCE(SUM(l.credit), 0) as total_credit,
                CASE WHEN t.nature = 'debit'
                    THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
                    ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
                END as balance
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            LEFT JOIN accounting_entry_lines l ON a.id = l.account_id
            LEFT JOIN accounting_entries e ON l.entry_id = e.id AND ${monthFilter(year, month, 'e')}
            WHERE a.id IN (${ids.join(',')}) AND e.company_id = ?
            GROUP BY a.id
            ORDER BY a.code
        `, [...params, req.company_id]);

        if (req.query.format === 'excel') {
            if (retencionAccounts.length === 0) {
                return res.status(400).json({ message: 'No hay cuentas de retenciones configuradas' });
            }
            const rowsForExcel = movements.map(r => ({
                codigo: r.code || '',
                cuenta: r.name || '',
                debito: parseFloat(r.total_debit || 0),
                credito: parseFloat(r.total_credit || 0),
                saldo: parseFloat(r.balance || 0),
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Cuenta', key: 'cuenta', width: 35 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Saldo', key: 'saldo', width: 14 },
            ], `Retenciones_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, (doc) => {
            renderHeader(doc, company, 'Reporte de Retenciones (IVA/ISR)', `Período: ${periodText}`);

            const startX = 25;
            let y = doc.y;
            const colW = { code: 70, name: 200, debit: 75, credit: 75, balance: 75 };

            const drawHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold');
                let x = startX;
                doc.text('CÓDIGO', x, yPos); x += colW.code;
                doc.text('CUENTA', x, yPos); x += colW.name;
                doc.text('DÉBITO', x, yPos, { align: 'right', width: colW.debit }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos, { align: 'right', width: colW.credit }); x += colW.credit;
                doc.text('SALDO', x, yPos, { align: 'right', width: colW.balance });
                doc.moveTo(startX, yPos + 10).lineTo(startX + 495, yPos + 10).stroke();
                return yPos + 15;
            };

            y = drawHeader(y);

            if (movements.length === 0) {
                doc.fontSize(9).font('Helvetica');
                doc.text('No hay movimientos de retenciones en el período.', startX, y);
                y += 15;
            } else {
                let totalDebit = 0, totalCredit = 0, totalBalance = 0;

                movements.forEach(row => {
                    if (y > 510) { doc.addPage(); y = drawHeader(30); }
                    const d = parseFloat(row.total_debit || 0);
                    const c = parseFloat(row.total_credit || 0);
                    const b = parseFloat(row.balance || 0);
                    totalDebit += d; totalCredit += c; totalBalance += b;

                    doc.fontSize(7.5).font('Helvetica');
                    doc.text(row.code, startX, y);
                    doc.text((row.name || '').substring(0, 32), startX + colW.code, y);
                    doc.text(fmt(d), startX + colW.code + colW.name, y, { align: 'right', width: colW.debit });
                    doc.text(fmt(c), startX + colW.code + colW.name + colW.debit, y, { align: 'right', width: colW.credit });
                    doc.text(fmt(b), startX + colW.code + colW.name + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
                    y += 10;
                });

                y += 10;
                doc.moveTo(startX, y).lineTo(startX + 495, y).stroke();
                y += 10;
                doc.fontSize(9).font('Helvetica-Bold');
                doc.text('TOTALES', startX + colW.code, y);
                doc.text(fmt(totalDebit), startX + colW.code + colW.name, y, { align: 'right', width: colW.debit });
                doc.text(fmt(totalCredit), startX + colW.code + colW.name + colW.debit, y, { align: 'right', width: colW.credit });
                doc.text(fmt(totalBalance), startX + colW.code + colW.name + colW.debit + colW.credit, y, { align: 'right', width: colW.balance });
                y += 12;
            }

            renderSignatures(doc, signatures);
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) { console.error(e); res.status(500).json({ message: e.message }); }
};

module.exports = {
    getLibroDiario,
    getLibroDiarioMayor,
    getLibroMayor,
    getEstadoResultados,
    getBalanceGeneral,
    getAnexoBalance,
    getAuxiliarOperaciones,
    getBalanceComprobacion,
    getListadoPartidas,
    getCambiosPatrimonio,
    getFlujoEfectivo,
    getBalanceComparativo,
    getCedulaAuditoria,
    getRetenciones,
};
