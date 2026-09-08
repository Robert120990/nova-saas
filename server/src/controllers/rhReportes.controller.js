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
    getReportesCatalogos
};
