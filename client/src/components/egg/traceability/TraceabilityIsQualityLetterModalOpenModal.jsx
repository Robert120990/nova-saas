import {
    Download,
    FileSpreadsheet,
    FileText,
    Truck,
    X,
    Loader2
} from 'lucide-react';


export default function TraceabilityIsQualityLetterModalOpenModal({ model, open = model.isQualityLetterModalOpen, onClose = () => model.setIsQualityLetterModalOpen(false) }) {
    const { isQualityLetterModalOpen, setIsQualityLetterModalOpen, qualityLetterBatch, letterCustomerName, setLetterCustomerName, letterCustomerContact, setLetterCustomerContact, letterScope, setLetterScope, exportingFormat, handleDownloadQualityLetter, downloadingOriginCert, handleDownloadOriginCertificate } = model;
    if (!open) return null;
    return (<>{isQualityLetterModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 bg-amber-50 text-amber-700 rounded-xl">
                                    <FileText size={18} />
                                </span>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        Carta de Calidad de Ovoproductos
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Formato Membretado Oficial Eggcelent / SIPEWEBgas
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Lot preview badge */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Lote Identificado</span>
                                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-bold">
                                        {qualityLetterBatch?.lot_code || `LOTE-${qualityLetterBatch?.batch_id}`}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-700">
                                    <span className="font-semibold text-slate-900">{qualityLetterBatch?.product_type || 'Huevo Entero Pasteurizado'}</span>
                                    <span className="text-slate-400 mx-1.5">•</span>
                                    <span>{qualityLetterBatch?.presentation || 'Presentación Estándar'}</span>
                                </div>
                            </div>

                            {/* Recipient Config */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                                        Destinatario / Cliente Receptor
                                    </label>
                                    <input
                                        type="text"
                                        value={letterCustomerName}
                                        onChange={(e) => setLetterCustomerName(e.target.value)}
                                        placeholder="Ej: A QUIEN CORRESPONDA o Nombre del Cliente"
                                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Por política de confidencialidad, la carta se genera por defecto dirigida a "A QUIEN CORRESPONDA" salvo requerimiento del cliente.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1">
                                        Atención a / Contacto / Departamento (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={letterCustomerContact}
                                        onChange={(e) => setLetterCustomerContact(e.target.value)}
                                        placeholder="Ej: Dpto. de Control de Calidad / Compras"
                                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Scope Selector (Completo, FQ, MB) */}
                            <div className="space-y-1.5 pt-1">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                                    Contenido / Ámbito del Análisis
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setLetterScope('all')}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${letterScope === 'all' ? 'bg-amber-500 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Completo (FQ + MB)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLetterScope('fq')}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${letterScope === 'fq' ? 'bg-slate-800 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Solo Físico-Químico (FQ)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLetterScope('mb')}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${letterScope === 'mb' ? 'bg-teal-700 text-white border-teal-800 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        Solo Microbiológico (MB)
                                    </button>
                                </div>
                            </div>

                            {/* Download Action Cards */}
                            <div className="space-y-2 pt-2">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Seleccione el formato de exportación:
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                    {/* PDF Button */}
                                    <button
                                        type="button"
                                        disabled={exportingFormat !== null}
                                        onClick={() => handleDownloadQualityLetter('pdf')}
                                        className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-2xl flex flex-col items-center text-center transition-all shadow-xs disabled:opacity-50"
                                    >
                                        {exportingFormat === 'pdf' ? (
                                            <Loader2 size={22} className="animate-spin text-rose-600 mb-1" />
                                        ) : (
                                            <FileText size={22} className="text-rose-600 mb-1" />
                                        )}
                                        <span className="text-xs font-bold">PDF Oficial</span>
                                        <span className="text-[10px] text-rose-600">Membretado</span>
                                    </button>

                                    {/* Word Button */}
                                    <button
                                        type="button"
                                        disabled={exportingFormat !== null}
                                        onClick={() => handleDownloadQualityLetter('word')}
                                        className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-2xl flex flex-col items-center text-center transition-all shadow-xs disabled:opacity-50"
                                    >
                                        {exportingFormat === 'word' ? (
                                            <Loader2 size={22} className="animate-spin text-blue-600 mb-1" />
                                        ) : (
                                            <FileText size={22} className="text-blue-600 mb-1" />
                                        )}
                                        <span className="text-xs font-bold">Word (.docx)</span>
                                        <span className="text-[10px] text-blue-600">Editable</span>
                                    </button>

                                    {/* Excel Button */}
                                    <button
                                        type="button"
                                        disabled={exportingFormat !== null}
                                        onClick={() => handleDownloadQualityLetter('excel')}
                                        className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-2xl flex flex-col items-center text-center transition-all shadow-xs disabled:opacity-50"
                                    >
                                        {exportingFormat === 'excel' ? (
                                            <Loader2 size={22} className="animate-spin text-emerald-600 mb-1" />
                                        ) : (
                                            <FileSpreadsheet size={22} className="text-emerald-600 mb-1" />
                                        )}
                                        <span className="text-xs font-bold">Excel (.xlsx)</span>
                                        <span className="text-[10px] text-emerald-600">Estructurado</span>
                                    </button>
                                </div>
                            </div>

                            {/* Respaldo de Origen del Proveedor (ANDELSA) */}
                            <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-900 uppercase flex items-center gap-1.5">
                                        <Truck size={13} className="text-amber-600" />
                                        Certificado de Calidad de Origen (Proveedor a ANDELSA)
                                    </span>
                                    <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 bg-amber-100/60 rounded-full">Anexo de Granja</span>
                                </div>
                                <p className="text-[11px] text-slate-600">
                                    Documento técnico emitido por la granja proveedora con condiciones de inocuidad, transporte y edades de aves que amparan este lote procesado.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        disabled={downloadingOriginCert}
                                        onClick={() => handleDownloadOriginCertificate(qualityLetterBatch?.batch_id, true, 'pdf')}
                                        className="flex-1 py-2 px-3 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                                    >
                                        <FileText size={13} className="text-rose-600" />
                                        Certificado Origen (PDF)
                                    </button>
                                    <button
                                        type="button"
                                        disabled={downloadingOriginCert}
                                        onClick={() => handleDownloadOriginCertificate(qualityLetterBatch?.batch_id, true, 'word')}
                                        className="flex-1 py-2 px-3 bg-white hover:bg-blue-100 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                                    >
                                        <Download size={13} className="text-blue-600" />
                                        Certificado Origen (Word)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsQualityLetterModalOpen(false)}
                                className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all shadow-xs"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
