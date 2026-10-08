const { pool, computeJulianLotCode } = require('./shared');
const { extractCustomerMap, resolveCustomerSelection, getCustomerKey } = require('../../../services/eggIndustrial/eggPlanning/eggPlanningCustomerHelper');
const getProductionSuggestions = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const separationBatchLbs = Math.min(12000, Math.max(3000, parseFloat(req.query.separation_batch_lbs) || 6000));

        // 1. Obtener pedidos pendientes
        const [orders] = await pool.query(
            `SELECT * FROM egg_customer_orders
             WHERE company_id = ? AND status IN ('pendiente', 'programado')
             ORDER BY required_delivery_date ASC`,
            [company_id]
        );

        // 2. Obtener acuerdos comerciales activos
        const [agreements] = await pool.query(
            `SELECT * FROM egg_costing_customer_agreements
             WHERE company_id = ? AND status = 'activo'`,
            [company_id]
        );

        // Mapeo unificado de clientes elegibles y filtrado dinámico
        const rawAvailableCustomers = extractCustomerMap(orders, agreements);
        const { selectedKeys: selectedCustomerKeys, availableCustomers } = resolveCustomerSelection(rawAvailableCustomers, req.query.customer_ids);

        const filteredOrders = orders.filter(o => selectedCustomerKeys.has(getCustomerKey(o)));
        const filteredAgreements = agreements.filter(a => selectedCustomerKeys.has(getCustomerKey(a)));

        // 3. Stock actual de materia prima disponible
        const [rmRows] = await pool.query(
            `SELECT SUM(stock_lbs) as total_stock_lbs, SUM(total_boxes) as total_boxes
             FROM egg_raw_materials
             WHERE company_id = ? AND status = 'aprobado' AND stock_lbs > 0`,
            [company_id]
        );
        const availableStockLbs = parseFloat(rmRows[0]?.total_stock_lbs || 0);

        // 4. Histórico de ventas de los últimos 6 meses (ventas de productos de huevo)
        const [salesHistory] = await pool.query(
            `SELECT p.nombre as product_name, SUM(si.cantidad) as total_lbs, COUNT(DISTINCT sh.id) as trans_count
             FROM sales_items si
             JOIN sales_headers sh ON si.sale_id = sh.id
             JOIN products p ON si.product_id = p.id
             WHERE sh.company_id = ? AND sh.estado != 'ANULADO'
               AND sh.fecha_emision >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
               AND (p.nombre LIKE '%huevo%' OR p.nombre LIKE '%clara%' OR p.nombre LIKE '%yema%')
             GROUP BY p.nombre
             ORDER BY total_lbs DESC`,
            [company_id]
        );

        // Agregación de demanda por categoría
        let demandClara = 0;
        let demandYema = 0;
        let demandEntero = 0;
        let demandFormulado = 0;

        filteredOrders.forEach(o => {
            const qty = parseFloat(o.quantity_lbs || 0);
            const pType = (o.product_type || '').toLowerCase();
            if (pType.includes('clara')) demandClara += qty;
            else if (pType.includes('yema')) demandYema += qty;
            else if (pType.includes('formulado') || pType.includes('separaci')) demandFormulado += qty;
            else demandEntero += qty;
        });

        // Sumar demanda prorrateada semanal de los acuerdos comerciales
        filteredAgreements.forEach(a => {
            const weeklyVol = (parseFloat(a.monthly_volume_lbs || 0)) / 4.2;
            const pType = (a.product_type || '').toLowerCase();
            if (pType.includes('clara')) demandClara += weeklyVol;
            else if (pType.includes('yema')) demandYema += weeklyVol;
            else if (pType.includes('formulado') || pType.includes('separaci')) demandFormulado += weeklyVol;
            else demandEntero += weeklyVol;
        });

        // Si no hay pedidos cargados aún en toda la empresa, proveer base de simulación
        const hasAnyCustomerData = (orders.length > 0 || agreements.length > 0);
        const isSimulation = !hasAnyCustomerData && (demandClara + demandYema + demandEntero + demandFormulado) === 0;
        if (isSimulation) {
            demandClara = 5400;
            demandYema = 0;
            demandEntero = 12000;
            demandFormulado = 6000;
        }

        const suggestions = [];

        // -------------------------------------------------------------------------------------
        // SUGERENCIA 1: BALANCE Y ARBITRAJE DE COPRODUCTO (CLARA -> EXCEDENTE DE YEMA CON MP LIQUIDA A)
        // -------------------------------------------------------------------------------------
        // Quebrado rinde ~53.95% de Clara y ~30.8% de Yema (con 15.25% de cáscara y merma)
        if (demandClara > 0) {
            // Sizing de separación calibrado por lote operativo (evita saturar maquinaria y tanques)
            const maxClaraInBatch = Math.round(separationBatchLbs * 0.5395);
            const claraInBatch = Math.min(demandClara, maxClaraInBatch);
            const rawLiquidNeededForClara = Math.round(claraInBatch / 0.5395);
            const coproductYolkGenerated = Math.round(rawLiquidNeededForClara * 0.308);
            const surplusYolk = Math.max(0, coproductYolkGenerated - demandYema);

            if (surplusYolk > 200) {
                // Reformulación: Yema pura (50% sólidos) rebajada con MP liquida A a 22.5% de sólidos
                // Ratio: 1 lb de yema + 1.22 lbs MP liquida A -> 2.22 lbs de Huevo Formulado
                const waterAddedLbs = Math.round(surplusYolk * 1.22);
                const formulatedYieldLbs = surplusYolk + waterAddedLbs;
                const citricAcidLbs = (formulatedYieldLbs * 0.0015).toFixed(2); // 0.15% estabilizador
                const boxesSaved = Math.round(formulatedYieldLbs / 36.1); // ~36.1 lbs líquido útil por caja
                const moneySaved = boxesSaved * 38.00; // Ahorro neto en cajas de materia prima
                const rawBoxes = Math.round(rawLiquidNeededForClara / 36.1);

                // Fecha sugerida: próximo martes o jueves a las 06:00 (nunca en el pasado)
                const baseDate = req.query.start_date ? new Date(req.query.start_date + 'T00:00:00') : new Date();
                const nextDate = new Date(baseDate);
                nextDate.setDate(nextDate.getDate() + ((2 + 7 - nextDate.getDay()) % 7 || 7));
                const recDateStr = nextDate.toISOString().split('T')[0];

                suggestions.push({
                    id: 'sug-coproduct-yolk-h2o',
                    type: 'coproduct_arbitrage',
                    priority: 'alta',
                    title: 'Arbitraje de Coproducto: Reutilización de Yema con MP liquida A',
                    badge: 'Ahorro Máximo & Margen Alto',
                    color: 'emerald',
                    summary: `Detectada demanda de ${Math.round(demandClara).toLocaleString()} Lbs de Clara. Se calibra un lote de separación controlado de ${rawLiquidNeededForClara.toLocaleString()} Lbs (${rawBoxes} cajas) para no saturar tanques de frío. Generará ${Math.round(claraInBatch).toLocaleString()} Lbs de clara y ${Math.round(surplusYolk).toLocaleString()} Lbs de yema coproducto excedente. Reincorporarla con ${Math.round(waterAddedLbs).toLocaleString()} Lbs MP liquida A y ácido cítrico formula ${Math.round(formulatedYieldLbs).toLocaleString()} Lbs de Huevo Entero Formulado al 22.5% de sólidos.`,
                    economic_impact: {
                        boxes_saved: boxesSaved,
                        cost_savings_usd: moneySaved,
                        cost_per_lb_formulated: '$0.36 - $0.42 / Lb',
                        roi_note: `Ahorra $${moneySaved.toLocaleString()} al evitar comprar ${boxesSaved} cajas de huevo cáscara adicionales.`
                    },
                    suggested_production: {
                        production_date: recDateStr,
                        start_time: '06:00:00',
                        end_time: '14:30:00',
                        lot_code: computeJulianLotCode(recDateStr, 1),
                        product_profile: 'Huevo Formulado por Separación',
                        presentation: 'cubeta 30LB',
                        target_quantity_lbs: Math.round(formulatedYieldLbs),
                        target_solids_pct: 22.50,
                        priority: 'alta',
                        suggestion_source: 'ai_balance_coproductos',
                        mix_formula_json: {
                            raw_egg_boxes: rawBoxes,
                            raw_liquid_lbs: rawLiquidNeededForClara,
                            clara_separated_pct: 100,
                            clara_produced_lbs: Math.round(claraInBatch),
                            yema_coproduct_lbs: Math.round(coproductYolkGenerated),
                            yema_reutilized_lbs: Math.round(surplusYolk),
                            water_h2o_lbs: Math.round(waterAddedLbs),
                            water_bottles: Math.ceil(waterAddedLbs / 41.8), // ~41.8 lbs por garrafa de 5 galones
                            citric_acid_lbs: citricAcidLbs,
                            target_solids_pct: 22.5,
                            separation_batch_limit_lbs: separationBatchLbs,
                            notes: `Batch combinado calibrado a ${rawLiquidNeededForClara.toLocaleString()} Lbs MP (máx ${separationBatchLbs.toLocaleString()} Lbs): 1) Separar ${Math.round(claraInBatch).toLocaleString()} Lbs de clara. 2) Reincorporar ${Math.round(surplusYolk).toLocaleString()} Lbs de yema coproducto con ${Math.round(waterAddedLbs).toLocaleString()} Lbs de MP liquida A y ${citricAcidLbs} Lbs de ácido cítrico.`
                        },
                        tasks: [
                            { factory_role: 'Quebrado y Carga', task_description: `Almacenar y quebrar ${rawBoxes} cajas de huevo blanco para alimentar separadora centrífuga.` },
                            { factory_role: 'Sanitización CIP', task_description: 'Ejecutar CIP ácido/alcalino de 45 min en pasteurizador y tanque de mezcla antes de las 05:30 AM.' },
                            { factory_role: 'Dosificación MP liquida A / Mezcla', task_description: `Medir y dosificar ${Math.round(waterAddedLbs).toLocaleString()} Lbs de MP liquida A con ${citricAcidLbs} Lbs de ácido cítrico grado alimentario.` },
                            { factory_role: 'Control de Calidad LAB-004', task_description: 'Verificar refractómetro: Sólidos totales 22.5% ± 0.5% Brix y pH 6.8 antes de autorizar pasteurización.' },
                            { factory_role: 'Pasteurización HACCP', task_description: 'Pasteurizar a 64.5°C por 210 segundos, monitoreando CCP-1 y flujo de 12.5 GPM.' },
                            { factory_role: 'Empaque y Cuarto Frío', task_description: `Preparar ${Math.ceil(formulatedYieldLbs / 30)} cubetas de 30 Lb sanitizadas y ${Math.ceil(claraInBatch / 30)} cubetas para clara.` }
                        ]
                    }
                });
            }
        }

        // -------------------------------------------------------------------------------------
        // SUGERENCIA 2: OPTIMIZACIÓN DE SECUENCIA DE LAVADOS CIP EN PLANTA
        // -------------------------------------------------------------------------------------
        const baseDateWed = req.query.start_date ? new Date(req.query.start_date + 'T00:00:00') : new Date();
        const nextWed = new Date(baseDateWed);
        nextWed.setDate(nextWed.getDate() + ((3 + 7 - nextWed.getDay()) % 7 || 7));
        const wedStr = nextWed.toISOString().split('T')[0];

        suggestions.push({
            id: 'sug-cip-sequencing',
            type: 'cip_optimization',
            priority: 'media',
            title: 'Secuenciación CIP: Lote Puro Primero, Formulado/Aditivado al Final',
            badge: 'Eficiencia Térmica & Químicos',
            color: 'indigo',
            summary: 'Al correr Huevo Entero Pasteurizado Puro en el primer turno y Huevo con Leche / Yema Azucarada en el segundo turno, se evita un lavado químico CIP intermedio profundo. Se ahorran 2 horas de paro de planta y $180 en ácido peracético y soda cáustica.',
            economic_impact: {
                hours_saved: 2.5,
                cost_savings_usd: 180.00,
                efficiency: 'Reducción de consumo de agua y vapor en caldera'
            },
            suggested_production: {
                production_date: wedStr,
                start_time: '06:00:00',
                end_time: '13:00:00',
                lot_code: computeJulianLotCode(wedStr, 1),
                product_profile: 'Huevo Entero Pasteurizado',
                presentation: 'cubeta 30LB',
                target_quantity_lbs: 12000,
                target_solids_pct: 23.50,
                priority: 'media',
                suggestion_source: 'ai_optimizador_pedidos',
                mix_formula_json: {
                    raw_egg_boxes: 332,
                    raw_liquid_lbs: 12000,
                    clara_separated_pct: 0,
                    clara_produced_lbs: 0,
                    yema_coproduct_lbs: 0,
                    water_h2o_lbs: 0,
                    notes: 'Corrida pura sin aditivos. Al finalizar, limpiar línea con enjuague rápido y pasar al lote con azúcar/leche sin desmontaje completo.'
                },
                tasks: [
                    { factory_role: 'Sanitización CIP', task_description: 'Verificar que el pasteurizador tenga CIP activo de la noche anterior (temperatura 78°C validada).' },
                    { factory_role: 'Quebrado y Carga', task_description: 'Alinear 332 cajas de huevo cáscara lote Aprobado en cámara de quebrado.' },
                    { factory_role: 'Pasteurización HACCP', task_description: 'Mantener régimen estándar de 64.5°C por 210s.' }
                ]
            }
        });

        // -------------------------------------------------------------------------------------
        // SUGERENCIA 3: ATENCIÓN DE PEDIDOS PENDIENTES CON FECHA CRÍTICA
        // -------------------------------------------------------------------------------------
        const pendingCriticalOrders = orders.filter(o => o.status === 'pendiente');
        if (pendingCriticalOrders.length > 0) {
            const firstOrder = pendingCriticalOrders[0];
            const todayStr = new Date().toISOString().split('T')[0];
            let orderDateStr = firstOrder.required_delivery_date ? new Date(firstOrder.required_delivery_date).toISOString().split('T')[0] : wedStr;
            if (orderDateStr < todayStr) {
                orderDateStr = todayStr;
            }
            const targetLbs = Math.max(3000, Math.ceil(parseFloat(firstOrder.quantity_lbs || 0)));

            suggestions.push({
                id: 'sug-critical-order',
                type: 'order_fulfillment',
                priority: 'urgente',
                title: `Cumplimiento de Pedido: ${firstOrder.customer_name}`,
                badge: 'Fecha de Entrega Crítica',
                color: 'amber',
                summary: `El cliente ${firstOrder.customer_name} requiere ${parseFloat(firstOrder.quantity_lbs).toLocaleString()} Lbs de ${firstOrder.product_type} para el ${orderDateStr}. Se recomienda programar la producción al menos 24 horas antes para permitir liberación de laboratorio LAB-004 (sólidos y coliformes).`,
                economic_impact: {
                    order_value_usd: (parseFloat(firstOrder.quantity_lbs || 0) * parseFloat(firstOrder.price_per_lb || 1.15)),
                    customer: firstOrder.customer_name,
                    delivery_deadline: orderDateStr
                },
                suggested_production: {
                    production_date: orderDateStr,
                    start_time: '05:30:00',
                    end_time: '12:00:00',
                    lot_code: computeJulianLotCode(orderDateStr, 1),
                    product_profile: firstOrder.product_type,
                    presentation: firstOrder.presentation || 'cubeta 30LB',
                    target_quantity_lbs: targetLbs,
                    target_solids_pct: 22.00,
                    priority: 'urgente',
                    suggestion_source: 'ai_optimizador_pedidos',
                    mix_formula_json: {
                        order_id: firstOrder.id,
                        customer_name: firstOrder.customer_name,
                        target_lbs: targetLbs,
                        notes: `Producción exclusiva para despacho orden #${firstOrder.order_number || firstOrder.id} - ${firstOrder.customer_name}`
                    },
                    tasks: [
                        { factory_role: 'Control de Calidad LAB-004', task_description: `Toma de muestra aséptica de 250ml para liberación rápida LAB-004 a ${firstOrder.customer_name}.` },
                        { factory_role: 'Empaque y Cuarto Frío', task_description: `Etiquetado especial con código de cliente y traslado inmediato a zona HOLDING.` }
                    ]
                }
            });
        }

        res.json({
            kpis: {
                demand_clara_lbs: Math.round(demandClara),
                demand_yema_lbs: Math.round(demandYema),
                demand_entero_lbs: Math.round(demandEntero),
                demand_formulado_lbs: Math.round(demandFormulado),
                available_stock_lbs: availableStockLbs,
                pending_orders_count: filteredOrders.length,
                active_agreements_count: filteredAgreements.length,
                selected_customers_count: selectedCustomerKeys.size,
                total_customers_count: availableCustomers.length,
                separation_batch_lbs: separationBatchLbs,
                is_simulation_active: isSimulation
            },
            available_customers: availableCustomers,
            selected_customer_ids: Array.from(selectedCustomerKeys),
            separation_batch_lbs: separationBatchLbs,
            suggestions
        });
    } catch (error) {
        console.error('Error al generar sugerencias de producción:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getProductionSuggestions };
