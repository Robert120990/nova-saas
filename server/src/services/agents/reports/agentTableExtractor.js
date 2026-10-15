/**
 * Helper to parse and clean numbers from formatted strings (e.g., "$ 1,234.50", "−40.69", "12.5%").
 */
function parseNumericValue(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    // Replace unicode minus signs (U+2212, U+2013, U+2014) with standard ASCII minus
    const cleaned = String(val)
        .replace(/[−–—]/g, '-')
        .replace(/[$€,\s*%]/g, '')
        .trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

/**
 * Checks if a row is a placeholder/mock row (e.g. "| ... |" or "| $— |").
 */
function isDummyRow(cells) {
    if (!cells || cells.length === 0) return true;
    const joined = cells.join('').replace(/[\s|*–—.\-]/g, '');
    return joined.length === 0 || /^(\.{2,}|…|---|N\/?A)$/i.test(joined);
}

/**
 * Extracts structured tabular and numeric data from markdown text or SQL tool results.
 */
function extractTableData(resultText = '', toolResults = []) {
    // 1. Prioritize markdown tables curated by the AI agent in resultText
    const lines = (resultText || '').split('\n');
    const tablesFound = [];
    let currentTable = null;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
            if (!currentTable) {
                currentTable = {
                    headers: cells.map(c => c.replace(/\*\*/g, '').trim()),
                    dataRows: [],
                    totalsRow: null
                };
            } else if (trimmed.includes('---')) {
                // divider, skip
                continue;
            } else if (isDummyRow(cells)) {
                // dummy row, skip
                continue;
            } else {
                const firstCell = cells[0]?.toLowerCase() || '';
                if (firstCell.includes('total') || firstCell.includes('resumen')) {
                    currentTable.totalsRow = cells;
                } else {
                    currentTable.dataRows.push(cells);
                }
            }
        } else if (currentTable) {
            // End of current table
            if (currentTable.headers.length > 0 && (currentTable.dataRows.length > 0 || currentTable.totalsRow)) {
                tablesFound.push(currentTable);
            }
            currentTable = null;
        }
    }
    if (currentTable && currentTable.headers.length > 0 && (currentTable.dataRows.length > 0 || currentTable.totalsRow)) {
        tablesFound.push(currentTable);
    }

    if (tablesFound.length > 0) {
        // Pick the table with the highest information density (columns * rows)
        tablesFound.sort((a, b) => {
            const scoreA = (a.headers.length || 0) * (a.dataRows.length || 1);
            const scoreB = (b.headers.length || 0) * (b.dataRows.length || 1);
            return scoreB - scoreA;
        });

        const best = tablesFound[0];
        const allRows = best.totalsRow ? [...best.dataRows, best.totalsRow] : best.dataRows;
        return {
            headers: best.headers,
            rows: allRows,
            dataRows: best.dataRows,
            totalsRow: best.totalsRow,
            numericValues: best.dataRows.map(r => r.map(parseNumericValue))
        };
    }

    // 2. Fallback: Check for raw SQL query data in tool results (excluding schema inspection queries)
    for (const tr of toolResults || []) {
        if (tr?.content) {
            try {
                const parsed = typeof tr.content === 'string' ? JSON.parse(tr.content) : tr.content;
                const rowsData = parsed?.data || (Array.isArray(parsed) ? parsed : null);
                if (Array.isArray(rowsData) && rowsData.length > 0 && typeof rowsData[0] === 'object') {
                    const keys = Object.keys(rowsData[0]);
                    // Ignore internal schema queries (information_schema, column_name, etc.)
                    const isSchemaQuery = keys.some(k => ['column_name', 'data_type', 'table_name'].includes(k.toLowerCase()));
                    if (!isSchemaQuery) {
                        const headers = keys.map(k => k.replace(/_/g, ' ').toUpperCase());
                        const rows = rowsData.map(item => keys.map(k => item[k] ?? '---'));
                        return {
                            headers,
                            rows,
                            dataRows: rows,
                            rawObjects: rowsData,
                            numericValues: rows.map(r => r.map(parseNumericValue))
                        };
                    }
                }
            } catch {
                // not JSON or no tabular rows
            }
        }
    }

    return null;
}

module.exports = {
    parseNumericValue,
    isDummyRow,
    extractTableData
};
