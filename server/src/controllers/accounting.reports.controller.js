const pool = require('../config/db');
const PDFDocument = require('pdfkit');
const excelService = require('../services/excel.service');

// =============================================================================
// HELPERS & CONSTANTS
// =============================================================================

const MONTH_NAMES = [
    '',
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE'
];

async function getCompanyInfo(companyId) {
    const [rows] = await pool.query(
        'SELECT id, razon_social, nombre_comercial, nit, nrc, direccion FROM companies WHERE id = ?',
        [companyId]
    );
    return rows[0] || {
        razon_social: 'EMPRESA REGISTRADA',
        nombre_comercial: 'EMPRESA',
        nit: '0000-000000-000-0',
        nrc: '000000-0',
        direccion: ''
    };
}

async function getSignatures(companyId) {
    const [rows] = await pool.query(
        `SELECT setting_key, setting_value FROM accounting_settings 
         WHERE company_id = ? AND setting_key IN (
            'contador_nombre', 'contador_dui', 
            'auditor_nombre', 'auditor_dui', 
            'representante_nombre', 'representante_dui'
         )`,
        [companyId]
    );
    const sig = {
        contador_nombre: '',
        contador_dui: '',
        auditor_nombre: '',
        auditor_dui: '',
        representante_nombre: '',
        representante_dui: ''
    };
    rows.forEach(r => {
        if (r.setting_key) sig[r.setting_key] = (r.setting_value || '').trim();
    });
    return sig;
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

function formatCurrency(val, showDashWhenZero = true) {
    if (val === null || val === undefined || isNaN(val)) return '';
    const n = Number(val);
    if (Math.abs(n) < 0.001) {
        return showDashWhenZero ? '$ -' : '$ 0.00';
    }
    const formatted = Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    if (n < 0) {
        return `$(${formatted})`;
    }
    return `$ ${formatted}`;
}
const fmt = formatCurrency;

function getLastDayOfMonth(year, month) {
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || (new Date().getMonth() + 1);
    return new Date(y, m, 0).getDate();
}

function getAccountLevel(code) {
    const clean = String(code || '').replace(/[^0-9]/g, '');
    if (clean.length <= 1) return 1;
    if (clean.length <= 2) return 2;
    if (clean.length <= 4) return 3;
    if (clean.length <= 6) return 4;
    if (clean.length <= 8) return 5;
    return 6;
}

function renderHeader(doc, company, title, periodText, orientation = 'portrait') {
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const contentWidth = pageWidth - 60;
    const centerX = pageWidth / 2;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Emission timestamp at top-left
    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b').text(`${dateStr}  ${timeStr}`, 30, 20);

    // 1. Company Name
    const companyName = (company.razon_social || company.nombre_comercial || 'EMPRESA REGISTRADA').toUpperCase();
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(companyName, 30, 20, { align: 'center', width: contentWidth });

    // 2. Report Title
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title.toUpperCase(), 30, 35, { align: 'center', width: contentWidth });

    // 3. Tax Identifiers
    const taxText = `NUMERO DE REGISTRO DE I.V.A.: ${company.nrc || 'N/A'}    |    NIT: ${company.nit || 'N/A'}`;
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text(taxText, 30, 49, { align: 'center', width: contentWidth });

    // 4. Period
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b').text(periodText.toUpperCase(), 30, 61, { align: 'center', width: contentWidth });

    // 5. Currency standard legend
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('(CIFRAS EXPRESADAS EN DOLARES DE LOS ESTADOS UNIDOS DE AMERICA)', 30, 73, { align: 'center', width: contentWidth });

    // Subtle divider line
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(30, 85).lineTo(pageWidth - 30, 85).stroke();

    doc.y = 92;
    return 92;
}

function renderSignatures(doc, signatures, company, orientation = 'portrait') {
    const pageHeight = orientation === 'landscape' ? 612 : 792;
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const marginBottom = 35;
    const sigBlockHeight = 60;
    const bottomTargetY = pageHeight - marginBottom - sigBlockHeight;

    if (doc.y > bottomTargetY - 10) {
        doc.addPage();
        doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#94a3b8').text('(Vienen firmas autorizadas del reporte oficial)', 30, 40, { lineBreak: false });
        doc.y = bottomTargetY;
    } else {
        doc.y = Math.max(doc.y + 15, bottomTargetY);
    }

    const currentY = doc.y;
    const contentWidth = pageWidth - 60;
    const colWidth = contentWidth / 3;
    const lineWidth = Math.min(150, colWidth - 20);

    const sigs = [
        {
            name: signatures.representante_nombre || company.razon_social || 'Representante Legal',
            title: 'Representante Legal'
        },
        {
            name: signatures.contador_nombre || 'Contador General',
            title: `Contador General${signatures.contador_dui ? ` - DUI: ${signatures.contador_dui}` : ''}`
        },
        {
            name: signatures.auditor_nombre || 'Auditor Externo',
            title: `Auditor Externo${signatures.auditor_dui ? ` - DUI: ${signatures.auditor_dui}` : ''}`
        }
    ];

    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    sigs.forEach((s, i) => {
        const centerX = 30 + (i * colWidth) + (colWidth / 2);
        const lineStartX = centerX - (lineWidth / 2);
        const lineEndX = centerX + (lineWidth / 2);

        doc.strokeColor('#64748b').lineWidth(0.5).moveTo(lineStartX, currentY + 15).lineTo(lineEndX, currentY + 15).stroke();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(s.name, centerX - (lineWidth / 2), currentY + 19, {
            align: 'center',
            width: lineWidth,
            lineBreak: false
        });
        doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text(s.title, centerX - (lineWidth / 2), currentY + 30, {
            align: 'center',
            width: lineWidth,
            lineBreak: false
        });
    });

    doc.page.margins.bottom = oldBottom;
}

function renderClosingFooter(doc, startX, y, count, entityName = 'Cuentas') {
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
    doc.text(`Número de ${entityName} Impresas : ${count || 0}`, startX, y, { lineBreak: false });
    doc.text('FIN DEL REPORTE.', startX, y + 9, { lineBreak: false });
    return y + 22;
}

function renderPageNumbers(doc) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
        doc.text(`Página ${i + 1} de ${range.count}`, 30, doc.page.height - 20, {
            align: 'center',
            width: doc.page.width - 60,
            lineBreak: false
        });
        doc.page.margins.bottom = oldBottom;
    }
}

function buildPDF(res, orientation, buildContent) {
    const doc = new PDFDocument({
        margin: 30,
        size: 'LETTER',
        layout: orientation,
        bufferPages: true
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.send(result);
    });
    try {
        buildContent(doc);
    } catch (e) {
        console.error('[buildPDF Error]:', e);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generando PDF: ' + e.message });
        }
        try { doc.end(); } catch (_) {}
    }
}

function buildExcelResponse(res, rows, columns, filename) {
    return excelService.createExcelBuffer({
        sheets: [{ name: 'Reporte', columns, data: rows }]
    }).then(buffer => excelService.sendExcelResponse(res, buffer, filename));
}

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
// 4. BALANCE DE COMPROBACIÓN
// =============================================================================

const getBalanceComprobacion = async (req, res) => {
    try {
        const { year, month, level, modality } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const y = parseInt(year);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const maxLevel = parseInt(level) || 3;
        const currentModality = modality || 'cargos_abonos';

        const lastD = getLastDayOfMonth(y, m);
        const periodStart = `${y}-${String(m).padStart(2, '0')}-01`;
        const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const periodText = `AL ${lastD} DE ${MONTH_NAMES[m]} DE ${y}`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        // Fetch all active accounts
        const [accounts] = await pool.query(`
            SELECT a.id, a.code, a.name, a.parent_id, a.account_type_id, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.company_id = ? AND a.active = 1
            ORDER BY a.code ASC
        `, [req.company_id]);

        // Prior balances before periodStart
        const [priorRows] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as debits,
                   COALESCE(SUM(l.credit), 0) as credits
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date < ?
            GROUP BY a.code
        `, [req.company_id, periodStart]);

        // Current period movements
        const [currRows] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as debits,
                   COALESCE(SUM(l.credit), 0) as credits
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            GROUP BY a.code
        `, [req.company_id, periodStart, periodEnd]);

        // Direct maps
        const priorMap = new Map();
        priorRows.forEach(r => priorMap.set(r.code, { debit: parseFloat(r.debits || 0), credit: parseFloat(r.credits || 0) }));

        const currMap = new Map();
        currRows.forEach(r => currMap.set(r.code, { debit: parseFloat(r.debits || 0), credit: parseFloat(r.credits || 0) }));

        // Rollup all amounts to ancestor codes
        const accountDataMap = new Map();
        for (const acc of accounts) {
            accountDataMap.set(acc.code, {
                id: acc.id,
                code: acc.code,
                name: acc.name,
                nature: acc.nature,
                level: getAccountLevel(acc.code),
                initDebit: 0,
                initCredit: 0,
                initBalance: 0,
                cargo: 0,
                abono: 0,
                finalBalance: 0
            });
        }

        // Apply direct values to account and all ancestor prefixes
        const applyRollup = (codeMap, fieldDebit, fieldCredit) => {
            for (const [code, val] of codeMap.entries()) {
                for (const [accCode, accData] of accountDataMap.entries()) {
                    if (code.startsWith(accCode)) {
                        accData[fieldDebit] += val.debit;
                        accData[fieldCredit] += val.credit;
                    }
                }
            }
        };

        applyRollup(priorMap, 'initDebit', 'initCredit');
        applyRollup(currMap, 'cargo', 'abono');

        // Compute running balances
        for (const [, a] of accountDataMap.entries()) {
            if (a.nature === 'debit') {
                a.initBalance = a.initDebit - a.initCredit;
                a.finalBalance = a.initBalance + a.cargo - a.abono;
            } else {
                a.initBalance = a.initCredit - a.initDebit;
                a.finalBalance = a.initBalance + a.abono - a.cargo;
            }
        }

        // Filter by level and non-zero activity
        const filteredAccounts = Array.from(accountDataMap.values()).filter(a => {
            if (a.level > maxLevel) return false;
            return (Math.abs(a.initBalance) > 0.001 || a.cargo > 0 || a.abono > 0 || Math.abs(a.finalBalance) > 0.001);
        });

        // Totals based on level 1 accounts (or filtered)
        let totalInit = 0;
        let totalCargo = 0;
        let totalAbono = 0;
        let totalFinal = 0;

        filteredAccounts.forEach(a => {
            if (a.level === 1) {
                totalInit += a.initBalance;
                totalCargo += a.cargo;
                totalAbono += a.abono;
                totalFinal += a.finalBalance;
            }
        });

        // Partition accounts for "cuenta" modality (Deudoras vs Acreedoras)
        const leftRows = [];
        const rightRows = [];
        let totalIzquierda = 0;
        let totalDerecha = 0;

        filteredAccounts.forEach(a => {
            if (a.nature === 'debit') {
                leftRows.push(a);
                if (a.level === 1) totalIzquierda += a.finalBalance;
            } else {
                rightRows.push(a);
                if (a.level === 1) totalDerecha += a.finalBalance;
            }
        });

        if (req.query.format === 'excel') {
            if (modality === 'cuenta') {
                const maxRows = Math.max(leftRows.length, rightRows.length);
                const rowsForExcel = [];
                for (let i = 0; i < maxRows; i++) {
                    const l = leftRows[i];
                    const r = rightRows[i];
                    rowsForExcel.push({
                        cuenta_deudora: l ? `${l.code} - ${l.name}` : '',
                        monto_deudor: l ? l.finalBalance : '',
                        cuenta_acreedora: r ? `${r.code} - ${r.name}` : '',
                        monto_acreedor: r ? r.finalBalance : ''
                    });
                }
                rowsForExcel.push({ cuenta_deudora: '', monto_deudor: '', cuenta_acreedora: '', monto_acreedor: '' });
                rowsForExcel.push({
                    cuenta_deudora: 'TOTAL DEUDORAS Y ACTIVOS',
                    monto_deudor: totalIzquierda,
                    cuenta_acreedora: 'TOTAL ACREEDORAS, PASIVO Y PATRIMONIO',
                    monto_acreedor: totalDerecha
                });
                return buildExcelResponse(res, rowsForExcel, [
                    { header: 'DEUDORAS Y ACTIVOS', key: 'cuenta_deudora', width: 42 },
                    { header: 'MONTO', key: 'monto_deudor', width: 16 },
                    { header: 'ACREEDORAS, PASIVO Y PATRIMONIO', key: 'cuenta_acreedora', width: 42 },
                    { header: 'MONTO', key: 'monto_acreedor', width: 16 }
                ], `Balance_Comprobacion_Cuenta_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
            }

            const rowsForExcel = filteredAccounts.map(a => ({
                cuenta: a.code,
                descripcion: a.name,
                nivel: a.level,
                saldo_inicial: a.initBalance,
                cargo: a.cargo,
                abono: a.abono,
                saldo_final: a.finalBalance
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 14 },
                { header: 'Descripción', key: 'descripcion', width: 35 },
                { header: 'Nivel', key: 'nivel', width: 10 },
                { header: 'Saldo Inicial', key: 'saldo_inicial', width: 15 },
                { header: 'Cargo', key: 'cargo', width: 15 },
                { header: 'Abono', key: 'abono', width: 15 },
                { header: 'Saldo Final', key: 'saldo_final', width: 15 }
            ], `Balance_Comprobacion_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        if (modality === 'cuenta') {
            return buildPDF(res, 'portrait', (doc) => {
                renderHeader(doc, company, 'Balance de Comprobación - Forma de Cuenta', periodText, 'portrait');

                const startX = 30;
                const colWidth = 270;
                const rightColX = 312;

                const drawDualHeader = (yPos) => {
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.rect(startX, yPos, colWidth, 14).fill('#f1f5f9');
                    doc.rect(rightColX, yPos, colWidth, 14).fill('#f1f5f9');
                    doc.fillColor('#0f172a');
                    doc.text('DEUDORAS Y ACTIVOS', startX + 4, yPos + 3, { lineBreak: false });
                    doc.text('SALDO', startX, yPos + 3, { align: 'right', width: colWidth - 6, lineBreak: false });
                    doc.text('ACREEDORAS, PASIVO Y PATRIMONIO', rightColX + 4, yPos + 3, { lineBreak: false });
                    doc.text('SALDO', rightColX, yPos + 3, { align: 'right', width: colWidth - 6, lineBreak: false });
                    return yPos + 18;
                };

                let y = drawDualHeader(doc.y + 4);

                const maxRows = Math.max(leftRows.length, rightRows.length);
                for (let i = 0; i < maxRows; i++) {
                    if (y > 690) {
                        doc.addPage();
                        renderHeader(doc, company, 'Balance de Comprobación - Forma de Cuenta', periodText, 'portrait');
                        y = drawDualHeader(doc.y + 4);
                    }

                    const l = leftRows[i];
                    const r = rightRows[i];

                    if (l) {
                        const isMaj = l.level <= 2;
                        doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
                        const ind = '  '.repeat(Math.max(0, l.level - 1));
                        doc.text(`${ind}${l.code} ${l.name}`.substring(0, 36), startX + 4, y, { width: 195, lineBreak: false });
                        doc.text(fmt(l.finalBalance), startX, y, { align: 'right', width: colWidth - 6, lineBreak: false });
                    }

                    if (r) {
                        const isMaj = r.level <= 2;
                        doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
                        const ind = '  '.repeat(Math.max(0, r.level - 1));
                        doc.text(`${ind}${r.code} ${r.name}`.substring(0, 36), rightColX + 4, y, { width: 195, lineBreak: false });
                        doc.text(fmt(r.finalBalance), rightColX, y, { align: 'right', width: colWidth - 6, lineBreak: false });
                    }

                    y += 11;
                }

                // Footing Totals
                if (y > 670) {
                    doc.addPage();
                    renderHeader(doc, company, 'Balance de Comprobación - Forma de Cuenta', periodText, 'portrait');
                    y = doc.y + 10;
                }

                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + colWidth, y).stroke();
                doc.strokeColor('#0f172a').lineWidth(1).moveTo(rightColX, y).lineTo(rightColX + colWidth, y).stroke();
                y += 4;
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('TOTAL DEUDORAS Y ACTIVOS:', startX + 4, y, { width: 180, lineBreak: false });
                doc.text(fmt(totalIzquierda), startX, y, { align: 'right', width: colWidth - 6, lineBreak: false });
                doc.text('TOTAL PASIVO Y PATRIMONIO:', rightColX + 4, y, { width: 180, lineBreak: false });
                doc.text(fmt(totalDerecha), rightColX, y, { align: 'right', width: colWidth - 6, lineBreak: false });

                y += 11;
                doc.strokeColor('#0f172a').lineWidth(0.5).moveTo(startX, y).lineTo(startX + colWidth, y).stroke();
                doc.moveTo(startX, y + 2).lineTo(startX + colWidth, y + 2).stroke();
                doc.moveTo(rightColX, y).lineTo(rightColX + colWidth, y).stroke();
                doc.moveTo(rightColX, y + 2).lineTo(rightColX + colWidth, y + 2).stroke();
                y += 14;

                renderClosingFooter(doc, startX, y, leftRows.length + rightRows.length, 'Cuentas');
                renderSignatures(doc, signatures, company, 'portrait');
                renderPageNumbers(doc);
                doc.end();
            });
        }

        buildPDF(res, 'landscape', (doc) => {
            renderHeader(doc, company, 'Balance de Comprobación', periodText, 'landscape');

            const startX = 30;
            const contentWidth = 732;
            const colW = { code: 80, name: 272, init: 95, cargo: 95, abono: 95, final: 95 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('CUENTA', x, yPos + 3); x += colW.code;
                doc.text('DESCRIPCION DE LA CUENTA', x, yPos + 3); x += colW.name;
                doc.text('SALDO INICIAL', x, yPos + 3, { align: 'right', width: colW.init - 6 }); x += colW.init;
                doc.text('CARGO', x, yPos + 3, { align: 'right', width: colW.cargo - 6 }); x += colW.cargo;
                doc.text('ABONO', x, yPos + 3, { align: 'right', width: colW.abono - 6 }); x += colW.abono;
                doc.text('SALDO FINAL', x, yPos + 3, { align: 'right', width: colW.final - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            if (filteredAccounts.length === 0) {
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No hay datos contables registrados para el período seleccionado.', startX, y + 10);
                y += 30;
            } else {
                for (const a of filteredAccounts) {
                    if (y > 520) {
                        doc.addPage();
                        renderHeader(doc, company, 'Balance de Comprobación', periodText, 'landscape');
                        y = drawTableHeader(doc.y + 4);
                    }

                    const isMajor = a.level <= 2;
                    doc.fontSize(isMajor ? 7.5 : 7).font(isMajor ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');

                    const indent = '  '.repeat(Math.max(0, a.level - 1));
                    let x = startX + 4;
                    doc.text(a.code, x, y, { width: colW.code }); x += colW.code;
                    doc.text(`${indent}${a.name}`.substring(0, 48), x, y, { width: colW.name - 6 }); x += colW.name;
                    doc.text(fmt(a.initBalance), x, y, { align: 'right', width: colW.init - 6 }); x += colW.init;
                    doc.text(fmt(a.cargo), x, y, { align: 'right', width: colW.cargo - 6 }); x += colW.cargo;
                    doc.text(fmt(a.abono), x, y, { align: 'right', width: colW.abono - 6 }); x += colW.abono;
                    doc.text(fmt(a.finalBalance), x, y, { align: 'right', width: colW.final - 6 });
                    y += 11;
                }

                // Totals
                if (y > 500) {
                    doc.addPage();
                    renderHeader(doc, company, 'Balance de Comprobación', periodText, 'landscape');
                    y = doc.y + 10;
                }
                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                y += 4;
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('TOTALES:', startX + 4, y);
                let tx = startX + colW.code + colW.name;
                doc.text(fmt(totalInit), tx, y, { align: 'right', width: colW.init - 6 }); tx += colW.init;
                doc.text(fmt(totalCargo), tx, y, { align: 'right', width: colW.cargo - 6 }); tx += colW.cargo;
                doc.text(fmt(totalAbono), tx, y, { align: 'right', width: colW.abono - 6 }); tx += colW.abono;
                doc.text(fmt(totalFinal), tx, y, { align: 'right', width: colW.final - 6 });
                y += 18;
            }

            renderClosingFooter(doc, startX, y, filteredAccounts.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'landscape');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getBalanceComprobacion Error]:', e);
        res.status(500).json({ message: e.message });
    }
};

// =============================================================================
// 5. BALANCE GENERAL
// =============================================================================

const getBalanceGeneral = async (req, res) => {
    try {
        const { year, month, level } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const y = parseInt(year);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const maxLevel = parseInt(level) || 3;

        const lastD = getLastDayOfMonth(y, m);
        const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const periodText = `AL ${lastD} DE ${MONTH_NAMES[m]} DE ${y}`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        // Fetch accounts
        const [accounts] = await pool.query(`
            SELECT a.id, a.code, a.name, a.account_type_id, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.company_id = ? AND a.active = 1
            ORDER BY a.code ASC
        `, [req.company_id]);

        // Cumulative balances up to periodEnd
        const [lines] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as debits,
                   COALESCE(SUM(l.credit), 0) as credits
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date <= ?
            GROUP BY a.code
        `, [req.company_id, periodEnd]);

        const lineMap = new Map();
        lines.forEach(l => lineMap.set(l.code, { debit: parseFloat(l.debits || 0), credit: parseFloat(l.credits || 0) }));

        // Account map
        const accMap = new Map();
        accounts.forEach(a => {
            accMap.set(a.code, {
                code: a.code,
                name: a.name,
                type: a.account_type_id,
                nature: a.nature,
                level: getAccountLevel(a.code),
                debit: 0,
                credit: 0,
                balance: 0
            });
        });

        // Rollup
        for (const [code, val] of lineMap.entries()) {
            for (const [accCode, accData] of accMap.entries()) {
                if (code.startsWith(accCode)) {
                    accData.debit += val.debit;
                    accData.credit += val.credit;
                }
            }
        }

        // Calculate balances
        let totalIngresos = 0;
        let totalCostosGastos = 0;

        for (const [, a] of accMap.entries()) {
            if (a.nature === 'debit') {
                a.balance = a.debit - a.credit;
            } else {
                a.balance = a.credit - a.debit;
            }
            if (a.level === 1) {
                if (a.type === 4 || a.code.startsWith('5')) totalIngresos += a.balance;
                if (a.type === 5 || a.type === 6 || a.code.startsWith('4')) totalCostosGastos += a.balance;
            }
        }

        const utilidadEjercicio = totalIngresos - totalCostosGastos;

        // Group balance accounts
        const activoRows = [];
        const pasivoRows = [];
        const patrimonioRows = [];

        let totalActivo = 0;
        let totalPasivo = 0;
        let totalPatrimonio = 0;

        for (const [, a] of accMap.entries()) {
            if (a.level > maxLevel) continue;
            if (Math.abs(a.balance) < 0.001) continue;

            if (a.code.startsWith('1')) {
                activoRows.push(a);
                if (a.code === '1') totalActivo = a.balance;
            } else if (a.code.startsWith('2')) {
                pasivoRows.push(a);
                if (a.code === '2') totalPasivo = a.balance;
            } else if (a.code.startsWith('3')) {
                patrimonioRows.push(a);
                if (a.code === '3') totalPatrimonio = a.balance;
            }
        }

        const totalPasivoPatrimonio = totalPasivo + totalPatrimonio + utilidadEjercicio;
        const modality = req.query.modality || req.query.format_type || 'cuenta';

        if (req.query.format === 'excel') {
            if (modality === 'cuenta') {
                const rightItems = [
                    { isHeader: true, title: 'PASIVO' },
                    ...pasivoRows,
                    { isHeader: true, title: 'PATRIMONIO NETO' },
                    ...patrimonioRows,
                    { isSpecial: true, title: 'UTILIDAD O PERDIDA DEL EJERCICIO', balance: utilidadEjercicio }
                ];
                const maxLines = Math.max(activoRows.length, rightItems.length);
                const rowsForExcel = [];
                for (let i = 0; i < maxLines; i++) {
                    const act = activoRows[i];
                    const rgt = rightItems[i];
                    const leftName = act ? `${act.code} - ${act.name}` : '';
                    const leftVal = act ? act.balance : '';
                    let rightName = '';
                    let rightVal = '';
                    if (rgt) {
                        if (rgt.isHeader) {
                            rightName = `--- ${rgt.title} ---`;
                        } else if (rgt.isSpecial) {
                            rightName = rgt.title;
                            rightVal = rgt.balance;
                        } else {
                            rightName = `${rgt.code} - ${rgt.name}`;
                            rightVal = rgt.balance;
                        }
                    }
                    rowsForExcel.push({
                        activo: leftName,
                        monto_activo: leftVal,
                        pasivo_patrimonio: rightName,
                        monto_pasivo_patrimonio: rightVal
                    });
                }
                rowsForExcel.push({ activo: '', monto_activo: '', pasivo_patrimonio: '', monto_pasivo_patrimonio: '' });
                rowsForExcel.push({
                    activo: 'TOTAL ACTIVO',
                    monto_activo: totalActivo,
                    pasivo_patrimonio: 'TOTAL PASIVO Y PATRIMONIO',
                    monto_pasivo_patrimonio: totalPasivoPatrimonio
                });
                return buildExcelResponse(res, rowsForExcel, [
                    { header: 'ACTIVO', key: 'activo', width: 42 },
                    { header: 'MONTO ACTIVO', key: 'monto_activo', width: 16 },
                    { header: 'PASIVO Y PATRIMONIO', key: 'pasivo_patrimonio', width: 42 },
                    { header: 'MONTO PASIVO Y PATRIMONIO', key: 'monto_pasivo_patrimonio', width: 16 }
                ], `Balance_General_Cuenta_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
            }

            const rowsForExcel = [
                ...activoRows.map(a => ({ seccion: 'ACTIVO', codigo: a.code, cuenta: a.name, nivel: a.level, saldo: a.balance })),
                ...pasivoRows.map(a => ({ seccion: 'PASIVO', codigo: a.code, cuenta: a.name, nivel: a.level, saldo: a.balance })),
                ...patrimonioRows.map(a => ({ seccion: 'PATRIMONIO', codigo: a.code, cuenta: a.name, nivel: a.level, saldo: a.balance })),
                { seccion: 'PATRIMONIO', codigo: '---', cuenta: 'UTILIDAD O PERDIDA DEL EJERCICIO', nivel: 3, saldo: utilidadEjercicio }
            ];
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Sección', key: 'seccion', width: 16 },
                { header: 'Código', key: 'codigo', width: 14 },
                { header: 'Cuenta', key: 'cuenta', width: 35 },
                { header: 'Nivel', key: 'nivel', width: 10 },
                { header: 'Saldo', key: 'saldo', width: 16 }
            ], `Balance_General_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        if (modality === 'cuenta') {
            return buildPDF(res, 'portrait', (doc) => {
                renderHeader(doc, company, 'Balance General - Formato Cuenta', periodText, 'portrait');

                const startX = 30;
                const colWidth = 270;
                const rightColX = 312;

                const drawDualHeader = (yPos) => {
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.rect(startX, yPos, colWidth, 14).fill('#f1f5f9');
                    doc.rect(rightColX, yPos, colWidth, 14).fill('#f1f5f9');
                    doc.fillColor('#0f172a');
                    doc.text('ACTIVO', startX + 4, yPos + 3, { lineBreak: false });
                    doc.text('SALDO', startX, yPos + 3, { align: 'right', width: colWidth - 6, lineBreak: false });
                    doc.text('PASIVO Y PATRIMONIO', rightColX + 4, yPos + 3, { lineBreak: false });
                    doc.text('SALDO', rightColX, yPos + 3, { align: 'right', width: colWidth - 6, lineBreak: false });
                    return yPos + 18;
                };

                let y = drawDualHeader(doc.y + 4);

                const rightItems = [
                    { isHeader: true, title: 'PASIVO' },
                    ...pasivoRows,
                    { isHeader: true, title: 'PATRIMONIO NETO' },
                    ...patrimonioRows,
                    { isSpecial: true, title: 'UTILIDAD O PERDIDA DEL EJERCICIO', balance: utilidadEjercicio }
                ];
                const maxLines = Math.max(activoRows.length, rightItems.length);

                for (let i = 0; i < maxLines; i++) {
                    if (y > 690) {
                        doc.addPage();
                        renderHeader(doc, company, 'Balance General - Formato Cuenta', periodText, 'portrait');
                        y = drawDualHeader(doc.y + 4);
                    }

                    const act = activoRows[i];
                    const rgt = rightItems[i];

                    if (act) {
                        const isMaj = act.level <= 2;
                        doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
                        const ind = '  '.repeat(Math.max(0, act.level - 1));
                        doc.text(`${ind}${act.code} ${act.name}`.substring(0, 36), startX + 4, y, { width: 195, lineBreak: false });
                        doc.text(fmt(act.balance), startX, y, { align: 'right', width: colWidth - 6, lineBreak: false });
                    }

                    if (rgt) {
                        if (rgt.isHeader) {
                            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e40af');
                            doc.rect(rightColX, y - 1, colWidth, 11).fill('#f8fafc');
                            doc.fillColor('#1e40af');
                            doc.text(rgt.title, rightColX + 4, y, { width: 260, lineBreak: false });
                        } else if (rgt.isSpecial) {
                            doc.fontSize(7).font('Helvetica-Bold').fillColor('#059669');
                            doc.text(rgt.title.substring(0, 36), rightColX + 4, y, { width: 195, lineBreak: false });
                            doc.text(fmt(rgt.balance), rightColX, y, { align: 'right', width: colWidth - 6, lineBreak: false });
                        } else {
                            const isMaj = rgt.level <= 2;
                            doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
                            const ind = '  '.repeat(Math.max(0, rgt.level - 1));
                            doc.text(`${ind}${rgt.code} ${rgt.name}`.substring(0, 36), rightColX + 4, y, { width: 195, lineBreak: false });
                            doc.text(fmt(rgt.balance), rightColX, y, { align: 'right', width: colWidth - 6, lineBreak: false });
                        }
                    }

                    y += 11;
                }

                // Footing Totals
                if (y > 670) {
                    doc.addPage();
                    renderHeader(doc, company, 'Balance General - Formato Cuenta', periodText, 'portrait');
                    y = doc.y + 10;
                }

                doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + colWidth, y).stroke();
                doc.strokeColor('#0f172a').lineWidth(1).moveTo(rightColX, y).lineTo(rightColX + colWidth, y).stroke();
                y += 4;
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text('TOTAL ACTIVO:', startX + 4, y, { width: 180, lineBreak: false });
                doc.text(fmt(totalActivo), startX, y, { align: 'right', width: colWidth - 6, lineBreak: false });
                doc.text('TOTAL PASIVO Y PATRIMONIO:', rightColX + 4, y, { width: 180, lineBreak: false });
                doc.text(fmt(totalPasivoPatrimonio), rightColX, y, { align: 'right', width: colWidth - 6, lineBreak: false });

                y += 11;
                doc.strokeColor('#0f172a').lineWidth(0.5).moveTo(startX, y).lineTo(startX + colWidth, y).stroke();
                doc.moveTo(startX, y + 2).lineTo(startX + colWidth, y + 2).stroke();
                doc.moveTo(rightColX, y).lineTo(rightColX + colWidth, y).stroke();
                doc.moveTo(rightColX, y + 2).lineTo(rightColX + colWidth, y + 2).stroke();
                y += 14;

                renderClosingFooter(doc, startX, y, activoRows.length + pasivoRows.length + patrimonioRows.length, 'Cuentas');
                renderSignatures(doc, signatures, company, 'portrait');
                renderPageNumbers(doc);
                doc.end();
            });
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Balance General', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;
            const colW = { code: 75, name: 357, saldo: 120 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('CÓDIGO', x, yPos + 3); x += colW.code;
                doc.text('DESCRIPCION DE LA CUENTA', x, yPos + 3); x += colW.name;
                doc.text('SALDO', x, yPos + 3, { align: 'right', width: colW.saldo - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            const renderSection = (title, items) => {
                if (y > 690) {
                    doc.addPage();
                    renderHeader(doc, company, 'Balance General', periodText, 'portrait');
                    y = drawTableHeader(doc.y + 4);
                }
                doc.rect(startX, y, contentWidth, 13).fill('#e2e8f0');
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(title, startX + 6, y + 3);
                y += 15;

                for (const item of items) {
                    if (y > 710) {
                        doc.addPage();
                        renderHeader(doc, company, 'Balance General', periodText, 'portrait');
                        y = drawTableHeader(doc.y + 4);
                    }
                    const isMaj = item.level <= 2;
                    doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#1e293b');
                    const ind = '  '.repeat(Math.max(0, item.level - 1));
                    doc.text(item.code, startX + 4, y, { width: colW.code });
                    doc.text(`${ind}${item.name}`.substring(0, 52), startX + colW.code, y, { width: colW.name - 6 });
                    doc.text(fmt(item.balance), startX + colW.code + colW.name, y, { align: 'right', width: colW.saldo - 6 });
                    y += 11;
                }
            };

            renderSection('ACTIVO', activoRows);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL ACTIVO:', startX + colW.code, y);
            doc.text(fmt(totalActivo), startX + colW.code + colW.name, y, { align: 'right', width: colW.saldo - 6 });
            y += 16;

            renderSection('PASIVO', pasivoRows);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL PASIVO:', startX + colW.code, y);
            doc.text(fmt(totalPasivo), startX + colW.code + colW.name, y, { align: 'right', width: colW.saldo - 6 });
            y += 16;

            renderSection('PATRIMONIO NETO', patrimonioRows);
            // Utilidad del Ejercicio
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#059669');
            doc.text('---', startX + 4, y);
            doc.text('UTILIDAD O PERDIDA DEL EJERCICIO', startX + colW.code, y);
            doc.text(fmt(utilidadEjercicio), startX + colW.code + colW.name, y, { align: 'right', width: colW.saldo - 6 });
            y += 14;

            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL PATRIMONIO:', startX + colW.code, y);
            doc.text(fmt(totalPatrimonio + utilidadEjercicio), startX + colW.code + colW.name, y, { align: 'right', width: colW.saldo - 6 });
            y += 16;

            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            y += 4;
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL PASIVO Y PATRIMONIO:', startX + colW.code, y);
            doc.text(fmt(totalPasivoPatrimonio), startX + colW.code + colW.name, y, { align: 'right', width: colW.saldo - 6 });
            y += 20;

            renderClosingFooter(doc, startX, y, activoRows.length + pasivoRows.length + patrimonioRows.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getBalanceGeneral Error]:', e);
        res.status(500).json({ message: e.message });
    }
};

// =============================================================================
// 6. ANEXO AL BALANCE GENERAL
// =============================================================================

const getAnexoBalance = async (req, res) => {
    try {
        const { year, month, level } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const y = parseInt(year);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const maxLevel = parseInt(level) || 4;

        const lastD = getLastDayOfMonth(y, m);
        const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const periodText = `AL ${lastD} DE ${MONTH_NAMES[m]} DE ${y}`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        const [accounts] = await pool.query(`
            SELECT a.id, a.code, a.name, a.account_type_id, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.company_id = ? AND a.active = 1
            ORDER BY a.code ASC
        `, [req.company_id]);

        const [lines] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as debits,
                   COALESCE(SUM(l.credit), 0) as credits
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date <= ?
            GROUP BY a.code
        `, [req.company_id, periodEnd]);

        const lineMap = new Map();
        lines.forEach(l => lineMap.set(l.code, { debit: parseFloat(l.debits || 0), credit: parseFloat(l.credits || 0) }));

        const accMap = new Map();
        accounts.forEach(a => {
            accMap.set(a.code, {
                code: a.code,
                name: a.name,
                type: a.account_type_id,
                nature: a.nature,
                level: getAccountLevel(a.code),
                debit: 0,
                credit: 0,
                balance: 0
            });
        });

        for (const [code, val] of lineMap.entries()) {
            for (const [accCode, accData] of accMap.entries()) {
                if (code.startsWith(accCode)) {
                    accData.debit += val.debit;
                    accData.credit += val.credit;
                }
            }
        }

        let totalIngresos = 0;
        let totalCostosGastos = 0;

        for (const [, a] of accMap.entries()) {
            if (a.nature === 'debit') a.balance = a.debit - a.credit;
            else a.balance = a.credit - a.debit;

            if (a.level === 1) {
                if (a.type === 4 || a.code.startsWith('5')) totalIngresos += a.balance;
                if (a.type === 5 || a.type === 6 || a.code.startsWith('4')) totalCostosGastos += a.balance;
            }
        }

        const utilidadEjercicio = totalIngresos - totalCostosGastos;

        // Balance accounts up to maxLevel
        const balanceAccounts = Array.from(accMap.values()).filter(a => {
            if (a.level > maxLevel) return false;
            if (!a.code.startsWith('1') && !a.code.startsWith('2') && !a.code.startsWith('3')) return false;
            return Math.abs(a.balance) > 0.001;
        });

        let totalActivo = 0;
        let totalPasivo = 0;
        let totalCapital = 0;

        balanceAccounts.forEach(a => {
            if (a.code === '1') totalActivo = a.balance;
            if (a.code === '2') totalPasivo = a.balance;
            if (a.code === '3') totalCapital = a.balance;
        });

        if (req.query.format === 'excel') {
            const rowsForExcel = balanceAccounts.map(a => ({
                cuenta: a.code,
                nombre: a.name,
                nivel: a.level,
                saldo: a.balance
            }));
            rowsForExcel.push({ cuenta: '---', nombre: 'UTILIDAD O PERDIDA DEL EJERCICIO', nivel: 3, saldo: utilidadEjercicio });
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 14 },
                { header: 'Nombre', key: 'nombre', width: 35 },
                { header: 'Nivel', key: 'nivel', width: 10 },
                { header: 'Saldo', key: 'saldo', width: 16 }
            ], `Anexo_Balance_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'landscape', (doc) => {
            renderHeader(doc, company, 'Anexo al Balance General', periodText, 'landscape');

            const startX = 30;
            const contentWidth = 732;
            const colW = { code: 80, name: 302, nivelAnt: 70, n5: 70, n4: 70, n3: 70, n12: 70 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('CUENTA', x, yPos + 3); x += colW.code;
                doc.text('DESCRIPCION DE LA CUENTA', x, yPos + 3); x += colW.name;
                doc.text('NIVEL 5', x, yPos + 3, { align: 'right', width: colW.n5 - 4 }); x += colW.n5;
                doc.text('NIVEL 4', x, yPos + 3, { align: 'right', width: colW.n4 - 4 }); x += colW.n4;
                doc.text('NIVEL 3', x, yPos + 3, { align: 'right', width: colW.n3 - 4 }); x += colW.n3;
                doc.text('NIVEL 2', x, yPos + 3, { align: 'right', width: colW.nivelAnt - 4 }); x += colW.nivelAnt;
                doc.text('NIVEL 1', x, yPos + 3, { align: 'right', width: colW.n12 - 4 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            for (const a of balanceAccounts) {
                if (y > 520) {
                    doc.addPage();
                    renderHeader(doc, company, 'Anexo al Balance General', periodText, 'landscape');
                    y = drawTableHeader(doc.y + 4);
                }

                const isMaj = a.level <= 2;
                doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
                let x = startX + 4;
                doc.text(a.code, x, y, { width: colW.code }); x += colW.code;
                doc.text(a.name.substring(0, 48), x, y, { width: colW.name - 6 }); x += colW.name;

                // Position in level column
                const s = fmt(a.balance);
                doc.text(a.level === 5 ? s : '', x, y, { align: 'right', width: colW.n5 - 4 }); x += colW.n5;
                doc.text(a.level === 4 ? s : '', x, y, { align: 'right', width: colW.n4 - 4 }); x += colW.n4;
                doc.text(a.level === 3 ? s : '', x, y, { align: 'right', width: colW.n3 - 4 }); x += colW.n3;
                doc.text(a.level === 2 ? s : '', x, y, { align: 'right', width: colW.nivelAnt - 4 }); x += colW.nivelAnt;
                doc.text(a.level === 1 ? s : '', x, y, { align: 'right', width: colW.n12 - 4 });
                y += 11;
            }

            // Summary Totals
            if (y > 480) {
                doc.addPage();
                renderHeader(doc, company, 'Anexo al Balance General', periodText, 'landscape');
                y = doc.y + 10;
            }
            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            y += 4;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL ACTIVO :', startX + 4, y);
            doc.text(fmt(totalActivo), startX + contentWidth - 110, y, { align: 'right', width: 105 });
            y += 12;
            doc.text('TOTAL PASIVO :', startX + 4, y);
            doc.text(fmt(totalPasivo), startX + contentWidth - 110, y, { align: 'right', width: 105 });
            y += 12;
            doc.text('TOTAL CAPITAL :', startX + 4, y);
            doc.text(fmt(totalCapital), startX + contentWidth - 110, y, { align: 'right', width: 105 });
            y += 12;
            doc.text('UTILIDAD O PERDIDA DEL EJERCICIO :', startX + 4, y);
            doc.text(fmt(utilidadEjercicio), startX + contentWidth - 110, y, { align: 'right', width: 105 });
            y += 18;

            renderClosingFooter(doc, startX, y, balanceAccounts.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'landscape');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getAnexoBalance Error]:', e);
        res.status(500).json({ message: e.message });
    }
};

// =============================================================================
// 7. BALANCE COMPARATIVO
// =============================================================================

const getBalanceComparativo = async (req, res) => {
    try {
        const { year, comparative_year, month, level } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const yBase = parseInt(year);
        const yComp = parseInt(comparative_year) || (yBase - 1);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const maxLevel = parseInt(level) || 3;

        const lastDBase = getLastDayOfMonth(yBase, m);
        const periodEndBase = `${yBase}-${String(m).padStart(2, '0')}-${String(lastDBase).padStart(2, '0')}`;

        const lastDComp = getLastDayOfMonth(yComp, m);
        const periodEndComp = `${yComp}-${String(m).padStart(2, '0')}-${String(lastDComp).padStart(2, '0')}`;

        const periodText = `EJERCICIO ${yBase} VS ${yComp} (AL MES DE ${MONTH_NAMES[m]})`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        const [accounts] = await pool.query(`
            SELECT a.id, a.code, a.name, a.account_type_id, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.company_id = ? AND a.active = 1
            ORDER BY a.code ASC
        `, [req.company_id]);

        // Base year lines
        const [linesBase] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as debits,
                   COALESCE(SUM(l.credit), 0) as credits
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date <= ?
            GROUP BY a.code
        `, [req.company_id, periodEndBase]);

        // Comp year lines
        const [linesComp] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as debits,
                   COALESCE(SUM(l.credit), 0) as credits
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date <= ?
            GROUP BY a.code
        `, [req.company_id, periodEndComp]);

        const mapBase = new Map();
        linesBase.forEach(l => mapBase.set(l.code, { debit: parseFloat(l.debits || 0), credit: parseFloat(l.credits || 0) }));

        const mapComp = new Map();
        linesComp.forEach(l => mapComp.set(l.code, { debit: parseFloat(l.debits || 0), credit: parseFloat(l.credits || 0) }));

        const accMap = new Map();
        accounts.forEach(a => {
            accMap.set(a.code, {
                code: a.code,
                name: a.name,
                nature: a.nature,
                level: getAccountLevel(a.code),
                debitBase: 0, creditBase: 0, saldoBase: 0,
                debitComp: 0, creditComp: 0, saldoComp: 0
            });
        });

        for (const [code, val] of mapBase.entries()) {
            for (const [accCode, accData] of accMap.entries()) {
                if (code.startsWith(accCode)) {
                    accData.debitBase += val.debit;
                    accData.creditBase += val.credit;
                }
            }
        }

        for (const [code, val] of mapComp.entries()) {
            for (const [accCode, accData] of accMap.entries()) {
                if (code.startsWith(accCode)) {
                    accData.debitComp += val.debit;
                    accData.creditComp += val.credit;
                }
            }
        }

        for (const [, a] of accMap.entries()) {
            if (a.nature === 'debit') {
                a.saldoBase = a.debitBase - a.creditBase;
                a.saldoComp = a.debitComp - a.creditComp;
            } else {
                a.saldoBase = a.creditBase - a.debitBase;
                a.saldoComp = a.creditComp - a.debitComp;
            }
        }

        const rows = Array.from(accMap.values()).filter(a => {
            if (a.level > maxLevel) return false;
            if (!a.code.startsWith('1') && !a.code.startsWith('2') && !a.code.startsWith('3')) return false;
            return Math.abs(a.saldoBase) > 0.001 || Math.abs(a.saldoComp) > 0.001;
        }).map(a => {
            const varAbs = a.saldoBase - a.saldoComp;
            const varPct = a.saldoComp !== 0 ? (varAbs / Math.abs(a.saldoComp)) * 100 : 0;
            return {
                code: a.code,
                name: a.name,
                level: a.level,
                saldoBase: a.saldoBase,
                saldoComp: a.saldoComp,
                varAbs,
                varPct
            };
        });

        if (req.query.format === 'excel') {
            const rowsForExcel = rows.map(r => ({
                cuenta: r.code,
                nombre: r.name,
                nivel: r.level,
                saldo_base: r.saldoBase,
                saldo_comp: r.saldoComp,
                var_monto: r.varAbs,
                var_porc: `${r.varPct.toFixed(1)}%`
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 14 },
                { header: 'Nombre', key: 'nombre', width: 35 },
                { header: 'Nivel', key: 'nivel', width: 10 },
                { header: `Saldo ${yBase}`, key: 'saldo_base', width: 16 },
                { header: `Saldo ${yComp}`, key: 'saldo_comp', width: 16 },
                { header: 'Variación ($)', key: 'var_monto', width: 16 },
                { header: 'Variación (%)', key: 'var_porc', width: 14 }
            ], `Balance_Comparativo_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'landscape', (doc) => {
            renderHeader(doc, company, 'Balance Comparativo', periodText, 'landscape');

            const startX = 30;
            const contentWidth = 732;
            const colW = { code: 80, name: 302, base: 90, comp: 90, varA: 85, varP: 85 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('CÓDIGO', x, yPos + 3); x += colW.code;
                doc.text('DESCRIPCION DE LA CUENTA', x, yPos + 3); x += colW.name;
                doc.text(`AÑO ${yBase}`, x, yPos + 3, { align: 'right', width: colW.base - 4 }); x += colW.base;
                doc.text(`AÑO ${yComp}`, x, yPos + 3, { align: 'right', width: colW.comp - 4 }); x += colW.comp;
                doc.text('VARIACIÓN ($)', x, yPos + 3, { align: 'right', width: colW.varA - 4 }); x += colW.varA;
                doc.text('VARIACIÓN (%)', x, yPos + 3, { align: 'right', width: colW.varP - 4 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            for (const r of rows) {
                if (y > 520) {
                    doc.addPage();
                    renderHeader(doc, company, 'Balance Comparativo', periodText, 'landscape');
                    y = drawTableHeader(doc.y + 4);
                }

                const isMaj = r.level <= 2;
                doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
                let x = startX + 4;
                doc.text(r.code, x, y, { width: colW.code }); x += colW.code;
                doc.text(r.name.substring(0, 48), x, y, { width: colW.name - 6 }); x += colW.name;
                doc.text(fmt(r.saldoBase), x, y, { align: 'right', width: colW.base - 4 }); x += colW.base;
                doc.text(fmt(r.saldoComp), x, y, { align: 'right', width: colW.comp - 4 }); x += colW.comp;

                // Variation colored
                doc.fillColor(r.varAbs >= 0 ? '#059669' : '#dc2626');
                doc.text(fmt(r.varAbs), x, y, { align: 'right', width: colW.varA - 4 }); x += colW.varA;
                doc.text(`${r.varPct >= 0 ? '+' : ''}${r.varPct.toFixed(1)}%`, x, y, { align: 'right', width: colW.varP - 4 });
                doc.fillColor('#0f172a');
                y += 11;
            }

            y += 10;
            renderClosingFooter(doc, startX, y, rows.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'landscape');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getBalanceComparativo Error]:', e);
        res.status(500).json({ message: e.message });
    }
};

// =============================================================================
// 8. ESTADO DE RESULTADOS
// =============================================================================

const getEstadoResultados = async (req, res) => {
    try {
        const { year, month, level } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const y = parseInt(year);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const maxLevel = parseInt(level) || 3;

        const lastD = getLastDayOfMonth(y, m);
        const periodStart = `${y}-01-01`;
        const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const periodText = `DEL 01 DE ENERO AL ${lastD} DE ${MONTH_NAMES[m]} DE ${y}`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        const [accounts] = await pool.query(`
            SELECT a.id, a.code, a.name, a.account_type_id, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.company_id = ? AND a.active = 1
            ORDER BY a.code ASC
        `, [req.company_id]);

        const [lines] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.debit), 0) as debits,
                   COALESCE(SUM(l.credit), 0) as credits
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            GROUP BY a.code
        `, [req.company_id, periodStart, periodEnd]);

        const lineMap = new Map();
        lines.forEach(l => lineMap.set(l.code, { debit: parseFloat(l.debits || 0), credit: parseFloat(l.credits || 0) }));

        const accMap = new Map();
        accounts.forEach(a => {
            accMap.set(a.code, {
                code: a.code,
                name: a.name,
                type: a.account_type_id,
                nature: a.nature,
                level: getAccountLevel(a.code),
                debit: 0,
                credit: 0,
                balance: 0
            });
        });

        for (const [code, val] of lineMap.entries()) {
            for (const [accCode, accData] of accMap.entries()) {
                if (code.startsWith(accCode)) {
                    accData.debit += val.debit;
                    accData.credit += val.credit;
                }
            }
        }

        for (const [, a] of accMap.entries()) {
            if (a.nature === 'debit') a.balance = a.debit - a.credit;
            else a.balance = a.credit - a.debit;
        }

        // Structural components
        let ingresosOrdinarios = 0;
        let costosOrdinarios = 0;
        let gastosAdmin = 0;
        let gastosVenta = 0;
        let gastosFinancieros = 0;
        let otrosIngresos = 0;

        for (const [, a] of accMap.entries()) {
            const c = a.code;
            if (c === '51' || (c === '4' && a.type === 4)) ingresosOrdinarios = a.balance;
            else if (c === '41' || (c === '5' && a.type === 5)) costosOrdinarios = a.balance;
            else if (c === '4201') gastosAdmin = a.balance;
            else if (c === '4202') gastosVenta = a.balance;
            else if (c === '42' && gastosAdmin === 0 && gastosVenta === 0) gastosAdmin = a.balance;
            else if (c === '43') gastosFinancieros = a.balance;
            else if (c === '52') otrosIngresos = a.balance;
        }

        // If specific codes were not used, fallback to account types 4, 5, 6
        if (ingresosOrdinarios === 0) {
            for (const [, a] of accMap.entries()) {
                if (a.level === 1 && a.type === 4) ingresosOrdinarios = a.balance;
            }
        }
        if (costosOrdinarios === 0) {
            for (const [, a] of accMap.entries()) {
                if (a.level === 1 && a.type === 5) costosOrdinarios = a.balance;
            }
        }
        if (gastosAdmin === 0 && gastosVenta === 0) {
            for (const [, a] of accMap.entries()) {
                if (a.level === 1 && a.type === 6) gastosAdmin = a.balance;
            }
        }

        const utilidadBruta = ingresosOrdinarios - costosOrdinarios;
        const totalGastosOperacion = gastosAdmin + gastosVenta;
        const utilidadOperacion = utilidadBruta - totalGastosOperacion;
        const utilidadAntesImpuestos = utilidadOperacion - gastosFinancieros + otrosIngresos;

        const reservaLegal = utilidadAntesImpuestos > 0 ? Math.round(utilidadAntesImpuestos * 0.07 * 100) / 100 : 0;
        const tasaIsr = ingresosOrdinarios > 150000 ? 0.30 : 0.25;
        const baseImponible = Math.max(0, utilidadAntesImpuestos - reservaLegal);
        const impuestoRenta = baseImponible > 0 ? Math.round(baseImponible * tasaIsr * 100) / 100 : 0;
        const utilidadNeta = utilidadAntesImpuestos - reservaLegal - impuestoRenta;

        // Breakdown nominal accounts
        const detailedRows = Array.from(accMap.values()).filter(a => {
            if (a.level > maxLevel) return false;
            if (!a.code.startsWith('4') && !a.code.startsWith('5') && a.type !== 4 && a.type !== 5 && a.type !== 6) return false;
            return Math.abs(a.balance) > 0.001;
        });

        if (req.query.format === 'excel') {
            const rowsForExcel = [
                { concepto: 'INGRESOS DE OPERACIÓN', monto: ingresosOrdinarios },
                { concepto: 'COSTOS DE OPERACIÓN', monto: costosOrdinarios },
                { concepto: 'UTILIDAD BRUTA', monto: utilidadBruta },
                { concepto: 'Gastos de Administración', monto: gastosAdmin },
                { concepto: 'Gastos de Venta', monto: gastosVenta },
                { concepto: 'TOTAL GASTOS DE OPERACIÓN', monto: totalGastosOperacion },
                { concepto: 'UTILIDAD DE OPERACIÓN', monto: utilidadOperacion },
                { concepto: 'Gastos Financieros', monto: gastosFinancieros },
                { concepto: 'Otros Ingresos', monto: otrosIngresos },
                { concepto: 'UTILIDAD ANTES DE IMPUESTOS', monto: utilidadAntesImpuestos },
                { concepto: 'Reserva Legal (7%)', monto: reservaLegal },
                { concepto: `Impuesto Sobre la Renta (${(tasaIsr * 100).toFixed(0)}%)`, monto: impuestoRenta },
                { concepto: 'UTILIDAD NETA DEL EJERCICIO', monto: utilidadNeta }
            ];
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Concepto', key: 'concepto', width: 40 },
                { header: 'Monto', key: 'monto', width: 16 }
            ], `Estado_Resultados_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Estado de Resultados', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;
            const colW = { desc: 412, monto: 140 };

            const renderLine = (label, amount, isBold = false, isHighlight = false, color = '#0f172a', indent = 0) => {
                if (doc.y > 700) {
                    doc.addPage();
                    renderHeader(doc, company, 'Estado de Resultados', periodText, 'portrait');
                }
                const curY = doc.y;
                if (isHighlight) {
                    doc.rect(startX, curY - 2, contentWidth, 14).fill('#f1f5f9');
                }
                doc.fontSize(isBold ? 8.5 : 7.5).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color);
                doc.text(`${' '.repeat(indent * 4)}${label}`, startX + 6, curY);
                doc.text(fmt(amount), startX + colW.desc, curY, { align: 'right', width: colW.monto - 6 });
                doc.y = curY + 13;
            };

            const renderDivider = () => {
                doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, doc.y).lineTo(startX + contentWidth, doc.y).stroke();
                doc.y += 4;
            };

            renderLine('INGRESOS DE OPERACIÓN', ingresosOrdinarios, true, false, '#0f172a');
            renderLine('(-) COSTOS DE OPERACIÓN', costosOrdinarios, false, false, '#475569');
            renderDivider();
            renderLine('(=) UTILIDAD BRUTA', utilidadBruta, true, true, '#0f172a');
            doc.y += 4;

            renderLine('GASTOS DE OPERACIÓN:', totalGastosOperacion, true, false, '#0f172a');
            renderLine('Gastos de Administración', gastosAdmin, false, false, '#475569', 1);
            renderLine('Gastos de Venta', gastosVenta, false, false, '#475569', 1);
            renderDivider();
            renderLine('(=) UTILIDAD DE OPERACIÓN', utilidadOperacion, true, true, '#0f172a');
            doc.y += 4;

            renderLine('(-) Gastos Financieros', gastosFinancieros, false, false, '#475569');
            renderLine('(+) Otros Ingresos', otrosIngresos, false, false, '#475569');
            renderDivider();
            renderLine('(=) UTILIDAD ANTES DE IMPUESTOS', utilidadAntesImpuestos, true, true, '#0f172a');
            doc.y += 4;

            renderLine('(-) Reserva Legal (7%)', reservaLegal, false, false, '#475569');
            renderLine(`(-) Provisión Impuesto Sobre la Renta (${(tasaIsr * 100).toFixed(0)}%)`, impuestoRenta, false, false, '#475569');
            renderDivider();

            const netColor = utilidadNeta >= 0 ? '#059669' : '#dc2626';
            renderLine('(=) UTILIDAD NETA DEL EJERCICIO', utilidadNeta, true, true, netColor);
            doc.y += 15;

            // Optional account details breakdown below if accounts exist
            if (detailedRows.length > 0 && maxLevel > 1) {
                if (doc.y > 640) {
                    doc.addPage();
                    renderHeader(doc, company, 'Estado de Resultados', periodText, 'portrait');
                }
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('ANEXO DETALLADO DE CUENTAS DE RESULTADOS:', startX + 6, doc.y);
                doc.y += 10;
                for (const r of detailedRows) {
                    if (doc.y > 710) {
                        doc.addPage();
                        renderHeader(doc, company, 'Estado de Resultados', periodText, 'portrait');
                    }
                    doc.fontSize(7).font('Helvetica').fillColor('#334155');
                    const ind = '  '.repeat(Math.max(0, r.level - 1));
                    doc.text(r.code, startX + 4, doc.y, { width: 70 });
                    doc.text(`${ind}${r.name}`.substring(0, 50), startX + 75, doc.y, { width: 330 });
                    doc.text(fmt(r.balance), startX + 410, doc.y, { align: 'right', width: 135 });
                    doc.y += 10;
                }
            }

            renderClosingFooter(doc, startX, doc.y + 10, detailedRows.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getEstadoResultados Error]:', e);
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
// 11. ESTADO DE CAMBIOS EN EL PATRIMONIO
// =============================================================================

const getCambiosPatrimonio = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const y = parseInt(year);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const lastD = getLastDayOfMonth(y, m);
        const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const startOfYear = `${y}-01-01`;
        const periodText = `EJERCICIO ${y} (AL CORTE DE ${MONTH_NAMES[m]})`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        // Fetch equity accounts (class 3)
        const [accounts] = await pool.query(`
            SELECT a.id, a.code, a.name
            FROM chart_of_accounts a
            WHERE a.company_id = ? AND a.code LIKE '3%' AND a.active = 1
            ORDER BY a.code ASC
        `, [req.company_id]);

        // Prior balances before year start
        const [priorRows] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0) as balance
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date < ? AND a.code LIKE '3%'
            GROUP BY a.code
        `, [req.company_id, startOfYear]);

        // Current movements during year up to periodEnd
        const [currRows] = await pool.query(`
            SELECT a.code,
                   COALESCE(SUM(l.credit), 0) as increases,
                   COALESCE(SUM(l.debit), 0) as decreases
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ? AND a.code LIKE '3%'
            GROUP BY a.code
        `, [req.company_id, startOfYear, periodEnd]);

        const priorMap = new Map();
        priorRows.forEach(r => priorMap.set(r.code, parseFloat(r.balance || 0)));

        const currMap = new Map();
        currRows.forEach(r => currMap.set(r.code, { inc: parseFloat(r.increases || 0), dec: parseFloat(r.decreases || 0) }));

        // Rollup
        const accMap = new Map();
        accounts.forEach(a => {
            accMap.set(a.code, {
                code: a.code,
                name: a.name,
                level: getAccountLevel(a.code),
                saldoInicial: 0,
                aumentos: 0,
                disminuciones: 0,
                saldoFinal: 0
            });
        });

        for (const [code, bal] of priorMap.entries()) {
            for (const [accCode, accData] of accMap.entries()) {
                if (code.startsWith(accCode)) accData.saldoInicial += bal;
            }
        }

        for (const [code, vals] of currMap.entries()) {
            for (const [accCode, accData] of accMap.entries()) {
                if (code.startsWith(accCode)) {
                    accData.aumentos += vals.inc;
                    accData.disminuciones += vals.dec;
                }
            }
        }

        for (const [, a] of accMap.entries()) {
            a.saldoFinal = a.saldoInicial + a.aumentos - a.disminuciones;
        }

        const filtered = Array.from(accMap.values()).filter(a => {
            if (a.level > 3) return false;
            return Math.abs(a.saldoInicial) > 0.001 || a.aumentos > 0 || a.disminuciones > 0 || Math.abs(a.saldoFinal) > 0.001;
        });

        let totIni = 0, totInc = 0, totDec = 0, totFin = 0;
        filtered.forEach(a => {
            if (a.code === '3') {
                totIni = a.saldoInicial;
                totInc = a.aumentos;
                totDec = a.disminuciones;
                totFin = a.saldoFinal;
            }
        });

        if (req.query.format === 'excel') {
            const rowsForExcel = filtered.map(a => ({
                cuenta: a.code,
                concepto: a.name,
                saldo_inicial: a.saldoInicial,
                aumentos: a.aumentos,
                disminuciones: a.disminuciones,
                saldo_final: a.saldoFinal
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Cuenta', key: 'cuenta', width: 14 },
                { header: 'Concepto', key: 'concepto', width: 35 },
                { header: 'Saldo Inicial', key: 'saldo_inicial', width: 16 },
                { header: 'Aumentos', key: 'aumentos', width: 16 },
                { header: 'Disminuciones', key: 'disminuciones', width: 16 },
                { header: 'Saldo Final', key: 'saldo_final', width: 16 }
            ], `Cambios_Patrimonio_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'landscape', (doc) => {
            renderHeader(doc, company, 'Estado de Cambios en el Patrimonio', periodText, 'landscape');

            const startX = 30;
            const contentWidth = 732;
            const colW = { code: 80, desc: 292, ini: 90, inc: 90, dec: 90, fin: 90 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('CUENTA', x, yPos + 3); x += colW.code;
                doc.text('CONCEPTO / CUENTA PATRIMONIAL', x, yPos + 3); x += colW.desc;
                doc.text('SALDO INICIAL', x, yPos + 3, { align: 'right', width: colW.ini - 6 }); x += colW.ini;
                doc.text('AUMENTOS', x, yPos + 3, { align: 'right', width: colW.inc - 6 }); x += colW.inc;
                doc.text('DISMINUCIONES', x, yPos + 3, { align: 'right', width: colW.dec - 6 }); x += colW.dec;
                doc.text('SALDO FINAL', x, yPos + 3, { align: 'right', width: colW.fin - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 4);

            for (const a of filtered) {
                if (y > 520) {
                    doc.addPage();
                    renderHeader(doc, company, 'Estado de Cambios en el Patrimonio', periodText, 'landscape');
                    y = drawTableHeader(doc.y + 4);
                }
                const isMaj = a.level <= 2;
                doc.fontSize(isMaj ? 7.5 : 7).font(isMaj ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a');
                let x = startX + 4;
                doc.text(a.code, x, y, { width: colW.code }); x += colW.code;
                doc.text(a.name.substring(0, 48), x, y, { width: colW.desc - 6 }); x += colW.desc;
                doc.text(fmt(a.saldoInicial), x, y, { align: 'right', width: colW.ini - 6 }); x += colW.ini;
                doc.text(fmt(a.aumentos), x, y, { align: 'right', width: colW.inc - 6 }); x += colW.inc;
                doc.text(fmt(a.disminuciones), x, y, { align: 'right', width: colW.dec - 6 }); x += colW.dec;
                doc.text(fmt(a.saldoFinal), x, y, { align: 'right', width: colW.fin - 6 });
                y += 11;
            }

            // Totals
            if (y > 500) {
                doc.addPage();
                renderHeader(doc, company, 'Estado de Cambios en el Patrimonio', periodText, 'landscape');
                y = doc.y + 10;
            }
            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            y += 4;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('TOTAL PATRIMONIO NETO:', startX + 4, y);
            let tx = startX + colW.code + colW.desc;
            doc.text(fmt(totIni), tx, y, { align: 'right', width: colW.ini - 6 }); tx += colW.ini;
            doc.text(fmt(totInc), tx, y, { align: 'right', width: colW.inc - 6 }); tx += colW.inc;
            doc.text(fmt(totDec), tx, y, { align: 'right', width: colW.dec - 6 }); tx += colW.dec;
            doc.text(fmt(totFin), tx, y, { align: 'right', width: colW.fin - 6 });
            y += 18;

            renderClosingFooter(doc, startX, y, filtered.length, 'Cuentas');
            renderSignatures(doc, signatures, company, 'landscape');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getCambiosPatrimonio Error]:', e);
        res.status(500).json({ message: e.message });
    }
};

// =============================================================================
// 12. ESTADO DE FLUJOS DE EFECTIVO
// =============================================================================

const getFlujoEfectivo = async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year) {
            return res.status(400).json({ message: 'Año requerido' });
        }

        const y = parseInt(year);
        const m = parseInt(month) || (new Date().getMonth() + 1);
        const lastD = getLastDayOfMonth(y, m);
        const periodStart = `${y}-01-01`;
        const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
        const periodText = `DEL 01 DE ENERO AL ${lastD} DE ${MONTH_NAMES[m]} DE ${y}`;

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);

        // Cash beginning of year (1101)
        const [beginCash] = await pool.query(`
            SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as balance
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date < ? AND a.code LIKE '1101%'
        `, [req.company_id, periodStart]);

        // Cash end of period
        const [endCash] = await pool.query(`
            SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) as balance
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date <= ? AND a.code LIKE '1101%'
        `, [req.company_id, periodEnd]);

        // Operational movements during period
        const [movements] = await pool.query(`
            SELECT a.account_type_id,
                   COALESCE(SUM(l.debit), 0) as total_debit,
                   COALESCE(SUM(l.credit), 0) as total_credit
            FROM accounting_entry_lines l
            JOIN chart_of_accounts a ON l.account_id = a.id
            JOIN accounting_entries e ON l.entry_id = e.id
            WHERE e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            GROUP BY a.account_type_id
        `, [req.company_id, periodStart, periodEnd]);

        const movMap = new Map();
        movements.forEach(r => movMap.set(r.account_type_id, {
            debit: parseFloat(r.total_debit || 0),
            credit: parseFloat(r.total_credit || 0)
        }));

        const getNet = (typeId) => {
            const m = movMap.get(typeId);
            if (!m) return 0;
            // For revenue (type 4): credit - debit
            if (typeId === 4) return m.credit - m.debit;
            // For costs (5) and expenses (6): debit - credit
            if (typeId === 5 || typeId === 6) return -(m.debit - m.credit);
            // For liabilities (2) & equity (3): credit - debit
            if (typeId === 2 || typeId === 3) return m.credit - m.debit;
            // For assets (1): credit - debit
            return m.credit - m.debit;
        };

        const opIncome = getNet(4);
        const opCost = getNet(5);
        const opExpense = getNet(6);
        const operatingFlow = opIncome + opCost + opExpense;

        const investingFlow = getNet(1);
        const financingFlow = getNet(2) + getNet(3);

        const beginBal = parseFloat(beginCash[0]?.balance || 0);
        const endBal = parseFloat(endCash[0]?.balance || 0);
        const netFlow = endBal - beginBal;

        if (req.query.format === 'excel') {
            const rowsForExcel = [
                { actividad: 'ACTIVIDADES DE OPERACIÓN', monto: operatingFlow },
                { actividad: '  Cobros por ventas de bienes y servicios', monto: opIncome },
                { actividad: '  Pagos por costos operativos', monto: opCost },
                { actividad: '  Pagos por gastos de administración y ventas', monto: opExpense },
                { actividad: 'ACTIVIDADES DE INVERSIÓN', monto: investingFlow },
                { actividad: '  Activos no corrientes / equipamiento', monto: investingFlow },
                { actividad: 'ACTIVIDADES DE FINANCIAMIENTO', monto: financingFlow },
                { actividad: '  Pasivos financieros y aportes patrimoniales', monto: financingFlow },
                { actividad: 'RESUMEN DE EFECTIVO', monto: 0 },
                { actividad: '  Saldo inicial de efectivo y equivalentes', monto: beginBal },
                { actividad: '  Variación neta del período', monto: netFlow },
                { actividad: '  Saldo final de efectivo y equivalentes', monto: endBal }
            ];
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Actividad / Concepto', key: 'actividad', width: 45 },
                { header: 'Monto ($)', key: 'monto', width: 16 }
            ], `Flujo_Efectivo_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Estado de Flujos de Efectivo', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;

            const renderSec = (title, amount) => {
                const curY = doc.y;
                doc.rect(startX, curY - 2, contentWidth, 14).fill('#f1f5f9');
                doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.text(title, startX + 6, curY);
                doc.text(fmt(amount), startX + contentWidth - 130, curY, { align: 'right', width: 125 });
                doc.y = curY + 15;
            };

            const renderSub = (label, amount) => {
                const curY = doc.y;
                doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
                doc.text(`    ${label}`, startX + 6, curY);
                doc.text(fmt(amount), startX + contentWidth - 130, curY, { align: 'right', width: 125 });
                doc.y = curY + 12;
            };

            renderSec('ACTIVIDADES DE OPERACIÓN', operatingFlow);
            renderSub('Cobros por venta de bienes y prestación de servicios', opIncome);
            renderSub('Pagos a proveedores y costos de operación', opCost);
            renderSub('Pagos por gastos operacionales y administrativos', opExpense);
            doc.y += 8;

            renderSec('ACTIVIDADES DE INVERSIÓN', investingFlow);
            renderSub('Adquisición de activos fijos / no corrientes', investingFlow);
            doc.y += 8;

            renderSec('ACTIVIDADES DE FINANCIAMIENTO', financingFlow);
            renderSub('Financiamiento por pasivos y recursos patrimoniales', financingFlow);
            doc.y += 8;

            renderSec('RESUMEN DE FLUJO DE EFECTIVO', 0);
            renderSub('Saldo inicial de efectivo y equivalentes', beginBal);
            renderSub('Aumento / Disminución neta del efectivo', netFlow);
            renderSub('Saldo final de efectivo y equivalentes', endBal);
            doc.y += 15;

            renderClosingFooter(doc, startX, doc.y, 3, 'Actividades');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getFlujoEfectivo Error]:', e);
        res.status(500).json({ message: e.message });
    }
};

// =============================================================================
// 13. CÉDULA DE AUDITORÍA
// =============================================================================

const getCedulaAuditoria = async (req, res) => {
    try {
        const { start_date, end_date, account_id } = req.query;
        if (!account_id || account_id === 'all') {
            return res.status(400).json({ message: 'Debe seleccionar una cuenta contable a auditar' });
        }
        if (!start_date || !end_date) {
            return res.status(400).json({ message: 'Rango de fechas requerido' });
        }

        const company = await getCompanyInfo(req.company_id);
        const signatures = await getSignatures(req.company_id);
        const periodText = `DEL ${formatDate(start_date)} AL ${formatDate(end_date)}`;

        const [[account]] = await pool.query(`
            SELECT a.*, t.name as type_name, t.nature
            FROM chart_of_accounts a
            JOIN account_types t ON a.account_type_id = t.id
            WHERE a.id = ? AND a.company_id = ?
        `, [account_id, req.company_id]);

        if (!account) {
            return res.status(404).json({ message: 'Cuenta contable no encontrada' });
        }

        // Opening balance
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

        // Transactions
        const [movements] = await pool.query(`
            SELECT e.date, e.number as num_correl, e.description as entry_desc,
                   et.name as entry_type_name,
                   l.description as line_desc, l.debit, l.credit
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            LEFT JOIN entry_types et ON e.entry_type_id = et.id
            WHERE l.account_id = ? AND e.company_id = ? AND e.status = 'posted' AND e.date BETWEEN ? AND ?
            ORDER BY e.date ASC, e.number ASC, l.id ASC
        `, [account_id, req.company_id, start_date, end_date]);

        const initBal = parseFloat(opening?.balance || 0);
        let runningBal = initBal;
        let totDebits = 0;
        let totCredits = 0;

        const movs = movements.map(m => {
            const deb = parseFloat(m.debit || 0);
            const cred = parseFloat(m.credit || 0);
            totDebits += deb;
            totCredits += cred;
            const net = account.nature === 'debit' ? (deb - cred) : (cred - deb);
            runningBal += net;
            return {
                fecha: formatDate(m.date),
                corr: m.num_correl || 'S/N',
                tipo: m.entry_type_name || 'DIARIO',
                concepto: m.line_desc || m.entry_desc || '',
                debit: deb,
                credit: cred,
                saldo: runningBal
            };
        });

        const saldoLibros = runningBal;

        if (req.query.format === 'excel') {
            const rowsForExcel = movs.map(m => ({
                fecha: m.fecha,
                partida: m.corr,
                tipo: m.tipo,
                concepto: m.concepto,
                debito: m.debit,
                credito: m.credit,
                saldo: m.saldo
            }));
            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Partida', key: 'partida', width: 14 },
                { header: 'Tipo', key: 'tipo', width: 16 },
                { header: 'Concepto', key: 'concepto', width: 35 },
                { header: 'Débito', key: 'debito', width: 14 },
                { header: 'Crédito', key: 'credito', width: 14 },
                { header: 'Saldo Según Libros', key: 'saldo', width: 18 }
            ], `Cedula_Auditoria_${account.code}_${periodText.replace(/[/\\?*[]:]/g, '_')}.xlsx`);
        }

        buildPDF(res, 'portrait', (doc) => {
            renderHeader(doc, company, 'Cédula de Auditoría Contable', periodText, 'portrait');

            const startX = 30;
            const contentWidth = 552;
            const colW = { fecha: 55, num: 55, desc: 242, debit: 65, credit: 65, saldo: 70 };

            // Account Header Box
            doc.rect(startX, doc.y + 4, contentWidth, 24).fill('#e2e8f0');
            doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`CUENTA AUDITADA: ${account.code} - ${account.name}`, startX + 6, doc.y + 8);
            doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
            doc.text(`NATURALEZA: ${account.nature === 'debit' ? 'Deudora' : 'Acreedora'}    |    SALDO INICIAL: ${fmt(initBal)}`, startX + 6, doc.y + 19);
            doc.y += 34;

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text('FECHA', x, yPos + 3); x += colW.fecha;
                doc.text('PARTIDA', x, yPos + 3); x += colW.num;
                doc.text('CONCEPTO DE LA TRANSACCIÓN', x, yPos + 3); x += colW.desc;
                doc.text('DÉBITO', x, yPos + 3, { align: 'right', width: colW.debit - 4 }); x += colW.debit;
                doc.text('CRÉDITO', x, yPos + 3, { align: 'right', width: colW.credit - 4 }); x += colW.credit;
                doc.text('SALDO', x, yPos + 3, { align: 'right', width: colW.saldo - 6 });
                return yPos + 16;
            };

            let y = drawTableHeader(doc.y + 2);

            for (const m of movs) {
                if (y > 670) {
                    doc.addPage();
                    renderHeader(doc, company, 'Cédula de Auditoría Contable', periodText, 'portrait');
                    y = drawTableHeader(doc.y + 4);
                }
                doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
                let x = startX + 4;
                doc.text(m.fecha, x, y, { width: colW.fecha }); x += colW.fecha;
                doc.text(m.corr, x, y, { width: colW.num }); x += colW.num;
                doc.text(m.concepto.substring(0, 42), x, y, { width: colW.desc - 6 }); x += colW.desc;
                doc.text(fmt(m.debit), x, y, { align: 'right', width: colW.debit - 4 }); x += colW.debit;
                doc.text(fmt(m.credit), x, y, { align: 'right', width: colW.credit - 4 }); x += colW.credit;
                doc.text(fmt(m.saldo), x, y, { align: 'right', width: colW.saldo - 6 });
                y += 11;
            }

            // Summary Section of Audit
            if (y > 640) {
                doc.addPage();
                renderHeader(doc, company, 'Cédula de Auditoría Contable', periodText, 'portrait');
                y = doc.y + 10;
            }
            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            y += 6;
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`SALDO SEGÚN LIBROS CONTABLES:`, startX + 4, y);
            doc.text(fmt(saldoLibros), startX + contentWidth - 140, y, { align: 'right', width: 135 });
            y += 12;
            doc.text(`(+) AJUSTES DÉBITO AUDITORÍA:`, startX + 4, y);
            doc.text(fmt(0), startX + contentWidth - 140, y, { align: 'right', width: 135 });
            y += 12;
            doc.text(`(-) AJUSTES CRÉDITO AUDITORÍA:`, startX + 4, y);
            doc.text(fmt(0), startX + contentWidth - 140, y, { align: 'right', width: 135 });
            y += 12;
            doc.text(`(=) SALDO AUDITADO:`, startX + 4, y);
            doc.text(fmt(saldoLibros), startX + contentWidth - 140, y, { align: 'right', width: 135 });
            y += 18;

            renderClosingFooter(doc, startX, y, movs.length, 'Movimientos');
            renderSignatures(doc, signatures, company, 'portrait');
            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getCedulaAuditoria Error]:', e);
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

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    getLibroDiario,
    getLibroDiarioMayor,
    getLibroMayor,
    getBalanceComprobacion,
    getBalanceGeneral,
    getAnexoBalance,
    getBalanceComparativo,
    getEstadoResultados,
    getAuxiliarOperaciones,
    getListadoPartidas,
    getCambiosPatrimonio,
    getFlujoEfectivo,
    getCedulaAuditoria,
    getRetenciones
};
