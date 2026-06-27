const { execSync } = require('child_process');
const path = require('path');

const getChangelog = async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const repoPath = path.resolve(__dirname, '../../..');

        const output = execSync(
            `git log --max-count=${parseInt(limit)} --format="%H|%h|%an|%ai|%s" --date=iso`,
            { cwd: repoPath }
        ).toString().trim();

        if (!output) return res.json({ data: [], total: 0 });

        const commits = output.split('\n').filter(Boolean).map(line => {
            const [fullHash, hash, author, date, ...msgParts] = line.split('|');
            const msg = msgParts.join('|');
            const colonIdx = msg.indexOf(': ');
            return {
                hash,
                fullHash,
                author,
                date,
                message: msg,
                scope: colonIdx !== -1 ? msg.slice(0, colonIdx) : null,
                description: colonIdx !== -1 ? msg.slice(colonIdx + 2) : msg,
            };
        });

        res.json({ data: commits, total: commits.length });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener historial de cambios', error: error.message });
    }
};

module.exports = { getChangelog };
