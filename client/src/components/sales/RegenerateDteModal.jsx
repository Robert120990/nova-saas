import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { RefreshCcw, AlertCircle, UserCheck, ArrowRight, Info } from 'lucide-react';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { unwrapList } from '../../utils/apiUtils';

const RegenerateDteModal = ({ isOpen, onClose, sale, currentUser, onSuccess }) => {
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [preview, setPreview] = useState(null);
    const [updateDateTime, setUpdateDateTime] = useState(false);
    const [openShifts, setOpenShifts] = useState([]);
    const [targetShiftId, setTargetShiftId] = useState('');
    const [loadingShifts, setLoadingShifts] = useState(false);
    const [useCurrentCustomerState, setUseCurrentCustomerState] = useState(false);
    const [stripIvaOnExempt, setStripIvaOnExempt] = useState(true);
    const [addIvaFromExempt, setAddIvaFromExempt] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const isAccepted = Boolean(
        preview?.is_already_accepted ||
        sale?.dte_status === 'ACCEPTED' ||
        sale?.sello_recepcion
    );

    // Inicializar estado de fecha y turnos al abrir el modal para una venta
    useEffect(() => {
        if (!isOpen || !sale?.id) return;
        const acceptedOrig = sale.dte_status === 'ACCEPTED' || Boolean(sale.sello_recepcion);
        setUseCurrentCustomerState(false);
        setStripIvaOnExempt(true);
        setAddIvaFromExempt(false);
        setOpenShifts([]);
        setTargetShiftId('');

        if (acceptedOrig) {
            setUpdateDateTime(true);
            setLoadingShifts(true);
            axios.get('/api/shifts', { params: { status: 'open', branch_id: sale.branch_id, limit: 50 } })
                .then((res) => {
                    const shifts = unwrapList(res);
                    setOpenShifts(shifts);
                    if (shifts.length === 1) {
                        setTargetShiftId(String(shifts[0].id));
                    } else if (shifts.length > 1) {
                        const myShift = shifts.find(s => s.seller_id === currentUser?.seller_id) || shifts[0];
                        setTargetShiftId(myShift ? String(myShift.id) : '');
                    }
                })
                .catch(() => setOpenShifts([]))
                .finally(() => setLoadingShifts(false));
        } else {
            const today = new Date().toISOString().slice(0, 10);
            const origDate = sale.fecha_emision?.slice(0, 10);
            setUpdateDateTime(origDate !== today);
        }
    }, [isOpen, sale?.id, sale?.branch_id, sale?.dte_status, sale?.sello_recepcion, sale?.fecha_emision, currentUser?.seller_id]);

    // Cargar previsualización de estado fiscal actual del cliente
    useEffect(() => {
        if (!isOpen || !sale?.id) return;
        let active = true;
        setLoadingPreview(true);
        axios.get(`/api/sales/${sale.id}/regenerate-preview`, {
            params: { stripIvaOnExempt, addIvaFromExempt }
        })
            .then((res) => {
                if (active) setPreview(res.data || null);
            })
            .catch(() => {
                if (active) setPreview(null);
            })
            .finally(() => {
                if (active) setLoadingPreview(false);
            });
        return () => { active = false; };
    }, [isOpen, sale?.id, stripIvaOnExempt, addIvaFromExempt]);

    const handleConfirm = async () => {
        if (!sale?.id) return;
        if (isAccepted) {
            if (openShifts.length === 0) {
                return toast.error('No hay ningún turno abierto en la sucursal. Debe abrir un turno antes de proceder.');
            }
            if (!targetShiftId) {
                return toast.error('Debe seleccionar el turno de caja al cual se ingresará la nueva venta.');
            }
        }
        setSubmitting(true);
        try {
            const res = await axios.post(`/api/sales/${sale.id}/regenerate-dte`, {
                updateDateTime,
                target_shift_id: targetShiftId || null,
                useCurrentCustomerState,
                stripIvaOnExempt,
                addIvaFromExempt
            });
            if (res.data?.isNewSale) {
                toast.success(`Nueva venta #${res.data.newSaleId} creada y DTE emitido exitosamente`);
            } else {
                toast.success(`DTE regenerado exitosamente — Ambiente: ${res.data?.ambiente === 'produccion' ? 'Producción' : 'Pruebas'}`);
            }
            onSuccess?.(res.data);
            onClose?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al regenerar DTE');
        } finally {
            setSubmitting(false);
        }
    };

    const fiscalDiffs = Array.isArray(preview?.fiscal_diffs) ? preview.fiscal_diffs : [];
    const receptorDiffs = Array.isArray(preview?.receptor_diffs) ? preview.receptor_diffs : [];
    const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isAccepted ? 'Regenerar DTE — Emisión de Nueva Venta' : 'Regenerar DTE'}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                {isAccepted ? (
                    <div className="flex items-start gap-3 p-4 bg-indigo-50/80 text-indigo-950 rounded-2xl border border-indigo-100 text-xs">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm shadow-indigo-200">
                            <RefreshCcw size={16} />
                        </div>
                        <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="font-black uppercase tracking-wider text-indigo-950 text-[11px]">
                                    DTE Original Aceptado por Hacienda
                                </p>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-bold">Aceptado</span>
                            </div>
                            <p className="text-slate-600 text-[11px] leading-relaxed">
                                Venta original con N° Control <span className="font-mono font-bold text-indigo-700">{sale?.numero_control || '---'}</span>. Se creará un nuevo registro de venta, descontará inventario y emitirá un nuevo DTE.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100 text-xs">
                        <RefreshCcw size={18} className="shrink-0 text-amber-600 mt-0.5" />
                        <div>
                            <p className="font-black uppercase tracking-widest mb-1 text-amber-900">Confirmar Regeneración</p>
                            <p className="font-medium text-amber-800">
                                El DTE previo no fue aceptado por Hacienda. Se generará un nuevo código y número de control sobre esta misma venta.
                            </p>
                        </div>
                    </div>
                )}

                {/* Estado Actual del Cliente (TKT-0041) */}
                {loadingPreview ? (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 animate-pulse text-center">
                        Verificando estado fiscal actual del cliente...
                    </div>
                ) : preview?.has_customer && preview?.fiscal_recalc_supported && (
                    <div className={`p-3.5 rounded-2xl border space-y-3 ${preview.has_fiscal_changes ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <UserCheck size={16} className="text-indigo-600 shrink-0" />
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-800">Estado Actual del Cliente</p>
                                    <p className="text-[11px] text-slate-600">
                                        {preview.customer_current?.nombre} — <strong className="text-indigo-700 uppercase">{preview.customer_current?.condicion_label}</strong>
                                        {preview.customer_current?.exento_iva ? ' • Exento IVA' : ''}
                                    </p>
                                </div>
                            </div>
                            {preview.has_fiscal_changes && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300 self-start sm:self-auto">
                                    Cambio Fiscal Detectado
                                </span>
                            )}
                        </div>

                        {preview.has_fiscal_changes ? (
                            <div className="space-y-2.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setUseCurrentCustomerState(false)}
                                        className={`p-2.5 rounded-xl border text-left transition-all ${!useCurrentCustomerState ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20' : 'bg-white/70 border-slate-200 hover:bg-white'}`}
                                    >
                                        <p className="text-xs font-black text-slate-800">Conservar estado original</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Mantiene montos, exención y retenciones exactos de la venta original.</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUseCurrentCustomerState(true)}
                                        className={`p-2.5 rounded-xl border text-left transition-all ${useCurrentCustomerState ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20' : 'bg-white/70 border-slate-200 hover:bg-white'}`}
                                    >
                                        <p className="text-xs font-black text-indigo-800">Aplicar estado actual del cliente</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Recalcula gravado, exento, IVA, retención/percepción y total del DTE.</p>
                                    </button>
                                </div>

                                {useCurrentCustomerState && (
                                    <div className="space-y-2 pt-1">
                                        {preview.options_applicable?.can_strip_iva_on_exempt && (
                                            <label className="flex items-center gap-2 text-xs text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={stripIvaOnExempt}
                                                    onChange={(e) => setStripIvaOnExempt(e.target.checked)}
                                                    className="rounded border-slate-300 text-indigo-600"
                                                />
                                                <span>Descontar 13% de IVA del precio unitario al convertir a Exento</span>
                                            </label>
                                        )}
                                        {preview.options_applicable?.can_add_iva_from_exempt && (
                                            <label className="flex items-center gap-2 text-xs text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={addIvaFromExempt}
                                                    onChange={(e) => setAddIvaFromExempt(e.target.checked)}
                                                    className="rounded border-slate-300 text-indigo-600"
                                                />
                                                <span>Sumar 13% de IVA sobre el precio exento original</span>
                                            </label>
                                        )}

                                        <div className="overflow-x-auto bg-white rounded-xl border border-indigo-200">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-indigo-50 text-[10px] font-black uppercase text-indigo-900 border-b border-indigo-100">
                                                    <tr>
                                                        <th className="px-3 py-1.5">Concepto</th>
                                                        <th className="px-3 py-1.5 text-right">Original</th>
                                                        <th className="px-3 py-1.5 text-right">Con Estado Actual</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {fiscalDiffs.map((d) => (
                                                        <tr key={d.field}>
                                                            <td className="px-3 py-1.5 font-semibold text-slate-700">{d.label}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-500"><Money value={d.before} /></td>
                                                            <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-700 flex items-center justify-end gap-1">
                                                                <ArrowRight size={11} className="text-indigo-400" />
                                                                <Money value={d.after} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <Info size={13} className="text-slate-400 shrink-0" />
                                <span>Sin diferencias fiscales (IVA / Exento / Retención) respecto a la venta original. Los datos de identificación del receptor se toman del registro vigente.</span>
                            </p>
                        )}

                        {hasReceptorDiffsBlock(receptorDiffs)}
                    </div>
                )}

                {useCurrentCustomerState && warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                        {warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                <span>{w}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Fecha y hora */}
                {isAccepted ? (
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-800">Actualizar fecha y hora actual</p>
                                <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 rounded">Obligatorio MH</span>
                            </div>
                            <p className="text-[10px] text-slate-500">Se usará la fecha y hora actual del sistema en tiempo real para la nueva emisión legal.</p>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-lg">Activo</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                            <p className="text-xs font-bold text-slate-700">Actualizar fecha y hora</p>
                            <p className="text-[10px] text-slate-400">
                                {updateDateTime ? 'Se usará la fecha y hora actual (hoy difiere del DTE original)' : 'Se preservará la fecha y hora original del DTE'}
                            </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={updateDateTime} onChange={(e) => setUpdateDateTime(e.target.checked)} className="sr-only peer" />
                            <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                        </label>
                    </div>
                )}

                {/* Selector de Turno si ya está aceptado */}
                {isAccepted && (
                    <div className="space-y-2">
                        <label className="block text-[11px] font-black uppercase tracking-widest text-slate-600">
                            Turno de Caja para la Nueva Venta <span className="text-rose-500">*</span>
                        </label>
                        {loadingShifts ? (
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center text-xs text-slate-500">
                                Consultando turnos abiertos de la sucursal...
                            </div>
                        ) : openShifts.length > 0 ? (
                            <select
                                value={targetShiftId}
                                onChange={(e) => setTargetShiftId(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all cursor-pointer"
                            >
                                <option value="">-- Seleccione el turno destino --</option>
                                {openShifts.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        Turno #{s.shift_number || s.id} — {s.pos_name || 'POS'} — {s.seller_name || 'Cajero'} ({s.status === 'open' ? 'Abierto' : s.status})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                                    <span>No hay ningún turno abierto en esta sucursal</span>
                                </div>
                                <p className="text-[11px] text-rose-700">
                                    Para poder registrar esta nueva venta, <b>debe abrir un turno de caja</b> en <b>{sale?.branch_name || 'la sucursal actual'}</b>.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="w-full sm:w-auto px-6 py-2.5 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={submitting || loadingShifts || (isAccepted && (!targetShiftId || openShifts.length === 0))}
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        <RefreshCcw size={15} className={submitting ? 'animate-spin' : ''} />
                        <span>{isAccepted ? 'Crear Nueva Venta y Emitir DTE' : 'Confirmar Regeneración'}</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

function hasReceptorDiffsBlock(receptorDiffs) {
    if (!receptorDiffs || receptorDiffs.length === 0) return null;
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-2.5 space-y-1 text-[11px]">
            <p className="font-bold text-slate-700 uppercase text-[10px]">Datos de identificación actualizados del receptor:</p>
            {receptorDiffs.map((rd) => (
                <div key={rd.field} className="flex flex-wrap items-center gap-1 text-slate-600">
                    <strong className="text-slate-800">{rd.label}:</strong>
                    <span className="line-through text-slate-400">{rd.before}</span>
                    <ArrowRight size={11} className="text-indigo-500" />
                    <strong className="text-indigo-700">{rd.after}</strong>
                </div>
            ))}
        </div>
    );
}

export default RegenerateDteModal;
