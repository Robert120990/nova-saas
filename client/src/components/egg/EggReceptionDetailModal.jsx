import {
    Boxes,
    XCircle,
    Truck,
    FileText,
    ShieldCheck,
    Loader2,
    Printer,
    Award,
    Download,
    Pencil
} from 'lucide-react';

const EggReceptionDetailModal = ({
    isOpen,
    onClose,
    reception,
    user,
    formatDate,
    getStatusBadge,
    getStatusIcon,
    printingPdfId,
    handlePrintLab001,
    handleOpenQualityModal,
    handleOpenPrintTarima,
    handlePrintReceptionSummary,
    handleEdit
}) => {
    if (!isOpen || !reception) return null;

    let parsedTarimas = [];
    try {
        parsedTarimas = typeof reception.tarimas_json === 'string'
            ? JSON.parse(reception.tarimas_json || '[]')
            : (reception.tarimas_json || []);
    } catch (e) {
        parsedTarimas = [];
    }
    if (!Array.isArray(parsedTarimas) || parsedTarimas.length === 0) {
        parsedTarimas = [{
            tarima_number: 1,
            boxes_count: reception.total_boxes || 0,
            gross_weight_lbs: reception.weight_lbs || 0,
            tare_weight_lbs: 0,
            net_weight_lbs: reception.weight_lbs || 0
        }];
    }

    const recData = {
        reception_id: reception.id,
        provider_name: reception.provider_name,
        provider_lot: reception.provider_lot,
        fecha: reception.fecha || reception.created_at,
        egg_type: reception.egg_type,
        egg_color: reception.egg_color,
        egg_size: reception.egg_size,
        temperature_c: reception.temperature_c,
        truck_temperature_c: reception.truck_temperature_c,
        truck_plate: reception.truck_plate,
        driver_name: reception.driver_name,
        operator_name: reception.operator_name,
        company_name: user?.company_name || 'ANDELSA, S.A. DE C.V.'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-5 text-slate-900">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                            <Boxes className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                    Recepción #{reception.id} - Lote: {reception.provider_lot}
                                </h2>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 ${getStatusBadge ? getStatusBadge(reception.status) : ''}`}>
                                    {getStatusIcon && getStatusIcon(reception.status)}
                                    {reception.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Proveedor: <strong className="text-slate-700">{reception.provider_name}</strong> | Fecha: {formatDate ? formatDate(reception.fecha || reception.created_at) : (reception.fecha || reception.created_at)}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                {/* Cards de Resumen */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1">
                            <Boxes size={12} /> Datos de Producto
                        </span>
                        <div className="text-slate-700 space-y-0.5 pt-1">
                            <p><span className="text-slate-400 font-medium">Tipo:</span> <strong className="capitalize">{reception.egg_type}</strong></p>
                            {reception.egg_type === 'huevo cáscara' && (
                                <p><span className="text-slate-400 font-medium">Color / Talla:</span> <strong>{reception.egg_color} / {reception.egg_size}</strong></p>
                            )}
                            <p><span className="text-slate-400 font-medium">Temp. Huevo:</span> <strong>{reception.temperature_c ? `${reception.temperature_c}°C` : 'N/R'}</strong></p>
                            <p><span className="text-slate-400 font-medium">Inspector:</span> <strong>{reception.operator_name || 'N/A'}</strong></p>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                        <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wide flex items-center gap-1">
                            <Truck size={12} /> Transporte & Cadena de Frío
                        </span>
                        <div className="text-slate-700 space-y-0.5 pt-1">
                            <p><span className="text-slate-400 font-medium">Placa:</span> <strong>{reception.truck_plate || 'Sin transporte'}</strong></p>
                            <p><span className="text-slate-400 font-medium">Motorista:</span> <strong>{reception.driver_name || 'N/A'}</strong></p>
                            <p><span className="text-slate-400 font-medium">Termoking:</span> <strong>{reception.truck_temperature_c ? `${reception.truck_temperature_c}°C` : 'N/R'}</strong></p>
                            <p><span className="text-slate-400 font-medium">Ingreso:</span> <strong>{formatDate ? formatDate(reception.fecha || reception.created_at) : (reception.fecha || reception.created_at)}</strong></p>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                            <FileText size={12} /> Balance de Peso & Stock
                        </span>
                        <div className="text-slate-700 space-y-0.5 pt-1">
                            <p><span className="text-slate-400 font-medium">Total Cajas:</span> <strong className="text-indigo-700">{reception.total_boxes || 0} cjs</strong></p>
                            <p><span className="text-slate-400 font-medium">Peso Neto Inicial:</span> <strong className="text-slate-900">{parseFloat(reception.weight_lbs || 0).toLocaleString()} Lbs</strong></p>
                            <p><span className="text-slate-400 font-medium">Stock Remanente:</span> <strong className="text-emerald-700">{parseFloat(reception.stock_lbs || 0).toLocaleString()} Lbs</strong></p>
                            <p><span className="text-slate-400 font-medium">Tarimas Pesadas:</span> <strong>{parsedTarimas.length}</strong></p>
                        </div>
                    </div>
                </div>

                {/* Card de Calidad y Clasificación (LAB-004) */}
                <div className="bg-gradient-to-r from-amber-50/80 via-orange-50/60 to-amber-50/80 border border-amber-200/90 rounded-xl p-4 space-y-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-2xs">
                                <ShieldCheck size={16} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                                    Dictamen Técnico y Clasificación de Calidad (LAB-004)
                                </h4>
                                <p className="text-[11px] text-amber-800/80 font-medium">
                                    Evaluación realizada por el personal técnico de Control de Calidad
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <button
                                type="button"
                                disabled={printingPdfId === reception.id}
                                onClick={() => handlePrintLab001 && handlePrintLab001(reception.id, reception.provider_lot)}
                                className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                title="Imprimir Formato Oficial LAB 001 (Rev. 7.03.24)"
                            >
                                {printingPdfId === reception.id ? <Loader2 className="animate-spin" size={13} /> : <Printer size={13} />}
                                <span>Imprimir LAB 001</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleOpenQualityModal && handleOpenQualityModal(reception)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                            >
                                <ShieldCheck size={13} />
                                <span>{reception.quality_inspector_name ? 'Editar Dictamen LAB 001' : 'Evaluar Calidad (LAB 001)'}</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Inspector Calidad:</span>
                            <strong className="text-slate-900">{reception.quality_inspector_name || 'Pendiente de asignar'}</strong>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Clasificación / Grado:</span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-black text-indigo-700 bg-white border border-indigo-200 text-xs shadow-2xs mt-0.5">
                                <Award size={12} className="text-indigo-600" />
                                {reception.egg_classification || 'Grado A'} ({reception.egg_size || 'L'})
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Estado Dictamen:</span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight mt-0.5 ${
                                reception.quality_status === 'aprobado'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : reception.quality_status === 'rechazado'
                                    ? 'bg-rose-100 text-rose-800'
                                    : reception.quality_status === 'condicional'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-amber-100 text-amber-800'
                            }`}>
                                {reception.quality_status || 'Pendiente'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Muestreo Defectos:</span>
                            <div className="text-slate-700 font-semibold text-[11px] mt-0.5">
                                <span>Rotos: <strong className="text-rose-700">{reception.quality_defect_broken_pct || 0}%</strong></span>
                                <span className="mx-1.5">•</span>
                                <span>Sucios: <strong className="text-amber-700">{reception.quality_defect_dirty_pct || 0}%</strong></span>
                                {reception.quality_brix && (
                                    <>
                                        <span className="mx-1.5">•</span>
                                        <span>Brix: <strong className="text-indigo-700">{reception.quality_brix}°Bx</strong></span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {reception.quality_notes && (
                        <div className="text-xs bg-white/90 p-2.5 rounded-xl border border-amber-200 text-slate-800">
                            <span className="font-bold text-amber-900 block text-[10px] uppercase tracking-wide">Observaciones Técnicas:</span>
                            <p className="mt-0.5 text-slate-700 font-medium">{reception.quality_notes}</p>
                        </div>
                    )}
                </div>

                {/* Tabla de Tarimas */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Boxes size={14} className="text-indigo-600" />
                            Tarimas Registradas en Báscula ({parsedTarimas.length})
                        </h3>
                        <button
                            type="button"
                            onClick={() => handleOpenPrintTarima && handleOpenPrintTarima(parsedTarimas[0], parsedTarimas, recData)}
                            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl text-xs font-bold border border-sky-200 transition-colors flex items-center gap-1.5 shadow-xs"
                        >
                            <Printer size={13} />
                            Imprimir Todas las Tarimas
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                                <tr>
                                    <th className="p-2.5 text-center w-12">#</th>
                                    <th className="p-2.5">Código QR / Identificador</th>
                                    <th className="p-2.5 text-right">Cajas</th>
                                    <th className="p-2.5 text-right">Peso Bruto</th>
                                    <th className="p-2.5 text-right">Tara</th>
                                    <th className="p-2.5 text-right">Peso Neto</th>
                                    <th className="p-2.5 text-center w-36">Impresión</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                {parsedTarimas.map((t, idx) => {
                                    const tNum = t.tarima_number || (idx + 1);
                                    const code = `TAR-${(reception.provider_lot || 'LOT').toUpperCase()}-${String(tNum).padStart(2, '0')}`;
                                    return (
                                        <tr key={t.id || idx} className="hover:bg-slate-50">
                                            <td className="p-2.5 text-center font-bold text-slate-500">{tNum}</td>
                                            <td className="p-2.5">
                                                <span className="font-mono text-xs font-bold bg-slate-100 text-indigo-700 px-2 py-0.5 rounded border border-slate-200">
                                                    {code}
                                                </span>
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-slate-700">{t.boxes_count || 0} cjs</td>
                                            <td className="p-2.5 text-right text-slate-600">{parseFloat(t.gross_weight_lbs || 0).toLocaleString()} lb</td>
                                            <td className="p-2.5 text-right text-slate-400">{parseFloat(t.tare_weight_lbs || 0).toLocaleString()} lb</td>
                                            <td className="p-2.5 text-right font-black text-emerald-700">
                                                {parseFloat(t.net_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lb
                                            </td>
                                            <td className="p-2.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenPrintTarima && handleOpenPrintTarima(t, parsedTarimas, recData)}
                                                    className="px-2.5 py-1 bg-white hover:bg-sky-50 text-sky-700 rounded-lg border border-slate-200 hover:border-sky-300 text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition-colors shadow-xs"
                                                >
                                                    <Printer size={12} />
                                                    Imprimir Tarima #{tNum}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={() => handlePrintReceptionSummary && handlePrintReceptionSummary(reception)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 flex items-center justify-center gap-2 transition-colors shadow-xs"
                    >
                        <Download size={15} />
                        Imprimir Resumen de Recepción (PDF LOG-004)
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-xs"
                        >
                            Cerrar
                        </button>
                        {reception.status !== 'anulado' && (
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    handleEdit && handleEdit(reception);
                                }}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                            >
                                <Pencil size={14} />
                                Editar Recepción Completa
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EggReceptionDetailModal;
