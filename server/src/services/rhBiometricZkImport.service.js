const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pool = require('../config/db');

function timeStrToHours(tStr) {
    if (!tStr) return 0;
    const parts = tStr.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h + (m / 60);
}

/**
 * Parsea un archivo individual .xls de ZKTime / Attendance Management
 */
function parseZkEmployeeFile(filePathOrBuffer, filename = '') {
    let wb;
    if (typeof filePathOrBuffer === 'string') {
        wb = XLSX.readFile(filePathOrBuffer);
        if (!filename) filename = path.basename(filePathOrBuffer);
    } else {
        wb = XLSX.read(filePathOrBuffer, { type: 'buffer' });
    }

    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows || rows.length <= 1) return null;

    const header = rows[0];
    const getCol = (name) => header.findIndex(h => String(h || '').trim().toLowerCase() === name.toLowerCase());

    const acIdx = getCol('AC-No.');
    const nameIdx = getCol('Name');
    const dateIdx = getCol('Date');
    const inIdx = getCol('Clock In');
    const outIdx = getCol('Clock Out');
    const otIdx = getCol('OT Time');
    const attIdx = getCol('ATT_Time');
    const timetableIdx = getCol('Timetable');

    const acNo = String(rows[1][acIdx] || '').trim();
    const rawName = String(rows[1][nameIdx] || '').trim();
    const days = {};

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const rawDate = String(r[dateIdx] || '').trim();
        if (!rawDate) continue;

        let isoDate = '';
        const parts = rawDate.split('/');
        if (parts.length === 3) {
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            isoDate = `${y}-${m}-${d}`;
        } else {
            isoDate = rawDate;
        }

        if (!days[isoDate]) {
            days[isoDate] = {
                date: isoDate,
                entries: [],
                r1_ent: null,
                r1_sal: null,
                r2_ent: null,
                r2_sal: null,
                otTime: null,
                attTime: null
            };
        }

        const cIn = String(r[inIdx] || '').trim();
        const cOut = String(r[outIdx] || '').trim();
        const ot = String(r[otIdx] || '').trim();
        const att = String(r[attIdx] || '').trim();
        const timetable = String(r[timetableIdx] || '').trim();

        days[isoDate].entries.push({ cIn, cOut, ot, att, timetable });

        if (days[isoDate].entries.length === 1) {
            days[isoDate].r1_ent = cIn;
            days[isoDate].r1_sal = cOut;
        } else if (days[isoDate].entries.length === 2) {
            days[isoDate].r2_ent = cIn;
            days[isoDate].r2_sal = cOut;
        }

        if (ot && !days[isoDate].otTime) days[isoDate].otTime = ot;
        if (att && !days[isoDate].attTime) days[isoDate].attTime = att;
    }

    return {
        filename,
        acNo,
        name: rawName,
        days
    };
}

/**
 * Escanea una carpeta y parsea todos los .xls de empleados
 */
function parseZkFolder(folderPath) {
    if (!fs.existsSync(folderPath)) {
        throw new Error(`La ruta ${folderPath} no existe en el sistema.`);
    }

    const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.xls') || f.toLowerCase().endsWith('.xls.xls'));
    const results = [];

    for (const f of files) {
        const fullPath = path.join(folderPath, f);
        try {
            const parsed = parseZkEmployeeFile(fullPath, f);
            if (parsed) results.push(parsed);
        } catch (e) {
            console.warn(`Error al leer archivo ${f}:`, e.message);
        }
    }

    return results;
}

/**
 * Obtener subcarpetas disponibles en la ruta base
 */
function getAvailableZkFolders(basePath = 'C:\\Users\\rauls\\Downloads\\HORAS 25.06.2026') {
    if (!fs.existsSync(basePath)) {
        return { basePath, exists: false, folders: [] };
    }

    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    const folders = [];

    for (const e of entries) {
        if (e.isDirectory()) {
            const subPath = path.join(basePath, e.name);
            const files = fs.readdirSync(subPath).filter(f => f.toLowerCase().endsWith('.xls'));
            folders.push({
                name: e.name,
                path: subPath,
                fileCount: files.length
            });
        }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return {
        basePath,
        exists: true,
        folders
    };
}

/**
 * Vista previa de los empleados encontrados en una carpeta y su vinculación con NovaSaaS
 */
async function previewZkFolder(companyId, folderPath) {
    const parsedEmployees = parseZkFolder(folderPath);
    if (!parsedEmployees.length) {
        return {
            folderPath,
            folderName: path.basename(folderPath),
            dateRange: { startDate: '', endDate: '' },
            totalFiles: 0,
            employees: [],
            dbEmployees: []
        };
    }

    const [dbEmployees] = await pool.query(`
        SELECT id, codigo, codigo_biometrico, CONCAT(COALESCE(nombres, ''), ' ', COALESCE(apellidos, '')) as nombre_completo
        FROM rh_empleados
        WHERE company_id = ? AND es_activo = 1
        ORDER BY nombre_completo ASC
    `, [companyId]);

    let minDate = '9999-12-31';
    let maxDate = '0000-00-00';

    const cleanTokens = (str) => {
        return (str || '')
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Z0-9\s]/g, '')
            .split(/\s+/)
            .filter(t => t.length > 2);
    };

    const employeesResult = [];

    for (const pe of parsedEmployees) {
        let punchesCount = 0;
        let totalOtHours = 0;
        const daysKeys = Object.keys(pe.days);

        for (const d of daysKeys) {
            if (d < minDate) minDate = d;
            if (d > maxDate) maxDate = d;

            const day = pe.days[d];
            if (day.r1_ent) punchesCount++;
            if (day.r1_sal) punchesCount++;
            if (day.r2_ent) punchesCount++;
            if (day.r2_sal) punchesCount++;
            if (day.otTime) totalOtHours += timeStrToHours(day.otTime);
        }

        // Búsqueda inteligente del colaborador
        // 1. Coincidencia por Código Biométrico
        let matched = dbEmployees.find(e => String(e.codigo_biometrico || '').trim() === pe.acNo);
        let matchType = matched ? 'codigo_biometrico' : 'ninguno';

        // 2. Coincidencia por Tokens de Nombre del archivo
        if (!matched) {
            const fileClean = pe.filename.replace(/\.xls(\.xls)?$/i, '');
            const fileTokens = cleanTokens(fileClean);
            matched = dbEmployees.find(e => {
                const eTokens = cleanTokens(e.nombre_completo);
                const overlap = fileTokens.filter(t => eTokens.includes(t));
                return overlap.length >= 2 || (fileTokens.length === 1 && overlap.length === 1);
            });
            if (matched) matchType = 'nombre';
        }

        // 3. Coincidencia por Tokens del campo interno Name
        if (!matched && pe.name) {
            const internalTokens = cleanTokens(pe.name);
            matched = dbEmployees.find(e => {
                const eTokens = cleanTokens(e.nombre_completo);
                const overlap = internalTokens.filter(t => eTokens.includes(t));
                return overlap.length >= 1 && (overlap.length >= 2 || eTokens[0] === internalTokens[0]);
            });
            if (matched) matchType = 'nombre';
        }

        employeesResult.push({
            acNo: pe.acNo,
            fileName: pe.filename,
            nameInFile: pe.name,
            suggestedEmpId: matched ? matched.id : null,
            suggestedEmpName: matched ? matched.nombre_completo : null,
            matchType,
            daysCount: daysKeys.length,
            punchesCount,
            totalOtHours: parseFloat(totalOtHours.toFixed(2))
        });
    }

    employeesResult.sort((a, b) => (parseInt(a.acNo, 10) || 0) - (parseInt(b.acNo, 10) || 0));

    return {
        folderPath,
        folderName: path.basename(folderPath),
        dateRange: {
            startDate: minDate !== '9999-12-31' ? minDate : '',
            endDate: maxDate !== '0000-00-00' ? maxDate : ''
        },
        totalFiles: parsedEmployees.length,
        employees: employeesResult,
        dbEmployees
    };
}

/**
 * Importa las marcaciones y horas extra de los archivos a la base de datos
 */
async function importZkFolder(companyId, payload = {}, userId = null) {
    const { folderPath, mappings = {}, updateBioCodes = true } = payload;
    const parsedEmployees = parseZkFolder(folderPath);
    if (!parsedEmployees.length) {
        throw new Error('No se encontraron archivos válidos en la carpeta.');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let totalPunchesInserted = 0;
        let totalOvertimeRecords = 0;
        const matchedList = [];

        for (const pe of parsedEmployees) {
            const empId = mappings[pe.acNo] || null;

            if (empId && updateBioCodes) {
                // Actualizar o sincronizar el código biométrico en la ficha del empleado
                await conn.query(`
                    UPDATE rh_empleados
                    SET codigo_biometrico = ?
                    WHERE id = ? AND company_id = ?
                `, [pe.acNo, empId, companyId]);
            }

            matchedList.push({ acNo: pe.acNo, file: pe.filename, empId });

            for (const [dateStr, dayData] of Object.entries(pe.days)) {
                const punchesToInsert = [];
                if (dayData.r1_ent) punchesToInsert.push({ time: `${dateStr} ${dayData.r1_ent}:00`, type: 'entrada' });
                if (dayData.r1_sal) punchesToInsert.push({ time: `${dateStr} ${dayData.r1_sal}:00`, type: 'salida_almuerzo' });
                if (dayData.r2_ent) punchesToInsert.push({ time: `${dateStr} ${dayData.r2_ent}:00`, type: 'entrada_almuerzo' });
                if (dayData.r2_sal) punchesToInsert.push({ time: `${dateStr} ${dayData.r2_sal}:00`, type: 'salida' });

                for (const p of punchesToInsert) {
                    const [dup] = await conn.query(`
                        SELECT id FROM rh_biometric_attendance_logs
                        WHERE company_id = ? AND device_uid = ? AND punch_time = ?
                        LIMIT 1
                    `, [companyId, pe.acNo, p.time]);

                    if (dup.length === 0) {
                        await conn.query(`
                            INSERT INTO rh_biometric_attendance_logs
                            (company_id, device_id, device_uid, empleado_id, punch_time, punch_type, source, raw_data)
                            VALUES (?, NULL, ?, ?, ?, ?, 'zk_import', ?)
                        `, [
                            companyId,
                            pe.acNo,
                            empId,
                            p.time,
                            p.type,
                            JSON.stringify({ file: pe.filename, timetable: dayData.entries[0]?.timetable })
                        ]);
                        totalPunchesInserted++;
                    } else if (empId && !dup[0].empleado_id) {
                        // Si ya existía pero no tenía empleado_id vinculado
                        await conn.query(`
                            UPDATE rh_biometric_attendance_logs
                            SET empleado_id = ?
                            WHERE id = ?
                        `, [empId, dup[0].id]);
                    }
                }

                if (dayData.otTime) {
                    const otHours = Math.round(timeStrToHours(dayData.otTime) * 100) / 100;
                    if (otHours > 0) {
                        await conn.query(`
                            INSERT INTO rh_biometric_daily_overtime
                            (company_id, empleado_id, device_uid, fecha, horas_extra_calculadas, horas_extra_aprobadas, es_editado, observacion, created_by)
                            VALUES (?, ?, ?, ?, ?, ?, 1, 'Importado de ZK', ?)
                            ON DUPLICATE KEY UPDATE
                                empleado_id = COALESCE(VALUES(empleado_id), empleado_id),
                                horas_extra_calculadas = VALUES(horas_extra_calculadas),
                                horas_extra_aprobadas = VALUES(horas_extra_aprobadas),
                                observacion = VALUES(observacion),
                                updated_at = NOW()
                        `, [companyId, empId, pe.acNo, dateStr, otHours, otHours, userId || null]);
                        totalOvertimeRecords++;
                    }
                }
            }
        }

        await conn.commit();
        return {
            success: true,
            totalPunchesInserted,
            totalOvertimeRecords,
            employeesCount: parsedEmployees.length,
            matchedEmployees: matchedList
        };
    } catch (err) {
        await conn.rollback();
        console.error('Error importando archivos ZK a BD:', err);
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    parseZkEmployeeFile,
    parseZkFolder,
    getAvailableZkFolders,
    previewZkFolder,
    importZkFolder
};
