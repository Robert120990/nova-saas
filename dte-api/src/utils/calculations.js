/**
 * Fiscal calculations for El Salvador DTE
 */

const round = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
const round6 = (num) => Math.round((num + Number.EPSILON) * 1000000) / 1000000;

function calculateItem(item) {
    const quantity = parseFloat(item.cantidad) || 0;
    const price = parseFloat(item.precioUnitario) || 0;
    const discount = parseFloat(item.montoDescu) || 0;

    const subtotal = round6(quantity * price);
    const totalItem = round6(subtotal - discount);

    // Default tax 13% if taxable
    let iva = 0;
    if (item.tipoItem === 1) { // Gravada
        iva = round6(totalItem * 0.13);
    }

    return {
        ...item,
        ventaNoSuj: item.tipoItem === 3 ? totalItem : 0,
        ventaExenta: item.tipoItem === 2 ? totalItem : 0,
        ventaGravada: item.tipoItem === 1 ? totalItem : 0,
        ivaItem: iva
    };
}

function calculateTotals(items, taxes = []) {
    let totalNoSuj = 0;
    let totalExenta = 0;
    let totalGravada = 0;
    let totalIva = 0;
    let totalDescu = 0;

    items.forEach(item => {
        totalNoSuj += item.ventaNoSuj || 0;
        totalExenta += item.ventaExenta || 0;
        totalGravada += item.ventaGravada || 0;
        totalIva += item.ivaItem || 0;
        totalDescu += item.montoDescu || 0;
    });

    const subTotal = round(totalNoSuj + totalExenta + totalGravada);
    
    // Additional taxes (Retentions, etc.)
    let totalOtrosImp = 0;
    taxes.forEach(t => {
        totalOtrosImp += parseFloat(t.valor) || 0;
    });

    const totalPagar = round(subTotal + totalIva + totalOtrosImp);

    return {
        totalNoSuj: round(totalNoSuj),
        totalExenta: round(totalExenta),
        totalGravada: round(totalGravada),
        subTotal: subTotal,
        montoPorIVA: round(totalIva),
        totalDescu: round(totalDescu),
        totalPagar: totalPagar
    };
}

module.exports = { calculateItem, calculateTotals, round, round6 };
