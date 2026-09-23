const {
    pool,
    nodemailer,
    broadcastToCompany,
    notificationService,
    eggExportService,
    eggReportsExportService,
    eggQualityLetterExport,
    eggRawMaterialLabReport,
    eggOriginCertificate,
    reportPdfHelper,
    excelService,
    resolveEggCatalogProduct,
    safeNum,
    safeInt,
    computeJulianLotCode,
    ensureEggSchema
} = require('./eggUtils');


// --- CIP LOGS ---
const getCipLogs = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM egg_cip_logs WHERE company_id = ? ORDER BY created_at DESC`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createCipLog = async (req, res) => {
    try {
        const { equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes } = req.body;
        const [result] = await pool.query(
            `INSERT INTO egg_cip_logs (company_id, equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.company_id, equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes]
        );

        // Crear evento
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'cip.completed', ?, ?, ?, ?)`,
            [req.company_id, validation_status === 'completado' ? 'info' : 'warning', `Sanitización CIP en equipo ${equipment_name} registrada con estado: ${validation_status}.`, JSON.stringify({ cip_id: result.insertId, equipment_name }), operator_name]
        );

        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// --- CIP QUICK SANITIZE & PRODUCTION BATCHES & PASTEURIZATION ---
const quickSanitizeCip = async (req, res) => {
    try {
        const { operator_name, notes } = req.body;
        const [result] = await pool.query(
            `INSERT INTO egg_cip_logs (company_id, equipment_name, chemical_used, temperature_c, duration_minutes, operator_name, validation_status, notes)
             VALUES (?, 'pasteurizador', 'Ácido Peracético 1.5% (Sanitización Express)', 78.50, 45, ?, 'completado', ?)`,
            [
                req.company_id,
                operator_name || req.user?.nombre || 'Operador de Planta',
                notes || 'Sanitización CIP express validada y aprobada para inicio de turno de producción.'
            ]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'cip.completed', 'info', ?, ?, ?)`,
            [
                req.company_id,
                'Sanitización CIP express en pasteurizador validada y completada.',
                JSON.stringify({ cip_id: result.insertId, equipment_name: 'pasteurizador' }),
                operator_name || req.user?.nombre || 'Operador de Planta'
            ]
        );

        res.status(201).json({ success: true, id: result.insertId, message: 'Sanitización CIP express registrada y aprobada.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3. LOTES DE PRODUCCIÓN
const getProductionBatches = async (req, res) => {
    try {
        await ensureEggSchema();
        let rows = [];
        try {
            const [queriedRows] = await pool.query(
                `SELECT b.*, esp.lot_code as scheduled_lot_code, esp.production_date as scheduled_production_date
                 FROM egg_production_batches b
                 LEFT JOIN egg_scheduled_productions esp ON b.scheduled_production_id = esp.id
                 WHERE b.company_id = ? 
                 ORDER BY b.started_at DESC`,
                [req.company_id]
            );
            rows = queriedRows;
        } catch (queryErr) {
            console.warn("[getProductionBatches] Query with join failed, falling back to direct batches query:", queryErr.message);
            const [fallbackRows] = await pool.query(
                `SELECT b.* FROM egg_production_batches b
                 WHERE b.company_id = ? 
                 ORDER BY b.started_at DESC`,
                [req.company_id]
            );
            rows = fallbackRows;
        }

        for (const batch of rows) {
            const [materials] = await pool.query(
                `SELECT brm.*, rm.egg_type, rm.provider_lot, rm.egg_color, rm.egg_size
                 FROM batch_raw_materials brm
                 JOIN egg_raw_materials rm ON brm.raw_material_id = rm.id
                 WHERE brm.batch_id = ?`,
                [batch.id]
            );
            for (const m of materials) {
                if (m.tarimas_json && typeof m.tarimas_json === 'string') {
                    try { m.tarimas = JSON.parse(m.tarimas_json); } catch (e) { m.tarimas = []; }
                } else {
                    m.tarimas = m.tarimas_json || [];
                }
            }
            batch.raw_materials = materials;

            const [pkgSum] = await pool.query(
                'SELECT COALESCE(SUM(total_batch_weight_lbs), 0) as packaged_weight FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
                [batch.id, req.company_id]
            );
            batch.packaged_weight_lbs = pkgSum[0].packaged_weight;

            const [varCosts] = await pool.query(
                'SELECT * FROM egg_batch_variable_costs WHERE batch_id = ? AND company_id = ?',
                [batch.id, req.company_id]
            );
            batch.variable_costs = varCosts;

            const [remanentes] = await pool.query(
                'SELECT * FROM egg_batch_remanentes WHERE target_batch_id = ? AND company_id = ?',
                [batch.id, req.company_id]
            );
            batch.remanentes_used = remanentes;
        }

        res.json(rows);
    } catch (error) {
        console.error("Error in getProductionBatches:", error);
        res.status(500).json({ message: error.message });
    }
};

const createProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { product_type, presentation, raw_materials, operator_name } = req.body;
        const company_id = req.company_id;
        const branch_id = req.body.branch_id || 1;

        if (!raw_materials || !Array.isArray(raw_materials) || raw_materials.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos una materia prima.' });
        }

        const totalInputWeight = raw_materials.reduce((sum, rm) => sum + parseFloat(rm.quantity_lbs || 0), 0);
        if (totalInputWeight <= 0) {
            return res.status(400).json({ message: 'El peso total de entrada debe ser mayor a cero.' });
        }

        // --- REGLA CRÍTICA INDUSTRIAL: VALIDAR CIP RECIENTE O EXCEPCIÓN AUTORIZADA ---
        const [cipLogs] = await connection.query(
            `SELECT id FROM egg_cip_logs 
             WHERE company_id = ? AND equipment_name = 'pasteurizador' 
               AND validation_status = 'completado'
               AND created_at >= NOW() - INTERVAL 12 HOUR`,
            [company_id]
        );

        const bypassCip = req.body.bypass_cip_check === true || req.body.bypass_cip_check === 'true';

        if (cipLogs.length === 0 && !bypassCip) {
            await connection.rollback();
            return res.status(400).json({
                message: 'BLOQUEO DE INOCUIDAD: El pasteurizador no cuenta con una limpieza CIP aprobada en las últimas 12 horas. Puede autorizar el inicio bajo excepción operativa o registrar la sanitización CIP.',
                can_bypass: true
            });
        }

        // Validate stock availability and MANDATORY APPROVAL STATUS for each raw material
        for (const rm of raw_materials) {
            const [rows] = await connection.query(
                'SELECT id, stock_lbs, total_boxes, egg_type, provider_lot, status FROM egg_raw_materials WHERE id = ? AND company_id = ? FOR UPDATE',
                [rm.raw_material_id, company_id]
            );
            if (rows.length === 0) {
                await connection.rollback();
                return res.status(400).json({ message: `Materia prima #${rm.raw_material_id} no encontrada.` });
            }

            // --- REGLA CRÍTICA DE INOCUIDAD: SOLO MATERIA PRIMA APROBADA ---
            if (rows[0].status !== 'aprobado') {
                await connection.rollback();
                const statusLabel = rows[0].status === 'pendiente_aprobacion'
                    ? 'Pendiente de Aprobación'
                    : (rows[0].status ? rows[0].status.toUpperCase() : 'NO APROBADO');
                return res.status(400).json({
                    message: `BLOQUEO DE INOCUIDAD: El lote de materia prima ${rows[0].provider_lot || '#' + rows[0].id} (${rows[0].egg_type}) no puede ser utilizado porque se encuentra en estado "${statusLabel}". Se requiere que el lote esté APROBADO por Control de Calidad antes de iniciar producción.`
                });
            }
            const currentStock = parseFloat(rows[0].stock_lbs || 0);
            if (currentStock <= 0.01) {
                await connection.rollback();
                return res.status(400).json({
                    message: `El lote ${rows[0].provider_lot} (${rows[0].egg_type}) ya está 100% agotado y no tiene saldo disponible.`
                });
            }
            if (currentStock < parseFloat(rm.quantity_lbs)) {
                await connection.rollback();
                return res.status(400).json({
                    message: `Stock insuficiente para lote ${rows[0].provider_lot} (disponible: ${currentStock.toFixed(2)} Lbs, solicitado: ${parseFloat(rm.quantity_lbs).toFixed(2)} Lbs).`
                });
            }
        }

        const batch_uuid = require('crypto').randomUUID();

        // Generar Nomenclatura Oficial ANDELSA: [Corrida] - [Día Juliano] - [Año 2 dígitos] (ej. 01 - 245 - 26)
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 0);
        const diff = now - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        const dayOfYearStr = String(dayOfYear).padStart(3, '0');
        const year2Digit = String(now.getFullYear()).slice(-2);

        // Consultar corridas registradas para este día juliano/año para autoincrementar correlativo de forma única
        const [existingRuns] = await connection.query(
            `SELECT batch_code_display FROM egg_production_batches 
             WHERE company_id = ? AND (
                DATE(started_at) = CURDATE() OR 
                batch_code_display LIKE ?
             )`,
            [company_id, `% - ${dayOfYearStr} - ${year2Digit}`]
        );

        let maxRun = 0;
        for (const b of existingRuns) {
            if (b.batch_code_display) {
                const parts = b.batch_code_display.split(' - ');
                if (parts.length === 3) {
                    const num = parseInt(parts[0], 10);
                    if (!isNaN(num) && num > maxRun) maxRun = num;
                }
            }
        }

        let chosenRun = maxRun + 1;
        if (req.body.run_number) {
            const userRun = parseInt(req.body.run_number, 10);
            const userCode = `${String(userRun).padStart(2, '0')} - ${dayOfYearStr} - ${year2Digit}`;
            const collision = existingRuns.some(b => b.batch_code_display === userCode);
            if (!isNaN(userRun) && userRun > 0 && !collision) {
                chosenRun = userRun;
            }
        }

        const runNumber = String(chosenRun).padStart(2, '0');
        const batch_code_display = `${runNumber} - ${dayOfYearStr} - ${year2Digit}`;

        const resolvedProductType = Array.isArray(product_type)
            ? product_type.join(', ')
            : (product_type || 'huevo entero');

        const resolvedPresentation = Array.isArray(presentation)
            ? presentation.join(', ')
            : (presentation || 'cubeta 30LB');

        const { ingredients_json, target_brix, target_solids_pct } = req.body;
        const scheduled_production_id = req.body.scheduled_production_id ? parseInt(req.body.scheduled_production_id, 10) : null;

        let batchId;
        try {
            const [result] = await connection.query(
                `INSERT INTO egg_production_batches (
                    company_id, branch_id, batch_uuid, batch_code_display, scheduled_production_id, product_type, 
                    presentation, ingredients_json, status, input_weight_lbs, 
                    target_brix, target_solids_pct, operator_name
                ) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'en_proceso', ?, ?, ?, ?)`,
                [
                    company_id, branch_id, batch_uuid, batch_code_display, scheduled_production_id, resolvedProductType,
                    resolvedPresentation, JSON.stringify(ingredients_json || {}), totalInputWeight,
                    target_brix || null, target_solids_pct || null, operator_name
                ]
            );
            batchId = result.insertId;
        } catch (insertErr) {
            console.warn("[createProductionBatch] Primary insert failed, falling back without scheduled_production_id:", insertErr.message);
            const [result] = await connection.query(
                `INSERT INTO egg_production_batches (
                    company_id, branch_id, batch_uuid, batch_code_display, product_type, 
                    presentation, ingredients_json, status, input_weight_lbs, 
                    target_brix, target_solids_pct, operator_name
                ) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'en_proceso', ?, ?, ?, ?)`,
                [
                    company_id, branch_id, batch_uuid, batch_code_display, resolvedProductType,
                    resolvedPresentation, JSON.stringify(ingredients_json || {}), totalInputWeight,
                    target_brix || null, target_solids_pct || null, operator_name
                ]
            );
            batchId = result.insertId;
        }

        // Vincular remanentes utilizados en esta producción
        const rawRemIds = req.body.remanente_ids || (Array.isArray(req.body.remanentes) ? req.body.remanentes.map(r => r.id || r) : []);
        const remanenteIds = (Array.isArray(rawRemIds) ? rawRemIds : []).map(r => parseInt(r, 10)).filter(r => !isNaN(r) && r > 0);
        if (remanenteIds.length > 0) {
            for (const remId of remanenteIds) {
                try {
                    await connection.query(
                        `UPDATE egg_batch_remanentes 
                         SET status = 'asignado_a_lote', target_batch_id = ?, updated_at = NOW() 
                         WHERE id = ? AND company_id = ?`,
                        [batchId, remId, company_id]
                    );
                } catch (remErr) {
                    console.warn("[createProductionBatch] Update remanente notice:", remErr.message);
                }
            }
        }

        // Insert batch_raw_materials and deduct stock (with tarimas breakdown support)
        for (const rm of raw_materials) {
            const qty = parseFloat(rm.quantity_lbs || 0);
            const boxes = parseInt(rm.boxes_count || rm.total_boxes || 0, 10);
            const tarimasJson = rm.tarimas && Array.isArray(rm.tarimas) ? JSON.stringify(rm.tarimas) : (rm.tarimas_json || null);

            try {
                await connection.query(
                    'INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, tarimas_json, boxes_count) VALUES (?, ?, ?, ?, ?)',
                    [batchId, rm.raw_material_id, qty, tarimasJson, boxes]
                );
            } catch (brmErr) {
                console.warn("[createProductionBatch] Insert into batch_raw_materials with tarimas failed, falling back:", brmErr.message);
                await connection.query(
                    'INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs) VALUES (?, ?, ?)',
                    [batchId, rm.raw_material_id, qty]
                );
            }

            if (boxes > 0) {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = GREATEST(0, stock_lbs - ?), total_boxes = GREATEST(0, total_boxes - ?) WHERE id = ? AND company_id = ?',
                    [qty, boxes, rm.raw_material_id, req.company_id]
                );
            } else {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = GREATEST(0, stock_lbs - ?) WHERE id = ? AND company_id = ?',
                    [qty, rm.raw_material_id, req.company_id]
                );
            }
        }

        // Si se vinculó a una producción programada del calendario, actualizar su estado y registrar evento
        if (scheduled_production_id) {
            try {
                await connection.query(
                    'UPDATE egg_scheduled_productions SET batch_id = ?, status = "en_proceso" WHERE id = ? AND company_id = ?',
                    [batchId, scheduled_production_id, company_id]
                );

                await connection.query(
                    `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                     VALUES (?, 'batch.linked_to_schedule', 'info', ?, ?, ?)`,
                    [
                        company_id,
                        `Lote ${batch_code_display} vinculado a la producción programada #${scheduled_production_id}.`,
                        JSON.stringify({ batch_id: batchId, scheduled_production_id, batch_code_display }),
                        operator_name
                    ]
                );
            } catch (schedErr) {
                console.warn("[createProductionBatch] Update egg_scheduled_productions notice:", schedErr.message);
            }
        }

        // Crear evento
        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.started', 'info', ?, ?, ?)`,
            [
                company_id,
                `Iniciado lote oficial ${batch_code_display} (${product_type} - ${presentation}) con ${totalInputWeight} LBS.`,
                JSON.stringify({ batch_id: batchId, batch_uuid, batch_code_display, totalInputWeight, raw_materials }),
                operator_name
            ]
        );

        if (cipLogs.length === 0 && bypassCip) {
            await connection.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                 VALUES (?, 'batch.cip_bypassed', 'warning', ?, ?, ?)`,
                [
                    company_id,
                    `Inicio de lote oficial ${batch_code_display} autorizado bajo excepción: sin verificación previa de sanitización CIP en pasteurizador.`,
                    JSON.stringify({ batch_id: batchId, batch_uuid, batch_code_display, operator: operator_name }),
                    operator_name
                ]
            );
        }

        await connection.commit();

        notificationService.notify('production_batch_created', req.company_id, req.body.branch_id || 1, {
            lote_id: batchId,
            producto: product_type || '',
            cantidad: totalInputWeight || 0,
            fecha: new Date().toISOString().split('T')[0],
            sucursal: ''
        }).catch(() => { });

        res.status(201).json({
            id: batchId,
            batch_uuid,
            batch_code_display,
            product_type: resolvedProductType,
            presentation: resolvedPresentation,
            status: 'en_proceso',
            totalInputWeight
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

const completeProductionBatch = async (req, res) => {
    try {
        const { id } = req.params;
        const { yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs } = req.body;

        // Traer datos del lote
        const [batches] = await pool.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?', [id, req.company_id]);
        if (batches.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });
        const batch = batches[0];

        // Cambiar estado a aprobado_calidad o mantener bloqueado_haccp
        const nextStatus = batch.status === 'bloqueado_haccp' ? 'bloqueado_haccp' : 'aprobado_calidad';

        await pool.query(
            `UPDATE egg_production_batches 
             SET yield_liquid_lbs = ?, waste_shell_lbs = ?, waste_loss_lbs = ?, status = ?, completed_at = NOW()
             WHERE id = ? AND company_id = ?`,
            [yield_liquid_lbs, waste_shell_lbs, waste_loss_lbs, nextStatus, id, req.company_id]
        );

        // Crear evento
        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.completed', 'info', ?, ?, ?)`,
            [req.company_id, `Lote de producción completado. Rendimiento líquido: ${yield_liquid_lbs} LBS, Desperdicio cáscara: ${waste_shell_lbs} LBS.`, JSON.stringify({ batch_id: id, yield_liquid_lbs, waste_shell_lbs }), batch.operator_name]
        );

        const inputWeight = parseFloat(batch.input_weight_lbs || 0);
        const yieldPct = inputWeight > 0 ? Math.round((parseFloat(yield_liquid_lbs || 0) / inputWeight) * 10000) / 100 : 0;
        notificationService.notify('production_batch_completed', req.company_id, req.user?.branch_id, {
            lote_id: parseInt(id),
            producto: batch.product_type || '',
            cantidad: inputWeight,
            rendimiento: yieldPct,
            duracion: 0
        }).catch(() => { });

        res.json({ id, status: nextStatus, yield_liquid_lbs });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. PASTEURIZACIÓN (CRÍTICO HACCP)
const createPasteurizationLog = async (req, res) => {
    try {
        const { batch_id, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, operator_name } = req.body;
        const company_id = req.company_id;

        // Obtener el lote para saber el tipo de producto
        const [batches] = await pool.query('SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?', [batch_id, company_id]);
        if (batches.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });
        const batch = batches[0];

        // --- VALIDACIÓN DE PARÁMETROS CRÍTICOS HACCP (PCC) ---
        let haccp_compliant = true;
        let deviation_description = null;

        // Reglas de temperatura HACCP estándar por tipo de producto:
        // Huevo entero: >= 64.0 C
        // Clara: >= 56.5 C
        // Yemas/Fórmulas: >= 65.0 C
        if (batch.product_type === 'huevo entero' && temperature_c < 64.0) {
            haccp_compliant = false;
            deviation_description = `Temperatura de pasteurización inferior a 64.0C (Lectura: ${temperature_c}C) para Huevo Entero.`;
        } else if (batch.product_type === 'clara' && temperature_c < 56.5) {
            haccp_compliant = false;
            deviation_description = `Temperatura de pasteurización inferior a 56.5C (Lectura: ${temperature_c}C) para Clara.`;
        } else if (batch.product_type.includes('yema') && temperature_c < 65.0) {
            haccp_compliant = false;
            deviation_description = `Temperatura de pasteurización inferior a 65.0C (Lectura: ${temperature_c}C) para Yema.`;
        }

        // Si el tiempo de retención es insuficiente
        if (holding_time_seconds < 200) {
            haccp_compliant = false;
            deviation_description = (deviation_description ? deviation_description + ' ' : '') + `Tiempo de retención insuficiente (${holding_time_seconds}s de mínimo 200s).`;
        }

        // Insertar log
        const [result] = await pool.query(
            `INSERT INTO egg_pasteurization_logs (company_id, batch_id, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, haccp_compliant, deviation_description, operator_name) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [company_id, batch_id, temperature_c, holding_time_seconds, pressure_psi, flow_rate_gpm, haccp_compliant, deviation_description, operator_name]
        );

        if (!haccp_compliant) {
            // --- BLOQUEO AUTOMÁTICO DE LOTE ---
            await pool.query(
                `UPDATE egg_production_batches SET status = 'bloqueado_haccp' WHERE id = ? AND company_id = ?`,
                [batch_id, company_id]
            );

            // Crear evento crítico
            await pool.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
                 VALUES (?, 'haccp.failure', 'critical', ?, ?, ?)`,
                [company_id, `ALERTA HACCP: Lote ${batch.batch_uuid} ha sido BLOQUEADO automáticamente debido a desviaciones críticas en pasteurización.`, JSON.stringify({ batch_id, temperature_c, holding_time_seconds, deviation_description }), operator_name]
            );

            // Emitir por WebSocket
            broadcastToCompany(company_id, 'haccp_alert', {
                message: `ALERTA DE SEGURIDAD ALIMENTARIA: Desviación HACCP en pasteurización. Lote ${batch.batch_uuid} BLOQUEADO automáticamente. ${deviation_description}`,
                temp: temperature_c,
                batchUuid: batch.batch_uuid
            });
        } else {
            // Actualizar lote si todo va bien y estaba en proceso
            if (batch.status === 'en_proceso') {
                await pool.query(
                    `UPDATE egg_production_batches SET status = 'pasteurizado' WHERE id = ? AND company_id = ?`,
                    [batch_id, company_id]
                );
            }
        }

        res.status(201).json({ id: result.insertId, haccp_compliant, deviation_description, batchStatus: haccp_compliant ? 'pasteurizado' : 'bloqueado_haccp' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 5. HOLDING & CADENA DE FRÍO
const getHoldingTemperatures = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM egg_holding_temperatures WHERE company_id = ? ORDER BY created_at DESC LIMIT 50`,
            [req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createHoldingTemperature = async (req, res) => {
    try {
        const { tank_id, temperature_c, humidity_percentage } = req.body;
        const company_id = req.company_id;

        // Regla: Cadena de frío debe estar entre 2.0 y 6.0 grados Celsius
        let alarm_triggered = false;
        let alarm_reason = null;

        if (temperature_c < 2.0 || temperature_c > 6.0) {
            alarm_triggered = true;
            alarm_reason = `Temperatura de ${temperature_c}C fuera del rango crítico industrial de 2.0C a 6.0C.`;
        }

        const [result] = await pool.query(
            `INSERT INTO egg_holding_temperatures (company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [company_id, tank_id, temperature_c, humidity_percentage, alarm_triggered, alarm_reason]
        );

        if (alarm_triggered) {
            // Registrar evento de advertencia
            await pool.query(
                `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload)
                 VALUES (?, 'temperature.alert', 'warning', ?, ?)`,
                [company_id, `Desviación en cadena de frío: ${tank_id} reporta ${temperature_c}C.`, JSON.stringify({ tank_id, temperature_c, limit: '2.0C a 6.0C' })]
            );

            // Broadcast websocket
            broadcastToCompany(company_id, 'tank_alert', {
                tankId: tank_id,
                temp: temperature_c,
                message: `ALERTA DE TEMPERATURA: El tanque ${tank_id} ha registrado ${temperature_c}°C, saliendo del límite establecido.`
            });
        }

        res.status(201).json({ id: result.insertId, alarm_triggered, alarm_reason });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 6. EMPAQUE

// --- MEJORAS INTEGRALES: GESTIÓN DE LOTES, TARIMAS, ETAPAS, MERMAS Y REMANENTES ---
const updateProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;

        const [existing] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ? FOR UPDATE',
            [id, company_id]
        );
        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote de producción no encontrado.' });
        }

        const {
            product_type,
            presentation,
            operator_name,
            target_brix,
            target_solids_pct,
            notes,
            ingredients,
            ingredients_json,
            raw_materials
        } = req.body;

        let inputWeightLbs = existing[0].input_weight_lbs;
        if (Array.isArray(raw_materials) && raw_materials.length > 0) {
            // Verificar que toda materia prima vinculada esté aprobada
            for (const rm of raw_materials) {
                if (rm.raw_material_id) {
                    const [rmCheck] = await connection.query('SELECT status, provider_lot, egg_type FROM egg_raw_materials WHERE id = ?', [rm.raw_material_id]);
                    if (rmCheck.length > 0 && rmCheck[0].status !== 'aprobado') {
                        await connection.rollback();
                        const statusLabel = rmCheck[0].status === 'pendiente_aprobacion' ? 'Pendiente de Aprobación' : (rmCheck[0].status || 'NO APROBADO');
                        return res.status(400).json({
                            message: `BLOQUEO DE INOCUIDAD: El lote de materia prima ${rmCheck[0].provider_lot || '#' + rm.raw_material_id} (${rmCheck[0].egg_type}) no está aprobado (estado actual: "${statusLabel}"). Se requiere un lote en estado APROBADO para producción.`
                        });
                    }
                }
            }

            const calculatedTotal = raw_materials.reduce((sum, rm) => sum + parseFloat(rm.quantity_lbs || 0), 0);
            if (calculatedTotal > 0) {
                inputWeightLbs = calculatedTotal;
            }

            // Revertir consumos previos de este batch para recalcular limpiamente si está en proceso
            if (existing[0].status === 'en_proceso' || existing[0].status === 'quebraje') {
                const [oldBrm] = await connection.query(
                    'SELECT * FROM batch_raw_materials WHERE batch_id = ?',
                    [id]
                );
                for (const ob of oldBrm) {
                    await connection.query(
                        'UPDATE egg_raw_materials SET stock_lbs = stock_lbs + ? WHERE id = ?',
                        [parseFloat(ob.quantity_lbs || 0), ob.raw_material_id]
                    );
                }
                await connection.query('DELETE FROM batch_raw_materials WHERE batch_id = ?', [id]);

                // Insertar nuevas materias primas y descontar stock
                for (const rm of raw_materials) {
                    const qtyLbs = parseFloat(rm.quantity_lbs || 0);
                    if (qtyLbs > 0 && rm.raw_material_id) {
                        await connection.query(
                            'UPDATE egg_raw_materials SET stock_lbs = GREATEST(0, stock_lbs - ?) WHERE id = ?',
                            [qtyLbs, rm.raw_material_id]
                        );
                        await connection.query(
                            `INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, boxes_count, tarimas_json)
                             VALUES (?, ?, ?, ?, ?)`,
                            [id, rm.raw_material_id, qtyLbs, parseInt(rm.boxes_count || 0), JSON.stringify(rm.tarimas || [])]
                        );
                    }
                }
            }
        }

        const resolvedProductType = product_type !== undefined
            ? (Array.isArray(product_type) ? product_type.join(', ') : product_type)
            : existing[0].product_type;

        const resolvedPresentation = presentation !== undefined
            ? (Array.isArray(presentation) ? presentation.join(', ') : presentation)
            : existing[0].presentation;

        const resolvedIngredients = ingredients
            ? JSON.stringify(ingredients)
            : (ingredients_json
                ? (typeof ingredients_json === 'string' ? ingredients_json : JSON.stringify(ingredients_json))
                : existing[0].ingredients_json);

        await connection.query(
            `UPDATE egg_production_batches 
             SET product_type = COALESCE(?, product_type),
                 presentation = COALESCE(?, presentation),
                 operator_name = COALESCE(?, operator_name),
                 target_brix = ?,
                 target_solids_pct = ?,
                 notes = COALESCE(?, notes),
                 ingredients_json = ?,
                 input_weight_lbs = ?
             WHERE id = ? AND company_id = ?`,
            [
                resolvedProductType, resolvedPresentation, operator_name,
                target_brix || null, target_solids_pct || null,
                notes, resolvedIngredients, inputWeightLbs, id, company_id
            ]
        );

        // Sincronizar remanentes vinculados a este lote
        if (req.body.remanente_ids !== undefined) {
            const rawRemIds = Array.isArray(req.body.remanente_ids) ? req.body.remanente_ids : [];
            const cleanRemIds = rawRemIds.map(r => parseInt(r, 10)).filter(r => !isNaN(r) && r > 0);

            if (cleanRemIds.length > 0) {
                // Liberar remanentes que estaban asignados y ahora se desmarcaron
                await connection.query(
                    `UPDATE egg_batch_remanentes 
                     SET status = 'disponible', target_batch_id = NULL, updated_at = NOW()
                     WHERE target_batch_id = ? AND company_id = ? AND id NOT IN (?)`,
                    [id, company_id, cleanRemIds]
                );
                // Marcar los remanentes seleccionados como asignados a este lote
                await connection.query(
                    `UPDATE egg_batch_remanentes 
                     SET status = 'asignado_a_lote', target_batch_id = ?, updated_at = NOW()
                     WHERE id IN (?) AND company_id = ?`,
                    [id, cleanRemIds, company_id]
                );
            } else {
                // Si se enviaron remanentes vacíos, desvincular todos los asignados a este lote
                await connection.query(
                    `UPDATE egg_batch_remanentes 
                     SET status = 'disponible', target_batch_id = NULL, updated_at = NOW()
                     WHERE target_batch_id = ? AND company_id = ?`,
                    [id, company_id]
                );
            }
        }

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.updated', 'info', ?, ?, ?)`,
            [
                company_id,
                `Lote de producción #${id} (${existing[0].batch_code_display || existing[0].batch_uuid}) actualizado.`,
                JSON.stringify({ batch_id: parseInt(id), updates: req.body }),
                operator_name || req.user?.nombre || 'Sistema'
            ]
        );

        await connection.commit();
        res.json({ success: true, message: 'Lote de producción actualizado exitosamente.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in updateProductionBatch:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

// 3.2 Eliminar / Anular Lote de Producción con reversión de materia prima
const deleteProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;

        const [existing] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (existing.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote de producción no encontrado.' });
        }
        const batch = existing[0];

        // Verificar si ya tiene empaque registrado
        const [pkgRecords] = await connection.query(
            'SELECT COUNT(*) as count FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
            [id, company_id]
        );
        if (pkgRecords[0]?.count > 0 && req.query.force !== 'true') {
            await connection.rollback();
            return res.status(400).json({
                message: `No se puede eliminar el lote porque ya cuenta con ${pkgRecords[0].count} registro(s) de envasado comercial. Elimine primero el envasado o use eliminación forzada.`
            });
        }

        // Revertir materias primas consumidas a egg_raw_materials
        const [materials] = await connection.query(
            'SELECT * FROM batch_raw_materials WHERE batch_id = ?',
            [id]
        );
        for (const rm of materials) {
            const qty = parseFloat(rm.quantity_lbs || 0);
            const boxes = parseInt(rm.boxes_count || 0, 10);
            if (boxes > 0) {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = stock_lbs + ?, total_boxes = total_boxes + ? WHERE id = ? AND company_id = ?',
                    [qty, boxes, rm.raw_material_id, company_id]
                );
            } else {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = stock_lbs + ? WHERE id = ? AND company_id = ?',
                    [qty, rm.raw_material_id, company_id]
                );
            }
        }

        // Eliminar tablas dependientes
        await connection.query('DELETE FROM batch_raw_materials WHERE batch_id = ?', [id]);
        await connection.query('DELETE FROM egg_batch_variable_costs WHERE batch_id = ? AND company_id = ?', [id, company_id]);
        await connection.query('DELETE FROM egg_batch_waste_logs WHERE batch_id = ? AND company_id = ?', [id, company_id]);
        await connection.query('DELETE FROM egg_batch_remanentes WHERE batch_id = ? AND company_id = ?', [id, company_id]);
        await connection.query('DELETE FROM egg_pasteurization_logs WHERE batch_id = ? AND company_id = ?', [id, company_id]);

        // Si estaba vinculado al calendario, restaurar estado a 'programado'
        if (batch.scheduled_production_id) {
            await connection.query(
                'UPDATE egg_scheduled_productions SET status = "programado", batch_id = NULL WHERE id = ? AND company_id = ?',
                [batch.scheduled_production_id, company_id]
            );
        }

        await connection.query('DELETE FROM egg_production_batches WHERE id = ? AND company_id = ?', [id, company_id]);

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'production.deleted', 'warning', ?, ?, ?)`,
            [
                company_id,
                `Lote de producción #${id} (${batch.batch_code_display || batch.batch_uuid}) eliminado y stock revertido.`,
                JSON.stringify({ batch_id: parseInt(id), batch_code: batch.batch_code_display, materials_reverted: materials.length }),
                req.user?.nombre || 'Administrador'
            ]
        );

        await connection.commit();
        res.json({ success: true, message: 'Lote de producción eliminado y materias primas revertidas al stock.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error in deleteProductionBatch:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

// 3.3 Agregar más tarimas al quebraje durante la corrida (Soporta múltiples lotes complementarios)
const addTarimasToBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const company_id = req.company_id;
        const { raw_materials, notes, operator_name } = req.body;

        // Validar lote de producción
        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote de producción no encontrado.' });
        }
        const batch = batches[0];

        // Construir lista de items de materia prima a procesar
        let listToAdd = [];
        if (Array.isArray(raw_materials) && raw_materials.length > 0) {
            listToAdd = raw_materials;
        } else if (req.body.raw_material_id) {
            const singleQty = parseFloat(req.body.weight_lbs || req.body.quantity_lbs || 0);
            const singleBoxes = parseInt(req.body.boxes_count || 0, 10);
            listToAdd = [{
                raw_material_id: req.body.raw_material_id,
                quantity_lbs: singleQty,
                boxes_count: singleBoxes,
                tarimas: req.body.tarimas || (req.body.tarima_number ? [{
                    tarima_number: req.body.tarima_number,
                    boxes_count: singleBoxes,
                    quantity_lbs: singleQty
                }] : [])
            }];
        }

        if (listToAdd.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'Debe especificar las tarimas y lotes de materia prima a agregar.' });
        }

        let totalAddedLbs = 0;
        let totalAddedBoxes = 0;

        for (const rm of listToAdd) {
            const rmId = parseInt(rm.raw_material_id, 10);
            const qty = parseFloat(rm.quantity_lbs || rm.weight_lbs || 0);
            const boxes = parseInt(rm.boxes_count || 0, 10);
            const tarimas = Array.isArray(rm.tarimas) ? rm.tarimas : [];

            if (qty <= 0) continue;

            // Validar stock del lote de MP
            const [rmRows] = await connection.query(
                'SELECT * FROM egg_raw_materials WHERE id = ? AND company_id = ? FOR UPDATE',
                [rmId, company_id]
            );
            if (rmRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: `Materia prima con ID ${rmId} no encontrada.` });
            }

            const currentStock = parseFloat(rmRows[0].stock_lbs || 0);
            if (currentStock < qty) {
                await connection.rollback();
                return res.status(400).json({
                    message: `Stock insuficiente en lote ${rmRows[0].provider_lot}. Disponible: ${currentStock.toFixed(2)} Lbs, Solicitado: ${qty.toFixed(2)} Lbs.`
                });
            }

            // Descontar stock
            if (boxes > 0) {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = GREATEST(0, stock_lbs - ?), total_boxes = GREATEST(0, total_boxes - ?) WHERE id = ? AND company_id = ?',
                    [qty, boxes, rmId, company_id]
                );
            } else {
                await connection.query(
                    'UPDATE egg_raw_materials SET stock_lbs = GREATEST(0, stock_lbs - ?) WHERE id = ? AND company_id = ?',
                    [qty, rmId, company_id]
                );
            }

            // Insertar o actualizar en batch_raw_materials
            const [existingBrm] = await connection.query(
                'SELECT * FROM batch_raw_materials WHERE batch_id = ? AND raw_material_id = ?',
                [id, rmId]
            );

            if (existingBrm.length > 0) {
                let currentTarimas = [];
                try {
                    currentTarimas = typeof existingBrm[0].tarimas_json === 'string'
                        ? JSON.parse(existingBrm[0].tarimas_json || '[]')
                        : (existingBrm[0].tarimas_json || []);
                } catch (e) { currentTarimas = []; }

                const combinedTarimas = [...currentTarimas, ...tarimas];
                const newQty = parseFloat(existingBrm[0].quantity_lbs || 0) + qty;
                const newBoxes = parseInt(existingBrm[0].boxes_count || 0, 10) + boxes;

                await connection.query(
                    'UPDATE batch_raw_materials SET quantity_lbs = ?, boxes_count = ?, tarimas_json = ? WHERE id = ?',
                    [newQty, newBoxes, JSON.stringify(combinedTarimas), existingBrm[0].id]
                );
            } else {
                await connection.query(
                    'INSERT INTO batch_raw_materials (batch_id, raw_material_id, quantity_lbs, tarimas_json, boxes_count) VALUES (?, ?, ?, ?, ?)',
                    [id, rmId, qty, JSON.stringify(tarimas), boxes]
                );
            }

            totalAddedLbs += qty;
            totalAddedBoxes += boxes;
        }

        if (totalAddedLbs <= 0) {
            await connection.rollback();
            return res.status(400).json({ message: 'El peso total de las tarimas agregadas debe ser mayor a cero.' });
        }

        // Incrementar input_weight_lbs en el lote de producción
        await connection.query(
            'UPDATE egg_production_batches SET input_weight_lbs = input_weight_lbs + ? WHERE id = ? AND company_id = ?',
            [totalAddedLbs, id, company_id]
        );

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'batch.tarimas_added', 'info', ?, ?, ?)`,
            [
                company_id,
                `Agregadas ${totalAddedLbs.toFixed(2)} Lbs (${totalAddedBoxes} cajas / tarimas) al quebraje del lote ${batch.batch_code_display || batch.batch_uuid}.`,
                JSON.stringify({ batch_id: parseInt(id), totalAddedLbs, totalAddedBoxes, notes }),
                operator_name || req.user?.nombre || batch.operator_name || 'Operador'
            ]
        );

        await connection.commit();
        res.json({
            success: true,
            message: `Se agregaron exitosamente ${totalAddedLbs.toFixed(2)} Lbs (${totalAddedBoxes} cjs) al lote ${batch.batch_code_display || batch.batch_uuid}.`,
            totalAddedLbs,
            totalAddedBoxes,
            new_input_weight_lbs: parseFloat(batch.input_weight_lbs || 0) + totalAddedLbs
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in addTarimasToBatch:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

// 3.4 Visualizador de Etapas Cumplidas del Ciclo de Producción
const getBatchStages = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id;

        const data = await eggExportService.getBatchExportData(id, company_id);
        if (!data) return res.status(404).json({ message: 'Lote no encontrado.' });

        const { batch, rawMaterials, pasteurizationLogs, remanentes, packagingRecords, wasteLogs, totals } = data;

        // Construir el desglose de las 4 etapas
        const stages = [
            {
                step: 1,
                id: 'quebraje',
                title: 'Inicio de Producción y Quebraje de Tarimas',
                subtitle: 'Recepción, pesaje y quebraje de huevo en cáscara / líquido',
                status: batch.input_weight_lbs > 0 ? 'completado' : 'pendiente',
                started_at: batch.started_at,
                data: {
                    total_input_lbs: totals.totalInputWeight,
                    total_boxes: rawMaterials.reduce((s, r) => s + parseInt(r.boxes_count || 0, 10), 0),
                    raw_materials_count: rawMaterials.length,
                    raw_materials: rawMaterials
                }
            },
            {
                step: 2,
                id: 'pasteurizacion',
                title: 'Pasteurización Térmica y Lotes Duales',
                subtitle: 'Tratamiento térmico, curva de temperatura, caudal y presión',
                status: pasteurizationLogs.length > 0 ? 'completado' : (batch.status === 'en_proceso' ? 'en_progreso' : 'pendiente'),
                data: {
                    logs_count: pasteurizationLogs.length,
                    logs: pasteurizationLogs,
                    target_brix: batch.target_brix,
                    target_solids_pct: batch.target_solids_pct,
                    yield_liquid_lbs: totals.liquidYield,
                    waste_shell_lbs: totals.shellWaste,
                    is_dual_compatible: true
                }
            },
            {
                step: 3,
                id: 'remanentes',
                title: 'Remanentes, Reprocesos y Reutilizables',
                subtitle: 'Gestión de sobrantes (ej. huevo en leche), mezclas y reprocesos',
                status: remanentes.length > 0 ? 'activo' : 'opcional',
                data: {
                    total_remanente_lbs: totals.remanenteWeight,
                    remanentes: remanentes
                }
            },
            {
                step: 4,
                id: 'envasado',
                title: 'Envasado Comercial, Mermas y Balance Final',
                subtitle: 'Empaque en cubetas/galones, detección de faltante y cierre oficial',
                status: batch.packaging_status === 'cerrado' ? 'completado' : (packagingRecords.length > 0 ? 'en_envasado' : 'pendiente'),
                data: {
                    packaged_weight_lbs: totals.packagedWeight,
                    packaged_records_count: packagingRecords.length,
                    packaging_records: packagingRecords,
                    packaging_status: batch.packaging_status || 'pendiente',
                    packaging_loss_lbs: parseFloat(batch.packaging_loss_lbs || 0),
                    packaging_efficiency_pct: parseFloat(batch.packaging_efficiency_pct || totals.packagingEfficiencyPct),
                    waste_logs: wasteLogs
                }
            }
        ];

        res.json({
            batch,
            totals,
            stages
        });
    } catch (error) {
        console.error('Error in getBatchStages:', error);
        res.status(500).json({ message: error.message });
    }
};

// 3.5 Gestión de Mermas de Producción
const getBatchWastes = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM egg_batch_waste_logs WHERE batch_id = ? AND company_id = ? ORDER BY created_at DESC',
            [id, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createBatchWaste = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage, waste_type, quantity_lbs, weight_lbs, reason, notes, operator_name } = req.body;
        const company_id = req.company_id;

        const qty = parseFloat(quantity_lbs ?? weight_lbs ?? 0);
        if (qty <= 0) return res.status(400).json({ message: 'La cantidad de merma debe ser mayor a cero.' });

        const wasteReason = reason || notes || null;
        const [result] = await pool.query(
            `INSERT INTO egg_batch_waste_logs (company_id, batch_id, stage, waste_type, quantity_lbs, reason, operator_name)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [company_id, id, stage || 'quebraje', waste_type || 'merma_operativa', qty, wasteReason, operator_name || req.user?.nombre || null]
        );

        await pool.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'waste.logged', 'info', ?, ?, ?)`,
            [
                company_id,
                `Registrada merma de ${qty} Lbs en etapa ${stage} para lote #${id}.`,
                JSON.stringify({ waste_id: result.insertId, batch_id: parseInt(id), quantity_lbs: qty, stage, reason: wasteReason }),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        res.status(201).json({ id: result.insertId, success: true, message: 'Merma registrada exitosamente.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteBatchWaste = async (req, res) => {
    try {
        const targetId = req.params.wasteId || req.params.id;
        await pool.query('DELETE FROM egg_batch_waste_logs WHERE id = ? AND company_id = ?', [targetId, req.company_id]);
        res.json({ success: true, message: 'Registro de merma eliminado.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3.6 Remanentes, Reprocesos y Reutilizables
const getBatchRemanentes = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT * FROM egg_batch_remanentes WHERE batch_id = ? AND company_id = ? ORDER BY created_at DESC',
            [id, req.company_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getAvailableRemanentes = async (req, res) => {
    try {
        const includeBatchId = req.query.include_batch_id ? parseInt(req.query.include_batch_id, 10) : null;
        const showAll = req.query.all === 'true' || req.query.status === 'all';
        let query = `SELECT r.*, b.batch_code_display, b.batch_uuid 
             FROM egg_batch_remanentes r
             JOIN egg_production_batches b ON r.batch_id = b.id
             WHERE r.company_id = ? `;
        const params = [req.company_id];

        if (showAll) {
            // Todos los estados recientes
        } else if (includeBatchId) {
            query += ` AND (r.status = 'disponible' OR r.target_batch_id = ?)`;
            params.push(includeBatchId);
        } else {
            query += ` AND r.status = 'disponible'`;
        }
        query += ` ORDER BY r.created_at DESC LIMIT 100`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createBatchRemanente = async (req, res) => {
    try {
        const { id } = req.params;
        const { product_type, presentation, remanente_type, quantity_lbs, weight_lbs, storage_location, destination, notes, operator_name, created_by, is_pasteurized } = req.body;
        const company_id = req.company_id;

        const qty = parseFloat(quantity_lbs ?? weight_lbs ?? 0);
        if (qty <= 0) return res.status(400).json({ message: 'La cantidad debe ser mayor a cero.' });

        const remType = remanente_type || (is_pasteurized === false ? 'no_pasteurizado' : 'pasteurizado');
        const loc = storage_location || destination || 'Tanque Pulmón / Cámara';

        const [result] = await pool.query(
            `INSERT INTO egg_batch_remanentes (company_id, batch_id, product_type, remanente_type, quantity_lbs, storage_location, notes, operator_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                company_id, id, product_type || 'huevo entero',
                remType, qty,
                loc, notes || null,
                operator_name || created_by || req.user?.nombre || null
            ]
        );

        res.status(201).json({ id: result.insertId, success: true, message: 'Remanente / Reproceso registrado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateBatchRemanente = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, target_batch_id, notes } = req.body;
        const company_id = req.company_id || req.user?.company_id;

        let targetBatch = target_batch_id !== undefined ? target_batch_id : null;
        if (status === 'disponible') {
            targetBatch = null;
        }

        await pool.query(
            `UPDATE egg_batch_remanentes 
             SET status = COALESCE(?, status),
                 target_batch_id = CASE 
                     WHEN ? = 'disponible' THEN NULL 
                     WHEN ? IS NOT NULL THEN ? 
                     ELSE target_batch_id 
                 END,
                 notes = COALESCE(?, notes),
                 updated_at = NOW()
             WHERE id = ? AND company_id = ?`,
            [
                status || null, 
                status || null, 
                targetBatch, 
                targetBatch, 
                notes !== undefined ? notes : null, 
                id, 
                company_id
            ]
        );
        res.json({ success: true, message: 'Remanente actualizado con éxito.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 3.7 Cierre de Lote de Envasado con Detección de Faltante y Eficiencia
const closeBatchPackaging = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { reason, operator_name } = req.body;
        const company_id = req.company_id;

        const [batches] = await connection.query(
            'SELECT * FROM egg_production_batches WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        if (batches.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lote no encontrado.' });
        }
        const batch = batches[0];

        // Sumar envasado real
        const [pkgSum] = await connection.query(
            'SELECT COALESCE(SUM(total_batch_weight_lbs), 0) as packaged_weight FROM egg_packaging_records WHERE batch_id = ? AND company_id = ?',
            [id, company_id]
        );
        const packagedWeight = parseFloat(pkgSum[0]?.packaged_weight || 0);
        const yieldLiquid = parseFloat(batch.yield_liquid_lbs || 0);
        const missingLbs = Math.max(0, yieldLiquid - packagedWeight);
        const efficiencyPct = yieldLiquid > 0 ? Math.round((packagedWeight / yieldLiquid) * 10000) / 100 : 0;

        // Si faltaron libras por envasar, registrarlas como merma en tuberías / envasado
        if (missingLbs > 0.01) {
            await connection.query(
                `INSERT INTO egg_batch_waste_logs (company_id, batch_id, stage, waste_type, quantity_lbs, reason, operator_name)
                 VALUES (?, ?, 'envasado', 'merma_tuberias_envasado', ?, ?, ?)`,
                [
                    company_id, id, missingLbs,
                    reason || `Faltante de cierre de envasado (${missingLbs.toFixed(2)} Lbs no envasadas / residuos en tuberías).`,
                    operator_name || req.user?.nombre || 'Operador Envasado'
                ]
            );
        }

        // Marcar lote como cerrado en envasado
        await connection.query(
            `UPDATE egg_production_batches 
             SET packaging_status = 'cerrado', 
                 status = 'empaquetado',
                 packaging_loss_lbs = ?,
                 packaging_efficiency_pct = ?,
                 completed_at = COALESCE(completed_at, NOW())
             WHERE id = ? AND company_id = ?`,
            [missingLbs, efficiencyPct, id, company_id]
        );

        await connection.query(
            `INSERT INTO egg_industrial_events (company_id, event_type, severity, description, payload, operator_name)
             VALUES (?, 'packaging.closed', 'info', ?, ?, ?)`,
            [
                company_id,
                `Envasado de lote #${id} (${batch.batch_code_display || batch.batch_uuid}) cerrado. Envasado: ${packagedWeight} Lbs. Faltante registrado como merma: ${missingLbs} Lbs. Eficiencia: ${efficiencyPct}%.`,
                JSON.stringify({ batch_id: parseInt(id), packagedWeight, yieldLiquid, missingLbs, efficiencyPct }),
                operator_name || req.user?.nombre || 'Operador'
            ]
        );

        await connection.commit();
        res.json({
            success: true,
            message: `Lote cerrado exitosamente. Eficiencia de envasado: ${efficiencyPct}%. Merma registrada: ${missingLbs.toFixed(2)} Lbs.`,
            packagedWeight,
            missingLbs,
            efficiencyPct
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error in closeBatchPackaging:', error);
        res.status(500).json({ message: error.message });
    } finally {
        connection.release();
    }
};

// 3.8 Exportar Resumen de Producción en PDF, Excel y Word
const exportBatchSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const { format } = req.query; // 'pdf', 'excel', 'word'
        const company_id = req.company_id;

        if (format === 'excel' || format === 'xlsx') {
            const buffer = await eggExportService.generateBatchSummaryExcel(id, company_id);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="resumen_produccion_lote_${id}.xlsx"`);
            return res.send(buffer);
        }

        if (format === 'word' || format === 'docx') {
            const buffer = await eggExportService.generateBatchSummaryWord(id, company_id);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename="resumen_produccion_lote_${id}.docx"`);
            return res.send(buffer);
        }

        // Default: PDF
        const buffer = await eggExportService.generateBatchSummaryPdf(id, company_id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="resumen_produccion_lote_${id}.pdf"`);
        return res.send(buffer);
    } catch (error) {
        console.error('Error in exportBatchSummary:', error);
        res.status(500).json({ message: error.message });
    }
};

// 1.2 Eliminar Recepción de Materia Prima

module.exports = {
    getCipLogs,
    createCipLog,
    quickSanitizeCip,
    getProductionBatches,
    createProductionBatch,
    updateProductionBatch,
    deleteProductionBatch,
    completeProductionBatch,
    createPasteurizationLog,
    getHoldingTemperatures,
    createHoldingTemperature,
    addTarimasToBatch,
    getBatchStages,
    exportBatchSummary,
    getBatchWastes,
    createBatchWaste,
    deleteBatchWaste,
    getBatchRemanentes,
    getAvailableRemanentes,
    createBatchRemanente,
    updateBatchRemanente
};
