const pool = require('../server/src/config/db');

const IVA_RATE = 0.13;

function computeBilling(daysOn, dailyRate = 195, extraDischarge = 0) {
    const days = Math.max(0, parseFloat(daysOn) || 0);
    const rate = Math.max(0, parseFloat(dailyRate) || 195);
    const discharge = Math.max(0, parseFloat(extraDischarge) || 0);
    const storage_subtotal = +(days * rate).toFixed(2);
    const subtotal = +(storage_subtotal + discharge).toFixed(2);
    const iva_amount = +(subtotal * IVA_RATE).toFixed(2);
    const total_with_iva = +(subtotal + iva_amount).toFixed(2);
    return { days_on: days, daily_rate: rate, storage_subtotal, discharge, subtotal, iva_amount, total_with_iva };
}

async function migrate() {
    console.log('--- Migration v308: Creating egg_storage_container_daily_ledger and seeding Corte 1 + Archivo 1.2 (Vigente) ---');

    const [cutCols] = await pool.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'egg_storage_container_cutoffs'
          AND COLUMN_NAME IN ('opening_lbs_balance', 'total_lbs_in', 'total_lbs_out', 'closing_lbs_balance', 'storage_subtotal', 'loading_unloading_total')
    `);
    const existingCutCols = new Set(cutCols.map(c => c.COLUMN_NAME));

    if (!existingCutCols.has('opening_lbs_balance')) {
        await pool.query('ALTER TABLE egg_storage_container_cutoffs ADD COLUMN opening_lbs_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER period_end');
    }
    if (!existingCutCols.has('total_lbs_in')) {
        await pool.query('ALTER TABLE egg_storage_container_cutoffs ADD COLUMN total_lbs_in DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER opening_lbs_balance');
    }
    if (!existingCutCols.has('total_lbs_out')) {
        await pool.query('ALTER TABLE egg_storage_container_cutoffs ADD COLUMN total_lbs_out DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER total_lbs_in');
    }
    if (!existingCutCols.has('closing_lbs_balance')) {
        await pool.query('ALTER TABLE egg_storage_container_cutoffs ADD COLUMN closing_lbs_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00 AFTER total_lbs_out');
    }
    if (!existingCutCols.has('storage_subtotal')) {
        await pool.query('ALTER TABLE egg_storage_container_cutoffs ADD COLUMN storage_subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER daily_rate');
    }
    if (!existingCutCols.has('loading_unloading_total')) {
        await pool.query('ALTER TABLE egg_storage_container_cutoffs ADD COLUMN loading_unloading_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER storage_subtotal');
    }
    console.log('✅ Columnas de libras y cargas/descargas verificadas en egg_storage_container_cutoffs');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS egg_storage_container_daily_ledger (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            cutoff_id INT NULL,
            entry_date DATE NOT NULL,
            lbs_in DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            lbs_out DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            lbs_balance DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
            daily_rate DECIMAL(12, 2) NOT NULL DEFAULT 195.00,
            containers_count INT NOT NULL DEFAULT 0,
            days_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            loading_unloading_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            withdrawal_count INT NOT NULL DEFAULT 0,
            income_count INT NOT NULL DEFAULT 0,
            active_containers_list VARCHAR(255) NULL,
            notes VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_egg_daily_ledger_company_cutoff (company_id, cutoff_id, entry_date),
            KEY idx_egg_daily_ledger_date (company_id, entry_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabla egg_storage_container_daily_ledger creada/verificada');

    const [companies] = await pool.query('SELECT id FROM companies');

    const corte1Daily = [
        { date: '2026-10-14', lbs_in: 78350, lbs_out: 0, lbs_balance: 78350, rate: 195, count: 3, days_amt: 585, load_cost: 160, withdrawal: 0, income: 2, list: '1,2,3' },
        { date: '2026-10-15', lbs_in: 74381, lbs_out: 0, lbs_balance: 152731, rate: 195, count: 5, days_amt: 975, load_cost: 160, withdrawal: 0, income: 2, list: '1,2,3,4,5' },
        { date: '2026-10-16', lbs_in: 0, lbs_out: 0, lbs_balance: 152731, rate: 195, count: 5, days_amt: 975, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5' },
        { date: '2026-10-17', lbs_in: 40132, lbs_out: 0, lbs_balance: 192863, rate: 195, count: 7, days_amt: 1365, load_cost: 380, withdrawal: 0, income: 1, list: '1,2,3,4,5,6,7' },
        { date: '2026-10-18', lbs_in: 0, lbs_out: 0, lbs_balance: 192863, rate: 195, count: 7, days_amt: 1365, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5,6,7' }
    ];
    const corte1ContainerDays = { 1: 5, 2: 5, 3: 5, 4: 4, 5: 4, 6: 2, 7: 2, 8: 0, 9: 0, 10: 0 };

    const corte2VigenteDaily = [
        { date: '2026-10-19', lbs_in: 0, lbs_out: 0, lbs_balance: 192863, rate: 195, count: 7, days_amt: 1365, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5,6,7' },
        { date: '2026-10-20', lbs_in: 76493, lbs_out: 0, lbs_balance: 269356, rate: 195, count: 9, days_amt: 1755, load_cost: 160, withdrawal: 0, income: 2, list: '1,2,3,4,5,6,7,8,10' },
        { date: '2026-10-21', lbs_in: 0, lbs_out: 0, lbs_balance: 269356, rate: 195, count: 9, days_amt: 1755, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5,6,7,8,10' },
        { date: '2026-10-22', lbs_in: 0, lbs_out: 0, lbs_balance: 269356, rate: 195, count: 9, days_amt: 1755, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5,6,7,8,10' },
        { date: '2026-10-23', lbs_in: 0, lbs_out: 0, lbs_balance: 269356, rate: 195, count: 9, days_amt: 1755, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5,6,7,8,10' },
        { date: '2026-10-24', lbs_in: 0, lbs_out: 0, lbs_balance: 269356, rate: 195, count: 9, days_amt: 1755, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5,6,7,8,10' },
        { date: '2026-10-25', lbs_in: 0, lbs_out: 0, lbs_balance: 269356, rate: 195, count: 9, days_amt: 1755, load_cost: 0, withdrawal: 0, income: 0, list: '1,2,3,4,5,6,7,8,10' }
    ];
    const corte2VigenteDays = { 1: 7, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 7, 8: 6, 9: 0, 10: 6 };
    const corte2TurnedOnAt = {
        1: '2026-10-19 00:00:00', 2: '2026-10-19 00:00:00', 3: '2026-10-19 00:00:00',
        4: '2026-10-19 00:00:00', 5: '2026-10-19 00:00:00', 6: '2026-10-19 00:00:00',
        7: '2026-10-19 00:00:00', 8: '2026-10-20 00:00:00', 9: null, 10: '2026-10-20 00:00:00'
    };

    for (const comp of companies) {
        const companyId = comp.id;
        const [existingLedger] = await pool.query(
            'SELECT COUNT(*) AS cnt FROM egg_storage_container_daily_ledger WHERE company_id = ?',
            [companyId]
        );
        if ((existingLedger[0]?.cnt || 0) >= 12) continue;

        // Limpiar si quedó parcial
        if ((existingLedger[0]?.cnt || 0) > 0) {
            await pool.query('DELETE FROM egg_storage_container_daily_ledger WHERE company_id = ?', [companyId]);
        }

        const [contRows] = await pool.query(
            'SELECT * FROM egg_storage_containers WHERE company_id = ? ORDER BY container_number ASC',
            [companyId]
        );
        if (contRows.length === 0) continue;

        let cutoff1Id = null;
        const [existingCut] = await pool.query(
            'SELECT id FROM egg_storage_container_cutoffs WHERE company_id = ? AND cutoff_number = 1',
            [companyId]
        );

        if (existingCut.length === 0) {
            const c1Billing = computeBilling(27, 195, 700);
            const [insCut] = await pool.query(
                `INSERT INTO egg_storage_container_cutoffs
                 (company_id, cutoff_number, cutoff_code, customer_name, previous_cutoff_id, previous_cutoff_date,
                  period_start, period_end, opening_lbs_balance, total_lbs_in, total_lbs_out, closing_lbs_balance,
                  total_containers, billed_containers_count, active_containers_count, total_days_on, daily_rate,
                  storage_subtotal, loading_unloading_total, subtotal, iva_amount, total_with_iva,
                  keep_active_running, status, notes, user_name)
                 VALUES (?, 1, 'CORTE-0001', 'ALMACENAMIENTO EN CONTENEDOR', NULL, NULL,
                         '2026-10-14', '2026-10-18', 0, 192863, 0, 192863,
                         10, 7, 7, 27, 195.00,
                         5265.00, 700.00, ?, ?, ?,
                         1, 'aplicado', 'Corte 1 (14/10/2026 al 18/10/2026) • 192,863 lbs', 'Sistema')`,
                [companyId, c1Billing.subtotal, c1Billing.iva_amount, c1Billing.total_with_iva]
            );
            cutoff1Id = insCut.insertId;

            const itemPlaceholders = [];
            const itemValues = [];
            for (const c of contRows) {
                const d = corte1ContainerDays[c.container_number] || 0;
                const b = computeBilling(d, 195, 0);
                itemPlaceholders.push('(?, ?, ?, ?, ?, ?, ?, ?, 195.00, ?, ?, ?, ?)');
                itemValues.push(
                    cutoff1Id, companyId, c.id, c.container_number, c.code, c.name,
                    d > 0 ? 1 : 0, d, b.subtotal, b.iva_amount, b.total_with_iva,
                    d > 0 ? 'Activo en Corte 1' : 'Disponible'
                );
            }
            await pool.query(
                `INSERT INTO egg_storage_container_cutoff_items
                 (cutoff_id, company_id, container_id, container_number, container_code, container_name,
                  was_active_power, days_on, daily_rate, subtotal, iva_amount, total_with_iva, notes)
                 VALUES ${itemPlaceholders.join(', ')}`,
                itemValues
            );
        } else {
            cutoff1Id = existingCut[0].id;
        }

        // Batch insert de las 12 filas diarias (5 de Corte 1 + 7 de Archivo 1.2 Vigente)
        const ledgerPlaceholders = [];
        const ledgerValues = [];
        for (const row of corte1Daily) {
            ledgerPlaceholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            ledgerValues.push(
                companyId, cutoff1Id, row.date, row.lbs_in, row.lbs_out, row.lbs_balance,
                row.rate, row.count, row.days_amt, row.load_cost, row.withdrawal, row.income, row.list
            );
        }
        for (const row of corte2VigenteDaily) {
            ledgerPlaceholders.push('(?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            ledgerValues.push(
                companyId, row.date, row.lbs_in, row.lbs_out, row.lbs_balance,
                row.rate, row.count, row.days_amt, row.load_cost, row.withdrawal, row.income, row.list
            );
        }
        await pool.query(
            `INSERT INTO egg_storage_container_daily_ledger
             (company_id, cutoff_id, entry_date, lbs_in, lbs_out, lbs_balance, daily_rate,
              containers_count, days_amount, loading_unloading_cost, withdrawal_count, income_count, active_containers_list)
             VALUES ${ledgerPlaceholders.join(', ')}`,
            ledgerValues
        );

        await pool.query(
            `UPDATE egg_storage_containers
             SET is_active_power = CASE WHEN container_number = 9 THEN 0 ELSE 1 END,
                 days_on = CASE WHEN container_number = 9 THEN 0 WHEN container_number IN (8, 10) THEN 6 ELSE 7 END,
                 daily_rate = 195.00,
                 turned_on_at = CASE WHEN container_number = 9 THEN NULL WHEN container_number IN (8, 10) THEN '2026-10-20 00:00:00' ELSE '2026-10-19 00:00:00' END,
                 last_cutoff_date = '2026-10-18',
                 last_cutoff_id = ?,
                 notes = CASE WHEN container_number = 9 THEN 'Disponible para carga' ELSE 'En almacenamiento (Corte vigente desde 19/10/2026)' END
             WHERE company_id = ?`,
            [cutoff1Id, companyId]
        );

        console.log(`  → Sembrado Corte 1 (14-18 oct) y Archivo 1.2 Vigente (19-25 oct, 269,356 lbs) para empresa ID=${companyId}`);
    }
}

module.exports = migrate;
