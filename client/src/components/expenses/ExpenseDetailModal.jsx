import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { formatDate } from '../../utils/dateUtils';

const DEFAULT_F07_OPERACION = [
    { code: '1', label: '1 - GRAVADA' },
    { code: '2', label: '2 - NO GRAVADA O EXENTA' },
    { code: '3', label: '3 - EXCLUIDO' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

const DEFAULT_F07_CLASIFICACION = [
    { code: '1', label: '1 - COSTO' },
    { code: '2', label: '2 - GASTO' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

const DEFAULT_F07_SECTOR = [
    { code: '1', label: '1 - INDUSTRIA' },
    { code: '2', label: '2 - COMERCIO' },
    { code: '3', label: '3 - AGROPECUARIA' },
    { code: '4', label: '4 - SERVICIOS, PROFESIONES' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

const DEFAULT_F07_COSTO = [
    { code: '1', label: '1 - GASTO DE VENTA SIN DONACION' },
    { code: '2', label: '2 - GASTO DE ADMINISTRACION SIN DONACION' },
    { code: '3', label: '3 - GASTOS FINANCIEROS SIN DONACION' },
    { code: '4', label: '4 - COSTO ARTICULOS PRODUCIDOS IMPORTACIONES' },
    { code: '5', label: '5 - COSTO ARTICULOS PRODUCIDOS INTERNOS' },
    { code: '6', label: '6 - COSTOS INDIRECTOS DE FABRICACION' },
    { code: '7', label: '7 - MANO DE OBRA' },
    { code: '9', label: '9 - EXCEPCIONES' },
    { code: '0', label: '0 - ANTES FEB 2024' }
];

export default function ExpenseDetailModal({
    isOpen,
    onClose,
    expense,
    f07Operacion = DEFAULT_F07_OPERACION,
    f07Clasificacion = DEFAULT_F07_CLASIFICACION,
    f07Sector = DEFAULT_F07_SECTOR,
    f07Costo = DEFAULT_F07_COSTO
}) {
    if (!isOpen || !expense) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Detalle de Gasto: ${expense.numero_documento || ''}`}
            maxWidth="max-w-3xl"
        >
            <div className="space-y-4 text-slate-800">
                {/* Cabecera del Documento */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Fecha</span>
                        <span className="text-xs font-black text-slate-800">{formatDate(expense.fecha)}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tipo Documento</span>
                        <span className="text-xs font-black text-slate-800">{expense.tipo_documento_id} - {expense.tipo_documento_nombre || 'Gasto'}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">No. Documento</span>
                        <span className="text-xs font-black text-slate-800">{expense.numero_documento}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estado</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            expense.status === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                            {expense.status}
                        </span>
                    </div>
                    <div className="sm:col-span-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Proveedor</span>
                        <span className="text-xs font-bold text-slate-900">{expense.provider_nombre}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                            NRC: {expense.provider_nrc || 'N/A'} · NIT: {expense.provider_nit || 'N/A'}
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sucursal / Usuario</span>
                        <span className="text-xs font-medium text-slate-700">
                            {expense.branch_nombre || '---'} {expense.usuario_nombre && `(${expense.usuario_nombre})`}
                        </span>
                    </div>
                    {expense.num_control && (
                        <div className="sm:col-span-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Número de Control (DTE)</span>
                            <span className="text-xs font-mono text-slate-700">{expense.num_control}</span>
                        </div>
                    )}
                    {expense.sello_recepcion && (
                        <div className="sm:col-span-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sello Recepción (MH)</span>
                            <span className="text-xs font-mono text-slate-700 truncate block">{expense.sello_recepcion}</span>
                        </div>
                    )}
                    {expense.documento_afectado && (
                        <div className="sm:col-span-4 p-2.5 bg-rose-50 rounded-xl border border-rose-200">
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest block">Documento Afectado</span>
                            <span className="text-xs font-bold text-rose-900">{expense.documento_afectado} ({formatDate(expense.fecha_afectada)})</span>
                        </div>
                    )}
                </div>

                {/* Clasificación F-07 MH */}
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Operación</span>
                        <span className="font-bold text-slate-800">
                            {f07Operacion.find(o => o.code === expense.tipo_operacion)?.label || expense.tipo_operacion}
                        </span>
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Clasificación</span>
                        <span className="font-bold text-slate-800">
                            {f07Clasificacion.find(c => c.code === expense.tipo_clasificacion)?.label || expense.tipo_clasificacion}
                        </span>
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Sector</span>
                        <span className="font-bold text-slate-800">
                            {f07Sector.find(s => s.code === expense.tipo_sector)?.label || expense.tipo_sector}
                        </span>
                    </div>
                    <div>
                        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Tipo Costo</span>
                        <span className="font-bold text-slate-800 truncate block" title={expense.tipo_costo}>
                            {f07Costo.find(c => c.code === expense.tipo_costo)?.label || expense.tipo_costo}
                        </span>
                    </div>
                </div>

                {/* Observaciones */}
                {expense.observaciones && (
                    <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Concepto General / Observaciones</span>
                        <p className="font-medium text-slate-800">{expense.observaciones}</p>
                    </div>
                )}

                {/* Liquidación de Totales y Desglose Fiscal */}
                <div>
                    <h4 className="text-xs font-black uppercase text-slate-500 mb-2">Desglose de Liquidación Fiscal</h4>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Compras Gravadas</span>
                            <span className="text-xs font-mono font-bold text-slate-800"><Money value={expense.total_gravada} /></span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Gastos Exentos</span>
                            <span className="text-xs font-mono text-slate-700"><Money value={expense.total_exenta} /></span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">No Sujetas</span>
                            <span className="text-xs font-mono text-slate-700"><Money value={expense.total_nosujeta} /></span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">IVA Crédito Fiscal (13%)</span>
                            <span className="text-xs font-mono font-bold text-emerald-600"><Money value={expense.iva} /></span>
                        </div>
                        {parseFloat(expense.gravadas_importaciones || 0) > 0 && (
                            <div>
                                <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">Grav. Importaciones</span>
                                <span className="text-xs font-mono font-bold text-slate-800"><Money value={expense.gravadas_importaciones} /></span>
                            </div>
                        )}
                        {parseFloat(expense.iva_importaciones || 0) > 0 && (
                            <div>
                                <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">IVA Importaciones</span>
                                <span className="text-xs font-mono font-bold text-purple-700"><Money value={expense.iva_importaciones} /></span>
                            </div>
                        )}
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Retención 1%</span>
                            <span className="text-xs font-mono text-rose-600 font-semibold"><Money value={expense.retencion} /></span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Percepción 1%</span>
                            <span className="text-xs font-mono text-amber-600 font-semibold"><Money value={expense.percepcion} /></span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">FOVIAL / COTRANS</span>
                            <span className="text-xs font-mono text-slate-700">
                                <Money value={parseFloat(expense.fovial || 0) + parseFloat(expense.cotrans || 0)} />
                            </span>
                        </div>
                        {parseFloat(expense.anticipo_cuenta || 0) > 0 && (
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Anticipo a Cuenta</span>
                                <span className="text-xs font-mono text-blue-600 font-bold">
                                    <Money value={expense.anticipo_cuenta} />
                                </span>
                            </div>
                        )}
                        {parseFloat(expense.monto_sujeto || 0) > 0 && (
                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Monto Sujeto</span>
                                <span className="text-xs font-mono text-indigo-600 font-bold">
                                    <Money value={expense.monto_sujeto} />
                                </span>
                            </div>
                        )}
                        <div className="sm:col-span-2 p-3 bg-white rounded-xl border border-slate-200">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Liquidado del Gasto</span>
                            <span className="text-lg font-mono font-black text-slate-900"><Money value={expense.monto_total} /></span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
}
