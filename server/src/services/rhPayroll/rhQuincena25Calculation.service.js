const pool = require('../../config/db');

const calculate = async (filters, companyId) => {
        const { año, departamento_id, branch_id } = filters;
        if (!año) throw Object.assign(new Error('año requerido'), { status: 400 });

        const anio = parseInt(año);
        const fechaCorteAnterior = new Date(Date.UTC(anio - 1, 11, 31)); // 31 de Diciembre del año anterior
        const fechaInicioAnterior = new Date(Date.UTC(anio - 1, 0, 1));   // 1 de Enero del año anterior

        // Obtener empleados activos
        let empQuery = `
            SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, e.fecha_ingreso,
                   e.num_dui, e.num_nit, e.cuenta_planillera,
                   e.departamento_personal_id, e.cargo_id, e.branch_id,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre,
                   b.nombre as sucursal_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            LEFT JOIN branches b ON e.branch_id = b.id
            WHERE e.company_id = ? AND e.es_activo = 1
        `;
        let params = [companyId];

        if (departamento_id && departamento_id !== 'all' && departamento_id !== '0') {
            empQuery += ` AND e.departamento_personal_id = ?`;
            params.push(parseInt(departamento_id));
        }
        if (branch_id && branch_id !== 'all' && branch_id !== '0') {
            empQuery += ` AND e.branch_id = ?`;
            params.push(parseInt(branch_id));
        }

        empQuery += ` ORDER BY e.codigo ASC`;
        const [empleados] = await pool.query(empQuery, params);

        const results = [];

        for (const emp of empleados) {
            const sueldo = parseFloat(emp.sueldo_base || 0);

            // 1. Techo Legal: Salario mensual nominal <= $1,500.00
            if (sueldo > 1500.00) {
                results.push({
                    empleado_id: emp.id,
                    codigo: emp.codigo,
                    nombres: emp.nombres,
                    apellidos: emp.apellidos,
                    cargo_nombre: emp.cargo_nombre || 'GENERAL',
                    departamento_nombre: emp.departamento_nombre || 'GENERAL',
                    departamento_personal_id: emp.departamento_personal_id,
                    sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                    branch_id: emp.branch_id,
                    sueldo_base: sueldo,
                    fecha_ingreso: emp.fecha_ingreso,
                    fecha_base: emp.fecha_ingreso,
                    dias_laborados_anio: 0,
                    es_proporcional: 0,
                    monto_quincena25: 0,
                    ajuste: 0,
                    monto_recibir: 0,
                    aplica: false,
                    motivo_exclusion: 'Excluido por techo legal de Ley (Sueldo mayor a $1,500.00)',
                    observaciones: 'Excluido por Ley D.L. 499 (Sueldo > $1,500.00)'
                });
                continue;
            }

            // 2. Determinar fecha base (última liquidación si aplica, o fecha de ingreso)
            const [liqRows] = await pool.query(
                `SELECT MAX(periodo_indemnizacion_hasta) as ultima_indemnizacion
                 FROM rh_planilla_liquidaciones
                 WHERE empleado_id = ? AND company_id = ? AND periodo_indemnizacion_hasta IS NOT NULL`,
                [emp.id, companyId]
            );
            const ultimaIndemnizacion = liqRows[0]?.ultima_indemnizacion || null;
            const rawFechaBase = ultimaIndemnizacion || emp.fecha_ingreso;

            if (!rawFechaBase) {
                results.push({
                    empleado_id: emp.id,
                    codigo: emp.codigo,
                    nombres: emp.nombres,
                    apellidos: emp.apellidos,
                    cargo_nombre: emp.cargo_nombre || 'GENERAL',
                    departamento_nombre: emp.departamento_nombre || 'GENERAL',
                    departamento_personal_id: emp.departamento_personal_id,
                    sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                    branch_id: emp.branch_id,
                    sueldo_base: sueldo,
                    fecha_ingreso: null,
                    fecha_base: null,
                    dias_laborados_anio: 0,
                    es_proporcional: 0,
                    monto_quincena25: 0,
                    ajuste: 0,
                    monto_recibir: 0,
                    aplica: false,
                    motivo_exclusion: 'Sin fecha de ingreso registrada',
                    observaciones: 'Sin fecha de ingreso'
                });
                continue;
            }

            const fechaBase = new Date(rawFechaBase);
            const fbUtc = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth(), fechaBase.getUTCDate()));

            // 3. Evaluar días laborados en el ejercicio precedente
            let diasLaborados = 0;
            let esProporcional = 0;

            if (fbUtc <= fechaInicioAnterior) {
                // Empleado con 1 año o más de antigüedad al cierre del año previo
                diasLaborados = 365;
                esProporcional = 0;
            } else if (fbUtc <= fechaCorteAnterior) {
                // Ingresó durante el año previo (cálculo proporcional)
                const diffTime = Math.max(0, fechaCorteAnterior.getTime() - fbUtc.getTime());
                diasLaborados = Math.min(365, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
                esProporcional = 1;
            } else {
                // Ingresó en el año actual (después del 31 de dic del año anterior)
                diasLaborados = 0;
                esProporcional = 1;
            }

            if (diasLaborados === 0) {
                results.push({
                    empleado_id: emp.id,
                    codigo: emp.codigo,
                    nombres: emp.nombres,
                    apellidos: emp.apellidos,
                    cargo_nombre: emp.cargo_nombre || 'GENERAL',
                    departamento_nombre: emp.departamento_nombre || 'GENERAL',
                    departamento_personal_id: emp.departamento_personal_id,
                    sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                    branch_id: emp.branch_id,
                    sueldo_base: sueldo,
                    fecha_ingreso: emp.fecha_ingreso,
                    fecha_base: rawFechaBase,
                    dias_laborados_anio: 0,
                    es_proporcional: 1,
                    monto_quincena25: 0,
                    ajuste: 0,
                    monto_recibir: 0,
                    aplica: false,
                    motivo_exclusion: `Ingreso en ${anio} (posterior al período computable)`,
                    observaciones: `Ingreso en ${anio}`
                });
                continue;
            }

            // 4. Cálculo: 50% del salario mensual con factor proporcional
            const quincenaCompleta = sueldo * 0.50;
            const factor = diasLaborados / 365;
            const montoCalculado = Math.round((quincenaCompleta * factor) * 100) / 100;

            results.push({
                empleado_id: emp.id,
                codigo: emp.codigo,
                nombres: emp.nombres,
                apellidos: emp.apellidos,
                cargo_nombre: emp.cargo_nombre || 'GENERAL',
                departamento_nombre: emp.departamento_nombre || 'GENERAL',
                departamento_personal_id: emp.departamento_personal_id,
                sucursal_nombre: emp.sucursal_nombre || 'PRINCIPAL',
                branch_id: emp.branch_id,
                sueldo_base: sueldo,
                fecha_ingreso: emp.fecha_ingreso,
                fecha_base: typeof rawFechaBase === 'string' ? rawFechaBase.substring(0, 10) : new Date(rawFechaBase).toISOString().substring(0, 10),
                dias_laborados_anio: diasLaborados,
                es_proporcional: esProporcional,
                monto_quincena25: montoCalculado,
                ajuste: 0,
                monto_recibir: montoCalculado,
                aplica: true,
                motivo_exclusion: null,
                observaciones: esProporcional ? `Proporcional (${diasLaborados} días)` : '100% de Ley (1 año+)'
            });
        }

    return results;
};

module.exports = { calculate };
