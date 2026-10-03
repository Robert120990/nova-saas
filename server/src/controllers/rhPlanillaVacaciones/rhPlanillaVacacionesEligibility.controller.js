const pool = require('../../config/db');

const getElegibles = async (req, res) => {
    try {
        const companyId = req.company_id;
        const now = new Date();
        const año = parseInt(req.query.año) || now.getFullYear();
        const mes = parseInt(req.query.mes) || (now.getMonth() + 1); // 1-12
        const incluirPendientes = req.query.incluir_pendientes === 'true' || req.query.incluir_pendientes === '1';

        // 1. Obtener empleados activos
        const [empleados] = await pool.query(`
            SELECT e.id, e.codigo, e.nombres, e.apellidos, e.sueldo_base, 
                   DATE_FORMAT(e.fecha_ingreso, '%Y-%m-%d') as fecha_ingreso,
                   c.descripcion as cargo_nombre,
                   d.descripcion as departamento_nombre
            FROM rh_empleados e
            LEFT JOIN rh_cargos c ON e.cargo_id = c.id
            LEFT JOIN rh_departamentos d ON e.departamento_personal_id = d.id
            WHERE e.company_id = ? AND e.es_activo = 1
            ORDER BY e.apellidos ASC, e.nombres ASC
        `, [companyId]);

        // 2. Obtener todas las planillas de vacaciones de la empresa
        const [vacaciones] = await pool.query(`
            SELECT id, empleado_id, 
                   DATE_FORMAT(fecha_inicial, '%Y-%m-%d') as fecha_inicial,
                   DATE_FORMAT(fecha_final, '%Y-%m-%d') as fecha_final,
                   periodo_año, periodo_mes, vacaciones_monto
            FROM rh_planilla_vacaciones
            WHERE company_id = ? AND fecha_final IS NOT NULL
            ORDER BY fecha_final DESC, id DESC
        `, [companyId]);

        const vacacionesPorEmpleado = {};
        for (const v of vacaciones) {
            if (!vacacionesPorEmpleado[v.empleado_id]) {
                vacacionesPorEmpleado[v.empleado_id] = [];
            }
            vacacionesPorEmpleado[v.empleado_id].push(v);
        }

        const ultimoDiaMes = new Date(año, mes, 0).getDate();
        const fechaFinMesStr = `${año}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;
        const fechaFinMes = new Date(`${fechaFinMesStr}T23:59:59`);

        const elegibles = [];

        for (const emp of empleados) {
            if (!emp.fecha_ingreso) continue;

            const fechaIngresoStr = emp.fecha_ingreso;
            const [, ingMes, ingDia] = fechaIngresoStr.split('-').map(Number);
            const fechaIngresoDate = new Date(`${fechaIngresoStr}T00:00:00`);

            // Total de días desde el ingreso hasta el fin del mes evaluado
            const diffMsIngreso = fechaFinMes.getTime() - fechaIngresoDate.getTime();
            const diasTotalesIngreso = Math.floor(diffMsIngreso / (1000 * 60 * 60 * 24));

            // Debe tener al menos 365 días continuos de servicio (Art. 177 C.Tr.)
            if (diasTotalesIngreso < 365) {
                continue;
            }

            const empVacaciones = vacacionesPorEmpleado[emp.id] || [];
            const ultimaVacacion = empVacaciones.length > 0 ? empVacaciones[0] : null;

            let fechaInicioPeriodo = '';
            let fechaFinPeriodo = '';
            let diasServicioPeriodo = 0;
            let esMesAniversario = false;
            let origen = '';
            let ultimaFechaFinalStr = null;

            if (ultimaVacacion && ultimaVacacion.fecha_final) {
                // --- CASO 1: El empleado TIENE vacación previa registrada ---
                origen = 'ultima_vacacion';
                ultimaFechaFinalStr = ultimaVacacion.fecha_final;

                const ultFinalDate = new Date(`${ultimaFechaFinalStr}T00:00:00`);
                const sigInicioDate = new Date(ultFinalDate);
                sigInicioDate.setDate(sigInicioDate.getDate() + 1);
                fechaInicioPeriodo = sigInicioDate.toISOString().substring(0, 10);

                const sigFinDate = new Date(sigInicioDate);
                sigFinDate.setDate(sigFinDate.getDate() + 364); // Ciclo anual de 365 días
                fechaFinPeriodo = sigFinDate.toISOString().substring(0, 10);

                const mesCumplimiento = sigFinDate.getMonth() + 1;
                const añoCumplimiento = sigFinDate.getFullYear();

                const diffMs = fechaFinMes.getTime() - sigInicioDate.getTime();
                diasServicioPeriodo = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

                // Cumple aniversario en el mes y año consultado
                esMesAniversario = (mesCumplimiento === mes && añoCumplimiento === año);

                // Verificar si ya tiene registrada una planilla para este ciclo
                const yaRegistrada = empVacaciones.some(v => {
                    const vIni = v.fecha_inicial || '';
                    return (vIni && vIni >= fechaInicioPeriodo) || (v.periodo_año === año && v.periodo_mes === mes);
                });
                if (yaRegistrada) continue;

                // Debe tener al menos 365 días en este período a la fecha evaluada
                if (diasServicioPeriodo < 365) continue;

                // Para no salir todos los meses, solo se muestra en su mes aniversario a menos que se incluya acumuladas
                if (!esMesAniversario && !incluirPendientes) {
                    continue;
                }

            } else {
                // --- CASO 2: El empleado NO TIENE vacaciones previas ---
                origen = 'fecha_ingreso';

                // Su mes aniversario de ley es el mes de contratación
                const mesAniversario = ingMes;
                esMesAniversario = (mesAniversario === mes);

                // Regla solicitada: si tiene p. ej. 1588 días para no salir todos los meses,
                // se computa desde su fecha de ingreso pero del año anterior
                const añoAnterior = año - 1;
                const maxDiasMesAnt = new Date(añoAnterior, ingMes, 0).getDate();
                const diaInicioAjustado = Math.min(ingDia, maxDiasMesAnt);
                const fechaInicioDate = new Date(`${añoAnterior}-${String(ingMes).padStart(2, '0')}-${String(diaInicioAjustado).padStart(2, '0')}T00:00:00`);
                fechaInicioPeriodo = fechaInicioDate.toISOString().substring(0, 10);

                const maxDiasMesAct = new Date(año, ingMes, 0).getDate();
                const diaFinAjustado = Math.min(ingDia, maxDiasMesAct);
                const fechaFinDate = new Date(`${año}-${String(ingMes).padStart(2, '0')}-${String(diaFinAjustado).padStart(2, '0')}T00:00:00`);
                fechaFinPeriodo = fechaFinDate.toISOString().substring(0, 10);

                const diffMsPeriodo = fechaFinDate.getTime() - fechaInicioDate.getTime();
                diasServicioPeriodo = Math.floor(diffMsPeriodo / (1000 * 60 * 60 * 24)) + 1;

                // Para evitar que salga todos los meses del año (p.ej. 1588 días)
                if (!esMesAniversario && !incluirPendientes) {
                    continue;
                }

                // Verificar si ya existe vacación registrada para este año y mes
                const yaRegistrada = empVacaciones.some(v => v.periodo_año === año && v.periodo_mes === mes);
                if (yaRegistrada) continue;
            }

            // Estimación económica de ley: 15 días continuos + 30% recargo
            const sueldoBase = parseFloat(emp.sueldo_base || 0);
            const sueldoDiario = sueldoBase / 30;
            const montoBase = sueldoDiario * 15;
            const vacacionesMonto = Math.round(montoBase * 1.30 * 100) / 100;

            elegibles.push({
                empleado_id: emp.id,
                empleado_codigo: emp.codigo,
                empleado_nombres: emp.nombres,
                empleado_apellidos: emp.apellidos,
                nombre_completo: `${emp.nombres} ${emp.apellidos}`,
                cargo_nombre: emp.cargo_nombre || 'Sin cargo',
                departamento_nombre: emp.departamento_nombre || 'General',
                sueldo_base: sueldoBase,
                fecha_ingreso: fechaIngresoStr,
                dias_totales_empresa: diasTotalesIngreso,
                ultima_vacacion_fecha_final: ultimaFechaFinalStr,
                origen,
                fecha_inicio_periodo: fechaInicioPeriodo,
                fecha_fin_periodo: fechaFinPeriodo,
                dias_servicio: diasServicioPeriodo,
                vacaciones_monto_estimado: vacacionesMonto,
                es_mes_aniversario: esMesAniversario,
                estado: esMesAniversario ? 'cumple_este_mes' : 'pendiente_acumulada'
            });
        }

        res.json({
            año,
            mes,
            total: elegibles.length,
            data: elegibles
        });
    } catch (error) {
        console.error('[Vacaciones Elegibles] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getElegibles };
