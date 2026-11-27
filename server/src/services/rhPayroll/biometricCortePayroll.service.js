const { TABLE, MESES } = require('./shared');
const { cargarCuentasPorDefecto } = require('./defaults.service');
const { recalculateSavedPlanilla } = require('./calculation.service');
const { splitOvertimeDayNight } = require('../rhBiometricCalc.helper');
const { extractDateOnly } = require('../rhBiometricDate.helper');
const {
    LEGAL_FACTOR_DIURNA,
    LEGAL_FACTOR_NOCTURNA,
    round2,
    round4,
    computeLegalOvertimeRates,
    computeLegalOvertimeAmounts,
    resolvePositivePayableSplit
} = require('./biometricCorteCalc.helper');

const payrollError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const parseBoolFlag = (val, fallback = true) => (val === undefined ? fallback : (val !== false && val !== 0 && val !== '0' && val !== 'false'));

function parseYearMonth(anioRaw, mesRaw, quincenaRaw) {
    return {
        periodoAnio: parseInt(anioRaw, 10) || null,
        periodoMes: parseInt(mesRaw, 10) || null,
        quincena: ['primera', 'segunda'].includes(quincenaRaw) ? quincenaRaw : null
    };
}

async function resolveOvertimeAccounts(connection, companyId, { ensureCreate = false } = {}) {
    const [cuentas] = await connection.query(
        `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
        [companyId]
    );
    const horasSumar = cuentas.filter(c => c.operacion === 'sumar');
    let diurna = horasSumar.find(c => c.codigo === '08')
        || horasSumar.find(c => c.tipo_valor === 'horas' && !String(c.descripcion || '').toUpperCase().includes('NOCTURNA'))
        || null;
    let nocturna = horasSumar.find(c => c.codigo === '03')
        || horasSumar.find(c => c.tipo_valor === 'horas' && String(c.descripcion || '').toUpperCase().includes('NOCTURNA'))
        || null;

    if (ensureCreate && !diurna) {
        const [ins] = await connection.query(
            `INSERT INTO rh_cuentas_planillas (company_id, codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden)
             VALUES (?, '08', 'HORAS EXTRAS DIURNAS', 'sumar', 'horas', 1, 1, 1, 8)`,
            [companyId]
        );
        diurna = { id: ins.insertId, codigo: '08', descripcion: 'HORAS EXTRAS DIURNAS', operacion: 'sumar', tipo_valor: 'horas', valor_base: null, orden: 8 };
    }
    if (ensureCreate && !nocturna) {
        const [ins] = await connection.query(
            `INSERT INTO rh_cuentas_planillas (company_id, codigo, descripcion, operacion, tipo_valor, activa, aparece_recibos, aparece_planilla, orden)
             VALUES (?, '03', 'HORAS EXTRAS NOCTURNAS', 'sumar', 'horas', 1, 1, 1, 3)`,
            [companyId]
        );
        nocturna = { id: ins.insertId, codigo: '03', descripcion: 'HORAS EXTRAS NOCTURNAS', operacion: 'sumar', tipo_valor: 'horas', valor_base: null, orden: 3 };
    }
    return { diurna, nocturna };
}

async function loadCorteSaldosRows(connection, companyId, corteId) {
    const [saldos] = await connection.query(
        `SELECT * FROM rh_biometric_corte_saldos WHERE company_id = ? AND corte_id = ? ORDER BY empleado_nombre ASC`,
        [companyId, corteId]
    );
    if (saldos.length > 0) return saldos;

    const [fallback] = await connection.query(
        `SELECT o.empleado_id, o.device_uid,
                MAX(COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.nombres, ''), ' ', COALESCE(e.apellidos, ''))), ''), CONCAT('UID ', o.device_uid))) as empleado_nombre,
                '' as area, 'produccion' as categoria, 8 as horas_jornada_base,
                ROUND(SUM(o.horas_extra_aprobadas), 2) as horas_extra_periodo, 0 as horas_pendientes_anteriores,
                ROUND(SUM(COALESCE(o.horas_extra_avicola, 0)), 2) as horas_extra_avicola,
                ROUND(SUM(o.horas_extra_aprobadas), 2) as saldo_neto,
                ROUND(GREATEST(0, SUM(o.horas_extra_aprobadas)), 2) as horas_pagables,
                ROUND(LEAST(0, SUM(o.horas_extra_aprobadas)), 2) as saldo_arrastre_siguiente
         FROM rh_biometric_daily_overtime o
         LEFT JOIN rh_empleados e ON e.id = o.empleado_id
         WHERE o.company_id = ? AND o.corte_id = ?
         GROUP BY o.empleado_id, o.device_uid
         ORDER BY empleado_nombre ASC`,
        [companyId, corteId]
    );
    return fallback;
}

async function loadNightOvertimeMap(connection, companyId, corteId) {
    const [dailyRows] = await connection.query(
        `SELECT empleado_id, device_uid, salida, horas_extra_aprobadas
         FROM rh_biometric_daily_overtime
         WHERE company_id = ? AND corte_id = ? AND horas_extra_aprobadas > 0`,
        [companyId, corteId]
    );
    const byEmpId = new Map();
    const byUid = new Map();
    for (const r of dailyRows) {
        const mins = Math.round(parseFloat(r.horas_extra_aprobadas || 0) * 60);
        if (mins <= 0) continue;
        const { horasExtraNocturnas } = splitOvertimeDayNight(r.salida ? `2026-01-01 ${String(r.salida).slice(0, 8)}` : null, mins);
        if (horasExtraNocturnas <= 0) continue;
        if (r.empleado_id) byEmpId.set(Number(r.empleado_id), round2((byEmpId.get(Number(r.empleado_id)) || 0) + horasExtraNocturnas));
        if (r.device_uid) byUid.set(String(r.device_uid).trim(), round2((byUid.get(String(r.device_uid).trim()) || 0) + horasExtraNocturnas));
    }
    return { byEmpId, byUid };
}

async function loadPeriodContext(connection, companyId, cuentas, { periodoAnio, periodoMes, quincena }) {
    const planillaMap = new Map();
    const currentHoursMap = new Map();
    let periodoGenerado = false;
    let periodoCerrado = false;
    if (!periodoAnio || !periodoMes || !quincena) return { planillaMap, currentHoursMap, periodoGenerado, periodoCerrado };

    const [pRows] = await connection.query(
        `SELECT id, empleado_id, estado FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
        [companyId, periodoAnio, periodoMes, quincena]
    );
    periodoGenerado = pRows.length > 0;
    periodoCerrado = pRows.some(p => p.estado === 'pagada');
    pRows.forEach(p => planillaMap.set(Number(p.empleado_id), p));

    const accountIds = [cuentas.diurna?.id, cuentas.nocturna?.id].filter(Boolean);
    if (pRows.length > 0 && accountIds.length > 0) {
        const [dRows] = await connection.query(
            `SELECT planilla_id, cuenta_id, valor_base FROM rh_planilla_detalles WHERE planilla_id IN (?) AND cuenta_id IN (?)`,
            [pRows.map(p => p.id), accountIds]
        );
        dRows.forEach(d => {
            if (!currentHoursMap.has(d.planilla_id)) currentHoursMap.set(d.planilla_id, { diurnas: 0, nocturnas: 0 });
            const entry = currentHoursMap.get(d.planilla_id);
            const hrs = Math.max(0, parseFloat(d.valor_base || 0));
            if (cuentas.diurna && Number(d.cuenta_id) === Number(cuentas.diurna.id)) entry.diurnas = hrs;
            if (cuentas.nocturna && Number(d.cuenta_id) === Number(cuentas.nocturna.id)) entry.nocturnas = hrs;
        });
    }
    return { planillaMap, currentHoursMap, periodoGenerado, periodoCerrado };
}

async function buildCortePreviewData(connection, companyId, corteId, { periodoAnio, periodoMes, quincena, separarNocturnas = true, incluirAvicola = true } = {}) {
    const [corteRows] = await connection.query(
        `SELECT * FROM rh_biometric_cortes WHERE id = ? AND company_id = ? AND estado = 'congelado' LIMIT 1`,
        [corteId, companyId]
    );
    if (!corteRows.length) throw payrollError(404, 'Corte biométrico congelado no encontrado.');

    const rawCorte = corteRows[0];
    const corte = { ...rawCorte, fecha_inicio: extractDateOnly(rawCorte.fecha_inicio), fecha_fin: extractDateOnly(rawCorte.fecha_fin) };

    const [saldos, nightMap, cuentas] = await Promise.all([
        loadCorteSaldosRows(connection, companyId, corteId),
        loadNightOvertimeMap(connection, companyId, corteId),
        resolveOvertimeAccounts(connection, companyId, { ensureCreate: false })
    ]);

    const empIds = [...new Set(saldos.map(s => Number(s.empleado_id)).filter(n => n > 0))];
    const empMap = new Map();
    if (empIds.length > 0) {
        const [empRows] = await connection.query(
            `SELECT id, codigo, nombres, apellidos, sueldo_base, bonificacion_fija, es_activo,
                    en_vacaciones, incapacitado, branch_id, departamento_personal_id, cargo_id
             FROM rh_empleados WHERE company_id = ? AND id IN (?)`,
            [companyId, empIds]
        );
        empRows.forEach(e => empMap.set(Number(e.id), e));
    }

    const { planillaMap, currentHoursMap, periodoGenerado, periodoCerrado } = await loadPeriodContext(
        connection, companyId, cuentas, { periodoAnio, periodoMes, quincena }
    );

    const rows = saldos.map(s => {
        const empId = s.empleado_id ? Number(s.empleado_id) : null;
        const emp = empId ? empMap.get(empId) : null;
        const plan = empId ? planillaMap.get(empId) : null;
        const curHrs = plan ? (currentHoursMap.get(plan.id) || { diurnas: 0, nocturnas: 0 }) : { diurnas: 0, nocturnas: 0 };
        const rawNight = (empId ? nightMap.byEmpId.get(empId) : null) ?? nightMap.byUid.get(String(s.device_uid || '').trim()) ?? 0;

        const split = resolvePositivePayableSplit(s, rawNight, { separarNocturnas, incluirAvicola });
        const sueldoBase = Number(emp?.sueldo_base) > 0 ? round2(emp.sueldo_base) : 0;
        const money = computeLegalOvertimeAmounts(sueldoBase, split.horasDiurnas, split.horasNocturnas);

        let estadoEmpleado = 'en_planilla';
        if (!emp) estadoEmpleado = 'sin_vincular';
        else if (!emp.es_activo) estadoEmpleado = 'inactivo';
        else if (plan?.estado === 'pagada') estadoEmpleado = 'pagada';
        else if (split.esNegativo) estadoEmpleado = 'saldo_negativo';
        else if (split.horasPagables <= 0) estadoEmpleado = 'sin_horas';
        else if (sueldoBase <= 0) estadoEmpleado = 'sin_sueldo';
        else if (Number(emp.en_vacaciones) === 1 || Number(emp.incapacitado) === 1) estadoEmpleado = 'ausente';
        else if (!plan) estadoEmpleado = 'sin_planilla';

        const elegible = Boolean(
            emp && emp.es_activo && sueldoBase > 0 && plan?.estado !== 'pagada'
            && split.horasPagables > 0 && (split.horasDiurnas + split.horasNocturnas) > 0
        );

        return {
            saldo_id: s.id || null,
            empleado_id: emp?.id || null,
            device_uid: String(s.device_uid || ''),
            codigo: emp?.codigo || String(s.device_uid || '---'),
            nombre: emp ? `${emp.nombres || ''} ${emp.apellidos || ''}`.trim() : (s.empleado_nombre || `UID ${s.device_uid}`),
            area: s.area || 'Producción',
            categoria: s.categoria || 'produccion',
            sueldo_base: sueldoBase,
            horas_extra_periodo: round2(s.horas_extra_periodo),
            horas_pendientes_anteriores: round2(s.horas_pendientes_anteriores),
            horas_extra_avicola: split.avicolaPositiva,
            saldo_neto: split.saldoNeto,
            horas_pagables: split.horasPagables,
            saldo_arrastre_siguiente: round2(s.saldo_arrastre_siguiente),
            horas_diurnas: split.horasDiurnas,
            horas_nocturnas: split.horasNocturnas,
            valor_hora_ordinaria: round4(money.valorHoraOrdinaria),
            tarifa_diurna: round4(money.tarifaDiurna),
            tarifa_nocturna: round4(money.tarifaNocturna),
            factor_diurna: LEGAL_FACTOR_DIURNA,
            factor_nocturna: LEGAL_FACTOR_NOCTURNA,
            monto_diurno: money.montoDiurno,
            monto_nocturno: money.montoNocturno,
            monto_total: money.montoTotal,
            es_saldo_negativo: split.esNegativo,
            planilla_id: plan?.id || null,
            planilla_estado: plan?.estado || null,
            horas_actuales_diurnas: round2(curHrs.diurnas),
            horas_actuales_nocturnas: round2(curHrs.nocturnas),
            estado_empleado: estadoEmpleado,
            elegible
        };
    });

    const eligibleRows = rows.filter(r => r.elegible);
    const summary = {
        total_colaboradores: rows.length,
        elegibles: eligibleRows.length,
        con_horas: rows.filter(r => r.horas_pagables > 0).length,
        saldos_negativos: rows.filter(r => r.estado_empleado === 'saldo_negativo').length,
        sin_horas: rows.filter(r => r.estado_empleado === 'sin_horas').length,
        sin_sueldo: rows.filter(r => r.estado_empleado === 'sin_sueldo').length,
        sin_vincular: rows.filter(r => r.estado_empleado === 'sin_vincular').length,
        inactivos: rows.filter(r => r.estado_empleado === 'inactivo').length,
        cerrados: rows.filter(r => r.estado_empleado === 'pagada').length,
        total_horas_avicola: round2(rows.reduce((s, r) => s + r.horas_extra_avicola, 0)),
        total_horas_pagables: round2(eligibleRows.reduce((s, r) => s + r.horas_pagables, 0)),
        total_horas_diurnas: round2(eligibleRows.reduce((s, r) => s + r.horas_diurnas, 0)),
        total_horas_nocturnas: round2(eligibleRows.reduce((s, r) => s + r.horas_nocturnas, 0)),
        total_monto_estimado: round2(eligibleRows.reduce((s, r) => s + r.monto_total, 0)),
        incluir_avicola: incluirAvicola,
        periodo_generado: periodoGenerado,
        periodo_cerrado: periodoCerrado,
        ley_calculo: {
            base_legal: 'Código de Trabajo SV (Arts. 140, 161, 168, 169)',
            factor_diurna: LEGAL_FACTOR_DIURNA,
            factor_nocturna: LEGAL_FACTOR_NOCTURNA
        }
    };

    return { corte, cuentas: { diurna: cuentas.diurna, nocturna: cuentas.nocturna }, rows, summary, _empMap: empMap };
}

async function listAvailableCortes(req, res, pool) {
    try {
        const [rows] = await pool.query(
            `SELECT c.*, COALESCE(u.nombre, u.username) as created_by_name
             FROM rh_biometric_cortes c LEFT JOIN users u ON u.id = c.created_by
             WHERE c.company_id = ? AND c.estado = 'congelado'
             ORDER BY c.fecha_fin DESC, c.id DESC`,
            [req.company_id]
        );
        res.json(rows.map(c => ({ ...c, fecha_inicio: extractDateOnly(c.fecha_inicio), fecha_fin: extractDateOnly(c.fecha_fin) })));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

async function previewBiometricCorte(req, res, pool) {
    try {
        const corteId = parseInt(req.params.corteId, 10);
        if (!corteId) return res.status(400).json({ message: 'ID de corte inválido.' });
        const { periodoAnio, periodoMes, quincena } = parseYearMonth(req.query.periodo_anio, req.query.periodo_mes, req.query.quincena);
        const separarNocturnas = parseBoolFlag(req.query.separar_nocturnas, true);
        const incluirAvicola = parseBoolFlag(req.query.incluir_avicola, true);
        const data = await buildCortePreviewData(pool, req.company_id, corteId, { periodoAnio, periodoMes, quincena, separarNocturnas, incluirAvicola });
        const { _empMap, ...payload } = data;
        res.json(payload);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
}

async function upsertOvertimeDetail(connection, planillaId, cuenta, targetHrs, sueldoBase, isNocturna) {
    const cleanHrs = Math.max(0, round2(targetHrs));
    const rates = computeLegalOvertimeRates(sueldoBase);
    const rate = isNocturna ? rates.tarifaNocturna : rates.tarifaDiurna;
    const monto = cleanHrs > 0 && rate > 0 ? round2(cleanHrs * rate) : 0;

    const [existing] = await connection.query(
        'SELECT id FROM rh_planilla_detalles WHERE planilla_id = ? AND cuenta_id = ? LIMIT 1',
        [planillaId, cuenta.id]
    );
    if (existing.length > 0) {
        await connection.query(
            'UPDATE rh_planilla_detalles SET valor_base = ?, valor_ingresado = ? WHERE id = ?',
            [cleanHrs || null, monto, existing[0].id]
        );
    } else if (cleanHrs > 0) {
        await connection.query(
            `INSERT INTO rh_planilla_detalles (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [planillaId, cuenta.id, cuenta.codigo, cuenta.descripcion, cuenta.operacion || 'sumar', cuenta.tipo_valor || 'horas', cleanHrs, monto, cuenta.orden || 0]
        );
    }
    return monto;
}

async function applyBiometricCorte(req, res, connection) {
    const corteId = parseInt(req.body.corte_id, 10);
    const { periodoAnio, periodoMes, quincena } = parseYearMonth(req.body.periodo_anio, req.body.periodo_mes, req.body.quincena);
    const modo = req.body.modo === 'sumar' ? 'sumar' : 'reemplazar';
    const separarNocturnas = parseBoolFlag(req.body.separar_nocturnas, true);
    const incluirAvicola = parseBoolFlag(req.body.incluir_avicola, true);
    const selectedIds = Array.isArray(req.body.empleado_ids) ? req.body.empleado_ids.map(Number).filter(n => n > 0) : null;

    if (!corteId || !periodoAnio || !periodoMes || !quincena) {
        return res.status(400).json({ message: 'corte_id, periodo_anio, periodo_mes y quincena son requeridos.' });
    }

    const [closedRows] = await connection.query(
        `SELECT id FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? AND estado = 'pagada' LIMIT 1`,
        [req.company_id, periodoAnio, periodoMes, quincena]
    );
    if (closedRows.length > 0) return res.status(409).json({ message: 'No se puede aplicar un corte de horas a un período pagado y cerrado.' });

    const [periodRows] = await connection.query(
        `SELECT id FROM ${TABLE} WHERE company_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ? LIMIT 1`,
        [req.company_id, periodoAnio, periodoMes, quincena]
    );
    if (periodRows.length === 0) return res.status(400).json({ message: 'Primero debe generar la planilla del período antes de importar un corte de horas.' });

    const cuentas = await resolveOvertimeAccounts(connection, req.company_id, { ensureCreate: true });
    const preview = await buildCortePreviewData(connection, req.company_id, corteId, { periodoAnio, periodoMes, quincena, separarNocturnas, incluirAvicola });

    const idSet = selectedIds && selectedIds.length > 0 ? new Set(selectedIds) : null;
    const omittedNonPositiveCount = preview.rows.filter(r => r.saldo_neto <= 0 && r.horas_pagables <= 0).length;
    const targets = preview.rows.filter(
        r => r.elegible && r.horas_pagables > 0 && (r.horas_diurnas + r.horas_nocturnas) > 0 && r.sueldo_base > 0 && r.monto_total > 0 && (!idSet || idSet.has(r.empleado_id))
    );
    if (targets.length === 0) {
        return res.status(400).json({
            message: 'No hay colaboradores elegibles con horas extra positivas (> 0) para cargar. Los saldos negativos se conservan como arrastre en Marcador Digital.'
        });
    }

    let appliedCount = 0;
    let createdPayrollsCount = 0;
    let totalHorasDiurnas = 0;
    let totalHorasNocturnas = 0;
    let totalMonto = 0;

    for (const item of targets) {
        const emp = preview._empMap.get(item.empleado_id);
        let planillaId = item.planilla_id;
        if (!planillaId) {
            const absent = Number(emp.en_vacaciones) === 1 || Number(emp.incapacitado) === 1;
            const days = absent ? 0 : 15;
            const salary = parseFloat(emp.sueldo_base || 0);
            const bonus = parseFloat(emp.bonificacion_fija || 0);
            const [ins] = await connection.query(
                `INSERT INTO ${TABLE} (company_id, empleado_id, periodo_anio, periodo_mes, quincena, dias_trabajados, sueldo_base, bonificacion_fija, branch_id, departamento_personal_id, cargo_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [req.company_id, emp.id, periodoAnio, periodoMes, quincena, days, salary, bonus, emp.branch_id || null, emp.departamento_personal_id || null, emp.cargo_id || null]
            );
            planillaId = ins.insertId;
            await cargarCuentasPorDefecto(connection, planillaId, req.company_id, days, salary, emp.id, quincena, bonus);
            if (absent) await connection.query('UPDATE rh_planilla_detalles SET valor_base = 0, valor_ingresado = 0 WHERE planilla_id = ?', [planillaId]);
            createdPayrollsCount++;
        }

        const baseDiurna = Math.max(0, item.horas_actuales_diurnas);
        const baseNocturna = Math.max(0, item.horas_actuales_nocturnas);
        const targetDiurna = modo === 'sumar' ? round2(baseDiurna + item.horas_diurnas) : item.horas_diurnas;
        const targetNocturna = modo === 'sumar' ? round2(baseNocturna + item.horas_nocturnas) : item.horas_nocturnas;
        if (targetDiurna <= 0 && targetNocturna <= 0) continue;

        let empMonto = 0;
        if (cuentas.diurna && (modo === 'reemplazar' || item.horas_diurnas > 0)) {
            empMonto += await upsertOvertimeDetail(connection, planillaId, cuentas.diurna, targetDiurna, emp.sueldo_base, false);
        }
        if (cuentas.nocturna && (modo === 'reemplazar' || item.horas_nocturnas > 0)) {
            empMonto += await upsertOvertimeDetail(connection, planillaId, cuentas.nocturna, targetNocturna, emp.sueldo_base, true);
        }

        await recalculateSavedPlanilla(connection, req.company_id, planillaId);
        appliedCount++;
        totalHorasDiurnas = round2(totalHorasDiurnas + item.horas_diurnas);
        totalHorasNocturnas = round2(totalHorasNocturnas + item.horas_nocturnas);
        totalMonto = round2(totalMonto + (modo === 'reemplazar' ? empMonto : item.monto_total));
    }

    await connection.query(
        `UPDATE rh_biometric_cortes SET planilla_anio = ?, planilla_mes = ?, planilla_quincena = ?, aplicado_planilla_at = NOW(), aplicado_planilla_by = ?
         WHERE id = ? AND company_id = ?`,
        [periodoAnio, periodoMes, quincena, req.user?.id || null, corteId, req.company_id]
    );

    const periodoLabel = `${MESES[periodoMes] || periodoMes} ${periodoAnio} (${quincena === 'primera' ? '1ra' : '2da'} Quincena)`;
    res.json({
        success: true,
        corte_id: corteId,
        corte_nombre: preview.corte.nombre,
        applied_count: appliedCount,
        omitted_non_positive_count: omittedNonPositiveCount,
        created_payrolls_count: createdPayrollsCount,
        skipped_count: preview.rows.length - appliedCount,
        total_horas_diurnas: totalHorasDiurnas,
        total_horas_nocturnas: totalHorasNocturnas,
        total_monto: totalMonto,
        message: `Corte "${preview.corte.nombre}" aplicado a ${appliedCount} colaborador(es) con saldo positivo en ${periodoLabel} (${totalHorasDiurnas}h diurnas 2.0x, ${totalHorasNocturnas}h nocturnas 2.5x).`
    });
}

async function releasePayrollBiometricCortes(connection, companyId, periodoAnio, periodoMes, quincena) {
    const [cols] = await connection.query(
        `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rh_biometric_cortes' AND COLUMN_NAME = 'planilla_anio'`
    );
    if (!cols.length) return;
    await connection.query(
        `UPDATE rh_biometric_cortes
         SET planilla_anio = NULL, planilla_mes = NULL, planilla_quincena = NULL, aplicado_planilla_at = NULL, aplicado_planilla_by = NULL
         WHERE company_id = ? AND planilla_anio = ? AND planilla_mes = ? AND planilla_quincena = ?`,
        [companyId, periodoAnio, periodoMes, quincena]
    );
}

module.exports = {
    resolveOvertimeAccounts,
    buildCortePreviewData,
    listAvailableCortes,
    previewBiometricCorte,
    applyBiometricCorte,
    releasePayrollBiometricCortes
};
