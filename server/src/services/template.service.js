function render(template, variables) {
    if (!template) return '';
    return template.replace(/\{\{(\w+(?:\.\w+)*(?:\[\d+\])?)\}\}/g, (match, path) => {
        const value = resolvePath(variables, path);
        if (value === null || value === undefined) return match;
        if (typeof value === 'number') return formatNumber(value);
        return String(value);
    });
}

function resolvePath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return null;
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
            current = current[arrayMatch[1]];
            if (Array.isArray(current)) {
                current = current[parseInt(arrayMatch[2])];
            } else {
                return null;
            }
        } else {
            current = current[part];
        }
    }
    return current;
}

function formatNumber(num) {
    return num.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractVariables(template) {
    if (!template) return [];
    const matches = template.match(/\{\{(\w+(?:\.\w+)*(?:\[\d+\])?)\}\}/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/\{\{|\}\}/g, ''));
}

module.exports = { render, resolvePath, extractVariables };
