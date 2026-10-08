const pool = require('../config/db');
const { generateEggSalesExcel, generateEggSalesPdf } = require('./eggSalesReportExport.service');
const { calculateLbs, classifyProduct, isEggProduct, formatQtyAndPrice } = require('./eggSalesReportHelpers');

/**
 * Obtiene y agrega los datos de ventas por producto y cliente con precios promedio.
 * Filtra estrictamente solo ventas reales (01 Facturas, 03 CCF, 11 FEX)
 * Excluye ventas y DTEs invalidados, rechazados, anulados, notas de remisión (04) y comprobantes de retención (07).
 */
async function getEggSalesReportData(companyId, filters = {}) {
    const { startDate, endDate, customerId, productType, from, to, month } = filters;
    let startFilter = startDate || from;
    let endFilter = endDate || to;

    if (month && !startFilter && !endFilter) {
        const [y, m] = month.split('-').map(Number);
        if (y && m) {
            startFilter = `${y}-${String(m).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            endFilter = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }
    }

    let query = `
        SELECT si.id as item_id, si.sale_id, si.codigo, si.descripcion, si.cantidad, si.precio_unitario,
               si.venta_gravada, si.venta_exenta,
               sh.fecha_emision,
               COALESCE(sh.tipo_documento, sh.dte_type) as tipo_documento,
               COALESCE(sh.numero_control, d.numero_control) as numero_control,
               COALESCE(sh.codigo_generacion, d.codigo_generacion) as codigo_generacion,
               sh.cliente_nombre, sh.customer_id,
               c.nombre as customer_name, c.nit as customer_nit, c.nrc as customer_nrc
        FROM sales_items si
        JOIN sales_headers sh ON si.sale_id = sh.id
        LEFT JOIN dtes d ON sh.id = d.venta_id
        LEFT JOIN customers c ON sh.customer_id = c.id
        WHERE sh.company_id = ?
          AND UPPER(COALESCE(sh.estado, '')) NOT IN ('ANULADO', 'ANULADA', 'INVALIDADO', 'RECHAZADO')
          AND (d.status IS NULL OR UPPER(d.status) NOT IN ('INVALIDADO', 'REJECTED', 'RECHAZADO', 'ANULADO', 'ERROR'))
          AND COALESCE(sh.tipo_documento, sh.dte_type) IN ('01', '03', '11')
          AND (si.venta_gravada > 0 OR si.venta_exenta > 0)
          AND NOT EXISTS (
              SELECT 1 FROM dte_invalidations di 
              WHERE di.codigo_generacion_dte = COALESCE(sh.codigo_generacion, d.codigo_generacion) 
                AND di.estado IN ('ACCEPTED', 'SENT')
          )
    `;
    const params = [companyId];

    if (startFilter) {
        query += ' AND sh.fecha_emision >= ?';
        params.push(startFilter);
    }
    if (endFilter) {
        query += ' AND sh.fecha_emision <= ?';
        params.push(endFilter);
    }
    if (customerId) {
        query += ' AND sh.customer_id = ?';
        params.push(customerId);
    }

    query += ' ORDER BY sh.fecha_emision ASC, sh.id ASC, si.id ASC';

    const [rows] = await pool.query(query, params);

    const byProductMap = {};
    const byCustomerMap = {};
    let totalOvoproductsLbs = 0;
    let totalOvoproductsAmount = 0;
    let totalShellAmount = 0;
    let totalShellBoxes = 0;
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
        const lbs = isShell ? 0 : calculateLbs(item);
        const amount = parseFloat(item.venta_gravada || 0) + parseFloat(item.venta_exenta || 0);
        const qty = parseFloat(item.cantidad || 0);
        const codeUpper = String(item.codigo || '').toUpperCase();
        const descUpper = String(item.descripcion || '').toUpperCase();
        const isBox = isShell && (codeUpper === 'H1' || descUpper.includes('CAJA'));

        const custId = item.customer_id ? String(item.customer_id) : `manual_${item.cliente_nombre || 'sin_nombre'}`;
        const custName = item.customer_name || item.cliente_nombre || 'Cliente General';

        totalAmount += amount;
        totalLines++;

        if (isShell) {
            totalShellAmount += amount;
            if (isBox) totalShellBoxes += qty;
            else totalShellUnits += qty;
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
                units: 0,
                transactions_count: 0,
                customersMap: {}
            };
        }
        const pGroup = byProductMap[prodCategory];
        pGroup.total_lbs += lbs;
        pGroup.total_amount += amount;
        pGroup.transactions_count++;
        if (isShell) {
            if (isBox) pGroup.boxes += qty;
            else pGroup.units += qty;
        }

        if (!pGroup.customersMap[custId]) {
            pGroup.customersMap[custId] = {
                customer_id: item.customer_id,
                customer_name: custName,
                is_shell: isShell,
                lbs: 0,
                amount: 0,
                boxes: 0,
                units: 0,
                transactions_count: 0
            };
        }
        pGroup.customersMap[custId].lbs += lbs;
        pGroup.customersMap[custId].amount += amount;
        pGroup.customersMap[custId].transactions_count++;
        if (isShell) {
            if (isBox) pGroup.customersMap[custId].boxes += qty;
            else pGroup.customersMap[custId].units += qty;
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
                shell_units: 0,
                sales_count: 0,
                productsMap: {},
                invoices: []
            };
        }
        const cGroup = byCustomerMap[custId];
        cGroup.total_lbs += lbs;
        cGroup.total_amount += amount;
        cGroup.sales_count++;
        if (isShell) {
            cGroup.shell_amount += amount;
            if (isBox) cGroup.shell_boxes += qty;
            else cGroup.shell_units += qty;
        }

        if (!cGroup.productsMap[prodCategory]) {
            cGroup.productsMap[prodCategory] = {
                product_name: prodCategory,
                is_shell: isShell,
                lbs: 0,
                amount: 0,
                boxes: 0,
                units: 0,
                transactions_count: 0
            };
        }
        cGroup.productsMap[prodCategory].lbs += lbs;
        cGroup.productsMap[prodCategory].amount += amount;
        cGroup.productsMap[prodCategory].transactions_count++;
        if (isShell) {
            if (isBox) cGroup.productsMap[prodCategory].boxes += qty;
            else cGroup.productsMap[prodCategory].units += qty;
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
            cantidad: qty,
            precio_unitario: parseFloat(item.precio_unitario || 0),
            lbs: Math.round(lbs * 100) / 100,
            amount: Math.round(amount * 100) / 100,
            unit_label: isShell ? (isBox ? 'Caja' : 'Unid') : 'Lb',
            avg_price: isShell
                ? (qty > 0 ? Math.round((amount / qty) * 100) / 100 : 0)
                : (lbs > 0 ? Math.round((amount / lbs) * 100) / 100 : 0)
        });
    }

    // Calcular promedios ponderados y porcentajes
    const byProduct = Object.values(byProductMap).map(p => {
        const isShell = p.is_shell;
        const { displayQty, avgPrice, avgPriceDisplay } = formatQtyAndPrice(isShell, p.boxes, p.units, p.total_lbs, p.total_amount);

        const customers = Object.values(p.customersMap).map(c => {
            const cFmt = formatQtyAndPrice(isShell, c.boxes, c.units, c.lbs, c.amount);
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
        const avgPrice = c.total_lbs > 0 ? ((c.total_amount - c.shell_amount) / c.total_lbs) : (c.shell_boxes > 0 ? c.shell_amount / c.shell_boxes : (c.shell_units > 0 ? c.shell_amount / c.shell_units : 0));

        const displayQty = isOnlyShell
            ? (c.shell_boxes > 0 && c.shell_units > 0 ? `${c.shell_units.toLocaleString()} Unid / ${c.shell_boxes.toLocaleString()} Cajas` : (c.shell_boxes > 0 ? `${c.shell_boxes.toLocaleString()} Cajas` : `${c.shell_units.toLocaleString()} Unid`))
            : (c.shell_amount > 0
                ? `${Number(c.total_lbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb + ${c.shell_boxes > 0 ? `${c.shell_boxes.toLocaleString()} C` : `${c.shell_units.toLocaleString()} U`}`
                : `${Number(c.total_lbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Lb`);

        const avgPriceDisplay = c.total_lbs > 0
            ? `$${(((c.total_amount - c.shell_amount) / c.total_lbs)).toFixed(2)} /Lb`
            : (c.shell_boxes > 0 ? `$${(c.shell_amount / c.shell_boxes).toFixed(2)} /Caja` : (c.shell_units > 0 ? `$${(c.shell_amount / c.shell_units).toFixed(2)} /Unid` : '—'));

        const products = Object.values(c.productsMap).map(prod => {
            const isProdShell = prod.is_shell;
            const pFmt = formatQtyAndPrice(isProdShell, prod.boxes, prod.units, prod.lbs, prod.amount);
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
                totalUnits: totalShellUnits,
                displayQuantity: totalShellBoxes > 0 && totalShellUnits > 0
                    ? `${totalShellUnits.toLocaleString()} Unid / ${totalShellBoxes.toLocaleString()} Cajas`
                    : (totalShellBoxes > 0 ? `${totalShellBoxes.toLocaleString()} Cajas` : `${totalShellUnits.toLocaleString()} Unid`)
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
