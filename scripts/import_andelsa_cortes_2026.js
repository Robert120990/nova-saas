/**
 * Script idempotente para configurar las reglas reales de horas extra de ANDELSA (company_id = 9)
 * e importar los 12 cortes quincenales históricos desde Junio 2026 hasta Noviembre 2026
 * a partir de los archivos oficiales de Excel en la carpeta de Horas Extras.
 *
 * Uso:
 *   node scripts/import_andelsa_cortes_2026.js ["C:\ruta\a\Horas Extras"]
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require(path.resolve(__dirname, '../server/node_modules/exceljs'));
require(path.resolve(__dirname, '../server/node_modules/dotenv')).config({
    path: path.resolve(__dirname, '../server/.env')
});
const pool = require(path.resolve(__dirname, '../server/src/config/db'));

const COMPANY_ID = 9; // ANDELSA S.A. DE C.V.
const DEFAULT_BASE_DIR = 'C:\\Users\\rauls\\OneDrive\\ARCHIVOS\\ROBER\\Horas Extras';
const BASE_DIR = process.argv[2] || DEFAULT_BASE_DIR;

const CORTES_SPECS = [
    { file: '11)HORAS EXTRAS 1° Junio  2026.xlsx', nombre: '1° Quincena Junio 2026', start: '2026-05-26', end: '2026-06-09' },
    { file: '12)HORAS EXTRAS 2° Junio  2026.xlsx', nombre: '2° Quincena Junio 2026', start: '2026-06-10', end: '2026-06-24' },
    { file: '13)HORAS EXTRAS 1° Julio  2026.xlsx', nombre: '1° Quincena Julio 2026', start: '2026-06-25', end: '2026-07-09' },
    { file: '14)HORAS EXTRAS 2° Julio  2026.xlsx', nombre: '2° Quincena Julio 2026', start: '2026-07-10', end: '2026-07-27' },
    { file: '15)HORAS EXTRAS 1° Agosto 2026.xlsx', nombre: '1° Quincena Agosto 2026', start: '2026-07-28', end: '2026-08-12' },
    { file: '16)HORAS EXTRAS 2° Agosto 2026.xlsx', nombre: '2° Quincena Agosto 2026', start: '2026-08-13', end: '2026-08-24' },
    { file: '17)HORAS EXTRAS 1° Septiembre  2026.xlsx', nombre: '1° Quincena Septiembre 2026', start: '2026-08-25', end: '2026-09-10' },
    { file: '18)HORAS EXTRAS 2° Septiembre  2026.xlsx', nombre: '2° Quincena Septiembre 2026', start: '2026-09-11', end: '2026-09-24' },
    { file: '19)HORAS EXTRAS 1° Octubre  2026.xlsx', nombre: '1° Quincena Octubre 2026', start: '2026-09-25', end: '2026-10-08' },
    { file: '20)HORAS EXTRAS 2° Octubre  2026.xlsx', nombre: '2° Quincena Octubre 2026', start: '2026-10-09', end: '2026-10-24', fixSeptToOct: true },
    { file: '21)HORAS EXTRAS 1° Noviembre  2026.xlsx', nombre: '1° Quincena Noviembre 2026', start: '2026-10-26', end: '2026-11-07' },
    { file: '22)HORAS EXTRAS 2° Noviembre  2026.xlsx', nombre: '2° Quincena Noviembre 2026', start: '2026-11-09', end: '2026-11-21' }
];

const EMP_IDENTITY_RULES = [
    { match: /ANA\s+ESTELA/i, empleado_id: 22, device_uid: '12', categoria: 'produccion', hl: 9 },
    { match: /DELMY\s+ISABEL/i, empleado_id: 26, device_uid: '11', categoria: 'produccion', hl: 9 },
    { match: /JUAN\s+JOSE\s+CASCO/i, empleado_id: 24, device_uid: '1', categoria: 'produccion', hl: 9 },
    { match: /SANTOS?\s+MANUEL\s+PINEDA/i, empleado_id: 25, device_uid: '6', categoria: 'produccion', hl: 9 },
    { match: /WALTER/i, empleado_id: 795, device_uid: '31', categoria: 'produccion', hl: 9 },
    { match: /MARCOS?\s+ANTONIO\s+SOLORZANO/i, empleado_id: 23, device_uid: '10', categoria: 'transporte', hl: 8 },
    { match: /VIRGILIO\s+MEMBRE/i, empleado_id: 27, device_uid: '9', categoria: 'transporte', hl: 8 },
    { match: /RAMON\s+ALFREDIS/i, empleado_id: 21, device_uid: '5', categoria: 'produccion', hl: 9 },
    { match: /JOSE\s+PABLO/i, empleado_id: 20, device_uid: '4', categoria: 'produccion', hl: 9 },
    { match: /RAMIRO\s+RAFAEL/i, empleado_id: 32, device_uid: '20', categoria: 'produccion', hl: 9 },
    { match: /EMERSON/i, empleado_id: 790, device_uid: '24', categoria: 'produccion', hl: 9 },
    { match: /CESAR/i, empleado_id: 793, device_uid: '30', categoria: 'produccion', hl: 9 },
    { match: /CARLOS\s+(?:H|HERIBERTO)/i, empleado_id: 794, device_uid: '34', categoria: 'produccion', hl: 9 },
    { match: /LUIS\s+ANDRES\s+ROSALES/i, empleado_id: null, device_uid: '29', categoria: 'produccion', hl: 9 },
    { match: /ELIAS\s+(?:SOLORZANO|AMAYA)/i, empleado_id: null, device_uid: '27', categoria: 'produccion', hl: 9 }
];

function normalizeText(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function resolveIdentity(empName) {
    const clean = normalizeText(empName);
    for (const rule of EMP_IDENTITY_RULES) {
        if (rule.match.test(clean)) return rule;
    }
    return null;
}

function rawVal(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    const v = cell.value;
    if (typeof v === 'object') {
        if (v.richText) return v.richText.map(r => r.text).join('');
        if (v.formula !== undefined) return v.result !== undefined ? v.result : '';
        if (v.result !== undefined) return v.result;
        if (v.text) return v.text;
    }
    return v;
}

function fmtDate(v, spec) {
    if (!v) return null;
    let out = null;
    if (v instanceof Date) {
        const y = v.getUTCFullYear();
        if (y >= 2020 && y <= 2030) {
            out = `${y}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
        }
    } else if (typeof v === 'number' && v > 40000 && v < 60000) {
        out = new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
    } else {
        const m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) out = `${m[1]}-${m[2]}-${m[3]}`;
    }
    // Reparar typo conocido en archivo 20) 2° Octubre (2026-09-12..17 -> 2026-10-12..17)
    if (out && spec.fixSeptToOct && out >= '2026-09-12' && out <= '2026-09-17') {
        out = out.replace('2026-09-', '2026-10-');
    }
    return out;
}

function fmtTimeFull(v) {
    if (v === '' || v === null || v === undefined) return null;
    if (v instanceof Date) {
        return `${String(v.getUTCHours()).padStart(2, '0')}:${String(v.getUTCMinutes()).padStart(2, '0')}:${String(v.getUTCSeconds()).padStart(2, '0')}`;
    }
    if (typeof v === 'number' && v >= 0 && v < 2) {
        const sec = Math.round(v * 86400);
        return `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    }
    const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
    return null;
}

function timeToMin(t) {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

async function parseWorkbook(filePath, spec) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    const mainSheet = wb.worksheets.find(w => /hoja1|h\s*extra/i.test(w.name)) || wb.worksheets[wb.worksheets.length - 1];
    const avicolaSheet = wb.worksheets.find(w => /avicola/i.test(w.name));

    // 1. Parsear hoja AVICOLA si existe
    const avicolaByUidDate = new Map(); // key: `${uid}_${date}` -> { hours, obs }
    const avicolaTotalByUid = new Map();
    if (avicolaSheet) {
        let curIdent = null;
        for (let r = 1; r <= avicolaSheet.rowCount; r++) {
            const row = avicolaSheet.getRow(r);
            if (row.getCell(1).isMerged && row.getCell(1).master && row.getCell(1).master.row !== r) continue;
            const c1 = String(rawVal(row.getCell(1)) || '').trim();
            if (/^Nombre/i.test(c1)) {
                const m = c1.match(/Nombre\s*[:.]?\s*(.+?)\s*(?:\.?\s*[ÁA]rea|$)/i);
                const nameClean = (m ? m[1] : c1).replace(/\./g, ' ').trim();
                curIdent = resolveIdentity(nameClean);
                continue;
            }
            if (!curIdent) continue;
            if (/^(Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)$/i.test(c1)) {
                const dt = fmtDate(rawVal(row.getCell(2)), spec);
                const hrs = Number(rawVal(row.getCell(5))) || 0;
                const obs = String(rawVal(row.getCell(6)) || '').trim();
                if (dt && hrs > 0) {
                    const key = `${curIdent.device_uid}_${dt}`;
                    avicolaByUidDate.set(key, { hours: hrs, obs });
                    avicolaTotalByUid.set(curIdent.device_uid, (avicolaTotalByUid.get(curIdent.device_uid) || 0) + hrs);
                }
            }
        }
    }

    // 2. Parsear hoja principal (H EXTRA / Hoja1)
    const blocks = [];
    for (let r = 1; r <= mainSheet.rowCount; r++) {
        const a = String(rawVal(mainSheet.getRow(r).getCell(1)) || '').trim();
        if (/^Nombre/i.test(a) && /[ÁA]rea/i.test(a)) {
            let hl = null;
            for (let c = 7; c <= 10; c++) {
                const tv = fmtTimeFull(rawVal(mainSheet.getRow(r + 1).getCell(c)));
                if (tv) { hl = parseInt(tv.slice(0, 2), 10); break; }
            }
            blocks.push({ startRow: r, header: a, hl });
        }
    }

    const employees = [];
    for (let bi = 0; bi < blocks.length; bi++) {
        const blk = blocks[bi];
        const endRow = bi + 1 < blocks.length ? blocks[bi + 1].startRow - 4 : mainSheet.rowCount;
        const m = blk.header.match(/Nombre\s*[:.]?\s*(.+?)\s*\.?\s*[ÁA]rea\s*[:.]?\s*(.+)/i);
        const empName = (m ? m[1] : blk.header).replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
        const area = (m ? m[2] : 'Produccion').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
        const ident = resolveIdentity(empName);
        if (!ident) {
            throw new Error(`No se pudo mapear el empleado "${empName}" en ${spec.file}`);
        }

        const hl = blk.hl || ident.hl;
        const categoria = /log[ií]stica|transporte/i.test(area) ? 'transporte' : ident.categoria;

        let pendingPrev = 0;
        let excelTotal = 0;
        const days = [];
        const seenDates = new Set();

        for (let r = blk.startRow + 2; r <= endRow; r++) {
            const row = mainSheet.getRow(r);
            if (row.getCell(1).isMerged && row.getCell(1).master && row.getCell(1).master.row !== r) continue;

            const c1 = String(rawVal(row.getCell(1)) || '').trim();
            const c3lbl = String(rawVal(row.getCell(3)) || '').trim();
            const c5 = rawVal(row.getCell(5));
            const c6 = String(rawVal(row.getCell(6)) || '').trim();

            if (/HORAS PENDIENTES/i.test(c1)) {
                const pv = Number(c5);
                if (!isNaN(pv) && pv !== 0) pendingPrev = parseFloat(pv.toFixed(2));
                continue;
            }
            if (/^Total\s*Horas/i.test(c3lbl)) {
                const tv = Number(c5);
                if (!isNaN(tv)) excelTotal = parseFloat(tv.toFixed(2));
                continue;
            }
            if (!/^(Lunes|Martes|Mi[eé]rcoles|Jueves|Viernes|S[aá]bado|Domingo)$/i.test(c1)) continue;

            const dt = fmtDate(rawVal(row.getCell(2)), spec);
            if (!dt || seenDates.has(dt)) continue;
            seenDates.add(dt);

            const r2 = mainSheet.getRow(r + 1);
            const e1 = fmtTimeFull(rawVal(row.getCell(3)));
            const s1 = fmtTimeFull(rawVal(row.getCell(4)));
            const e2 = fmtTimeFull(rawVal(r2.getCell(3)));
            const s2 = fmtTimeFull(rawVal(r2.getCell(4)));

            const entrada = e1 || e2 || null;
            const salida = s2 || s1 || null;
            const mIn = timeToMin(entrada);
            const mOut = timeToMin(salida);
            const spanHrs = (mIn !== null && mOut !== null && mOut > mIn)
                ? parseFloat(((mOut - mIn) / 60).toFixed(2))
                : 0;

            const extraRaw = (c5 !== '' && c5 !== null && !isNaN(Number(c5))) ? parseFloat(Number(c5).toFixed(2)) : 0;
            const avicInfo = avicolaByUidDate.get(`${ident.device_uid}_${dt}`);
            const avicHrs = avicInfo ? parseFloat(avicInfo.hours.toFixed(2)) : 0;
            const isSabado = /^S[aá]bado$/i.test(c1);
            const esDiaComp = (!entrada && !salida && (isSabado || extraRaw < 0)) ? 1 : 0;

            let obs = c6;
            if (!obs && esDiaComp && isSabado && extraRaw < 0) obs = 'Compensación sábado (44h sem.)';
            if (avicInfo?.obs && !obs) obs = avicInfo.obs;

            // Solo guardar filas con marcación, ajuste distinto de 0, observación o Avícola
            if (entrada || salida || extraRaw !== 0 || avicHrs > 0 || obs) {
                days.push({
                    fecha: dt,
                    entrada,
                    salida,
                    horas_trabajadas: spanHrs,
                    horas_extra_calculadas: extraRaw,
                    horas_extra_aprobadas: extraRaw,
                    horas_extra_avicola: avicHrs,
                    es_dia_compensacion: esDiaComp,
                    observacion: obs ? obs.slice(0, 250) : null
                });
            }
        }

        const periodoSum = parseFloat(days.reduce((acc, d) => acc + d.horas_extra_aprobadas, 0).toFixed(2));
        const avicolaTotal = parseFloat((avicolaTotalByUid.get(ident.device_uid) || 0).toFixed(2));
        const saldoNeto = parseFloat((periodoSum + pendingPrev).toFixed(2));
        const horasPagables = parseFloat(Math.max(0, saldoNeto).toFixed(2));
        const saldoArrastre = saldoNeto < 0 ? saldoNeto : 0;

        employees.push({
            empleado_id: ident.empleado_id,
            device_uid: ident.device_uid,
            empleado_nombre: empName,
            area,
            categoria,
            horas_jornada_base: hl,
            horas_extra_periodo: periodoSum,
            horas_pendientes_anteriores: pendingPrev,
            horas_extra_avicola: avicolaTotal,
            saldo_neto: saldoNeto,
            horas_pagables: horasPagables,
            saldo_arrastre_siguiente: saldoArrastre,
            excel_total: excelTotal,
            days
        });
    }

    return employees;
}

async function configureAndelsaSettingsAndShifts(conn) {
    // 1. Limpiar atribución histórica errónea de UIDs 27 (Elias Amaya) y 29 (Luis Rosales) en logs
    const [fix27] = await conn.query(
        `UPDATE rh_biometric_attendance_logs SET empleado_id = NULL WHERE company_id = ? AND device_uid = '27' AND empleado_id = 27`,
        [COMPANY_ID]
    );
    const [fix29] = await conn.query(
        `UPDATE rh_biometric_attendance_logs SET empleado_id = NULL WHERE company_id = ? AND device_uid = '29' AND empleado_id = 29`,
        [COMPANY_ID]
    );
    if (fix27.affectedRows || fix29.affectedRows) {
        console.log(`[CLEANUP] Desvinculados logs históricos erróneos: uid=27 (${fix27.affectedRows}), uid=29 (${fix29.affectedRows})`);
    }

    // 2. Configurar reglas reales de cálculo para ANDELSA en rh_biometric_settings
    await conn.query(
        `UPDATE rh_biometric_settings
         SET hora_entrada = '07:00:00',
             hora_salida = '16:00:00',
             hora_inicio_almuerzo = '12:00:00',
             hora_fin_almuerzo = '13:00:00',
             horas_jornada_diaria = 9.00,
             modo_calculo_jornada = 'bruto_con_almuerzo',
             redondeo_horas_extra_minutos = 30,
             umbral_redondeo_minutos = 15,
             compensar_sabado = 1,
             horas_jornada_sabado = 4.00,
             permitir_saldo_negativo = 1
         WHERE company_id = ?`,
        [COMPANY_ID]
    );
    console.log('[SETTINGS] Reglas de Andelsa activadas: bruto 9h, redondeo 30m (umbral 15m), sábado -4h, arrastre saldo negativo.');

    // 3. Asegurar turnos reales de Andelsa (Planta 9h y Logística/Transporte 8h)
    const ensureShift = async (nombre, ent, sal, almIni, almFin, hrs, isDefault) => {
        const [ex] = await conn.query(
            `SELECT id FROM rh_turnos WHERE company_id = ? AND nombre = ? LIMIT 1`,
            [COMPANY_ID, nombre]
        );
        if (ex.length) {
            await conn.query(
                `UPDATE rh_turnos SET hora_entrada = ?, hora_salida = ?, hora_inicio_almuerzo = ?, hora_fin_almuerzo = ?, horas_jornada_diaria = ?, es_predeterminado = ?, is_active = 1 WHERE id = ?`,
                [ent, sal, almIni, almFin, hrs, isDefault ? 1 : 0, ex[0].id]
            );
            return ex[0].id;
        }
        const [ins] = await conn.query(
            `INSERT INTO rh_turnos (company_id, nombre, hora_entrada, hora_salida, hora_inicio_almuerzo, hora_fin_almuerzo, tolerancia_entrada_minutos, horas_jornada_diaria, es_predeterminado, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 15, ?, ?, 1)`,
            [COMPANY_ID, nombre, ent, sal, almIni, almFin, hrs, isDefault ? 1 : 0]
        );
        return ins.insertId;
    };

    await conn.query(`UPDATE rh_turnos SET es_predeterminado = 0 WHERE company_id = ?`, [COMPANY_ID]);
    const plantaShiftId = await ensureShift('Planta Producción (9h c/almuerzo)', '07:00:00', '16:00:00', '12:00:00', '13:00:00', 9.00, true);
    const transpShiftId = await ensureShift('Logística / Transporte (8h ruta)', '04:00:00', '12:00:00', '12:00:00', '13:00:00', 8.00, false);

    // Asignar turnos a operarios de planta y logística
    const plantaEmpIds = [20, 21, 22, 24, 25, 26, 32, 790, 793, 794, 795];
    const transpEmpIds = [23, 27];
    await conn.query(`UPDATE rh_empleados SET turno_id = ? WHERE company_id = ? AND id IN (?)`, [plantaShiftId, COMPANY_ID, plantaEmpIds]);
    await conn.query(`UPDATE rh_empleados SET turno_id = ? WHERE company_id = ? AND id IN (?)`, [transpShiftId, COMPANY_ID, transpEmpIds]);
    console.log(`[TURNOS] Planta 9h (id=${plantaShiftId}) asignado a ${plantaEmpIds.length} empleados; Transporte 8h (id=${transpShiftId}) a ${transpEmpIds.length} empleados.`);
}

async function main() {
    if (!fs.existsSync(BASE_DIR)) {
        throw new Error(`No existe la carpeta de archivos: ${BASE_DIR}`);
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await configureAndelsaSettingsAndShifts(conn);

        // Limpiar cortes previos dentro del rango histórico Jun-Nov 2026 (2026-05-26 a 2026-11-21) para importación idempotente
        const [existingCortes] = await conn.query(
            `SELECT id, nombre FROM rh_biometric_cortes
             WHERE company_id = ? AND NOT (fecha_fin < '2026-05-26' OR fecha_inicio > '2026-11-21')`,
            [COMPANY_ID]
        );
        if (existingCortes.length) {
            const ids = existingCortes.map(c => c.id);
            await conn.query(`UPDATE rh_biometric_attendance_logs SET congelado = 0, corte_id = NULL WHERE company_id = ? AND corte_id IN (?)`, [COMPANY_ID, ids]);
            await conn.query(`DELETE FROM rh_biometric_daily_overtime WHERE company_id = ? AND corte_id IN (?)`, [COMPANY_ID, ids]);
            await conn.query(`DELETE FROM rh_biometric_corte_saldos WHERE company_id = ? AND corte_id IN (?)`, [COMPANY_ID, ids]);
            await conn.query(`DELETE FROM rh_biometric_cortes WHERE company_id = ? AND id IN (?)`, [COMPANY_ID, ids]);
            console.log(`[RESET] Eliminados ${ids.length} corte(s) previos en rango May26-Nov21 para reimportación limpia:`, existingCortes.map(c => c.nombre));
        }

        // También limpiar daily_overtime sueltos dentro de May26-Nov21
        await conn.query(
            `DELETE FROM rh_biometric_daily_overtime WHERE company_id = ? AND fecha >= '2026-05-26' AND fecha <= '2026-11-21'`,
            [COMPANY_ID]
        );

        console.log('\n=== IMPORTANDO 12 CORTES QUINCENALES OFICIALES (JUNIO - NOVIEMBRE 2026) ===');
        const auditRows = [];

        for (const spec of CORTES_SPECS) {
            const filePath = path.join(BASE_DIR, spec.file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Archivo faltante: ${filePath}`);
            }

            const employees = await parseWorkbook(filePath, spec);

            let totTrab = 0;
            let totCalc = 0;
            let totNeto = 0;
            let totProd = 0;
            let totTransp = 0;
            let totAvicola = 0;
            let totPend = 0;
            let totPagable = 0;
            let totDays = 0;

            for (const emp of employees) {
                totTrab += emp.days.reduce((s, d) => s + d.horas_trabajadas, 0);
                totCalc += emp.horas_extra_periodo;
                totNeto += emp.saldo_neto;
                totAvicola += emp.horas_extra_avicola;
                totPend += emp.horas_pendientes_anteriores;
                totPagable += emp.horas_pagables;
                if (emp.categoria === 'transporte') totTransp += emp.saldo_neto;
                else totProd += emp.saldo_neto;
                totDays += emp.days.length;
            }

            const [corteRes] = await conn.query(
                `INSERT INTO rh_biometric_cortes (
                    company_id, nombre, fecha_inicio, fecha_fin, estado,
                    total_empleados, total_horas_trabajadas, total_horas_extra,
                    total_horas_extra_aprobadas, total_horas_extra_produccion,
                    total_horas_extra_transporte, total_horas_extra_avicola,
                    total_horas_pendientes_aplicadas, total_horas_extra_pagables,
                    observaciones, created_by
                ) VALUES (?, ?, ?, ?, 'congelado', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
                [
                    COMPANY_ID, spec.nombre, spec.start, spec.end,
                    employees.length,
                    parseFloat(totTrab.toFixed(2)),
                    parseFloat(totCalc.toFixed(2)),
                    parseFloat(totNeto.toFixed(2)),
                    parseFloat(totProd.toFixed(2)),
                    parseFloat(totTransp.toFixed(2)),
                    parseFloat(totAvicola.toFixed(2)),
                    parseFloat(totPend.toFixed(2)),
                    parseFloat(totPagable.toFixed(2)),
                    `Importado desde archivo oficial: ${spec.file}`
                ]
            );
            const corteId = corteRes.insertId;

            const dailyBulkValues = [];
            const saldosBulkValues = [];

            for (const emp of employees) {
                for (const d of emp.days) {
                    dailyBulkValues.push([
                        COMPANY_ID, corteId, emp.empleado_id, emp.device_uid, d.fecha,
                        d.entrada, d.salida, d.horas_trabajadas, 0,
                        d.horas_extra_calculadas, d.horas_extra_aprobadas,
                        d.horas_extra_avicola, d.es_dia_compensacion, 1, d.observacion, 1, null
                    ]);
                }

                saldosBulkValues.push([
                    COMPANY_ID, corteId, emp.empleado_id, emp.device_uid, emp.empleado_nombre,
                    emp.area, emp.categoria, emp.horas_jornada_base,
                    emp.horas_extra_periodo, emp.horas_pendientes_anteriores, emp.horas_extra_avicola,
                    emp.saldo_neto, emp.horas_pagables, emp.saldo_arrastre_siguiente
                ]);
            }

            if (dailyBulkValues.length > 0) {
                await conn.query(
                    `INSERT INTO rh_biometric_daily_overtime (
                        company_id, corte_id, empleado_id, device_uid, fecha, entrada, salida,
                        horas_trabajadas, minutos_tardanza, horas_extra_calculadas,
                        horas_extra_aprobadas, horas_extra_avicola, es_dia_compensacion,
                        es_editado, observacion, congelado, created_by
                    ) VALUES ?
                    ON DUPLICATE KEY UPDATE
                        corte_id = VALUES(corte_id),
                        empleado_id = COALESCE(VALUES(empleado_id), empleado_id),
                        entrada = COALESCE(VALUES(entrada), entrada),
                        salida = COALESCE(VALUES(salida), salida),
                        horas_trabajadas = VALUES(horas_trabajadas),
                        horas_extra_calculadas = VALUES(horas_extra_calculadas),
                        horas_extra_aprobadas = VALUES(horas_extra_aprobadas),
                        horas_extra_avicola = VALUES(horas_extra_avicola),
                        es_dia_compensacion = VALUES(es_dia_compensacion),
                        observacion = VALUES(observacion),
                        congelado = 1,
                        updated_at = NOW()`,
                    [dailyBulkValues]
                );
            }

            if (saldosBulkValues.length > 0) {
                await conn.query(
                    `INSERT INTO rh_biometric_corte_saldos (
                        company_id, corte_id, empleado_id, device_uid, empleado_nombre,
                        area, categoria, horas_jornada_base,
                        horas_extra_periodo, horas_pendientes_anteriores, horas_extra_avicola,
                        saldo_neto, horas_pagables, saldo_arrastre_siguiente
                    ) VALUES ?`,
                    [saldosBulkValues]
                );
            }
            console.log(`  [${spec.nombre}] -> id=${corteId} (${employees.length} emps, ${dailyBulkValues.length} dias, pagables=${totPagable.toFixed(1)}h)`);

            await conn.query(
                `UPDATE rh_biometric_attendance_logs
                 SET congelado = 1, corte_id = ?
                 WHERE company_id = ? AND punch_time >= ? AND punch_time <= ?`,
                [corteId, COMPANY_ID, `${spec.start} 00:00:00`, `${spec.end} 23:59:59`]
            );

            const excelSum = parseFloat(employees.reduce((s, e) => s + e.excel_total, 0).toFixed(2));
            auditRows.push({
                id: corteId,
                nombre: spec.nombre,
                rango: `${spec.start}..${spec.end}`,
                emps: employees.length,
                dias: totDays,
                prod: totProd.toFixed(1),
                transp: totTransp.toFixed(1),
                pend: totPend.toFixed(1),
                neto: totNeto.toFixed(1),
                excelSum: excelSum.toFixed(1),
                pagable: totPagable.toFixed(1),
                avicola: totAvicola.toFixed(1)
            });
        }

        await conn.commit();
        console.table(auditRows);
        console.log('\n✅ Los 12 cortes históricos de ANDELSA (Junio - Noviembre 2026) fueron importados y congelados con éxito.');
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('❌ Error en importación:', err);
    process.exit(1);
});
