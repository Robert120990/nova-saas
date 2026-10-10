const pool = require('../config/db');
const { generateEggSalesExcel, generateEggSalesPdf } = require('./eggSalesReportExport.service');
const { calculateLbs, classifyProduct, isEggProduct, formatQtyAndPrice, buildEggSalesReportQuery } = require('./eggSalesReportHelpers');

/**
 * Obtiene y agrega los datos de ventas por producto y cliente con precios promedio.
 * Contempla deduplicación de notas de remisión (DTE 04) y facturación consolidada (CCF / 03 / 01).
 * Excluye ventas y DTEs invalidados, rechazados o anulados.
 */
async function getEggSalesReportData(companyId, filters = {}) {
    const { productType } = filters;
    const { query, params } = buildEggSalesReportQuery(companyId, filters);
    const [rows] = await pool.query(query, params);

    const byProductMap = {};
    const byCustomerMap = {};
    let totalOvoproductsLbs = 0;
    let totalOvoproductsAmount = 0;
    let totalShellAmount = 0;
    let totalShellBoxes = 0;
    let totalShellCartons = 0;
    let totalShellUnits = 0;
    let totalAmount = 0;
    let totalLines = 0;

    for (const item of rows) {
        if (!isEggProduct(item.codigo, item.descripcion)) continue;

        const prodCategory = classifyProduct(item.codigo, item.descripcion);
        if (productType && prodCategory !== productType && !String(item.descripcion || '').toLowerCase().includes(productType.toLowerCase())) {
            continue;
        }

        const isShell = prodCategory === 'HUEVO EN CASCARA';
        const isCreditNote = String(item.tipo_documento) === '05';
        const sign = isCreditNote ? -1 : 1;

        const rawLbs = isShell ? 0 : calculateLbs(item);
        const lbs = rawLbs * sign;
        const rawAmount = parseFloat(item.venta_gravada || 0) + parseFloat(item.venta_exenta || 0);
        const qty = parseFloat(item.cantidad || 0);
        const unitPrice = parseFloat(item.precio_unitario || 0);
        const baseAmount = rawAmount > 0 ? rawAmount : (qty > 0 && unitPrice > 0 ? (qty * unitPrice) : 0);
        const amount = baseAmount * sign;
        const signedQty = qty * sign;

        const codeUpper = String(item.codigo || '').toUpperCase();
        const descUpper = String(item.descripcion || '').toUpperCase();
        const isBox = isShell && (codeUpper === 'H1' || descUpper.includes('CAJA'));
        const isCarton = isShell && !isBox && (codeUpper === 'HC' || codeUpper === 'CARTONH' || descUpper.includes('CARTON') || descUpper.includes('CARTÓN'));

        const custId = item.customer_id ? String(item.customer_id) : `manual_${item.cliente_nombre || 'sin_nombre'}`;
        const custName = item.customer_name || item.cliente_nombre || 'Cliente General';

        totalAmount += amount;
        totalLines++;

        if (isShell) {
            totalShellAmount += amount;
            if (isBox) totalShellBoxes += signedQty;
            else if (isCarton) totalShellCartons += signedQty;
            else totalShellUnits += signedQty;
        } else {
            totalOvoproductsLbs += lbs;
            totalOvoproductsAmount += amount;
        }

        // Agrupación Por Producto
        if (!byProductMap[prodCategory]) {
            byProductMap[prodCategory] = {
                product_name: prodCategory,
                is_shell: isShell,
                total_lbs: 0,
                total_amount: 0,
                boxes: 0,
                cartons: 0,
                units: 0,
                transactions_count: 0,
                credit_notes_count: 0,
                customersMap: {}
            };
        }
        const pGroup = byProductMap[prodCategory];
        pGroup.total_lbs += lbs;
        pGroup.total_amount += amount;
        pGroup.transactions_count += (isCreditNote ? 0 : 1);
        if (isCreditNote) pGroup.credit_notes_count = (pGroup.credit_notes_count || 0) + 1;
        if (isShell) {
            if (isBox) pGroup.boxes += signedQty;
            else if (isCarton) pGroup.cartons += signedQty;
            else pGroup.units += signedQty;
        }

        if (!pGroup.customersMap[custId]) {
            pGroup.customersMap[custId] = {
                customer_id: item.customer_id,
                customer_name: custName,
                is_shell: isShell,
                lbs: 0,
                amount: 0,
                boxes: 0,
                cartons: 0,
                units: 0,
                transactions_count: 0,
                credit_notes_count: 0
            };
        }
        pGroup.customersMap[custId].lbs += lbs;
        pGroup.customersMap[custId].amount += amount;
        pGroup.customersMap[custId].transactions_count += (isCreditNote ? 0 : 1);
        if (isCreditNote) pGroup.customersMap[custId].credit_notes_count = (pGroup.customersMap[custId].credit_notes_count || 0) + 1;
        if (isShell) {
            if (isBox) pGroup.customersMap[custId].boxes += signedQty;
            else if (isCarton) pGroup.customersMap[custId].cartons += signedQty;
            else pGroup.customersMap[custId].units += signedQty;
        }

        // Agrupación Por Cliente
        if (!byCustomerMap[custId]) {
            byCustomerMap[custId] = {
                customer_id: item.customer_id,
                customer_name: custName,
                customer_nit: item.customer_nit || 'N/A',
                customer_nrc: item.customer_nrc || 'N/A',
                total_lbs: 0,
                total_amount: 0,
                shell_amount: 0,
                shell_boxes: 0,
                shell_cartons: 0,
                shell_units: 0,
                sales_count: 0,
                credit_notes_count: 0,
                productsMap: {},
                invoices: []
            };
        }
        const cGroup = byCustomerMap[custId];
        cGroup.total_lbs += lbs;
        cGroup.total_amount += amount;
        cGroup.sales_count += (isCreditNote ? 0 : 1);
        if (isCreditNote) cGroup.credit_notes_count = (cGroup.credit_notes_count || 0) + 1;
        if (isShell) {
            cGroup.shell_amount += amount;
            if (isBox) cGroup.shell_boxes += signedQty;
            else if (isCarton) cGroup.shell_cartons += signedQty;
            else cGroup.shell_units += signedQty;
        }

        if (!cGroup.productsMap[prodCategory]) {
            cGroup.productsMap[prodCategory] = {
                product_name: prodCategory,
                is_shell: isShell,
                lbs: 0,
                amount: 0,
                boxes: 0,
                cartons: 0,
                units: 0,
                transactions_count: 0,
                credit_notes_count: 0
            };
        }
        cGroup.productsMap[prodCategory].lbs += lbs;
        cGroup.productsMap[prodCategory].amount += amount;
        cGroup.productsMap[prodCategory].transactions_count += (isCreditNote ? 0 : 1);
        if (isCreditNote) cGroup.productsMap[prodCategory].credit_notes_count = (cGroup.productsMap[prodCategory].credit_notes_count || 0) + 1;
        if (isShell) {
            if (isBox) cGroup.productsMap[prodCategory].boxes += signedQty;
            else if (isCarton) cGroup.productsMap[prodCategory].cartons += signedQty;
            else cGroup.productsMap[prodCategory].units += signedQty;
        }

        cGroup.invoices.push({
            item_id: item.item_id,
            sale_id: item.sale_id,
            fecha_emision: item.fecha_emision,
            tipo_documento: item.tipo_documento,
            numero_control: item.numero_control,
            codigo_generacion: item.codigo_generacion,
            codigo: item.codigo,
            descripcion: item.descripcion,
            product_name: prodCategory,
            is_shell: isShell,
            is_remision: item.tipo_documento === '04',
            is_credit_note: isCreditNote,
            linked_remisiones: item.linked_remisiones || null,
            cantidad: signedQty,
            precio_unitario: unitPrice,
            lbs: Math.round(lbs * 100) / 100,
            amount: Math.round(amount * 100) / 100,
            unit_label: isShell ? (isBox ? 'Caja' : (isCarton ? 'Cartón' : 'Unid')) : 'Lb',
            avg_price: isShell
                ? (qty > 0 ? Math.round((baseAmount / qty) * 100) / 100 : 0)
                : (rawLbs > 0 ? Math.round((baseAmount / rawLbs) * 100) / 100 : 0)
        });
    }

    // Calcular promedios ponderados y porcentajes
    const byProduct = Object.values(byProductMap).map(p => {
        const isShell = p.is_shell;
        const { displayQty, avgPrice, avgPriceDisplay } = formatQtyAndPrice(isShell, p.boxes, p.units, p.total_lbs, p.total_amount, p.cartons);

        const customers = Object.values(p.customersMap).map(c => {
            const cFmt = formatQtyAndPrice(isShell, c.boxes, c.units, c.lbs, c.amount, c.cartons);
            return {
                ...c,
                display_quantity: cFmt.displayQty,
                avg_price_display: cFmt.avgPriceDisplay,
                lbs: Math.round(c.lbs * 100) / 100,
                amount: Math.round(c.amount * 100) / 100,
                avg_price: cFmt.avgPrice,
                pct_of_product_lbs: !isShell && p.total_lbs > 0 ? Math.round(((c.lbs / p.total_lbs) * 100) * 10) / 10 : 0
            };
        }).sort((a, b) => b.amount - a.amount);

        delete p.customersMap;
        return {
            ...p,
            display_quantity: displayQty,
            avg_price_display: avgPriceDisplay,
            total_lbs: Math.round(p.total_lbs * 100) / 100,
            total_amount: Math.round(p.total_amount * 100) / 100,
            avg_price: avgPrice,
            pct_of_total_lbs: !isShell && totalOvoproductsLbs > 0 ? Math.round(((p.total_lbs / totalOvoproductsLbs) * 100) * 10) / 10 : 0,
            pct_of_total_amount: totalAmount > 0 ? Math.round(((p.total_amount / totalAmount) * 100) * 10) / 10 : 0,
            customers
        };
    }).sort((a, b) => b.total_amount - a.total_amount);

    const byCustomer = Object.values(byCustomerMap).map(c => {
        const isOnlyShell = c.total_lbs === 0 && c.shell_amount > 0;
        const shellFmt = formatQtyAndPrice(true, c.shell_boxes, c.shell_units, 0, c.shell_amount, c.shell_cartons);
        const avgPrice = c.total_lbs > 0 ? ((c.total_amount - c.shell_amount) / c.total_lbs) : shellFmt.avgPrice;
        const displayQty = isOnlyShell ? shellFmt.displayQty : (c.shell_amount > 0
            ? `${Number(c.total_lbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb + ${shellFmt.displayQty}`
            : `${Number(c.total_lbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`);

        const avgPriceDisplay = c.total_lbs > 0 ? `$${(((c.total_amount - c.shell_amount) / c.total_lbs)).toFixed(2)} /Lb` : shellFmt.avgPriceDisplay;

        const products = Object.values(c.productsMap).map(prod => {
            const isProdShell = prod.is_shell;
            const pFmt = formatQtyAndPrice(isProdShell, prod.boxes, prod.units, prod.lbs, prod.amount, prod.cartons);
            return {
                ...prod,
                display_quantity: pFmt.displayQty,
                avg_price_display: pFmt.avgPriceDisplay,
                lbs: Math.round(prod.lbs * 100) / 100,
                amount: Math.round(prod.amount * 100) / 100,
                avg_price: pFmt.avgPrice,
                pct_of_customer_lbs: !isProdShell && c.total_lbs > 0 ? Math.round(((prod.lbs / c.total_lbs) * 100) * 10) / 10 : 0
            };
        }).sort((a, b) => b.amount - a.amount);

        delete c.productsMap;
        return {
            ...c,
            is_only_shell: isOnlyShell,
            display_quantity: displayQty,
            avg_price_display: avgPriceDisplay,
            total_lbs: Math.round(c.total_lbs * 100) / 100,
            total_amount: Math.round(c.total_amount * 100) / 100,
            avg_price: Math.round(avgPrice * 100) / 100,
            pct_of_total_lbs: totalOvoproductsLbs > 0 ? Math.round(((c.total_lbs / totalOvoproductsLbs) * 100) * 10) / 10 : 0,
            pct_of_total_amount: totalAmount > 0 ? Math.round(((c.total_amount / totalAmount) * 100) * 10) / 10 : 0,
            products
        };
    }).sort((a, b) => b.total_amount - a.total_amount);

    const globalAvgPriceOvoproducts = totalOvoproductsLbs > 0 ? (totalOvoproductsAmount / totalOvoproductsLbs) : 0;
    const globalShellFmt = formatQtyAndPrice(true, totalShellBoxes, totalShellUnits, 0, totalShellAmount, totalShellCartons);

    return {
        byProduct,
        byCustomer,
        summary: {
            totalLbs: Math.round(totalOvoproductsLbs * 100) / 100,
            totalOvoproductsAmount: Math.round(totalOvoproductsAmount * 100) / 100,
            totalAmount: Math.round(totalAmount * 100) / 100,
            avgPricePerLb: Math.round(globalAvgPriceOvoproducts * 100) / 100,
            shellEggs: {
                totalAmount: Math.round(totalShellAmount * 100) / 100,
                totalBoxes: totalShellBoxes,
                totalCartons: totalShellCartons,
                totalUnits: totalShellUnits,
                displayQuantity: globalShellFmt.displayQty
            },
            totalProducts: byProduct.length,
            totalCustomers: byCustomer.length,
            totalTransactions: totalLines
        }
    };
}

module.exports = {
    getEggSalesReportData,
    generateEggSalesExcel,
    generateEggSalesPdf
};
