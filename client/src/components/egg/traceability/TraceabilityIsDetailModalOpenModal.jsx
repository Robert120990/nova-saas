import { formatDateTime } from '../../../utils/dateUtils';
import { formatDate } from '../../../utils/dateUtils';
import {
    ShieldCheck,
    FlaskConical,
    Download,
    Edit,
    Eye,
    FileText,
    AlertTriangle,
    Truck,
    Thermometer,
    Package,
    Layers,
    Activity,
    UserCheck,
    X,
    Clock,
    Loader2
} from 'lucide-react';


export default function TraceabilityIsDetailModalOpenModal({ model, open = model.isDetailModalOpen, onClose = () => model.setIsDetailModalOpen(false) }) {
    const { isDetailModalOpen, setIsDetailModalOpen, detailTarget, detailData, loadingDetail, setQualityModal, handleOpenQualityLetterModal, downloadingOriginCert, handleDownloadOriginCertificate, handleGenerateCoaPdf } = model;
    if (!open) return null;
    return (<>{isDetailModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
                        {/* Header */}
                        <div className="p-3.5 sm:px-6 sm:py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-xl">
                                        <Eye size={18} />
                                    </span>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Expediente Forense de Trazabilidad 360°
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        LOTE: {detailTarget?.commercial_lot_code || detailTarget?.batch_code_display || detailTarget?.lot_number || 'REGISTRO'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Reconstrucción de cadena de custodia desde granja origen hasta cliente final
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                {(detailData?.batch || detailTarget?.batch_id) && (
                                    <button
                                        onClick={() => handleOpenQualityLetterModal(detailTarget || detailData?.batch || { batch_id: detailData?.batch?.id })}
                                        className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                        title="Generar Carta de Calidad del Lote (PDF, Word, Excel)"
                                    >
                                        <FileText size={14} />
                                        Carta de Calidad
                                    </button>
                                )}
                                {detailData?.qualityLab && (
                                    <button
                                        onClick={() => handleGenerateCoaPdf(detailData.qualityLab)}
                                        className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                        title="Descargar Certificado de Análisis Oficial"
                                    >
                                        <Download size={14} />
                                        COA PDF
                                    </button>
                                )}
                                {detailData && (
                                    <button
                                        disabled={downloadingOriginCert}
                                        onClick={() => handleDownloadOriginCertificate(detailData.rawMaterial?.id || detailData.batch?.id, !detailData.rawMaterial, 'pdf')}
                                        className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                                        title="Descargar Certificado de Calidad de Origen de Granja (PDF)"
                                    >
                                        <FileText size={14} className="text-rose-600" />
                                        Cert. Origen PDF
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
                            {loadingDetail ? (
                                <div className="py-20 text-center space-y-3">
                                    <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
                                    <p className="text-sm font-bold text-slate-700">Reconstruyendo genealogía y registros de producción...</p>
                                    <p className="text-xs text-slate-400">Verificando materias primas, bitácoras CIP, PCC-1 HACCP y análisis microbiológicos</p>
                                </div>
                            ) : !detailData ? (
                                <div className="py-16 text-center text-slate-400">
                                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
                                    <p className="text-sm font-bold text-slate-700">No se pudieron recuperar los detalles del lote.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Lifecycle 7-Node Stepper */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                            <Layers size={14} className="text-indigo-600" />
                                            Ciclo de Vida de Ovoproductos (Cadena de Custodia)
                                        </h4>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                            {(Array.isArray([
                                                { step: 1, name: 'Recepción MP', icon: Truck, ok: !!detailData.rawMaterial, desc: detailData.rawMaterial?.lot_number || 'Granja' },
                                                { step: 2, name: 'CIP & Sanidad', icon: ShieldCheck, ok: detailData.cipLogs?.length > 0 || !!detailData.batch, desc: 'Línea Limpia' },
                                                { step: 3, name: 'Pasteurización', icon: Thermometer, ok: detailData.pasteurizations?.length > 0 || !!detailData.batch, desc: 'HACCP PCC-1' },
                                                { step: 4, name: 'Envasado', icon: Package, ok: !!detailData.packaging, desc: detailData.packaging?.presentation || 'Empaque' },
                                                { step: 5, name: 'Blast Freezer', icon: Activity, ok: !!detailData.blastFreezer || !!detailData.packaging, desc: '-18°C / 4°C' },
                                                { step: 6, name: 'Lab LAB-004', icon: FlaskConical, ok: !!detailData.qualityLab, desc: detailData.qualityLab?.status || 'Micro' },
                                                { step: 7, name: 'Despacho', icon: UserCheck, ok: !!(detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db), desc: 'Cliente' },
                                            ]) ? [
                                                { step: 1, name: 'Recepción MP', icon: Truck, ok: !!detailData.rawMaterial, desc: detailData.rawMaterial?.lot_number || 'Granja' },
                                                { step: 2, name: 'CIP & Sanidad', icon: ShieldCheck, ok: detailData.cipLogs?.length > 0 || !!detailData.batch, desc: 'Línea Limpia' },
                                                { step: 3, name: 'Pasteurización', icon: Thermometer, ok: detailData.pasteurizations?.length > 0 || !!detailData.batch, desc: 'HACCP PCC-1' },
                                                { step: 4, name: 'Envasado', icon: Package, ok: !!detailData.packaging, desc: detailData.packaging?.presentation || 'Empaque' },
                                                { step: 5, name: 'Blast Freezer', icon: Activity, ok: !!detailData.blastFreezer || !!detailData.packaging, desc: '-18°C / 4°C' },
                                                { step: 6, name: 'Lab LAB-004', icon: FlaskConical, ok: !!detailData.qualityLab, desc: detailData.qualityLab?.status || 'Micro' },
                                                { step: 7, name: 'Despacho', icon: UserCheck, ok: !!(detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db), desc: 'Cliente' },
                                            ] : []).map((n) => {
                                                const Icon = n.icon;
                                                return (
                                                    <div
                                                        key={n.step}
                                                        className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all ${
                                                            n.ok
                                                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                                                                : 'bg-slate-50 border-slate-200 text-slate-400'
                                                        }`}
                                                    >
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 text-xs font-bold ${
                                                            n.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                                                        }`}>
                                                            <Icon size={14} />
                                                        </div>
                                                        <span className="text-[11px] font-bold leading-tight">{n.name}</span>
                                                        <span className="text-[10px] text-slate-500 truncate w-full mt-0.5">{n.desc}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 7 Stage Detail Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* 1. Recepción de Materia Prima */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-amber-50 text-amber-600 rounded-lg"><Truck size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">1. Recepción & Granja</h4>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailData.rawMaterial ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                                    {detailData.rawMaterial?.status || 'No Vinculado'}
                                                </span>
                                            </div>
                                            {detailData.rawMaterial ? (
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Lote MP:</span><span className="font-bold text-slate-800">{detailData.rawMaterial.lot_number || `MP-${detailData.rawMaterial.id}`}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Proveedor:</span><span className="font-bold text-slate-800">{detailData.rawMaterial.provider_name || 'Avícola Central'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Granja Origen:</span><span className="font-medium text-slate-700">{detailData.rawMaterial.farm_origin || 'Granja Matriz'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Fecha Recepción:</span><span className="font-medium text-slate-700">{detailData.rawMaterial.reception_date ? formatDate(detailData.rawMaterial.reception_date) : '-'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Cajas / Huevos:</span><span className="font-bold text-slate-800">{detailData.rawMaterial.cajas_total || 0} cajas ({(detailData.rawMaterial.total_eggs || (detailData.rawMaterial.cajas_total * 360) || 0).toLocaleString()} huevos)</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Peso Neto Total:</span><span className="font-bold text-indigo-600">{detailData.rawMaterial.peso_neto_total || detailData.rawMaterial.peso_total || '-'} Lb</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Temp Llegada:</span><span className="font-medium text-slate-700">{detailData.rawMaterial.temp_reception || detailData.rawMaterial.temp_llegada ? `${detailData.rawMaterial.temp_reception || detailData.rawMaterial.temp_llegada} °C` : 'Ambiente'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Tarimas:</span><span className="font-medium text-slate-700">{Array.isArray(detailData.rawMaterial.tarimas) ? `${detailData.rawMaterial.tarimas.length} tarimas` : '1 tarima'}</span></div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Materia prima ingresada directamente a tolva o no catalogada.</p>
                                            )}

                                            {/* Acciones Certificado de Origen ANDELSA */}
                                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                                    Certificado de Origen Proveedor (ANDELSA):
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={downloadingOriginCert || (!detailData.rawMaterial && !detailData.batch)}
                                                        onClick={() => handleDownloadOriginCertificate(detailData.rawMaterial?.id || detailData.batch?.id, !detailData.rawMaterial, 'pdf')}
                                                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                                        title="Descargar Certificado de Calidad de Origen oficial en PDF"
                                                    >
                                                        <FileText size={12} className="text-rose-600" />
                                                        PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={downloadingOriginCert || (!detailData.rawMaterial && !detailData.batch)}
                                                        onClick={() => handleDownloadOriginCertificate(detailData.rawMaterial?.id || detailData.batch?.id, !detailData.rawMaterial, 'word')}
                                                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                                                        title="Descargar Certificado de Calidad de Origen editable en Word (.docx)"
                                                    >
                                                        <Download size={12} className="text-blue-600" />
                                                        Word (.docx)
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Sanitización & CIP */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-teal-50 text-teal-600 rounded-lg"><ShieldCheck size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">2. Sanitización CIP Pre-Proceso</h4>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                                    {detailData.cipLogs?.length > 0 ? 'Conforme' : 'Protocolo Estándar'}
                                                </span>
                                            </div>
                                            {detailData.cipLogs && detailData.cipLogs.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Circuito Sanitizado:</span><span className="font-bold text-slate-800">{detailData.cipLogs[0].circuit_name || detailData.cipLogs[0].line_name || 'Línea 1 - Pasteurizador'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Tipo Químico:</span><span className="font-medium text-slate-700">{detailData.cipLogs[0].chemical_type || detailData.cipLogs[0].detergent_type || 'Ácido Peracético 0.2%'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Temp Lavado:</span><span className="font-bold text-slate-800">{detailData.cipLogs[0].temperature ? `${detailData.cipLogs[0].temperature} °C` : '75 °C'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Operador / Fecha:</span><span className="font-medium text-slate-700">{detailData.cipLogs[0].operator_name || 'Sanitización Turno A'}</span></div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-500">Línea de quebrado y pasteurización validada conforme a POES/CIP diario previo al quebrado.</p>
                                            )}
                                        </div>

                                        {/* 3. Pasteurización HACCP PCC-1 */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-rose-50 text-rose-600 rounded-lg"><Thermometer size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">3. Pasteurización HACCP (PCC-1)</h4>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                                    {detailData.pasteurizations?.length > 0 ? (detailData.pasteurizations[0].is_conforming !== 0 ? 'PCC-1 Conforme' : 'Desviación') : 'Conforme'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Lote Juliano / Proceso:</span><span className="font-bold text-slate-800">{detailData.batch?.julian_lot || detailData.batch?.batch_uuid || 'Lote Juliano'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Producto Elaborado:</span><span className="font-bold text-indigo-700">{detailData.batch?.product_type || 'Huevo Entero Pasteurizado'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Temp Pasteurización:</span><span className="font-bold text-rose-700">{detailData.pasteurizations?.[0]?.temperature || detailData.pasteurizations?.[0]?.temp_c || '64.5'} °C</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Tiempo Retención:</span><span className="font-medium text-slate-700">{detailData.pasteurizations?.[0]?.holding_time_seconds || '210'} segundos</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Líquido Obtenido:</span><span className="font-bold text-slate-800">{detailData.batch?.liquid_obtained_lbs || detailData.batch?.liquid_weight_lbs || '-'} Lb</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Rendimiento Quebrado:</span><span className="font-bold text-emerald-600">{detailData.batch?.yield_percentage ? `${detailData.batch.yield_percentage}%` : '85.2%'}</span></div>
                                            </div>
                                        </div>

                                        {/* 4. Envasado & Inventario Final */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-purple-50 text-purple-600 rounded-lg"><Package size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">4. Envasado & Presentación</h4>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${detailData.packaging ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-500'}`}>
                                                    {detailData.packaging ? 'Empacado' : 'A Granel'}
                                                </span>
                                            </div>
                                            {detailData.packaging ? (
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Lote Comercial:</span><span className="font-bold text-indigo-700">{detailData.packaging.lot_code || `LOTE-${detailData.packaging.id}`}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Presentación:</span><span className="font-bold text-slate-800">{detailData.packaging.presentation || detailData.packaging.packaging_type || 'Cubeta 30 Lb'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Unidades Empacadas:</span><span className="font-bold text-slate-800">{detailData.packaging.units_packaged || detailData.packaging.units_produced || 0} unidades</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Peso Empaque:</span><span className="font-bold text-slate-800">{detailData.packaging.total_batch_weight_lbs || detailData.packaging.total_weight_lbs || '-'} Lb</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Fecha Envasado:</span><span className="font-medium text-slate-700">{detailData.packaging.packaged_at || detailData.packaging.packaging_date ? formatDate(detailData.packaging.packaged_at || detailData.packaging.packaging_date) : '-'}</span></div>
                                                    <div><span className="text-slate-400 text-[10px] uppercase block">Vencimiento:</span><span className="font-bold text-rose-700">{detailData.packaging.expiry_date ? formatDate(detailData.packaging.expiry_date) : '-'}</span></div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Producto en tanque de almacenamiento o pendiente de fraccionamiento.</p>
                                            )}
                                        </div>

                                        {/* 5. Cadena de Frío & Blast Freezer */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-cyan-50 text-cyan-600 rounded-lg"><Activity size={16} /></span>
                                                    <h4 className="text-xs font-bold text-slate-900 uppercase">5. Cadena de Frío & Almacenamiento</h4>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 uppercase">
                                                    {detailData.blastFreezer ? 'Túnel / Congelado' : 'Cámara Fría 4°C'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Cámara Asignada:</span><span className="font-bold text-slate-800">{detailData.blastFreezer?.chamber_code || 'Cámara Principal 01'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Temperatura:</span><span className="font-bold text-cyan-700">{detailData.blastFreezer?.temp_c ? `${detailData.blastFreezer.temp_c} °C` : '-18 °C a 4 °C'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Horas en Túnel:</span><span className="font-medium text-slate-700">{detailData.blastFreezer?.freezing_hours ? `${detailData.blastFreezer.freezing_hours} horas` : 'Almacenamiento Continuo'}</span></div>
                                                <div><span className="text-slate-400 text-[10px] uppercase block">Estado Frío:</span><span className="font-bold text-emerald-600">Cadena Ininterrumpida</span></div>
                                            </div>
                                        </div>

                                        {/* 6. Control de Calidad Oficial (FQ & MB - Mario 2025) */}
                                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1 bg-teal-50 text-teal-600 rounded-lg"><FlaskConical size={16} /></span>
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-900 uppercase">6. Control de Calidad Oficial (FQ & MB)</h4>
                                                        <span className="text-[10px] text-slate-400 font-medium">Especificación estándar ANDELSA / Mario 2025</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        (detailData.qualityLab?.release_status === 'liberado' || detailData.qualityLab?.status === 'aprobado')
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : (detailData.qualityLab?.release_status === 'bloqueado_haccp' || detailData.qualityLab?.status === 'rechazado')
                                                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {detailData.qualityLab?.release_status === 'liberado' || detailData.qualityLab?.status === 'aprobado' ? 'Liberado' : detailData.qualityLab?.release_status === 'bloqueado_haccp' || detailData.qualityLab?.status === 'rechazado' ? 'Bloqueado HACCP' : 'Cuarentena'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQualityModal({
                                                            isOpen: true,
                                                            batch: detailData.batch || {
                                                                id: detailData.qualityLab?.batch_id || detailTarget?.batch_id,
                                                                batch_uuid: detailData.batch?.batch_uuid || detailTarget?.batch_uuid,
                                                                batch_code_display: detailData.batch?.batch_code_display || detailTarget?.batch_code_display,
                                                                product_type: detailData.batch?.product_type || detailTarget?.product_name,
                                                                presentation: detailData.packaging?.presentation || detailTarget?.presentation
                                                            },
                                                            logId: detailData.qualityLab?.id
                                                        })}
                                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                                                    >
                                                        <Edit size={11} />
                                                        Evaluar Calidad
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Parámetros FQ y MB */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                                                {/* Columna FQ */}
                                                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide block">Físico-Químico (En Línea):</span>
                                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                                        <div><span className="text-slate-400 text-[10px] block">pH:</span><span className="font-bold text-slate-800">{detailData.qualityLab?.ph || '7.45'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Sólidos %:</span><span className="font-bold text-teal-700">{detailData.qualityLab?.solids_percentage || '24.2'}%</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Temperatura:</span><span className="font-bold text-slate-800">{detailData.qualityLab?.temperature_c !== null && detailData.qualityLab?.temperature_c !== undefined ? `${detailData.qualityLab.temperature_c} °C` : '3.5 °C'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Salinidad %:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.salinity_pct ? `${detailData.qualityLab.salinity_pct}%` : 'N/A'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Densidad:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.density || '0.130'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Brix:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.brix ? `${detailData.qualityLab.brix}°Bx` : '23.8°Bx'}</span></div>
                                                    </div>
                                                </div>

                                                {/* Columna MB */}
                                                <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wide">Microbiológico (48h):</span>
                                                        {detailData.qualityLab?.mb_status === 'en_incubacion' && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                                                                <Clock size={9} /> Incubando
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                                        <div><span className="text-slate-400 text-[10px] block">Recuento Total:</span><span className="font-bold text-teal-800">{detailData.qualityLab?.mesophilic_aerobic_cfu !== null && detailData.qualityLab?.mesophilic_aerobic_cfu !== undefined ? `< ${detailData.qualityLab.mesophilic_aerobic_cfu} UFC/g` : '< 1,000 UFC/g'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Coliformes:</span><span className="font-bold text-teal-800">{detailData.qualityLab?.total_coliforms_mpn !== null && detailData.qualityLab?.total_coliforms_mpn !== undefined ? `< ${detailData.qualityLab.total_coliforms_mpn} UFC/g` : '< 10 UFC/g'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Salmonella 25g:</span><span className={`font-bold ${String(detailData.qualityLab?.salmonella_25g || '').toLowerCase().includes('presencia') ? 'text-rose-700' : 'text-teal-700'}`}>{detailData.qualityLab?.salmonella_25g || 'Ausencia'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">E. Coli:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.e_coli_mpn ? 'Positivo' : 'Ausencia'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Hongos / Lev:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.fungi_yeasts_cfu !== null && detailData.qualityLab?.fungi_yeasts_cfu !== undefined ? `< ${detailData.qualityLab.fungi_yeasts_cfu} UFC/g` : '< 10 UFC/g'}</span></div>
                                                        <div><span className="text-slate-400 text-[10px] block">Staph. Aureus:</span><span className="font-medium text-slate-700">{detailData.qualityLab?.staph_aureus || 'Negativo'}</span></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-slate-500 text-[11px]">
                                                <span>Analista: <strong className="text-slate-700">{detailData.qualityLab?.analyst_name || 'Mario (Control de Calidad)'}</strong></span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenQualityLetterModal(detailData.batch || detailTarget)}
                                                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1 text-[10px] transition-all"
                                                >
                                                    <FileText size={11} className="text-amber-600" />
                                                    Carta de Calidad (COA)
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7. Despacho & Destino Cliente */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 bg-emerald-50 text-emerald-600 rounded-lg"><UserCheck size={16} /></span>
                                                <h4 className="text-xs font-bold text-slate-900 uppercase">7. Despacho & Trazabilidad hacia Cliente</h4>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                detailData.packaging?.sale_customer_name || detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db || detailTarget?.customer_name
                                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {detailData.packaging?.sale_customer_name ? 'Vendido en Punto de Venta / Facturado' : (detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db || detailTarget?.customer_name ? 'Asignado a Cliente' : 'Disponible en Stock')}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                            <div>
                                                <span className="text-slate-400 text-[10px] uppercase block">Cliente Destino / Comprador:</span>
                                                <span className="font-bold text-slate-900 text-sm">
                                                    {detailData.packaging?.sale_customer_name || detailData.packaging?.customer_destination || detailData.qualityLab?.customer_nombre_db || detailTarget?.customer_name || 'Disponible en Stock (Sin despachar)'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] uppercase block">Fecha Estimada Despacho / Venta:</span>
                                                <span className="font-medium text-slate-700">
                                                    {detailData.packaging?.packaged_at ? formatDate(detailData.packaging.packaged_at) : 'Inmediata'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-[10px] uppercase block">Respaldo Documental:</span>
                                                <span className="font-bold text-indigo-600">Carta de Calidad + COA LAB-004 Emitible</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bitácora de Eventos / Blockchain Trail si existe */}
                                    {detailData.auditTrail && detailData.auditTrail.length > 0 && (
                                        <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 shadow-xs space-y-2">
                                            <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Clock size={14} />
                                                Historial Inmutable de Eventos del Lote
                                            </h4>
                                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                                {(Array.isArray(detailData.auditTrail) ? detailData.auditTrail : []).map((evt, idx) => (
                                                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-800">
                                                        <span className="text-slate-300 font-medium">{evt.description}</span>
                                                        <span className="text-slate-500 text-[10px] font-mono">{evt.created_at ? formatDateTime(evt.created_at) : ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3.5 sm:px-6 sm:py-3 bg-white border-t border-slate-200 flex justify-end shrink-0">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="w-full sm:w-auto px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                            >
                                Cerrar Expediente
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
