const pool = require('../../config/db');

const calculate = async (filters, companyId) => {
        const { año, mes, departamento_id } = filters;
        if (!año) throw Object.assign(new Error('año requerido'), { status: 400 });

        const anio = parseInt(año);
        const mesNum = parseInt(mes) || 12;
        const periodStart = `${anio - 1}-12-12`;
        const periodEnd = `${anio}-12-12`;

        // Get active aguinaldo config
        const today = new Date().toISOString().split('T')[0];
        const [configRows] = await pool.query(
            `SELECT ac.id FROM rh_aguinaldo_config ac
             WHERE ac.company_id = ? AND ac.fecha_desde <= ? AND (ac.fecha_hasta IS NULL OR ac.fecha_hasta >= ?)
             ORDER BY ac.fecha_desde DESC LIMIT 1`,
            [companyId, today, today]
        );

        let detalles = [];
        if (configRows.length > 0) {
            const [detRows] = await pool.query(
                `SELECT anios_desde, anios_hasta, dias_aguinaldo FROM rh_aguinaldo_config_detalle
                 WHERE aguinaldo_config_id = ? ORDER BY anios_desde ASC`,
                [configRows[0].id]
            );
            detalles = detRows;
        }

        // Get active employees
        let empQuery = `
            SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.fecha_ingreso,
                   e.departamento_personal_id, e.cargo_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.company_id = ? AND e.es_activo = 1
        `;
        let params = [companyId];

        if (departamento_id) {
            empQuery += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }

        empQuery += ` ORDER BY e.codigo ASC`;
        const [empleados] = await pool.query(empQuery, params);

        const results = [];

        for (const emp of empleados) {
            // Find last indemnizacion date
            const [liqRows] = await pool.query(
                `SELECT MAX(periodo_indemnizacion_hasta) as ultima_indemnizacion
                 FROM rh_planilla_liquidaciones
                 WHERE empleado_id = ? AND company_id = ? AND periodo_indemnizacion_hasta IS NOT NULL`,
                [emp.id, companyId]
            );
            const ultimaIndemnizacion = liqRows[0]?.ultima_indemnizacion || null;

            const fechaBase = ultimaIndemnizacion
                ? new Date(ultimaIndemnizacion)
                : (emp.fecha_ingreso ? new Date(emp.fecha_ingreso) : null);

            if (!fechaBase) continue;

            const pEnd = new Date(periodEnd);
            const pStart = new Date(periodStart);

            // Días de antigüedad (desde fecha_base hasta period_end)
            const diasAntiguedad = Math.max(0, Math.ceil((pEnd - fechaBase) / (1000 * 60 * 60 * 24)) + 1);
            const aniosServicio = Math.floor(diasAntiguedad / 365);

            // Find matching dias_segun_tabla from config
            let diasSegunTabla = 0;
            if (detalles.length > 0) {
                const match = detalles.find(d => aniosServicio >= d.anios_desde && aniosServicio <= d.anios_hasta);
                if (match) {
                    diasSegunTabla = parseFloat(match.dias_aguinaldo);
                } else if (aniosServicio < detalles[0].anios_desde) {
                    diasSegunTabla = parseFloat(detalles[0].dias_aguinaldo);
                } else {
                    diasSegunTabla = parseFloat(detalles[detalles.length - 1].dias_aguinaldo);
                }
            }

            // Proportional calculation
            const sueldo = parseFloat(emp.sueldo_base) || 0;
            const aguinaldoCompleto = sueldo > 0 ? (sueldo / 30) * diasSegunTabla : 0;

            // Days worked in this period
            const effectiveStart = fechaBase > pStart ? fechaBase : pStart;
            const diasLaborados = Math.max(0, Math.ceil((pEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1);
            const totalPeriodDays = Math.ceil((pEnd - pStart) / (1000 * 60 * 60 * 24)) + 1;
            const proporcion = totalPeriodDays > 0 ? diasLaborados / totalPeriodDays : 1;

            const aguinaldoCalculado = Math.round(aguinaldoCompleto * proporcion * 100) / 100;
            const excedente = Math.max(0, aguinaldoCalculado - 1500);
            const renta = Math.round(excedente * 0.10 * 100) / 100;
            const montoRecibir = Math.round((aguinaldoCalculado - renta) * 100) / 100;

            results.push({
                empleado_id: emp.id,
                codigo: emp.codigo,
                nombres: emp.nombres,
                apellidos: emp.apellidos,
                cargo_nombre: emp.cargo_nombre || '',
                departamento_nombre: emp.departamento_nombre || '',
                departamento_personal_id: emp.departamento_personal_id,
                sueldo_base: sueldo,
                fecha_ingreso: emp.fecha_ingreso,
                fecha_base: fechaBase.toISOString().substring(0, 10),
                dias_antiguedad: diasAntiguedad,
                dias_segun_tabla: diasSegunTabla,
                aguinaldo_calculado: aguinaldoCalculado,
                excedente,
                renta,
                monto_recibir: montoRecibir
            });
        }

    return results;
};

module.exports = { calculate };
