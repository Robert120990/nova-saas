const { TABLE, isBonificacionCuenta } = require('../../services/rhPayroll/shared');

const { payrollRevision } = require('../../services/rhPayroll/revision.service');
const { executePayrollMutation } = require('../../services/rhPayroll/transaction.service');
const getEmpleadoData = async (req, res, pool) => {
    try {
        const { id } = req.params;
        const { periodo_anio, periodo_mes, quincena } = req.query;
        const [rows] = await pool.query(
            `SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.bonificacion_fija,
                    e.afp_id, e.cargo_id, e.departamento_personal_id, e.num_dui, e.num_nit,
                    e.fecha_ingreso, e.es_jubilado, e.en_vacaciones, e.incapacitado,
                    c.descripcion as cargo_nombre,
                    d.descripcion as departamento_nombre
             FROM rh_empleados e
             LEFT JOIN rh_cargos c ON e.cargo_id = c.id
             LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
             WHERE e.id = ? AND e.company_id = ?`,
            [id, req.company_id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Empleado no encontrado' });
        const emp = rows[0];

        let planillaId = null, detalles = [], totales = null, pRows = [];

        const [empDescuentos] = await pool.query(
            `SELECT ed.*, dp.cuenta_id, dp.codigo as desc_codigo, dp.descripcion as desc_nombre,
                    cp.codigo as cuenta_codigo, cp.descripcion as cuenta_descripcion
             FROM rh_empleado_descuentos ed
             JOIN rh_descuentos_programados dp ON ed.descuento_id = dp.id
             LEFT JOIN rh_cuentas_planillas cp ON dp.cuenta_id = cp.id
             WHERE ed.company_id = ? AND ed.empleado_id = ? AND ed.activo = 1 AND ed.cuotas_restantes > 0
               AND (ed.quincena = 'ambas' OR ed.quincena = ?)`,
            [req.company_id, id, quincena || 'primera']
        );

        if (periodo_anio && periodo_mes && quincena) {
            const [planillas] = await pool.query(
                `SELECT id FROM ${TABLE} WHERE company_id = ? AND empleado_id = ? AND periodo_anio = ? AND periodo_mes = ? AND quincena = ?`,
                [req.company_id, id, periodo_anio, periodo_mes, quincena]
            );
            if (planillas.length > 0) {
                planillaId = planillas[0].id;
                const [dRows] = await pool.query(
                    `SELECT * FROM rh_planilla_detalles WHERE planilla_id = ? ORDER BY codigo ASC`,
                    [planillaId]
                );
                detalles = dRows;
                const [pRowsData] = await pool.query(
                    `SELECT total_percepciones, total_deducciones, descuento_isss, descuento_afp, descuento_renta, monto_recibir, dias_trabajados, sueldo_base, bonificacion_fija, estado
                     FROM ${TABLE} WHERE id = ?`,
                    [planillaId]
                );
                pRows = pRowsData;
                if (pRows.length > 0) {
                    const row = pRows[0];
                    const otrasDed = dRows.filter(d => d.operacion === 'restar').reduce((s, d) => s + parseFloat(d.valor_ingresado || 0), 0);
                    const isss = parseFloat(row.descuento_isss || 0);
                    const afp = parseFloat(row.descuento_afp || 0);
                    const renta = parseFloat(row.descuento_renta || 0);
                    const totalDed = Math.round((isss + afp + renta + otrasDed) * 100) / 100;
                    const totPercep = parseFloat(row.total_percepciones || 0);
                    const neto = Math.round((totPercep - totalDed) * 100) / 100;
                    totales = {
                        ...row,
                        total_deducciones_cuentas: otrasDed,
                        total_deducciones: totalDed,
                        monto_recibir: neto
                    };
                }
            }
        }

        if (!planillaId) {
            const [cuentas] = await pool.query(
                `SELECT * FROM rh_cuentas_planillas WHERE company_id = ? AND activa = 1 ORDER BY codigo ASC`,
                [req.company_id]
            );
            const sueldoBase = parseFloat(emp.sueldo_base || 0);
            const bonificacionFija = parseFloat(emp.bonificacion_fija || 0);
            const sueldoDiario = sueldoBase / 30;
            const dias = 15;

            detalles = cuentas.map(c => {
                let valor = 0;
                let cantidad = 0;

                if (c.operacion === 'sumar') {
                    if (isBonificacionCuenta(c)) {
                        valor = Math.round(bonificacionFija * 100) / 100;
                        cantidad = valor;
                    } else if (c.tipo_valor === 'dias' && c.codigo === '01') {
                        cantidad = dias;
                        valor = Math.round(sueldoDiario * dias * 100) / 100;
                    } else if (c.tipo_valor === 'valor') {
                        valor = parseFloat(c.valor_base || 0);
                        cantidad = valor;
                    } else if (c.tipo_valor === 'porcentaje') {
                        const pct = parseFloat(c.valor_base || 0);
                        cantidad = pct;
                        valor = Math.round(sueldoBase * (pct / 100) * 100) / 100;
                    }
                } else {
                    const matching = empDescuentos.filter(d => {
                        if (d.cuenta_id && d.cuenta_id === c.id) return true;
                        const descD = (d.desc_nombre || '').toLowerCase();
                        const descC = (c.descripcion || '').toLowerCase();
                        if (descD.includes('prestamo') && descC.includes('prestamo')) return true;
                        if (descD.includes('procuraduria') && descC.includes('procuraduria')) return true;
                        if ((descD.includes('fondo social') || descD.includes('fsv')) && (descC.includes('fondo social') || descC.includes('fsv'))) return true;
                        if (descD.includes('anticipo') && descC.includes('anticipo')) return true;
                        return false;
                    });

                    if (matching.length > 0) {
                        valor = Math.round(matching.reduce((s, d) => s + parseFloat(d.valor || 0), 0) * 100) / 100;
                        cantidad = valor;
                    } else if (c.tipo_valor === 'valor') {
                        valor = parseFloat(c.valor_base || 0);
                        cantidad = valor;
                    } else if (c.tipo_valor === 'porcentaje') {
                        const pct = parseFloat(c.valor_base || 0);
                        cantidad = pct;
                        valor = Math.round(sueldoBase * (pct / 100) * 100) / 100;
                    }
                }

                return {
                    cuenta_id: c.id,
                    codigo: c.codigo,
                    descripcion: c.descripcion,
                    operacion: c.operacion,
                    tipo_valor: c.tipo_valor,
                    valor_base: cantidad || null,
                    cantidad: cantidad || 0,
                    valor_ingresado: valor,
                    orden: c.orden || 0
                };
            });
        }

        const diasTrabajadosVal = pRows.length > 0 && pRows[0].dias_trabajados !== undefined && pRows[0].dias_trabajados !== null
            ? parseInt(pRows[0].dias_trabajados)
            : (emp.en_vacaciones === 1 || emp.incapacitado === 1 ? 0 : 15);

        res.json({
            ...emp,
            empleado_sueldo_base: emp.sueldo_base,
            empleado_bonificacion_fija: emp.bonificacion_fija,
            sueldo_base: pRows[0]?.sueldo_base ?? emp.sueldo_base,
            bonificacion_fija: pRows[0]?.bonificacion_fija ?? emp.bonificacion_fija,
            planilla_id: planillaId,
            revision: pRows.length ? payrollRevision(pRows[0], detalles) : null,
            dias_trabajados: diasTrabajadosVal,
            detalles,
            totales: totales ? { ...totales, dias_trabajados: diasTrabajadosVal } : null,
            descuentos_programados: empDescuentos
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getEmpleadoData: async (req, res) => {
        const result = await executePayrollMutation(getEmpleadoData, req);
        res.status(result.statusCode).json(result.body);
    }
};
