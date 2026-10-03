import { RefreshCcw, Save, AlertTriangle, Hash, ArrowRight } from 'lucide-react';
import useAccountingCorrelativos from '../components/accounting/useAccountingCorrelativos';
import AccountingCorrelativosConflict from '../components/accounting/AccountingCorrelativosConflict';
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const inputCls = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm';
const AccountingCorrelativos = () => {
    const { effectiveTypeId, year, edits, conflict, resolveConflict, renumberResult, entryTypes, typeData, months, isLoading, busy, save, renumberMutation, dirtyMonths, totalPosted, gapMonths, handleRenumber, updateMonth, changeFilter } = useAccountingCorrelativos();
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 animate-in fade-in pb-20">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3"><RefreshCcw size={28} className="text-indigo-600" />Correlativos de Partidas</h1>
                <p className="text-slate-500 mt-1 font-medium">Configura el próximo número por mes y reenumera partidas existentes</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Tipo de Partida</label>
                        <select value={effectiveTypeId} disabled={busy} onChange={(e) => changeFilter('type', e.target.value)} className={inputCls}>
                            {(Array.isArray(entryTypes) ? entryTypes : []).map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Año</label>
                        <input
                            type="number"
                            min="2000"
                            max="2200"
                            value={year}
                            disabled={busy} onChange={(e) => changeFilter('year', e.target.value)}
                            className={inputCls}
                        />
                    </div>
                </div>
            </div>

            <AccountingCorrelativosConflict conflict={conflict} edits={edits} onResolve={resolveConflict} busy={busy} />
            {gapMonths.length > 0 && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-[12px] text-amber-800">
                        <b>Huecos detectados</b> en: {gapMonths.map(m => MONTH_NAMES[m.month - 1]).join(', ')}. La numeración salta números respecto a la cantidad de partidas.
                        Usa "Reenumerar" para corregirlo.
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5"><Hash size={13} /> Próximo número por mes — {year}</span>
                    <button
                        onClick={save}
                        disabled={busy || !!conflict || dirtyMonths.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={14} /> Guardar{dirtyMonths.length ? ` (${dirtyMonths.length})` : ''}
                    </button>
                </div>
                {isLoading ? (
                    <div className="py-10 text-center text-xs text-slate-400">Cargando...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-cards w-full md:min-w-[640px]">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase text-slate-400">Mes</th>
                                    <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase text-slate-400 w-[160px]">Próximo número</th>
                                    <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase text-slate-400">Último usado</th>
                                    <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase text-slate-400">Partidas</th>
                                    <th className="px-4 py-2.5 text-center text-[9px] font-black uppercase text-slate-400 w-[80px]">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(months) ? months : []).map(m => (
                                    <tr key={m.month} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                                        <td data-label="Mes" className="px-4 py-2.5 text-[13px] font-bold text-slate-700">{MONTH_NAMES[m.month - 1]}</td>
                                        <td data-label="Próximo número" className="px-4 py-2.5">
                                            <input
                                                type="number"
                                                min="1"
                                                disabled={busy}
                                                value={edits[m.month] !== undefined ? edits[m.month] : (m.next_number ?? '')}
                                                placeholder="Auto"
                                                onChange={(e) => {
                                                    const v = e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1);
                                                    updateMonth(m, v);
                                                }}
                                                className={`${inputCls} font-mono`}
                                            />
                                        </td>
                                        <td data-label="Último usado" className="px-4 py-2.5 text-right font-mono text-[12px] text-slate-600">{m.last_used != null ? `${String(year).slice(-2)}${String(m.month).padStart(2, '0')}${String(m.last_used).padStart(3, '0')}` : '—'}</td>
                                        <td data-label="Partidas" className="px-4 py-2.5 text-right text-[12px] text-slate-600">{m.total_entries}</td>
                                        <td data-label="Estado" className="px-4 py-2.5 text-center">
                                            {edits[m.month] !== undefined ? (
                                                <span className="text-[9px] font-black uppercase text-indigo-600">Editado</span>
                                            ) : m.has_gap ? (
                                                <span className="text-[9px] font-black uppercase text-amber-600">Hueco</span>
                                            ) : (
                                                <span className="text-[9px] font-black uppercase text-emerald-600">OK</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {months.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">Selecciona un tipo de partida.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Reenumerar partidas</span>
                    <p className="text-[11px] text-slate-500">
                        Reasigna los números de todas las partidas <b>activas</b> del tipo y año seleccionado, en orden cronológico,
                        empezando desde 001 en cada mes y omitiendo los números reservados por partidas anuladas.
                    </p>
                </div>
                {totalPosted > 0 && (
                    <p className="text-[12px] text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 inline-block">
                        Se verán afectadas <b>{totalPosted}</b> partida(s){gapMonths.length > 0 ? ` · huecos en ${gapMonths.length} mes(es)` : ''}
                    </p>
                )}
                <button
                    onClick={handleRenumber}
                    disabled={busy || !typeData || totalPosted === 0 || dirtyMonths.length > 0}
                    className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-black uppercase text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <RefreshCcw size={15} /> {renumberMutation.isPending ? 'Reenumerando...' : `Reenumerar partidas ${year}`}
                </button>

                {renumberResult && (
                    <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-2">
                        <p className="text-[12px] font-bold text-emerald-700 flex items-center gap-2">
                            <ArrowRight size={14} /> {renumberResult.message}
                        </p>
                        {renumberResult.sample?.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[360px] text-[11px]">
                                    <thead>
                                        <tr className="text-[9px] uppercase text-slate-400">
                                            <th className="text-left py-1 pr-4">Partida ID</th>
                                            <th className="text-right py-1 pr-4">Antes</th>
                                            <th className="text-right py-1">Después</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(Array.isArray(renumberResult.sample) ? renumberResult.sample : []).map(s => (
                                            <tr key={s.id}>
                                                <td className="py-0.5 text-slate-500">#{s.id}</td>
                                                <td className="py-0.5 text-right font-mono text-rose-600 line-through pr-4">{s.antes}</td>
                                                <td className="py-0.5 text-right font-mono text-emerald-700">{s.despues}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountingCorrelativos;
