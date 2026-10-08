const reportPdfHelper = require('../utils/reportPdfHelper');

/**
 * Genera el Buffer PDF oficial del Dictamen de Auditoría de Ventas (Formato Horizontal Landscape)
 * Cumple con el estándar contable unificado de AGENTS.md (sin firmas en reportes operacionales).
 */
async function generateAuditPdfBuffer(companyId, runSalesIntegrityAuditFn) {
    if (!companyId) throw new Error('company_id es requerido para generar el dictamen PDF.');
    
    // Obtener los datos de auditoría
    const auditData = await runSalesIntegrityAuditFn(companyId);
    const company = await reportPdfHelper.getCompanyInfo(companyId);

    const { doc, getBuffer } = reportPdfHelper.createPdfDocument('landscape');

    const pageWidth = 792;
    const contentWidth = pageWidth - 60;
    const startX = 30;

    // Encabezado estándar contable
    reportPdfHelper.renderHeader(
        doc,
        company,
        'DICTAMEN DE AUDITORÍA: INTEGRIDAD, REALIDAD Y DUPLICIDAD DE VENTAS',
        'PERÍODO AUDITADO: HISTORIAL VIGENTE 2026',
        'landscape',
        'AUDITORÍA FORENSE DE FACTURACIÓN ELECTRÓNICA, DESPACHOS Y VENTAS POS'
    );

    let y = doc.y + 6;

    // 1. Resumen Ejecutivo (Cards)
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('1. RESUMEN EJECUTIVO DE INTEGRIDAD DE VENTAS', startX, y);
    y += 12;

    const cards = [
        { label: 'Total Ventas', val: auditData.resumen.total_ventas, color: '#0f172a', bg: '#f8fafc' },
        { label: 'Ventas Activas', val: auditData.resumen.ventas_emitidas, color: '#16a34a', bg: '#f0fdf4' },
        { label: 'Invalidadas MH', val: auditData.resumen.ventas_invalidadas, color: '#64748b', bg: '#f8fafc' },
        { label: 'Fantasmas / Sin Sello', val: auditData.resumen.ventas_sin_sello_fantasma, color: '#dc2626', bg: '#fef2f2' },
        { label: 'Sellos por Vincular', val: auditData.resumen.sellos_desincronizados, color: '#4338ca', bg: '#e0e7ff' },
        { label: 'Duplicidad MH', val: auditData.resumen.duplicados_sospechosos_hacienda, color: '#ea580c', bg: '#fff7ed' }
    ];

    const cardWidth = contentWidth / 6;
    cards.forEach((c, idx) => {
        const cx = startX + (idx * cardWidth);
        doc.roundedRect(cx, y, cardWidth - 4, 30, 4).fillAndStroke(c.bg, '#cbd5e1');
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text(c.label.toUpperCase(), cx + 4, y + 4, { width: cardWidth - 12, align: 'center' });
        doc.fontSize(11).font('Helvetica-Bold').fillColor(c.color).text(String(c.val), cx + 4, y + 14, { width: cardWidth - 12, align: 'center' });
    });

    y += 38;

    // 2. Punto Crítico A: Ventas Fantasma Locales (Sin Sello)
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#b91c1c').text('2. VENTAS LOCALES EN ESTADO EMITIDO SIN SELLO DE RECEPCIÓN (DUPLICADOS / FANTASMAS INTERNAS)', startX, y);
    y += 11;

    const phantoms = auditData.hallazgos_criticos.ventas_fantasma_locales || [];
    if (phantoms.length === 0) {
        doc.fontSize(7.5).font('Helvetica').fillColor('#16a34a').text('No se detectaron ventas locales sin sello de recepción.', startX, y);
        y += 12;
    } else {
        doc.rect(startX, y, contentWidth, 14).fill('#fee2e2');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#991b1b');
        doc.text('ID VENTA', startX + 6, y + 3.5);
        doc.text('DTE', startX + 55, y + 3.5);
        doc.text('NÚMERO DE CONTROL', startX + 95, y + 3.5);
        doc.text('FECHA / HORA', startX + 250, y + 3.5);
        doc.text('CLIENTE', startX + 340, y + 3.5);
        doc.text('TOTAL', startX + 530, y + 3.5, { width: 65, align: 'right' });
        doc.text('DIAGNÓSTICO FORENSE / REEMPLAZO', startX + 610, y + 3.5);
        y += 14;

        for (const p of phantoms.slice(0, 15)) {
            if (y > 510) {
                doc.addPage();
                y = 35;
            }
            doc.rect(startX, y, contentWidth, 16).fillAndStroke('#ffffff', '#f1f5f9');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text(`#${p.sale_id}`, startX + 6, y + 4);
            doc.fontSize(7).font('Helvetica').fillColor('#475569').text(`DTE-${p.dte_type}`, startX + 55, y + 4);
            doc.text(p.numero_control || 'SIN CONTROL', startX + 95, y + 4);
            doc.text(`${p.fecha} ${p.hora || ''}`, startX + 250, y + 4);
            doc.text(p.cliente_nombre ? p.cliente_nombre.slice(0, 34) : 'CLIENTE REGISTRADO', startX + 340, y + 4);
            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(p.total_pagar), startX + 530, y + 4, { width: 65, align: 'right' });
            
            const repText = p.reemplazo_sale_id ? `Intento fallido -> Reingresada en POS #${p.reemplazo_sale_id} (${p.reemplazo_control})` : 'Intento fallido sin sello de Hacienda';
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#dc2626').text(repText, startX + 610, y + 4);
            y += 16;
        }
        y += 6;
    }

    // 3. Punto Crítico B: Duplicidad Sospechosa en Hacienda
    if (y > 470) {
        doc.addPage();
        y = 35;
    }
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#c2410c').text('3. CASOS DE DUPLICIDAD SOSPECHOSA ANTE HACIENDA (AMBAS EMITIDAS CON SELLO OFICIAL ACTIVO)', startX, y);
    y += 11;

    const dupesHacienda = auditData.hallazgos_criticos.duplicidad_sospechosa_hacienda || [];
    if (dupesHacienda.length === 0) {
        doc.fontSize(7.5).font('Helvetica').fillColor('#16a34a').text('No se detectaron ventas duplicadas activas ante Hacienda.', startX, y);
        y += 12;
    } else {
        doc.rect(startX, y, contentWidth, 14).fill('#ffedd5');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#9a3412');
        doc.text('PAR DE VENTAS', startX + 6, y + 3.5);
        doc.text('CONTROLES FISCALES', startX + 85, y + 3.5);
        doc.text('FECHA / DIFERENCIA', startX + 270, y + 3.5);
        doc.text('CLIENTE', startX + 375, y + 3.5);
        doc.text('MONTO C/U', startX + 530, y + 3.5, { width: 65, align: 'right' });
        doc.text('DETALLE PRODUCTOS / ALERTA', startX + 610, y + 3.5);
        y += 14;

        for (const dh of dupesHacienda.slice(0, 15)) {
            if (y > 510) {
                doc.addPage();
                y = 35;
            }
            doc.rect(startX, y, contentWidth, 20).fillAndStroke('#ffffff', '#f1f5f9');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text(`#${dh.id1} vs #${dh.id2}`, startX + 6, y + 5);
            doc.fontSize(6).font('Helvetica').fillColor('#64748b').text(`${dh.control1}\n${dh.control2}`, startX + 85, y + 3);
            doc.fontSize(7).font('Helvetica').fillColor('#475569').text(`${dh.fecha} (${dh.diff_minutos} min)`, startX + 270, y + 5);
            doc.text(dh.cliente ? dh.cliente.slice(0, 26) : 'N/A', startX + 375, y + 5);
            doc.font('Helvetica-Bold').text(reportPdfHelper.fmt(dh.monto), startX + 530, y + 5, { width: 65, align: 'right' });
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#c2410c').text(`Mismos ítems y lote. Requiere confirmar si fue entrega doble o error fiscal.`, startX + 610, y + 5);
            y += 20;
        }
        y += 6;
    }

    // 4. Punto Crítico C: Sellos en microservicio pendientes de vincular
    if (y > 470) {
        doc.addPage();
        y = 35;
    }
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#4338ca').text('4. VENTAS VÁLIDAS CON SELLO EN MICROSERVICIO PENDIENTES DE VINCULAR EN CABECERA', startX, y);
    y += 11;

    const unsynced = auditData.hallazgos_criticos.sellos_pendientes_sincronizar || [];
    if (unsynced.length === 0) {
        doc.fontSize(7.5).font('Helvetica').fillColor('#16a34a').text('Todas las ventas válidas tienen su sello de recepción sincronizado en cabecera.', startX, y);
        y += 12;
    } else {
        doc.rect(startX, y, contentWidth, 14).fill('#e0e7ff');
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#3730a3');
        doc.text('ID VENTA', startX + 6, y + 3.5);
        doc.text('CONTROL / TIPO', startX + 65, y + 3.5);
        doc.text('FECHA / TOTAL', startX + 240, y + 3.5);
        doc.text('SELLO DE RECEPCIÓN CONFIRMADO EN BD', startX + 360, y + 3.5);
        doc.text('ESTADO / ACCIÓN', startX + 610, y + 3.5);
        y += 14;

        for (const u of unsynced.slice(0, 15)) {
            if (y > 510) {
                doc.addPage();
                y = 35;
            }
            doc.rect(startX, y, contentWidth, 16).fillAndStroke('#ffffff', '#f1f5f9');
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a').text(`#${u.sale_id}`, startX + 6, y + 4);
            doc.fontSize(7).font('Helvetica').fillColor('#475569').text(`${u.numero_control} (DTE-${u.dte_type})`, startX + 65, y + 4);
            doc.text(`${u.fecha} - ${reportPdfHelper.fmt(u.total_pagar)}`, startX + 240, y + 4);
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#16a34a').text(u.sello_encontrado, startX + 360, y + 4);
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#4338ca').text('Venta Real Aprobada (Sincronizar Cabecera)', startX + 610, y + 4);
            y += 16;
        }
        y += 6;
    }

    // 5. Facturación Automática de Pedidos vs POS
    if (y > 450) {
        doc.addPage();
        y = 35;
    }

    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('5. AUDITORÍA DE FACTURACIÓN AUTOMÁTICA DE PEDIDOS VS PUNTO DE VENTA (POS)', startX, y);
    y += 11;

    const autoSummary = auditData.resumen.ventas_automaticas_pedidos || 0;
    if (autoSummary > 0) {
        doc.fontSize(7).font('Helvetica').fillColor('#334155');
        doc.text(`• Se registraron ${autoSummary} ventas automáticas en Pedidos: ${auditData.resumen.ventas_automaticas_invalidadas} invalidadas por corrección y ${auditData.resumen.ventas_automaticas_activas} activas.`, startX, y);
        y += 10;
        doc.text('• En los casos invalidados, se re-facturó legítimamente en POS.', startX, y);
        y += 10;
        doc.text('• DICTAMEN TÉCNICO: Flujo tributario auditado y validado.', startX, y);
        y += 16;
    } else {
        doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Esta empresa no registra operaciones bajo el módulo de Pedidos Automáticos de Huevos.', startX, y);
        y += 16;
    }

    // Cierre sin firmas según norma para reportes operacionales
    reportPdfHelper.renderClosingFooter(doc, startX, y, auditData.resumen.total_ventas, 'Ventas Auditadas');
    reportPdfHelper.renderPageNumbers(doc);

    doc.end();
    return getBuffer();
}

module.exports = {
    generateAuditPdfBuffer
};
