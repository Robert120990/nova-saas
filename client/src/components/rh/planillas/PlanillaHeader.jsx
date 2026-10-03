import { Loader2, CheckCircle, Zap, RefreshCw, Award } from 'lucide-react';


import { fieldCls, labelCls, years, months } from './planillaUtils';
const PlanillaHeader = ({ model }) => {
    const { periodoAnio, changePeriod, periodoBloqueado, periodoMes, quincena, diasTrabajados, handleDiasTrabajadosChange, handleSincronizar, sincronizarMutation, handleSincronizarComisionesHuevo, syncingHuevo, handleGenerar, generando, hayOtraAbierta } = model;
    return (<div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
                            <div>
                                <label className={labelCls}>Año</label>
                                <select
                                    value={periodoAnio}
                                    onChange={e => changePeriod('anio', e.target.value)}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                >
                                    {(Array.isArray(years) ? years : []).map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Mes</label>
                                <select
                                    value={periodoMes}
                                    onChange={e => changePeriod('mes', e.target.value)}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                >
                                    {(Array.isArray(months) ? months : []).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Quincena</label>
                                <select
                                    value={quincena}
                                    onChange={e => changePeriod('quincena', e.target.value)}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                >
                                    <option value="primera">Primera</option>
                                    <option value="segunda">Segunda</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Días Trab.</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={diasTrabajados}
                                    onChange={e => handleDiasTrabajadosChange(parseInt(e.target.value) || 15)}
                                    disabled={periodoBloqueado}
                                    className={fieldCls}
                                />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-2 flex items-end">
                                {periodoBloqueado ? (
                                    <div className="w-full flex flex-wrap items-center justify-between gap-2 bg-slate-50 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                                <CheckCircle size={14} /> {model.empleadoData?.totales?.estado === 'pagada' ? 'Cerrada' : 'Activa'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleSincronizar}
                                                disabled={sincronizarMutation.isPending}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-[11px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                title="Incorporar empleados nuevos o actualizar novedades sin borrar horas extras ni datos existentes"
                                            >
                                                <RefreshCw size={12} className={sincronizarMutation.isPending ? 'animate-spin' : ''} />
                                                <span>{sincronizarMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSincronizarComisionesHuevo}
                                                disabled={syncingHuevo}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-[11px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                                title="Importar y liquidar comisiones por ventas de huevo industrial con tope reglamentario de $1,000"
                                            >
                                                <Award size={12} className={syncingHuevo ? 'animate-spin text-amber-600' : 'text-amber-600'} />
                                                <span>{syncingHuevo ? 'Sincronizando Huevo...' : 'Comisiones Huevo ($1K)'}</span>
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => changePeriod('mes', periodoMes)}
                                            className="text-[11px] text-slate-500 hover:text-slate-800 font-bold underline"
                                        >
                                            Cambiar período
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleGenerar}
                                        disabled={generando || hayOtraAbierta}
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                                            hayOtraAbierta
                                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
                                        }`}
                                        title={hayOtraAbierta ? "Hay otra planilla abierta pendiente de cierre" : "Generar planilla para todos"}
                                    >
                                        {generando ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                        {generando ? 'Generando para todos...' : 'Generar Planilla'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>);
};
export default PlanillaHeader;
