
/**
 * Lightweight renderer that converts AI markdown reports into structured HTML,
 * rendering real responsive tables with headers, zebra striping, and aligned numbers.
 */
export const AiTaskMarkdownRenderer = ({ content = '' }) => {
    if (!content) return null;

    const sections = [];
    const lines = content.split('\n');
    let currentTable = null;
    let currentParagraphs = [];

    const flushParagraphs = () => {
        if (currentParagraphs.length > 0) {
            sections.push({
                type: 'text',
                content: currentParagraphs.join('\n')
            });
            currentParagraphs = [];
        }
    };

    const flushTable = () => {
        if (currentTable) {
            sections.push({
                type: 'table',
                headers: currentTable.headers,
                rows: currentTable.rows,
                totalsRow: currentTable.totalsRow
            });
            currentTable = null;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            flushParagraphs();
            const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());

            if (!currentTable) {
                currentTable = {
                    headers: cells.map(c => c.replace(/\*\*/g, '').trim()),
                    rows: [],
                    totalsRow: null
                };
            } else if (trimmed.includes('---')) {
                // divider row, skip
                continue;
            } else {
                const firstCell = cells[0]?.toLowerCase() || '';
                if (firstCell.includes('total') || firstCell.includes('resumen')) {
                    currentTable.totalsRow = cells;
                } else {
                    currentTable.rows.push(cells);
                }
            }
        } else {
            if (currentTable) {
                flushTable();
            }
            if (trimmed.length > 0) {
                currentParagraphs.push(line);
            } else if (currentParagraphs.length > 0) {
                currentParagraphs.push('');
            }
        }
    }

    flushTable();
    flushParagraphs();

    return (
        <div className="space-y-3 text-xs leading-relaxed text-slate-800">
            {sections.map((sec, idx) => {
                if (sec.type === 'table') {
                    return (
                        <div key={idx} className="overflow-x-auto my-3 rounded-xl border border-slate-200 bg-white shadow-xs">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                                    <tr>
                                        {sec.headers.map((h, hIdx) => (
                                            <th
                                                key={hIdx}
                                                className={`px-3 py-2 ${hIdx === 0 ? 'text-left' : 'text-right'}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sec.rows.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-indigo-50/40 transition-colors even:bg-slate-50/60">
                                            {row.map((cell, cIdx) => {
                                                const clean = cell.replace(/\*\*/g, '').trim();
                                                const isFirst = cIdx === 0;
                                                const isLast = cIdx === row.length - 1;
                                                const isRight = !isFirst && !isLast;

                                                let colorClass = 'text-slate-700';
                                                if (cIdx === 1) colorClass = 'text-indigo-600 font-medium';
                                                if (cIdx === 2) colorClass = 'text-emerald-600 font-medium';
                                                if (cIdx === 4 || cIdx === 5) {
                                                    if (clean.startsWith('-') || clean.startsWith('−')) colorClass = 'text-rose-600 font-semibold';
                                                    else colorClass = 'text-sky-600 font-semibold';
                                                }

                                                return (
                                                    <td
                                                        key={cIdx}
                                                        className={`px-3 py-1.5 whitespace-nowrap ${
                                                            isRight ? 'text-right font-mono' : isFirst ? 'text-left font-semibold text-slate-900' : 'text-left'
                                                        } ${colorClass}`}
                                                    >
                                                        {clean}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}

                                    {sec.totalsRow && (
                                        <tr className="bg-indigo-50/90 font-bold border-t-2 border-indigo-200">
                                            {sec.totalsRow.map((cell, cIdx) => (
                                                <td
                                                    key={cIdx}
                                                    className={`px-3 py-2 text-indigo-950 font-bold whitespace-nowrap ${
                                                        cIdx === 0 ? 'text-left' : 'text-right font-mono'
                                                    }`}
                                                >
                                                    {cell.replace(/\*\*/g, '').trim()}
                                                </td>
                                            ))}
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    );
                }

                return (
                    <div key={idx} className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
                        {sec.content}
                    </div>
                );
            })}
        </div>
    );
};

export default AiTaskMarkdownRenderer;
