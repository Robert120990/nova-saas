import { unwrapList } from '../../../utils/apiUtils.js';
import { calcularTarifaDetalle } from './planillaUtils.js';

const numeric = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const roundQuantity = value => Math.round(value * 100) / 100;

// Cargar una planilla nunca modifica sus importes guardados. Las cantidades
// inferidas sirven para el editor; el monto sólo cambia al editar esa cuenta.
export function normalizarDetallesGuardados(details, sueldo, accounts = []) {
    const definitions = unwrapList(accounts);
    return unwrapList(details).map(detail => {
        const account = definitions.find(item => detail.cuenta_id != null
            ? String(item.id) === String(detail.cuenta_id)
            : item.codigo === detail.codigo);
        const metadata = detail.valor_base_config ?? account?.valor_base_config ?? account?.valor_base;
        const result = metadata === undefined ? { ...detail } : { ...detail, valor_base_config: metadata };
        let quantity;
        if (detail.cantidad !== undefined && detail.cantidad !== null) {
            quantity = numeric(detail.cantidad);
        } else if (detail.valor_base !== undefined && detail.valor_base !== null) {
            quantity = numeric(detail.valor_base);
        } else {
            const amount = numeric(detail.valor_ingresado);
            if (['dias', 'horas'].includes(detail.tipo_valor)) {
                const rate = calcularTarifaDetalle(result, sueldo);
                quantity = rate > 0 ? roundQuantity(amount / rate) : 0;
            } else if (detail.tipo_valor === 'porcentaje') {
                const salary = numeric(sueldo);
                quantity = salary > 0 ? roundQuantity(amount / salary * 100) : 0;
            } else {
                quantity = amount;
            }
        }
        return { ...result, cantidad: quantity, valor_base: quantity };
    });
}
