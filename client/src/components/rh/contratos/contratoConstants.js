import { getTodayString, toDateInput } from '../../../utils/dateUtils';

export const DIAS_SEMANA_OPCIONES = [
    'LUNES',
    'MARTES',
    'MIERCOLES',
    'JUEVES',
    'VIERNES',
    'SABADO',
    'DOMINGO'
];

export const ESTADOS_CIVILES = [
    'SOLTERO',
    'SOLTERA',
    'CASADO',
    'CASADA',
    'ACOMPAÑADO',
    'ACOMPAÑADA',
    'DIVORCIADO',
    'DIVORCIADA',
    'VIUDO',
    'VIUDA'
];

export const SEXOS_OPCIONES = [
    'MASCULINO',
    'FEMENINO'
];

export const PLAZOS_CONTRATO = [
    'TIEMPO INDEFINIDO',
    'PLAZO DETERMINADO',
    'POR OBRA DETERMINADA',
    'INTERINATO'
];

export const FORMAS_PAGO_OPCIONES = [
    'TRANFERENCIA BANCARIA',
    'TRANSFERENCIA BANCARIA',
    'EFECTIVO',
    'CHEQUE',
    'PLANILLA BANCARIA'
];

export const ESTADOS_CONTRATO = [
    { key: 'vigente', label: 'Vigente', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { key: 'finalizado', label: 'Finalizado', color: 'text-slate-700 bg-slate-100 border-slate-200' },
    { key: 'anulado', label: 'Anulado', color: 'text-rose-700 bg-rose-50 border-rose-200' }
];

export const DEPARTAMENTOS_SV_MAP = {
    '01': 'AHUACHAPAN',
    '02': 'SANTA ANA',
    '03': 'SONSONATE',
    '04': 'CHALATENANGO',
    '05': 'LA LIBERTAD',
    '06': 'SAN SALVADOR',
    '07': 'CUSCATLAN',
    '08': 'LA PAZ',
    '09': 'CABAÑAS',
    '10': 'SAN VICENTE',
    '11': 'USULUTAN',
    '12': 'SAN MIGUEL',
    '13': 'MORAZAN',
    '14': 'LA UNION'
};

export const DEFAULT_PATRONO_DATA = {
    patrono_nombre: 'RAUL RAFAEL SOSA CASTELLANOS',
    patrono_edad: 58,
    patrono_sexo: 'MASCULINO',
    patrono_estado_civil: 'CASADO',
    patrono_profesion: 'ESTUDIANTE',
    patrono_direccion: 'LOMAS DE SAN FRANCISCO 3a ETAPA AV. 3. # 9 B',
    patrono_nacionalidad: 'SALVADOREÑA',
    patrono_dui: '00497414-6',
    patrono_dui_extendido: 'SAN SALVADOR',
    patrono_nit: '0614-140268-004-3'
};

export const DEFAULT_HERRAMIENTAS = 'las herramientas y utensilios necesarios para el buen desempeño de sus funciones.';
export const DEFAULT_OTRAS_ESTIPULACIONES = 'CUANDO POR LA NATURALEZA DEL NEGOCIO TENGA QUE EL TRABAJAR EL DIA DOMINGO, SE SUSTITUIRA EL DIA DE DESCANDO SEMANAL POR CUALQUIER DIA DE LA SEMANA, PREVIO ACUERDO ENTRE AMBAS PARTES.';

export const calculateAgeFromBirthDate = (birthDateStr) => {
    if (!birthDateStr) return '';
    const clean = String(birthDateStr).trim().substring(0, 10);
    const parts = clean.split('-');
    if (parts.length !== 3) return '';
    const birth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (isNaN(birth.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age > 0 && age < 120 ? age : '';
};

export const createInitialDependientes = (existing = []) => {
    const list = Array.isArray(existing) ? existing : [];
    const total = Math.max(4, list.length);
    const result = [];
    for (let i = 0; i < total; i++) {
        const item = list[i] || {};
        result.push({
            nombre: item.nombre || '',
            apellido: item.apellido || '',
            fecha_nacimiento: toDateInput(item.fecha_nacimiento) || '',
            edad: item.edad || calculateAgeFromBirthDate(item.fecha_nacimiento) || '',
            direccion: item.direccion || ''
        });
    }
    return result;
};

export const mapEmployeeToContratoFields = (emp, currentForm = {}) => {
    if (!emp) return currentForm;
    const fullName = `${emp.nombres || ''} ${emp.apellidos || ''}`.trim().toUpperCase();
    const deptoCode = String(emp.departamento || '').padStart(2, '0');
    const extendidoEn = DEPARTAMENTOS_SV_MAP[deptoCode] || currentForm.dui_extendido_en || 'SAN SALVADOR';
    const birthDate = toDateInput(emp.fecha_nacimiento);

    return {
        ...currentForm,
        empleado_id: emp.id,
        trabajador_nombre: fullName || currentForm.trabajador_nombre,
        fecha_nacimiento: birthDate || currentForm.fecha_nacimiento,
        edad: calculateAgeFromBirthDate(birthDate) || currentForm.edad,
        profesion_oficio: (emp.ocupacion || currentForm.profesion_oficio || 'ESTUDIANTE').toUpperCase(),
        direccion: (emp.direccion || currentForm.direccion || '').toUpperCase(),
        num_dui: emp.num_dui || currentForm.num_dui || '',
        dui_extendido_en: extendidoEn,
        num_nit: emp.num_nit || currentForm.num_nit || '',
        num_isss: emp.num_isss || currentForm.num_isss || '',
        cargo_laboral: (emp.cargo_nombre || currentForm.cargo_laboral || '').toUpperCase(),
        lugar_trabajo: (emp.branch_nombre || emp.departamento_nombre || currentForm.lugar_trabajo || '').toUpperCase(),
        fecha_inicio: toDateInput(emp.fecha_ingreso) || currentForm.fecha_inicio || getTodayString(),
        salario_mensual: emp.sueldo_base !== undefined && emp.sueldo_base !== null
            ? Number(emp.sueldo_base)
            : currentForm.salario_mensual
    };
};

export const buildInitialContratoForm = (selected = null, patronoDefaults = {}) => {
    const pat = { ...DEFAULT_PATRONO_DATA, ...patronoDefaults };
    if (selected) {
        return {
            empleado_id: selected.empleado_id || null,
            trabajador_nombre: selected.trabajador_nombre || '',
            fecha_nacimiento: toDateInput(selected.fecha_nacimiento) || '',
            edad: selected.edad || calculateAgeFromBirthDate(selected.fecha_nacimiento) || '',
            sexo: selected.sexo || 'MASCULINO',
            estado_civil: selected.estado_civil || 'SOLTERO',
            profesion_oficio: selected.profesion_oficio || 'ESTUDIANTE',
            direccion: selected.direccion || '',
            nacionalidad: selected.nacionalidad || 'SALVADOREÑO',
            num_dui: selected.num_dui || '',
            dui_extendido_en: selected.dui_extendido_en || '',
            num_nit: selected.num_nit || '',
            num_isss: selected.num_isss || '',
            cargo_laboral: selected.cargo_laboral || '',
            obligaciones: selected.obligaciones || 'ATENCION AL CLIENTE, ORDEN Y LIMPIEZA',
            lugar_trabajo: selected.lugar_trabajo || '',
            jefe_inmediato: selected.jefe_inmediato || '',
            plazo_contrato: selected.plazo_contrato || 'TIEMPO INDEFINIDO',
            fecha_inicio: toDateInput(selected.fecha_inicio) || getTodayString(),
            lugar_creacion: selected.lugar_creacion || 'SAN SALVADOR',
            fecha_creacion: toDateInput(selected.fecha_creacion) || getTodayString(),
            salario_mensual: selected.salario_mensual ?? 0,
            lugar_pago: selected.lugar_pago || 'BANCO PROMERICA',
            forma_pago: selected.forma_pago || 'TRANFERENCIA BANCARIA',
            horario_dia_inicio: selected.horario_dia_inicio || 'LUNES',
            horario_dia_fin: selected.horario_dia_fin || 'VIERNES',
            horario_manana_desde: selected.horario_manana_desde || '8:00 A.M.',
            horario_manana_hasta: selected.horario_manana_hasta || '12:00 P.M.',
            horario_tarde_desde: selected.horario_tarde_desde || '1:00 P.M.',
            horario_tarde_hasta: selected.horario_tarde_hasta || '5:00 P.M.',
            horario_dia_extra: selected.horario_dia_extra || 'SABADO',
            horario_extra_desde: selected.horario_extra_desde || '8:00 A.M.',
            horario_extra_hasta: selected.horario_extra_hasta || '12:00 P.M.',
            total_horas_semana: selected.total_horas_semana ?? 44,
            dependientes: createInitialDependientes(selected.dependientes),
            patrono_nombre: selected.patrono_nombre || pat.patrono_nombre,
            patrono_edad: selected.patrono_edad ?? pat.patrono_edad,
            patrono_sexo: selected.patrono_sexo || pat.patrono_sexo,
            patrono_estado_civil: selected.patrono_estado_civil || pat.patrono_estado_civil,
            patrono_profesion: selected.patrono_profesion || pat.patrono_profesion,
            patrono_direccion: selected.patrono_direccion || pat.patrono_direccion,
            patrono_nacionalidad: selected.patrono_nacionalidad || pat.patrono_nacionalidad,
            patrono_dui: selected.patrono_dui || pat.patrono_dui,
            patrono_dui_extendido: selected.patrono_dui_extendido || pat.patrono_dui_extendido,
            patrono_nit: selected.patrono_nit || pat.patrono_nit,
            herramientas_materiales: selected.herramientas_materiales || DEFAULT_HERRAMIENTAS,
            otras_estipulaciones: selected.otras_estipulaciones || DEFAULT_OTRAS_ESTIPULACIONES,
            estado: selected.estado || 'vigente'
        };
    }

    return {
        empleado_id: null,
        trabajador_nombre: '',
        fecha_nacimiento: '',
        edad: '',
        sexo: 'MASCULINO',
        estado_civil: 'SOLTERO',
        profesion_oficio: 'ESTUDIANTE',
        direccion: '',
        nacionalidad: 'SALVADOREÑO',
        num_dui: '',
        dui_extendido_en: 'SAN SALVADOR',
        num_nit: '',
        num_isss: '',
        cargo_laboral: 'AGENTE DE PISTA',
        obligaciones: 'ATENCION AL CLIENTE, ORDEN Y LIMPIEZA',
        lugar_trabajo: 'SHELL CHALCHUAPA',
        jefe_inmediato: '',
        plazo_contrato: 'TIEMPO INDEFINIDO',
        fecha_inicio: getTodayString(),
        lugar_creacion: 'SAN SALVADOR',
        fecha_creacion: getTodayString(),
        salario_mensual: 409,
        lugar_pago: 'BANCO PROMERICA',
        forma_pago: 'TRANFERENCIA BANCARIA',
        horario_dia_inicio: 'LUNES',
        horario_dia_fin: 'VIERNES',
        horario_manana_desde: '8:00 A.M.',
        horario_manana_hasta: '12:00 P.M.',
        horario_tarde_desde: '1:00 P.M.',
        horario_tarde_hasta: '5:00 P.M.',
        horario_dia_extra: 'SABADO',
        horario_extra_desde: '8:00 A.M.',
        horario_extra_hasta: '12:00 P.M.',
        total_horas_semana: 44,
        dependientes: createInitialDependientes([]),
        patrono_nombre: pat.patrono_nombre,
        patrono_edad: pat.patrono_edad,
        patrono_sexo: pat.patrono_sexo,
        patrono_estado_civil: pat.patrono_estado_civil,
        patrono_profesion: pat.patrono_profesion,
        patrono_direccion: pat.patrono_direccion,
        patrono_nacionalidad: pat.patrono_nacionalidad,
        patrono_dui: pat.patrono_dui,
        patrono_dui_extendido: pat.patrono_dui_extendido,
        patrono_nit: pat.patrono_nit,
        herramientas_materiales: DEFAULT_HERRAMIENTAS,
        otras_estipulaciones: DEFAULT_OTRAS_ESTIPULACIONES,
        estado: 'vigente'
    };
};

