const pool = require('../../config/db');
const {
    getCompanyInfo,
    formatDate,
    fmt,
    renderHeader,
    renderPageNumbers,
    buildPDF,
    buildExcelResponse
} = require('./accountingReportUtils');
const { buildMayorizedRows } = require('../../services/accounting/accountingEntriesPrint.service');

const getImpresionPartidas = async (req, res) => {
    try {
        const entry_id = req.query?.entry_id || req.params?.id;
        const { start_date, end_date, entry_type_id, mode = 'normal' } = req.query || {};

        if (!entry_id && (!start_date || !end_date)) {
            return res.status(400).json({ message: 'Rango de fechas o ID de partida requerido' });
        }

        const isMayorizada = mode === 'mayorizada';
        const company = await getCompanyInfo(req.company_id);

        let query = `
            SELECT e.id as entry_id, e.date, e.number, e.description as entry_desc,
                   et.id as entry_type_id, et.name as entry_type_name,
                   b.nombre as branch_name,
                   COALESCE(u.nombre, u.username, 'Sistema') as created_by_name,
                   l.id as line_id, l.account_id, a.code as account_code, a.name as account_name,
                   l.description as line_desc, l.debit, l.credit
            FROM accounting_entries e
            JOIN accounting_entry_lines l ON e.id = l.entry_id
            JOIN chart_of_accounts a ON l.account_id = a.id
            LEFT JOIN entry_types et ON e.entry_type_id = et.id
            LEFT JOIN branches b ON e.branch_id = b.id
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.company_id = ?
        `;
        const params = [req.company_id];

        if (entry_id) {
            query += ' AND e.id = ?';
            params.push(entry_id);
        } else {
            query += " AND e.status = 'posted' AND e.date BETWEEN ? AND ?";
            params.push(start_date, end_date);
            if (entry_type_id && entry_type_id !== 'all' && entry_type_id !== 'TODAS') {
                query += ' AND e.entry_type_id = ?';
                params.push(entry_type_id);
            }
        }
        query += ' ORDER BY e.date ASC, e.number ASC, e.id ASC, l.id ASC';

        const [rows] = await pool.query(query, params);

        let accMap = new Map();
        if (isMayorizada) {
            const [accounts] = await pool.query(
                'SELECT code, name FROM chart_of_accounts WHERE company_id = ?',
                [req.company_id]
            );
            accounts.forEach(a => accMap.set(a.code, a.name));
        }

        const entriesMap = new Map();
        for (const r of rows) {
            const eid = r.entry_id;
            if (!entriesMap.has(eid)) {
                entriesMap.set(eid, {
                    id: eid,
                    number: r.number || 'S/N',
                    date: formatDate(r.date),
                    entry_type: r.entry_type_name || 'DIARIO',
                    branch: r.branch_name || '',
                    description: r.entry_desc || '',
                    created_by: r.created_by_name || 'Sistema',
                    rawLines: [],
                    displayRows: [],
                    totalDebit: 0,
                    totalCredit: 0
                });
            }
            const d = parseFloat(r.debit || 0);
            const c = parseFloat(r.credit || 0);
            const entry = entriesMap.get(eid);
            entry.totalDebit += d;
            entry.totalCredit += c;
            entry.rawLines.push({
                code: r.account_code,
                name: r.account_name,
                description: r.line_desc || r.entry_desc || '',
                debit: d,
                credit: c
            });
        }

        for (const entry of entriesMap.values()) {
            if (isMayorizada) {
                const debits = entry.rawLines.filter(l => l.debit > 0);
                const credits = entry.rawLines.filter(l => l.credit > 0);
                entry.displayRows = [
                    ...buildMayorizedRows(debits, true, accMap),
                    ...buildMayorizedRows(credits, false, accMap)
                ];
            } else {
                entry.displayRows = entry.rawLines.map(l => ({
                    code: l.code,
                    name: l.name,
                    concept: l.description,
                    parcial: null,
                    cargo: l.debit > 0 ? l.debit : null,
                    abono: l.credit > 0 ? l.credit : null
                }));
            }
        }

        const entries = Array.from(entriesMap.values());
        const modeLabel = isMayorizada ? 'Mayorizada' : 'Normal';
        const periodText = entry_id && entries[0]
            ? `PARTIDA No. ${entries[0].number} (${formatDate(entries[0].date)})`
            : `DEL ${formatDate(start_date)} AL ${formatDate(end_date)}`;

        if (req.query.format === 'excel') {
            const rowsForExcel = [];
            for (const ent of entries) {
                for (const r of ent.displayRows) {
                    rowsForExcel.push({
                        partida: ent.number,
                        fecha: ent.date,
                        tipo: ent.entry_type,
                        sucursal: ent.branch,
                        cuenta_ref: r.code,
                        nombre_cuenta: r.name,
                        concepto: r.concept,
                        parciales: r.parcial,
                        cargos: r.cargo,
                        abonos: r.abono,
                        elaborado_por: ent.created_by
                    });
                }
            }
            const excelFileName = entry_id && entries[0]
                ? `Partida_${entries[0].number}_${modeLabel}.xlsx`
                : `Partidas_${modeLabel}_${start_date}_al_${end_date}.xlsx`;

            return buildExcelResponse(res, rowsForExcel, [
                { header: 'Partida', key: 'partida', width: 14 },
                { header: 'Fecha', key: 'fecha', width: 12 },
                { header: 'Tipo', key: 'tipo', width: 18 },
                { header: 'Sucursal', key: 'sucursal', width: 20 },
                { header: 'Cuenta/Ref', key: 'cuenta_ref', width: 15 },
                { header: 'Nombre Cuenta', key: 'nombre_cuenta', width: 32 },
                { header: 'Concepto', key: 'concepto', width: 32 },
                { header: 'Parciales', key: 'parciales', width: 14 },
                { header: 'Cargos', key: 'cargos', width: 14 },
                { header: 'Abonos', key: 'abonos', width: 14 },
                { header: 'Elaboró', key: 'elaborado_por', width: 22 }
            ], excelFileName);
        }

        buildPDF(res, 'portrait', (doc) => {
            const reportTitle = `Impresión de Partidas Contables (${modeLabel.toUpperCase()})`;
            const startX = 30;
            const contentWidth = 552;
            const colW = isMayorizada
                ? { code: 65, name: 165, desc: 142, parcial: 60, cargo: 60, abono: 60 }
                : { code: 75, name: 175, desc: 142, parcial: 0, cargo: 80, abono: 80 };

            const drawTableHeader = (yPos) => {
                doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                doc.rect(startX, yPos, contentWidth, 13).fill('#f1f5f9');
                doc.fillColor('#0f172a');
                let x = startX + 4;
                doc.text(isMayorizada ? 'CUENTA/REF' : 'CÓDIGO', x, yPos + 3, { width: colW.code, lineBreak: false }); x += colW.code;
                doc.text(isMayorizada ? 'NOMBRE CUENTA' : 'CUENTA', x, yPos + 3, { width: colW.name, lineBreak: false }); x += colW.name;
                doc.text('CONCEPTO', x, yPos + 3, { width: colW.desc, lineBreak: false }); x += colW.desc;
                if (isMayorizada) {
                    doc.text('PARCIALES', x, yPos + 3, { align: 'right', width: colW.parcial - 6, lineBreak: false }); x += colW.parcial;
                    doc.text('CARGOS', x, yPos + 3, { align: 'right', width: colW.cargo - 6, lineBreak: false }); x += colW.cargo;
                    doc.text('ABONOS', x, yPos + 3, { align: 'right', width: colW.abono - 6, lineBreak: false });
                } else {
                    doc.text('DEBE', x, yPos + 3, { align: 'right', width: colW.cargo - 6, lineBreak: false }); x += colW.cargo;
                    doc.text('HABER', x, yPos + 3, { align: 'right', width: colW.abono - 6, lineBreak: false });
                }
                return yPos + 16;
            };

            if (entries.length === 0) {
                renderHeader(doc, company, reportTitle, periodText, 'portrait');
                doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
                doc.text('No se encontraron partidas contables en el período y filtros seleccionados.', startX, doc.y + 20);
            } else {
                for (let idx = 0; idx < entries.length; idx++) {
                    const ent = entries[idx];
                    if (idx > 0) doc.addPage();
                    renderHeader(doc, company, reportTitle, periodText, 'portrait');

                    let y = doc.y + 4;
                    doc.rect(startX, y, contentWidth, 15).fill('#e2e8f0');
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
                    doc.text(`PARTIDA: ${ent.number}`, startX + 4, y + 3, { lineBreak: false });
                    doc.text(`FECHA: ${ent.date}`, startX + 130, y + 3, { lineBreak: false });
                    doc.text(`TIPO: ${ent.entry_type}`, startX + 225, y + 3, { lineBreak: false });
                    if (ent.branch) {
                        doc.fontSize(7).font('Helvetica').fillColor('#475569');
                        doc.text(`[${ent.branch}]`, startX + 380, y + 3, { width: 165, align: 'right', lineBreak: false });
                    }
                    y += 17;

                    if (ent.description) {
                        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#334155');
                        const conceptText = `Concepto General: ${ent.description}`;
                        const conceptH = doc.heightOfString(conceptText, { width: contentWidth - 8 });
                        doc.text(conceptText, startX + 4, y, { width: contentWidth - 8 });
                        y += conceptH + 4;
                    }

                    y = drawTableHeader(y + 2);

                    const TABLE_FONT_SIZE = 7;
                    for (const r of ent.displayRows) {
                        const nameText = r.name || '';
                        const descText = (r.concept || '').trim();
                        const isBoldRow = isMayorizada && r.parcial === null && (r.cargo !== null || r.abono !== null);
                        const rowFont = isBoldRow ? 'Helvetica-Bold' : 'Helvetica';

                        doc.fontSize(TABLE_FONT_SIZE).font(rowFont);
                        const nameH = nameText ? doc.heightOfString(nameText, { width: colW.name - 6 }) : 8;
                        const descH = descText ? doc.heightOfString(descText, { width: colW.desc - 6 }) : 8;
                        const rowH = Math.max(9.5, Math.max(nameH, descH));

                        if (y + rowH > 600) {
                            doc.addPage();
                            renderHeader(doc, company, reportTitle, periodText, 'portrait');
                            y = drawTableHeader(doc.y + 4);
                        }

                        doc.fontSize(TABLE_FONT_SIZE).font(rowFont).fillColor('#1e293b');
                        let lx = startX + 4;
                        doc.text(r.code, lx, y, { width: colW.code, lineBreak: false }); lx += colW.code;
                        doc.text(nameText, lx, y, { width: colW.name - 6 }); lx += colW.name;
                        doc.text(descText, lx, y, { width: colW.desc - 6 }); lx += colW.desc;
                        if (isMayorizada) {
                            doc.text(r.parcial ? fmt(r.parcial) : '', lx, y, { align: 'right', width: colW.parcial - 6, lineBreak: false }); lx += colW.parcial;
                            doc.text(r.cargo ? fmt(r.cargo) : '', lx, y, { align: 'right', width: colW.cargo - 6, lineBreak: false }); lx += colW.cargo;
                            doc.text(r.abono ? fmt(r.abono) : '', lx, y, { align: 'right', width: colW.abono - 6, lineBreak: false });
                        } else {
                            doc.text(r.cargo ? fmt(r.cargo) : '', lx, y, { align: 'right', width: colW.cargo - 6, lineBreak: false }); lx += colW.cargo;
                            doc.text(r.abono ? fmt(r.abono) : '', lx, y, { align: 'right', width: colW.abono - 6, lineBreak: false });
                        }
                        y += rowH + 3.5;
                    }

                    // Totales row
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                    y += 3;
                    doc.rect(startX, y, contentWidth, 14).fill('#f8fafc');
                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
                    const totLabel = isMayorizada ? 'TOTALES:' : `TOTAL PARTIDA ${ent.number}:`;
                    doc.text(totLabel, startX + 6, y + 3.5, { lineBreak: false });
                    const totX = isMayorizada
                        ? startX + colW.code + colW.name + colW.desc + colW.parcial
                        : startX + colW.code + colW.name + colW.desc;
                    doc.text(fmt(ent.totalDebit), totX, y + 3.5, { align: 'right', width: colW.cargo - 6, lineBreak: false });
                    doc.text(fmt(ent.totalCredit), totX + colW.cargo, y + 3.5, { align: 'right', width: colW.abono - 6, lineBreak: false });
                    y += 18;

                    // Voucher Signatures - ALWAYS fixed at bottom of page
                    if (y > 615) {
                        doc.addPage();
                        renderHeader(doc, company, reportTitle, periodText, 'portrait');
                    }
                    const sigLineY = 690;
                    doc.strokeColor('#64748b').lineWidth(0.75);
                    doc.moveTo(startX + 15, sigLineY).lineTo(startX + 165, sigLineY).stroke();
                    doc.moveTo(startX + 195, sigLineY).lineTo(startX + 345, sigLineY).stroke();
                    doc.moveTo(startX + 375, sigLineY).lineTo(startX + 525, sigLineY).stroke();

                    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b');
                    const hechoPorText = `HECHO POR: ${(ent.created_by || '').toUpperCase()}`;
                    doc.text(hechoPorText.substring(0, 32), startX + 15, sigLineY + 5, { width: 150, align: 'center', lineBreak: false });
                    doc.text('REVISADO POR', startX + 195, sigLineY + 5, { width: 150, align: 'center', lineBreak: false });
                    doc.text('AUTORIZADO POR', startX + 375, sigLineY + 5, { width: 150, align: 'center', lineBreak: false });

                    doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
                    doc.text('Firma y Sello', startX + 15, sigLineY + 16, { width: 150, align: 'center', lineBreak: false });
                    doc.text('Firma y Sello', startX + 195, sigLineY + 16, { width: 150, align: 'center', lineBreak: false });
                    doc.text('Firma y Sello', startX + 375, sigLineY + 16, { width: 150, align: 'center', lineBreak: false });
                }
            }

            renderPageNumbers(doc);
            doc.end();
        });
    } catch (e) {
        console.error('[getImpresionPartidas Error]:', e);
        res.status(500).json({ message: e.message });
    }
};

module.exports = {
    getImpresionPartidas
};
