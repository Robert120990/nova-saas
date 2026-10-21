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

export const downloadBankFilesFromRows = ({ rows = [], bankConfigs = [], baseName = 'PLANILLA', formatoBancario = 'ambos', toast }) => {
    if (!Array.isArray(rows) || rows.length === 0) {
        toast?.error('Sin datos para los filtros seleccionados');
        return;
    }

    const sucBankMap = new Map();
    const depBankMap = new Map();
    (Array.isArray(bankConfigs) ? bankConfigs : []).forEach(c => {
        if (c.sucursal_id && !c.departamento_id) sucBankMap.set(Number(c.sucursal_id), c.formato_banco);
        if (c.departamento_id && !c.sucursal_id) depBankMap.set(Number(c.departamento_id), c.formato_banco);
    });

    const getEmpBankFormat = (r) => {
        const bId = r.branch_id ? Number(r.branch_id) : null;
        const dId = r.departamento_personal_id ? Number(r.departamento_personal_id) : null;
        if (dId && depBankMap.has(dId)) return depBankMap.get(dId);
        if (bId && sucBankMap.has(bId)) return sucBankMap.get(bId);
        return 'promerica';
    };

    const getFullName = (r) => `${r.empleado_nombres || r.nombres || ''} ${r.empleado_apellidos || r.apellidos || ''}`.trim();

    // Ordenar: empleados con cuenta bancaria válida al inicio, sin cuenta al final
    const sortedRows = [...rows].sort((a, b) => {
        const cuentaA = String(a.cuenta_planillera || '').trim();
        const cuentaB = String(b.cuenta_planillera || '').trim();
        const hasA = Boolean(cuentaA && cuentaA !== '0' && cuentaA !== '-');
        const hasB = Boolean(cuentaB && cuentaB !== '0' && cuentaB !== '-');
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        return 0;
    });

    // Formato Promerica: tabuladores (Cuenta \t Monto \t Nombre)
    const makePromericaRow = (r) => {
        const nombre = getFullName(r);
        const cuenta = r.cuenta_planillera || '';
        const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
        return `${cuenta}\t${monto}\t${nombre}`;
    };

    // Formato Banco Atlántida: 78 caracteres exactos por fila
    // Monto (18 ceros izq en centavos sin punto) + Nombre cliente (40 der espacios) + Cuenta (16 ceros izq) + Relleno (4 espacios)
    const makeAtlantidaRow = (r) => {
        const cents = Math.round(parseFloat(r.monto_recibir || 0) * 100);
        const montoStr = String(cents).padStart(18, '0');

        const rawName = getFullName(r);
        const cleanName = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        const nombreStr = cleanName.slice(0, 40).padEnd(40, ' ');

        const rawCuenta = String(r.cuenta_planillera || '').trim().replace(/[^0-9]/g, '');
        const cuentaPadded = rawCuenta.length <= 13 ? rawCuenta.padStart(16, '0') : rawCuenta.slice(0, 16).padStart(16, '0');
        const cuentaStr = cuentaPadded + '    ';

        return `${montoStr}${nombreStr}${cuentaStr}`;
    };

    // CSV general para Excel
    const csvRows = sortedRows.map(r => {
        const nombre = getFullName(r);
        const cuenta = r.cuenta_planillera || '';
        const monto = parseFloat(r.monto_recibir || 0).toFixed(2);
        const banco = getEmpBankFormat(r) === 'atlantida' ? 'BANCO ATLANTIDA' : 'BANCO PROMERICA';
        return `="${cuenta}",${monto},"${nombre}",${banco}`;
    });
    const contentCsv = '\uFEFF' + 'sep=,\n' + 'Cuenta,Monto,Empleado,Banco\n' + csvRows.join('\n');

    const atlantidaRows = sortedRows.filter(r => getEmpBankFormat(r) === 'atlantida');
    const promericaRows = sortedRows.filter(r => getEmpBankFormat(r) === 'promerica');

    const triggerDownload = (text, filename, mimeType) => {
        const blob = new Blob([text], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    };

    let downloadDelay = 0;

    if (formatoBancario === 'csv' || formatoBancario === 'ambos') {
        triggerDownload(contentCsv, `${baseName}.csv`, 'text/csv;charset=utf-8');
        downloadDelay += 250;
    }

    if (formatoBancario === 'txt' || formatoBancario === 'ambos') {
        if (atlantidaRows.length > 0 && promericaRows.length > 0) {
            setTimeout(() => {
                const contentAtlantida = atlantidaRows.map(makeAtlantidaRow).join('\r\n');
                triggerDownload(contentAtlantida, `${baseName}_ATLANTIDA.txt`, 'text/plain;charset=utf-8');
            }, downloadDelay);
            downloadDelay += 250;
            setTimeout(() => {
                const contentPromerica = promericaRows.map(makePromericaRow).join('\r\n');
                triggerDownload(contentPromerica, `${baseName}_PROMERICA.txt`, 'text/plain;charset=utf-8');
            }, downloadDelay);
            toast?.success(`Descargados: TXT Atlántida (${atlantidaRows.length} emp.) y TXT Promerica (${promericaRows.length} emp.)`);
        } else if (atlantidaRows.length > 0) {
            setTimeout(() => {
                const contentAtlantida = atlantidaRows.map(makeAtlantidaRow).join('\r\n');
                triggerDownload(contentAtlantida, `${baseName}_ATLANTIDA.txt`, 'text/plain;charset=utf-8');
            }, downloadDelay);
            toast?.success(`Archivo TXT Banco Atlántida (78 car.) descargado (${atlantidaRows.length} empleados)`);
        } else {
            setTimeout(() => {
                const contentPromerica = promericaRows.map(makePromericaRow).join('\r\n');
                triggerDownload(contentPromerica, `${baseName}_PROMERICA.txt`, 'text/plain;charset=utf-8');
            }, downloadDelay);
            toast?.success(`Archivo TXT Banco Promerica descargado (${promericaRows.length} empleados)`);
        }
    } else {
        toast?.success('Archivo CSV descargado con éxito');
    }
};

