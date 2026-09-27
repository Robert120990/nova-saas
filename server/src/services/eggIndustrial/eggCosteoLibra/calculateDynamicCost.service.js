const { pool, ensureSeedData } = require('../../../controllers/eggCosteoLibra/shared');

const calculateDynamicCost = async (req) => {
    const responseHeaders = {};
    try {
        await ensureSeedData(req.company_id);

        const {
            product_type = 'Huevo Entero Pasteurizado',
            presentation = 'cubeta 30LB',
            raw_egg_box_cost = 38.00, // Costo de caja de 360 huevos
            raw_egg_lbs_per_box = 43.50, // Peso aprox de caja
            batch_size_lbs = 12000.00, // Batch estándar
            water_added_pct = null, // % Agua directa
            sugar_added_pct = null, // % Azúcar
            salt_added_pct = null,  // % Sal
            milk_added_pct = null,  // % Leche
            base_egg_solids = null, // Sólidos base medidos refractómetro
            target_solids = null,   // Sólidos objetivo deseados
            // Parámetros de Separación Clara/Yema & Huevo Formulado con H2O
            clara_separated_pct = 100.0, // % de clara destinada a venta directa
            clara_sale_price_per_lb = 1.35, // Precio de venta pactado de clara ($/lb)
            yema_solids_pct = 50.0, // Sólidos de la yema pura (%)
            custom_gif_monthly = null,
            custom_monthly_volume_lbs = null,
            target_sale_price_per_lb = null,
            start_date = null,
            end_date = null
        } = req.body;

        // Cargar configuraciones del sistema
        const [configRows] = await pool.query('SELECT * FROM egg_costing_configurations WHERE company_id = ?', [req.company_id]);
        const configs = {};
        configRows.forEach(c => { configs[c.setting_key] = parseFloat(c.setting_value) || 0; });

        // Cargar Químicos CIP
        const [cipRows] = await pool.query('SELECT * FROM egg_costing_cip_items WHERE company_id = ? AND status = "activo"', [req.company_id]);

        // Cargar Empaques
        const [packRows] = await pool.query('SELECT * FROM egg_costing_packaging WHERE company_id = ?', [req.company_id]);
        const packMap = {};
        packRows.forEach(p => { packMap[p.item_code] = parseFloat(p.unit_cost) || 0; });

        // Cargar Acuerdos de Clientes
        const [agreements] = await pool.query('SELECT * FROM egg_costing_customer_agreements WHERE company_id = ? AND status = "activo"', [req.company_id]);

        // A. CÁLCULO DE COSTO DE MATERIA PRIMA (HUEVO CÁSCARA -> LÍQUIDO)
        const safeLbsPerBox = Math.max(parseFloat(raw_egg_lbs_per_box) || 43.50, 1);
        const safeBoxCost = Math.max(parseFloat(raw_egg_box_cost) || 0, 0);
        const costPerLbRawEgg = safeBoxCost / safeLbsPerBox;
        const safeBatchSize = Math.max(parseFloat(batch_size_lbs) || 12000, 1);

        // Rendimiento base de quebrado según producto
        let liquidYieldPct = 0.83; // 83% líquido para huevo entero (17% cáscara)
        let productBase = (product_type || '').toLowerCase();
        let isSeparationMode = productBase.includes('separaci') || productBase.includes('separad') || productBase.includes('reconstituido');

        if (productBase.includes('clara') && !isSeparationMode) {
            liquidYieldPct = 0.5395;
        } else if (productBase.includes('yema') && !isSeparationMode) {
            liquidYieldPct = 0.2905;
        }

        // Sólidos y Balance Hídrico
        const bSolids = parseFloat(base_egg_solids) || 24.20;
        let tSolids = parseFloat(target_solids);
        if (isNaN(tSolids) || tSolids <= 0) {
            tSolids = (productBase.includes('plus') || isSeparationMode) ? 21.50 : bSolids;
        }

        let effectiveWaterPct = 0;
        let effectiveSugarPct = (sugar_added_pct !== null && sugar_added_pct !== undefined && !isNaN(parseFloat(sugar_added_pct)))
            ? Math.max(0, parseFloat(sugar_added_pct)) / 100
            : (productBase.includes('azucarada') ? 0.04 : 0);

        let effectiveSaltPct = (salt_added_pct !== null && salt_added_pct !== undefined && !isNaN(parseFloat(salt_added_pct)))
            ? Math.max(0, parseFloat(salt_added_pct)) / 100
            : (productBase.includes('salada') ? 0.10 : 0);

        let effectiveMilkPct = (milk_added_pct !== null && milk_added_pct !== undefined && !isNaN(parseFloat(milk_added_pct)))
            ? Math.max(0, parseFloat(milk_added_pct)) / 100
            : (productBase.includes('leche') ? 0.05 : 0);

        let baseLiquidCostPerLb = costPerLbRawEgg / Math.max(liquidYieldPct, 0.01);
        let additiveCostPerLb = 0;
        let mpCostPerLb = 0;
        let effectivePureEggFraction = 1;
        let separationData = null;

        if (isSeparationMode) {
            // --- MODELO OFICIAL ANDELSA: SEPARACIÓN DE CLARA + HUEVO FORMULADO CON YEMA & H2O ---
            const rawShellLbs = safeBatchSize;
            const grossRawCost = (rawShellLbs / safeLbsPerBox) * safeBoxCost;

            const totalLiquidLbs = rawShellLbs * 0.83; // 83% líquido neto
            const naturalClaraLbs = rawShellLbs * 0.5395; // 65% del líquido (53.95% del huevo cáscara)
            const naturalYemaLbs = rawShellLbs * 0.2905;  // 35% del líquido (29.05% del huevo cáscara)

            const claraSepRate = Math.min(100, Math.max(0, parseFloat(clara_separated_pct) || 100)) / 100;
            const claraForSaleLbs = naturalClaraLbs * claraSepRate;
            const remainingClaraLbs = naturalClaraLbs * (1 - claraSepRate);
            const claraPrice = Math.max(0, parseFloat(clara_sale_price_per_lb) || 1.35);
            const claraRevenue = claraForSaleLbs * claraPrice;

            // Sólidos totales disponibles
            const ySolids = parseFloat(yema_solids_pct) || 50.0;
            const targetSolidsPct = Math.max(15, parseFloat(tSolids) || 21.5);
            const solidsFromYema = naturalYemaLbs * (ySolids / 100);
            const solidsFromRemClara = remainingClaraLbs * 0.118; // 11.8% sólidos en clara
            const totalSolidsLbs = solidsFromYema + solidsFromRemClara;

            // Peso final formulado para alcanzar targetSolidsPct
            const finalFormulatedLbs = totalSolidsLbs / (targetSolidsPct / 100);
            const h2oRequiredLbs = Math.max(0, finalFormulatedLbs - naturalYemaLbs - remainingClaraLbs);
            const h2oGarrafones = h2oRequiredLbs / 42.0;

            // Aditivo estabilizador: Ácido cítrico al 0.1% a $2.10/lb
            const citricAcidLbs = finalFormulatedLbs * 0.001;
            const citricAcidCost = citricAcidLbs * 2.10;
            const h2oCost = h2oRequiredLbs * 0.001;
            const totalAdditiveCost = citricAcidCost + h2oCost;

            // Costo neto atribuible a la MP del huevo formulado:
            // Se resta el crédito/ingreso por la venta de la clara premium
            const netRawEggCost = Math.max(0, grossRawCost - claraRevenue) + totalAdditiveCost;
            const mpCostPerLbFormulated = finalFormulatedLbs > 0 ? netRawEggCost / finalFormulatedLbs : 0;

            mpCostPerLb = mpCostPerLbFormulated;
            effectiveWaterPct = finalFormulatedLbs > 0 ? h2oRequiredLbs / finalFormulatedLbs : 0;
            effectivePureEggFraction = finalFormulatedLbs > 0 ? (naturalYemaLbs + remainingClaraLbs) / finalFormulatedLbs : 1;

            const claraCostPerLb = (grossRawCost * 0.65) / Math.max(naturalClaraLbs, 1);
            const claraProfit = (claraPrice - claraCostPerLb) * claraForSaleLbs;

            separationData = {
                is_separation_mode: true,
                raw_shell_batch_lbs: rawShellLbs,
                gross_raw_cost: grossRawCost,
                natural_clara_lbs: naturalClaraLbs,
                clara_for_sale_lbs: claraForSaleLbs,
                clara_sale_price: claraPrice,
                clara_revenue: claraRevenue,
                clara_cost_per_lb: claraCostPerLb,
                clara_profit: claraProfit,
                natural_yema_lbs: naturalYemaLbs,
                remaining_clara_lbs: remainingClaraLbs,
                yema_solids_pct: ySolids,
                target_solids_pct: targetSolidsPct,
                total_solids_lbs: totalSolidsLbs,
                h2o_required_lbs: h2oRequiredLbs,
                h2o_garrafones: h2oGarrafones,
                citric_acid_lbs: citricAcidLbs,
                final_formulated_lbs: finalFormulatedLbs,
                total_additive_cost: totalAdditiveCost,
                net_raw_egg_cost: netRawEggCost,
                mp_cost_per_lb_formulated: mpCostPerLbFormulated,
                standard_mp_cost_without_separation: grossRawCost / Math.max(totalLiquidLbs, 1),
                mp_cost_reduction_per_lb: Math.max(0, (grossRawCost / Math.max(totalLiquidLbs, 1)) - mpCostPerLbFormulated)
            };
        } else {
            // Modelo de mezclado / adición estándar
            if (productBase.includes('plus') || water_added_pct !== null || (base_egg_solids && target_solids)) {
                if (water_added_pct !== null && water_added_pct !== undefined && !isNaN(parseFloat(water_added_pct))) {
                    effectiveWaterPct = Math.max(0, parseFloat(water_added_pct)) / 100;
                    tSolids = bSolids * (1 - effectiveWaterPct);
                } else if (bSolids > tSolids && bSolids > 0) {
                    effectiveWaterPct = Math.max(0, (bSolids - tSolids) / bSolids);
                } else if (productBase.includes('plus')) {
                    effectiveWaterPct = 0.08; // 8% estándar ANDELSA
                    tSolids = bSolids * (1 - effectiveWaterPct);
                }
            }

            if (effectiveSugarPct > 0) additiveCostPerLb += effectiveSugarPct * 0.45;
            if (effectiveSaltPct > 0) additiveCostPerLb += effectiveSaltPct * 0.15;
            if (effectiveMilkPct > 0) additiveCostPerLb += effectiveMilkPct * 1.80;
            if (effectiveWaterPct > 0) additiveCostPerLb += (effectiveWaterPct * 0.001) + 0.0015;

            effectivePureEggFraction = Math.max(0, 1 - effectiveWaterPct - effectiveSugarPct - effectiveSaltPct - effectiveMilkPct);
            mpCostPerLb = (baseLiquidCostPerLb * effectivePureEggFraction) + additiveCostPerLb;
        }

        // Desglose de formulación física para el batch
        const formulation = {
            product_type,
            base_liquid_pure_lbs: safeBatchSize * effectivePureEggFraction,
            water_added_pct: effectiveWaterPct * 100,
            water_lbs: safeBatchSize * effectiveWaterPct,
            water_garrafones: (safeBatchSize * effectiveWaterPct) / 42.0,
            citric_acid_pct: effectiveWaterPct > 0 ? 0.10 : 0,
            citric_acid_lbs: effectiveWaterPct > 0 ? safeBatchSize * 0.001 : 0,
            sugar_pct: effectiveSugarPct * 100,
            sugar_lbs: safeBatchSize * effectiveSugarPct,
            salt_pct: effectiveSaltPct * 100,
            salt_lbs: safeBatchSize * effectiveSaltPct,
            milk_pct: effectiveMilkPct * 100,
            milk_lbs: safeBatchSize * effectiveMilkPct,
            base_egg_solids: bSolids,
            target_solids: tSolids,
            is_solids_compliant: tSolids >= 21.0,
            pure_egg_cost_per_lb: baseLiquidCostPerLb,
            formulated_mp_cost_per_lb: mpCostPerLb,
            mp_cost_savings_per_lb: Math.max(0, baseLiquidCostPerLb - mpCostPerLb)
        };

        // B. COSTO DE LIMPIEZA CIP POR BATCH Y POR LIBRA
        let totalCipBatchCost = 0;
        cipRows.forEach(item => {
            const unitPrice = parseFloat(item.presentation_cost) / (parseFloat(item.presentation_qty) || 1);
            totalCipBatchCost += unitPrice * parseFloat(item.dose_per_batch);
        });
        // Cero configurado se conserva; los faltantes se muestran en el catálogo de costos.
        const cipCostPerLb = totalCipBatchCost / safeBatchSize;

        // C. COSTO DE CALDERA, ENERGÍA, DIESEL Y AGUA (PASTEURIZADOR)
        const dieselGal = configs.boiler_diesel_gal_batch ?? 20.84;
        const dieselPrice = configs.boiler_diesel_price_gal ?? 4.14;
        const dieselTotal = dieselGal * dieselPrice;
        const electricityTotal = configs.boiler_kwh_cost_batch ?? 386.00;
        const waterTotal = configs.boiler_water_cost_batch ?? 17.34;
        const totalBoilerEnergyBatchCost = dieselTotal + electricityTotal + waterTotal;
        const boilerEnergyCostPerLb = totalBoilerEnergyBatchCost / safeBatchSize;

        // D. MANO DE OBRA DIRECTA (MOD)
        const modCostPerLb = configs.mod_cost_per_lb ?? 0.0500;

        // E. GASTOS INDIRECTOS DE FABRICACIÓN (GIF) PRORRATEADOS
        const monthlyGifTotal = custom_gif_monthly !== null ? custom_gif_monthly : (configs.monthly_gif_total ?? 24537.00);
        const monthlyProjectedLbs = Math.max(custom_monthly_volume_lbs !== null ? custom_monthly_volume_lbs : (configs.monthly_projected_lbs ?? 100000.00), 1);
        const gifCostPerLb = monthlyGifTotal / monthlyProjectedLbs;

        // F. COSTO BASE OPERACIONAL POR LIBRA (SIN EMPAQUE)
        // La materia prima formulada, el lavado CIP, la caldera/energía, la MOD y los GIF aplican por igual al lote líquido
        const baseOperatingCostPerLb = mpCostPerLb + cipCostPerLb + boilerEnergyCostPerLb + modCostPerLb + gifCostPerLb;

        // G. CATÁLOGO COMPLETO DE PRESENTACIONES COMERCIALES Y EMPAQUES
        const presentationsCatalog = [
            {
                id: 'cubeta 30LB',
                name: 'Cubeta 30 Lbs (Estándar)',
                short_name: 'Cubeta 30 Lb',
                lbs: 30.0,
                type: 'bucket',
                container_code: 'CUBETA-30LB',
                container_cost: parseFloat(packMap['CUBETA-30LB'] !== undefined ? packMap['CUBETA-30LB'] : 2.40),
                lid_code: 'TAPA-30LB',
                lid_cost: parseFloat(packMap['TAPA-30LB'] !== undefined ? packMap['TAPA-30LB'] : 0.65),
                liner_code: 'LINER-30LB',
                liner_cost: parseFloat(packMap['LINER-30LB'] !== undefined ? packMap['LINER-30LB'] : 0.30),
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'cubeta 32LB',
                name: 'Cubeta 32 Lbs',
                short_name: 'Cubeta 32 Lb',
                lbs: 32.0,
                type: 'bucket',
                container_code: 'CUBETA-30LB',
                container_cost: parseFloat(packMap['CUBETA-30LB'] !== undefined ? packMap['CUBETA-30LB'] : 2.40),
                lid_code: 'TAPA-30LB',
                lid_cost: parseFloat(packMap['TAPA-30LB'] !== undefined ? packMap['TAPA-30LB'] : 0.65),
                liner_code: 'LINER-30LB',
                liner_cost: parseFloat(packMap['LINER-30LB'] !== undefined ? packMap['LINER-30LB'] : 0.30),
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'galon 8LB',
                name: 'Galón 8 Lbs',
                short_name: 'Galón 8 Lb',
                lbs: 8.0,
                type: 'bottle',
                container_code: 'GALON-8LB',
                container_cost: parseFloat(packMap['GALON-8LB'] !== undefined ? packMap['GALON-8LB'] : 0.85),
                lid_code: 'TAPA-GALON',
                lid_cost: parseFloat(packMap['TAPA-GALON'] !== undefined ? packMap['TAPA-GALON'] : 0.15),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'medio galon 4LB',
                name: 'Medio Galón 4 Lbs',
                short_name: 'Medio Galón 4 Lb',
                lbs: 4.0,
                type: 'bottle',
                container_code: 'MEDIO-GALON',
                container_cost: parseFloat(packMap['MEDIO-GALON'] !== undefined ? packMap['MEDIO-GALON'] : 0.55),
                lid_code: 'TAPA-MEDIO-GALON',
                lid_cost: parseFloat(packMap['TAPA-MEDIO-GALON'] !== undefined ? packMap['TAPA-MEDIO-GALON'] : 0.10),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'litro 2LB',
                name: 'Litro 2 Lbs',
                short_name: 'Litro 2 Lb',
                lbs: 2.0,
                type: 'flask',
                container_code: 'LITRO-2LB',
                container_cost: parseFloat(packMap['LITRO-2LB'] !== undefined ? packMap['LITRO-2LB'] : 0.35),
                lid_code: 'TAPA-LITRO',
                lid_cost: parseFloat(packMap['TAPA-LITRO'] !== undefined ? packMap['TAPA-LITRO'] : 0.08),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            },
            {
                id: 'medio litro 1LB',
                name: 'Medio Litro 1 Lb',
                short_name: 'Medio Litro 1 Lb',
                lbs: 1.0,
                type: 'flask',
                container_code: 'MEDIO-LITRO-1LB',
                container_cost: parseFloat(packMap['MEDIO-LITRO-1LB'] !== undefined ? packMap['MEDIO-LITRO-1LB'] : 0.25),
                lid_code: 'TAPA-MEDIO-LITRO',
                lid_cost: parseFloat(packMap['TAPA-MEDIO-LITRO'] !== undefined ? packMap['TAPA-MEDIO-LITRO'] : 0.05),
                liner_code: null,
                liner_cost: 0,
                label_code: 'ETIQ-4X2',
                label_cost: parseFloat(packMap['ETIQ-4X2'] !== undefined ? packMap['ETIQ-4X2'] : 0.035)
            }
        ];

        // Determinar presentación activa seleccionada en el formulario
        const presLower = (presentation || '').toLowerCase();
        let activePresentation = presentationsCatalog.find(p => {
            return p.id.toLowerCase() === presLower ||
                   (presLower.includes('32') && p.lbs === 32) ||
                   (presLower.includes('30') && p.lbs === 30) ||
                   (presLower.includes('8') && p.lbs === 8) ||
                   (presLower.includes('4') && p.lbs === 4) ||
                   (presLower.includes('2') && p.lbs === 2) ||
                   (presLower.includes('1') && p.lbs === 1);
        });
        if (!activePresentation) {
            activePresentation = presentationsCatalog[0]; // Cubeta 30 Lb por defecto
        }

        const presentationLbs = activePresentation.lbs;
        const packagingCostPerUnit = activePresentation.container_cost + activePresentation.lid_cost + activePresentation.liner_cost + activePresentation.label_cost;
        const packagingCostPerLb = packagingCostPerUnit / presentationLbs;

        // H. COSTO TOTAL POR LIBRA DE LA PRESENTACIÓN SELECCIONADA
        const totalCostPerLb = baseOperatingCostPerLb + packagingCostPerLb;

        // I. MATRIZ MULTIFORMATO COMPARATIVA POR PRESENTACIÓN (IMPACTO DE EMPAQUE)
        const targetPriceNum = parseFloat(target_sale_price_per_lb) || 0;
        const presentationsComparison = presentationsCatalog.map(p => {
            const packCostUnit = p.container_cost + p.lid_cost + p.liner_cost + p.label_cost;
            const packCostLb = packCostUnit / p.lbs;
            const totCostLb = baseOperatingCostPerLb + packCostLb;
            const totCostUnit = totCostLb * p.lbs;
            const unitsInBatch = Math.floor(safeBatchSize / p.lbs);

            // Precios sugeridos con márgenes comunes
            const priceSug15Lb = totCostLb / (1 - 0.15);
            const priceSug20Lb = totCostLb / (1 - 0.20);
            const priceSug25Lb = totCostLb / (1 - 0.25);
            const priceSug30Lb = totCostLb / (1 - 0.30);

            // Simulación con precio libre
            let simSalePriceUnit = 0;
            let simMarginLb = 0;
            let simMarginPct = 0;
            let simGainUnit = 0;
            let simBatchGain = 0;
            let simStatus = 'red';

            if (targetPriceNum > 0) {
                simSalePriceUnit = targetPriceNum * p.lbs;
                simMarginLb = targetPriceNum - totCostLb;
                simMarginPct = (simMarginLb / targetPriceNum) * 100;
                simGainUnit = simMarginLb * p.lbs;
                simBatchGain = simGainUnit * unitsInBatch;
                simStatus = simMarginPct >= 20 ? 'green' : (simMarginPct >= 10 ? 'yellow' : 'red');
            }

            const isCurrent = p.id.toLowerCase() === activePresentation.id.toLowerCase();

            return {
                id: p.id,
                name: p.name,
                short_name: p.short_name,
                lbs: p.lbs,
                type: p.type,
                is_current: isCurrent,
                packaging_cost_unit: packCostUnit,
                packaging_cost_lb: packCostLb,
                packaging_breakdown: {
                    container_code: p.container_code,
                    container_cost: p.container_cost,
                    lid_code: p.lid_code,
                    lid_cost: p.lid_cost,
                    liner_code: p.liner_code,
                    liner_cost: p.liner_cost,
                    label_code: p.label_code,
                    label_cost: p.label_cost
                },
                base_operating_cost_per_lb: baseOperatingCostPerLb,
                total_cost_per_lb: totCostLb,
                total_cost_per_unit: totCostUnit,
                units_in_batch: unitsInBatch,
                suggested_prices: {
                    margin_15: { price_lb: priceSug15Lb, price_unit: priceSug15Lb * p.lbs },
                    margin_20: { price_lb: priceSug20Lb, price_unit: priceSug20Lb * p.lbs },
                    margin_25: { price_lb: priceSug25Lb, price_unit: priceSug25Lb * p.lbs },
                    margin_30: { price_lb: priceSug30Lb, price_unit: priceSug30Lb * p.lbs }
                },
                simulation: {
                    target_price_lb: targetPriceNum,
                    sale_price_unit: simSalePriceUnit,
                    margin_per_lb: simMarginLb,
                    margin_pct: simMarginPct,
                    gain_per_unit: simGainUnit,
                    total_batch_gain: simBatchGain,
                    status: simStatus
                }
            };
        });

        // J. ANÁLISIS DE RENTABILIDAD CON CLIENTES
        const todayStr = new Date().toISOString().split('T')[0];
        const clientsComparison = agreements.map(agr => {
            const clientPrice = parseFloat(agr.agreed_price_per_lb) || 0;
            const freight = parseFloat(agr.freight_cost_per_lb) || 0;
            const effectiveCost = totalCostPerLb + freight;
            const marginPerLb = clientPrice - effectiveCost;
            const marginPct = clientPrice > 0 ? (marginPerLb / clientPrice) * 100 : 0;

            let status = 'red';
            if (marginPct >= (parseFloat(agr.target_margin_pct) || 20)) {
                status = 'green';
            } else if (marginPct >= 10) {
                status = 'yellow';
            }

            let bonoRate = 0;
            if (marginPct >= 20) bonoRate = 0.015;
            else if (marginPct >= 15) bonoRate = 0.010;
            else if (marginPct >= 10) bonoRate = 0.005;

            const monthlyVol = parseFloat(agr.monthly_volume_lbs) || 0;
            const monthlyRevenue = monthlyVol * clientPrice;
            const monthlyProfit = monthlyVol * marginPerLb;
            const simulatedBonus = monthlyRevenue * bonoRate;

            const fromStr = agr.valid_from ? new Date(agr.valid_from).toISOString().split('T')[0] : null;
            const toStr = agr.valid_to ? new Date(agr.valid_to).toISOString().split('T')[0] : null;
            let validityStatus = 'vigente';
            let daysRemaining = null;

            if (toStr && toStr < todayStr) {
                validityStatus = 'vencido';
            } else if (fromStr && fromStr > todayStr) {
                validityStatus = 'programado';
            } else if (toStr) {
                const diffTime = new Date(toStr) - new Date(todayStr);
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                validityStatus = daysRemaining <= 30 ? 'por_vencer' : 'vigente';
            }

            let isValidInPeriod = true;
            if (start_date && toStr && toStr < start_date) isValidInPeriod = false;
            if (end_date && fromStr && fromStr > end_date) isValidInPeriod = false;

            return {
                id: agr.id,
                customer_name: agr.customer_name,
                product_type: agr.product_type,
                presentation: agr.presentation,
                agreed_price: clientPrice,
                freight_per_lb: freight,
                effective_cost: effectiveCost,
                margin_per_lb: marginPerLb,
                margin_pct: marginPct,
                target_margin_pct: parseFloat(agr.target_margin_pct) || 20,
                status,
                valid_from: fromStr,
                valid_to: toStr,
                validity_status: validityStatus,
                days_remaining: daysRemaining,
                is_valid_in_period: isValidInPeriod,
                monthly_volume_lbs: monthlyVol,
                monthly_revenue: monthlyRevenue,
                monthly_profit: monthlyProfit,
                simulated_bonus: simulatedBonus,
                bono_rate_pct: bonoRate * 100
            };
        });

        // Matriz de Precios Sugeridos por Margen (10%, 15%, 20%, 25%, 30%)
        const marginTargets = [10, 15, 20, 25, 30];
        const marginMatrix = marginTargets.map(pct => {
            const suggestedPrice = totalCostPerLb > 0 ? totalCostPerLb / (1 - (pct / 100)) : 0;
            const gainPerLb = suggestedPrice - totalCostPerLb;
            const batchGain = gainPerLb * safeBatchSize;
            return {
                margin_target_pct: pct,
                suggested_price_per_lb: suggestedPrice,
                suggested_price_per_presentation: suggestedPrice * presentationLbs,
                gain_per_lb: gainPerLb,
                batch_gain: batchGain
            };
        });

        // Simulación con precio libre
        const targetPrice = parseFloat(target_sale_price_per_lb) || 0;
        const marginLb = targetPrice - totalCostPerLb;
        const marginPct = targetPrice > 0 ? (marginLb / targetPrice) * 100 : 0;
        const targetSimulation = {
            price: targetPrice,
            cost: totalCostPerLb,
            margin_per_lb: marginLb,
            margin_pct: marginPct,
            status: marginPct >= 20 ? 'green' : (marginPct >= 10 ? 'yellow' : 'red'),
            margin_matrix: marginMatrix
        };

        return ({ status: 200, body: {
            product_type,
            presentation,
            presentation_lbs: presentationLbs,
            batch_size_lbs,
            raw_egg_box_cost,
            breakdown: {
                base_operating_cost_per_lb: baseOperatingCostPerLb,
                mp_cost_per_lb: mpCostPerLb,
                packaging_cost_per_lb: packagingCostPerLb,
                packaging_cost_per_unit: packagingCostPerUnit,
                cip_cost_per_lb: cipCostPerLb,
                cip_total_batch_cost: totalCipBatchCost,
                boiler_energy_cost_per_lb: boilerEnergyCostPerLb,
                boiler_total_batch_cost: totalBoilerEnergyBatchCost,
                mod_cost_per_lb: modCostPerLb,
                gif_cost_per_lb: gifCostPerLb,
                gif_monthly_total: monthlyGifTotal,
                total_cost_per_lb: totalCostPerLb,
                cost_per_unit: totalCostPerLb * presentationLbs
            },
            formulation,
            separation_data: separationData,
            presentations_comparison: presentationsComparison,
            clients_comparison: clientsComparison,
            target_simulation: targetSimulation,
            parameters_used: {
                liquid_yield_pct: liquidYieldPct * 100,
                water_added_pct: effectiveWaterPct * 100,
                sugar_added_pct: effectiveSugarPct * 100,
                salt_added_pct: effectiveSaltPct * 100,
                milk_added_pct: effectiveMilkPct * 100,
                base_egg_solids: bSolids,
                target_solids: tSolids,
                monthly_projected_lbs: monthlyProjectedLbs,
                monthly_gif: monthlyGifTotal
            }
        }, headers: responseHeaders });

    } catch (error) {
        return ({ status: 500, body: { message: error.message }, headers: responseHeaders });
    }
};
module.exports = calculateDynamicCost;
