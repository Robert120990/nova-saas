export default function EggForecastTab({ forecast }) {
    const historical = Array.isArray(forecast?.historical) ? forecast.historical : [];
    const maximum = Math.max(1, ...historical, forecast?.forecast || 0);
    return <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 space-y-4">
        <h2 className="font-bold text-slate-900">Proyección de entregas industriales</h2>
        <p className="text-sm text-slate-600">{forecast?.message || 'Sin información de entregas.'}</p>
        <div className="text-2xl font-bold text-indigo-700">{forecast?.forecast == null ? 'Datos insuficientes' : `${Number(forecast.forecast).toLocaleString()} lb estimadas`}</div>
        <p className="text-xs text-slate-500">La compra de materia prima requiere definir el rendimiento y la receta de cada producto. No se calcula un intervalo de confianza.</p>
        <div className="space-y-3">
            {(Array.isArray(historical) ? historical : []).map((value, index) => <div key={forecast?.periods?.[index] || index} className="grid grid-cols-[5rem_1fr_5rem] gap-2 items-center text-xs">
                <span>{forecast?.periods?.[index] || 'Período'}</span>
                <div className="h-4 rounded bg-slate-100"><div className="h-4 rounded bg-indigo-500" style={{ width: `${100 * value / maximum}%` }} /></div>
                <span className="text-right">{Number(value).toLocaleString()} lb</span>
            </div>)}
        </div>
    </section>;
}
