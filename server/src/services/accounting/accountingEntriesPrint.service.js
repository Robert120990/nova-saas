/**
 * Service for formatting and structuring Accounting Entries Printing
 * Builds hierarchical mayorized account structures (Parciales, Cargos, Abonos)
 */

const getAncestors = (code, accMap) => {
    const ancestors = [];
    const lengths = [1, 2, 4, 6, 8, 10].filter(l => l < code.length);
    for (const l of lengths) {
        const sub = code.substring(0, l);
        if (accMap.has(sub)) ancestors.push({ code: sub, name: accMap.get(sub) });
    }
    return ancestors;
};

const buildMayorizedRows = (lines, isDebit, accMap) => {
    const groupMap = new Map();
    for (const l of lines) {
        const mayorCode = l.code.length >= 4 ? l.code.substring(0, 4) : l.code;
        if (!groupMap.has(mayorCode)) groupMap.set(mayorCode, []);
        groupMap.get(mayorCode).push(l);
    }

    const rows = [];
    for (const groupLines of groupMap.values()) {
        const groupTotal = groupLines.reduce((s, l) => s + (isDebit ? l.debit : l.credit), 0);
        let commonAncestors = getAncestors(groupLines[0].code, accMap);
        for (let i = 1; i < groupLines.length; i++) {
            const anc = getAncestors(groupLines[i].code, accMap);
            const ancCodes = new Set(anc.map(a => a.code));
            commonAncestors = commonAncestors.filter(a => ancCodes.has(a.code));
        }

        for (const a of commonAncestors) {
            rows.push({
                code: a.code,
                name: a.name,
                concept: '',
                parcial: null,
                cargo: isDebit ? groupTotal : null,
                abono: !isDebit ? groupTotal : null
            });
        }

        for (const l of groupLines) {
            const lineAncestors = getAncestors(l.code, accMap);
            const commonSet = new Set(commonAncestors.map(a => a.code));
            const remaining = lineAncestors.filter(a => !commonSet.has(a.code));
            for (const ra of remaining) {
                const amt = isDebit ? l.debit : l.credit;
                rows.push({
                    code: ra.code,
                    name: ra.name,
                    concept: '',
                    parcial: null,
                    cargo: isDebit ? amt : null,
                    abono: !isDebit ? amt : null
                });
            }
            rows.push({
                code: l.code,
                name: l.name || accMap.get(l.code) || '',
                concept: l.description,
                parcial: isDebit ? l.debit : l.credit,
                cargo: null,
                abono: null
            });
        }
    }
    return rows;
};

module.exports = {
    getAncestors,
    buildMayorizedRows
};
