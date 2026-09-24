/**
 * Fiscal calculations for El Salvador DTE
 */

const round = (num) => {
    if (num === null || num === undefined) return 0;
    return Number(Math.round(num + 'e+2') + 'e-2');
};
const round4 = (num) => {
    if (num === null || num === undefined) return 0;
    return Number(Math.round(num + 'e+4') + 'e-4');
};
const round6 = (num) => {
    if (num === null || num === undefined) return 0;
    return Number(Math.round(num + 'e+6') + 'e-6');
};

/**
 * Calcula un ítem basado en el tipo de DTE y la política de precios inclusive del sistema.
 */
function calculateItem(item, tipoDte = '01', ivaRate = 13) {
    const quantity = parseFloat(item.cantidad) || 0;
    const priceInput = parseFloat(item.precioUnitario) || 0;
    const discountInput = parseFloat(item.montoDescu) || 0;

    const rate = ivaRate / 100;
    const divisor = 1 + rate;

    // Extraer FOVIAL (D1) y COTRANS (C8) por ítem desde los tributos del payload.
    // El precio de combustible los incluye, por lo que deben quitarse ANTES de extraer el IVA.
    const tributos = Array.isArray(item.tributos) ? item.tributos : [];
    const extractFuelTax = (taxCode) => tributos.reduce((sum, t) => {
        if (t && typeof t === 'object' && t.codigo === taxCode) return sum + (parseFloat(t.valor) || 0);
        return sum;
    }, 0);
    const fovial = round(extractFuelTax('D1'));
    const cotrans = round(extractFuelTax('C8'));
    const unitFuelTax = quantity > 0 ? (fovial + cotrans) / quantity : 0;

    let netPrice, netDiscount, ventaGravada, iva;

    if (tipoDte === '01') {
        // MODO FACTURA: Valores Inclusive
        netPrice = priceInput;
        netDiscount = discountInput;
        ventaGravada = round(Math.max(0, (netPrice * quantity) - netDiscount));
        iva = round6((ventaGravada * ivaRate) / (100 + ivaRate));
    } else if (tipoDte === '11') {
        // MODO EXPORTACIÓN: No lleva IVA, extraer el neto del precio inclusive
        netPrice = round6(priceInput / divisor);
        netDiscount = round6(discountInput / divisor);
        ventaGravada = round(Math.max(0, (netPrice * quantity) - netDiscount));
        iva = 0;
    } else {
        // MODO CRÉDITO FISCAL: Quitar impuestos específicos de combustible primero,
        // luego extraer el precio neto unitario ANTES del descuento para que cuadre:
        // (precioUni * cantidad) - montoDescu = ventaGravada (Requisito MH)
        const lineInclusive = Math.max(0, (priceInput * quantity) - discountInput);
        const baseConIVA = Math.max(0, lineInclusive - fovial - cotrans);
        const baseSinFuel = Math.max(0, priceInput - unitFuelTax);
        netPrice = round6(baseSinFuel / divisor);
        netDiscount = round6(discountInput / divisor);
        ventaGravada = round(Math.max(0, (netPrice * quantity) - netDiscount));
        const isGravado = !item.exento && item.tipoItem !== 2 && item.tipoItem !== 3;
        // Calcular IVA complementario sobre la base con IVA para garantizar cuadre exacto al centavo
        iva = isGravado ? round(baseConIVA - ventaGravada) : 0;
    }

    return {
        ...item,
        precioUnitarioOriginal: priceInput,
        precioUnitario: netPrice,
        montoDescu: netDiscount,
        ventaNoSuj: item.tipoItem === 3 ? ventaGravada : 0,
        ventaExenta: item.tipoItem === 2 ? ventaGravada : 0,
        ventaGravada: item.tipoItem === 1 ? ventaGravada : 0,
        ivaItem: iva,
        totalItemInclusive: tipoDte === '01' ? ventaGravada : round(ventaGravada + iva + fovial + cotrans)
    };
}

function calculateTotals(items, taxes = [], tipoDte = '01', generalDiscount = 0, ivaRate = 13, explicitPercentage = null) {
    let totalNoSuj = 0;
    let totalExenta = 0;
    let totalGravada = 0;
    let totalIva = 0;
    let totalDescuItems = 0;
    let totalExpectedInclusive = 0;

    items.forEach(item => {
        totalNoSuj += item.ventaNoSuj || 0;
        totalExenta += item.ventaExenta || 0;
        totalGravada += item.ventaGravada || 0;
        totalIva += item.ivaItem || 0;
        totalDescuItems += item.montoDescu || 0;
        totalExpectedInclusive += item.totalItemInclusive || 0;
    });

    const rate = ivaRate / 100;
    const divisor = 1 + rate;

    // Descuento general aplicado estrictamente a la porción gravada
    const rawGenDiscount = Math.max(0, parseFloat(generalDiscount) || 0);
    let descuGravada = 0;

    if (tipoDte === '03' || tipoDte === '05' || tipoDte === '06') {
        // En CCF, si el descuento general viene del POS en valor inclusive, se convierte a neto:
        descuGravada = round(rawGenDiscount / divisor);
    } else {
        // En Factura 01, el descuento general es inclusive:
        descuGravada = round(rawGenDiscount);
    }

    // Regla de validación: el descuento gravado no puede superar el valor gravado disponible
    descuGravada = Math.min(descuGravada, round(totalGravada));

    const descuNoSuj = 0;
    const descuExenta = 0;

    const rSubTotalVentas = round(totalNoSuj + totalExenta + totalGravada);
    const subTotal = round(rSubTotalVentas - descuGravada - descuExenta - descuNoSuj);
    const rTotalDescu = round(totalDescuItems + descuGravada + descuExenta + descuNoSuj);
    let porcentajeDescuento = 0;
    if (explicitPercentage !== null && explicitPercentage !== undefined && !isNaN(explicitPercentage) && Number(explicitPercentage) > 0) {
        porcentajeDescuento = round(Number(explicitPercentage));
    } else if (totalGravada > 0) {
        const calculatedPct = (descuGravada / totalGravada) * 100;
        if (Math.abs(calculatedPct - Math.round(calculatedPct)) <= 0.08) {
            porcentajeDescuento = Math.round(calculatedPct);
        } else {
            porcentajeDescuento = round(calculatedPct);
        }
    }

    let totalOtrosImp = 0;
    taxes.forEach(t => {
        totalOtrosImp += round(parseFloat(t.valor) || 0);
    });
    const rOtrosImp = round(totalOtrosImp);

    // FORMULA DEPENDS ON DTE TYPE
    let totalPagar;
    let finalIva = 0;
    
    if (tipoDte === '01') {
        // En Factura 01, subTotal ya incluye impuestos de las ventas gravadas remanentes
        totalPagar = round(subTotal + rOtrosImp);
        finalIva = round(((totalGravada - descuGravada) * ivaRate) / (100 + ivaRate));
    } else {
        // En CCF 03 y afines (05, 06):
        if (descuGravada > 0) {
            const descuIva = round(descuGravada * rate);
            finalIva = Math.max(0, round(totalIva - descuIva));
        } else {
            finalIva = round(totalIva);
        }

        // Blindaje contra descuadre de 1 centavo:
        // El total general inclusive esperado de la transacción es la suma de los valores inclusive de los ítems menos el descuento general:
        const expectedTotal = round(totalExpectedInclusive - rawGenDiscount);
        const currentSum = round(subTotal + finalIva + rOtrosImp);
        const diff = round(expectedTotal - currentSum);

        if (Math.abs(diff) === 0.01 && (finalIva + diff) >= 0) {
            finalIva = round(finalIva + diff);
        }

        totalPagar = round(subTotal + finalIva + rOtrosImp);
    }

    return {
        totalNoSuj: round(totalNoSuj),
        totalExenta: round(totalExenta),
        totalGravada: round(totalGravada),
        descuNoSuj: descuNoSuj,
        descuExenta: descuExenta,
        descuGravada: descuGravada,
        porcentajeDescuento: porcentajeDescuento,
        subTotalVentas: rSubTotalVentas,
        montoPorIVA: finalIva,
        totalDescu: rTotalDescu,
        subTotal: subTotal,
        totalPagar: totalPagar
    };
}

function getAmountInWords(amount) {
    if (amount === null || amount === undefined) return 'CERO 00/100 DOLARES';
    
    const parts = amount.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]);
    const decimalPart = parts[1];

    if (integerPart === 0) return `CERO ${decimalPart}/100 DOLARES`;

    const unidad = (n) => ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE'][n];
    const decena = (n) => ['','DIEZ','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'][n];
    const especial = (n) => ['DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE'][n-10];
    const centena = (n) => ['','CIEN','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETETECIENTOS','OCHOCIENTOS','NOVECIENTOS'][n];

    const convertThreeDigits = (n) => {
        let output = '';
        const c = Math.floor(n / 100);
        const d = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (c > 0) {
            if (c === 1 && d === 0 && u === 0) output += 'CIEN';
            else output += centena(c);
        }

        if (d > 0) {
            if (output !== '') output += ' ';
            if (d === 1 && u >= 0) {
                output += especial(d * 10 + u);
                return output;
            } else if (d === 2 && u === 0) output += 'VEINTE';
            else if (d === 2 && u > 0) output += 'VEINTI' + unidad(u);
            else {
                output += decena(d);
                if (u > 0) output += ' Y ' + unidad(u);
            }
        } else if (u > 0) {
            if (output !== '') output += ' ';
            output += unidad(u);
        }
        return output;
    };

    let result = '';
    const millions = Math.floor(integerPart / 1000000);
    const thousands = Math.floor((integerPart % 1000000) / 1000);
    const hundreds = integerPart % 1000;

    if (millions > 0) {
        if (millions === 1) result += 'UN MILLON';
        else result += convertThreeDigits(millions) + ' MILLONES';
    }

    if (thousands > 0) {
        if (result !== '') result += ' ';
        if (thousands === 1) result += 'MIL';
        else result += convertThreeDigits(thousands) + ' MIL';
    }

    if (hundreds > 0) {
        if (result !== '') result += ' ';
        result += convertThreeDigits(hundreds);
    }

    return `${result.trim()} ${decimalPart}/100 DOLARES`;
}

module.exports = { calculateItem, calculateTotals, round, round4, round6, getAmountInWords };
