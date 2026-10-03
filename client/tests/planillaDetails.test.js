import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarDetallesGuardados } from '../src/components/rh/planillas/planillaDetails.js';
import { calcularMontoDetalle } from '../src/components/rh/planillas/planillaUtils.js';

test('un importe histórico de diez dólares representa dos horas y conserva su valor guardado', () => {
    const source = { cuenta_id: 3, tipo_valor: 'horas', operacion: 'sumar', valor_base: null, valor_ingresado: '10.00' };
    const [detail] = normalizarDetallesGuardados([source], 600);
    assert.equal(detail.cantidad, 2);
    assert.equal(detail.valor_ingresado, '10.00');
    assert.equal(calcularMontoDetalle(detail, detail.cantidad, 600), 10);
    assert.equal(source.valor_base, null);
    assert.equal(Object.hasOwn(source, 'cantidad'), false);
});

test('cantidad y base explícitamente cero tienen prioridad sobre importes o valores de catálogo', () => {
    const rows = normalizarDetallesGuardados([
        { cuenta_id: 3, tipo_valor: 'horas', operacion: 'sumar', cantidad: 0, valor_base: 2, valor_ingresado: 10 },
        { cuenta_id: 3, tipo_valor: 'horas', operacion: 'sumar', valor_base: '0.0000', valor_ingresado: 10 }
    ], 600, [{ id: 3, valor_base: 2.5 }]);
    assert.deepEqual(rows.map(row => row.cantidad), [0, 0]);
    assert.deepEqual(rows.map(row => row.valor_base), [0, 0]);
    assert.deepEqual(rows.map(row => row.valor_ingresado), [10, 10]);
});

test('la cantidad informada prevalece sobre base y conserva el importe aunque no coincidan', () => {
    const [detail] = normalizarDetallesGuardados([
        { tipo_valor: 'dias', cantidad: '7', valor_base: 10, valor_ingresado: '155.45' }
    ], 600);
    assert.equal(detail.cantidad, 7);
    assert.equal(detail.valor_base, 7);
    assert.equal(detail.valor_ingresado, '155.45');
});

test('enriquece la tarifa por cuenta y usa esa tarifa al inferir horas sin alterar el importe', () => {
    const source = { cuenta_id: '3', tipo_valor: 'horas', operacion: 'sumar', valor_base: null, valor_ingresado: 15 };
    const accounts = { data: [{ id: 3, valor_base: 3 }] };
    const [detail] = normalizarDetallesGuardados({ data: [source] }, 600, accounts);
    assert.equal(detail.valor_base_config, 3);
    assert.equal(detail.cantidad, 2);
    assert.equal(detail.valor_ingresado, 15);
    assert.equal(calcularMontoDetalle(detail, detail.cantidad, 600), 15);
    assert.equal(Object.hasOwn(source, 'valor_base_config'), false);
});

test('respeta una tarifa guardada aunque la configuración actual tenga otra tarifa', () => {
    const [detail] = normalizarDetallesGuardados([
        { cuenta_id: 3, tipo_valor: 'horas', operacion: 'sumar', valor_base_config: 2, valor_ingresado: 10 }
    ], 600, [{ id: 3, valor_base: 3 }]);
    assert.equal(detail.valor_base_config, 2);
    assert.equal(detail.cantidad, 2);
    assert.equal(detail.valor_ingresado, 10);
});

test('porcentaje cero no utiliza la configuración como sustituto e infiere otros porcentajes', () => {
    const rows = normalizarDetallesGuardados([
        { cuenta_id: 4, tipo_valor: 'porcentaje', valor_base: 0, valor_ingresado: 0 },
        { cuenta_id: 4, tipo_valor: 'porcentaje', valor_base: null, valor_ingresado: '30.00' }
    ], 600, [{ id: 4, valor_base: 10 }]);
    assert.equal(rows[0].cantidad, 0);
    assert.equal(calcularMontoDetalle(rows[0], rows[0].cantidad, 600), 0);
    assert.equal(rows[1].cantidad, 5);
    assert.equal(rows[1].valor_ingresado, '30.00');
});

test('listas inválidas y salarios sin tarifa no generan NaN ni excepciones', () => {
    assert.deepEqual(normalizarDetallesGuardados({}, 600), []);
    const [detail] = normalizarDetallesGuardados([{ tipo_valor: 'horas', valor_ingresado: 10 }], 0);
    assert.equal(detail.cantidad, 0);
    assert.equal(detail.valor_ingresado, 10);
});
