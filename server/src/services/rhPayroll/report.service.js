const MONTH_NAMES = [
    '', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];
const { pool, PDFDocument, TABLE, parseIdList } = require('./shared');

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

function fitText(doc, text, maxWidth) {
    if (!text) return '';
    const s = String(text).trim();
    if (doc.widthOfString(s) <= maxWidth) return s;
    let truncated = s;
    while (truncated.length > 0 && doc.widthOfString(truncated + '…') > maxWidth) {
        truncated = truncated.slice(0, -1).trimEnd();
    }
    return truncated ? truncated + '…' : '';
}

function renderHeader(doc, company, title, periodText, orientation = 'landscape', subtitle = null) {
    const pageWidth = orientation === 'landscape' ? 792 : 612;
    const contentWidth = pageWidth - 60;

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
    let taxText = `NUMERO DE REGISTRO DE I.V.A.: ${company.nrc || 'N/A'}    |    NIT: ${company.nit || 'N/A'}`;
    if (subtitle) {
        taxText += `    |    ${subtitle.toUpperCase()}`;
    }
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

function renderClosingFooter(doc, startX, y, count, entityName = 'Empleados') {
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
    doc.text(`Número de ${entityName} Impresos : ${count || 0}`, startX, y, { lineBreak: false });
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

function makeShortTitle(desc) {
    if (!desc) return '';
    const upper = desc.toUpperCase();
    if (upper.includes('BONIF')) return 'BONIF.';
    if (upper.includes('HORAS EXTRAS NOCT')) return 'H.E. NOCT.';
    if (upper.includes('HORAS EXTRAS DIUR')) return 'H.E. DIUR.';
    if (upper.includes('HORAS EXTRAS')) return 'H.E. VALOR';
    if (upper.includes('COMIS')) return 'COMIS.';
    if (upper.includes('VACACION')) return 'VACAC.';
    if (upper.includes('FERIADO')) return 'FERIADO';
    if (upper.includes('TURNO')) return 'TURNOS';
    if (upper.includes('PRESTAM')) return 'PRÉSTAMOS';
    if (upper.includes('PROCUR')) return 'PROCUR.';
    if (upper.includes('ANTICIP')) return 'ANTICIPOS';
    if (upper.includes('VIVIENDA') || upper.includes('FSV')) return 'FSV';
    if (upper.includes('LLEGADA') || upper.includes('TARDE')) return 'TARDANZAS';
    return desc.length > 9 ? desc.substring(0, 8) + '.' : desc;
}

const exportPlanillaReportePDF = async (req, res) => {
    try {
        const { anio, mes, quincena, branch_ids, departamento_ids, formato } = req.query;
        if (!anio || !mes || !quincena) {
            return res.status(400).json({ message: 'Parámetros anio, mes y quincena requeridos' });
        }

        const isDetallado = formato === 'detallado' || formato === 'detalle';

        const [compRows] = await pool.query(
            'SELECT id, razon_social, nombre_comercial, nit, nrc, direccion FROM companies WHERE id = ?',
            [req.company_id]
        );
        const company = compRows[0] || {
            razon_social: 'EMPRESA REGISTRADA',
            nombre_comercial: 'EMPRESA',
            nit: '0000-000000-000-0',
            nrc: '000000-0'
        };

        let sql = `
            SELECT p.*, 
                   e.codigo as empleado_codigo,
                   e.nombres as empleado_nombres,
                   e.apellidos as empleado_apellidos,
                   e.branch_id,
                   e.departamento_personal_id,
                   COALESCE(b.nombre, 'SIN SUCURSAL') as branch_nombre,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   COALESCE(
                       (SELECT d.valor_ingresado FROM rh_planilla_detalles d WHERE d.planilla_id = p.id AND d.codigo = '01' LIMIT 1),
                       ROUND((p.sueldo_base / 30) * COALESCE(p.dias_trabajados, 15), 2)
                   ) as sueldo_quincenal,
                   COALESCE(
                       (SELECT SUM(d.valor_ingresado) FROM rh_planilla_detalles d WHERE d.planilla_id = p.id AND d.operacion = 'sumar'),
                       p.total_percepciones
                   ) as devengado_calc,
                   COALESCE(
                       (SELECT SUM(d.valor_ingresado) FROM rh_planilla_detalles d WHERE d.planilla_id = p.id AND d.operacion = 'restar'),
                       0
                   ) as otras_deducciones_calc
            FROM ${TABLE} p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN branches b ON e.branch_id = b.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.quincena = ?
        `;
        let sqlParams = [req.company_id, parseInt(anio), parseInt(mes), quincena];

        const branchList = parseIdList(branch_ids);
        if (branchList.length > 0) {
            sql += ` AND e.branch_id IN (?)`;
            sqlParams.push(branchList);
        }
        const deptoList = parseIdList(departamento_ids);
        if (deptoList.length > 0) {
            sql += ` AND e.departamento_personal_id IN (?)`;
            sqlParams.push(deptoList);
        }

        sql += ` ORDER BY COALESCE(d.descripcion, 'ZZZ') ASC, COALESCE(b.nombre, 'ZZZ') ASC, e.codigo ASC`;

        const [planillas] = await pool.query(sql, sqlParams);

        const doc = new PDFDocument({
            margin: 30,
            size: 'LETTER',
            layout: 'landscape',
            bufferPages: true
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=Planilla_${anio}_${mes}_${quincena}${isDetallado ? '_detallada' : ''}.pdf`);
            res.send(result);
        });

        const mesNombre = MONTH_NAMES[parseInt(mes)] || '';
        const quincenaText = quincena === 'primera' ? 'PRIMERA QUINCENA' : 'SEGUNDA QUINCENA';
        const periodText = `CORRESPONDIENTE AL MES DE ${mesNombre} DE ${anio} - ${quincenaText}`;
        const title = isDetallado ? 'Planilla de Sueldos y Salarios (Detallada)' : 'Planilla de Sueldos y Salarios';
        const startX = 30;
        const contentWidth = 732;

        const distinctBranches = [...new Set(planillas.map(p => p.branch_id || 0))];
        const getDeptoKey = (p) => (p.departamento_personal_id ? String(p.departamento_personal_id) : (p.departamento_nombre ? p.departamento_nombre.trim() : 'SIN_DEPTO'));
        const distinctDeptos = [...new Set(planillas.map(getDeptoKey))];

        const shouldGroupByDepto = deptoList.length > 1 || ((deptoList.length === 0 || !departamento_ids) && distinctDeptos.length > 1);
        const shouldGroupByBranch = !shouldGroupByDepto && (branchList.length > 1 || (!branch_ids && distinctBranches.length > 1));

        const subtitle = (!shouldGroupByDepto && deptoList.length === 1 && planillas[0]?.departamento_nombre)
            ? `DEPARTAMENTO: ${planillas[0].departamento_nombre}`
            : null;

        renderHeader(doc, company, title, periodText, 'landscape', subtitle);

        // Fetch details if detailed format requested
        let dynamicIngresoCols = [];
        let dynamicDeduccionCols = [];
        let detailsMap = {};

        if (isDetallado && planillas.length > 0) {
            const pIds = planillas.map(p => p.id);
            const [detRows] = await pool.query(`
                SELECT d.planilla_id, d.cuenta_id, d.codigo, d.descripcion, d.operacion, d.valor_ingresado
                FROM rh_planilla_detalles d
                WHERE d.planilla_id IN (?)
            `, [pIds]);

            detRows.forEach(r => {
                if (!detailsMap[r.planilla_id]) detailsMap[r.planilla_id] = {};
                detailsMap[r.planilla_id][r.codigo] = parseFloat(r.valor_ingresado || 0);
            });

            const [cuentasRows] = await pool.query(`
                SELECT cp.id, cp.codigo, cp.descripcion, cp.operacion, cp.orden,
                       COALESCE(SUM(d.valor_ingresado), 0) as total_periodo
                FROM rh_cuentas_planillas cp
                LEFT JOIN rh_planilla_detalles d ON d.cuenta_id = cp.id AND d.planilla_id IN (?)
                WHERE cp.company_id = ? AND cp.activa = 1 AND cp.aparece_planilla = 1
                GROUP BY cp.id, cp.codigo, cp.descripcion, cp.operacion, cp.orden
                ORDER BY cp.operacion DESC, cp.orden ASC, cp.codigo ASC
            `, [pIds, req.company_id]);

            const activeIngresos = cuentasRows.filter(c => c.operacion === 'sumar' && c.codigo !== '01');
            dynamicIngresoCols = activeIngresos.filter(c => parseFloat(c.total_periodo) > 0);
            if (dynamicIngresoCols.length === 0 && activeIngresos.length > 0) {
                dynamicIngresoCols = activeIngresos.slice(0, 3);
            }

            const activeDeducciones = cuentasRows.filter(c => c.operacion === 'restar');
            dynamicDeduccionCols = activeDeducciones.filter(c => parseFloat(c.total_periodo) > 0);
            if (dynamicDeduccionCols.length === 0 && activeDeducciones.length > 0) {
                dynamicDeduccionCols = activeDeducciones.slice(0, 3);
            }

            dynamicIngresoCols.forEach(c => c.shortTitle = makeShortTitle(c.descripcion));
            dynamicDeduccionCols.forEach(c => c.shortTitle = makeShortTitle(c.descripcion));
        }

        // Column definitions
        const colWResumen = {
            num: 14,
            code: 32,
            name: 148,
            cargo: 94,
            dias: 20,
            sueldoQuincenal: 48,
            ingresosAdic: 48,
            devengado: 50,
            isss: 38,
            afp: 38,
            renta: 40,
            otrasDed: 46,
            totalDed: 50,
            neto: 64
        };

        const totalDynCols = dynamicIngresoCols.length + dynamicDeduccionCols.length;
        const dynColW = totalDynCols > 0 ? Math.max(34, Math.min(52, Math.floor(290 / totalDynCols))) : 40;
        const fixedDetWidth = 14 + 28 + 38 + (dynamicIngresoCols.length * dynColW) + 42 + 34 + 34 + 36 + (dynamicDeduccionCols.length * dynColW) + 42 + 58;
        const detNameW = Math.max(75, contentWidth - fixedDetWidth);

        const colWDetallado = {
            num: 14,
            code: 28,
            name: detNameW,
            sueldo: 38,
            dyn: dynColW,
            devengado: 42,
            isss: 34,
            afp: 34,
            renta: 36,
            totalDed: 42,
            neto: 58
        };

        const drawTableHeader = (yPos) => {
            doc.rect(startX, yPos, contentWidth, 14).fill('#f1f5f9');
            doc.fontSize(isDetallado ? 6.5 : 7).font('Helvetica-Bold').fillColor('#0f172a');
            let x = startX + 2;

            if (!isDetallado) {
                doc.text('Nº', x, yPos + 3.5, { width: colWResumen.num, align: 'center', lineBreak: false }); x += colWResumen.num;
                doc.text('CÓDIGO', x, yPos + 3.5, { width: colWResumen.code, lineBreak: false }); x += colWResumen.code;
                doc.text('EMPLEADO', x, yPos + 3.5, { width: colWResumen.name, lineBreak: false }); x += colWResumen.name;
                const cargoHeader = shouldGroupByDepto 
                    ? (distinctBranches.length > 1 ? 'CARGO / SUCURSAL' : 'CARGO / PUESTO')
                    : 'CARGO / DEPTO';
                doc.text(cargoHeader, x, yPos + 3.5, { width: colWResumen.cargo, lineBreak: false }); x += colWResumen.cargo;
                doc.text('DÍAS', x, yPos + 3.5, { width: colWResumen.dias, align: 'center', lineBreak: false }); x += colWResumen.dias;
                doc.text('S. QUINC.', x, yPos + 3.5, { width: colWResumen.sueldoQuincenal - 3, align: 'right', lineBreak: false }); x += colWResumen.sueldoQuincenal;
                doc.text('ING. ADIC.', x, yPos + 3.5, { width: colWResumen.ingresosAdic - 3, align: 'right', lineBreak: false }); x += colWResumen.ingresosAdic;
                doc.text('TOTAL DEV.', x, yPos + 3.5, { width: colWResumen.devengado - 3, align: 'right', lineBreak: false }); x += colWResumen.devengado;
                doc.text('ISSS', x, yPos + 3.5, { width: colWResumen.isss - 3, align: 'right', lineBreak: false }); x += colWResumen.isss;
                doc.text('AFP', x, yPos + 3.5, { width: colWResumen.afp - 3, align: 'right', lineBreak: false }); x += colWResumen.afp;
                doc.text('RENTA', x, yPos + 3.5, { width: colWResumen.renta - 3, align: 'right', lineBreak: false }); x += colWResumen.renta;
                doc.text('OTRAS DED.', x, yPos + 3.5, { width: colWResumen.otrasDed - 3, align: 'right', lineBreak: false }); x += colWResumen.otrasDed;
                doc.text('TOTAL DED.', x, yPos + 3.5, { width: colWResumen.totalDed - 3, align: 'right', lineBreak: false }); x += colWResumen.totalDed;
                const netoHeaderRes = doc.widthOfString('NETO A PAGAR') <= (colWResumen.neto - 3) ? 'NETO A PAGAR' : 'NETO PAGAR';
                doc.text(netoHeaderRes, x, yPos + 3.5, { width: colWResumen.neto - 3, align: 'right', lineBreak: false });
            } else {
                doc.text('Nº', x, yPos + 3.5, { width: colWDetallado.num, align: 'center', lineBreak: false }); x += colWDetallado.num;
                doc.text('CÓD.', x, yPos + 3.5, { width: colWDetallado.code, lineBreak: false }); x += colWDetallado.code;
                doc.text('EMPLEADO', x, yPos + 3.5, { width: colWDetallado.name - 3, lineBreak: false }); x += colWDetallado.name;
                doc.text('S. QUINC.', x, yPos + 3.5, { width: colWDetallado.sueldo - 2, align: 'right', lineBreak: false }); x += colWDetallado.sueldo;
                dynamicIngresoCols.forEach(col => {
                    doc.text(col.shortTitle, x, yPos + 3.5, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                    x += colWDetallado.dyn;
                });
                doc.text('TOTAL DEV.', x, yPos + 3.5, { width: colWDetallado.devengado - 2, align: 'right', lineBreak: false }); x += colWDetallado.devengado;
                doc.text('ISSS', x, yPos + 3.5, { width: colWDetallado.isss - 2, align: 'right', lineBreak: false }); x += colWDetallado.isss;
                doc.text('AFP', x, yPos + 3.5, { width: colWDetallado.afp - 2, align: 'right', lineBreak: false }); x += colWDetallado.afp;
                doc.text('RENTA', x, yPos + 3.5, { width: colWDetallado.renta - 2, align: 'right', lineBreak: false }); x += colWDetallado.renta;
                dynamicDeduccionCols.forEach(col => {
                    doc.text(col.shortTitle, x, yPos + 3.5, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                    x += colWDetallado.dyn;
                });
                doc.text('TOTAL DED.', x, yPos + 3.5, { width: colWDetallado.totalDed - 2, align: 'right', lineBreak: false }); x += colWDetallado.totalDed;
                const netoHeaderDet = doc.widthOfString('NETO A PAGAR') <= (colWDetallado.neto - 2) ? 'NETO A PAGAR' : 'A PAGAR';
                doc.text(netoHeaderDet, x, yPos + 3.5, { width: colWDetallado.neto - 2, align: 'right', lineBreak: false });
            }

            return yPos + 18;
        };

        const renderDeptoBanner = (yPos, deptoName, count) => {
            doc.rect(startX, yPos, contentWidth, 15).fill('#eff6ff');
            doc.rect(startX, yPos, 3.5, 15).fill('#2563eb');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e3a8a');
            doc.text(`DEPARTAMENTO: ${deptoName.toUpperCase()}  (${count} ${count === 1 ? 'empleado' : 'empleados'})`, startX + 8, yPos + 4, { lineBreak: false });
            return yPos + 17;
        };

        const renderBranchBanner = (yPos, branchName, count) => {
            doc.rect(startX, yPos, contentWidth, 15).fill('#eef2ff');
            doc.rect(startX, yPos, 3.5, 15).fill('#4f46e5');
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#312e81');
            doc.text(`SUCURSAL: ${branchName.toUpperCase()}  (${count} ${count === 1 ? 'empleado' : 'empleados'})`, startX + 8, yPos + 4, { lineBreak: false });
            return yPos + 17;
        };

        let y = doc.y + 4;

        if (planillas.length === 0) {
            y = drawTableHeader(y);
            doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
            doc.text('No se encontraron registros de planilla para los filtros seleccionados.', startX, y + 10, { lineBreak: false });
            y += 30;
        } else {
            // Determine grouping mode and partition groups
            let groupingMode = 'none';
            const groups = [];

            if (shouldGroupByDepto) {
                groupingMode = 'depto';
                const dMap = new Map();
                for (const p of planillas) {
                    const dId = p.departamento_personal_id || (p.departamento_nombre ? p.departamento_nombre.trim() : 'SIN_DEPTO');
                    const dName = (p.departamento_nombre || 'SIN DEPARTAMENTO').trim();
                    if (!dMap.has(dId)) {
                        const g = { id: dId, name: dName, items: [] };
                        dMap.set(dId, g);
                        groups.push(g);
                    }
                    dMap.get(dId).items.push(p);
                }
                groups.sort((a, b) => {
                    if (a.id === 0 || a.id === 'SIN_DEPTO') return 1;
                    if (b.id === 0 || b.id === 'SIN_DEPTO') return -1;
                    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
                });
            } else if (shouldGroupByBranch) {
                groupingMode = 'branch';
                const bMap = new Map();
                for (const p of planillas) {
                    const bId = p.branch_id || 0;
                    const bName = (p.branch_nombre || 'SIN SUCURSAL').trim();
                    if (!bMap.has(bId)) {
                        const g = { id: bId, name: bName, items: [] };
                        bMap.set(bId, g);
                        groups.push(g);
                    }
                    bMap.get(bId).items.push(p);
                }
            } else {
                groupingMode = 'none';
                groups.push({
                    id: 0,
                    name: deptoList.length === 1 && planillas[0]?.departamento_nombre ? planillas[0].departamento_nombre : '',
                    items: planillas
                });
            }

            // Grand Totals accumulators
            const grandTotals = {
                sueldoQuincenal: 0,
                ingresosAdic: 0,
                devengado: 0,
                isss: 0,
                afp: 0,
                renta: 0,
                otrasDed: 0,
                totalDed: 0,
                neto: 0,
                dynIngresos: {},
                dynDeducciones: {}
            };
            dynamicIngresoCols.forEach(c => grandTotals.dynIngresos[c.codigo] = 0);
            dynamicDeduccionCols.forEach(c => grandTotals.dynDeducciones[c.codigo] = 0);

            let globalEmpIndex = 0;

            for (let gIdx = 0; gIdx < groups.length; gIdx++) {
                const group = groups[gIdx];

                if (groupingMode === 'depto') {
                    // Cada departamento inicia en una página diferente
                    if (gIdx > 0) {
                        doc.addPage();
                        renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                        y = doc.y + 4;
                    }
                    y = renderDeptoBanner(y, group.name, group.items.length);
                } else if (groupingMode === 'branch') {
                    if (y > 470) {
                        doc.addPage();
                        renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                        y = doc.y + 4;
                    }
                    y = renderBranchBanner(y, group.name, group.items.length);
                }

                y = drawTableHeader(y);

                const subTotals = {
                    sueldoQuincenal: 0,
                    ingresosAdic: 0,
                    devengado: 0,
                    isss: 0,
                    afp: 0,
                    renta: 0,
                    otrasDed: 0,
                    totalDed: 0,
                    neto: 0,
                    dynIngresos: {},
                    dynDeducciones: {}
                };
                dynamicIngresoCols.forEach(c => subTotals.dynIngresos[c.codigo] = 0);
                dynamicDeduccionCols.forEach(c => subTotals.dynDeducciones[c.codigo] = 0);

                for (let idx = 0; idx < group.items.length; idx++) {
                    const p = group.items[idx];
                    globalEmpIndex++;

                    if (y > 530) {
                        doc.addPage();
                        renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                        y = doc.y + 4;
                        if (groupingMode === 'depto') {
                            y = renderDeptoBanner(y, group.name + ' (Continuación)', group.items.length);
                        } else if (groupingMode === 'branch') {
                            y = renderBranchBanner(y, group.name + ' (Continuación)', group.items.length);
                        }
                        y = drawTableHeader(y);
                    }

                    const sueldoBase = parseFloat(p.sueldo_base || 0);
                    const diasTrab = parseInt(p.dias_trabajados ?? 15);
                    const sueldoQuincenal = parseFloat(p.sueldo_quincenal !== null && p.sueldo_quincenal !== undefined ? p.sueldo_quincenal : ((sueldoBase / 30) * diasTrab));
                    const devengado = parseFloat(p.devengado_calc !== null && p.devengado_calc !== undefined ? p.devengado_calc : (p.total_percepciones || 0));
                    const ingresosAdic = Math.max(0, Math.round((devengado - sueldoQuincenal) * 100) / 100);
                    const isss = parseFloat(p.descuento_isss || 0);
                    const afp = parseFloat(p.descuento_afp || 0);
                    const renta = parseFloat(p.descuento_renta || 0);
                    const otrasDed = parseFloat(p.otras_deducciones_calc !== null && p.otras_deducciones_calc !== undefined
                        ? p.otras_deducciones_calc
                        : Math.max(0, Math.round((parseFloat(p.total_deducciones || 0) - isss - afp - renta) * 100) / 100));
                    const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
                    const neto = Math.round((devengado - totalDed) * 100) / 100;

                    subTotals.sueldoQuincenal += sueldoQuincenal;
                    subTotals.ingresosAdic += ingresosAdic;
                    subTotals.devengado += devengado;
                    subTotals.isss += isss;
                    subTotals.afp += afp;
                    subTotals.renta += renta;
                    subTotals.otrasDed += otrasDed;
                    subTotals.totalDed += totalDed;
                    subTotals.neto += neto;

                    grandTotals.sueldoQuincenal += sueldoQuincenal;
                    grandTotals.ingresosAdic += ingresosAdic;
                    grandTotals.devengado += devengado;
                    grandTotals.isss += isss;
                    grandTotals.afp += afp;
                    grandTotals.renta += renta;
                    grandTotals.otrasDed += otrasDed;
                    grandTotals.totalDed += totalDed;
                    grandTotals.neto += neto;

                    if (idx % 2 === 1) {
                        doc.rect(startX, y - 1.5, contentWidth, 12.5).fill('#f8fafc');
                    }

                    doc.fontSize(isDetallado ? 6.5 : 7).font('Helvetica').fillColor('#1e293b');
                    let rx = startX + 2;

                    if (!isDetallado) {
                        doc.text(String(globalEmpIndex), rx, y, { width: colWResumen.num, align: 'center', lineBreak: false }); rx += colWResumen.num;
                        doc.text(p.empleado_codigo || '', rx, y, { width: colWResumen.code, lineBreak: false }); rx += colWResumen.code;
                        const empNombre = `${p.empleado_nombres || ''} ${p.empleado_apellidos || ''}`.trim();
                        doc.text(fitText(doc, empNombre, colWResumen.name - 4), rx, y, { width: colWResumen.name - 3, lineBreak: false }); rx += colWResumen.name;
                        
                        let cargoDepto = p.cargo_nombre || p.departamento_nombre || 'GENERAL';
                        if (shouldGroupByDepto) {
                            if (distinctBranches.length > 1 && p.branch_nombre) {
                                cargoDepto = `${p.cargo_nombre || 'GENERAL'} • ${p.branch_nombre}`;
                            } else {
                                cargoDepto = p.cargo_nombre || 'GENERAL';
                            }
                        }
                        doc.text(fitText(doc, cargoDepto, colWResumen.cargo - 4), rx, y, { width: colWResumen.cargo - 3, lineBreak: false }); rx += colWResumen.cargo;
                        
                        doc.text(String(diasTrab), rx, y, { width: colWResumen.dias, align: 'center', lineBreak: false }); rx += colWResumen.dias;
                        doc.text(formatCurrency(sueldoQuincenal), rx, y, { width: colWResumen.sueldoQuincenal - 3, align: 'right', lineBreak: false }); rx += colWResumen.sueldoQuincenal;
                        doc.text(formatCurrency(ingresosAdic), rx, y, { width: colWResumen.ingresosAdic - 3, align: 'right', lineBreak: false }); rx += colWResumen.ingresosAdic;
                        doc.text(formatCurrency(devengado), rx, y, { width: colWResumen.devengado - 3, align: 'right', lineBreak: false }); rx += colWResumen.devengado;
                        doc.text(formatCurrency(isss), rx, y, { width: colWResumen.isss - 3, align: 'right', lineBreak: false }); rx += colWResumen.isss;
                        doc.text(formatCurrency(afp), rx, y, { width: colWResumen.afp - 3, align: 'right', lineBreak: false }); rx += colWResumen.afp;
                        doc.text(formatCurrency(renta), rx, y, { width: colWResumen.renta - 3, align: 'right', lineBreak: false }); rx += colWResumen.renta;
                        doc.text(formatCurrency(otrasDed), rx, y, { width: colWResumen.otrasDed - 3, align: 'right', lineBreak: false }); rx += colWResumen.otrasDed;
                        doc.text(formatCurrency(totalDed), rx, y, { width: colWResumen.totalDed - 3, align: 'right', lineBreak: false }); rx += colWResumen.totalDed;
                        doc.font('Helvetica-Bold').text(formatCurrency(neto), rx, y, { width: colWResumen.neto - 3, align: 'right', lineBreak: false });
                    } else {
                        doc.text(String(globalEmpIndex), rx, y, { width: colWDetallado.num, align: 'center', lineBreak: false }); rx += colWDetallado.num;
                        doc.text(p.empleado_codigo || '', rx, y, { width: colWDetallado.code, lineBreak: false }); rx += colWDetallado.code;
                        const empNombre = `${p.empleado_nombres || ''} ${p.empleado_apellidos || ''}`.trim();
                        doc.text(fitText(doc, empNombre, colWDetallado.name - 4), rx, y, { width: colWDetallado.name - 3, lineBreak: false }); rx += colWDetallado.name;
                        doc.text(formatCurrency(sueldoQuincenal), rx, y, { width: colWDetallado.sueldo - 2, align: 'right', lineBreak: false }); rx += colWDetallado.sueldo;

                        const empDets = detailsMap[p.id] || {};

                        dynamicIngresoCols.forEach(col => {
                            const val = empDets[col.codigo] || 0;
                            subTotals.dynIngresos[col.codigo] += val;
                            grandTotals.dynIngresos[col.codigo] += val;
                            doc.text(formatCurrency(val), rx, y, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                            rx += colWDetallado.dyn;
                        });

                        doc.text(formatCurrency(devengado), rx, y, { width: colWDetallado.devengado - 2, align: 'right', lineBreak: false }); rx += colWDetallado.devengado;
                        doc.text(formatCurrency(isss), rx, y, { width: colWDetallado.isss - 2, align: 'right', lineBreak: false }); rx += colWDetallado.isss;
                        doc.text(formatCurrency(afp), rx, y, { width: colWDetallado.afp - 2, align: 'right', lineBreak: false }); rx += colWDetallado.afp;
                        doc.text(formatCurrency(renta), rx, y, { width: colWDetallado.renta - 2, align: 'right', lineBreak: false }); rx += colWDetallado.renta;

                        dynamicDeduccionCols.forEach(col => {
                            const val = empDets[col.codigo] || 0;
                            subTotals.dynDeducciones[col.codigo] += val;
                            grandTotals.dynDeducciones[col.codigo] += val;
                            doc.text(formatCurrency(val), rx, y, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                            rx += colWDetallado.dyn;
                        });

                        doc.text(formatCurrency(totalDed), rx, y, { width: colWDetallado.totalDed - 2, align: 'right', lineBreak: false }); rx += colWDetallado.totalDed;
                        doc.font('Helvetica-Bold').text(formatCurrency(neto), rx, y, { width: colWDetallado.neto - 2, align: 'right', lineBreak: false });
                    }

                    y += 12;
                }

                // Subtotal for Group (if grouped by depto or branch)
                if (groupingMode !== 'none') {
                    if (y > 515) {
                        doc.addPage();
                        renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                        y = doc.y + 10;
                    }

                    doc.strokeColor('#cbd5e1').lineWidth(0.8).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                    y += 3;
                    doc.fontSize(isDetallado ? 6.5 : 7).font('Helvetica-Bold').fillColor('#1e293b');

                    const subtotalLabel = `SUBTOTAL ${group.name.toUpperCase()}:`;

                    if (!isDetallado) {
                        doc.text(subtotalLabel, startX + 2, y, {
                            width: colWResumen.num + colWResumen.code + colWResumen.name + colWResumen.cargo + colWResumen.dias,
                            lineBreak: false
                        });
                        let tx = startX + 2 + colWResumen.num + colWResumen.code + colWResumen.name + colWResumen.cargo + colWResumen.dias;
                        doc.text(formatCurrency(subTotals.sueldoQuincenal), tx, y, { width: colWResumen.sueldoQuincenal - 3, align: 'right', lineBreak: false }); tx += colWResumen.sueldoQuincenal;
                        doc.text(formatCurrency(subTotals.ingresosAdic), tx, y, { width: colWResumen.ingresosAdic - 3, align: 'right', lineBreak: false }); tx += colWResumen.ingresosAdic;
                        doc.text(formatCurrency(subTotals.devengado), tx, y, { width: colWResumen.devengado - 3, align: 'right', lineBreak: false }); tx += colWResumen.devengado;
                        doc.text(formatCurrency(subTotals.isss), tx, y, { width: colWResumen.isss - 3, align: 'right', lineBreak: false }); tx += colWResumen.isss;
                        doc.text(formatCurrency(subTotals.afp), tx, y, { width: colWResumen.afp - 3, align: 'right', lineBreak: false }); tx += colWResumen.afp;
                        doc.text(formatCurrency(subTotals.renta), tx, y, { width: colWResumen.renta - 3, align: 'right', lineBreak: false }); tx += colWResumen.renta;
                        doc.text(formatCurrency(subTotals.otrasDed), tx, y, { width: colWResumen.otrasDed - 3, align: 'right', lineBreak: false }); tx += colWResumen.otrasDed;
                        doc.text(formatCurrency(subTotals.totalDed), tx, y, { width: colWResumen.totalDed - 3, align: 'right', lineBreak: false }); tx += colWResumen.totalDed;
                        doc.text(formatCurrency(subTotals.neto), tx, y, { width: colWResumen.neto - 3, align: 'right', lineBreak: false });
                    } else {
                        doc.text(subtotalLabel, startX + 2, y, {
                            width: colWDetallado.num + colWDetallado.code + colWDetallado.name,
                            lineBreak: false
                        });
                        let tx = startX + 2 + colWDetallado.num + colWDetallado.code + colWDetallado.name;
                        doc.text(formatCurrency(subTotals.sueldoQuincenal), tx, y, { width: colWDetallado.sueldo - 2, align: 'right', lineBreak: false }); tx += colWDetallado.sueldo;
                        dynamicIngresoCols.forEach(col => {
                            doc.text(formatCurrency(subTotals.dynIngresos[col.codigo]), tx, y, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                            tx += colWDetallado.dyn;
                        });
                        doc.text(formatCurrency(subTotals.devengado), tx, y, { width: colWDetallado.devengado - 2, align: 'right', lineBreak: false }); tx += colWDetallado.devengado;
                        doc.text(formatCurrency(subTotals.isss), tx, y, { width: colWDetallado.isss - 2, align: 'right', lineBreak: false }); tx += colWDetallado.isss;
                        doc.text(formatCurrency(subTotals.afp), tx, y, { width: colWDetallado.afp - 2, align: 'right', lineBreak: false }); tx += colWDetallado.afp;
                        doc.text(formatCurrency(subTotals.renta), tx, y, { width: colWDetallado.renta - 2, align: 'right', lineBreak: false }); tx += colWDetallado.renta;
                        dynamicDeduccionCols.forEach(col => {
                            doc.text(formatCurrency(subTotals.dynDeducciones[col.codigo]), tx, y, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                            tx += colWDetallado.dyn;
                        });
                        doc.text(formatCurrency(subTotals.totalDed), tx, y, { width: colWDetallado.totalDed - 2, align: 'right', lineBreak: false }); tx += colWDetallado.totalDed;
                        doc.text(formatCurrency(subTotals.neto), tx, y, { width: colWDetallado.neto - 2, align: 'right', lineBreak: false });
                    }

                    y += 10;
                    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
                    y += 12;
                }
            }

            // Totals / Grand Totals
            if (groupingMode !== 'none') {
                if (y > 480) {
                    doc.addPage();
                    renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                    y = doc.y + 10;
                }
            } else {
                if (y > 515) {
                    doc.addPage();
                    renderHeader(doc, company, title, periodText, 'landscape', subtitle);
                    y = doc.y + 10;
                }
            }

            doc.strokeColor('#0f172a').lineWidth(1).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            y += 4;
            doc.fontSize(isDetallado ? 7 : 7.5).font('Helvetica-Bold').fillColor('#0f172a');
            const totalLabel = (groupingMode !== 'none') ? 'TOTAL GENERAL:' : 'TOTALES:';

            if (!isDetallado) {
                doc.text(totalLabel, startX + 2, y, { lineBreak: false });
                let tx = startX + 2 + colWResumen.num + colWResumen.code + colWResumen.name + colWResumen.cargo + colWResumen.dias;
                doc.text(formatCurrency(grandTotals.sueldoQuincenal), tx, y, { width: colWResumen.sueldoQuincenal - 3, align: 'right', lineBreak: false }); tx += colWResumen.sueldoQuincenal;
                doc.text(formatCurrency(grandTotals.ingresosAdic), tx, y, { width: colWResumen.ingresosAdic - 3, align: 'right', lineBreak: false }); tx += colWResumen.ingresosAdic;
                doc.text(formatCurrency(grandTotals.devengado), tx, y, { width: colWResumen.devengado - 3, align: 'right', lineBreak: false }); tx += colWResumen.devengado;
                doc.text(formatCurrency(grandTotals.isss), tx, y, { width: colWResumen.isss - 3, align: 'right', lineBreak: false }); tx += colWResumen.isss;
                doc.text(formatCurrency(grandTotals.afp), tx, y, { width: colWResumen.afp - 3, align: 'right', lineBreak: false }); tx += colWResumen.afp;
                doc.text(formatCurrency(grandTotals.renta), tx, y, { width: colWResumen.renta - 3, align: 'right', lineBreak: false }); tx += colWResumen.renta;
                doc.text(formatCurrency(grandTotals.otrasDed), tx, y, { width: colWResumen.otrasDed - 3, align: 'right', lineBreak: false }); tx += colWResumen.otrasDed;
                doc.text(formatCurrency(grandTotals.totalDed), tx, y, { width: colWResumen.totalDed - 3, align: 'right', lineBreak: false }); tx += colWResumen.totalDed;
                doc.text(formatCurrency(grandTotals.neto), tx, y, { width: colWResumen.neto - 3, align: 'right', lineBreak: false });
            } else {
                doc.text(totalLabel, startX + 2, y, { lineBreak: false });
                let tx = startX + 2 + colWDetallado.num + colWDetallado.code + colWDetallado.name;
                doc.text(formatCurrency(grandTotals.sueldoQuincenal), tx, y, { width: colWDetallado.sueldo - 2, align: 'right', lineBreak: false }); tx += colWDetallado.sueldo;
                dynamicIngresoCols.forEach(col => {
                    doc.text(formatCurrency(grandTotals.dynIngresos[col.codigo]), tx, y, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                    tx += colWDetallado.dyn;
                });
                doc.text(formatCurrency(grandTotals.devengado), tx, y, { width: colWDetallado.devengado - 2, align: 'right', lineBreak: false }); tx += colWDetallado.devengado;
                doc.text(formatCurrency(grandTotals.isss), tx, y, { width: colWDetallado.isss - 2, align: 'right', lineBreak: false }); tx += colWDetallado.isss;
                doc.text(formatCurrency(grandTotals.afp), tx, y, { width: colWDetallado.afp - 2, align: 'right', lineBreak: false }); tx += colWDetallado.afp;
                doc.text(formatCurrency(grandTotals.renta), tx, y, { width: colWDetallado.renta - 2, align: 'right', lineBreak: false }); tx += colWDetallado.renta;
                dynamicDeduccionCols.forEach(col => {
                    doc.text(formatCurrency(grandTotals.dynDeducciones[col.codigo]), tx, y, { width: colWDetallado.dyn - 2, align: 'right', lineBreak: false });
                    tx += colWDetallado.dyn;
                });
                doc.text(formatCurrency(grandTotals.totalDed), tx, y, { width: colWDetallado.totalDed - 2, align: 'right', lineBreak: false }); tx += colWDetallado.totalDed;
                doc.text(formatCurrency(grandTotals.neto), tx, y, { width: colWDetallado.neto - 2, align: 'right', lineBreak: false });
            }

            y += 11;
            doc.strokeColor('#0f172a').lineWidth(0.5).moveTo(startX, y).lineTo(startX + contentWidth, y).stroke();
            doc.strokeColor('#0f172a').lineWidth(0.5).moveTo(startX, y + 2).lineTo(startX + contentWidth, y + 2).stroke();
            y += 12;
        }

        renderClosingFooter(doc, startX, y, planillas.length, 'Empleados');
        renderPageNumbers(doc);
        doc.end();
    } catch (error) {
        console.error('[exportPlanillaReportePDF Error]:', error);
        res.status(500).json({ message: 'Error generando PDF de la planilla: ' + error.message });
    }
};

module.exports = { formatCurrency, fitText, renderHeader, renderClosingFooter, renderPageNumbers, makeShortTitle, exportPlanillaReportePDF };
