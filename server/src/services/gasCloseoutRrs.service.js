const mysql = require('mysql2/promise');
const pool = require('../config/db');

let rrsPool = null;

function formatDateDDMMYYYY(val) {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(String(val).substring(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return String(val).substring(0, 10);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function getRrsPool() {
    if (rrsPool) return rrsPool;
    rrsPool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'db_system_rrs',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        decimalNumbers: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000
    });
    return rrsPool;
}

async function fetchCloseoutData(closeoutId, companyId) {
    const [closeouts] = await pool.query(`
        SELECT co.*, c.razon_social as company_name, c.nit as company_nit,
               c.nombre_comercial as company_commercial_name,
               b.nombre as branch_name, b.direccion as branch_address,
               b.telefono as branch_phone
        FROM gas_station_closeouts co
        JOIN companies c ON c.id = co.company_id
        JOIN branches b ON b.id = co.branch_id
        WHERE co.id = ? AND co.company_id = ?
    `, [closeoutId, companyId]);

    if (closeouts.length === 0) throw new Error('Cierre no encontrado');
    const closeout = closeouts[0];

    const [readings] = await pool.query(
        `SELECT * FROM gas_station_closeout_readings WHERE closeout_id = ? ORDER BY codigo_pistola ASC`, [closeoutId]
    );

    let tankReadings = [];
    try {
        [tankReadings] = await pool.query(`
            SELECT tr.*, t.capacidad
            FROM gas_station_closeout_tank_readings tr
            JOIN gas_station_tanks t ON tr.tank_id = t.id
            WHERE tr.closeout_id = ?
            ORDER BY tr.codigo_tanque ASC
        `, [closeoutId]);
    } catch (e) { /* table may not exist */ }

    const [despachadores] = await pool.query(
        `SELECT cd.*, d.codigo as despachador_codigo, d.descripcion as despachador_descripcion
         FROM gas_station_closeout_despachadores cd
         JOIN gas_station_despachadores d ON d.id = cd.despachador_id
         WHERE cd.closeout_id = ?`, [closeoutId]
    );

    const [gastos] = await pool.query(
        `SELECT e.*, p.nombre as proveedor_nombre FROM gas_station_closeout_expenses e
         LEFT JOIN providers p ON e.provider_id = p.id
         WHERE e.closeout_id = ? ORDER BY e.id ASC`, [closeoutId]
    );

    const [remesas] = await pool.query(
        `SELECT * FROM gas_station_closeout_remesas WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [cupones] = await pool.query(
        `SELECT * FROM gas_station_closeout_cupones WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [descuentos] = await pool.query(
        `SELECT * FROM gas_station_closeout_descuentos WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [adelantos] = await pool.query(
        `SELECT * FROM gas_station_closeout_adelantos WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [lubricantes] = await pool.query(
        `SELECT * FROM gas_station_closeout_lubricant_readings WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [tarjetas] = await pool.query(
        `SELECT * FROM gas_station_closeout_tarjetas WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [creditos] = await pool.query(
        `SELECT * FROM gas_station_closeout_creditos WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [vales] = await pool.query(
        `SELECT * FROM gas_station_closeout_vales WHERE closeout_id = ? ORDER BY id ASC`, [closeoutId]
    );

    const [nozzleAssignments] = await pool.query(
        `SELECT dn.* FROM gas_station_despachador_nozzles dn
         JOIN gas_station_closeout_despachadores cd ON cd.despachador_id = dn.despachador_id
         WHERE cd.closeout_id = ?`, [closeoutId]
    );

    return { closeout, readings, tankReadings, despachadores, gastos, remesas, cupones, descuentos, adelantos, lubricantes, tarjetas, creditos, vales, nozzleAssignments };
}

function getDespachadorCodigo(despachadorId, despachadores) {
    if (!despachadorId) return '001';
    const d = despachadores.find(dd => dd.despachador_id === despachadorId || dd.despachador_id == despachadorId);
    return d ? d.despachador_codigo : '001';
}

function getNozzleDespachadorCodigo(nozzleId, nozzleAssignments, despachadores) {
    const assignment = nozzleAssignments.find(a => a.nozzle_id == nozzleId);
    if (!assignment) return '001';
    return getDespachadorCodigo(assignment.despachador_id, despachadores);
}

async function sendCloseoutToRrs(closeoutId, companyId) {
    const data = await fetchCloseoutData(closeoutId, companyId);
    const { closeout, readings, tankReadings, despachadores, gastos, remesas, cupones, descuentos, adelantos, lubricantes, tarjetas, creditos, vales, nozzleAssignments } = data;

    const cierreId = '015-' + closeout.id;
    const tankLecturaId = cierreId + '-T';
    const idEmpresa = '015';
    const idPuntoVenta = 'P01';
    const fechaTurno = formatDateDDMMYYYY(closeout.fecha_turno);

    const rrs = getRrsPool();
    const conn = await rrs.getConnection();
    try {
        await conn.beginTransaction();

        // Delete existing data if re-sending
        await conn.execute('DELETE FROM cierre_turno_anticipos WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_vales WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_credito WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_tarjeta WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_descuentos WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_cupones WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_remesa WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_gastos WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno_lecturas WHERE id_cierre_turno = ?', [cierreId]);
        await conn.execute('DELETE FROM cierre_turno WHERE id = ?', [cierreId]);
        await conn.execute('DELETE FROM detalle_lecturas_tanque WHERE id_lectura = ?', [tankLecturaId]);
        await conn.execute('DELETE FROM lecturas_tanque WHERE id = ?', [tankLecturaId]);
        await conn.execute("DELETE FROM inventario_lubricantes WHERE llave LIKE ?", [cierreId + '-L%']);

        // 1. cierre_turno
        await conn.execute(`
            INSERT INTO cierre_turno (id, id_punto_venta, fecha_turno, turno, responsable, id_empresa, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            cierreId, idPuntoVenta, fechaTurno,
            parseInt(closeout.numero_turno) || 0,
            closeout.seller_name || '',
            idEmpresa,
            closeout.estado === 'cerrado' ? 'C' : 'A'
        ]);

        // 2. cierre_turno_lecturas
        for (const r of readings) {
                await conn.execute(`
                INSERT INTO cierre_turno_lecturas
                    (id_cierre_turno, id_cajero, id_producto, id_pistola, codigo_producto, nom_producto,
                     precio, lectura_anterior, lectura_actual, diferencia, calibracion, monto,
                     evaporacion, autoconsumo, varios, otros, total,
                     electronica_ant, electronica_act, dif_electronica, dif_manual, id_empresa, nombre)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, 0, 0, 0, 0, ?, ?)
            `, [
                cierreId,
                getNozzleDespachadorCodigo(r.nozzle_id, nozzleAssignments, despachadores),
                r.codigo_producto || '',
                String(r.codigo_pistola || '').substring(0, 2),
                r.codigo_producto || '',
                r.descripcion_producto || '',
                parseFloat(r.precio) || 0,
                parseFloat(r.lectura_anterior) || 0,
                parseFloat(r.lectura_actual) || 0,
                parseFloat(r.diferencia) || 0,
                parseFloat(r.calibracion) || 0,
                parseFloat(r.monto) || 0,
                parseFloat(r.diferencia) || 0,
                idEmpresa,
                r.descripcion_producto || ''
            ]);
        }

        // Actualizar id_producto en cierre_turno_lecturas usando codigo_producto
        await conn.execute(`
            UPDATE cierre_turno_lecturas a, productos b
            SET a.id_producto = b.id
            WHERE a.id_empresa = ? AND a.codigo_producto = b.codigo AND a.id_empresa = b.id_empresa
        `, [idEmpresa]);

        // 3. cierre_turno_gastos
        for (const g of gastos) {
            await conn.execute(`
                INSERT INTO cierre_turno_gastos
                    (id_cierre_turno, id_cajero, cuenta, fecha, documento, tipo_doc, cod_proveedor, valor, id_empresa, tipo, id_rubro, concepto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                cierreId,
                getDespachadorCodigo(g.despachador_id, despachadores),
                g.rubro || '',
                g.fecha ? formatDateDDMMYYYY(g.fecha) : fechaTurno,
                g.documento || '',
                g.tipo || '',
                g.proveedor || g.proveedor_nombre || '',
                parseFloat(g.valor) || 0,
                idEmpresa,
                'G',
                '001',
                g.rubro || ''
            ]);
        }

        // 4. cierre_turno_remesa
        for (const r of remesas) {
            await conn.execute(`
                INSERT INTO cierre_turno_remesa
                    (id_cierre_turno, id_cajero, fecha, documento, efectivo, monedas, transferencia, id_empresa, tipo_operacion)
                VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)
            `, [
                cierreId,
                getDespachadorCodigo(r.despachador_id, despachadores),
                fechaTurno,
                r.documento || '',
                parseFloat(r.monto) || 0,
                idEmpresa,
                'VTA'
            ]);
        }

        // 5. cierre_turno_cupones
        for (const c of cupones) {
            await conn.execute(`
                INSERT INTO cierre_turno_cupones
                    (id_cierre_turno, id_cajero, fecha, documento, distribuidora, cod_producto, valor, id_empresa, tipo_operacion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                cierreId,
                getDespachadorCodigo(c.despachador_id, despachadores),
                fechaTurno,
                c.cupon || '',
                String(c.distribuidora_id || '1').substring(0, 2),
                c.producto_codigo || '',
                parseFloat(c.monto) || 0,
                idEmpresa,
                'VTA'
            ]);
        }

        // 6. cierre_turno_descuentos
        for (const d of descuentos) {
            await conn.execute(`
                INSERT INTO cierre_turno_descuentos
                    (id_empresa, id_cierre_turno, id_cajero, fecha, documento, cod_cliente, cod_producto, cantidad, valor)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                idEmpresa,
                cierreId,
                getDespachadorCodigo(d.despachador_id, despachadores),
                fechaTurno,
                String(d.documento || '').substring(0, 10),
                String(d.cliente_nombre || '').substring(0, 20),
                d.producto_codigo || '',
                parseFloat(d.cantidad) || 0,
                parseFloat(d.valor) || 0
            ]);
        }

        // 7. cierre_turno_tarjeta
        for (const t of tarjetas) {
            await conn.execute(`
                INSERT INTO cierre_turno_tarjeta
                    (id_cierre_turno, id_cajero, fecha, numero_tarjeta, autorizacion, id_banco, valor, id_empresa, tipo_operacion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                cierreId,
                getDespachadorCodigo(t.despachador_id, despachadores),
                fechaTurno,
                t.num_tarjeta || '',
                t.num_autorizacion || '',
                '01',
                parseFloat(t.monto) || 0,
                idEmpresa,
                'VTA'
            ]);
        }

        // 8. cierre_turno_credito
        for (const c of creditos) {
            await conn.execute(`
                INSERT INTO cierre_turno_credito
                    (id_empresa, id_cierre_turno, id_cajero, fecha, documento, tipo_doc, cod_cliente, valor, saldo,
                     cod_producto, cantidad, precio, tipo, placa, kilometraje)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                idEmpresa,
                cierreId,
                getDespachadorCodigo(c.despachador_id, despachadores),
                fechaTurno,
                c.documento || '',
                c.tipo_documento || 'FAC',
                String(c.cliente_nombre || '').substring(0, 10),
                parseFloat(c.monto) || 0,
                parseFloat(c.monto) || 0,
                c.producto_codigo || '',
                parseFloat(c.cantidad) || 0,
                parseFloat(c.precio) || 0,
                'C',
                c.placa || '',
                parseFloat(c.kilometraje) || 0
            ]);
        }

        // 9. cierre_turno_vales
        for (const v of vales) {
            await conn.execute(`
                INSERT INTO cierre_turno_vales
                    (id_cierre_turno, id_cajero, fecha, documento, cod_cliente, cod_producto, valor, id_empresa, cantidad, precio, saldo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                cierreId,
                getDespachadorCodigo(v.despachador_id, despachadores),
                fechaTurno,
                v.documento || '',
                String(v.cliente_nombre || '').substring(0, 20),
                v.producto_codigo || '',
                parseFloat(v.monto) || 0,
                idEmpresa,
                parseFloat(v.cantidad) || 0,
                parseFloat(v.precio) || 0,
                parseFloat(v.monto) || 0
            ]);
        }

        // 10. cierre_turno_anticipos
        for (const a of adelantos) {
            await conn.execute(`
                INSERT INTO cierre_turno_anticipos
                    (id_cierre_turno, id_cajero, id_empleado, valor, id_empresa)
                VALUES (?, ?, ?, ?, ?)
            `, [
                cierreId,
                getDespachadorCodigo(a.despachador_id, despachadores),
                String(a.empleado || '').substring(0, 4),
                parseFloat(a.monto) || 0,
                idEmpresa
            ]);
        }

        // 11. lecturas_tanque + detalle_lecturas_tanque
        if (tankReadings.length > 0) {
            await conn.execute(`
                INSERT INTO lecturas_tanque (id, fecha, turno, orden, id_empresa, estado)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                tankLecturaId,
                fechaTurno,
                parseInt(closeout.numero_turno) || 0,
                String(closeout.id),
                idEmpresa,
                'A'
            ]);

            for (const tr of tankReadings) {
                await conn.execute(`
                    INSERT INTO detalle_lecturas_tanque
                        (id_lectura, id_producto, codigo_producto, descripcion, anterior, recarga, lectura, diferencia, id_empresa)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    tankLecturaId,
                    tr.codigo_tanque || '',
                    tr.codigo_tanque || '',
                    String(tr.descripcion_tanque || '').substring(0, 80),
                    parseFloat(tr.lectura_anterior) || 0,
                    parseFloat(tr.recarga) || 0,
                    parseFloat(tr.lectura_actual) || 0,
                    parseFloat(tr.diferencia) || 0,
                    idEmpresa
                ]);
            }
        }

        // 12. inventario_lubricantes
        for (let i = 0; i < lubricantes.length; i++) {
            const l = lubricantes[i];
            await conn.execute(`
                INSERT INTO inventario_lubricantes
                    (id_empresa, fecha_turno, turno, id_producto, inicial, complemento, final, ventas, precio_unitario, precio_total, llave, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                idEmpresa,
                fechaTurno,
                parseInt(closeout.numero_turno) || 0,
                l.producto_codigo || '',
                parseFloat(l.lectura_inicial) || 0,
                parseFloat(l.recarga) || 0,
                parseFloat(l.lectura_final) || 0,
                parseFloat(l.ventas) || 0,
                parseFloat(l.precio) || 0,
                parseFloat(l.total) || 0,
                cierreId + '-L-' + i,
                'A'
            ]);
        }

        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { sendCloseoutToRrs };
