const fs = require('fs');
const path = require('path');
const reportPdfHelper = require('../utils/reportPdfHelper');

const TUTORIALS_PUBLIC_DIR = path.resolve(__dirname, '../../../client/public/tutorials');
const TUTORIALS_DIST_DIR = path.resolve(__dirname, '../../../client/dist/tutorials');

function resolveSafeScreenshotPath(imageFilename) {
    if (!imageFilename) return null;
    const cleanName = path.basename(String(imageFilename).trim());
    for (const baseDir of [TUTORIALS_PUBLIC_DIR, TUTORIALS_DIST_DIR]) {
        const fullPath = path.resolve(baseDir, cleanName);
        if (!fullPath.startsWith(baseDir + path.sep) && fullPath !== baseDir) continue;
        if (fs.existsSync(fullPath)) return fullPath;
    }
    return null;
}

function drawAnnotatedImage(doc, imagePath, annotations = []) {
    const imgWidth = 510;
    const imgHeight = Math.round(imgWidth * (880 / 1480)); // ~303pt
    if (doc.y + imgHeight + 18 > 725) {
        doc.addPage();
    }

    const startX = (612 - imgWidth) / 2;
    const startY = doc.y;

    doc.save();
    doc.roundedRect(startX - 1, startY - 1, imgWidth + 2, imgHeight + 2, 4).lineWidth(0.75).stroke('#cbd5e1');
    try {
        doc.image(imagePath, startX, startY, { width: imgWidth, height: imgHeight });
    } catch (e) {
        doc.rect(startX, startY, imgWidth, imgHeight).fill('#f8fafc');
        doc.fontSize(9).fillColor('#64748b').text(`Captura no disponible (${e.message})`, startX + 20, startY + 130);
    }

    // Superponer cajas y pines numerados sobre las coordenadas porcentuales reales
    for (const ann of (Array.isArray(annotations) ? annotations : [])) {
        const ax = startX + ((Number(ann.x) || 0) / 100) * imgWidth;
        const ay = startY + ((Number(ann.y) || 0) / 100) * imgHeight;
        const aw = ((Number(ann.w) || 8) / 100) * imgWidth;
        const ah = ((Number(ann.h) || 5) / 100) * imgHeight;

        doc.save();
        doc.roundedRect(ax, ay, aw, ah, 3).lineWidth(1.5).strokeColor('#e11d48').stroke();
        const badgeX = Math.max(startX + 10, Math.min(startX + imgWidth - 10, ax + 2));
        const badgeY = Math.max(startY + 10, ay - 2);
        doc.circle(badgeX, badgeY, 8.5).fill('#e11d48');
        doc.circle(badgeX, badgeY, 8.5).lineWidth(1).strokeColor('#ffffff').stroke();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
            .text(String(ann.n || ''), badgeX - 6, badgeY - 4, { width: 12, align: 'center' });
        doc.restore();
    }
    doc.restore();

    doc.y = startY + imgHeight + 8;
}

function renderTutorialContent(doc, tutorial) {
    const pageWidth = 552;
    const startX = 30;

    // Banda de título del tutorial
    doc.save();
    doc.roundedRect(startX, doc.y, pageWidth, 44, 6).fill('#eef2ff');
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e1b4b')
        .text(`${tutorial.order || ''}. ${tutorial.title}`.trim(), startX + 12, doc.y + 8, { width: pageWidth - 24 });
    const rolesTxt = Array.isArray(tutorial.roles) ? tutorial.roles.join(', ') : '';
    doc.fontSize(8).font('Helvetica').fillColor('#4338ca')
        .text(`Área: ${tutorial.categoryLabel}   |   Roles: ${rolesTxt}   |   Ruta: ${tutorial.modulePath}`, startX + 12, doc.y + 2, { width: pageWidth - 24 });
    doc.restore();
    doc.y += 14;

    if (tutorial.summary) {
        doc.fontSize(9).font('Helvetica').fillColor('#334155').text(tutorial.summary, startX, doc.y, { width: pageWidth });
        doc.moveDown(0.5);
    }

    if (Array.isArray(tutorial.prerequisites) && tutorial.prerequisites.length > 0) {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('Requisitos previos:', startX, doc.y);
        for (const reqText of tutorial.prerequisites) {
            doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`• ${reqText}`, startX + 8, doc.y, { width: pageWidth - 10 });
        }
        doc.moveDown(0.5);
    }

    // Pasos con captura real + anotaciones
    for (const [idx, step] of (Array.isArray(tutorial.steps) ? tutorial.steps : []).entries()) {
        if (doc.y > 620) doc.addPage();

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a')
            .text(`Paso ${idx + 1}: ${step.title}`, startX, doc.y, { width: pageWidth });
        doc.moveDown(0.2);

        if (step.description) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#334155')
                .text(step.description, startX, doc.y, { width: pageWidth });
            doc.moveDown(0.4);
        }

        const imgPath = resolveSafeScreenshotPath(step.image);
        if (imgPath) {
            drawAnnotatedImage(doc, imgPath, step.annotations);
        }

        if (Array.isArray(step.annotations) && step.annotations.length > 0) {
            for (const ann of step.annotations) {
                if (doc.y > 720) doc.addPage();
                doc.fontSize(8).font('Helvetica-Bold').fillColor('#be123c')
                    .text(`[${ann.n}] `, startX + 6, doc.y, { continued: true });
                doc.font('Helvetica').fillColor('#1e293b')
                    .text(ann.label || '', { width: pageWidth - 20 });
            }
            doc.moveDown(0.3);
        }

        if (step.tip) {
            if (doc.y > 710) doc.addPage();
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#047857')
                .text(`Consejo práctico: `, startX + 4, doc.y, { continued: true });
            doc.font('Helvetica').fillColor('#065f46').text(step.tip, { width: pageWidth - 10 });
            doc.moveDown(0.5);
        }
    }

    if (Array.isArray(tutorial.troubleshooting) && tutorial.troubleshooting.length > 0) {
        if (doc.y > 670) doc.addPage();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#9a3412').text('Solución de inconvenientes frecuentes:', startX, doc.y);
        doc.moveDown(0.2);
        for (const item of tutorial.troubleshooting) {
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(`• ${item.issue}: `, startX + 6, doc.y, { continued: true });
            doc.font('Helvetica').fillColor('#334155').text(item.fix, { width: pageWidth - 14 });
        }
    }
}

async function generateTutorialPdfBuffer(tutorial, company) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const bufPromise = getBuffer();
    reportPdfHelper.renderHeader(
        doc,
        company,
        `MANUAL OPERATIVO: ${tutorial.title}`,
        `GUÍA PASO A PASO — ${tutorial.categoryLabel}`,
        'portrait'
    );
    renderTutorialContent(doc, tutorial);
    reportPdfHelper.renderPageNumbers(doc);
    doc.end();
    return bufPromise;
}

async function generateTutorialPackPdfBuffer(tutorials, title, subtitle, company) {
    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('portrait');
    const bufPromise = getBuffer();
    reportPdfHelper.renderHeader(doc, company, title, subtitle, 'portrait');

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text('Contenido del Manual', 30, doc.y);
    doc.moveDown(0.3);
    tutorials.forEach((tut, idx) => {
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#4338ca')
            .text(`${idx + 1}. ${tut.title}`, 36, doc.y, { continued: true });
        doc.font('Helvetica').fillColor('#64748b').text(` (${tut.categoryLabel} — ${tut.duration})`);
    });

    tutorials.forEach((tut) => {
        doc.addPage();
        renderTutorialContent(doc, tut);
    });

    reportPdfHelper.renderPageNumbers(doc);
    doc.end();
    return bufPromise;
}

module.exports = {
    generateTutorialPdfBuffer,
    generateTutorialPackPdfBuffer
};
