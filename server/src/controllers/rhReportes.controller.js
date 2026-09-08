const pool = require('../config/db');
const excelService = require('../services/excel.service');
const rhReportPdfService = require('../services/rhReportPdf.service');
const reportPdfHelper = require('../utils/reportPdfHelper');

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * 1. Planilla de ISSS
 */
const getPlanillaIsssReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
        const quincena = req.query.quincena || 'todas';
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                p.id, p.empleado_id, p.dias_trabajados, p.sueldo_base, p.total_percepciones,
                p.descuento_isss, p.quincena,
                e.codigo, e.nombres, e.apellidos, e.num_dui, e.num_isss, e.es_jubilado
            FROM rh_planillas p
            JOIN rh_empleados e ON p.empleado_id = e.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
        `;
        const params = [companyId, anio, mes];

        if (quincena && quincena !== 'todas') {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        query += ` ORDER BY e.codigo ASC, p.id ASC`;

        const [rows] = await pool.query(query, params);

        // Group / consolidate per employee
        const empMap = new Map();
        rows.forEach(r => {
            const empId = r.empleado_id;
            const perc = parseFloat(r.total_percepciones || 0);
            const dias = parseInt(r.dias_trabajados || 0);
            const isssLab = parseFloat(r.descuento_isss || 0);

            if (!empMap.has(empId)) {
                empMap.set(empId, {
                    id: empId,
                    codigo: r.codigo,
                    nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                    num_isss: r.num_isss || '',
                    num_dui: r.num_dui || '',
                    dias_trabajados: dias,
                    salario_devengado: perc,
                    isss_laboral: isssLab,
                    es_jubilado: r.es_jubilado
                });
            } else {
                const existing = empMap.get(empId);
                existing.dias_trabajados += dias;
                existing.salario_devengado += perc;
                existing.isss_laboral += isssLab;
            }
        });

        // Calculate patronal ISSS (7.5%) with legal caps ($1,000 monthly / $500 quincenal)
        const cap = quincena === 'todas' ? 1000.00 : 500.00;
        const items = Array.from(empMap.values()).map(emp => {
            // If employee had 0 isss laboral (e.g. exempt), check if patronal applies
            const cotizable = Math.min(emp.salario_devengado, cap);
            const isssPatronal = emp.isss_laboral > 0 || !emp.es_jubilado
                ? Math.round(cotizable * 0.075 * 100) / 100
                : 0;
            const totalIsss = Math.round((emp.isss_laboral + isssPatronal) * 100) / 100;

            return {
                ...emp,
                salario_devengado: Math.round(emp.salario_devengado * 100) / 100,
                isss_laboral: Math.round(emp.isss_laboral * 100) / 100,
                isss_patronal: isssPatronal,
                total_isss: totalIsss
            };
        });

        const totals = items.reduce((acc, curr) => {
            acc.salario_devengado += curr.salario_devengado;
            acc.isss_laboral += curr.isss_laboral;
            acc.isss_patronal += curr.isss_patronal;
            acc.total_isss += curr.total_isss;
            return acc;
        }, { salario_devengado: 0, isss_laboral: 0, isss_patronal: 0, total_isss: 0 });

        const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
        const quincenaText = quincena === 'primera' ? 'PRIMERA QUINCENA' : quincena === 'segunda' ? 'SEGUNDA QUINCENA' : 'TODO EL MES';
        const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
        const subtitle = `PLANILLA DE APORTES AL RÉGIMEN GENERAL DE SALUD`;

        const reportData = {
            company,
            items,
            totals,
            periodText,
            subtitle,
            anio,
            mes,
            quincena
        };

        if (format === 'json') {
            return res.json(reportData);
        }

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - PLANILLA DE ISSS - ${periodText}`,
                sheets: [{
                    name: 'Planilla ISSS',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre del Empleado', key: 'nombre', width: 35 },
                        { header: 'No. ISSS', key: 'num_isss', width: 16 },
                        { header: 'No. DUI', key: 'num_dui', width: 16 },
                        { header: 'Días', key: 'dias_trabajados', width: 8 },
                        { header: 'Salario Devengado ($)', key: 'salario_devengado', width: 18 },
                        { header: 'ISSS Laboral (3%) ($)', key: 'isss_laboral', width: 18 },
                        { header: 'ISSS Patronal (7.5%) ($)', key: 'isss_patronal', width: 18 },
                        { header: 'Total ISSS ($)', key: 'total_isss', width: 18 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            num_isss: item.num_isss,
                            num_dui: item.num_dui,
                            dias_trabajados: item.dias_trabajados,
                            salario_devengado: item.salario_devengado.toFixed(2),
                            isss_laboral: item.isss_laboral.toFixed(2),
                            isss_patronal: item.isss_patronal.toFixed(2),
                            total_isss: item.total_isss.toFixed(2)
                        })),
                        {
                            num: '',
                            codigo: 'TOTALES',
                            nombre: '',
                            num_isss: '',
                            num_dui: '',
                            dias_trabajados: '',
                            salario_devengado: totals.salario_devengado.toFixed(2),
                            isss_laboral: totals.isss_laboral.toFixed(2),
                            isss_patronal: totals.isss_patronal.toFixed(2),
                            total_isss: totals.total_isss.toFixed(2)
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `planilla_isss_${anio}_${mes}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generatePlanillaIsssPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="planilla_isss_${anio}_${mes}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getPlanillaIsssReport error]:', error);
        res.status(500).json({ message: 'Error al generar el reporte de planilla de ISSS: ' + error.message });
    }
};

/**
 * 2. Planilla de AFP
 */
const getPlanillaAfpReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
        const quincena = req.query.quincena || 'todas';
        const afpId = req.query.afp_id;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                p.id, p.empleado_id, p.dias_trabajados, p.sueldo_base, p.total_percepciones,
                p.descuento_afp, p.quincena,
                e.codigo, e.nombres, e.apellidos, e.num_dui, e.num_nup, e.afp_id,
                COALESCE(a.descripcion, 'SIN AFP REGISTRADA') AS afp_nombre
            FROM rh_planillas p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_afp a ON e.afp_id = a.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
        `;
        const params = [companyId, anio, mes];

        if (quincena && quincena !== 'todas') {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        if (afpId && afpId !== 'all') {
            query += ` AND e.afp_id = ?`;
            params.push(afpId);
        }
        query += ` ORDER BY a.descripcion ASC, e.codigo ASC, p.id ASC`;

        const [rows] = await pool.query(query, params);

        // Group per employee first to consolidate
        const empMap = new Map();
        rows.forEach(r => {
            const empId = r.empleado_id;
            const perc = parseFloat(r.total_percepciones || 0);
            const dias = parseInt(r.dias_trabajados || 0);
            const afpLab = parseFloat(r.descuento_afp || 0);

            if (!empMap.has(empId)) {
                empMap.set(empId, {
                    id: empId,
                    codigo: r.codigo,
                    nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                    num_nup: r.num_nup || '',
                    num_dui: r.num_dui || '',
                    afp_id: r.afp_id || 0,
                    afp_nombre: r.afp_nombre || 'SIN AFP',
                    dias_trabajados: dias,
                    salario_cotizable: perc,
                    afp_laboral: afpLab
                });
            } else {
                const existing = empMap.get(empId);
                existing.dias_trabajados += dias;
                existing.salario_cotizable += perc;
                existing.afp_laboral += afpLab;
            }
        });

        // Group by AFP
        const groupsMap = new Map();
        empMap.forEach(emp => {
            const cotiz = Math.round(emp.salario_cotizable * 100) / 100;
            const afpLab = Math.round(emp.afp_laboral * 100) / 100;
            // 8.75% employer contribution
            const afpPatronal = Math.round(cotiz * 0.0875 * 100) / 100;
            const totalAfp = Math.round((afpLab + afpPatronal) * 100) / 100;

            const item = {
                ...emp,
                salario_cotizable: cotiz,
                afp_laboral: afpLab,
                afp_patronal: afpPatronal,
                total_afp: totalAfp
            };

            const afpKey = emp.afp_nombre;
            if (!groupsMap.has(afpKey)) {
                groupsMap.set(afpKey, {
                    afp_nombre: afpKey,
                    items: [item],
                    subtotal_cotizable: cotiz,
                    subtotal_afp_laboral: afpLab,
                    subtotal_afp_patronal: afpPatronal,
                    subtotal_total_afp: totalAfp
                });
            } else {
                const grp = groupsMap.get(afpKey);
                grp.items.push(item);
                grp.subtotal_cotizable += cotiz;
                grp.subtotal_afp_laboral += afpLab;
                grp.subtotal_afp_patronal += afpPatronal;
                grp.subtotal_total_afp += totalAfp;
            }
        });

        const groups = Array.from(groupsMap.values()).map(g => ({
            ...g,
            subtotal_cotizable: Math.round(g.subtotal_cotizable * 100) / 100,
            subtotal_afp_laboral: Math.round(g.subtotal_afp_laboral * 100) / 100,
            subtotal_afp_patronal: Math.round(g.subtotal_afp_patronal * 100) / 100,
            subtotal_total_afp: Math.round(g.subtotal_total_afp * 100) / 100
        }));

        const totals = groups.reduce((acc, curr) => {
            acc.salario_cotizable += curr.subtotal_cotizable;
            acc.afp_laboral += curr.subtotal_afp_laboral;
            acc.afp_patronal += curr.subtotal_afp_patronal;
            acc.total_afp += curr.subtotal_total_afp;
            return acc;
        }, { salario_cotizable: 0, afp_laboral: 0, afp_patronal: 0, total_afp: 0 });

        const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
        const quincenaText = quincena === 'primera' ? 'PRIMERA QUINCENA' : quincena === 'segunda' ? 'SEGUNDA QUINCENA' : 'TODO EL MES';
        const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
        const subtitle = `PLANILLA DE COTIZACIONES A FONDOS DE PENSIONES`;

        const reportData = {
            company,
            groups,
            totals,
            periodText,
            subtitle,
            anio,
            mes,
            quincena
        };

        if (format === 'json') {
            return res.json(reportData);
        }

        if (format === 'excel') {
            const excelRows = [];
            groups.forEach(g => {
                g.items.forEach((item, idx) => {
                    excelRows.push({
                        num: idx + 1,
                        afp: g.afp_nombre,
                        codigo: item.codigo,
                        nombre: item.nombre,
                        num_nup: item.num_nup,
                        num_dui: item.num_dui,
                        dias_trabajados: item.dias_trabajados,
                        cotizable: item.salario_cotizable.toFixed(2),
                        laboral: item.afp_laboral.toFixed(2),
                        patronal: item.afp_patronal.toFixed(2),
                        total: item.total_afp.toFixed(2)
                    });
                });
                excelRows.push({
                    num: '',
                    afp: `SUBTOTAL ${g.afp_nombre}`,
                    codigo: '',
                    nombre: '',
                    num_nup: '',
                    num_dui: '',
                    dias_trabajados: '',
                    cotizable: g.subtotal_cotizable.toFixed(2),
                    laboral: g.subtotal_afp_laboral.toFixed(2),
                    patronal: g.subtotal_afp_patronal.toFixed(2),
                    total: g.subtotal_total_afp.toFixed(2)
                });
            });
            excelRows.push({
                num: '',
                afp: 'TOTAL GENERAL',
                codigo: '',
                nombre: '',
                num_nup: '',
                num_dui: '',
                dias_trabajados: '',
                cotizable: totals.salario_cotizable.toFixed(2),
                laboral: totals.afp_laboral.toFixed(2),
                patronal: totals.afp_patronal.toFixed(2),
                total: totals.total_afp.toFixed(2)
            });

            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - PLANILLA DE AFP - ${periodText}`,
                sheets: [{
                    name: 'Planilla AFP',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'AFP', key: 'afp', width: 18 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre del Empleado', key: 'nombre', width: 35 },
                        { header: 'No. NUP', key: 'num_nup', width: 16 },
                        { header: 'No. DUI', key: 'num_dui', width: 16 },
                        { header: 'Días', key: 'dias_trabajados', width: 8 },
                        { header: 'Salario Cotizable ($)', key: 'cotizable', width: 18 },
                        { header: 'Cotiz. Laboral (7.25%) ($)', key: 'laboral', width: 22 },
                        { header: 'Aporte Patrono (8.75%) ($)', key: 'patronal', width: 22 },
                        { header: 'Total Aporte (16.00%) ($)', key: 'total', width: 20 }
                    ],
                    data: excelRows
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `planilla_afp_${anio}_${mes}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generatePlanillaAfpPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="planilla_afp_${anio}_${mes}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getPlanillaAfpReport error]:', error);
        res.status(500).json({ message: 'Error al generar el reporte de planilla de AFP: ' + error.message });
    }
};

/**
 * 3. Informe Mensual de Retención de Renta (ISR)
 */
const getInformeRentaReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
        const quincena = req.query.quincena || 'todas';
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                p.id, p.empleado_id, p.dias_trabajados, p.total_percepciones,
                p.descuento_isss, p.descuento_afp, p.descuento_renta, p.monto_recibir, p.quincena,
                e.codigo, e.nombres, e.apellidos, e.num_dui, e.num_nit
            FROM rh_planillas p
            JOIN rh_empleados e ON p.empleado_id = e.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
        `;
        const params = [companyId, anio, mes];

        if (quincena && quincena !== 'todas') {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        query += ` ORDER BY e.codigo ASC, p.id ASC`;

        const [rows] = await pool.query(query, params);

        const empMap = new Map();
        rows.forEach(r => {
            const empId = r.empleado_id;
            const perc = parseFloat(r.total_percepciones || 0);
            const isss = parseFloat(r.descuento_isss || 0);
            const afp = parseFloat(r.descuento_afp || 0);
            const renta = parseFloat(r.descuento_renta || 0);
            const monto = parseFloat(r.monto_recibir || 0);

            if (!empMap.has(empId)) {
                empMap.set(empId, {
                    id: empId,
                    codigo: r.codigo,
                    nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                    num_dui: r.num_dui || '',
                    num_nit: r.num_nit || '',
                    total_percepciones: perc,
                    descuento_isss: isss,
                    descuento_afp: afp,
                    descuento_renta: renta,
                    monto_recibir: monto
                });
            } else {
                const existing = empMap.get(empId);
                existing.total_percepciones += perc;
                existing.descuento_isss += isss;
                existing.descuento_afp += afp;
                existing.descuento_renta += renta;
                existing.monto_recibir += monto;
            }
        });

        const items = Array.from(empMap.values()).map(emp => {
            const devengado = Math.round(emp.total_percepciones * 100) / 100;
            const isss = Math.round(emp.descuento_isss * 100) / 100;
            const afp = Math.round(emp.descuento_afp * 100) / 100;
            const gravable = Math.max(0, Math.round((devengado - isss - afp) * 100) / 100);
            const renta = Math.round(emp.descuento_renta * 100) / 100;
            const liquido = Math.round(emp.monto_recibir * 100) / 100;

            return {
                ...emp,
                total_percepciones: devengado,
                descuento_isss: isss,
                descuento_afp: afp,
                renta_gravable: gravable,
                descuento_renta: renta,
                monto_recibir: liquido
            };
        });

        const totals = items.reduce((acc, curr) => {
            acc.total_percepciones += curr.total_percepciones;
            acc.descuento_isss += curr.descuento_isss;
            acc.descuento_afp += curr.descuento_afp;
            acc.renta_gravable += curr.renta_gravable;
            acc.descuento_renta += curr.descuento_renta;
            acc.monto_recibir += curr.monto_recibir;
            return acc;
        }, { total_percepciones: 0, descuento_isss: 0, descuento_afp: 0, renta_gravable: 0, descuento_renta: 0, monto_recibir: 0 });

        const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
        const quincenaText = quincena === 'primera' ? 'PRIMERA QUINCENA' : quincena === 'segunda' ? 'SEGUNDA QUINCENA' : 'TODO EL MES';
        const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
        const subtitle = `INFORME OFICIAL DE RETENCIONES DE IMPUESTO SOBRE LA RENTA (F-910)`;

        const reportData = {
            company,
            items,
            totals,
            periodText,
            subtitle,
            anio,
            mes,
            quincena
        };

        if (format === 'json') {
            return res.json(reportData);
        }

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - INFORME MENSUAL DE RENTA - ${periodText}`,
                sheets: [{
                    name: 'Informe Renta',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre del Empleado', key: 'nombre', width: 35 },
                        { header: 'No. DUI', key: 'num_dui', width: 16 },
                        { header: 'No. NIT', key: 'num_nit', width: 18 },
                        { header: 'Devengado ($)', key: 'total_percepciones', width: 16 },
                        { header: 'ISSS ($)', key: 'descuento_isss', width: 14 },
                        { header: 'AFP ($)', key: 'descuento_afp', width: 14 },
                        { header: 'Renta Gravable ($)', key: 'renta_gravable', width: 18 },
                        { header: 'ISR Retenido ($)', key: 'descuento_renta', width: 16 },
                        { header: 'Líquido Pagado ($)', key: 'monto_recibir', width: 16 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            num_dui: item.num_dui,
                            num_nit: item.num_nit,
                            total_percepciones: item.total_percepciones.toFixed(2),
                            descuento_isss: item.descuento_isss.toFixed(2),
                            descuento_afp: item.descuento_afp.toFixed(2),
                            renta_gravable: item.renta_gravable.toFixed(2),
                            descuento_renta: item.descuento_renta.toFixed(2),
                            monto_recibir: item.monto_recibir.toFixed(2)
                        })),
                        {
                            num: '',
                            codigo: 'TOTALES',
                            nombre: '',
                            num_dui: '',
                            num_nit: '',
                            total_percepciones: totals.total_percepciones.toFixed(2),
                            descuento_isss: totals.descuento_isss.toFixed(2),
                            descuento_afp: totals.descuento_afp.toFixed(2),
                            renta_gravable: totals.renta_gravable.toFixed(2),
                            descuento_renta: totals.descuento_renta.toFixed(2),
                            monto_recibir: totals.monto_recibir.toFixed(2)
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `informe_renta_${anio}_${mes}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generateInformeRentaPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="informe_renta_${anio}_${mes}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getInformeRentaReport error]:', error);
        res.status(500).json({ message: 'Error al generar el informe mensual de renta: ' + error.message });
    }
};

/**
 * 4. Constancia de Sueldo
 */
const getConstanciaSueldo = async (req, res) => {
    try {
        const companyId = req.company_id;
        const empleadoId = req.query.empleado_id;
        const dirigidaA = req.query.dirigida_a || 'A QUIEN INTERESE';
        const incluirDeducciones = req.query.incluir_deducciones !== 'false' && req.query.incluir_deducciones !== false;
        const format = req.query.format;

        if (!empleadoId) {
            return res.status(400).json({ message: 'Debe seleccionar un empleado para generar la constancia de sueldo' });
        }

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        const [empRows] = await pool.query(`
            SELECT 
                e.*,
                c.descripcion AS cargo_nombre,
                d.descripcion AS departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.id = ? AND e.company_id = ?
        `, [empleadoId, companyId]);

        if (empRows.length === 0) {
            return res.status(404).json({ message: 'Empleado no encontrado' });
        }
        const employee = empRows[0];

        // Retrieve RH config
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`, [companyId]);
        const rhConfig = rhCfg[0] || {};

        // Calculate estimated monthly income tax (ISR) for the employee
        const sueldoBruto = parseFloat(employee.sueldo_base || 0) + parseFloat(employee.bonificacion_fija || 0);
        const isss = Math.min(sueldoBruto * 0.03, 30.00);
        const afp = sueldoBruto * 0.0725;
        const gravable = Math.max(0, sueldoBruto - isss - afp);

        // Check if there are active renta brackets in rh_renta_config
        let rentaEstimada = 0;
        try {
            const [brackets] = await pool.query(`
                SELECT desde, hasta, porcentaje, cuota_fija, sobre_exceso
                FROM rh_renta_config_detalle d
                JOIN rh_renta_config c ON d.renta_config_id = c.id
                WHERE c.company_id = ? AND c.tipo = 'mensual'
                ORDER BY desde ASC
            `, [companyId]);

            if (brackets.length > 0) {
                for (const b of brackets) {
                    const desde = parseFloat(b.desde || 0);
                    const hasta = b.hasta !== null ? parseFloat(b.hasta) : Infinity;
                    if (gravable >= desde && gravable <= hasta) {
                        const exceso = gravable - parseFloat(b.sobre_exceso || desde);
                        rentaEstimada = parseFloat(b.cuota_fija || 0) + (exceso * (parseFloat(b.porcentaje || 0) / 100));
                        break;
                    }
                }
            } else {
                // Official standard monthly brackets (Art. 37 Ley de ISR El Salvador)
                if (gravable > 2038.10) {
                    rentaEstimada = 288.57 + ((gravable - 2038.10) * 0.30);
                } else if (gravable > 895.24) {
                    rentaEstimada = 60.00 + ((gravable - 895.24) * 0.20);
                } else if (gravable > 472.00) {
                    rentaEstimada = 17.67 + ((gravable - 472.00) * 0.10);
                }
            }
        } catch (_) {
            if (gravable > 2038.10) {
                rentaEstimada = 288.57 + ((gravable - 2038.10) * 0.30);
            } else if (gravable > 895.24) {
                rentaEstimada = 60.00 + ((gravable - 895.24) * 0.20);
            } else if (gravable > 472.00) {
                rentaEstimada = 17.67 + ((gravable - 472.00) * 0.10);
            }
        }
        employee.renta_estimada = Math.round(rentaEstimada * 100) / 100;

        if (format === 'json') {
            return res.json({
                employee,
                company,
                rhConfig,
                options: { dirigida_a: dirigidaA, incluir_deducciones: incluirDeducciones }
            });
        }

        const pdfBuffer = await rhReportPdfService.generateConstanciaSueldoPdf({
            employee,
            company,
            rhConfig,
            options: { dirigida_a: dirigidaA, incluir_deducciones: incluirDeducciones }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="constancia_sueldo_${employee.codigo}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getConstanciaSueldo error]:', error);
        res.status(500).json({ message: 'Error al generar la constancia de sueldo: ' + error.message });
    }
};

/**
 * 5. Carta de Renta (Constancia Anual de Retención de ISR)
 */
const getCartaRenta = async (req, res) => {
    try {
        const companyId = req.company_id;
        const empleadoId = req.query.empleado_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const format = req.query.format;

        if (!empleadoId) {
            return res.status(400).json({ message: 'Debe seleccionar un empleado para generar la carta de renta' });
        }

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        const [empRows] = await pool.query(`
            SELECT 
                e.*,
                c.descripcion AS cargo_nombre,
                d.descripcion AS departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.id = ? AND e.company_id = ?
        `, [empleadoId, companyId]);

        if (empRows.length === 0) {
            return res.status(404).json({ message: 'Empleado no encontrado' });
        }
        const employee = empRows[0];

        // Retrieve RH config
        const [rhCfg] = await pool.query(`SELECT responsable_nombre, firma_url, sello_url FROM rh_config WHERE company_id = ?`, [companyId]);
        const rhConfig = rhCfg[0] || {};

        // Query all regular payrolls for this employee in that year
        const [planillas] = await pool.query(`
            SELECT 
                COALESCE(SUM(total_percepciones), 0) AS total_devengado,
                COALESCE(SUM(descuento_isss), 0) AS total_isss,
                COALESCE(SUM(descuento_afp), 0) AS total_afp,
                COALESCE(SUM(descuento_renta), 0) AS total_renta,
                COALESCE(SUM(monto_recibir), 0) AS total_liquido
            FROM rh_planillas
            WHERE company_id = ? AND empleado_id = ? AND periodo_anio = ? AND estado != 'anulado'
        `, [companyId, empleadoId, anio]);

        // Query any vacation payrolls for that year
        const [vacaciones] = await pool.query(`
            SELECT 
                COALESCE(SUM(total_devengado), 0) AS total_devengado,
                COALESCE(SUM(descuento_isss), 0) AS total_isss,
                COALESCE(SUM(descuento_afp), 0) AS total_afp,
                COALESCE(SUM(descuento_renta), 0) AS total_renta
            FROM rh_planilla_vacaciones
            WHERE company_id = ? AND empleado_id = ? AND periodo_año = ?
        `, [companyId, empleadoId, anio]);

        // Query any aguinaldo payrolls for that year (only the taxable portion / excedente and renta)
        const [aguinaldos] = await pool.query(`
            SELECT 
                COALESCE(SUM(excedente), 0) AS aguinaldo_gravado,
                COALESCE(SUM(renta), 0) AS total_renta
            FROM rh_planilla_aguinaldos
            WHERE company_id = ? AND empleado_id = ? AND periodo_año = ?
        `, [companyId, empleadoId, anio]);

        const planDev = parseFloat(planillas[0]?.total_devengado || 0);
        const planIsss = parseFloat(planillas[0]?.total_isss || 0);
        const planAfp = parseFloat(planillas[0]?.total_afp || 0);
        const planRenta = parseFloat(planillas[0]?.total_renta || 0);

        const vacDev = parseFloat(vacaciones[0]?.total_devengado || 0);
        const vacIsss = parseFloat(vacaciones[0]?.total_isss || 0);
        const vacAfp = parseFloat(vacaciones[0]?.total_afp || 0);
        const vacRenta = parseFloat(vacaciones[0]?.total_renta || 0);

        const aguiGrav = parseFloat(aguinaldos[0]?.aguinaldo_gravado || 0);
        const aguiRenta = parseFloat(aguinaldos[0]?.total_renta || 0);

        const totalDevengado = planDev + vacDev + aguiGrav;
        const totalIsss = planIsss + vacIsss;
        const totalAfp = planAfp + vacAfp;
        const totalRenta = planRenta + vacRenta + aguiRenta;
        const rentaGravada = Math.max(0, totalDevengado - totalIsss - totalAfp);
        const totalLiquido = totalDevengado - totalIsss - totalAfp - totalRenta;

        const totals = {
            total_devengado: Math.round(totalDevengado * 100) / 100,
            total_isss: Math.round(totalIsss * 100) / 100,
            total_afp: Math.round(totalAfp * 100) / 100,
            renta_gravada: Math.round(rentaGravada * 100) / 100,
            total_renta: Math.round(totalRenta * 100) / 100,
            total_liquido: Math.round(totalLiquido * 100) / 100
        };

        if (format === 'json') {
            return res.json({
                employee,
                company,
                rhConfig,
                totals,
                anio
            });
        }

        const pdfBuffer = await rhReportPdfService.generateCartaRentaPdf({
            employee,
            company,
            rhConfig,
            totals,
            anio
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="carta_renta_${anio}_${employee.codigo}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getCartaRenta error]:', error);
        res.status(500).json({ message: 'Error al generar la carta de renta: ' + error.message });
    }
};

/**
 * 6. Listado de Empleados
 */
const getListadoEmpleadosReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const estado = req.query.estado || 'todos'; // todos, activos, inactivos
        const cargoId = req.query.cargo_id;
        const departamentoId = req.query.departamento_id;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                e.id, e.codigo, e.nombres, e.apellidos, e.num_dui, e.num_nit, e.num_isss, e.num_nup,
                e.fecha_ingreso, e.sueldo_base, e.bonificacion_fija, e.es_activo, e.telefono, e.correo,
                c.descripcion AS cargo,
                d.descripcion AS departamento,
                a.descripcion AS afp_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_afp a ON e.afp_id = a.id
            WHERE e.company_id = ?
        `;
        const params = [companyId];

        if (estado === 'activos') {
            query += ` AND e.es_activo = 1`;
        } else if (estado === 'inactivos') {
            query += ` AND (e.es_activo = 0 OR e.es_activo IS NULL)`;
        }

        if (cargoId && cargoId !== 'all') {
            query += ` AND e.cargo_id = ?`;
            params.push(cargoId);
        }

        if (departamentoId && departamentoId !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(departamentoId);
        }

        query += ` ORDER BY e.codigo ASC`;

        const [rows] = await pool.query(query, params);

        let totalActivos = 0;
        let totalInactivos = 0;
        let totalSueldos = 0;

        const items = rows.map(r => {
            const isActivo = r.es_activo === 1 || r.es_activo === true || r.es_activo === '1';
            if (isActivo) totalActivos++;
            else totalInactivos++;

            const sueldo = parseFloat(r.sueldo_base || 0);
            totalSueldos += sueldo;

            return {
                ...r,
                nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                sueldo_base: sueldo,
                es_activo: isActivo ? 1 : 0
            };
        });

        const totals = {
            total_empleados: items.length,
            total_activos: totalActivos,
            total_inactivos: totalInactivos,
            total_sueldos: Math.round(totalSueldos * 100) / 100,
            sueldo_promedio: items.length > 0 ? Math.round((totalSueldos / items.length) * 100) / 100 : 0
        };

        const subtitle = `FILTRO ESTADO: ${estado.toUpperCase()}`;
        const periodText = `EMITIDO AL: ${reportPdfHelper.formatDate(new Date())}`;

        const reportData = {
            company,
            items,
            totals,
            subtitle,
            periodText
        };

        if (format === 'json') {
            return res.json(reportData);
        }

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - LISTADO DE EMPLEADOS`,
                sheets: [{
                    name: 'Empleados',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre Completo', key: 'nombre', width: 35 },
                        { header: 'Cargo / Puesto', key: 'cargo', width: 22 },
                        { header: 'Departamento', key: 'departamento', width: 22 },
                        { header: 'F. Ingreso', key: 'fecha_ingreso', width: 14 },
                        { header: 'No. DUI', key: 'num_dui', width: 16 },
                        { header: 'No. NIT', key: 'num_nit', width: 18 },
                        { header: 'No. ISSS', key: 'num_isss', width: 16 },
                        { header: 'No. NUP', key: 'num_nup', width: 16 },
                        { header: 'AFP', key: 'afp_nombre', width: 16 },
                        { header: 'Teléfono', key: 'telefono', width: 15 },
                        { header: 'Sueldo Base ($)', key: 'sueldo_base', width: 16 },
                        { header: 'Estado', key: 'estado', width: 14 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            cargo: item.cargo || '',
                            departamento: item.departamento || '',
                            fecha_ingreso: reportPdfHelper.formatDate(item.fecha_ingreso),
                            num_dui: item.num_dui || '',
                            num_nit: item.num_nit || '',
                            num_isss: item.num_isss || '',
                            num_nup: item.num_nup || '',
                            afp_nombre: item.afp_nombre || '',
                            telefono: item.telefono || '',
                            sueldo_base: item.sueldo_base.toFixed(2),
                            estado: item.es_activo ? 'ACTIVO' : 'INACTIVO'
                        })),
                        {
                            num: '',
                            codigo: 'TOTALES',
                            nombre: `TOTAL: ${totals.total_empleados} (ACTIVOS: ${totals.total_activos}, INACTIVOS: ${totals.total_inactivos})`,
                            cargo: '',
                            departamento: '',
                            fecha_ingreso: '',
                            num_dui: '',
                            num_nit: '',
                            num_isss: '',
                            num_nup: '',
                            afp_nombre: '',
                            telefono: '',
                            sueldo_base: totals.total_sueldos.toFixed(2),
                            estado: ''
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, 'listado_empleados.xlsx');
        }

        const pdfBuffer = await rhReportPdfService.generateListadoEmpleadosPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="listado_empleados.pdf"');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getListadoEmpleadosReport error]:', error);
        res.status(500).json({ message: 'Error al generar el listado de empleados: ' + error.message });
    }
};

/**
 * 7. Planilla de Aportes a INSAFORP / INCAF (1% Patronal)
 */
const getPlanillaInsaforpReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
        const quincena = req.query.quincena || 'todas';
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                p.id, p.empleado_id, p.dias_trabajados, p.sueldo_base, p.total_percepciones,
                p.quincena,
                e.codigo, e.nombres, e.apellidos, e.num_dui, e.num_isss, e.es_jubilado
            FROM rh_planillas p
            JOIN rh_empleados e ON p.empleado_id = e.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
        `;
        const params = [companyId, anio, mes];

        if (quincena && quincena !== 'todas') {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        query += ` ORDER BY e.codigo ASC, p.id ASC`;

        const [rows] = await pool.query(query, params);

        // Group per employee
        const empMap = new Map();
        rows.forEach(r => {
            const empId = r.empleado_id;
            const perc = parseFloat(r.total_percepciones || 0);
            const dias = parseInt(r.dias_trabajados || 0);

            if (!empMap.has(empId)) {
                empMap.set(empId, {
                    id: empId,
                    codigo: r.codigo,
                    nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                    num_isss: r.num_isss || '',
                    num_dui: r.num_dui || '',
                    dias_trabajados: dias,
                    salario_devengado: perc,
                    es_jubilado: r.es_jubilado
                });
            } else {
                const existing = empMap.get(empId);
                existing.dias_trabajados += dias;
                existing.salario_devengado += perc;
            }
        });

        const cap = quincena === 'todas' ? 1000.00 : 500.00;
        const items = Array.from(empMap.values()).map(emp => {
            const cotizable = Math.min(emp.salario_devengado, cap);
            const aporteInsaforp = Math.round(cotizable * 0.01 * 100) / 100;

            return {
                ...emp,
                salario_devengado: Math.round(emp.salario_devengado * 100) / 100,
                base_cotizable: Math.round(cotizable * 100) / 100,
                aporte_insaforp: aporteInsaforp
            };
        });

        const totals = items.reduce((acc, curr) => {
            acc.total_devengado += curr.salario_devengado;
            acc.total_cotizable += curr.base_cotizable;
            acc.total_aporte += curr.aporte_insaforp;
            return acc;
        }, { total_devengado: 0, total_cotizable: 0, total_aporte: 0, total_empleados: items.length });

        const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
        const quincenaText = quincena === 'primera' ? 'PRIMERA QUINCENA' : quincena === 'segunda' ? 'SEGUNDA QUINCENA' : 'TODO EL MES';
        const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
        const subtitle = `APORTE PATRONAL DEL 1% (LEY DE FORMACIÓN PROFESIONAL / INCAF)`;

        const reportData = {
            company,
            items,
            totals,
            periodText,
            subtitle,
            anio,
            mes,
            quincena
        };

        if (format === 'json') {
            return res.json(reportData);
        }

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - APORTE INSAFORP - ${periodText}`,
                sheets: [{
                    name: 'Aporte INSAFORP',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre del Empleado', key: 'nombre', width: 35 },
                        { header: 'No. DUI', key: 'num_dui', width: 16 },
                        { header: 'No. ISSS', key: 'num_isss', width: 16 },
                        { header: 'Días', key: 'dias_trabajados', width: 8 },
                        { header: 'Salario Devengado ($)', key: 'salario_devengado', width: 18 },
                        { header: 'Base Cotizable ($)', key: 'base_cotizable', width: 18 },
                        { header: 'Aporte INCAF (1%) ($)', key: 'aporte_insaforp', width: 18 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            num_dui: item.num_dui,
                            num_isss: item.num_isss,
                            dias_trabajados: item.dias_trabajados,
                            salario_devengado: item.salario_devengado.toFixed(2),
                            base_cotizable: item.base_cotizable.toFixed(2),
                            aporte_insaforp: item.aporte_insaforp.toFixed(2)
                        })),
                        {
                            num: '',
                            codigo: 'TOTALES',
                            nombre: `${items.length} Cotizantes`,
                            num_dui: '',
                            num_isss: '',
                            dias_trabajados: '',
                            salario_devengado: totals.total_devengado.toFixed(2),
                            base_cotizable: totals.total_cotizable.toFixed(2),
                            aporte_insaforp: totals.total_aporte.toFixed(2)
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Aporte_INSAFORP_${anio}_${mes}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generatePlanillaInsaforpPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Aporte_INSAFORP_${anio}_${mes}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getPlanillaInsaforpReport error]:', error);
        res.status(500).json({ message: 'Error al generar planilla de INSAFORP: ' + error.message });
    }
};

/**
 * 8. Costo Laboral Patronal (Cargas Sociales)
 */
const getCostoLaboralReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
        const quincena = req.query.quincena || 'todas';
        const departamento_id = req.query.departamento_id;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                p.id, p.empleado_id, p.total_percepciones, p.quincena,
                e.codigo, e.nombres, e.apellidos, e.es_jubilado,
                d.descripcion as departamento_nombre
            FROM rh_planillas p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
        `;
        const params = [companyId, anio, mes];

        if (quincena && quincena !== 'todas') {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        if (departamento_id && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(departamento_id);
        }
        query += ` ORDER BY d.descripcion ASC, e.codigo ASC`;

        const [rows] = await pool.query(query, params);

        const empMap = new Map();
        rows.forEach(r => {
            const empId = r.empleado_id;
            const perc = parseFloat(r.total_percepciones || 0);

            if (!empMap.has(empId)) {
                empMap.set(empId, {
                    id: empId,
                    codigo: r.codigo,
                    nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                    departamento: r.departamento_nombre || 'GENERAL',
                    salario_devengado: perc,
                    es_jubilado: r.es_jubilado
                });
            } else {
                const existing = empMap.get(empId);
                existing.salario_devengado += perc;
            }
        });

        const capIsss = quincena === 'todas' ? 1000.00 : 500.00;
        const items = Array.from(empMap.values()).map(emp => {
            const dev = Math.round(emp.salario_devengado * 100) / 100;
            const cotIsss = Math.min(dev, capIsss);
            const isssPat = emp.es_jubilado ? 0 : Math.round(cotIsss * 0.075 * 100) / 100;
            const afpPat = emp.es_jubilado ? 0 : Math.round(dev * 0.0875 * 100) / 100;
            const incaf = Math.round(cotIsss * 0.01 * 100) / 100;
            const provVac = Math.round(dev * 0.0541 * 100) / 100;
            const provAguin = Math.round(dev * 0.0833 * 100) / 100;
            const provIndem = Math.round(dev * 0.0833 * 100) / 100;
            const costoTotal = Math.round((dev + isssPat + afpPat + incaf + provVac + provAguin + provIndem) * 100) / 100;

            return {
                ...emp,
                salario_devengado: dev,
                isss_patronal: isssPat,
                afp_patronal: afpPat,
                insaforp: incaf,
                prov_vacacion: provVac,
                prov_aguinaldo: provAguin,
                prov_indemnizacion: provIndem,
                costo_total: costoTotal
            };
        });

        const totals = items.reduce((acc, curr) => {
            acc.total_devengado += curr.salario_devengado;
            acc.total_isss_patronal += curr.isss_patronal;
            acc.total_afp_patronal += curr.afp_patronal;
            acc.total_insaforp += curr.insaforp;
            acc.total_prov_vacacion += curr.prov_vacacion;
            acc.total_prov_aguinaldo += curr.prov_aguinaldo;
            acc.total_prov_indemnizacion += curr.prov_indemnizacion;
            acc.total_costo += curr.costo_total;
            return acc;
        }, {
            total_devengado: 0, total_isss_patronal: 0, total_afp_patronal: 0, total_insaforp: 0,
            total_prov_vacacion: 0, total_prov_aguinaldo: 0, total_prov_indemnizacion: 0, total_costo: 0,
            total_empleados: items.length
        });

        const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
        const quincenaText = quincena === 'primera' ? '1RA QUINCENA' : quincena === 'segunda' ? '2DA QUINCENA' : 'TODO EL MES';
        const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
        const subtitle = `CARGAS SOCIALES Y PROVISIONES LABORALES PATRONALES`;

        const reportData = { company, items, totals, periodText, subtitle, anio, mes, quincena };

        if (format === 'json') return res.json(reportData);

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - COSTO LABORAL - ${periodText}`,
                sheets: [{
                    name: 'Costo Laboral',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre del Empleado', key: 'nombre', width: 32 },
                        { header: 'Departamento', key: 'departamento', width: 22 },
                        { header: 'Devengado ($)', key: 'salario_devengado', width: 15 },
                        { header: 'ISSS Pat (7.5%) ($)', key: 'isss_patronal', width: 15 },
                        { header: 'AFP Pat (8.75%) ($)', key: 'afp_patronal', width: 15 },
                        { header: 'INCAF (1%) ($)', key: 'insaforp', width: 14 },
                        { header: 'Vacación (5.4%) ($)', key: 'prov_vacacion', width: 15 },
                        { header: 'Aguinaldo (8.3%) ($)', key: 'prov_aguinaldo', width: 15 },
                        { header: 'Indemnización (8.3%) ($)', key: 'prov_indemnizacion', width: 16 },
                        { header: 'Costo Total ($)', key: 'costo_total', width: 18 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            departamento: item.departamento,
                            salario_devengado: item.salario_devengado.toFixed(2),
                            isss_patronal: item.isss_patronal.toFixed(2),
                            afp_patronal: item.afp_patronal.toFixed(2),
                            insaforp: item.insaforp.toFixed(2),
                            prov_vacacion: item.prov_vacacion.toFixed(2),
                            prov_aguinaldo: item.prov_aguinaldo.toFixed(2),
                            prov_indemnizacion: item.prov_indemnizacion.toFixed(2),
                            costo_total: item.costo_total.toFixed(2)
                        })),
                        {
                            num: '', codigo: 'TOTALES', nombre: `${items.length} Empleados`, departamento: '',
                            salario_devengado: totals.total_devengado.toFixed(2),
                            isss_patronal: totals.total_isss_patronal.toFixed(2),
                            afp_patronal: totals.total_afp_patronal.toFixed(2),
                            insaforp: totals.total_insaforp.toFixed(2),
                            prov_vacacion: totals.total_prov_vacacion.toFixed(2),
                            prov_aguinaldo: totals.total_prov_aguinaldo.toFixed(2),
                            prov_indemnizacion: totals.total_prov_indemnizacion.toFixed(2),
                            costo_total: totals.total_costo.toFixed(2)
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Costo_Laboral_${anio}_${mes}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generateCostoLaboralPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Costo_Laboral_${anio}_${mes}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getCostoLaboralReport error]:', error);
        res.status(500).json({ message: 'Error al generar reporte de costo laboral: ' + error.message });
    }
};

/**
 * 9. Descuentos a Terceros e Institucionales
 */
const getDescuentosTercerosReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
        const quincena = req.query.quincena || 'todas';
        const tipo_descuento = req.query.tipo_descuento;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                pd.id, pd.codigo as detalle_codigo, pd.descripcion as concepto, pd.valor_ingresado,
                p.quincena, p.periodo_anio, p.periodo_mes,
                e.id as empleado_id, e.codigo, e.nombres, e.apellidos,
                d.descripcion as departamento_nombre,
                ed.numero_credito, ed.numero_cuotas, ed.cuotas_restantes, ed.valor as cuota_programada
            FROM rh_planilla_detalles pd
            JOIN rh_planillas p ON pd.planilla_id = p.id
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_descuentos_programados dp ON pd.codigo = dp.codigo AND dp.company_id = p.company_id
            LEFT JOIN rh_empleado_descuentos ed ON ed.descuento_id = dp.id AND ed.empleado_id = e.id AND ed.activo = 1
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
              AND pd.operacion = 'restar'
              AND UPPER(pd.codigo) NOT IN ('ISSS', 'AFP', 'RENTA')
              AND pd.valor_ingresado > 0
        `;
        const params = [companyId, anio, mes];

        if (quincena && quincena !== 'todas' && quincena !== 'all') {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        if (tipo_descuento && tipo_descuento !== 'all' && tipo_descuento !== 'TODOS' && tipo_descuento !== 'todos') {
            const upperTipo = tipo_descuento.toUpperCase().trim();
            if (upperTipo === 'PGR' || upperTipo.includes('PROCURADUR')) {
                query += ` AND (UPPER(pd.codigo) = 'PGR' OR UPPER(pd.descripcion) LIKE '%PGR%' OR UPPER(pd.descripcion) LIKE '%PROCURADUR%')`;
            } else if (upperTipo === 'BANCO' || upperTipo.includes('PRESTAMO')) {
                query += ` AND (UPPER(pd.codigo) = 'BANCO' OR UPPER(pd.descripcion) LIKE '%BANCO%' OR UPPER(pd.descripcion) LIKE '%PRESTAMO%')`;
            } else if (upperTipo === 'FSV' || upperTipo.includes('VIVIENDA')) {
                query += ` AND (UPPER(pd.codigo) = 'FSV' OR UPPER(pd.descripcion) LIKE '%FSV%' OR UPPER(pd.descripcion) LIKE '%FONDO SOCIAL%' OR UPPER(pd.descripcion) LIKE '%VIVIENDA%')`;
            } else if (upperTipo === 'COOP' || upperTipo.includes('COOPERATIVA')) {
                query += ` AND (UPPER(pd.codigo) LIKE '%COOP%' OR UPPER(pd.descripcion) LIKE '%COOP%')`;
            } else if (upperTipo.includes('ANTICIP')) {
                query += ` AND (UPPER(pd.codigo) LIKE '%ANTICIP%' OR UPPER(pd.descripcion) LIKE '%ANTICIP%')`;
            } else {
                query += ` AND (pd.codigo = ? OR pd.descripcion LIKE ?)`;
                params.push(tipo_descuento, `%${tipo_descuento}%`);
            }
        }
        query += ` ORDER BY pd.descripcion ASC, e.codigo ASC`;

        const [rows] = await pool.query(query, params);

        const items = rows.map(r => {
            const descontado = parseFloat(r.valor_ingresado || 0);
            const cuotasRest = r.cuotas_restantes !== null ? parseInt(r.cuotas_restantes) : null;
            const cuotasTot = r.numero_cuotas !== null ? parseInt(r.numero_cuotas) : null;
            const saldoEst = (cuotasRest && r.cuota_programada) ? (cuotasRest * parseFloat(r.cuota_programada)) : 0;

            let cuotasInfo = '---';
            if (cuotasTot !== null && cuotasRest !== null) {
                cuotasInfo = `${cuotasTot - cuotasRest}/${cuotasTot}`;
            }

            return {
                id: r.id,
                codigo: r.codigo,
                nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                departamento: r.departamento_nombre || 'GENERAL',
                concepto: r.concepto || 'DESCUENTO',
                referencia: r.numero_credito || '---',
                cuotas_info: cuotasInfo,
                monto_descontado: Math.round(descontado * 100) / 100,
                saldo_pendiente: Math.round(saldoEst * 100) / 100
            };
        });

        const totals = items.reduce((acc, curr) => {
            acc.total_descontado += curr.monto_descontado;
            acc.total_saldo += curr.saldo_pendiente;
            return acc;
        }, { total_descontado: 0, total_saldo: 0, total_registros: items.length });

        const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
        const quincenaText = quincena === 'primera' ? '1RA QUINCENA' : quincena === 'segunda' ? '2DA QUINCENA' : 'TODO EL MES';
        const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
        const subtitle = `RETENCIONES COMERCIALES, JUDICIALES (PGR), BANCARIAS Y ANTICIPOS`;

        const reportData = { company, items, totals, periodText, subtitle, anio, mes, quincena };

        if (format === 'json') return res.json(reportData);

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - DESCUENTOS A TERCEROS - ${periodText}`,
                sheets: [{
                    name: 'Descuentos Terceros',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Empleado', key: 'nombre', width: 35 },
                        { header: 'Departamento', key: 'departamento', width: 22 },
                        { header: 'Concepto / Tipo', key: 'concepto', width: 26 },
                        { header: 'No. Referencia / Crédito', key: 'referencia', width: 22 },
                        { header: 'Cuotas', key: 'cuotas_info', width: 12 },
                        { header: 'Monto Descontado ($)', key: 'monto_descontado', width: 18 },
                        { header: 'Saldo Estimado ($)', key: 'saldo_pendiente', width: 18 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            departamento: item.departamento,
                            concepto: item.concepto,
                            referencia: item.referencia,
                            cuotas_info: item.cuotas_info,
                            monto_descontado: item.monto_descontado.toFixed(2),
                            saldo_pendiente: item.saldo_pendiente.toFixed(2)
                        })),
                        {
                            num: '', codigo: 'TOTALES', nombre: `${items.length} Registros`, departamento: '',
                            concepto: '', referencia: '', cuotas_info: '',
                            monto_descontado: totals.total_descontado.toFixed(2),
                            saldo_pendiente: totals.total_saldo.toFixed(2)
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Descuentos_Terceros_${anio}_${mes}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generateDescuentosTercerosPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Descuentos_Terceros_${anio}_${mes}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getDescuentosTercerosReport error]:', error);
        res.status(500).json({ message: 'Error al generar reporte de descuentos a terceros: ' + error.message });
    }
};

/**
 * 10. Horas Extras y Recargos Laborales
 */
const getHorasExtrasReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes = parseInt(req.query.mes) || (new Date().getMonth() + 1);
        const quincena = req.query.quincena || 'todas';
        const departamento_id = req.query.departamento_id;
        const empleado_id = req.query.empleado_id;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                p.id as planilla_id, p.empleado_id, p.sueldo_base, p.quincena,
                e.codigo, e.nombres, e.apellidos,
                d.descripcion as departamento_nombre,
                pd.codigo as concepto_codigo, pd.descripcion as concepto_nombre, pd.tipo_valor,
                pd.valor_base, pd.valor_ingresado
            FROM rh_planillas p
            JOIN rh_empleados e ON p.empleado_id = e.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            JOIN rh_planilla_detalles pd ON pd.planilla_id = p.id
            WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
              AND pd.operacion = 'sumar'
              AND (
                  UPPER(pd.descripcion) LIKE '%EXTRA%'
                  OR UPPER(pd.descripcion) LIKE '%TURNO%'
                  OR UPPER(pd.descripcion) LIKE '%FERIADO%'
                  OR pd.codigo IN ('03', '05', '08', '11', '14')
              )
        `;
        const params = [companyId, anio, mes];

        if (quincena && quincena !== 'todas' && quincena !== 'all') {
            query += ` AND p.quincena = ?`;
            params.push(quincena);
        }
        if (departamento_id && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(departamento_id);
        }
        if (empleado_id && empleado_id !== 'all' && empleado_id !== '') {
            query += ` AND p.empleado_id = ?`;
            params.push(empleado_id);
        }
        query += ` ORDER BY e.codigo ASC`;

        const [rows] = await pool.query(query, params);

        const empMap = new Map();
        rows.forEach(r => {
            const empId = r.empleado_id;
            const desc = (r.concepto_nombre || '').toUpperCase();
            const cod = String(r.concepto_codigo || '');
            const val = parseFloat(r.valor_ingresado || 0);
            const sueldo = parseFloat(r.sueldo_base || 0);
            const valorHora = sueldo > 0 ? (sueldo / 240) : 0;

            if (!empMap.has(empId)) {
                empMap.set(empId, {
                    id: empId,
                    codigo: r.codigo,
                    nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                    departamento: r.departamento_nombre || 'GENERAL',
                    sueldo_base: sueldo,
                    monto_diurnas: 0,
                    monto_nocturnas: 0,
                    monto_feriados: 0,
                    total_recargos: 0
                });
            }

            const item = empMap.get(empId);
            let monto = val;
            // Si el valor base ya tiene el monto monetario calculado, usarlo
            if (r.valor_base && parseFloat(r.valor_base) > 0) {
                monto = parseFloat(r.valor_base);
            } else if (r.tipo_valor === 'horas') {
                if (desc.includes('NOCTURNA') || cod === '03') {
                    monto = val * valorHora * 2.25;
                } else {
                    monto = val * valorHora * 2.0;
                }
            }

            if (desc.includes('DIURNA') || cod === '08') {
                item.monto_diurnas += monto;
            } else if (desc.includes('NOCTURNA') || cod === '03') {
                item.monto_nocturnas += monto;
            } else {
                item.monto_feriados += monto;
            }
            item.total_recargos += monto;
        });

        let items = Array.from(empMap.values()).map(e => ({
            ...e,
            monto_diurnas: Math.round(e.monto_diurnas * 100) / 100,
            monto_nocturnas: Math.round(e.monto_nocturnas * 100) / 100,
            monto_feriados: Math.round(e.monto_feriados * 100) / 100,
            total_recargos: Math.round(e.total_recargos * 100) / 100
        }));

        // Si existen empleados con recargos > 0, mostrar esos; si ninguno tiene recargos, mostrar los de la planilla con 0
        const conRecargo = items.filter(i => i.total_recargos > 0);
        if (conRecargo.length > 0 && (!empleado_id || empleado_id === 'all')) {
            items = conRecargo;
        }

        const totals = items.reduce((acc, curr) => {
            acc.total_diurnas += curr.monto_diurnas;
            acc.total_nocturnas += curr.monto_nocturnas;
            acc.total_feriados += curr.monto_feriados;
            acc.total_general += curr.total_recargos;
            return acc;
        }, { total_diurnas: 0, total_nocturnas: 0, total_feriados: 0, total_general: 0, total_empleados: items.length });

        const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
        const quincenaText = quincena === 'primera' ? '1RA QUINCENA' : quincena === 'segunda' ? '2DA QUINCENA' : 'TODO EL MES';
        const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
        const subtitle = `DETALLE DE HORAS EXTRAS (100% Y 125%) Y FERIADOS LABORADOS`;

        const reportData = { company, items, totals, periodText, subtitle, anio, mes, quincena };

        if (format === 'json') return res.json(reportData);

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - HORAS EXTRAS - ${periodText}`,
                sheets: [{
                    name: 'Horas Extras',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre del Empleado', key: 'nombre', width: 35 },
                        { header: 'Departamento', key: 'departamento', width: 22 },
                        { header: 'Sueldo Base ($)', key: 'sueldo_base', width: 16 },
                        { header: 'H.E. Diurnas ($)', key: 'monto_diurnas', width: 16 },
                        { header: 'H.E. Nocturnas ($)', key: 'monto_nocturnas', width: 16 },
                        { header: 'Feriados / Turnos ($)', key: 'monto_feriados', width: 18 },
                        { header: 'Total Recargos ($)', key: 'total_recargos', width: 18 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            departamento: item.departamento,
                            sueldo_base: item.sueldo_base.toFixed(2),
                            monto_diurnas: item.monto_diurnas.toFixed(2),
                            monto_nocturnas: item.monto_nocturnas.toFixed(2),
                            monto_feriados: item.monto_feriados.toFixed(2),
                            total_recargos: item.total_recargos.toFixed(2)
                        })),
                        {
                            num: '', codigo: 'TOTALES', nombre: `${items.length} Empleados con Recargos`, departamento: '',
                            sueldo_base: '',
                            monto_diurnas: totals.total_diurnas.toFixed(2),
                            monto_nocturnas: totals.total_nocturnas.toFixed(2),
                            monto_feriados: totals.total_feriados.toFixed(2),
                            total_recargos: totals.total_general.toFixed(2)
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Horas_Extras_${anio}_${mes}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generateHorasExtrasPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Horas_Extras_${anio}_${mes}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getHorasExtrasReport error]:', error);
        res.status(500).json({ message: 'Error al generar reporte de horas extras: ' + error.message });
    }
};

/**
 * 11. Acciones de Personal y Novedades
 */
const getAccionesPersonalReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const { fecha_inicio, fecha_fin, tipo_accion, estado, departamento_id, empleado_id, format } = req.query;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                ap.*,
                e.codigo, e.nombres, e.apellidos,
                d.descripcion as departamento_nombre
            FROM rh_acciones_personal ap
            JOIN rh_empleados e ON ap.empleado_id = e.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE ap.company_id = ?
        `;
        const params = [companyId];

        if (fecha_inicio) {
            query += ` AND DATE(ap.fecha) >= ?`;
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            query += ` AND DATE(ap.fecha) <= ?`;
            params.push(fecha_fin);
        }
        if (tipo_accion && tipo_accion !== 'all' && tipo_accion !== 'TODAS' && tipo_accion !== 'todas') {
            const lowAcc = tipo_accion.toLowerCase().trim();
            query += ` AND (LOWER(ap.tipo_accion) = ? OR LOWER(ap.accion_tomar) LIKE ?)`;
            params.push(lowAcc, `%${lowAcc}%`);
        }
        if (estado && estado !== 'all' && estado !== 'TODOS' && estado !== 'todos') {
            query += ` AND LOWER(ap.estado) = LOWER(?)`;
            params.push(estado);
        }
        if (departamento_id && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(departamento_id);
        }
        if (empleado_id && empleado_id !== 'all' && empleado_id !== '') {
            query += ` AND ap.empleado_id = ?`;
            params.push(empleado_id);
        }
        query += ` ORDER BY ap.fecha DESC, ap.id DESC`;

        const [rows] = await pool.query(query, params);

        const ACCION_LABELS = {
            llamado_verbal: 'Amonestación Verbal',
            llamado_escrito_1: 'Amonestación Escrita #1',
            llamado_escrito_2: 'Amonestación Escrita #2',
            suspension: 'Suspensión Disciplinaria',
            terminacion_sin_responsabilidad: 'Terminación s/ Resp.',
            despido: 'Despido',
            otro: 'Otra Medida'
        };

        const totals = { total: rows.length, llamado_verbal: 0, llamado_escrito_1: 0, llamado_escrito_2: 0, suspension: 0, despido: 0, otros: 0 };

        const items = rows.map(r => {
            const acc = r.accion_tomar || 'otro';
            if (totals[acc] !== undefined) totals[acc]++;
            else totals.otros++;

            let accionLabel = ACCION_LABELS[acc] || r.accion_otra || 'Otra Medida';
            if (acc === 'suspension' && r.dias_suspension) {
                accionLabel += ` (${r.dias_suspension} días)`;
            }

            return {
                id: r.id,
                fecha: r.fecha,
                codigo: r.codigo,
                nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                departamento: r.departamento_nombre || 'GENERAL',
                tipo_accion: r.tipo_accion || 'ACCIÓN',
                descripcion_causa: r.descripcion_causa || r.infraccion_otra || '---',
                accion_tomar_label: accionLabel,
                estado: r.estado || 'borrador'
            };
        });

        const periodText = (fecha_inicio && fecha_fin)
            ? `DEL ${reportPdfHelper.formatDate(fecha_inicio)} AL ${reportPdfHelper.formatDate(fecha_fin)}`
            : 'HISTORIAL COMPLETO DE ACCIONES DE PERSONAL';
        const subtitle = `RESUMEN DE SANCIONES DISCIPLINARIAS Y MEDIDAS CORRECTIVAS`;

        const reportData = { company, items, totals, periodText, subtitle };

        if (format === 'json') return res.json(reportData);

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - ACCIONES DE PERSONAL - ${periodText}`,
                sheets: [{
                    name: 'Acciones Personal',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Fecha', key: 'fecha_fmt', width: 14 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Empleado', key: 'nombre', width: 35 },
                        { header: 'Departamento', key: 'departamento', width: 22 },
                        { header: 'Tipo Acción', key: 'tipo_accion', width: 20 },
                        { header: 'Causa / Infracción', key: 'descripcion_causa', width: 35 },
                        { header: 'Medida Disciplinaria', key: 'accion_tomar_label', width: 25 },
                        { header: 'Estado', key: 'estado', width: 14 }
                    ],
                    data: items.map((item, idx) => ({
                        num: idx + 1,
                        fecha_fmt: reportPdfHelper.formatDate(item.fecha),
                        codigo: item.codigo,
                        nombre: item.nombre,
                        departamento: item.departamento,
                        tipo_accion: item.tipo_accion,
                        descripcion_causa: item.descripcion_causa,
                        accion_tomar_label: item.accion_tomar_label,
                        estado: String(item.estado || '').toUpperCase()
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Acciones_Personal_${fecha_inicio || 'historial'}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generateAccionesPersonalPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Acciones_Personal.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getAccionesPersonalReport error]:', error);
        res.status(500).json({ message: 'Error al generar reporte de acciones de personal: ' + error.message });
    }
};

/**
 * 12. Provisión de Pasivos Laborales (Indemnización, Vacación, Aguinaldo)
 */
const getPasivosLaboralesReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const fecha_corte = req.query.fecha_corte || new Date().toISOString().split('T')[0];
        const departamento_id = req.query.departamento_id;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                e.id, e.codigo, e.nombres, e.apellidos, e.fecha_ingreso, e.sueldo_base,
                d.descripcion as departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.company_id = ? AND e.es_activo = 1 AND e.fecha_ingreso IS NOT NULL
        `;
        const params = [companyId];

        if (departamento_id && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(departamento_id);
        }
        query += ` ORDER BY d.descripcion ASC, e.codigo ASC`;

        const [rows] = await pool.query(query, params);

        const corteDate = new Date(fecha_corte);

        const items = rows.map(e => {
            const ingresoDate = new Date(e.fecha_ingreso);
            const diffTime = Math.max(0, corteDate.getTime() - ingresoDate.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            const anios = Math.floor(diffDays / 365.25);
            const meses = Math.floor((diffDays % 365.25) / 30.4375);
            const dias = Math.floor((diffDays % 365.25) % 30.4375);
            const antiguedadTexto = `${anios}a ${meses}m ${dias}d`;

            const sueldoBase = parseFloat(e.sueldo_base || 0);
            const salarioDiario = sueldoBase / 30;

            // Indemnización Art. 58 Código de Trabajo: 30 días de salario por año laborado (tope diario 4 salarios mínimos comercio = $48.67)
            const salarioDiarioIndem = Math.min(salarioDiario, 48.67);
            const pasivoIndemnizacion = Math.round(((diffDays / 365.25) * 30 * salarioDiarioIndem) * 100) / 100;

            // Vacación Proporcional: 15 días + 30% recargo (19.5 días de salario por año)
            const diasFraccionAnio = (diffDays % 365.25);
            const pasivoVacacion = Math.round(((diasFraccionAnio / 365.25) * 19.5 * salarioDiario) * 100) / 100;

            // Aguinaldo Proporcional: Días de ley según antigüedad
            let diasTablaAguinaldo = 15;
            if (anios >= 10) diasTablaAguinaldo = 21;
            else if (anios >= 3) diasTablaAguinaldo = 19;

            // Días transcurridos desde el 12 de diciembre anterior
            const currentYearCorte = corteDate.getFullYear();
            let baseDic = new Date(currentYearCorte, 11, 12);
            if (corteDate < baseDic) {
                baseDic = new Date(currentYearCorte - 1, 11, 12);
            }
            const diffDic = Math.max(0, Math.floor((corteDate.getTime() - baseDic.getTime()) / (1000 * 60 * 60 * 24)));
            const pasivoAguinaldo = Math.round(((diffDic / 365) * diasTablaAguinaldo * salarioDiario) * 100) / 100;

            const pasivoTotal = Math.round((pasivoIndemnizacion + pasivoVacacion + pasivoAguinaldo) * 100) / 100;

            return {
                id: e.id,
                codigo: e.codigo,
                nombre: `${e.nombres || ''} ${e.apellidos || ''}`.trim(),
                departamento: e.departamento_nombre || 'GENERAL',
                fecha_ingreso: e.fecha_ingreso,
                antiguedad_texto: antiguedadTexto,
                sueldo_base: Math.round(sueldoBase * 100) / 100,
                salario_diario: Math.round(salarioDiario * 100) / 100,
                pasivo_indemnizacion: pasivoIndemnizacion,
                pasivo_vacacion: pasivoVacacion,
                pasivo_aguinaldo: pasivoAguinaldo,
                pasivo_total: pasivoTotal
            };
        });

        const totals = items.reduce((acc, curr) => {
            acc.total_indemnizacion += curr.pasivo_indemnizacion;
            acc.total_vacacion += curr.pasivo_vacacion;
            acc.total_aguinaldo += curr.pasivo_aguinaldo;
            acc.total_pasivo += curr.pasivo_total;
            return acc;
        }, { total_indemnizacion: 0, total_vacacion: 0, total_aguinaldo: 0, total_pasivo: 0, total_empleados: items.length });

        const periodText = `FECHA DE CORTE: ${reportPdfHelper.formatDate(fecha_corte)}`;
        const subtitle = `CÁLCULO DE PASIVOS LABORALES ACUMULADOS SEGÚN CÓDIGO DE TRABAJO`;

        const reportData = { company, items, totals, periodText, subtitle, fecha_corte };

        if (format === 'json') return res.json(reportData);

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - PASIVOS LABORALES - ${periodText}`,
                sheets: [{
                    name: 'Pasivos Laborales',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Nombre del Empleado', key: 'nombre', width: 35 },
                        { header: 'F. Ingreso', key: 'ingreso_fmt', width: 14 },
                        { header: 'Antigüedad', key: 'antiguedad_texto', width: 16 },
                        { header: 'Sueldo Base ($)', key: 'sueldo_base', width: 16 },
                        { header: 'Salario Diario ($)', key: 'salario_diario', width: 16 },
                        { header: 'Indemnización ($)', key: 'pasivo_indemnizacion', width: 18 },
                        { header: 'Vacación Prop. ($)', key: 'pasivo_vacacion', width: 18 },
                        { header: 'Aguinaldo Prop. ($)', key: 'pasivo_aguinaldo', width: 18 },
                        { header: 'Pasivo Total ($)', key: 'pasivo_total', width: 20 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            ingreso_fmt: reportPdfHelper.formatDate(item.fecha_ingreso),
                            antiguedad_texto: item.antiguedad_texto,
                            sueldo_base: item.sueldo_base.toFixed(2),
                            salario_diario: item.salario_diario.toFixed(2),
                            pasivo_indemnizacion: item.pasivo_indemnizacion.toFixed(2),
                            pasivo_vacacion: item.pasivo_vacacion.toFixed(2),
                            pasivo_aguinaldo: item.pasivo_aguinaldo.toFixed(2),
                            pasivo_total: item.pasivo_total.toFixed(2)
                        })),
                        {
                            num: '', codigo: 'TOTALES', nombre: `${items.length} Empleados`, ingreso_fmt: '', antiguedad_texto: '',
                            sueldo_base: '', salario_diario: '',
                            pasivo_indemnizacion: totals.total_indemnizacion.toFixed(2),
                            pasivo_vacacion: totals.total_vacacion.toFixed(2),
                            pasivo_aguinaldo: totals.total_aguinaldo.toFixed(2),
                            pasivo_total: totals.total_pasivo.toFixed(2)
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Pasivos_Laborales_${fecha_corte}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generatePasivosLaboralesPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Pasivos_Laborales_${fecha_corte}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getPasivosLaboralesReport error]:', error);
        res.status(500).json({ message: 'Error al generar reporte de pasivos laborales: ' + error.message });
    }
};

/**
 * 13. Control de Vacaciones (Devengadas, Gozadas y Saldo Pendiente)
 */
const getControlVacacionesReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const departamento_id = req.query.departamento_id;
        const estado_filtro = req.query.estado;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        let query = `
            SELECT 
                e.id, e.codigo, e.nombres, e.apellidos, e.fecha_ingreso, e.sueldo_base,
                d.descripcion as departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.company_id = ? AND e.es_activo = 1 AND e.fecha_ingreso IS NOT NULL
        `;
        const params = [companyId];

        if (departamento_id && departamento_id !== 'all') {
            query += ` AND e.departamento_personal_id = ?`;
            params.push(departamento_id);
        }
        query += ` ORDER BY d.descripcion ASC, e.codigo ASC`;

        const [rows] = await pool.query(query, params);

        // Fetch vacation history per employee
        const [vacHist] = await pool.query(`
            SELECT empleado_id, COUNT(*) as periodos_pagados, SUM(COALESCE(dias_transcurridos, 15)) as total_dias_gozados
            FROM rh_planilla_vacaciones
            WHERE company_id = ?
            GROUP BY empleado_id
        `, [companyId]);

        const vacMap = new Map();
        vacHist.forEach(v => {
            vacMap.set(v.empleado_id, {
                periodos_pagados: parseInt(v.periodos_pagados || 0),
                total_dias_gozados: parseInt(v.total_dias_gozados || 0)
            });
        });

        const today = new Date();
        const totals = { al_dia: 0, por_vencer: 0, vencidas: 0, total_dias_pendientes: 0 };

        let items = rows.map(e => {
            const fIngreso = new Date(e.fecha_ingreso);
            const diffTime = Math.max(0, today.getTime() - fIngreso.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const anios = Math.floor(diffDays / 365.25);
            const meses = Math.floor((diffDays % 365.25) / 30.4375);
            const antiguedadTexto = `${anios}a ${meses}m`;

            const hist = vacMap.get(e.id) || { periodos_pagados: 0, total_dias_gozados: 0 };
            const periodosCausados = anios;
            const diasGozados = hist.total_dias_gozados;
            const diasCausados = periodosCausados * 15;
            const diasPendientes = Math.max(0, diasCausados - diasGozados);

            let estado = 'AL DÍA';
            if (diasPendientes >= 30) {
                estado = 'VENCIDAS';
                totals.vencidas++;
            } else if (diasPendientes >= 15) {
                estado = 'POR VENCER';
                totals.por_vencer++;
            } else {
                totals.al_dia++;
            }
            totals.total_dias_pendientes += diasPendientes;

            return {
                id: e.id,
                codigo: e.codigo,
                nombre: `${e.nombres || ''} ${e.apellidos || ''}`.trim(),
                departamento: e.departamento_nombre || 'GENERAL',
                fecha_ingreso: e.fecha_ingreso,
                antiguedad_texto: antiguedadTexto,
                periodos_causados: periodosCausados,
                dias_gozados: diasGozados,
                dias_pendientes: diasPendientes,
                estado
            };
        });

        if (estado_filtro && estado_filtro !== 'all' && estado_filtro !== 'TODOS' && estado_filtro !== 'todos') {
            const cleanFiltro = estado_filtro.toLowerCase().replace(/_/g, ' ');
            items = items.filter(it => it.estado.toLowerCase().includes(cleanFiltro));
        }

        const periodText = `AÑO ${anio} • FECHA DE REVISIÓN: ${reportPdfHelper.formatDate(today)}`;
        const subtitle = `CONTROL LEGAL DE PERÍODOS DE VACACIÓN (CÓDIGO DE TRABAJO ART. 177)`;

        const reportData = { company, items, totals, periodText, subtitle, anio };

        if (format === 'json') return res.json(reportData);

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - CONTROL DE VACACIONES - ${anio}`,
                sheets: [{
                    name: 'Control Vacaciones',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Empleado', key: 'nombre', width: 35 },
                        { header: 'Departamento', key: 'departamento', width: 22 },
                        { header: 'F. Ingreso', key: 'ingreso_fmt', width: 14 },
                        { header: 'Antigüedad', key: 'antiguedad_texto', width: 14 },
                        { header: 'Períodos Causados', key: 'periodos_causados', width: 18 },
                        { header: 'Días Gozados', key: 'dias_gozados', width: 14 },
                        { header: 'Días Pendientes', key: 'dias_pendientes', width: 16 },
                        { header: 'Estado Legal', key: 'estado', width: 16 }
                    ],
                    data: items.map((item, idx) => ({
                        num: idx + 1,
                        codigo: item.codigo,
                        nombre: item.nombre,
                        departamento: item.departamento,
                        ingreso_fmt: reportPdfHelper.formatDate(item.fecha_ingreso),
                        antiguedad_texto: item.antiguedad_texto,
                        periodos_causados: item.periodos_causados,
                        dias_gozados: item.dias_gozados,
                        dias_pendientes: item.dias_pendientes,
                        estado: item.estado
                    }))
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Control_Vacaciones_${anio}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generateControlVacacionesPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Control_Vacaciones_${anio}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getControlVacacionesReport error]:', error);
        res.status(500).json({ message: 'Error al generar reporte de control de vacaciones: ' + error.message });
    }
};

/**
 * 14. Rotación de Personal (Altas, Bajas y Estadísticas MTPS)
 */
const getRotacionPersonalReport = async (req, res) => {
    try {
        const companyId = req.company_id;
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const mes_inicio = parseInt(req.query.mes_inicio) || 1;
        const mes_fin = parseInt(req.query.mes_fin) || 12;
        const format = req.query.format;

        const company = await reportPdfHelper.getCompanyInfo(companyId);

        // 1. Altas (Contrataciones en el rango)
        const [altasRows] = await pool.query(`
            SELECT 
                e.id, e.codigo, e.nombres, e.apellidos, e.fecha_ingreso as fecha,
                'ALTA' as tipo_movimiento, 'NUEVA CONTRATACIÓN' as motivo,
                d.descripcion as departamento_nombre, c.descripcion as cargo_nombre
            FROM rh_empleados e
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            WHERE e.company_id = ? AND YEAR(e.fecha_ingreso) = ?
              AND MONTH(e.fecha_ingreso) >= ? AND MONTH(e.fecha_ingreso) <= ?
            ORDER BY e.fecha_ingreso ASC
        `, [companyId, anio, mes_inicio, mes_fin]);

        // 2. Bajas (Liquidaciones en el rango)
        const [bajasRows] = await pool.query(`
            SELECT 
                pl.id, e.codigo, e.nombres, e.apellidos, pl.ultimos_dias_laborados as fecha,
                'BAJA' as tipo_movimiento, 'LIQUIDACIÓN / FINIQUITO' as motivo,
                d.descripcion as departamento_nombre, c.descripcion as cargo_nombre,
                pl.dias_indemnizacion
            FROM rh_planilla_liquidaciones pl
            JOIN rh_empleados e ON pl.empleado_id = e.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            WHERE pl.company_id = ? AND pl.periodo_año = ?
              AND pl.periodo_mes >= ? AND pl.periodo_mes <= ?
            ORDER BY pl.ultimos_dias_laborados ASC
        `, [companyId, anio, mes_inicio, mes_fin]);

        // Promedio de empleados activos
        const [empCount] = await pool.query(`
            SELECT COUNT(*) as total FROM rh_empleados WHERE company_id = ? AND es_activo = 1
        `, [companyId]);
        const promedioEmpleados = Math.max(1, empCount[0]?.total || 1);

        const allMovements = [
            ...altasRows.map(r => ({ ...r, tiempo_laborado: '---' })),
            ...bajasRows.map(r => ({ ...r, tiempo_laborado: r.dias_indemnizacion ? `${Math.floor(r.dias_indemnizacion / 30)} meses` : '---' }))
        ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        const items = allMovements.map(m => ({
            id: m.id,
            codigo: m.codigo,
            nombre: `${m.nombres || ''} ${m.apellidos || ''}`.trim(),
            departamento: m.departamento_nombre || 'GENERAL',
            cargo: m.cargo_nombre || '---',
            tipo_movimiento: m.tipo_movimiento,
            fecha: m.fecha,
            motivo: m.motivo,
            tiempo_laborado: m.tiempo_laborado
        }));

        const totalAltas = altasRows.length;
        const totalBajas = bajasRows.length;
        const tasaRotacion = (((totalAltas + totalBajas) / 2) / promedioEmpleados * 100).toFixed(2);

        const totals = {
            altas: totalAltas,
            bajas: totalBajas,
            promedio_empleados: promedioEmpleados,
            tasa_rotacion: tasaRotacion
        };

        const periodText = `AÑO ${anio} (DEL MES ${mes_inicio} AL ${mes_fin})`;
        const subtitle = `ESTADÍSTICAS DE MOVILIDAD Y RETENCIÓN DE TALENTO (MTPS)`;

        const reportData = { company, items, totals, periodText, subtitle, anio };

        if (format === 'json') return res.json(reportData);

        if (format === 'excel') {
            const buffer = await excelService.createExcelBuffer({
                title: `${company.razon_social} - ROTACIÓN DE PERSONAL - ${anio}`,
                sheets: [{
                    name: 'Rotación Personal',
                    columns: [
                        { header: 'N°', key: 'num', width: 6 },
                        { header: 'Código', key: 'codigo', width: 12 },
                        { header: 'Empleado', key: 'nombre', width: 35 },
                        { header: 'Departamento', key: 'departamento', width: 22 },
                        { header: 'Cargo', key: 'cargo', width: 22 },
                        { header: 'Movimiento', key: 'tipo_movimiento', width: 14 },
                        { header: 'Fecha', key: 'fecha_fmt', width: 14 },
                        { header: 'Motivo / Causa', key: 'motivo', width: 26 },
                        { header: 'Tiempo Laborado', key: 'tiempo_laborado', width: 16 }
                    ],
                    data: [
                        ...items.map((item, idx) => ({
                            num: idx + 1,
                            codigo: item.codigo,
                            nombre: item.nombre,
                            departamento: item.departamento,
                            cargo: item.cargo,
                            tipo_movimiento: item.tipo_movimiento,
                            fecha_fmt: reportPdfHelper.formatDate(item.fecha),
                            motivo: item.motivo,
                            tiempo_laborado: item.tiempo_laborado
                        })),
                        {
                            num: '', codigo: 'RESUMEN', nombre: `Altas: ${totalAltas} | Bajas: ${totalBajas}`, departamento: `Tasa: ${tasaRotacion}%`,
                            cargo: '', tipo_movimiento: '', fecha_fmt: '', motivo: '', tiempo_laborado: ''
                        }
                    ]
                }]
            });
            return excelService.sendExcelResponse(res, buffer, `Rotacion_Personal_${anio}.xlsx`);
        }

        const pdfBuffer = await rhReportPdfService.generateRotacionPersonalPdf(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Rotacion_Personal_${anio}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[getRotacionPersonalReport error]:', error);
        res.status(500).json({ message: 'Error al generar reporte de rotación de personal: ' + error.message });
    }
};

/**
 * Helper to fetch filter catalogs
 */
const getReportesCatalogos = async (req, res) => {
    try {
        const companyId = req.company_id;

        const [empleados] = await pool.query(`
            SELECT id, codigo, CONCAT(nombres, ' ', apellidos) AS nombre, sueldo_base
            FROM rh_empleados
            WHERE company_id = ?
            ORDER BY codigo ASC
        `, [companyId]);

        const [afps] = await pool.query(`
            SELECT id, codigo, descripcion
            FROM rh_afp
            WHERE company_id = ?
            ORDER BY descripcion ASC
        `, [companyId]);

        const [cargos] = await pool.query(`
            SELECT id, codigo, descripcion
            FROM rh_cargos
            WHERE company_id = ?
            ORDER BY descripcion ASC
        `, [companyId]);

        const [departamentos] = await pool.query(`
            SELECT id, codigo, descripcion
            FROM rh_departamentos
            WHERE company_id = ?
            ORDER BY descripcion ASC
        `, [companyId]);

        res.json({
            empleados,
            afps,
            cargos,
            departamentos
        });
    } catch (error) {
        console.error('[getReportesCatalogos error]:', error);
        res.status(500).json({ message: 'Error al obtener catálogos de reportes: ' + error.message });
    }
};

module.exports = {
    getPlanillaIsssReport,
    getPlanillaAfpReport,
    getInformeRentaReport,
    getConstanciaSueldo,
    getCartaRenta,
    getListadoEmpleadosReport,
    getPlanillaInsaforpReport,
    getCostoLaboralReport,
    getDescuentosTercerosReport,
    getHorasExtrasReport,
    getAccionesPersonalReport,
    getPasivosLaboralesReport,
    getControlVacacionesReport,
    getRotacionPersonalReport,
    getReportesCatalogos
};
