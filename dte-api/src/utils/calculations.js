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
    const fovial = extractFuelTax('D1');
    const cotrans = extractFuelTax('C8');

    let netPrice, netDiscount, ventaGravada, iva;

    if (tipoDte === '01') {
        // MODO FACTURA: Valores Inclusive
        netPrice = priceInput;
        netDiscount = discountInput;
        ventaGravada = round((netPrice * quantity) - netDiscount);
        iva = round6((ventaGravada * ivaRate) / (100 + ivaRate));
    } else if (tipoDte === '11') {
        // MODO EXPORTACIÓN: No lleva IVA, extraer el neto del precio inclusive
        netPrice = round6(priceInput / divisor);
        netDiscount = round6(discountInput / divisor);
        ventaGravada = round((netPrice * quantity) - netDiscount);
        iva = 0;
    } else {
        // MODO CRÉDITO FISCAL: Primero quitar FOVIAL/COTRANS del precio y luego extraer el IVA
        const baseConIVA = Math.max(0, (priceInput * quantity) - discountInput - fovial - cotrans);
        netPrice = round6(quantity > 0 ? baseConIVA / (quantity * divisor) : 0);
        netDiscount = round6(discountInput / divisor);
        ventaGravada = round(netPrice * quantity);
        iva = round(ventaGravada * rate); 
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
        totalItemInclusive: tipoDte === '01' ? ventaGravada : round(ventaGravada + iva)
    };
}

function calculateTotals(items, taxes = [], tipoDte = '01') {
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

    const rSubTotalVentas = round(totalNoSuj + totalExenta + totalGravada);
    const rTotalIva = round(totalIva);
    const rTotalDescu = round(totalDescu);
    
    let totalOtrosImp = 0;
    taxes.forEach(t => {
        totalOtrosImp += parseFloat(t.valor) || 0;
    });
    const rOtrosImp = round(totalOtrosImp);

    // FORMULA DEPENDS ON DTE TYPE
    let subTotal, totalPagar;
    
    if (tipoDte === '01') {
        // En Factura 01, subTotal es igual a subTotalVentas porque ya incluye impuestos
        subTotal = round(rSubTotalVentas);
        totalPagar = round(subTotal + rOtrosImp);
    } else {
        // En CCF 03, subTotal es estrictamente la base imponible sin impuestos
        subTotal = round(rSubTotalVentas);
        // totalPagar suma la base + IVA + otros impuestos
        totalPagar = round(subTotal + rTotalIva + rOtrosImp);
    }

    return {
        totalNoSuj: round(totalNoSuj),
        totalExenta: round(totalExenta),
        totalGravada: round(totalGravada),
        subTotalVentas: rSubTotalVentas,
        montoPorIVA: rTotalIva,
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
