require('dotenv').config();
const pool = require('../src/config/db');
const { getRrsPool } = require('../src/config/rrsDb');
const { sendCloseoutToRrs } = require('../src/services/gasCloseoutRrs.service');

async function resendGasDelivery(deliveryId, companyId) {
    const [deliveries] = await pool.query(
        `SELECT d.*, b.nombre as branch_name
         FROM gas_station_remesa_deliveries d
         LEFT JOIN branches b ON d.branch_id = b.id
         WHERE d.id = ? AND d.company_id = ?`,
        [deliveryId, companyId]
    );
    if (!deliveries.length) throw new Error('Entrega de gasolinera no encontrada: ' + deliveryId);
    const delivery = deliveries[0];

    const [remesas] = await pool.query(
        `SELECT r.* FROM gas_station_closeout_remesas r
         JOIN gas_station_closeouts c ON r.closeout_id = c.id
         WHERE r.entrega_id = ?`,
        [deliveryId]
    );
    const montoTotal = remesas.reduce((s, r) => s + (parseFloat(r.monto) || 0), 0);

    const [remesasExtra] = await pool.query(
        `SELECT id, descripcion, monto FROM gas_station_delivery_remesas_extra
         WHERE delivery_id = ?
         ORDER BY id ASC`,
        [deliveryId]
    );

    const [settingsRows] = await pool.query(
        `SELECT setting_value FROM gas_station_settings 
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = 'cuenta_bancaria_pista'`,
        [companyId, delivery.branch_id || null, delivery.branch_id || null]
    );

    const [empresaRows] = await pool.query(
        `SELECT setting_value FROM gas_station_settings 
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = 'rrs_id_empresa'`,
        [companyId, delivery.branch_id || null, delivery.branch_id || null]
    );
    const rrsIdEmpresa = empresaRows[0]?.setting_value || '014';

    const rawAccount = settingsRows[0]?.setting_value || '';
    const cleanAccount = rawAccount.replace(/\s/g, '');
    const last4 = cleanAccount.slice(-4);

    const rrsPool = getRrsPool();
    const [cuentas] = await rrsPool.query(
        `SELECT id_empresa, numero FROM cuentas_bancarias WHERE numero LIKE ?`,
        [`%${last4}`]
    );
    if (cuentas.length === 0) throw new Error('No se encontró cuenta bancaria en RRS para pista con terminación ' + last4);
    const cuenta = cuentas[0];

    const llave = `${rrsIdEmpresa}-${delivery.id}`;
    const documento = (delivery.referencia || '').trim() || String(delivery.id).padStart(7, '0');
    const d = new Date(delivery.fecha);
    const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const hora = delivery.hora ? String(delivery.hora).substring(0, 5) : '00:00';
    const concepto = `${delivery.branch_name || 'Sucursal'} - ${fechaStr} ${hora}`;

    // Eliminar previo para esta cuenta y llave específica
    await rrsPool.query(`DELETE FROM movimientos_bancarios WHERE llave = ? AND numero_cuenta = ?`, [llave, cuenta.numero]);

    if (montoTotal > 0) {
        await rrsPool.query(
            `INSERT INTO movimientos_bancarios 
             (id_empresa, llave, cod_remesa, documento, numero_cuenta, concepto, cargo, abono, fecha_aplicado, fecha, monto, tipo_destino) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cuenta.id_empresa,
                llave,
                '01',
                documento,
                cuenta.numero,
                concepto,
                montoTotal.toFixed(2),
                '0.0',
                '',
                fechaStr,
                montoTotal.toFixed(2),
                'P'
            ]
        );
    }

    for (const extra of remesasExtra) {
        const montoExtra = parseFloat(extra.monto) || 0;
        if (montoExtra <= 0) continue;
        const llaveExtra = `${rrsIdEmpresa}-${delivery.id}-E${extra.id}`;
        const conceptoExtra = String(extra.descripcion || 'Otras remesas').trim().toUpperCase().slice(0, 120);

        await rrsPool.query(`DELETE FROM movimientos_bancarios WHERE llave = ? AND numero_cuenta = ?`, [llaveExtra, cuenta.numero]);
        await rrsPool.query(
            `INSERT INTO movimientos_bancarios 
             (id_empresa, llave, cod_remesa, documento, numero_cuenta, concepto, cargo, abono, fecha_aplicado, fecha, monto, tipo_destino) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cuenta.id_empresa,
                llaveExtra,
                '01',
                documento,
                cuenta.numero,
                conceptoExtra,
                montoExtra.toFixed(2),
                '0.0',
                '',
                fechaStr,
                montoExtra.toFixed(2),
                'P'
            ]
        );
    }

    return {
        id: delivery.id,
        llave,
        documento,
        monto: montoTotal,
        fecha: fechaStr,
        cuenta: cuenta.numero,
        concepto
    };
}

async function resendSalesDelivery(deliveryId, companyId) {
    const [deliveries] = await pool.query(
        `SELECT d.*, b.nombre as branch_name
         FROM sales_remesa_deliveries d
         LEFT JOIN branches b ON d.branch_id = b.id
         WHERE d.id = ? AND d.company_id = ?`,
        [deliveryId, companyId]
    );
    if (!deliveries.length) throw new Error('Entrega de venta no encontrada: ' + deliveryId);
    const delivery = deliveries[0];

    const [remesas] = await pool.query(
        `SELECT r.* FROM pos_shift_remesas r
         JOIN pos_shifts s ON r.shift_id = s.id
         WHERE r.entrega_id = ?`,
        [deliveryId]
    );
    const remesasTotal = remesas.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const montoEntregado = delivery.monto_entregado !== null && delivery.monto_entregado !== undefined
        ? parseFloat(delivery.monto_entregado)
        : remesasTotal;

    const [settingsRows] = await pool.query(
        `SELECT setting_value FROM sales_settings 
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = 'cuenta_bancaria_tienda'`,
        [companyId, delivery.branch_id || null, delivery.branch_id || null]
    );
    const rawAccount = settingsRows[0]?.setting_value || '';
    const cleanAccount = rawAccount.replace(/\s/g, '');
    const last4 = cleanAccount.slice(-4);

    const [empresaRows] = await pool.query(
        `SELECT setting_value FROM sales_settings 
         WHERE company_id = ? AND (branch_id = ? OR (branch_id IS NULL AND ? IS NULL))
         AND setting_key = 'empresa_rrs'`,
        [companyId, delivery.branch_id || null, delivery.branch_id || null]
    );
    const rrsIdEmpresa = empresaRows[0]?.setting_value || '014';

    const rrsPool = getRrsPool();
    const [cuentas] = await rrsPool.query(
        `SELECT id_empresa, numero FROM cuentas_bancarias WHERE numero LIKE ?`,
        [`%${last4}`]
    );
    if (cuentas.length === 0) throw new Error('No se encontró cuenta bancaria en RRS para tienda con terminación ' + last4);
    const cuenta = cuentas[0];

    const llave = `${rrsIdEmpresa}-${delivery.id}`;
    const documento = (delivery.referencia || '').trim() || String(delivery.id).padStart(7, '0');
    const d = new Date(delivery.fecha);
    const fechaStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const hora = delivery.hora ? String(delivery.hora).substring(0, 5) : '00:00';
    const concepto = `${delivery.branch_name || 'Sucursal'} - ${fechaStr} ${hora}`;

    await rrsPool.query(`DELETE FROM movimientos_bancarios WHERE llave = ? AND numero_cuenta = ?`, [llave, cuenta.numero]);

    await rrsPool.query(
        `INSERT INTO movimientos_bancarios 
         (id_empresa, llave, cod_remesa, documento, numero_cuenta, concepto, cargo, abono, fecha_aplicado, fecha, monto, tipo_destino) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            cuenta.id_empresa,
            llave,
            '01',
            documento,
            cuenta.numero,
            concepto,
            montoEntregado.toFixed(2),
            '0.0',
            '',
            fechaStr,
            montoEntregado.toFixed(2),
            'P'
        ]
    );

    return {
        id: delivery.id,
        llave,
        documento,
        monto: montoEntregado,
        fecha: fechaStr,
        cuenta: cuenta.numero,
        concepto
    };
}

(async () => {
    try {
        console.log('=== REENVIANDO REMESAS A RRS (INVERSIONES LIL - PUMA SAN MARTIN II) ===');
        console.log('Fechas: 18/09/2026, 19/09/2026, 20/09/2026\n');

        const companyId = 1;

        // 1. Gas Station Remesa Deliveries
        console.log('--- REENVIANDO ENTREGAS DE REMESAS DE GASOLINERA (PISTA) ---');
        const gasDeliveryIds = [106, 107, 109];
        for (const id of gasDeliveryIds) {
            const res = await resendGasDelivery(id, companyId);
            console.log(`✓ Entrega Gasolinera ID ${id} (${res.fecha}): Llave=${res.llave}, Doc=${res.documento}, Monto=$${res.monto.toFixed(2)}, Cuenta=${res.cuenta}`);
        }

        // 2. Sales Remesa Deliveries
        console.log('\n--- REENVIANDO ENTREGAS DE REMESAS DE VENTAS (TIENDA) ---');
        const salesDeliveryIds = [83, 87, 90];
        for (const id of salesDeliveryIds) {
            const res = await resendSalesDelivery(id, companyId);
            console.log(`✓ Entrega Ventas ID ${id} (${res.fecha}): Llave=${res.llave}, Doc=${res.documento}, Monto=$${res.monto.toFixed(2)}, Cuenta=${res.cuenta}`);
        }

        // 3. Verificación en RRS movimientos_bancarios
        console.log('\n--- VERIFICACIÓN EN RRS: movimientos_bancarios ---');
        const rrs = getRrsPool();
        const [movs] = await rrs.query(
            `SELECT id, id_empresa, llave, documento, numero_cuenta, concepto, cargo, fecha, monto 
             FROM movimientos_bancarios 
             WHERE llave IN ('014-106', '014-107', '014-109', '014-83', '014-87', '014-90')
             ORDER BY fecha ASC, llave ASC`
        );
        console.table(movs);

        // 4. Verificación de Cierres de Gasolinera en RRS
        console.log('\n--- VERIFICACIÓN EN RRS: cierre_turno_remesa ---');
        const closeoutIds = ['014-346', '014-348', '014-350', '014-352', '014-354', '014-356', '014-358', '014-360', '014-361'];
        const [remesasCloseouts] = await rrs.query(
            `SELECT id_cierre_turno, fecha, COUNT(*) as cantidad_remesas, SUM(efectivo) as total_remesas 
             FROM cierre_turno_remesa 
             WHERE id_cierre_turno IN (?)
             GROUP BY id_cierre_turno, fecha
             ORDER BY id_cierre_turno ASC`,
            [closeoutIds]
        );
        console.table(remesasCloseouts);

        console.log('\nPROCESO COMPLETADO EXITOSAMENTE');
        process.exit(0);
    } catch (err) {
        console.error('Error durante el reenvío:', err);
        process.exit(1);
    }
})();
