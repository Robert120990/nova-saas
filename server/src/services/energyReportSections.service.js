const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const ANDELSA_INVERTERS = [
    ['I01', 'Growatt MAC 60KTL3-X MV', 'QHEUD6800D', '60,000 W (60 kW)', '150 paneles', 'ACTIVO / EN LÍNEA', '173,544.1 kWh'],
    ['Inversor 2 (ex I02)', 'Growatt MAC 50KTL3-X MV', 'QGEUD4600G', '50,000 W (50 kW)', '125 paneles', 'ACTIVO / EN LÍNEA', '33,502.8 kWh'],
    ['I03', 'Growatt MAC 60KTL3-X MV', 'QHESD47008', '60,000 W (60 kW)', '150 paneles', 'ACTIVO / EN LÍNEA', '134,054.6 kWh'],
    ['I04', 'Growatt MAC 60KTL3-X MV', 'QHEUD6800L', '60,000 W (60 kW)', '150 paneles', 'ACTIVO / EN LÍNEA', '186,159.2 kWh'],
    ['I05 (Inversor 5)', 'Growatt MAC 70KTL3-X MV', 'MXKDD5M00U', '70,000 W (70 kW)', '175 paneles', 'APAGADO (Desde 19/06)', '380,904.1 kWh'],
    ['Campo Solar GESS', '3 Controladores MPPT PMDE1', 'BR0322000282', '117,000 W (117 kWp)', '293 paneles', 'ACTIVO (Carga BESS)', '315,883.5 kWh']
];

function getElSalvadorNow() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/El_Salvador',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value || '';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    return { year, month: `${year}-${month}`, date: `${year}-${month}-${day}` };
}

function renderSectionBanner(doc, startX, contentW, titleText) {
    const y = doc.y;
    doc.rect(startX, y, contentW, 14).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(7.5)
        .text(titleText, startX + 6, y + 3.5, { width: contentW - 12, lineBreak: false });
    doc.strokeColor('#cbd5e1').lineWidth(0.5)
        .moveTo(startX, y + 14).lineTo(startX + contentW, y + 14).stroke();
    doc.y = y + 17;
}

function renderKpiRows(doc, startX, contentW, kpiRows) {
    for (let i = 0; i < kpiRows.length; i++) {
        const [lbl1, val1, lbl2, val2] = kpiRows[i];
        const rowY = doc.y;
        const isTotal = i === kpiRows.length - 1;
        if (isTotal) {
            doc.rect(startX, rowY - 1, contentW, 14).fill('#eef2ff');
        } else if (i % 2 === 1) {
            doc.rect(startX, rowY - 1, contentW, 13).fill('#f8fafc');
        }
        doc.fillColor('#334155').font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.8)
            .text(lbl1, startX + 4, rowY + 2, { width: 162, lineBreak: false });
        doc.fillColor(isTotal ? '#1e3a8a' : '#0f172a').font('Helvetica-Bold').fontSize(6.8)
            .text(val1, startX + 168, rowY + 2, { width: 108, align: 'right', lineBreak: false });
        doc.fillColor('#334155').font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(6.8)
            .text(lbl2, startX + 288, rowY + 2, { width: 155, lineBreak: false });
        doc.fillColor(isTotal ? '#047857' : '#0f172a').font('Helvetica-Bold').fontSize(6.8)
            .text(val2, startX + 445, rowY + 2, { width: 103, align: 'right', lineBreak: false });
        doc.y = rowY + (isTotal ? 15 : 13);
    }
}

function renderTableHeader(doc, startX, contentW, cols) {
    const hy = doc.y;
    doc.rect(startX, hy, contentW, 13).fill('#e2e8f0');
    for (const c of cols) {
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(6.5)
            .text(c.label, c.x, hy + 3, { width: c.w, align: c.align, lineBreak: false });
    }
    doc.y = hy + 14;
}

function renderAndelsaInvertersSection(doc, startX, contentW, periodLabel, impactedSolarKwh, solarRate = 0.17) {
    doc.y += 5;
    renderSectionBanner(
        doc,
        startX,
        contentW,
        '2. ESTADO DE INVERSORES GROWATT Y CAPACIDAD EN PANELES DE 400 W (IMPACTO INVERSOR APAGADO)'
    );

    const invCols = [
        { label: 'POSICIÓN / ALIAS', x: startX + 4, w: 72, align: 'left' },
        { label: 'MODELO DE EQUIPO', x: startX + 78, w: 95, align: 'left' },
        { label: 'SERIE (SN)', x: startX + 175, w: 68, align: 'left' },
        { label: 'POTENCIA (W / kW)', x: startX + 245, w: 72, align: 'right' },
        { label: 'PANELES (400W)', x: startX + 320, w: 62, align: 'right' },
        { label: 'ESTADO OPERATIVO', x: startX + 388, w: 92, align: 'left' },
        { label: 'GEN. HISTÓRICA', x: startX + 482, w: 66, align: 'right' }
    ];

    renderTableHeader(doc, startX, contentW, invCols);

    for (let i = 0; i < ANDELSA_INVERTERS.length; i++) {
        const row = ANDELSA_INVERTERS[i];
        const ry = doc.y;
        const isOff = row[5].includes('APAGADO');
        if (isOff) {
            doc.rect(startX, ry - 1, contentW, 12).fill('#fef2f2');
        } else if (i % 2 === 1) {
            doc.rect(startX, ry - 1, contentW, 12).fill('#f8fafc');
        }
        for (let cIdx = 0; cIdx < invCols.length; cIdx++) {
            const col = invCols[cIdx];
            doc.fillColor(isOff ? '#991b1b' : '#1e293b')
                .font(cIdx === 0 || isOff ? 'Helvetica-Bold' : 'Helvetica')
                .fontSize(6.5)
                .text(row[cIdx], col.x, ry + 2, { width: col.w, align: col.align, lineBreak: false });
        }
        doc.y = ry + 12;
    }

    const estMissedKwh = Math.round((Number(impactedSolarKwh) || 0) * (70 / 230));
    const estMissedUsd = (estMissedKwh * solarRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const noteY = doc.y + 2;
    doc.rect(startX, noteY, contentW, 17).fill('#fffbeb');
    doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(6.4)
        .text('NOTA TÉCNICA — IMPACTO INVERSOR I05 APAGADO (70 kW / 175 PANELES DE 400 W): ', startX + 5, noteY + 4, {
            width: contentW - 10,
            continued: true
        })
        .font('Helvetica')
        .text(`En ${periodLabel}, de haber operado I05 (+30.4% sobre los 230 kW activos), se estiman ~${estMissedKwh.toLocaleString('en-US')} kWh adicionales (~$ ${estMissedUsd} extra de ahorro).`);
    doc.y = noteY + 21;
}

module.exports = {
    MONTH_NAMES,
    getElSalvadorNow,
    renderSectionBanner,
    renderKpiRows,
    renderTableHeader,
    renderAndelsaInvertersSection
};
