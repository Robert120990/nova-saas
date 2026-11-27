import { months } from './planillaUtils';

export const getMesLabel = (mes) => months.find(m => Number(m.value) === Number(mes))?.label || String(mes);

export const STATUS_BADGES = {
    en_planilla: { label: 'En planilla', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    sin_planilla: { label: 'Se creará', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    ausente: { label: 'Vac./Incap.', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pagada: { label: 'Cerrada', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
    inactivo: { label: 'Inactivo', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    sin_vincular: { label: 'Sin vincular', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    saldo_negativo: { label: 'Saldo neg. (arrastre)', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    sin_sueldo: { label: 'Sin sueldo base', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    sin_horas: { label: '0.0h pagables', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
};

export function findBestMatchingCorte(cortes, anio, mes, quincena) {
    if (!cortes.length) return '';
    const linked = cortes.find(c => Number(c.planilla_anio) === Number(anio) && Number(c.planilla_mes) === Number(mes) && c.planilla_quincena === quincena);
    if (linked) return String(linked.id);
    const mesName = getMesLabel(mes).toLowerCase();
    const qRegex = quincena === 'primera' ? /(1ra|1°|primera)/i : /(2da|2°|segunda)/i;
    const byName = cortes.find(c => String(c.nombre || '').toLowerCase().includes(mesName) && String(c.nombre || '').includes(String(anio)) && qRegex.test(String(c.nombre || '')));
    if (byName) return String(byName.id);
    const startDay = quincena === 'primera' ? 1 : 16;
    const endDay = quincena === 'primera' ? 15 : 31;
    const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
    const byRange = cortes.find(c => String(c.fecha_fin || '').startsWith(prefix) && Number(String(c.fecha_fin).slice(8, 10)) >= startDay && Number(String(c.fecha_fin).slice(8, 10)) <= endDay);
    return String((byRange || cortes[0]).id);
}
