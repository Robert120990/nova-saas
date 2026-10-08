/**
 * Helper para agregación y filtrado dinámico de clientes en sugerencias de producción IA
 */
const getCustomerKey = (item) => String(item.customer_id || item.customer_name || 'Desconocido');

function extractCustomerMap(orders = [], agreements = []) {
    const customerMap = new Map();

    orders.forEach(o => {
        const key = getCustomerKey(o);
        if (!customerMap.has(key)) {
            customerMap.set(key, {
                id: key,
                customer_id: o.customer_id || null,
                customer_name: o.customer_name || 'Cliente sin nombre',
                orders_count: 0,
                orders_volume_lbs: 0,
                agreements_count: 0,
                agreements_volume_lbs: 0,
                total_demand_lbs: 0
            });
        }
        const c = customerMap.get(key);
        const qty = parseFloat(o.quantity_lbs || 0);
        c.orders_count += 1;
        c.orders_volume_lbs += qty;
        c.total_demand_lbs += qty;
    });

    agreements.forEach(a => {
        const key = getCustomerKey(a);
        if (!customerMap.has(key)) {
            customerMap.set(key, {
                id: key,
                customer_id: a.customer_id || null,
                customer_name: a.customer_name || 'Cliente sin nombre',
                orders_count: 0,
                orders_volume_lbs: 0,
                agreements_count: 0,
                agreements_volume_lbs: 0,
                total_demand_lbs: 0
            });
        }
        const c = customerMap.get(key);
        const vol = parseFloat(a.monthly_volume_lbs || 0);
        c.agreements_count += 1;
        c.agreements_volume_lbs += vol;
        c.total_demand_lbs += vol;
    });

    return Array.from(customerMap.values()).sort((a, b) => b.total_demand_lbs - a.total_demand_lbs);
}

function resolveCustomerSelection(availableCustomers, customerIdsQuery) {
    let selectedKeys = null;
    if (customerIdsQuery !== undefined) {
        if (customerIdsQuery === 'none' || customerIdsQuery === '') {
            selectedKeys = new Set();
        } else if (Array.isArray(customerIdsQuery)) {
            selectedKeys = new Set(customerIdsQuery.map(String));
        } else if (typeof customerIdsQuery === 'string') {
            selectedKeys = new Set(customerIdsQuery.split(',').map(s => s.trim()).filter(Boolean));
        }
    }

    if (!selectedKeys) {
        selectedKeys = new Set(availableCustomers.map(c => c.id));
    }

    const customersWithStatus = availableCustomers.map(c => ({
        ...c,
        active: selectedKeys.has(c.id)
    }));

    return {
        selectedKeys,
        availableCustomers: customersWithStatus
    };
}

module.exports = {
    getCustomerKey,
    extractCustomerMap,
    resolveCustomerSelection
};
