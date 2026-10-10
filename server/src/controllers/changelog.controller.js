const { execSync } = require('child_process');
const path = require('path');

const getChangelog = async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const repoPath = path.resolve(__dirname, '../../..');

        let totalCommits = 0;
        try {
            totalCommits = parseInt(execSync('git rev-list --count HEAD', { cwd: repoPath }).toString().trim(), 10) || 0;
        } catch {
            totalCommits = 0;
        }

        const output = execSync(
            `git log --max-count=${parseInt(limit, 10)} --format="%H|%h|%an|%ai|%s" --date=iso`,
            { cwd: repoPath }
        ).toString().trim();

        if (!output) return res.json({ data: [], total: 0 });

        const commits = output.split('\n').filter(Boolean).map((line, index) => {
            const [fullHash, hash, author, date, ...msgParts] = line.split('|');
            const msg = msgParts.join('|');
            const colonIdx = msg.indexOf(': ');

            // Extracción o cálculo de la versión autoincrementable (v2.08.xx a partir de commit 1000)
            const rawCommitNumber = totalCommits > 0 ? (totalCommits - index) : null;
            let calculatedVersion = null;
            if (rawCommitNumber) {
                if (rawCommitNumber >= 1000) {
                    const patch = String(rawCommitNumber - 999).padStart(2, '0');
                    calculatedVersion = `v2.08.${patch}`;
                } else {
                    const patch = String(rawCommitNumber).padStart(2, '0');
                    calculatedVersion = `v2.07.${patch}`;
                }
            }
            const versionMatch = msg.match(/v\d+\.\d+\.\d+/i);
            const version = calculatedVersion || (versionMatch ? versionMatch[0] : null);

            return {
                hash,
                fullHash,
                version,
                commitNumber: rawCommitNumber,
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
