const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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
            const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
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

    return { filename, acNo, name: rawName, days };
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
            folders.push({ name: e.name, path: subPath, fileCount: files.length });
        }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return { basePath, exists: true, folders };
}

module.exports = {
    timeStrToHours,
    parseZkEmployeeFile,
    parseZkFolder,
    getAvailableZkFolders
};
