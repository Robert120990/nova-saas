export const ABSENCE_CATEGORIES = [
    {
        id: 'ley',
        label: 'De Ley (Código de Trabajo / ISSS)',
        shortLabel: 'De Ley',
        badgeCls: 'bg-sky-50 text-sky-700 border-sky-200'
    },
    {
        id: 'interna',
        label: 'Permiso / Política Interna',
        shortLabel: 'Interna',
        badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    {
        id: 'injustificada',
        label: 'Inasistencia Injustificada / Sin Permiso',
        shortLabel: 'Injustificada',
        badgeCls: 'bg-rose-50 text-rose-700 border-rose-200'
    }
];

export const ABSENCE_SUBTYPES = [
    // De Ley
    { subtipo: 'incapacidad_isss', label: 'Incapacidad Médica ISSS / Certificada', categoria: 'ley', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Código de Trabajo / Ley ISSS' },
    { subtipo: 'cita_medica_isss', label: 'Consulta / Cita Médica ISSS', categoria: 'ley', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Art. 29 Ord. 6° C.T.' },
    { subtipo: 'duelo_familiar', label: 'Licencia por Duelo Familiar Directo', categoria: 'ley', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Art. 29 Ord. 6° C.T.' },
    { subtipo: 'maternidad_paternidad', label: 'Licencia Maternidad / Paternidad / Lactancia', categoria: 'ley', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Art. 29 Ord. 6° / Art. 309 C.T.' },
    { subtipo: 'matrimonio_nacimiento', label: 'Licencia por Matrimonio / Nacimiento de Hijo', categoria: 'ley', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Art. 29 Ord. 6° C.T.' },
    { subtipo: 'deber_publico', label: 'Citación Judicial / Obligación Pública', categoria: 'ley', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Art. 29 Ord. 6° C.T.' },
    { subtipo: 'vacaciones', label: 'Vacaciones Anuales', categoria: 'ley', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Art. 177 C.T.' },

    // Interna
    { subtipo: 'permiso_personal', label: 'Permiso Personal / Asunto Familiar', categoria: 'interna', defaultGoce: false, defaultSeptimo: false, defaultPidio: true, legalRef: 'Política Interna' },
    { subtipo: 'comision_trabajo_campo', label: 'Comisión Externa / Trabajo en Campo / Capacitación', categoria: 'interna', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Actividad Laboral Externa' },
    { subtipo: 'tiempo_compensatorio', label: 'Tiempo Compensatorio (Horas Acumuladas)', categoria: 'interna', defaultGoce: true, defaultSeptimo: false, defaultPidio: true, legalRef: 'Compensación Interna' },
    { subtipo: 'suspension_disciplinaria', label: 'Suspensión Disciplinaria (Sin Goce)', categoria: 'interna', defaultGoce: false, defaultSeptimo: false, defaultPidio: false, legalRef: 'Art. 305 C.T. / Reglamento Interno' },
    { subtipo: 'otro_interno', label: 'Otro Permiso / Acuerdo Interno', categoria: 'interna', defaultGoce: false, defaultSeptimo: false, defaultPidio: true, legalRef: 'Política Interna' },

    // Injustificada
    { subtipo: 'falta_sin_aviso', label: 'Inasistencia sin Aviso (No pidió permiso)', categoria: 'injustificada', defaultGoce: false, defaultSeptimo: true, defaultPidio: false, legalRef: 'Art. 171 C.T. (Pérdida 7° día)' },
    { subtipo: 'permiso_denegado', label: 'Permiso Solicitado pero No Autorizado', categoria: 'injustificada', defaultGoce: false, defaultSeptimo: true, defaultPidio: true, legalRef: 'Art. 171 C.T.' },
    { subtipo: 'justificacion_no_idonea', label: 'Sin Comprobante / Justificación No Idónea', categoria: 'injustificada', defaultGoce: false, defaultSeptimo: true, defaultPidio: false, legalRef: 'Reglamento Interno' }
];

export const AUTH_STATES = [
    { id: 'pendiente', label: 'Pendiente de Autorizar (En revisión)', shortLabel: 'Pendiente Autorizar', badgeCls: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'autorizado', label: 'Autorizado', shortLabel: 'Autorizado', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'rechazado', label: 'No Autorizado / Rechazado', shortLabel: 'No Autorizado', badgeCls: 'bg-rose-50 text-rose-700 border-rose-200' },
    { id: 'sin_solicitud', label: 'Sin Solicitud (No pidió permiso)', shortLabel: 'Sin Solicitud', badgeCls: 'bg-slate-100 text-slate-700 border-slate-200' }
];

export const TIME_MODALITIES = [
    { id: 'dia_completo', label: 'Día(s) Completo(s)' },
    { id: 'medio_dia', label: 'Medio Día (4 hrs)' },
    { id: 'por_horas', label: 'Permiso por Horas' }
];

export const getSubtypeMeta = (subtipo) =>
    ABSENCE_SUBTYPES.find(s => s.subtipo === subtipo) || null;

export const getCategoryBadge = (categoria) =>
    ABSENCE_CATEGORIES.find(c => c.id === categoria) || ABSENCE_CATEGORIES[2];

export const getAuthStateBadge = (estado) =>
    AUTH_STATES.find(a => a.id === estado) || AUTH_STATES[3];

export const getRadarStatusConfig = (row) => {
    switch (row?.radar_status) {
        case 'asistio':
            return {
                label: row.minutos_tardanza > 0 ? `Asistió (+${row.minutos_tardanza}m tarde)` : 'Asistió (Marcó)',
                cls: row.minutos_tardanza > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            };
        case 'permiso_pendiente':
            return {
                label: 'Pendiente de Autorizar',
                cls: 'bg-amber-50 text-amber-800 border-amber-300'
            };
        case 'ausencia_autorizada':
            return {
                label: row.ausencia
                    ? (row.ausencia.goce_sueldo ? 'Autorizado · Con Goce' : 'Autorizado · Sin Goce')
                    : (row.en_vacaciones_flag ? 'En Vacaciones' : 'Incapacitado'),
                cls: row.ausencia && !row.ausencia.goce_sueldo
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200'
            };
        case 'falta_injustificada':
            return {
                label: row.ausencia?.estado_autorizacion === 'rechazado' ? 'Permiso No Autorizado' : 'Falta Injustificada',
                cls: 'bg-rose-50 text-rose-700 border-rose-200'
            };
        case 'descanso_festivo':
            return {
                label: 'Descanso / Festivo',
                cls: 'bg-slate-100 text-slate-600 border-slate-200'
            };
        default:
            return {
                label: 'No Marcó · Sin Justificar',
                cls: 'bg-rose-100 text-rose-800 border-rose-300'
            };
    }
};
