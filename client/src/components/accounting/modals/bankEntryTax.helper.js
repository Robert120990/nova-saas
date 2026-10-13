export const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

export const ENTRY_TYPE_LABELS = {
    GASTO: 'Partida de Gasto',
    INGRESO: 'Partida de Ingreso',
    CXP: 'Partida de Pagos',
    DIARIO: 'Partida Diaria',
    VENTAS: 'Partida de Ventas',
    COMPRAS: 'Partida de Compras',
    CXC: 'Partida de Cobranzas'
};

export const getEntryTypeLabel = (code) => ENTRY_TYPE_LABELS[code] || code || 'DIARIO';

export function calculateClientTaxBreakdown(totalPaid, shouldDetailIva, mode) {
    const total = round2(totalPaid);
    if (!shouldDetailIva || total <= 0) {
        return { subtotal: total, iva: 0, retPer: 0 };
    }
    let subtotal = 0, iva = 0, retPer = 0;
    if (mode === 'retencion') {
        subtotal = round2(total / 1.12);
        retPer = round2(subtotal * 0.01);
        iva = round2(subtotal * 0.13);
        const diff = round2((subtotal + iva - retPer) - total);
        if (diff !== 0) subtotal = round2(subtotal - diff);
    } else if (mode === 'percepcion') {
        subtotal = round2(total / 1.14);
        retPer = round2(subtotal * 0.01);
        iva = round2(subtotal * 0.13);
        const diff = round2((subtotal + iva + retPer) - total);
        if (diff !== 0) subtotal = round2(subtotal - diff);
    } else {
        subtotal = round2(total / 1.13);
        iva = round2(total - subtotal);
    }
    return { subtotal, iva, retPer };
}

export function buildRecalculatedLines({
    previewData,
    currentLines,
    detallarIva,
    taxDetailMode,
    description,
    accountsMap
}) {
    if (!previewData || previewData.is_remesa) return currentLines;
    const monto = round2(previewData.monto || 0);
    if (monto <= 0) return currentLines;

    const { subtotal, iva, retPer } = calculateClientTaxBreakdown(monto, detallarIva, taxDetailMode);

    const ivaAcc = previewData.tax_accounts?.iva;
    const retAcc = previewData.tax_accounts?.retencion;
    const perAcc = previewData.tax_accounts?.percepcion;
    const bankAcc = previewData.tax_accounts?.bank;
    const counterpartAcc = previewData.tax_accounts?.counterpart;

    const currentCounterpart = currentLines[0];
    const currentBank = currentLines[currentLines.length - 1];
    const defaultDesc = (description || previewData.description || '').toUpperCase();
    const nextLines = [];

    // 1. Counterpart (Expense / Vendor)
    const cpId = currentCounterpart?.account_id || (counterpartAcc?.id ? String(counterpartAcc.id) : '');
    nextLines.push({
        id: 1,
        account_id: cpId,
        account_name: currentCounterpart?.account_name || counterpartAcc?.name || accountsMap.get(cpId)?.name || '',
        description: currentCounterpart?.description || defaultDesc,
        debit: subtotal,
        credit: 0
    });

    // 2. IVA Crédito Fiscal
    if (detallarIva && iva > 0) {
        const ivaId = ivaAcc?.id ? String(ivaAcc.id) : '';
        nextLines.push({
            id: 2,
            account_id: ivaId,
            account_name: ivaAcc?.name || accountsMap.get(ivaId)?.name || 'Crédito Fiscal por Compras Locales',
            description: defaultDesc,
            debit: iva,
            credit: 0
        });
    }

    // 3. Retención or Percepción
    if (detallarIva && taxDetailMode === 'retencion' && retPer > 0) {
        const retId = retAcc?.id ? String(retAcc.id) : '';
        nextLines.push({
            id: 3,
            account_id: retId,
            account_name: retAcc?.name || accountsMap.get(retId)?.name || 'Retenciones IVA a terceros',
            description: defaultDesc,
            debit: 0,
            credit: retPer
        });
    } else if (detallarIva && taxDetailMode === 'percepcion' && retPer > 0) {
        const perId = perAcc?.id ? String(perAcc.id) : '';
        nextLines.push({
            id: 3,
            account_id: perId,
            account_name: perAcc?.name || accountsMap.get(perId)?.name || 'Crédito Fiscal por Retenciones 1%',
            description: defaultDesc,
            debit: retPer,
            credit: 0
        });
    }

    // 4. Bank (Credit)
    const bId = currentBank?.account_id || (bankAcc?.id ? String(bankAcc.id) : '');
    nextLines.push({
        id: 4,
        account_id: bId,
        account_name: currentBank?.account_name || bankAcc?.name || accountsMap.get(bId)?.name || previewData.banco_label || 'Cuenta bancaria',
        description: currentBank?.description || defaultDesc,
        debit: 0,
        credit: monto
    });

    return nextLines;
}
