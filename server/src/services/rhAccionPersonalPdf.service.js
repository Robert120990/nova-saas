const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const INFRACCIONES_COL1 = [
    'Atraso en presentación al trabajo sin causa justificada.',
    'Desobedecer órdenes de su jefe inmediato.',
    'No presentarse a las convocatorias a reuniones sin justificación.',
    'No portar uniforme en debida forma.',
    'Utilizar tiempo laboral para otras actividades o inducir a otros a ello.',
    'No cumplir con disposiciones sobre higiene y seguridad en lugar de trabajo.',
    'Atraso repetitivo en presentación al trabajo sin causa justificada.',
    'Reincidencia en faltas leves conforme al Reglamento Interno.',
    'Inasistencia en una ocasión sin causa justificada.',
    'Desobedecer reiteradamente instrucciones de jefe inmediato.',
    'Por mal servicio o mal trato a clientes, visitas y/o compañeros de trabajo.',
    'Alterar el orden o disciplina en el lugar de trabajo.',
    'Faltar a la moral o ética profesional/ evadir responsabilidades.',
    'Discutir asuntos políticos, religiosos o propaganda.'
];

const INFRACCIONES_COL2 = [
    'Manchar, alterar o colocar avisos en el lugar de trabajo.',
    'No presentar justificaciones idóneas a sus ausencias.',
    'No prestar colaboración al Comité de Seguridad e Higiene.',
    'Prolongar licencias o incapacidades sin autorización.',
    'No reportar anomalías de las que tenga conocimiento.',
    'Dedicarse a juegos de azar o destreza u otros en horas laborales.',
    'Hacer uso inadecuado o para fines distintos, de herramientas de oficina.',
    'Efectuar trabajos particulares en horas laborales o con herramientas de la empresa.',
    'Registrar entradas y salidas de otros.',
    'Cometer actos inmorales, palabras soeces o indecorosas, irrespetuosas o insultantes.',
    'Ejecutar actos que puedan poner en peligro instalaciones o equipo de la empresa.',
    'Alterar documentación de la empresa.',
    'Sustraer información propiedad de la empresa, objetos de la empresa, o productos de la empresa.',
    'Otros'
];

const ALL_INFRACCIONES = [...INFRACCIONES_COL1, ...INFRACCIONES_COL2];

const ACCIONES_OPCIONES = [
    { key: 'llamado_verbal', label: 'Llamado de Atención verbal' },
    { key: 'llamado_escrito_1', label: 'Llamado de Atención por escrito' },
    { key: 'llamado_escrito_2', label: '2do Llamado de Atención por escrito' },
    { key: 'suspension', label: 'Suspensión día conforme Reglamento' },
    { key: 'terminacion_sin_responsabilidad', label: 'Terminación de contrato de trabajo sin responsabilidad para el patrono' },
    { key: 'despido', label: 'Despido.' },
    { key: 'otro', label: 'Otro' }
];

const TIEMPO_LABORADO_MAP = {
    '0_a_1': 'De 0 a 1 año',
    '1_a_5': 'De 1 a 5 años',
    '5_a_10': 'De 5 a 10 años',
    'mas_10': 'De 10 años +'
};

const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const parts = String(val).substring(0, 10).split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const d = new Date(val);
        return d.toLocaleDateString('es-SV');
    } catch {
        return String(val);
    }
};

const generateAccionPersonalPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            // Buffer all pages so we can measure layout and add page numbers if needed
            const doc = new PDFDocument({
                size: 'LETTER',
                margin: 30,
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 30;
            const contentW = 552; // 612 - 60
            const companyName = data.company_name || 'EMPRESA REGISTRADA';

            // --- Header ---
            let y = M;

            // Logo if available
            if (data.logo_url) {
                try {
                    const fileName = data.logo_url.split('/').pop();
                    const absolutePath = path.join(__dirname, '..', '..', 'uploads', fileName);
                    if (fs.existsSync(absolutePath)) {
                        doc.image(absolutePath, M, y, { width: 65, height: 40, fit: [65, 40] });
                    }
                } catch { /* ignore */ }
            }

            const headerLeft = data.logo_url ? M + 72 : M;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a')
               .text(companyName.toUpperCase(), headerLeft, y, { width: 330 });

            doc.fontSize(8).font('Helvetica').fillColor('#64748b')
               .text(data.company_nit ? `NIT: ${data.company_nit}` : '', headerLeft, y + 15);

            // Confidential box top right
            doc.rect(M + contentW - 145, y, 145, 20).fillAndStroke('#fee2e2', '#ef4444');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#b91c1c')
               .text('INFORMACIÓN CONFIDENCIAL', M + contentW - 145, y + 6, { width: 145, align: 'center' });

            y += 36;

            // Title Banner
            doc.rect(M, y, contentW, 22).fillAndStroke('#1e293b', '#0f172a');
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff')
               .text('ACCIÓN DE PERSONAL Y/O AMONESTACIÓN', M, y + 6, { width: contentW, align: 'center' });

            y += 27;

            // --- Empleado Info Grid ---
            const infoBoxH = 58;
            doc.rect(M, y, contentW, infoBoxH).stroke('#cbd5e1');

            const empNombre = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim().toUpperCase();
            const fechaStr = fmtDate(data.fecha);
            const cargo = data.cargo_nombre || data.cargo || '—';
            const lugar = data.lugar_trabajo || data.departamento_nombre || 'OFICINA CENTRAL';
            const jefe = data.jefe_inmediato || '—';
            const correlativo = data.codigo || 'AP-0001';

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#475569');
            
            // Row 1
            doc.text('NOMBRE COMPLETO DEL EMPLEADO(A):', M + 8, y + 6);
            doc.font('Helvetica-Bold').fillColor('#0f172a').text(empNombre, M + 175, y + 6, { width: 230 });
            doc.font('Helvetica-Bold').fillColor('#475569').text('CORRELATIVO:', M + 415, y + 6);
            doc.font('Helvetica-Bold').fillColor('#4338ca').text(correlativo, M + 480, y + 6);

            // Row 2
            doc.font('Helvetica-Bold').fillColor('#475569').text('FECHA DE AMONESTACIÓN:', M + 8, y + 19);
            doc.font('Helvetica').fillColor('#0f172a').text(fechaStr, M + 175, y + 19);
            doc.font('Helvetica-Bold').fillColor('#475569').text('CÓDIGO:', M + 415, y + 19);
            doc.font('Helvetica').fillColor('#0f172a').text(data.empleado_codigo || '—', M + 480, y + 19);

            // Row 3
            doc.font('Helvetica-Bold').fillColor('#475569').text('POSICIÓN EN QUE LABORA:', M + 8, y + 32);
            doc.font('Helvetica').fillColor('#0f172a').text(cargo, M + 175, y + 32, { width: 360 });

            // Row 4
            doc.font('Helvetica-Bold').fillColor('#475569').text('LUGAR DE TRABAJO ACTUAL:', M + 8, y + 45);
            doc.font('Helvetica').fillColor('#0f172a').text(lugar, M + 175, y + 45, { width: 190 });
            doc.font('Helvetica-Bold').fillColor('#475569').text('JEFE INMEDIATO:', M + 370, y + 45);
            doc.font('Helvetica').fillColor('#0f172a').text(jefe, M + 445, y + 45, { width: 100 });

            y += infoBoxH + 6;

            // --- Section: RAZÓN DE LA ACCIÓN DE PERSONAL Y/O AMONESTACIÓN ---
            doc.rect(M, y, contentW, 15).fillAndStroke('#e2e8f0', '#cbd5e1');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b')
               .text('RAZÓN DE LA ACCIÓN DE PERSONAL Y/O AMONESTACIÓN', M + 8, y + 3.5);

            y += 18;

            // Parse selected infractions
            let selectedInfracciones = [];
            if (Array.isArray(data.infracciones)) {
                selectedInfracciones = data.infracciones;
            } else if (typeof data.infracciones === 'string') {
                try { selectedInfracciones = JSON.parse(data.infracciones); } catch { selectedInfracciones = []; }
            }

            const isChecked = (item) => {
                if (selectedInfracciones.includes(item)) return true;
                const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                return selectedInfracciones.some(sel => normalize(sel) === normalize(item));
            };

            const colW = (contentW - 10) / 2; // ~271 pt each
            const rowH = 10.5;
            const startYInf = y;

            // Render 2 columns
            for (let i = 0; i < 14; i++) {
                const item1 = INFRACCIONES_COL1[i];
                const item2 = INFRACCIONES_COL2[i];
                const itemY = startYInf + (i * rowH);

                // Col 1
                const chk1 = isChecked(item1);
                doc.rect(M + 2, itemY + 0.5, 7, 7).stroke('#94a3b8');
                if (chk1) {
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#b91c1c').text('X', M + 3, itemY + 1);
                }
                doc.fontSize(6.2).font(chk1 ? 'Helvetica-Bold' : 'Helvetica').fillColor(chk1 ? '#0f172a' : '#334155')
                   .text(item1, M + 12, itemY + 0.5, { width: colW - 14, height: rowH, ellipsis: true });

                // Col 2
                let chk2 = false;
                let label2 = item2;
                if (item2 === 'Otros') {
                    chk2 = isChecked('Otros') || isChecked('Otro') || (data.infraccion_otra && data.infraccion_otra.trim().length > 0);
                    label2 = chk2 && data.infraccion_otra ? `Otros: ${data.infraccion_otra}` : 'Otros ___________________________________';
                } else {
                    chk2 = isChecked(item2);
                }

                const col2X = M + colW + 10;
                doc.rect(col2X, itemY + 0.5, 7, 7).stroke('#94a3b8');
                if (chk2) {
                    doc.fontSize(6).font('Helvetica-Bold').fillColor('#b91c1c').text('X', col2X + 1, itemY + 1);
                }
                doc.fontSize(6.2).font(chk2 ? 'Helvetica-Bold' : 'Helvetica').fillColor(chk2 ? '#0f172a' : '#334155')
                   .text(label2, col2X + 10, itemY + 0.5, { width: colW - 12, height: rowH, ellipsis: true });
            }

            y = startYInf + (14 * rowH) + 3;

            // Disclaimer on reglamento
            doc.fontSize(5.8).font('Helvetica-Oblique').fillColor('#64748b')
               .text('Nota: Todas las infracciones antes anotadas están incorporadas dentro del Reglamento Interno de Trabajo de la Sociedad, el cual ha sido debidamente revisado y autorizado por la Dirección General de Trabajo.', M, y, { width: contentW });

            y += 12;

            // --- Section: DESCRIBA LA CAUSA DE LA AMONESTACIÓN ---
            doc.rect(M, y, contentW, 14).fillAndStroke('#e2e8f0', '#cbd5e1');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b')
               .text('DESCRIBA LA CAUSA DE LA AMONESTACIÓN', M + 8, y + 3);

            y += 16;
            const causaBoxH = 50;
            doc.rect(M, y, contentW, causaBoxH).stroke('#cbd5e1');
            doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a')
               .text(data.descripcion_causa || 'Sin descripción ingresada.', M + 8, y + 6, { width: contentW - 16, height: causaBoxH - 10 });

            y += causaBoxH + 5;

            // --- Section: TIEMPO LABORADO & ARTICULO CODIGO DE TRABAJO ---
            const subW = (contentW - 8) / 2;

            // Left: Tiempo laborado
            doc.rect(M, y, subW, 13).fillAndStroke('#f1f5f9', '#cbd5e1');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b')
               .text('TIEMPO LABORADO POR EL EMPLEADO', M + 6, y + 2.5);

            // Right: Articulo
            doc.rect(M + subW + 8, y, subW, 13).fillAndStroke('#f1f5f9', '#cbd5e1');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1e293b')
               .text('ARTICULO CÓDIGO DE TRABAJO INCUMPLIDO', M + subW + 14, y + 2.5);

            y += 15;

            const tiempoH = 26;
            // Box left
            doc.rect(M, y, subW, tiempoH).stroke('#cbd5e1');
            const tiempoOpt = ['0_a_1', '1_a_5', '5_a_10', 'mas_10'];
            const curTiempo = data.tiempo_laborado || '0_a_1';
            const tW = subW / 2;
            tiempoOpt.forEach((k, idx) => {
                const tx = M + 6 + ((idx % 2) * (tW - 4));
                const ty = y + 4 + (Math.floor(idx / 2) * 11);
                const isT = curTiempo === k;
                doc.rect(tx, ty, 6.5, 6.5).stroke('#94a3b8');
                if (isT) doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#b91c1c').text('X', tx + 1, ty + 0.5);
                doc.fontSize(6.5).font(isT ? 'Helvetica-Bold' : 'Helvetica').fillColor('#334155')
                   .text(TIEMPO_LABORADO_MAP[k], tx + 9, ty);
            });

            // Box right
            doc.rect(M + subW + 8, y, subW, tiempoH).stroke('#cbd5e1');
            doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a')
               .text(data.articulo_codigo_trabajo || 'Conforme a Reglamento Interno de Trabajo', M + subW + 14, y + 6, { width: subW - 20 });

            y += tiempoH + 5;

            // --- Section: ACCIONES A TOMAR ---
            doc.rect(M, y, contentW, 14).fillAndStroke('#e2e8f0', '#cbd5e1');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b')
               .text('ACCIONES A TOMAR (SANCIÓN / MEDIDA DISCIPLINARIA)', M + 8, y + 3);

            y += 16;
            const accionBoxH = 36;
            doc.rect(M, y, contentW, accionBoxH).stroke('#cbd5e1');

            const curAccion = data.accion_tomar || 'llamado_escrito_1';
            const accColW = contentW / 2;

            // Left actions: llamado_verbal, llamado_escrito_1, llamado_escrito_2
            const leftAcc = [
                { key: 'llamado_verbal', label: 'Llamado de Atención verbal' },
                { key: 'llamado_escrito_1', label: 'Llamado de Atención por escrito' },
                { key: 'llamado_escrito_2', label: '2do Llamado de Atención por escrito' }
            ];

            leftAcc.forEach((opt, idx) => {
                const ay = y + 4 + (idx * 10);
                const isA = curAccion === opt.key;
                doc.rect(M + 8, ay, 6.5, 6.5).stroke('#94a3b8');
                if (isA) doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#b91c1c').text('X', M + 9, ay + 0.5);
                doc.fontSize(6.8).font(isA ? 'Helvetica-Bold' : 'Helvetica').fillColor(isA ? '#0f172a' : '#334155')
                   .text(opt.label, M + 18, ay);
            });

            // Right actions: suspension, terminacion, despido, otro
            let suspLabel = 'Suspensión día conforme Reglamento';
            if (curAccion === 'suspension' && data.dias_suspension) {
                suspLabel += ` (${data.dias_suspension} días)`;
                if (data.fecha_inicio_suspension) suspLabel += ` desde ${fmtDate(data.fecha_inicio_suspension)}`;
            }

            const rightAcc = [
                { key: 'suspension', label: suspLabel },
                { key: 'terminacion_sin_responsabilidad', label: 'Terminación de contrato sin responsabilidad patronal' },
                { key: 'despido', label: 'Despido' }
            ];

            rightAcc.forEach((opt, idx) => {
                const ay = y + 4 + (idx * 10);
                const isA = curAccion === opt.key;
                const ax = M + accColW + 8;
                doc.rect(ax, ay, 6.5, 6.5).stroke('#94a3b8');
                if (isA) doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#b91c1c').text('X', ax + 1, ay + 0.5);
                doc.fontSize(6.8).font(isA ? 'Helvetica-Bold' : 'Helvetica').fillColor(isA ? '#0f172a' : '#334155')
                   .text(opt.label, ax + 10, ay, { width: accColW - 16, ellipsis: true });
            });

            y += accionBoxH + 4;

            // Disclaimer legal del trabajador
            doc.fontSize(5.8).font('Helvetica').fillColor('#475569')
               .text('Nota: Son reconocidos y aceptados por el (la) Trabajador(a), los hechos aquí enunciados y descritos, y por tanto asume las responsabilidades que corresponden conforme al Reglamento Interno de Trabajo autorizado, y la Legislación Laboral vigente. Cada una de las faltas aquí descritas fueron comunicadas con el Reglamento Interno de Trabajo que ha sido aprobado por el M.T.P.S.', M, y, { width: contentW });

            y += 24;

            // --- Signatures Section ---
            const sigW = (contentW - 20) / 3; // ~177 pt each
            const sigH = 46;

            // Box 1: Jefe
            const s1X = M;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(s1X + 10, y + 26).lineTo(s1X + sigW - 10, y + 26).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b')
               .text('Jefe Inmediato y/o Rep. Patronal', s1X, y + 29, { width: sigW, align: 'center' });
            if (data.jefe_inmediato) {
                doc.fontSize(6).font('Helvetica').fillColor('#64748b')
                   .text(data.jefe_inmediato, s1X, y + 38, { width: sigW, align: 'center' });
            }

            // Box 2: Recursos Humanos
            const s2X = M + sigW + 10;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(s2X + 10, y + 26).lineTo(s2X + sigW - 10, y + 26).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b')
               .text('Recursos Humanos', s2X, y + 29, { width: sigW, align: 'center' });
            if (data.recursos_humanos) {
                doc.fontSize(6).font('Helvetica').fillColor('#64748b')
                   .text(data.recursos_humanos, s2X, y + 38, { width: sigW, align: 'center' });
            }

            // Box 3: Empleado
            const s3X = M + (sigW * 2) + 20;
            doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(s3X + 10, y + 26).lineTo(s3X + sigW - 10, y + 26).stroke();
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e293b')
               .text('Empleado', s3X, y + 29, { width: sigW, align: 'center' });
            doc.fontSize(5.2).font('Helvetica-Oblique').fillColor('#475569')
               .text('Al firmar la presente, acepto que son ciertos los hechos declarados en ella, y por ende asumo las responsabilidades que conforme la Ley aplicable y el Reglamento aprobado corresponden.', s3X, y + 38, { width: sigW, align: 'center' });

            if (data.estado_firma === 'se_nego_a_firmar') {
                doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#dc2626')
                   .text(`(Se negó a firmar - Testigo: ${data.testigo_nombre || 'N/A'})`, s3X, y + 15, { width: sigW, align: 'center' });
            }

            doc.end();
        } catch (e) {
            reject(e);
        }
    });
};

module.exports = {
    generateAccionPersonalPDF,
    ALL_INFRACCIONES,
    INFRACCIONES_COL1,
    INFRACCIONES_COL2,
    ACCIONES_OPCIONES,
    TIEMPO_LABORADO_MAP
};
