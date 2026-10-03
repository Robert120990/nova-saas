const pool = require('../../config/db');

const resolveAccountTypeId = (value, types) => {
    const raw = String(value ?? '').trim().replace(/^"|"$/g, '').trim();
    if (!raw) return null;
    const numeric = parseInt(raw, 10);
    if (!Number.isNaN(numeric) && types.some(t => t.id === numeric)) return numeric;
    const key = raw.toLowerCase();
    const found = types.find(t => String(t.code).toLowerCase() === key || String(t.name).toLowerCase() === key);
    return found ? found.id : null;
};

const validateAccounts = async (req, res) => {
    try {
        const { accounts } = req.body;
        if (!Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ message: 'No se recibieron cuentas para importar' });
        }

        const [existing] = await pool.query('SELECT id, code FROM chart_of_accounts WHERE company_id = ?', [req.company_id]);
        const codeToId = {};
        existing.forEach(a => { codeToId[a.code] = a.id; });

        const [types] = await pool.query('SELECT id, code, name FROM account_types');
        if (types.length === 0) {
            return res.status(400).json({ message: 'No hay tipos de cuenta configurados en el sistema. Configúralos antes de importar.' });
        }

        const seenCodes = new Set();
        const rows = [];
        let newCount = 0, updateCount = 0, errorCount = 0;

        accounts.forEach((row, index) => {
            const code = String(row.code || '').trim();
            const name = String(row.name || '').trim();
            const typeId = resolveAccountTypeId(row.account_type_id, types);
            const parentCode = String(row.parent_code || '').trim();
            const allows = row.allows_entries === '1' || row.allows_entries === 1 || row.allows_entries === true ? 1 : 0;

            const errorMessages = [];
            if (!code) errorMessages.push('El código es obligatorio');
            else if (code.length > 20) errorMessages.push('El código no puede superar 20 caracteres');
            if (!name) errorMessages.push('El nombre es obligatorio');
            if (!typeId) errorMessages.push(`Tipo de cuenta inválido: "${String(row.account_type_id ?? '').trim()}"`);
            if (code && seenCodes.has(code)) errorMessages.push('Código duplicado en el archivo');
            if (parentCode && !codeToId[parentCode] && !seenCodes.has(parentCode)) errorMessages.push(`La cuenta padre "${parentCode}" no existe`);

            if (code) seenCodes.add(code);

            const status = errorMessages.length > 0 ? 'error' : (codeToId[code] ? 'update' : 'new');
            if (status === 'error') errorCount++;
            else if (status === 'update') updateCount++;
            else newCount++;

            rows.push({
                index,
                code,
                name,
                account_type_id: typeId || null,
                parent_code: parentCode,
                allows_entries: allows,
                status,
                error: status === 'error' ? errorMessages.join('; ') : null
            });
        });

        res.json({ rows, totals: { total: accounts.length, new: newCount, updates: updateCount, errors: errorCount } });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const importAccounts = async (req, res) => {
    try {
        const { accounts } = req.body;
        if (!Array.isArray(accounts) || accounts.length === 0) {
            return res.status(400).json({ message: 'No se recibieron cuentas para importar' });
        }

        let imported = 0, updated = 0, errors = 0;
        const codeToId = {};

        const [existing] = await pool.query('SELECT id, code FROM chart_of_accounts WHERE company_id = ?', [req.company_id]);
        existing.forEach(a => { codeToId[a.code] = a.id; });

        const [types] = await pool.query('SELECT id, code, name FROM account_types');

        for (const row of accounts) {
            try {
                const code = String(row.code || '').trim();
                const name = String(row.name || '').trim();
                const typeId = resolveAccountTypeId(row.account_type_id, types);
                const parentCode = String(row.parent_code || '').trim();
                const allows = row.allows_entries === '1' || row.allows_entries === 1 || row.allows_entries === true ? 1 : 0;

                if (!code || !name || !typeId) { errors++; continue; }

                const parentId = parentCode ? codeToId[parentCode] : null;

                if (codeToId[code]) {
                    await pool.query(
                        `UPDATE chart_of_accounts SET account_type_id = ?, parent_id = ?, name = ?, allows_entries = ? WHERE id = ? AND company_id = ?`,
                        [typeId, parentId || null, name, allows, codeToId[code], req.company_id]
                    );
                    updated++;
                } else {
                    const [r] = await pool.query(
                        `INSERT INTO chart_of_accounts (company_id, account_type_id, parent_id, code, name, allows_entries, active) 
                         VALUES (?, ?, ?, ?, ?, ?, 1)`,
                        [req.company_id, typeId, parentId || null, code, name, allows]
                    );
                    codeToId[code] = r.insertId;
                    imported++;
                }
            } catch (e) { errors++; }
        }

        res.json({ message: `Importadas: ${imported}, Actualizadas: ${updated}, Errores: ${errors}`, imported, updated, errors });
    } catch (e) { res.status(500).json({ message: e.message }); }
};


module.exports = { validateAccounts, importAccounts };
