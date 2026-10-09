const ExcelJS = require('exceljs');
const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Splits employee name into 5 standard Salvadoran parts:
 * Primer Nombre | Segundo Nombre | Primer Apellido | Segundo Apellido | Apellido Casada
 * @param {string} nombres
 * @param {string} apellidos
 * @returns {{primerNombre: string, segundoNombre: string, primerApellido: string, segundoApellido: string, apellidoCasada: string}}
 */
function splitEmployeeName(nombres = '', apellidos = '') {
    const cleanN = (nombres || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    const cleanA = (apellidos || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);

    const primerNombre = cleanN[0] || '';
    const segundoNombre = cleanN.slice(1).join(' ') || '';

    let primerApellido = cleanA[0] || '';
    let segundoApellido = cleanA[1] || '';
    let apellidoCasada = '';

    if (cleanA.length > 2) {
        const deIdx = cleanA.findIndex((w, idx) => idx >= 1 && ['DE', 'DEL', 'VDA', 'VIUDA'].includes(w.toUpperCase()));
        if (deIdx > 0) {
            primerApellido = cleanA.slice(0, deIdx).join(' ');
            apellidoCasada = cleanA.slice(deIdx).join(' ');
            segundoApellido = '';
        } else {
            primerApellido = cleanA[0] || '';
            segundoApellido = cleanA[1] || '';
            apellidoCasada = cleanA.slice(2).join(' ');
        }
    }

    return {
        primerNombre: primerNombre.toUpperCase(),
        segundoNombre: segundoNombre.toUpperCase(),
        primerApellido: primerApellido.toUpperCase(),
        segundoApellido: segundoApellido.toUpperCase(),
        apellidoCasada: apellidoCasada.toUpperCase()
    };
}

/**
 * Fetches and structures all data needed for the ISSS report (PDF, Excel, JSON).
 * @param {number} companyId
 * @param {{anio?: number, mes?: number, quincena?: string}} filters
 * @returns {Promise<Object>}
 */
async function getPlanillaIsssReportData(companyId, filters = {}) {
    const anio = parseInt(filters.anio, 10) || new Date().getFullYear();
    const mes = parseInt(filters.mes, 10) || (new Date().getMonth() + 1);
    const quincena = filters.quincena || 'todas';

    const company = await reportPdfHelper.getCompanyInfo(companyId);

    let query = `
        SELECT 
            p.id, p.empleado_id, p.dias_trabajados, p.sueldo_base, p.total_percepciones,
            p.descuento_isss, p.quincena,
            e.codigo, e.nombres, e.apellidos, e.num_dui, e.num_isss, e.num_nup, e.es_jubilado,
            COALESCE(a.descripcion, 'SIN AFP') AS afp_nombre,
            COALESCE(d.descripcion, 'GENERAL') AS depto_nombre,
            COALESCE(b.nombre, 'MATRIZ') AS branch_nombre
        FROM rh_planillas p
        JOIN rh_empleados e ON p.empleado_id = e.id
        LEFT JOIN rh_afp a ON e.afp_id = a.id
        LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
        LEFT JOIN branches b ON e.branch_id = b.id
        WHERE p.company_id = ? AND p.periodo_anio = ? AND p.periodo_mes = ? AND p.estado != 'anulado'
    `;
    const params = [companyId, anio, mes];

    if (quincena && quincena !== 'todas') {
        query += ` AND p.quincena = ?`;
        params.push(quincena);
    }
    query += ` ORDER BY d.descripcion ASC, e.codigo ASC, p.id ASC`;

    const [rows] = await pool.query(query, params);

    // Fetch payroll details for earnings categorization (base salary, overtime, bonuses)
    const planillaIds = rows.map(r => r.id);
    let detalles = [];
    if (planillaIds.length > 0) {
        const [detRows] = await pool.query(`
            SELECT planilla_id, codigo, descripcion, operacion, valor_ingresado
            FROM rh_planilla_detalles
            WHERE planilla_id IN (?)
        `, [planillaIds]);
        detalles = detRows;
    }

    const detByPlanilla = new Map();
    detalles.forEach(d => {
        if (!detByPlanilla.has(d.planilla_id)) {
            detByPlanilla.set(d.planilla_id, []);
        }
        detByPlanilla.get(d.planilla_id).push(d);
    });

    const empMap = new Map();
    rows.forEach(r => {
        const empId = r.empleado_id;
        const perc = parseFloat(r.total_percepciones || 0);
        const dias = parseInt(r.dias_trabajados || 0, 10);
        const isssLab = parseFloat(r.descuento_isss || 0);
        const sueldoBaseMensual = parseFloat(r.sueldo_base || 0);

        const empDetalles = detByPlanilla.get(r.id) || [];
        let rowSueldoDev = 0;
        let rowOtros = 0;
        let rowAdic = 0;

        empDetalles.forEach(d => {
            const val = parseFloat(d.valor_ingresado || 0);
            if (d.operacion === 'sumar') {
                if (d.codigo === '01') {
                    rowSueldoDev += val;
                } else if (d.codigo === '04' || d.codigo === '07') {
                    rowOtros += val;
                } else {
                    rowAdic += val;
                }
            }
        });

        if (rowSueldoDev === 0 && perc > 0) {
            rowSueldoDev = Math.min(perc, Math.round(((sueldoBaseMensual / 30) * dias) * 100) / 100);
            rowAdic = Math.max(0, Math.round((perc - rowSueldoDev - rowOtros) * 100) / 100);
        }

        if (!empMap.has(empId)) {
            empMap.set(empId, {
                id: empId,
                codigo: r.codigo,
                nombres: r.nombres || '',
                apellidos: r.apellidos || '',
                nombre: `${r.nombres || ''} ${r.apellidos || ''}`.trim(),
                num_isss: r.num_isss || '',
                num_dui: r.num_dui || '',
                num_nup: r.num_nup || '',
                afp: r.afp_nombre || '',
                depto_nombre: r.depto_nombre || 'GENERAL',
                branch_nombre: r.branch_nombre || 'MATRIZ',
                sueldo_base: rowSueldoDev,
                otros_ingresos: rowOtros,
                ingresos_adicionales: rowAdic,
                horas_jornada: 8.0,
                dias_trabajados: dias,
                dias_incapacidad: 0,
                dias_otras_ausencias: 0,
                salario_devengado: perc,
                isss_laboral: isssLab,
                es_jubilado: r.es_jubilado
            });
        } else {
            const existing = empMap.get(empId);
            existing.dias_trabajados += dias;
            existing.sueldo_base += rowSueldoDev;
            existing.otros_ingresos += rowOtros;
            existing.ingresos_adicionales += rowAdic;
            existing.salario_devengado += perc;
            existing.isss_laboral += isssLab;
        }
    });

    const cap = quincena === 'todas' ? 1000.00 : 500.00;
    const items = Array.from(empMap.values()).map(emp => {
        const cotizable = Math.min(emp.salario_devengado, cap);
        const isssPatronal = emp.isss_laboral > 0 || !emp.es_jubilado
            ? Math.round(cotizable * 0.075 * 100) / 100
            : 0;
        const totalIsss = Math.round((emp.isss_laboral + isssPatronal) * 100) / 100;

        return {
            ...emp,
            sueldo_base: Math.round(emp.sueldo_base * 100) / 100,
            otros_ingresos: Math.round(emp.otros_ingresos * 100) / 100,
            ingresos_adicionales: Math.round(emp.ingresos_adicionales * 100) / 100,
            salario_devengado: Math.round(emp.salario_devengado * 100) / 100,
            isss_laboral: Math.round(emp.isss_laboral * 100) / 100,
            isss_patronal: isssPatronal,
            total_isss: totalIsss
        };
    });

    const deptoMap = new Map();
    items.forEach(emp => {
        const dName = emp.depto_nombre;
        if (!deptoMap.has(dName)) {
            deptoMap.set(dName, {
                nombre: dName,
                empleados: [],
                subtotal: {
                    sueldo_base: 0, otros_ingresos: 0, ingresos_adicionales: 0,
                    salario_devengado: 0, isss_laboral: 0, isss_patronal: 0, total_isss: 0
                }
            });
        }
        const group = deptoMap.get(dName);
        group.empleados.push(emp);
        group.subtotal.sueldo_base += emp.sueldo_base;
        group.subtotal.otros_ingresos += emp.otros_ingresos;
        group.subtotal.ingresos_adicionales += emp.ingresos_adicionales;
        group.subtotal.salario_devengado += emp.salario_devengado;
        group.subtotal.isss_laboral += emp.isss_laboral;
        group.subtotal.isss_patronal += emp.isss_patronal;
        group.subtotal.total_isss += emp.total_isss;
    });

    const totals = items.reduce((acc, curr) => {
        acc.sueldo_base += curr.sueldo_base;
        acc.otros_ingresos += curr.otros_ingresos;
        acc.ingresos_adicionales += curr.ingresos_adicionales;
        acc.salario_devengado += curr.salario_devengado;
        acc.isss_laboral += curr.isss_laboral;
        acc.isss_patronal += curr.isss_patronal;
        acc.total_isss += curr.total_isss;
        return acc;
    }, {
        sueldo_base: 0, otros_ingresos: 0, ingresos_adicionales: 0,
        salario_devengado: 0, isss_laboral: 0, isss_patronal: 0, total_isss: 0
    });

    const mesName = MONTH_NAMES[mes - 1] || `Mes ${mes}`;
    const quincenaText = quincena === 'primera' ? 'PRIMERA QUINCENA' : quincena === 'segunda' ? 'SEGUNDA QUINCENA' : 'TODO EL MES';
    const periodText = `PERÍODO: ${mesName.toUpperCase()} ${anio} (${quincenaText})`;
    const subtitle = `PLANILLA DE APORTES AL RÉGIMEN GENERAL DE SALUD`;

    return {
        company,
        items,
        departments: Array.from(deptoMap.values()),
        totals,
        periodText,
        subtitle,
        anio,
        mes,
        quincena
    };
}

/**
 * Builds the Excel workbook Buffer matching the EXACT ISSS layout from the sample image
 * @param {Object} reportData
 * @returns {Promise<Buffer>}
 */
async function generatePlanillaIsssExcelBuffer(reportData) {
    const { departments = [], totals = {} } = reportData;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sipe Web SaaS';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Hoja1', {
        views: [{ state: 'frozen', ySplit: 3, showGridLines: true }]
    });

    const CURRENCY_FMT = '_("$ "* #,##0.00_);_("$ "* (#,##0.00);_("$ "* "-"??_);_(@_)';
    const BORDER_GRID = {
        top: { style: 'thin', color: { argb: 'FFD4D4D4' } },
        left: { style: 'thin', color: { argb: 'FFD4D4D4' } },
        bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } },
        right: { style: 'thin', color: { argb: 'FFD4D4D4' } }
    };

    // 21 columns specification (A through U) matching the exact sample layout
    ws.columns = [
        { key: 'no', width: 7 },                       // A: Col 1
        { key: 'num_isss', width: 18 },                 // B: Col 2
        { key: 'primer_nombre', width: 16 },            // C: Col 3
        { key: 'segundo_nombre', width: 16 },           // D: Col 4
        { key: 'primer_apellido', width: 16 },          // E: Col 5
        { key: 'segundo_apellido', width: 16 },         // F: Col 6
        { key: 'apellido_casada', width: 16 },          // G: Col 7
        { key: 'num_dui', width: 15 },                  // H: Col 8
        { key: 'num_dui_sin_guion', width: 16 },        // I: Col 9
        { key: 'num_nup', width: 16 },                  // J: Col 10 (NUP)
        { key: 'afp', width: 14 },                      // K: Col 11
        { key: 'sueldo_base', width: 15 },              // L: Col 12
        { key: 'otros_ingresos', width: 15 },           // M: Col 13
        { key: 'ingresos_adicionales', width: 18 },     // N: Col 14
        { key: 'horas_jornada', width: 14 },            // O: Col 15
        { key: 'dias_trabajados', width: 15 },          // P: Col 16
        { key: 'dias_incapacidad', width: 15 },         // Q: Col 17
        { key: 'otras_ausencias', width: 15 },          // R: Col 18
        { key: 'isss_laboral', width: 16 },             // S: Col 19
        { key: 'isss_patronal', width: 16 },            // T: Col 20
        { key: 'total_isss', width: 18 }                // U: Col 21
    ];

    // Row 1: First Department title
    const firstDept = departments[0];
    const firstDeptTitle = firstDept
        ? (firstDept.nombre.toUpperCase().startsWith('DEPAF') ? firstDept.nombre.toUpperCase() : `DEPAF ${firstDept.nombre.toUpperCase()}`)
        : 'DEPAF GENERAL';

    const row1 = ws.getRow(1);
    row1.getCell(1).value = firstDeptTitle;
    row1.getCell(1).font = { name: 'Arial', size: 10, bold: false, color: { argb: 'FF000000' } };
    row1.height = 20;

    // Row 2: Spacer row
    const row2 = ws.getRow(2);
    row2.height = 10;

    // Row 3: Descriptive column headers requested by user to guide themselves
    const headers = [
        'No.',                          // A: Col 1
        'No. Afiliación ISSS',          // B: Col 2
        'Primer Nombre',                // C: Col 3
        'Segundo Nombre',               // D: Col 4
        'Primer Apellido',              // E: Col 5
        'Segundo Apellido',             // F: Col 6
        'Apellido Casada',              // G: Col 7
        'No. DUI',                      // H: Col 8
        'DUI (sin guión)',              // I: Col 9
        'NUP',                          // J: Col 10
        'Institución Previsional',      // K: Col 11
        'Sueldo Base',                  // L: Col 12
        'Otros Ingresos',               // M: Col 13
        'Ingresos Adicionales',         // N: Col 14
        'Horas Jornada',                // O: Col 15
        'Días Trabajados',              // P: Col 16
        'Días Incapacidad',             // Q: Col 17
        'Otras Ausencias',              // R: Col 18
        'ISSS Laboral (3%)',            // S: Col 19
        'ISSS Patronal (7.5%)',         // T: Col 20
        'Total ISSS (10.5%)'            // U: Col 21
    ];

    const row3 = ws.getRow(3);
    row3.values = headers;
    row3.height = 28;
    row3.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' }
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
        if (colNumber === 1 || colNumber === 2 || (colNumber >= 8 && colNumber <= 10) || (colNumber >= 15 && colNumber <= 18)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        } else if ((colNumber >= 12 && colNumber <= 14) || colNumber >= 19) {
            cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
        } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        }
    });

    let currentCorrelativo = 4; // Starts at 4 matching row 4 in sample

    departments.forEach((dept, deptIdx) => {
        if (deptIdx > 0) {
            const deptTitle = dept.nombre.toUpperCase().startsWith('DEPAF')
                ? dept.nombre.toUpperCase()
                : `DEPAF ${dept.nombre.toUpperCase()}`;
            const deptRow = ws.addRow([deptTitle]);
            deptRow.height = 20;
            deptRow.getCell(1).font = { name: 'Arial', size: 10, bold: false, color: { argb: 'FF000000' } };
        }

        // Employee rows
        (dept.empleados || []).forEach(emp => {
            const names = splitEmployeeName(emp.nombres, emp.apellidos);

            const rawNup = (emp.num_nup || '').replace(/\D/g, '');
            const duiSinGuion = (emp.num_dui || '').replace(/-/g, '').trim();

            let colDuiSinGuion = '';
            let colNup = '';

            if (rawNup.length >= 10) {
                colNup = emp.num_nup.trim();
                colDuiSinGuion = '';
            } else if (duiSinGuion) {
                colDuiSinGuion = duiSinGuion;
                colNup = '';
            }

            const rowValues = [
                currentCorrelativo,                                                 // A: 1
                String(emp.num_isss || ''),                                         // B: 2
                names.primerNombre,                                                 // C: 3
                names.segundoNombre,                                                // D: 4
                names.primerApellido,                                               // E: 5
                names.segundoApellido,                                              // F: 6
                names.apellidoCasada,                                               // G: 7
                emp.num_dui || '',                                                  // H: 8
                colDuiSinGuion,                                                     // I: 9
                colNup,                                                             // J: 10 (NUP)
                (emp.afp || '').replace(/^AFP\s+/i, '').trim().toUpperCase(),       // K: 11
                parseFloat(emp.sueldo_base || 0),                                   // L: 12
                parseFloat(emp.otros_ingresos || 0),                                // M: 13
                parseFloat(emp.ingresos_adicionales || 0),                          // N: 14
                parseFloat(emp.horas_jornada || 8.0),                               // O: 15
                parseInt(emp.dias_trabajados || 0, 10),                             // P: 16
                parseInt(emp.dias_incapacidad || 0, 10),                            // Q: 17
                parseInt(emp.dias_otras_ausencias || 0, 10),                        // R: 18
                parseFloat(emp.isss_laboral || 0),                                  // S: 19
                parseFloat(emp.isss_patronal || 0),                                 // T: 20
                parseFloat(emp.total_isss || 0)                                     // U: 21
            ];

            const row = ws.addRow(rowValues);
            currentCorrelativo++;

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF000000' } };
                cell.border = BORDER_GRID;

                if (colNumber === 1) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '0';
                } else if (colNumber === 2 || (colNumber >= 8 && colNumber <= 10)) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    cell.numFmt = '@';
                } else if ((colNumber >= 3 && colNumber <= 7) || colNumber === 11) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else if (colNumber >= 12 && colNumber <= 14) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = CURRENCY_FMT;
                } else if (colNumber === 15) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '0.00';
                } else if (colNumber >= 16 && colNumber <= 18) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '0';
                } else if (colNumber >= 19 && colNumber <= 21) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = CURRENCY_FMT;
                }
            });
        });
    });

    // Totals row at the bottom
    const totalRow = ws.addRow([
        '',
        '',
        'TOTAL GENERAL',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        parseFloat(totals.sueldo_base || 0),
        parseFloat(totals.otros_ingresos || 0),
        parseFloat(totals.ingresos_adicionales || 0),
        '',
        '',
        '',
        '',
        parseFloat(totals.isss_laboral || 0),
        parseFloat(totals.isss_patronal || 0),
        parseFloat(totals.total_isss || 0)
    ]);
    totalRow.height = 22;
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF000000' } };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } }
        };
        if ((colNumber >= 12 && colNumber <= 14) || (colNumber >= 19 && colNumber <= 21)) {
            cell.numFmt = CURRENCY_FMT;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNumber === 3) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}

module.exports = {
    splitEmployeeName,
    getPlanillaIsssReportData,
    generatePlanillaIsssExcelBuffer
};
