export const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
export const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";

export const yearNow = new Date().getFullYear();
export const monthNow = new Date().getMonth() + 1;
export const years = Array.from({ length: 10 }, (_, i) => yearNow - 5 + i);
export const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

export const calcularTarifaDetalle = (d, sueldoBase) => {
    const sueldo = parseFloat(sueldoBase || 0);
    const sueldoDiario = sueldo / 30;
    const valorHoraOrdinaria = sueldoDiario / 8;

    if (d.tipo_valor === 'horas') {
        let factor = 2.0;
        const descUpper = (d.descripcion || '').toUpperCase();
        if (d.valor_base_config && parseFloat(d.valor_base_config) > 0) {
            const vb = parseFloat(d.valor_base_config);
            if (vb <= 5) factor = vb;
            else return vb;
        } else if (descUpper.includes('NOCTURNA')) {
            factor = 2.5;
        } else if (d.operacion === 'restar') {
            factor = 1.0;
        } else {
            factor = 2.0;
        }
        return valorHoraOrdinaria * factor;
    }

    if (d.tipo_valor === 'dias') {
        let factor = 1.0;
        if (d.valor_base_config && parseFloat(d.valor_base_config) > 0) {
            const vb = parseFloat(d.valor_base_config);
            if (vb <= 5) factor = vb;
        }
        return sueldoDiario * factor;
    }

    return 1;
};

export const calcularMontoDetalle = (d, cantidad, sueldoBase) => {
    const qty = parseFloat(cantidad) || 0;
    const sueldo = parseFloat(sueldoBase || 0);

    if (d.tipo_valor === 'horas') {
        const tarifa = calcularTarifaDetalle(d, sueldo);
        return Math.round(qty * tarifa * 100) / 100;
    }

    if (d.tipo_valor === 'dias') {
        const tarifa = calcularTarifaDetalle(d, sueldo);
        return Math.round(qty * tarifa * 100) / 100;
    }

    if (d.tipo_valor === 'porcentaje') {
        const pct = parseFloat(cantidad ?? d.valor_base_config ?? d.valor_base ?? 0) || 0;
        return Math.round(sueldo * (pct / 100) * 100) / 100;
    }

    // tipo_valor === 'valor'
    return Math.round(qty * 100) / 100;
};

