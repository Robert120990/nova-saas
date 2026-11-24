const path = require('path');
const pool = require('../config/db');
const {
    timeStrToHours,
    parseZkEmployeeFile,
    parseZkFolder,
    getAvailableZkFolders
} = require('./rhBiometricZkParser.helper');

function cleanTokens(str) {
    return (str || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2);
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

        let matched = dbEmployees.find(e => String(e.codigo_biometrico || '').trim() === pe.acNo);
        let matchType = matched ? 'codigo_biometrico' : 'ninguno';

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
                await conn.query(
                    'UPDATE rh_empleados SET codigo_biometrico = ? WHERE id = ? AND company_id = ?',
                    [pe.acNo, empId, companyId]
                );
            }

            matchedList.push({ acNo: pe.acNo, file: pe.filename, empId });

            for (const [dateStr, dayData] of Object.entries(pe.days)) {
                const punchesToInsert = [];
                if (dayData.r1_ent) punchesToInsert.push({ time: `${dateStr} ${dayData.r1_ent}:00`, type: 'entrada' });
                if (dayData.r1_sal) punchesToInsert.push({ time: `${dateStr} ${dayData.r1_sal}:00`, type: 'salida_almuerzo' });
                if (dayData.r2_ent) punchesToInsert.push({ time: `${dateStr} ${dayData.r2_ent}:00`, type: 'entrada_almuerzo' });
                if (dayData.r2_sal) punchesToInsert.push({ time: `${dateStr} ${dayData.r2_sal}:00`, type: 'salida' });

                for (const p of punchesToInsert) {
                    const [dup] = await conn.query(
                        `SELECT id, empleado_id FROM rh_biometric_attendance_logs
                         WHERE company_id = ? AND device_uid = ? AND punch_time = ? LIMIT 1`,
                        [companyId, pe.acNo, p.time]
                    );

                    if (dup.length === 0) {
                        await conn.query(
                            `INSERT INTO rh_biometric_attendance_logs
                             (company_id, device_id, device_uid, empleado_id, punch_time, punch_type, source, raw_data)
                             VALUES (?, NULL, ?, ?, ?, ?, 'zk_import', ?)`,
                            [
                                companyId, pe.acNo, empId, p.time, p.type,
                                JSON.stringify({ file: pe.filename, timetable: dayData.entries[0]?.timetable })
                            ]
                        );
                        totalPunchesInserted++;
                    } else if (empId && !dup[0].empleado_id) {
                        await conn.query(
                            'UPDATE rh_biometric_attendance_logs SET empleado_id = ? WHERE id = ?',
                            [empId, dup[0].id]
                        );
                    }
                }

                if (dayData.otTime) {
                    const otHours = Math.round(timeStrToHours(dayData.otTime) * 100) / 100;
                    if (otHours > 0) {
                        await conn.query(
                            `INSERT INTO rh_biometric_daily_overtime
                             (company_id, empleado_id, device_uid, fecha, horas_extra_calculadas, horas_extra_aprobadas, es_editado, observacion, created_by)
                             VALUES (?, ?, ?, ?, ?, ?, 1, 'Importado de ZK', ?)
                             ON DUPLICATE KEY UPDATE
                                 empleado_id = COALESCE(VALUES(empleado_id), empleado_id),
                                 horas_extra_calculadas = VALUES(horas_extra_calculadas),
                                 horas_extra_aprobadas = VALUES(horas_extra_aprobadas),
                                 observacion = VALUES(observacion),
                                 updated_at = NOW()`,
                            [companyId, empId, pe.acNo, dateStr, otHours, otHours, userId || null]
                        );
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
