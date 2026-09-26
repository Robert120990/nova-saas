const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
    accountTypeSchema,
    accountTypeUpdateSchema,
    entryTypeSchema,
    accountSchema,
    accountUpdateSchema,
    entrySchema,
    entryUpdateSchema,
    accountingCorrelativosSchema,
    accountingRenumberSchema
} = require('../../src/schemas/accountingSchemas');

const {
    empleadoSchema,
    empleadoUpdateSchema,
    accionPersonalSchema,
    accionPersonalUpdateSchema,
    planillaVacacionesSchema,
    planillaVacacionesUpdateSchema,
    planillaAguinaldosSchema,
    rhDescuentoSchema
} = require('../../src/schemas/rhSchemas');

const {
    pozoServicioSchema,
    pozoServicioUpdateSchema,
    pozoDespachoSchema,
    pozoDespachoUpdateSchema,
    pozoCorteSchema,
    pozoCorteOdometroSchema,
    pozoEntregaEfectivoSchema,
    pozoEntregaEfectivoUpdateSchema
} = require('../../src/schemas/pozoSchemas');

describe('Contabilidad, Recursos Humanos y Control de Pozos Schemas Validation', () => {

    // ==========================================
    // CONTABILIDAD SCHEMAS
    // ==========================================
    describe('Contabilidad Schemas', () => {
        it('should validate account type creation and update', () => {
            const valid = { name: 'Activo Corriente', code: '11', nature: 'debit' };
            assert.strictEqual(accountTypeSchema.safeParse(valid).success, true);

            const invalid = { name: '', code: '11' };
            assert.strictEqual(accountTypeSchema.safeParse(invalid).success, false);

            const update = { name: 'Activo Circulante' };
            assert.strictEqual(accountTypeUpdateSchema.safeParse(update).success, true);
        });

        it('should validate entry type creation', () => {
            const valid = { name: 'Partida de Ingreso', code: 'ING' };
            assert.strictEqual(entryTypeSchema.safeParse(valid).success, true);
        });

        it('should validate chart of accounts creation and update', () => {
            const account = {
                code: '110101',
                name: 'Caja General',
                account_type_id: 1,
                allows_entries: 1
            };
            assert.strictEqual(accountSchema.safeParse(account).success, true);

            const update = { name: 'Caja Chica y Fondo Fijo' };
            assert.strictEqual(accountUpdateSchema.safeParse(update).success, true);

            const bad = { code: '', name: 'Caja', account_type_id: 1 };
            assert.strictEqual(accountSchema.safeParse(bad).success, false);
        });

        it('should validate balanced accounting entries and reject unbalanced ones', () => {
            const balancedEntry = {
                entry_type_id: 1,
                date: '2026-09-23',
                description: 'Venta del día',
                lines: [
                    { account_id: 1, debit: 113.00, credit: 0, description: 'Efectivo en caja' },
                    { account_id: 2, debit: 0, credit: 100.00, description: 'Ingresos por venta' },
                    { account_id: 3, debit: 0, credit: 13.00, description: 'IVA Débito Fiscal' }
                ]
            };
            const resBalanced = entrySchema.safeParse(balancedEntry);
            assert.strictEqual(resBalanced.success, true);

            const unbalancedEntry = {
                entry_type_id: 1,
                date: '2026-09-23',
                description: 'Descuadrada',
                lines: [
                    { account_id: 1, debit: 100.00, credit: 0 },
                    { account_id: 2, debit: 0, credit: 50.00 }
                ]
            };
            const resUnbalanced = entrySchema.safeParse(unbalancedEntry);
            assert.strictEqual(resUnbalanced.success, false);
            assert.ok(resUnbalanced.error.issues.some(i => i.message.includes('cuadrada')));
        });

        it('should validate entry update partial with lines balance check', () => {
            const updateBalanced = {
                description: 'Concepto corregido',
                lines: [
                    { account_id: 1, debit: 50.00, credit: 0 },
                    { account_id: 2, debit: 0, credit: 50.00 }
                ]
            };
            assert.strictEqual(entryUpdateSchema.safeParse(updateBalanced).success, true);
        });

        it('should validate correlativos and renumber requests', () => {
            const corr = {
                type_id: 1,
                year: 2026,
                months: [
                    { month: 1, current_number: 10 },
                    { month: 2, current_number: 5 }
                ]
            };
            assert.strictEqual(accountingCorrelativosSchema.safeParse(corr).success, true);

            const renumber = { type_id: 1, year: 2026 };
            assert.strictEqual(accountingRenumberSchema.safeParse(renumber).success, true);

            const badYear = { type_id: 1, year: 1800 };
            assert.strictEqual(accountingRenumberSchema.safeParse(badYear).success, false);
        });
    });

    // ==========================================
    // RECURSOS HUMANOS SCHEMAS
    // ==========================================
    describe('Recursos Humanos Schemas', () => {
        it('should validate empleado creation and update', () => {
            const emp = {
                nombres: 'Carlos Roberto',
                apellidos: 'García Pérez',
                num_dui: '02345678-9',
                num_nit: '0614-120990-101-2',
                telefono: '7890-1234',
                correo: 'carlos.garcia@empresa.com',
                sueldo_base: 500.00,
                emergency_contacts: [
                    { nombre: 'María Pérez', telefono: '7111-2222', parentesco: 'Madre' }
                ]
            };
            const res = empleadoSchema.safeParse(emp);
            assert.strictEqual(res.success, true);

            const update = { sueldo_base: 600.00 };
            assert.strictEqual(empleadoUpdateSchema.safeParse(update).success, true);

            const badDui = { nombres: 'Ana', apellidos: 'López', num_dui: '123' };
            const resBad = empleadoSchema.safeParse(badDui);
            assert.strictEqual(resBad.success, false);
            assert.ok(resBad.error.issues.some(i => i.message.includes('DUI')));
        });

        it('should validate personal actions (acciones de personal)', () => {
            const accion = {
                empleado_id: 1,
                fecha: '2026-09-23',
                descripcion_causa: 'Llegada tardía reiterada sin justificación',
                tipo_accion: 'amonestacion',
                accion_tomar: 'llamado_escrito_1'
            };
            assert.strictEqual(accionPersonalSchema.safeParse(accion).success, true);

            const update = { observaciones: 'Firmado por colaborador' };
            assert.strictEqual(accionPersonalUpdateSchema.safeParse(update).success, true);

            const missingCausa = { empleado_id: 1, fecha: '2026-09-23' };
            assert.strictEqual(accionPersonalSchema.safeParse(missingCausa).success, false);
        });

        it('should validate vacation payroll', () => {
            const vac = {
                empleado_id: 5,
                periodo_año: 2026,
                periodo_mes: 9,
                quincena: 2,
                fecha_inicial: '2026-09-16',
                fecha_final: '2026-09-30',
                vacaciones_monto: 250.00,
                monto_recibir: 220.00
            };
            assert.strictEqual(planillaVacacionesSchema.safeParse(vac).success, true);

            const update = { vacaciones_monto: 260.00 };
            assert.strictEqual(planillaVacacionesUpdateSchema.safeParse(update).success, true);
        });

        it('should validate aguinaldo payroll and discounts', () => {
            const agui = {
                año: 2026,
                mes: 12,
                items: [
                    { empleado_id: 1, sueldo_base: 500, aguinaldo_calculado: 250, monto_recibir: 250 }
                ]
            };
            assert.strictEqual(planillaAguinaldosSchema.safeParse(agui).success, true);

            const desc = {
                tipo_descuento: 'Préstamo bancario',
                monto_total: 600,
                monto_cuota: 50
            };
            assert.strictEqual(rhDescuentoSchema.safeParse(desc).success, true);
        });
    });

    // ==========================================
    // CONTROL DE POZOS SCHEMAS
    // ==========================================
    describe('Control de Pozos Schemas', () => {
        it('should validate servicio de pozo creation and update', () => {
            const serv = { codigo: 'SRV-01', descripcion: 'Llenado de pipa 5000 gal', monto: 35.00 };
            assert.strictEqual(pozoServicioSchema.safeParse(serv).success, true);

            const update = { monto: 40.00 };
            assert.strictEqual(pozoServicioUpdateSchema.safeParse(update).success, true);

            const badMonto = { codigo: 'SRV-02', monto: 0 };
            assert.strictEqual(pozoServicioSchema.safeParse(badMonto).success, false);
        });

        it('should validate despacho de pozo with items', () => {
            const despacho = {
                numero: 'DESP-001',
                fecha: '2026-09-23',
                cliente: 'Pipa Santa Elena',
                placa: 'C-123456',
                odometro_inicial: 1000,
                odometro_final: 1050,
                servicios: [
                    { servicio_id: 1, cantidad: 1, monto: 35.00 }
                ]
            };
            assert.strictEqual(pozoDespachoSchema.safeParse(despacho).success, true);

            const update = {
                fecha: '2026-09-23',
                odometro_final: 1060,
                servicios: [
                    { servicio_id: 1, cantidad: 1, monto: 35.00 }
                ]
            };
            assert.strictEqual(pozoDespachoUpdateSchema.safeParse(update).success, true);

            const noServices = {
                fecha: '2026-09-23',
                servicios: []
            };
            assert.strictEqual(pozoDespachoSchema.safeParse(noServices).success, false);
        });

        it('should validate corte de pozo and odometro final', () => {
            const corte = {
                fecha: '2026-09-23',
                encargado: 'Juan Operador',
                odometro_final_manual: 1250,
                gastos: [
                    { descripcion: 'Compra de lubricante', monto: 12.50 }
                ]
            };
            assert.strictEqual(pozoCorteSchema.safeParse(corte).success, true);

            const odo = { odometro_final: 1300 };
            assert.strictEqual(pozoCorteOdometroSchema.safeParse(odo).success, true);
        });

        it('should validate entrega de efectivo', () => {
            const entrega = {
                persona_entrega: 'Juan Operador',
                persona_recibe: 'Cajero Central',
                fecha: '2026-09-23',
                monto: 150.00
            };
            assert.strictEqual(pozoEntregaEfectivoSchema.safeParse(entrega).success, true);

            const update = { monto: 175.00 };
            assert.strictEqual(pozoEntregaEfectivoUpdateSchema.safeParse(update).success, true);

            const badEntrega = {
                persona_entrega: '',
                persona_recibe: 'Cajero Central',
                fecha: '2026-09-23',
                monto: 0
            };
            assert.strictEqual(pozoEntregaEfectivoSchema.safeParse(badEntrega).success, false);
        });
    });
});
