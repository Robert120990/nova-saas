const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const levenshtein = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const m = a.length;
    const n = b.length;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
        curr[0] = i;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[n];
};

const scoreToken = (token, text, words) => {
    if (text.includes(token)) return 0;
    if (token.length <= 2) return null;
    const maxDist = token.length >= 5 ? 2 : 1;
    let best = null;
    for (const w of words) {
        if (!w) continue;
        if (w === token) { best = 0; break; }
        if (w.startsWith(token)) { best = Math.min(best ?? 99, 1); continue; }
        const d = levenshtein(token, w);
        if (d <= maxDist) best = Math.min(best ?? 99, 3 + d);
    }
    return best;
};

export const matchScore = (text, query) => {
    const t = normalize(text);
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return 0;
    const words = t.split(/\s+/);
    let total = 0;
    for (const token of tokens) {
        const score = scoreToken(token, t, words);
        if (score === null) return null;
        total += score;
    }
    return total;
};

export const matchesQuery = (text, query) => matchScore(text, query) !== null;

export default matchesQuery;