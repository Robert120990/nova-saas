import {
    Activity,
    Thermometer,
    Droplets,
    Play,
    Pause,
    Settings,
    ShieldAlert,
    ArrowRight
} from 'lucide-react';


export default function DashboardFiltersBar({ model }) {
    const { telemetry, selectedTank, setSelectedTank, simulatedTankTemp, setSimulatedTankTemp, simulatedPasteurizerTemp, setSimulatedPasteurizerTemp, handleInjectTankAlarm, handleInjectHaccpDeviation, handleTogglePasteurizer } = model;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">

            {/* 1. DIAGRAMA DE FLUJO DE PLANTA */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-6 flex flex-col justify-between">
                <div>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-indigo-600 shrink-0" />
                        Etapas del Proceso Productivo y Puntos Críticos (PCC)
                    </h2>
                    <div className="h-px bg-slate-100" />
                </div>

                    {/* Flujo Gráfico */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 py-4 relative">
                        {/* Paso 1: Recepción */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between text-center relative z-10">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Paso 01</span>
                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center my-3 text-slate-700 font-bold shadow-xs">MP</div>
                            <span className="text-xs font-bold text-slate-800">Recepción Huevo</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Cáscara / Líquido</span>
                        </div>

                        {/* Flecha */}
                        <div className="hidden md:flex items-center justify-center text-slate-300">
                            <ArrowRight size={20} />
                        </div>

                        {/* Paso 2: Holding Tanks */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-between text-center relative z-10">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Paso 02</span>
                            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center my-3 font-bold shadow-xs">
                                <Thermometer className="h-6 w-6" />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Tanques Pulmón / Frío</span>
                            <span className="text-[10px] text-slate-500 mt-0.5">Rango: 2.0°C a 6.0°C</span>
                        </div>

                        {/* Flecha */}
                        <div className="hidden md:flex items-center justify-center text-slate-300">
                            <ArrowRight size={20} />
                        </div>

                        {/* Paso 3: Pasteurizador (Critical PCC) */}
                        <div className={`rounded-xl p-4 flex flex-col items-center justify-between text-center relative z-10 border transition-all ${
                            telemetry?.pasteurizer?.active
                                ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300')
                                : 'bg-slate-50 border-slate-200'
                        }`}>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Paso 03 (PCC-1)</span>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center my-3 font-bold shadow-xs ${
                                telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-white text-rose-600 border border-rose-200' : 'bg-white text-emerald-600 border border-emerald-200')
                                    : 'bg-white text-slate-400 border border-slate-200'
                            }`}>
                                <Activity className={`h-6 w-6 ${telemetry?.pasteurizer?.active ? 'animate-pulse' : ''}`} />
                            </div>
                            <span className="text-xs font-bold text-slate-800">Pasteurizador</span>
                            <span className={`text-[10px] font-bold mt-0.5 ${
                                telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'text-rose-700' : 'text-emerald-700')
                                    : 'text-slate-500'
                            }`}>
                                {telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'DESVIACIÓN TÉRMICA' : 'OPERANDO NORMAL')
                                    : 'DETENIDO'}
                            </span>
                        </div>
                    </div>

                    {/* Diales de Temperatura */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-5 rounded-xl border border-slate-200">
                        {/* Dial Pasteurizador */}
                        <div className="flex items-center gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                            <div className={`p-2.5 sm:p-3.5 rounded-xl shrink-0 ${
                                telemetry?.pasteurizer?.active
                                    ? (telemetry.pasteurizer.haccpStatus === 'deviation' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200')
                                    : 'bg-slate-100 text-slate-400'
                            }`}>
                                <Thermometer className="h-6 w-6 sm:h-7 sm:w-7" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Temperatura de Pasteurización</span>
                                <span className="text-xl sm:text-2xl font-black text-slate-900">{telemetry?.pasteurizer?.temp || 0.0}°C</span>
                                <span className="text-[10px] sm:text-[11px] text-slate-500 block font-medium">Norma: Huevo Entero ≥ 64.0°C</span>
                            </div>
                        </div>

                        {/* Dial Flujo y Presión */}
                        <div className="flex items-center gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
                            <div className="p-2.5 sm:p-3.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                                <Droplets className="h-6 w-6 sm:h-7 sm:w-7" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Parámetros Hidráulicos de Bombeo</span>
                                <div className="flex items-center gap-4 sm:gap-6 mt-1">
                                    <div>
                                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Flujo</span>
                                        <span className="text-sm sm:text-base font-bold text-slate-900">{telemetry?.pasteurizer?.flow || 0} GPM</span>
                                    </div>
                                    <div className="h-7 w-px bg-slate-200" />
                                    <div>
                                        <span className="text-slate-500 text-[10px] font-bold uppercase block">Presión</span>
                                        <span className="text-sm sm:text-base font-bold text-slate-900">{telemetry?.pasteurizer?.pressure || 0} PSI</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. PANEL DE PRUEBAS Y CONTROL */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm space-y-4 sm:space-y-5 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-indigo-600 shrink-0" />
                            Control de Equipos & Pruebas
                        </h2>
                        <div className="h-px bg-slate-100" />
                    </div>

                    {/* Controles de Pasteurizador */}
                    <div className="space-y-4">
                        <div>
                            <span className="text-[11px] font-bold text-slate-600 uppercase block mb-1.5">Equipo Pasteurizador</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleTogglePasteurizer(true)}
                                    disabled={telemetry?.pasteurizer?.active}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                                        telemetry?.pasteurizer?.active
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs'
                                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                    }`}
                                >
                                    <Play size={13} />
                                    Encender
                                </button>
                                <button
                                    onClick={() => handleTogglePasteurizer(false)}
                                    disabled={!telemetry?.pasteurizer?.active}
                                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                                        !telemetry?.pasteurizer?.active
                                            ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
                                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                    }`}
                                >
                                    <Pause size={13} />
                                    Apagar
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Inyectar Falla Pasteurizador */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-rose-700 uppercase block flex items-center gap-1">
                                <ShieldAlert size={14} />
                                Prueba de Desviación Térmica (PCC)
                            </span>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={simulatedPasteurizerTemp}
                                    onChange={(e) => setSimulatedPasteurizerTemp(e.target.value)}
                                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                    placeholder="59.5"
                                    step="0.1"
                                />
                                <button
                                    onClick={handleInjectHaccpDeviation}
                                    disabled={!telemetry?.pasteurizer?.active}
                                    className="flex-1 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Simular Desviación
                                </button>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Inyectar Alarma Tanques */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-amber-700 uppercase block">Prueba Cadena de Frío en Tanque</span>
                            <select
                                value={selectedTank}
                                onChange={(e) => setSelectedTank(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            >
                                {(Array.isArray(telemetry?.tanks) ? telemetry.tanks : []).map(t => (
                                    <option key={t.id} value={t.id}>{t.id}</option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={simulatedTankTemp}
                                    onChange={(e) => setSimulatedTankTemp(e.target.value)}
                                    className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    placeholder="7.2"
                                    step="0.1"
                                />
                                <button
                                    onClick={handleInjectTankAlarm}
                                    className="flex-1 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all"
                                >
                                    Simular Alerta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>);
}
