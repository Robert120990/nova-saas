const { isBonificacionCuenta } = require('./shared');

const cargarCuentasPorDefecto = async (pool, planillaId, companyId, diasTrabajados, sueldoBase, empleadoId = null, quincena = 'primera', bonificacionFija = 0) => {
    const [cuentas] = await pool.query(
        `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
        [companyId]
    );

    if (cuentas.length === 0) return;

    let empDescuentos = [];
    let bonifFija = parseFloat(bonificacionFija || 0);
    if (empleadoId) {
        const [dRows] = await pool.query(
            `SELECT ed.*, dp.cuenta_id, dp.codigo as desc_codigo, dp.descripcion as desc_nombre
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados dp ON ed.descuento_id = dp.id
             WHERE ed.company_id = ? AND ed.empleado_id = ? AND ed.activo = 1 AND ed.cuotas_restantes > 0
               AND (ed.quincena = 'ambas' OR ed.quincena = ?)`,
            [companyId, empleadoId, quincena]
        );
        empDescuentos = dRows;

        if (!bonifFija) {
            const [empRows] = await pool.query(
                `SELECT bonificacion_fija FROM rh_empleados WHERE id = ? AND company_id = ?`,
                [empleadoId, companyId]
            );
            if (empRows.length > 0) {
                bonifFija = parseFloat(empRows[0].bonificacion_fija || 0);
            }
        }
    }

    const sueldoDiario = sueldoBase / 30;
    const values = cuentas.map(c => {
        let valor = 0;
        let cantidad = 0;

        if (c.operacion === 'sumar') {
            if (isBonificacionCuenta(c)) {
                valor = Math.round(bonifFija * 100) / 100;
                cantidad = valor;
            } else if (c.tipo_valor === 'dias') {
                if (c.codigo === '01') {
                    cantidad = diasTrabajados;
                    valor = sueldoDiario * diasTrabajados;
                }
            } else if (c.tipo_valor === 'valor') {
                valor = parseFloat(c.valor_base || 0);
                cantidad = valor;
            } else if (c.tipo_valor === 'porcentaje') {
                const pct = parseFloat(c.valor_base || 0);
                cantidad = pct;
                valor = sueldoBase * (pct / 100);
            } else if (c.tipo_valor === 'horas') {
                const hrs = parseFloat(c.valor_base || 0);
                cantidad = hrs;
                if (hrs > 0) {
                    const isNocturna = (c.descripcion || '').toUpperCase().includes('NOCTURNA');
                    const factor = isNocturna ? 2.5 : 2.0;
                    valor = (sueldoDiario / 8 * factor) * hrs;
                }
            }
        } else {
            const matchingDiscounts = empDescuentos.filter(d => {
                if (d.cuenta_id && d.cuenta_id === c.id) return true;
                const descD = (d.desc_nombre || '').toLowerCase();
                const descC = (c.descripcion || '').toLowerCase();
                if (descD.includes('prestamo') && descC.includes('prestamo')) return true;
                if (descD.includes('procuraduria') && descC.includes('procuraduria')) return true;
                if ((descD.includes('fondo social') || descD.includes('fsv')) && (descC.includes('fondo social') || descC.includes('fsv'))) return true;
                if (descD.includes('anticipo') && descC.includes('anticipo')) return true;
                return false;
            });

            if (matchingDiscounts.length > 0) {
                valor = matchingDiscounts.reduce((s, d) => s + parseFloat(d.valor || 0), 0);
                cantidad = valor;
            } else if (c.tipo_valor === 'valor') {
                valor = parseFloat(c.valor_base || 0);
                cantidad = valor;
            } else if (c.tipo_valor === 'porcentaje') {
                const pct = parseFloat(c.valor_base || 0);
                cantidad = pct;
                valor = sueldoBase * (pct / 100);
            }
        }

        return [
            planillaId, c.id, c.codigo, c.descripcion,
            c.operacion, c.tipo_valor, cantidad || null, Math.round(valor * 100) / 100, c.orden || 0
        ];
    });

    await pool.query(
        `INSERT INTO rh_planilla_detalles 
         (planilla_id, cuenta_id, codigo, descripcion, operacion, tipo_valor, valor_base, valor_ingresado, orden)
         VALUES ?`,
        [values]
    );
};

module.exports = { cargarCuentasPorDefecto };
