export const INFRACCIONES_COL1 = [
    'Atraso en presentación al trabajo sin causa justificada.',
    'Desobedecer órdenes de su jefe inmediato.',
    'No presentarse a las convocatorias a reuniones sin justificación.',
    'No portar uniforme en debida forma.',
    'Utilizar tiempo laboral para otras actividades o inducir a otros a ello.',
    'No cumplir con disposiciones sobre higiene y seguridad en lugar de trabajo.',
    'Atraso repetitivo en presentación al trabajo sin causa justificada.',
    'Reincidencia en faltas leves conforme al Reglamento Interno.',
    'Inasistencia en una ocasión sin causa justificada.',
    'Desobedecer reiteradamente instrucciones de jefe inmediato.',
    'Por mal servicio o mal trato a clientes, visitas y/o compañeros de trabajo.',
    'Alterar el orden o disciplina en el lugar de trabajo.',
    'Faltar a la moral o ética profesional/ evadir responsabilidades.',
    'Discutir asuntos políticos, religiosos o propaganda.'
];

export const INFRACCIONES_COL2 = [
    'Manchar, alterar o colocar avisos en el lugar de trabajo.',
    'No presentar justificaciones idóneas a sus ausencias.',
    'No prestar colaboración al Comité de Seguridad e Higiene.',
    'Prolongar licencias o incapacidades sin autorización.',
    'No reportar anomalías de las que tenga conocimiento.',
    'Dedicarse a juegos de azar o destreza u otros en horas laborales.',
    'Hacer uso inadecuado o para fines distintos, de herramientas de oficina.',
    'Efectuar trabajos particulares en horas laborales o con herramientas de la empresa.',
    'Registrar entradas y salidas de otros.',
    'Cometer actos inmorales, palabras soeces o indecorosas, irrespetuosas o insultantes.',
    'Ejecutar actos que puedan poner en peligro instalaciones o equipo de la empresa.',
    'Alterar documentación de la empresa.',
    'Sustraer información propiedad de la empresa, objetos de la empresa, o productos de la empresa.',
    'Otros'
];

export const ALL_INFRACCIONES = [...INFRACCIONES_COL1, ...INFRACCIONES_COL2];

export const ACCIONES_OPCIONES = [
    { key: 'llamado_verbal', label: 'Llamado de Atención verbal', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { key: 'llamado_escrito_1', label: 'Llamado de Atención por escrito', color: 'text-orange-700 bg-orange-50 border-orange-200' },
    { key: 'llamado_escrito_2', label: '2do Llamado de Atención por escrito', color: 'text-red-700 bg-red-50 border-red-200' },
    { key: 'suspension', label: 'Suspensión día conforme Reglamento', color: 'text-rose-700 bg-rose-50 border-rose-200' },
    { key: 'terminacion_sin_responsabilidad', label: 'Terminación sin responsabilidad patronal', color: 'text-purple-700 bg-purple-50 border-purple-200' },
    { key: 'despido', label: 'Despido', color: 'text-red-800 bg-red-100 border-red-300' },
    { key: 'otro', label: 'Otro', color: 'text-slate-700 bg-slate-100 border-slate-200' }
];

export const TIEMPO_LABORADO_MAP = {
    '0_a_1': 'De 0 a 1 año',
    '1_a_5': 'De 1 a 5 años',
    '5_a_10': 'De 5 a 10 años',
    'mas_10': 'De 10 años +'
};

export const calculateTiempoLaboradoKey = (fechaIngreso) => {
    if (!fechaIngreso) return '0_a_1';
    try {
        const fi = new Date(fechaIngreso);
        const hoy = new Date();
        const diffMs = hoy - fi;
        const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);
        if (years >= 10) return 'mas_10';
        if (years >= 5) return '5_a_10';
        if (years >= 1) return '1_a_5';
        return '0_a_1';
    } catch {
        return '0_a_1';
    }
};

export const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const parts = String(val).substring(0, 10).split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return new Date(val).toLocaleDateString('es-SV');
    } catch {
        return String(val);
    }
};
