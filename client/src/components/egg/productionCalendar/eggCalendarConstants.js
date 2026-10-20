import { getTodayString } from '../../../utils/dateUtils';

export const PRODUCT_PROFILES = [
    { id: 'Huevo Entero Pasteurizado', name: 'Huevo Entero Pasteurizado', defaultSolids: 23.5, color: 'indigo', desc: '83% rendimiento estándar' },
    { id: 'Huevo Rápido', name: 'Huevo Rápido', defaultSolids: 23.0, color: 'sky', desc: 'Formulación rápida institucional (cubeta 32LB)' },
    { id: 'Huevo Formulado por Separación', name: 'Huevo Formulado por Separación (Yema + MP liquida A)', defaultSolids: 22.5, color: 'emerald', desc: 'Venta de Clara + Yema con MP liquida A' },
    { id: 'Huevo Entero Plus', name: 'Huevo Entero Plus', defaultSolids: 21.5, color: 'cyan', desc: 'Con MP liquida A 8% y ácido cítrico' },
    { id: 'Clara de Huevo Pasteurizada', name: 'Clara de Huevo Pasteurizada', defaultSolids: 11.5, color: 'teal', desc: '54% rendimiento, alta demanda' },
    { id: 'Yema Azucarada', name: 'Yema Azucarada (4% azúcar)', defaultSolids: 48.0, color: 'amber', desc: 'Para panificación y repostería' },
    { id: 'Yema Salada', name: 'Yema Salada (10% sal)', defaultSolids: 47.0, color: 'orange', desc: 'Para aderezos y mayonesa' },
    { id: 'Huevo con Leche', name: 'Huevo Entero con Leche', defaultSolids: 22.0, color: 'purple', desc: 'Institucional / servicios de vuelo' }
];

export const FACTORY_ROLES = [
    'Quebrado y Carga',
    'Sanitización CIP',
    'Dosificación MP liquida A / Mezcla',
    'Pasteurización HACCP',
    'Control de Calidad LAB-004',
    'Empaque y Cuarto Frío',
    'Supervisor de Turno'
];

export const DEFAULT_PRESETS_BY_ROLE = {
    'Quebrado y Carga': 'Alinear y quebrar cajas de huevo blanco en cámara de quebrado.',
    'Sanitización CIP': 'Sanitizar pasteurizador con Ácido Peracético 1.5% a 78°C antes de iniciar.',
    'Dosificación MP liquida A / Mezcla': 'Medir y dosificar MP liquida A con ácido cítrico estabilizador.',
    'Pasteurización HACCP': 'Mantener régimen pasteurizador a 64.5°C por 210s monitoreando CCP-1.',
    'Control de Calidad LAB-004': 'Verificar refractómetro: Sólidos totales y pH antes de envasado.',
    'Empaque y Cuarto Frío': 'Alistar cubetas sanitizadas con liner alimentario y etiquetas de lote.'
};

export const PRESENTATIONS = [
    'cubeta 30LB',
    'cubeta 32LB',
    'galón 8LB',
    'galon 8LB',
    'medio galón 4LB',
    'medio galon 4LB',
    'litro 2LB',
    'bolsa 20LB'
];

export const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const findAgreementForProduct = (agreementsList, productType) => {
    if (!agreementsList || agreementsList.length === 0 || !productType) return null;

    const clean = (s) => (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim();

    const target = clean(productType);

    let match = agreementsList.find((a) => clean(a.product_type) === target);
    if (match) return match;

    if (target.includes('clara')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('clara') || clean(a.product_name).includes('clara'));
    } else if (target.includes('azucarada')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('azucar') || clean(a.product_name).includes('azucar'));
    } else if (target.includes('salada')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('salad') || clean(a.product_name).includes('salad'));
    } else if (target.includes('leche')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('leche') || clean(a.product_name).includes('leche'));
    } else if (target.includes('rapido')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('rapido') || clean(a.product_name).includes('rapido'));
    } else if (target.includes('plus')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('plus') || clean(a.product_name).includes('plus'));
    } else if (target.includes('formulado') || target.includes('separacion')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('formulado') || clean(a.product_type).includes('separacion'));
        if (!match) {
            match = agreementsList.find((a) => clean(a.product_type).includes('entero') && !clean(a.product_type).includes('plus'));
        }
    } else if (target.includes('entero')) {
        match = agreementsList.find((a) => clean(a.product_type).includes('entero') && !clean(a.product_type).includes('plus'));
    }

    if (match) return match;

    match = agreementsList.find((a) => {
        const pName = clean(a.product_name);
        return pName && (pName.includes(target) || target.includes(pName));
    });
    if (match) return match;

    if (agreementsList.length === 1 && parseFloat(agreementsList[0].agreed_price_per_lb) > 0) {
        return agreementsList[0];
    }

    return null;
};

export const recalculateMixFormula = (profileName, targetLbs) => {
    const qty = parseFloat(targetLbs) || 12000;
    const profLower = (profileName || '').toLowerCase();

    let rawLiquid = qty;
    let boxes = Math.round(qty / 36.1);
    let claraSepPct = 0;
    let claraLbs = 0;
    let yemaCoproduct = 0;
    let yemaReutilized = 0;
    let waterLbs = 0;
    let citricAcid = '0.00';
    let sugarLbs = '0.00';
    let saltLbs = '0.00';
    let milkLbs = '0.00';
    let solids = 23.5;
    let notes = '';

    if (profLower.includes('separaci') || profLower.includes('formulado')) {
        solids = 22.5;
        claraSepPct = 100;
        const yemaNeeded = qty / 2.22;
        rawLiquid = Math.round(yemaNeeded / 0.308);
        boxes = Math.round(rawLiquid / 36.1);
        claraLbs = Math.round(rawLiquid * 0.5395);
        yemaCoproduct = Math.round(yemaNeeded);
        yemaReutilized = yemaCoproduct;
        waterLbs = Math.round(qty - yemaNeeded);
        citricAcid = (qty * 0.0015).toFixed(2);
        notes = `Separar ${claraLbs.toLocaleString()} Lbs de clara pura para empaque. Reincorporar ${yemaReutilized.toLocaleString()} Lbs de yema coproducto con ${waterLbs.toLocaleString()} Lbs de MP liquida A y ${citricAcid} Lbs de ácido cítrico.`;
    } else if (profLower.includes('clara')) {
        solids = 11.5;
        rawLiquid = Math.round(qty / 0.5395);
        boxes = Math.round(rawLiquid / 36.1);
        claraSepPct = 100;
        claraLbs = qty;
        yemaCoproduct = Math.round(rawLiquid * 0.308);
        notes = `Corrida de separación de clara. Genera ${yemaCoproduct.toLocaleString()} Lbs de yema coproducto excedente.`;
    } else if (profLower.includes('plus')) {
        solids = 21.5;
        waterLbs = Math.round(qty * 0.08);
        rawLiquid = qty - waterLbs;
        boxes = Math.round(rawLiquid / 36.1);
        citricAcid = (qty * 0.0012).toFixed(2);
        notes = `Adicionar ${waterLbs.toLocaleString()} Lbs liquido(8%) y ${citricAcid} Lbs de ácido cítrico sobre ${rawLiquid.toLocaleString()} Lbs de huevo líquido base.`;
    } else if (profLower.includes('azucar')) {
        solids = 48.0;
        sugarLbs = (qty * 0.04).toFixed(2);
        rawLiquid = qty - parseFloat(sugarLbs);
        boxes = Math.round((rawLiquid / 0.308) / 36.1);
        notes = `Yema azucarada al 4%: mezclar ${rawLiquid.toLocaleString()} Lbs de yema con ${sugarLbs} Lbs de azúcar refinada.`;
    } else if (profLower.includes('salada')) {
        solids = 47.0;
        saltLbs = (qty * 0.10).toFixed(2);
        rawLiquid = qty - parseFloat(saltLbs);
        boxes = Math.round((rawLiquid / 0.308) / 36.1);
        notes = `Yema salada al 10%: mezclar ${rawLiquid.toLocaleString()} Lbs de yema con ${saltLbs} Lbs de sal no yodada.`;
    } else if (profLower.includes('leche')) {
        solids = 22.0;
        milkLbs = (qty * 0.06).toFixed(2);
        waterLbs = Math.round(qty * 0.04);
        rawLiquid = qty - parseFloat(milkLbs) - waterLbs;
        boxes = Math.round(rawLiquid / 36.1);
        notes = `Huevo con leche: dosificar ${milkLbs} Lbs de leche en polvo y ${waterLbs} Lbs de liquido.`;
    } else if (profLower.includes('rapido') || profLower.includes('rápido')) {
        solids = 23.0;
        rawLiquid = qty;
        boxes = Math.round(qty / 36.1);
        notes = `Huevo rápido pasteurizado (cubeta 32 Lbs): ${boxes.toLocaleString()} cajas estimadas para ${qty.toLocaleString()} Lbs.`;
    } else {
        solids = 23.5;
        rawLiquid = qty;
        boxes = Math.round(qty / 36.1);
        notes = `Huevo entero pasteurizado estándar al 83% de rendimiento (332 cajas aprox por batch de 12,000 Lbs).`;
    }

    const waterBottles = waterLbs > 0 ? Math.ceil(waterLbs / 41.8) : 0;

    return {
        raw_egg_boxes: boxes,
        raw_liquid_lbs: rawLiquid,
        clara_separated_pct: claraSepPct,
        clara_produced_lbs: claraLbs,
        yema_coproduct_lbs: yemaCoproduct,
        yema_reutilized_lbs: yemaReutilized,
        water_h2o_lbs: waterLbs,
        water_bottles: waterBottles,
        citric_acid_lbs: citricAcid,
        sugar_lbs: sugarLbs,
        salt_lbs: saltLbs,
        milk_powder_lbs: milkLbs,
        target_solids_pct: solids,
        notes
    };
};

export const getProfileBadgeStyle = (profile) => {
    const pLower = (profile || '').toLowerCase();
    if (pLower.includes('separaci') || pLower.includes('formulado')) {
        return {
            bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
            card: 'border-l-4 border-l-emerald-500 bg-emerald-50/50 hover:bg-emerald-50'
        };
    }
    if (pLower.includes('clara')) {
        return {
            bg: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
            card: 'border-l-4 border-l-teal-500 bg-teal-50/50 hover:bg-teal-50'
        };
    }
    if (pLower.includes('yema')) {
        return {
            bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
            card: 'border-l-4 border-l-amber-500 bg-amber-50/50 hover:bg-amber-50'
        };
    }
    if (pLower.includes('leche')) {
        return {
            bg: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
            card: 'border-l-4 border-l-purple-500 bg-purple-50/50 hover:bg-purple-50'
        };
    }
    if (pLower.includes('rapido') || pLower.includes('rápido')) {
        return {
            bg: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
            card: 'border-l-4 border-l-sky-500 bg-sky-50/50 hover:bg-sky-50'
        };
    }
    if (pLower.includes('plus')) {
        return {
            bg: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
            card: 'border-l-4 border-l-cyan-500 bg-cyan-50/50 hover:bg-cyan-50'
        };
    }
    return {
        bg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
        card: 'border-l-4 border-l-indigo-500 bg-indigo-50/40 hover:bg-indigo-50'
    };
};

export const buildCalendarMonthDays = (currentDate) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startingDayOfWeek === -1) startingDayOfWeek = 6;

    const totalDaysInMonth = lastDayOfMonth.getDate();
    const days = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const d = new Date(year, month - 1, prevMonthLastDay - i);
        days.push({ date: d, dateStr: getTodayString(d), isCurrentMonth: false, dayNumber: d.getDate() });
    }
    for (let i = 1; i <= totalDaysInMonth; i++) {
        const d = new Date(year, month, i);
        days.push({ date: d, dateStr: getTodayString(d), isCurrentMonth: true, dayNumber: i });
    }
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: d, dateStr: getTodayString(d), isCurrentMonth: false, dayNumber: i });
    }
    return days;
};
