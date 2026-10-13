const pool = require('../config/db');
const { reserveEntryNumber } = require('./accounting.correlativos.controller');
const { validateEntryLines } = require('../services/accounting/accountingEntryIntegrity.service');
const { buildCloseoutsPreview } = require('../services/accounting/accountingCloseoutsPreview.service');
const notificationService = require('../services/notification.service');

const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

async function getEntryTypeIdByCode(code) {
    const [[row]] = await pool.query('SELECT id FROM entry_types WHERE code = ?', [code]);
    return row ? row.id : null;
}

const preview = async (req, res) => {
    try {
        const { branch_id, date } = req.body;
        if (!branch_id) return res.status(400).json({ message: 'Sucursal es requerida' });
        if (!validDate(date)) return res.status(400).json({ message: 'Fecha inválida' });

        const data = await buildCloseoutsPreview(req.company_id, Number(branch_id), date);
        if (!data.closeouts_found) {
            return res.json({
                closeouts_found: false,
                message: `No se encontraron cierres de turno para la sucursal y fecha seleccionada`,
                lines: [],
                fuels_for_cost: [],
                branch_label: data.branch_label
            });
        }

        const dedupKey = `PARTIDA_CIERRE_${branch_id}_${date}`;
        let existing = null;
        const [[marker]] = await pool.query(
            'SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = ?',
            [req.company_id, dedupKey]
        );
        if (marker && marker.setting_value) {
            const [[entry]] = await pool.query(
                "SELECT id, number, description, date, status, entry_type_id FROM accounting_entries WHERE id = ? AND company_id = ? AND status <> 'voided'",
                [marker.setting_value, req.company_id]
            );
            if (entry) existing = entry;
        }

        if (!existing) {
            const [[entry]] = await pool.query(
                "SELECT id, number, description, date, status, entry_type_id FROM accounting_entries WHERE company_id = ? AND branch_id = ? AND date = ? AND status <> 'voided' AND (description LIKE '%CIERRE DE TURNO%' OR description LIKE '%CIERRE%') ORDER BY id DESC LIMIT 1",
                [req.company_id, Number(branch_id), date]
            );
            if (entry) {
                existing = entry;
                // Auto-sync setting marker so it stays cached
                await pool.query(
                    `INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                    [req.company_id, dedupKey, String(entry.id)]
                ).catch(() => {});
            }
        }

        const [entryTypes] = await pool.query('SELECT id, code, name FROM entry_types ORDER BY id ASC');
        let defaultEntryType = null;
        if (existing && existing.entry_type_id) {
            defaultEntryType = entryTypes.find(t => t.id === existing.entry_type_id);
        }
        if (!defaultEntryType) {
            defaultEntryType = entryTypes.find(t => t.code === 'DIARIO') || entryTypes[0];
        }

        res.json({
            ...data,
            entry_types: entryTypes,
            default_entry_type_id: defaultEntryType ? defaultEntryType.id : 1,
            default_entry_type_code: defaultEntryType ? defaultEntryType.code : 'DIARIO',
            default_entry_type_name: defaultEntryType ? defaultEntryType.name : 'Partida Diaria',
            already_generated: !!existing,
            existing_entry: existing ? {
                id: existing.id,
                number: existing.number,
                description: existing.description,
                date: existing.date,
                entry_type_id: existing.entry_type_id
            } : null
        });
    } catch (e) {
        console.error('Error in closeouts preview:', e);
        res.status(500).json({ message: e.message });
    }
};

const saveCosts = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { branch_id, date, fuels } = req.body;
        if (!branch_id || !validDate(date)) return res.status(400).json({ message: 'Parámetros inválidos' });
        if (!Array.isArray(fuels) || fuels.length === 0) return res.status(400).json({ message: 'Lista de costos requerida' });

        await conn.beginTransaction();
        for (const item of fuels) {
            const pids = Array.isArray(item.product_ids) && item.product_ids.length > 0
                ? item.product_ids
                : (item.product_id ? [item.product_id] : []);
            const costo = parseFloat(item.costo_unitario) || 0;

            for (const pid of pids) {
                const numericPid = Number(pid);
                if (!numericPid) continue;

                await conn.query(
                    `INSERT INTO gas_station_closeout_costs (company_id, branch_id, date, product_id, costo_unitario)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE costo_unitario = VALUES(costo_unitario)`,
                    [req.company_id, Number(branch_id), date, numericPid, costo]
                );

                // Also update product catalog cost as last known cost
                if (costo > 0) {
                    await conn.query(
                        'UPDATE products SET costo = ? WHERE id = ? AND company_id = ?',
                        [costo, numericPid, req.company_id]
                    );
                }
            }
        }

        await conn.commit();
        res.json({ message: 'Costos de combustible guardados correctamente' });
    } catch (e) {
        await conn.rollback();
        console.error('Error saving closeout costs:', e);
        res.status(500).json({ message: e.message });
    } finally {
        conn.release();
    }
};

const generate = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { branch_id, date, lines, description, entry_type_id, entry_type_code } = req.body;
        if (!branch_id) return res.status(400).json({ message: 'Sucursal requerida' });
        if (!validDate(date)) return res.status(400).json({ message: 'Fecha inválida' });
        if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ message: 'Debe tener al menos una línea' });

        // Validate that all lines have an account assigned
        const unassignedIndex = lines.findIndex(l => !l.account_id);
        if (unassignedIndex !== -1) {
            return res.status(400).json({
                message: `La línea #${unassignedIndex + 1} (${lines[unassignedIndex].description || 'Sin concepto'}) no tiene cuenta contable asignada.`
            });
        }

        const dedupKey = `PARTIDA_CIERRE_${branch_id}_${date}`;

        let entryTypeId = null;
        let resolvedTypeCode = 'DIARIO';
        if (entry_type_id) {
            const [[et]] = await conn.query('SELECT id, code FROM entry_types WHERE id = ?', [Number(entry_type_id)]);
            if (et) {
                entryTypeId = et.id;
                resolvedTypeCode = et.code;
            }
        } else if (entry_type_code) {
            const [[et]] = await conn.query('SELECT id, code FROM entry_types WHERE code = ?', [entry_type_code]);
            if (et) {
                entryTypeId = et.id;
                resolvedTypeCode = et.code;
            }
        }
        if (!entryTypeId) {
            const [[et]] = await conn.query('SELECT id, code FROM entry_types WHERE code = ?', ['DIARIO']);
            entryTypeId = et ? et.id : 1;
            resolvedTypeCode = et ? et.code : 'DIARIO';
        }

        await conn.beginTransaction();
        try {
            await conn.query('SELECT id FROM companies WHERE id = ? FOR UPDATE', [req.company_id]);

            const { totalDebit, totalCredit } = await validateEntryLines(conn, req.company_id, lines);

            // Dedup marker
            await conn.query(
                `INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, '')
                 ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key)`,
                [req.company_id, dedupKey]
            );
            const [[marker]] = await conn.query(
                'SELECT setting_value FROM accounting_settings WHERE company_id = ? AND setting_key = ? FOR UPDATE',
                [req.company_id, dedupKey]
            );

            let existing = null;
            if (marker && marker.setting_value) {
                const [[entry]] = await conn.query(
                    "SELECT id, number, status FROM accounting_entries WHERE id = ? AND company_id = ? AND status <> 'voided' FOR UPDATE",
                    [marker.setting_value, req.company_id]
                );
                if (entry) existing = entry;
            }

            if (!existing) {
                const [[entry]] = await conn.query(
                    "SELECT id, number, status FROM accounting_entries WHERE company_id = ? AND branch_id = ? AND date = ? AND status <> 'voided' AND (description LIKE '%CIERRE DE TURNO%' OR description LIKE '%CIERRE%') ORDER BY id DESC LIMIT 1 FOR UPDATE",
                    [req.company_id, Number(branch_id), date]
                );
                if (entry) existing = entry;
            }

            if (existing) {
                await conn.query(
                    `INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                    [req.company_id, dedupKey, String(existing.id)]
                ).catch(() => {});

                const conflict = new Error(`Ya existe una partida de cierre de turno generada para esta sucursal y fecha (partida #${existing.number || existing.id}). Anúlala primero en Partidas Contables si deseas regenerarla.`);
                conflict.statusCode = 409;
                throw conflict;
            }

            const entryNumber = await reserveEntryNumber(conn, req.company_id, entryTypeId, date);

            const [[branch]] = await conn.query('SELECT nombre FROM branches WHERE id = ?', [branch_id]);
            const branchName = branch ? branch.nombre.toUpperCase() : '';
            const defaultDesc = `${branchName ? branchName + ' ' : ''}PARTIDA DE CIERRE DE TURNO DEL DIA ${date}`.trim();

            const [r] = await conn.query('INSERT INTO accounting_entries SET ?', [{
                company_id: req.company_id,
                branch_id: Number(branch_id),
                entry_type_id: entryTypeId,
                number: entryNumber,
                date,
                description: description || defaultDesc,
                total_debit: totalDebit,
                total_credit: totalCredit,
                status: 'posted',
                created_by: req.user?.id
            }]);

            for (const line of lines) {
                await conn.query('INSERT INTO accounting_entry_lines SET ?', [{
                    entry_id: r.insertId,
                    account_id: Number(line.account_id),
                    description: line.description || '',
                    debit: round2(line.debit || 0),
                    credit: round2(line.credit || 0)
                }]);
            }

            await conn.query(
                'INSERT INTO accounting_settings (company_id, setting_key, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [req.company_id, dedupKey, String(r.insertId), String(r.insertId)]
            );

            await conn.commit();

            notificationService.notify('accounting_entry_created', req.company_id, Number(branch_id), {
                partida_id: r.insertId,
                tipo_partida: resolvedTypeCode,
                descripcion: description || defaultDesc,
                total_debe: totalDebit,
                total_haber: totalCredit,
                fecha: date
            }).catch(() => {});

            res.status(201).json({ id: r.insertId, number: entryNumber, entry_type_id: entryTypeId, entry_type_code: resolvedTypeCode, message: 'Partida generada exitosamente' });
        } catch (e) {
            await conn.rollback();
            throw e;
        }
    } catch (e) {
        console.error('Error generating closeout entry:', e);
        res.status(e.statusCode || 400).json({ message: e.message });
    } finally {
        conn.release();
    }
};

const costsReport = async (req, res) => {
    try {
        const branchId = Number(req.query.branch_id || req.body?.branch_id);
        const date = req.query.date || req.body?.date;
        const format = String(req.query.format || 'pdf').toLowerCase();

        if (!branchId) return res.status(400).json({ message: 'Sucursal es requerida' });
        if (!validDate(date)) return res.status(400).json({ message: 'Fecha inválida' });

        const costsReportService = require('../services/accounting/accountingCloseoutCostsReport.service');
        const excelService = require('../services/excel.service');

        if (format === 'excel') {
            const buffer = await costsReportService.generateCloseoutCostsExcelBuffer(req.company_id, branchId, date);
            const filename = `Comprobante_Costos_${branchId}_${date}.xlsx`;
            return excelService.sendExcelResponse(res, buffer, filename);
        }

        const buffer = await costsReportService.generateCloseoutCostsPdfBuffer(req.company_id, branchId, date);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Comprobante_Costos_${branchId}_${date}.pdf"`);
        return res.send(buffer);
    } catch (e) {
        console.error('Error in closeouts costsReport:', e);
        res.status(500).json({ message: e.message });
    }
};

module.exports = { preview, saveCosts, generate, costsReport };
