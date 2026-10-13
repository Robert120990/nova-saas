/**
 * Restaurant DTE Adapter
 * Decouples the Restaurant Comanda domain from the Sales & DTE domain.
 * Translates restaurant orders, modifiers, tips, and items into the official Sales/DTE contract.
 */
import { getTodayString } from '../../../utils/dateUtils';

/**
 * Calculates final totals for checkout including optional customized tip.
 */
export function calculateOrderFinalTotals(order, customTip = null) {
    if (!order) return { grossSubtotal: 0, discount: 0, netSubtotal: 0, tip: 0, total: 0 };

    const grossSubtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount_amount || 0);
    const netSubtotal = Math.max(0, Number((grossSubtotal - discount).toFixed(2)));
    const tip = customTip !== null ? Math.max(0, Number(customTip)) : Math.max(0, Number(order.tip_amount || 0));
    const total = Number((netSubtotal + tip).toFixed(2));

    return {
        grossSubtotal,
        discount,
        netSubtotal,
        tip,
        total
    };
}

/**
 * Validates prerequisites before sending a DTE to the API.
 */
export function validateDtePrerequisites(dteType, customer) {
    if (dteType === '03') {
        if (!customer || !customer.id) {
            return 'Para emitir Crédito Fiscal (03) debe seleccionar un cliente registrado.';
        }
        const hasNrc = Boolean(customer.nrc && String(customer.nrc).trim());
        const hasNit = Boolean((customer.nit || customer.numero_documento) && String(customer.nit || customer.numero_documento).trim());
        if (!hasNrc || !hasNit) {
            return `El cliente "${customer.nombre || ''}" debe tener NRC y NIT registrados para Crédito Fiscal.`;
        }
    }
    return null;
}

/**
 * Adapts a restaurant order entity into the standard Sales & DTE payload contract.
 * @param {Object} order - Restaurant comanda object
 * @param {Object} options - Finalization options (dteType, customer, paymentMethod, tipAmount, branchId, userId)
 * @returns {Object} { header, items, payments } ready for POST /api/sales
 */
export function adaptOrderToSalePayload(order, options = {}) {
    const {
        dteType = '01', // '01': Factura, '03': CCF, 'none': Sin DTE
        customer = null,
        paymentMethod = '01',
        paymentReference = '',
        paymentsList = null,
        tipAmount = Number(order.tip_amount || 0),
        branchId,
        userId
    } = options;

    const { netSubtotal, discount, total } = calculateOrderFinalTotals(order, tipAmount);

    // Filter active items (exclude cancelled)
    const rawItems = Array.isArray(order.items)
        ? order.items.filter(item => item.status !== 'cancelado')
        : [];

    const items = rawItems.map((item, index) => {
        let description = item.product_name || 'Alimento/Bebida';
        if (Array.isArray(item.selected_modifiers) && item.selected_modifiers.length > 0) {
            const modNames = item.selected_modifiers
                .map(m => m.name || m.nombre)
                .filter(Boolean)
                .join(', ');
            if (modNames) {
                description += ` (${modNames})`;
            }
        }
        if (item.notes) {
            description += ` [${item.notes}]`;
        }

        return {
            product_id: item.product_id,
            cantidad: Number(item.quantity) || 1,
            precio_unitario: Number(item.unit_price) || 0,
            monto_descuento: Number(item.discount_amount) || 0,
            descripcion: description.substring(0, 1000),
            codigo: item.sku || `REST-${item.product_id || index + 1}`,
            tipo_item: 1, // 1: Gravado
            exento: false
        };
    });

    const isFiscalDte = dteType === '01' || dteType === '03';

    const header = {
        dte_type: isFiscalDte ? dteType : '00',
        customer_id: customer?.id || null,
        branch_id: branchId || order.branch_id,
        user_id: userId || order.waiter_id,
        fecha: getTodayString(),
        tipo_pago: 'contado',
        condicion_operacion: 1,
        descuento_general: discount,
        total_descuento: discount,
        subtotal: netSubtotal,
        total: netSubtotal,
        tip_amount: tipAmount,
        totalNoGravado: isFiscalDte ? tipAmount : 0,
        observaciones: `Comanda #${order.id}${order.table_number ? ' - Mesa ' + order.table_number : (order.order_type === 'para_llevar' ? ' - Para Llevar' : '')}`,
        notes: `Comanda #${order.id}${order.table_number ? ' - Mesa ' + order.table_number : (order.order_type === 'para_llevar' ? ' - Para Llevar' : '')}`
    };

    // Robust multi-method or single-method payment mapping
    let payments = [];
    if (Array.isArray(paymentsList) && paymentsList.length > 0) {
        payments = paymentsList.map(p => ({
            codigo: String(p.codigo || p.metodo_pago || '01').padStart(2, '0'),
            metodo_pago: String(p.codigo || p.metodo_pago || '01').padStart(2, '0'),
            monto: Number(p.monto || 0),
            referencia: p.referencia ? String(p.referencia).trim() : null
        }));
    } else {
        payments = [
            {
                codigo: String(paymentMethod || '01').padStart(2, '0'),
                metodo_pago: String(paymentMethod || '01').padStart(2, '0'),
                monto: total,
                referencia: paymentReference ? String(paymentReference).trim() : null
            }
        ];
    }

    return {
        header,
        items,
        payments
    };
}
