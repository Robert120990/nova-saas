/**
 * POS Promotions and Calculation Utilities
 * Sipe Web SaaS
 */

/**
 * Determines whether a promotion is currently applicable based on day of week and time window.
 * 
 * @param {Object} promo 
 * @param {Date} [now=new Date()] 
 * @returns {boolean}
 */
export const isPromoApplicableNow = (promo, now = new Date()) => {
    if (!promo) return false;
    const jsDay = now.getDay();
    const currentIsoDay = jsDay === 0 ? 7 : jsDay;
    if (Array.isArray(promo.days_of_week) && promo.days_of_week.length > 0) {
        if (!promo.days_of_week.includes(currentIsoDay)) {
            return false;
        }
    }
    if (promo.start_time || promo.end_time) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (promo.start_time) {
            const [sh, sm] = String(promo.start_time).split(':').map(Number);
            if (currentMinutes < (sh * 60 + sm)) return false;
        }
        if (promo.end_time) {
            const [eh, em] = String(promo.end_time).split(':').map(Number);
            if (currentMinutes > (eh * 60 + em)) return false;
        }
    }
    return true;
};

/**
 * Computes the promotion discount, applied metadata, and upsell recommendation.
 * 
 * @param {Object} promo 
 * @param {number} qty 
 * @param {number} price 
 * @param {number} discountableBase 
 * @returns {{ discount: number, promoApplied: Object|null, upsellPromo: Object|null }}
 */
export const computePromotionDiscount = (promo, qty, price, discountableBase) => {
    if (!promo || qty <= 0 || price <= 0 || discountableBase <= 0) {
        return { discount: 0, promoApplied: null, upsellPromo: null };
    }

    let discount = 0;
    let promoApplied = null;
    let upsellPromo = null;

    const maxApps = promo.max_applications_per_sale && promo.max_applications_per_sale > 0 
        ? promo.max_applications_per_sale 
        : Infinity;

    switch (promo.promotion_type) {
        case 'nxm': {
            const buyQty = Math.max(1, promo.buy_quantity || 2);
            const payQty = Math.max(1, promo.pay_quantity || 1);
            const freePerGroup = Math.max(0, buyQty - payQty);
            const totalGroupsPossible = Math.floor(qty / buyQty);
            const appliedGroups = Math.min(totalGroupsPossible, maxApps);

            if (appliedGroups > 0 && freePerGroup > 0) {
                const freeUnits = appliedGroups * freePerGroup;
                discount = Math.round(freeUnits * price * 100) / 100;
                discount = Math.min(discount, discountableBase);
                promoApplied = {
                    id: promo.id,
                    name: promo.name,
                    type: 'nxm',
                    discount,
                    details: `${buyQty}x${payQty}`
                };
            }

            if (appliedGroups < maxApps) {
                const remainder = qty % buyQty;
                if (remainder > 0) {
                    const missing = buyQty - remainder;
                    upsellPromo = {
                        promoId: promo.id,
                        name: promo.name,
                        hint: missing === 1 ? '¡Lleva 1 más y es gratis!' : `¡Lleva ${missing} más para promo ${buyQty}x${payQty}!`,
                        targetQty: qty + missing
                    };
                }
            }
            break;
        }

        case 'second_unit_discount': {
            const buyBase = Math.max(1, promo.buy_quantity || 1);
            const cycleSize = buyBase + 1;
            const pct = Math.max(0, Math.min(100, promo.discount_percentage || 50));
            const totalCyclesPossible = Math.floor(qty / cycleSize);
            const appliedCycles = Math.min(totalCyclesPossible, maxApps);

            if (appliedCycles > 0 && pct > 0) {
                const discPerCycle = Math.round(price * (pct / 100) * 100) / 100;
                discount = Math.round(appliedCycles * discPerCycle * 100) / 100;
                discount = Math.min(discount, discountableBase);
                promoApplied = {
                    id: promo.id,
                    name: promo.name,
                    type: 'second_unit_discount',
                    discount,
                    details: `2da al ${pct}%`
                };
            }

            if (appliedCycles < maxApps) {
                const remainder = qty % cycleSize;
                if (remainder > 0) {
                    const missing = cycleSize - remainder;
                    upsellPromo = {
                        promoId: promo.id,
                        name: promo.name,
                        hint: missing === 1 ? `¡Lleva 1 más al ${pct}% de desc.!` : `¡Lleva ${missing} más para descuento en siguiente unidad!`,
                        targetQty: qty + missing
                    };
                }
            }
            break;
        }

        case 'bundle_fixed_price': {
            const buyQty = Math.max(1, promo.buy_quantity || 2);
            const bundlePrice = parseFloat(promo.bundle_price) || 0;
            const normalBundlePrice = buyQty * price;
            const savingsPerBundle = Math.max(0, normalBundlePrice - bundlePrice);

            const totalGroupsPossible = Math.floor(qty / buyQty);
            const appliedGroups = Math.min(totalGroupsPossible, maxApps);

            if (appliedGroups > 0 && savingsPerBundle > 0) {
                discount = Math.round(appliedGroups * savingsPerBundle * 100) / 100;
                discount = Math.min(discount, discountableBase);
                promoApplied = {
                    id: promo.id,
                    name: promo.name,
                    type: 'bundle_fixed_price',
                    discount,
                    details: `${buyQty} por $${bundlePrice.toFixed(2)}`
                };
            }

            if (appliedGroups < maxApps) {
                const remainder = qty % buyQty;
                if (remainder > 0) {
                    const missing = buyQty - remainder;
                    upsellPromo = {
                        promoId: promo.id,
                        name: promo.name,
                        hint: `¡Lleva ${missing} más para paquete (${buyQty} por $${bundlePrice.toFixed(2)})!`,
                        targetQty: qty + missing
                    };
                }
            }
            break;
        }

        case 'volume_tier': {
            const minQty = Math.max(1, promo.buy_quantity || 1);
            const pct = Math.max(0, Math.min(100, promo.discount_percentage || 0));

            if (qty >= minQty && pct > 0) {
                discount = Math.round(discountableBase * (pct / 100) * 100) / 100;
                promoApplied = {
                    id: promo.id,
                    name: promo.name,
                    type: 'volume_tier',
                    discount,
                    details: `Volumen ≥${minQty} (${pct}%)`
                };
            } else if (qty < minQty) {
                const missing = Math.ceil(minQty - qty);
                upsellPromo = {
                    promoId: promo.id,
                    name: promo.name,
                    hint: `¡Lleva ${missing} más para obtener ${pct}% de desc. por volumen!`,
                    targetQty: minQty
                };
            }
            break;
        }

        default:
            break;
    }

    return { discount, promoApplied, upsellPromo };
};
