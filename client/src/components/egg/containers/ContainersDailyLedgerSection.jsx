import { Plus, Edit3, Trash2, FileSpreadsheet, FileText, Scale, Receipt, Layers } from 'lucide-react';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

export default function ContainersDailyLedgerSection({ model }) {
    const {
        dailyLedger,
        cutoffs,
        selectedLedgerView,
        setSelectedLedgerView,
        openDailyAddModal,
        openDailyEditModal,
        handleDeleteDailyRow,
        handleOpenStatementPdf,
        handleExportStatementExcel
    } = model;

    const isViewingActive = selectedLedgerView === 'active';
    const selectedCutoff = !isViewingActive
        ? (Array.isArray(cutoffs) ? cutoffs : []).find(c => String(c.id) === String(selectedLedgerView))
        : null;

    const rows = isViewingActive
        ? (Array.isArray(dailyLedger?.rows) ? dailyLedger.rows : [])
        : (Array.isArray(selectedCutoff?.daily_rows) ? selectedCutoff.daily_rows : []);

    const openingLbs = isViewingActive
        ? Number(dailyLedger?.opening_lbs_balance || 0)
        : Number(selectedCutoff?.opening_lbs_balance || 0);

    const closingLbs = isViewingActive
        ? Number(dailyLedger?.totals?.closing_lbs_balance || 0)
        : Number(selectedCutoff?.closing_lbs_balance || 0);

    const storageSubtotal = isViewingActive
        ? Number(dailyLedger?.totals?.storage_subtotal || 0)
        : Number(selectedCutoff?.storage_subtotal || selectedCutoff?.subtotal || 0);

    const dischargeTotal = isViewingActive
        ? Number(dailyLedger?.totals?.loading_unloading_total || 0)
        : Number(selectedCutoff?.loading_unloading_total || 0);

    const conceptsTotal = +(storageSubtotal + dischargeTotal).toFixed(2);
    const ivaAmount = +(conceptsTotal * 0.13).toFixed(2);
    const totalWithIva = +(conceptsTotal + ivaAmount).toFixed(2);

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            {/* Cabecera y Selector de Corte / Archivo Vigente */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-tight">
                            Almacenamiento en Contenedor • Estado de Cuenta Diario
                        </h2>
                        {isViewingActive ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase">
                                Archivo 1.2 • Período Vigente en Curso
                            </span>
                        ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-black uppercase">
                                Histórico: {selectedCutoff?.cutoff_code} ({formatDate(selectedCutoff?.period_start)} al {formatDate(selectedCutoff?.period_end)})
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Control diario de ingreso/salida de libras, saldo acumulado desde el corte anterior, contenedores activos por día (`N° CON.`), cobro diario (`$195`) y cargas/descargas.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Selector para alternar entre Archivo 1.2 Vigente y Cortes Anteriores */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setSelectedLedgerView('active')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                isViewingActive
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Vigente 1.2 ({dailyLedger?.rows?.length || 0} días)
                        </button>
                        {(Array.isArray(cutoffs) ? cutoffs : []).map((cut) => (
                            <button
                                key={cut.id}
                                type="button"
                                onClick={() => setSelectedLedgerView(String(cut.id))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    String(selectedLedgerView) === String(cut.id)
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {cut.cutoff_code} ({formatDate(cut.period_start)} - {formatDate(cut.period_end)})
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            handleOpenStatementPdf(
                                isViewingActive
                                    ? {}
                                    : { cutoff_id: selectedCutoff?.id, code: selectedCutoff?.cutoff_code }
                            )
                        }
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                        <FileText size={14} className="text-indigo-600" />
                        <span>PDF</span>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            handleExportStatementExcel(
                                isViewingActive ? {} : { cutoff_id: selectedCutoff?.id }
                            )
                        }
                        className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                        <FileSpreadsheet size={14} />
                        <span>Excel</span>
                    </button>

                    {isViewingActive && (
                        <button
                            type="button"
                            onClick={openDailyAddModal}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>Registrar Día</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabla Diaria Oficial (Idéntica al Formato de Estado de Cuenta del Cliente) */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 text-white text-[10px] font-extrabold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Fecha</th>
                            <th className="py-2.5 px-3 text-right">Ingreso (Lbs)</th>
                            <th className="py-2.5 px-3 text-right">Salida (Lbs)</th>
                            <th className="py-2.5 px-3 text-right bg-indigo-950">Saldo Libras</th>
                            <th className="py-2.5 px-3 text-right">$ X Día</th>
                            <th className="py-2.5 px-3 text-center"># de Contenedores</th>
                            <th className="py-2.5 px-3 text-right bg-slate-800">Días $</th>
                            <th className="py-2.5 px-3 text-right">Cargas y Descargas</th>
                            <th className="py-2.5 px-2.5 text-center">Retiro</th>
                            <th className="py-2.5 px-2.5 text-center">Ingreso</th>
                            <th className="py-2.5 px-3">N° CON.</th>
                            {isViewingActive && <th className="py-2.5 px-3 text-right">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                        {/* Fila 0: LIBRAS (Saldo Inicial arrastrado del corte anterior) */}
                        <tr className="bg-indigo-50/70 font-bold text-slate-800">
                            <td className="py-2 px-3 text-[11px] font-black uppercase text-indigo-900">
                                LIBRAS (Saldo Inicial)
                            </td>
                            <td className="py-2 px-3 text-right text-slate-400">—</td>
                            <td className="py-2 px-3 text-right text-slate-400">—</td>
                            <td className="py-2 px-3 text-right font-black text-indigo-700 bg-indigo-100/60">
                                {openingLbs.toLocaleString('en-US')}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-400">—</td>
                            <td className="py-2 px-3 text-center text-[10px] font-bold uppercase text-slate-500">
                                contenedores
                            </td>
                            <td className="py-2 px-3 text-right text-slate-400">—</td>
                            <td className="py-2 px-3 text-right text-slate-400">—</td>
                            <td className="py-2 px-2.5 text-center text-slate-400">—</td>
                            <td className="py-2 px-2.5 text-center text-slate-400">—</td>
                            <td className="py-2 px-3 text-[10px] text-indigo-700 font-semibold">
                                {openingLbs > 0 ? 'Arrastrado del último corte' : 'Inicio en 0 lbs'}
                            </td>
                            {isViewingActive && <td className="py-2 px-3" />}
                        </tr>

                        {/* Filas Diarias */}
                        {rows.map((row) => (
                            <tr key={row.id || row.entry_date} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                    {formatDate(row.entry_date)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                    {row.lbs_in > 0 ? Number(row.lbs_in).toLocaleString('en-US') : ''}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-rose-600">
                                    {row.lbs_out > 0 ? Number(row.lbs_out).toLocaleString('en-US') : ''}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-slate-900 bg-indigo-50/30">
                                    {Number(row.lbs_balance || 0).toLocaleString('en-US')}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-700">
                                    <Money value={row.daily_rate} />
                                </td>
                                <td className="py-2 px-3 text-center">
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900 font-black text-xs">
                                        {row.containers_count}
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-right font-black text-slate-900 bg-slate-50">
                                    <Money value={row.days_amount} />
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-amber-700">
                                    {row.loading_unloading_cost > 0 ? (
                                        <Money value={row.loading_unloading_cost} />
                                    ) : (
                                        <span className="text-slate-400">0</span>
                                    )}
                                </td>
                                <td className="py-2 px-2.5 text-center font-bold text-rose-600">
                                    {row.withdrawal_count > 0 ? row.withdrawal_count : ''}
                                </td>
                                <td className="py-2 px-2.5 text-center font-bold text-emerald-700">
                                    {row.income_count > 0 ? row.income_count : ''}
                                </td>
                                <td className="py-2 px-3">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-extrabold text-slate-800">
                                        {row.active_containers_list || '—'}
                                    </span>
                                </td>
                                {isViewingActive && (
                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => openDailyEditModal(row)}
                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                                                title="Editar fila diaria"
                                            >
                                                <Edit3 size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteDailyRow(row)}
                                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                                title="Eliminar fila diaria"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}

                        {/* Fila TOTAL */}
                        <tr className="bg-slate-900 text-white font-black text-xs">
                            <td className="py-2.5 px-3 uppercase">TOTAL</td>
                            <td className="py-2.5 px-3 text-right text-emerald-300">
                                {rows.reduce((s, r) => s + Number(r.lbs_in || 0), 0) > 0
                                    ? rows.reduce((s, r) => s + Number(r.lbs_in || 0), 0).toLocaleString('en-US')
                                    : ''}
                            </td>
                            <td className="py-2.5 px-3 text-right text-rose-300">
                                {rows.reduce((s, r) => s + Number(r.lbs_out || 0), 0) > 0
                                    ? rows.reduce((s, r) => s + Number(r.lbs_out || 0), 0).toLocaleString('en-US')
                                    : ''}
                            </td>
                            <td className="py-2.5 px-3 text-right text-cyan-300 text-sm">
                                {closingLbs.toLocaleString('en-US')}
                            </td>
                            <td className="py-2.5 px-3" />
                            <td className="py-2.5 px-3 text-center text-amber-300">
                                {rows.reduce((s, r) => s + Number(r.containers_count || 0), 0)} d
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 text-sm">
                                <Money value={storageSubtotal} />
                            </td>
                            <td className="py-2.5 px-3 text-right text-amber-300 text-sm">
                                <Money value={dischargeTotal} />
                            </td>
                            <td className="py-2.5 px-2.5 text-center">
                                {rows.reduce((s, r) => s + Number(r.withdrawal_count || 0), 0) || ''}
                            </td>
                            <td className="py-2.5 px-2.5 text-center">
                                {rows.reduce((s, r) => s + Number(r.income_count || 0), 0) || ''}
                            </td>
                            <td className="py-2.5 px-3 text-[10px] text-slate-300">
                                {rows[rows.length - 1]?.active_containers_list || ''}
                            </td>
                            {isViewingActive && <td className="py-2.5 px-3" />}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Cuadro Inferior de Libras y Conceptos (Idéntico al Estado de Cuenta del Cliente) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Bloque Izquierdo: Libras en Contenedores */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-700 mb-3">
                        <Scale size={15} className="text-indigo-600" />
                        <span>Resumen de Inventario en Contenedores (Libras)</span>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                            <span className="font-semibold text-slate-600">Saldo Inicial (Corte Anterior):</span>
                            <span className="font-bold text-slate-800">{openingLbs.toLocaleString('en-US')} lbs</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                            <span className="font-bold text-slate-700">Libras en contenedores:</span>
                            <span className="font-black text-indigo-700 text-sm">{closingLbs.toLocaleString('en-US')} lbs</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <span className="font-extrabold uppercase text-slate-900">Total de libras:</span>
                            <span className="font-black text-slate-900 text-base">{closingLbs.toLocaleString('en-US')} lbs</span>
                        </div>
                    </div>
                </div>

                {/* Bloque Derecho: Conceptos y Valor */}
                <div className="rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-white/15 pb-2 mb-2 text-[11px] font-extrabold uppercase text-indigo-200">
                        <span className="flex items-center gap-1.5">
                            <Layers size={14} className="text-cyan-400" />
                            Conceptos
                        </span>
                        <span>Valor</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-300 font-medium">Almacenamiento contenedores:</span>
                            <Money value={storageSubtotal} className="font-bold text-white" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-300 font-medium">Valor por descarga (Cargas y Descargas):</span>
                            <Money value={dischargeTotal} className="font-bold text-amber-300" />
                        </div>
                        <div className="pt-2 border-t border-white/15 flex items-center justify-between">
                            <span className="font-black uppercase text-cyan-300 text-sm flex items-center gap-1.5">
                                <Receipt size={14} />
                                Total Estado de Cuenta:
                            </span>
                            <Money value={conceptsTotal} className="text-lg font-black text-emerald-400" />
                        </div>
                        <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                            <span>+ IVA (13%): <Money value={ivaAmount} className="text-slate-200 font-semibold" /></span>
                            <span>Total con IVA: <Money value={totalWithIva} className="text-white font-bold" /></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
