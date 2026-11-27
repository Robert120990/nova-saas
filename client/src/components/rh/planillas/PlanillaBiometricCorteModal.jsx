import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Clock, AlertTriangle, CheckCircle2, Loader2, Calendar, Users, Scale, Eye } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { unwrapList } from '../../../utils/apiUtils';
import { formatDate, formatDateTime } from '../../../utils/dateUtils';
import Money from '../../ui/Money';
import Table from '../../ui/Table';
import { getMesLabel, STATUS_BADGES, findBestMatchingCorte } from './planillaBiometricCorteUtils';

const BiometricCorteModalBody = ({ onClose, onSuccess, periodoAnio, periodoMes, quincena }) => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const queryClient = useQueryClient();
    const [selectedCorteId, setSelectedCorteId] = useState('');
    const [modo, setModo] = useState('reemplazar');
    const [separarNocturnas, setSepararNocturnas] = useState(true);
    const [incluirAvicola, setIncluirAvicola] = useState(true);
    const [showExcluded, setShowExcluded] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [initializedCorteKey, setInitializedCorteKey] = useState('');

    const { data: cortes = [], isLoading: loadingCortes } = useQuery({
        queryKey: ['rh-planillas-cortes-biometricos', companyId],
        queryFn: async () => unwrapList(await axios.get('/api/rh/planillas/cortes-biometricos')),
        enabled: Boolean(companyId)
    });

    useEffect(() => {
        if (cortes.length > 0 && !selectedCorteId) {
            setSelectedCorteId(findBestMatchingCorte(cortes, periodoAnio, periodoMes, quincena));
        }
    }, [cortes, selectedCorteId, periodoAnio, periodoMes, quincena]);

    const { data: preview, isLoading: loadingPreview, error: previewError } = useQuery({
        queryKey: ['rh-planillas-corte-biometrico-preview', companyId, selectedCorteId, periodoAnio, periodoMes, quincena, separarNocturnas, incluirAvicola],
        queryFn: async () => (await axios.get(`/api/rh/planillas/cortes-biometricos/${selectedCorteId}/preview`, {
            params: {
                periodo_anio: periodoAnio,
                periodo_mes: periodoMes,
                quincena,
                separar_nocturnas: separarNocturnas ? 1 : 0,
                incluir_avicola: incluirAvicola ? 1 : 0
            }
        })).data,
        enabled: Boolean(companyId && selectedCorteId)
    });

    const rows = Array.isArray(preview?.rows) ? preview.rows : [];
    const corte = preview?.corte || cortes.find(c => String(c.id) === String(selectedCorteId)) || null;
    const eligibleRows = useMemo(() => rows.filter(r => r.elegible && r.empleado_id && r.horas_pagables > 0), [rows]);
    const positiveRows = useMemo(() => rows.filter(r => r.horas_pagables > 0), [rows]);
    const excludedCount = rows.length - positiveRows.length;
    const visibleRows = showExcluded ? rows : positiveRows;

    useEffect(() => {
        if (preview?.corte?.id && String(preview.corte.id) === String(selectedCorteId)) {
            const key = `${preview.corte.id}:${periodoAnio}:${periodoMes}:${quincena}:${incluirAvicola ? 1 : 0}`;
            if (initializedCorteKey !== key) {
                setSelectedIds(new Set(rows.filter(r => r.elegible && r.empleado_id && r.horas_pagables > 0).map(r => r.empleado_id)));
                setInitializedCorteKey(key);
            }
        }
    }, [preview, rows, selectedCorteId, periodoAnio, periodoMes, quincena, incluirAvicola, initializedCorteKey]);

    const applyMutation = useMutation({
        mutationFn: async () => (await axios.post('/api/rh/planillas/aplicar-corte-biometrico', {
            corte_id: Number(selectedCorteId),
            periodo_anio: periodoAnio,
            periodo_mes: periodoMes,
            quincena,
            modo,
            separar_nocturnas: separarNocturnas,
            incluir_avicola: incluirAvicola,
            empleado_ids: Array.from(selectedIds)
        })).data,
        onSuccess: (res) => {
            toast.success(res?.message || 'Corte de horas aplicado a la planilla');
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-grupos'] });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-abiertas'] });
            queryClient.invalidateQueries({ queryKey: ['rh-planillas-cortes-biometricos'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-list'] });
            onSuccess?.(res);
            onClose();
        },
        onError: (err) => toast.error(err?.response?.data?.message || 'Error al aplicar corte de horas a la planilla')
    });

    const toggleAllEligible = () => {
        if (eligibleRows.length === 0) return;
        const allSelected = eligibleRows.every(r => selectedIds.has(r.empleado_id));
        setSelectedIds(allSelected ? new Set() : new Set(eligibleRows.map(r => r.empleado_id)));
    };

    const toggleOne = (empId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId);
            else next.add(empId);
            return next;
        });
    };

    const selectedStats = useMemo(() => {
        const picked = eligibleRows.filter(r => selectedIds.has(r.empleado_id));
        return {
            count: picked.length,
            diurnas: picked.reduce((s, r) => s + Number(r.horas_diurnas || 0), 0),
            nocturnas: picked.reduce((s, r) => s + Number(r.horas_nocturnas || 0), 0),
            monto: picked.reduce((s, r) => s + Number(r.monto_total || 0), 0)
        };
    }, [eligibleRows, selectedIds]);

    const qLabel = quincena === 'primera' ? '1ra Quincena' : '2da Quincena';
    const allEligibleChecked = eligibleRows.length > 0 && eligibleRows.every(r => selectedIds.has(r.empleado_id));
    const alreadySamePeriod = corte && Number(corte.planilla_anio) === Number(periodoAnio) && Number(corte.planilla_mes) === Number(periodoMes) && corte.planilla_quincena === quincena;
    const alreadyOtherPeriod = corte && corte.planilla_anio && !alreadySamePeriod;
    const hasAvicola = Number(corte?.total_horas_extra_avicola || preview?.summary?.total_horas_avicola || 0) > 0;

    const headers = [
        {
            label: (
                <input
                    type="checkbox"
                    checked={allEligibleChecked}
                    onChange={toggleAllEligible}
                    disabled={eligibleRows.length === 0}
                    title="Seleccionar / deseleccionar todos los elegibles"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
            ),
            sortable: false,
            className: 'w-9 text-center px-2'
        },
        { label: 'Colaborador', sortKey: 'nombre', sortType: 'string' },
        { label: 'Saldo Corte', sortKey: 'horas_pagables', sortType: 'number', className: 'text-right' },
        { label: 'Actual Planilla', sortKey: 'horas_actuales_diurnas', sortType: 'number', className: 'text-right' },
        { label: 'A Cargar (08 / 03)', sortKey: 'horas_diurnas', sortType: 'number', className: 'text-right' },
        { label: 'Monto Est.', sortKey: 'monto_total', sortType: 'number', className: 'text-right' },
        { label: 'Estado', sortKey: 'estado_empleado', sortType: 'string', className: 'text-center' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-sky-100 text-sky-700 shrink-0"><Clock className="w-5 h-5" /></div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-slate-800 truncate">Importar Corte de Horas del Marcador Digital</h3>
                            <p className="text-xs text-slate-500 truncate">Destino: {getMesLabel(periodoMes)} {periodoAnio} — {qLabel}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
                    {loadingCortes ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="w-6 h-6 animate-spin text-sky-600" /><span>Cargando cortes congelados del marcador...</span>
                        </div>
                    ) : cortes.length === 0 ? (
                        <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-sm flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold">No hay cortes de horas congelados disponibles</p>
                                <p className="text-xs mt-1 text-amber-800">Primero vaya a RRHH → Marcador Digital → Horas Extras / Cortes y congele el período quincenal para poder importarlo en Planilla.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase">Corte Congelado a Importar</label>
                                <select
                                    value={selectedCorteId}
                                    onChange={(e) => setSelectedCorteId(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-medium outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400"
                                >
                                    {cortes.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre} ({formatDate(c.fecha_inicio)} al {formatDate(c.fecha_fin)}) — +{Number(c.total_horas_extra_pagables || c.total_horas_extra_aprobadas || 0).toFixed(1)}h pagables
                                            {c.planilla_anio ? ` [Aplicado: ${getMesLabel(c.planilla_mes)} ${c.planilla_anio}]` : ''}
                                        </option>
                                    ))}
                                </select>
                                {corte && (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
                                        <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-sky-600" /> {formatDate(corte.fecha_inicio)} al {formatDate(corte.fecha_fin)}</span>
                                        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-indigo-600" /> {corte.total_empleados} colaboradores</span>
                                        <span>Prod: <b>{Number(corte.total_horas_extra_produccion || 0).toFixed(1)}h</b></span>
                                        <span>Transp: <b>{Number(corte.total_horas_extra_transporte || 0).toFixed(1)}h</b></span>
                                        {Number(corte.total_horas_extra_avicola || 0) > 0 && <span>Avícola: <b>{Number(corte.total_horas_extra_avicola).toFixed(1)}h</b></span>}
                                    </div>
                                )}
                            </div>

                            <div className="p-2.5 rounded-xl border border-indigo-200/70 bg-indigo-50/50 text-indigo-900 text-[11px] flex items-start gap-2">
                                <Scale className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                                <span>
                                    <b>Cálculo según Código de Trabajo SV:</b> Hora ord. = Sueldo ÷ 30 ÷ 8 · Diurna (Art. 169) = <b>×2.0 (200%)</b> · Nocturna 19:00–06:00 (Arts. 168–169) = <b>×2.5 (250%)</b>. Recalcula ISSS, AFP e ISR.
                                </span>
                            </div>

                            {(alreadySamePeriod || alreadyOtherPeriod) && (
                                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span>
                                        {alreadySamePeriod
                                            ? `Este corte ya fue aplicado a ${getMesLabel(corte.planilla_mes)} ${corte.planilla_anio} (${corte.planilla_quincena === 'primera' ? '1ra' : '2da'} Quincena)${corte.aplicado_planilla_at ? ` el ${formatDateTime(corte.aplicado_planilla_at)}` : ''}. Si usa "Reemplazar", actualizará las horas sin duplicarlas.`
                                            : `Atención: este corte ya aparece aplicado en ${getMesLabel(corte.planilla_mes)} ${corte.planilla_anio} (${corte.planilla_quincena === 'primera' ? '1ra' : '2da'} Quincena). Verifique antes de aplicarlo a este período.`}
                                    </span>
                                </div>
                            )}

                            <div className={`grid grid-cols-1 ${hasAvicola ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5">
                                    <span className="block text-[11px] font-bold text-slate-500 uppercase">Modo de Carga</span>
                                    <div className="flex flex-wrap gap-3 text-xs">
                                        <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                                            <input type="radio" name="modo-corte" value="reemplazar" checked={modo === 'reemplazar'} onChange={() => setModo('reemplazar')} className="text-sky-600 focus:ring-sky-500" />
                                            <span>Reemplazar horas</span>
                                        </label>
                                        <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                                            <input type="radio" name="modo-corte" value="sumar" checked={modo === 'sumar'} onChange={() => setModo('sumar')} className="text-sky-600 focus:ring-sky-500" />
                                            <span>Sumar a existentes</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
                                    <div>
                                        <span className="block text-xs font-bold text-slate-700">Separar H.E. Nocturnas (2.5x)</span>
                                        <span className="text-[11px] text-slate-500">19:00–06:00 a cuenta 03 y resto a 08 (2.0x)</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={separarNocturnas}
                                        onChange={(e) => setSepararNocturnas(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 shrink-0"
                                    />
                                </div>

                                {hasAvicola && (
                                    <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/50 flex items-center justify-between gap-3">
                                        <div>
                                            <span className="block text-xs font-bold text-amber-900">Incluir H.E. Avícola (+{Number(corte?.total_horas_extra_avicola || preview?.summary?.total_horas_avicola || 0).toFixed(1)}h)</span>
                                            <span className="text-[11px] text-amber-700">Suma horas avícolas aprobadas al pago</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={incluirAvicola}
                                            onChange={(e) => setIncluirAvicola(e.target.checked)}
                                            className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 shrink-0"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Positivos Elegibles</span>
                                    <span className="text-sm font-black text-slate-800">{selectedStats.count} / {positiveRows.length}</span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/50">
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase block">Diurnas 2.0x (Cta 08)</span>
                                    <span className="text-sm font-black font-mono text-indigo-800">{selectedStats.diurnas.toFixed(2)} h</span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-violet-200/80 bg-violet-50/50">
                                    <span className="text-[10px] font-bold text-violet-700 uppercase block">Nocturnas 2.5x (Cta 03)</span>
                                    <span className="text-sm font-black font-mono text-violet-800">{selectedStats.nocturnas.toFixed(2)} h</span>
                                </div>
                                <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">Monto Est. Corte</span>
                                    <Money value={selectedStats.monto} className="text-sm font-black font-mono text-emerald-800 block" />
                                </div>
                            </div>

                            {excludedCount > 0 && (
                                <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        Solo se cargan horas <b>positivas (&gt; 0)</b>. Se excluyen <b>{excludedCount}</b> colaborador(es) con saldo negativo o cero (quedan en arrastre en Marcador Digital).
                                    </span>
                                    <button type="button" onClick={() => setShowExcluded(v => !v)}
                                        className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800">
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>{showExcluded ? 'Ocultar excluidos' : `Ver excluidos (${excludedCount})`}</span>
                                    </button>
                                </div>
                            )}

                            {previewError && (
                                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800">
                                    {previewError?.response?.data?.message || 'Error al cargar vista previa del corte.'}
                                </div>
                            )}

                            <Table
                                headers={headers}
                                data={visibleRows}
                                isLoading={loadingPreview}
                                compact
                                maxHeight="300px"
                                emptyMessage="No hay colaboradores con saldo positivo (> 0h) en este corte."
                                renderRow={(r) => {
                                    const checked = Boolean(r.elegible && r.empleado_id && selectedIds.has(r.empleado_id));
                                    const badge = STATUS_BADGES[r.estado_empleado] || STATUS_BADGES.en_planilla;
                                    const curTot = Number(r.horas_actuales_diurnas || 0) + Number(r.horas_actuales_nocturnas || 0);
                                    return (
                                        <tr key={`${r.device_uid}_${r.empleado_id || 'x'}`} className={`text-xs ${r.elegible ? 'hover:bg-slate-50/90' : 'bg-slate-50/50 text-slate-400'}`}>
                                            <td className="py-2 px-2 text-center">
                                                <input type="checkbox" checked={checked} disabled={!r.elegible}
                                                    onChange={() => r.empleado_id && toggleOne(r.empleado_id)}
                                                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-40" />
                                            </td>
                                            <td className="py-2 px-2.5">
                                                <span className="font-bold text-slate-800 block">{r.nombre}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">[{r.codigo}] · {r.area}</span>
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-mono font-bold">
                                                <span className={r.es_saldo_negativo ? 'text-rose-600' : 'text-slate-700'}>
                                                    {r.es_saldo_negativo ? `${Number(r.saldo_neto || 0).toFixed(2)}h` : `${Number(r.horas_pagables || 0).toFixed(2)}h`}
                                                </span>
                                                {r.horas_extra_avicola > 0 && incluirAvicola && (
                                                    <span className="block text-[10px] font-normal text-amber-700">Avíc: +{Number(r.horas_extra_avicola).toFixed(1)}h</span>
                                                )}
                                                {Number(r.horas_pendientes_anteriores || 0) !== 0 && (
                                                    <span className="block text-[10px] font-normal text-slate-400">Arr: {Number(r.horas_pendientes_anteriores).toFixed(1)}h</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-mono text-slate-600">
                                                {curTot > 0 ? `${Number(r.horas_actuales_diurnas).toFixed(1)}d / ${Number(r.horas_actuales_nocturnas).toFixed(1)}n` : '0.0h'}
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-mono font-bold text-indigo-700">
                                                {r.horas_pagables > 0 ? (
                                                    <>
                                                        {modo === 'sumar' && curTot > 0 ? '+' : ''}{Number(r.horas_diurnas).toFixed(2)}d
                                                        {Number(r.horas_nocturnas) > 0 && <span className="block text-[10px] text-violet-700">+{Number(r.horas_nocturnas).toFixed(2)}n</span>}
                                                    </>
                                                ) : <span className="text-slate-400 font-normal">0.00h (no carga)</span>}
                                            </td>
                                            <td className="py-2 px-2.5 text-right font-mono font-bold text-emerald-700">
                                                <Money value={r.monto_total} />
                                                {r.tarifa_diurna > 0 && (
                                                    <span className="block text-[9.5px] font-normal text-slate-400">2.0x: <Money value={r.tarifa_diurna} />/h</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2.5 text-center">
                                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                                            </td>
                                        </tr>
                                    );
                                }}
                            />
                        </>
                    )}
                </div>

                <div className="px-4 sm:px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-[11px] text-slate-500">Solo se cargan horas positivas (&gt; 0) calculadas según ley; recalcula ISSS, AFP y Renta.</span>
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={onClose} disabled={applyMutation.isPending}
                            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button type="button" onClick={() => applyMutation.mutate()}
                            disabled={applyMutation.isPending || selectedStats.count === 0 || !selectedCorteId || Boolean(preview?.summary?.periodo_cerrado)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm disabled:opacity-50 transition-all">
                            {applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{applyMutation.isPending ? 'Aplicando...' : `Aplicar a ${selectedStats.count} Empleado(s)`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function PlanillaBiometricCorteModal(props) {
    if (!props.open) return null;
    return <BiometricCorteModalBody {...props} />;
}
