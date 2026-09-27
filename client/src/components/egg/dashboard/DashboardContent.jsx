import {
    Activity,
    AlertTriangle,
    CheckCircle,
    AlertOctagon
} from 'lucide-react';


export default function DashboardContent({ model }) {
    const { telemetry, alerts, getTankTempBadge } = model;

    return (<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* 3. LECTURAS DE HOLDING TANKS */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-indigo-600" />
                            Monitoreo de Frío: Tanques Pulmón y Almacenamiento
                        </h2>
                        <div className="h-px bg-slate-100" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {(Array.isArray(telemetry?.tanks) ? telemetry.tanks : []).map(tank => (
                            <div key={tank.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between min-h-[120px] transition-all hover:border-slate-300">
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight block truncate">{tank.id}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                        tank.status === 'alarm' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {tank.status === 'alarm' ? 'ALERTA DE FRÍO' : 'EN RANGO NORMAL'}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between mt-4">
                                    <span className={`text-xl font-black px-2.5 py-1 rounded-xl ${getTankTempBadge(tank.temp, tank.status)}`}>
                                        {tank.temp}°C
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-semibold">{tank.humidity}% Hum</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 4. BITÁCORA DE ALERTAS */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-600" />
                            Registro de Alertas de Planta
                        </h2>
                        <div className="h-px bg-slate-100" />
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[160px] space-y-2 mt-4 pr-1">
                        {alerts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-4">
                                <CheckCircle className="h-8 w-8 text-emerald-500 mb-1" />
                                <span className="text-xs font-semibold text-slate-600">Sin desviaciones activas</span>
                            </div>
                        ) : (
                            (Array.isArray(alerts) ? alerts : []).map(a => (
                                <div key={a.id} className={`p-2.5 rounded-xl border flex gap-2 items-start ${
                                    a.severity === 'critical'
                                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                                        : 'bg-amber-50 border-amber-200 text-amber-800'
                                }`}>
                                    <AlertOctagon size={16} className="shrink-0 mt-0.5 text-rose-600" />
                                    <div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wide bg-white px-1.5 py-0.5 rounded border border-slate-200">{a.type}</span>
                                            <span className="text-[10px] text-slate-500 font-bold">{a.timestamp}</span>
                                        </div>
                                        <p className="text-xs font-semibold mt-1 leading-snug">{a.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>);
}
