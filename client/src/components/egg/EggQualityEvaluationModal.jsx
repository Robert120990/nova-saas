import {
    ShieldCheck,
    Loader2,
    FileText,
    Printer,
    XCircle,
    ClipboardList,
    FlaskConical,
    Truck,
    Award,
    Lock,
    Check,
    Plus,
    Trash2
} from 'lucide-react';

const EggQualityEvaluationModal = ({
    isOpen,
    onClose,
    qualityModal,
    setQualityModal,
    canEditQuality,
    formatDate,
    getQualityBadgeClass,
    handleSaveQualityClassification,
    handlePrintOriginCertFromModal,
    handleDownloadOriginCertDocxFromModal,
    handlePrintLab001FromModal,
    handleDownloadLab001DocxFromModal,
    printingPdfId
}) => {
    if (!isOpen) return null;

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else if (setQualityModal) {
            setQualityModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-4xl w-full mx-auto max-h-[92vh] flex flex-col text-slate-900 overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-black text-slate-900 tracking-tight">
                                            Laboratorio de Control de Calidad • Reporte de Materia Prima
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                            LAB 001 • Rev. 7.03.24
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Complemento técnico oficial de recepción, muestreo y dictamen de lote
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handlePrintOriginCertFromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Imprimir Certificado de Calidad de Origen (Proveedor a ANDELSA) en PDF"
                                >
                                    {printingPdfId === qualityModal.rm?.id ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} className="text-teal-700" />}
                                    <span className="hidden sm:inline">Cert. Origen (PDF)</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handleDownloadOriginCertDocxFromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-teal-50 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Descargar Certificado de Calidad de Origen en formato Word (.docx)"
                                >
                                    <FileText size={14} className="text-teal-600" />
                                    <span className="hidden sm:inline">Origen (Word)</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handlePrintLab001FromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Imprimir formato físico oficial LAB 001 en PDF"
                                >
                                    {printingPdfId === qualityModal.rm?.id ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} className="text-amber-700" />}
                                    <span className="hidden sm:inline">{printingPdfId === qualityModal.rm?.id ? 'Generando...' : 'LAB 001'}</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={printingPdfId === qualityModal.rm?.id}
                                    onClick={handleDownloadLab001DocxFromModal}
                                    className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                    title="Descargar dictamen técnico oficial en formato Word editable (.docx)"
                                >
                                    <FileText size={14} className="text-indigo-600" />
                                    <span className="hidden sm:inline">Word (.docx)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    <XCircle size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Resumen del Lote en Cabecera */}
                        {qualityModal.rm && (
                            <div className="bg-amber-50/60 border-b border-amber-200/70 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Lote:</span>
                                        <strong className="text-slate-900 font-black">{qualityModal.provider_lot || qualityModal.rm.provider_lot}</strong>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Proveedor:</span>
                                        <strong className="text-slate-800">{qualityModal.rm.provider_name}</strong>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Cajas / Peso:</span>
                                        <strong className="text-slate-800">{qualityModal.total_boxes || qualityModal.rm.total_boxes || 0} cjs (~{parseFloat(qualityModal.rm.weight_lbs || 0).toLocaleString()} Lbs)</strong>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-900/70 uppercase block">Ingreso:</span>
                                        <strong className="text-slate-800">{formatDate(qualityModal.plant_entry_date)}</strong>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-amber-900/70 uppercase">Clasificación:</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getQualityBadgeClass(qualityModal.quality_status, qualityModal.egg_classification)}`}>
                                        {qualityModal.egg_classification || 'Grado A'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Pestañas de Navegación del Formulario LAB 001 y Certificado de Origen */}
                        <div className="flex items-center border-b border-slate-200 px-5 bg-white overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'general' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'general'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <ClipboardList size={14} />
                                <span>1. Datos Generales & Clasificación</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'physico' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'physico'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <FlaskConical size={14} />
                                <span>2. Análisis Fisicoquímicos (13 Parámetros)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'organo' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'organo'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <Truck size={14} />
                                <span>3. Organolépticos & Transporte</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'review' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'review'
                                        ? 'border-amber-600 text-amber-800 bg-amber-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <Award size={14} />
                                <span>4. Dictamen Oficial & Firmas</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setQualityModal(prev => ({ ...prev, activeTab: 'origin_cert' }))}
                                className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
                                    qualityModal.activeTab === 'origin_cert'
                                        ? 'border-teal-600 text-teal-800 bg-teal-50/40'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <ShieldCheck size={14} className="text-teal-600" />
                                <span>5. Certificado de Calidad de Origen</span>
                            </button>
                        </div>

                        {/* Modal Body / Form */}
                        <form onSubmit={handleSaveQualityClassification} className="flex-1 overflow-y-auto p-5 space-y-4">
                            {!canEditQuality && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
                                    <Lock size={16} className="shrink-0 text-amber-600" />
                                    <span><b>Modo Solo Lectura:</b> Su rol no posee permisos para editar el dictamen de calidad (LAB 001).</span>
                                </div>
                            )}

                            {/* TAB 1: DATOS GENERALES */}
                            {qualityModal.activeTab === 'general' && (
                                <div className="space-y-4">
                                    {/* Clasificación Destacada (Formato LAB 001) */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                                        <div>
                                            <label className="text-xs font-black text-slate-900 uppercase tracking-wide block">
                                                CLASIFICACION HUEVO SEGÚN ANALISIS *
                                            </label>
                                            <span className="text-[11px] text-slate-500">
                                                Dictamen técnico de recepción plasmado en el recuadro superior oficial de LAB 001
                                            </span>
                                        </div>
                                        <div className="w-full sm:w-64">
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.egg_classification}
                                                onChange={(e) => setQualityModal({ ...qualityModal, egg_classification: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border-2 border-slate-900 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-xs"
                                            >
                                                <option value="Grado AA">Grado AA (Extra Especial / Cáscara Impecable)</option>
                                                <option value="Grado A">Grado A (Estándar Premium de Planta)</option>
                                                <option value="Grado B">Grado B (Comercial / Cáscara Irregular)</option>
                                                <option value="Grado Industrial">Grado Industrial (Quiebre Inmediato)</option>
                                                <option value="No Conforme">No Conforme / Rechazado</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                                        {/* Tipo de Proveedor (Local / Extranjero) */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Origen del Proveedor
                                            </label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    disabled={!canEditQuality}
                                                    onClick={() => setQualityModal({ ...qualityModal, provider_type: 'LOCAL' })}
                                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                                                        qualityModal.provider_type === 'LOCAL'
                                                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    Local
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!canEditQuality}
                                                    onClick={() => setQualityModal({ ...qualityModal, provider_type: 'EXTRANJERO' })}
                                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                                                        qualityModal.provider_type === 'EXTRANJERO'
                                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    Extranjero
                                                </button>
                                            </div>
                                        </div>

                                        {/* Granja */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Granja de Procedencia
                                            </label>
                                            <input
                                                type="text"
                                                disabled={!canEditQuality}
                                                placeholder="Ej: Granja El Progreso, Galpón 4"
                                                value={qualityModal.farm_name}
                                                onChange={(e) => setQualityModal({ ...qualityModal, farm_name: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Lote */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Lote de Recepción
                                            </label>
                                            <input
                                                type="text"
                                                disabled={!canEditQuality}
                                                placeholder="Lote proveedor"
                                                value={qualityModal.provider_lot}
                                                onChange={(e) => setQualityModal({ ...qualityModal, provider_lot: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Nota de Remisión */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Nota de Remisión / Guía
                                            </label>
                                            <input
                                                type="text"
                                                disabled={!canEditQuality}
                                                placeholder="Ej: NR-8921"
                                                value={qualityModal.remission_note}
                                                onChange={(e) => setQualityModal({ ...qualityModal, remission_note: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Número de Cajas */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Número de Cajas
                                            </label>
                                            <input
                                                type="number"
                                                disabled={!canEditQuality}
                                                placeholder="Total cajas recibidas"
                                                value={qualityModal.total_boxes}
                                                onChange={(e) => setQualityModal({ ...qualityModal, total_boxes: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Peso en Gramos Unitario Muestreado */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Peso Unitario en Gramos (Muestreo)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: 62.5"
                                                    value={qualityModal.sample_egg_weight_g}
                                                    onChange={(e) => setQualityModal({ ...qualityModal, sample_egg_weight_g: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">g/huevo</span>
                                            </div>
                                        </div>

                                        {/* Color Cascarón */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Color Cascarón
                                            </label>
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.egg_color}
                                                onChange={(e) => setQualityModal({ ...qualityModal, egg_color: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            >
                                                <option value="blanco">Blanco</option>
                                                <option value="marrón">Marrón / Rojo</option>
                                                <option value="mixto">Mixto</option>
                                            </select>
                                        </div>

                                        {/* Tamaño de Huevo */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Tamaño de Huevo
                                            </label>
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.egg_size}
                                                onChange={(e) => setQualityModal({ ...qualityModal, egg_size: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            >
                                                <option value="XL">XL (Super Grande / &gt;73g)</option>
                                                <option value="L">L (Grande / 63g - 73g)</option>
                                                <option value="M">M (Mediano / 53g - 63g)</option>
                                                <option value="S">S (Pequeño / &lt;53g)</option>
                                                <option value="Jumbo">Jumbo (&gt;78g)</option>
                                            </select>
                                        </div>

                                        {/* Fecha Producción */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Producción / Postura
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.production_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, production_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Vencimiento */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Vencimiento
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.expiration_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, expiration_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Ingreso a Planta */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Ingreso a Planta
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.plant_entry_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, plant_entry_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Recepción */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Recepción
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.reception_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, reception_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Fecha Análisis */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Fecha Análisis Laboratorio
                                            </label>
                                            <input
                                                type="date"
                                                disabled={!canEditQuality}
                                                value={qualityModal.analysis_date}
                                                onChange={(e) => setQualityModal({ ...qualityModal, analysis_date: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Hora Análisis */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Hora del Análisis
                                            </label>
                                            <input
                                                type="time"
                                                disabled={!canEditQuality}
                                                value={qualityModal.analysis_time}
                                                onChange={(e) => setQualityModal({ ...qualityModal, analysis_time: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: ANALISIS FISICOQUIMICOS */}
                            {qualityModal.activeTab === 'physico' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                                Parámetros Fisicoquímicos (Formato Oficial LAB 001)
                                            </h3>
                                            <p className="text-[11px] text-slate-500">
                                                Registre las lecturas analíticas por muestra o lote de granja conforme a la hoja de laboratorio.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                                                <tr>
                                                    <th className="px-4 py-2.5 w-1/2">Parámetro</th>
                                                    <th className="px-4 py-2.5 w-1/4 text-center">Lectura / Muestra 1</th>
                                                    <th className="px-4 py-2.5 w-1/4 text-center">Lectura / Muestra 2</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white">
                                                {[
                                                    { key: 'granja', label: 'GRANJA', placeholder: 'Identificador / Galpón' },
                                                    { key: 'espesor_celda_aire', label: 'ESPESOR CELDA DE AIRE', placeholder: 'Ej: 3 mm' },
                                                    { key: 'ph_huevo_fresco', label: 'PH HUEVO FRESCO', placeholder: 'Ej: 7.6 - 8.2' },
                                                    { key: 'solidos_huevo_fresco', label: 'SOLIDOS HUEVO FRESCO', placeholder: 'Ej: 23.5 - 24.5 %' },
                                                    { key: 'firmeza_albumina', label: 'FIRMEZA DE ALBUMINA', placeholder: 'Unidades Haugh' },
                                                    { key: 'ph_albumina', label: 'PH DE ALBUMINA', placeholder: 'Ej: 8.8 - 9.1' },
                                                    { key: 'solidos_albumina', label: 'SOLIDOS ALBUMINA', placeholder: 'Ej: 11.5 - 12.5 %' },
                                                    { key: 'firmeza_yema', label: 'FIRMEZA YEMA', placeholder: 'Firme / Regular' },
                                                    { key: 'forma_yema', label: 'FORMA YEMA', placeholder: 'Índice / Esférica' },
                                                    { key: 'color_yema', label: 'COLOR YEMA', placeholder: 'Escala Roche (1-15)' },
                                                    { key: 'ph_yema', label: 'PH YEMA', placeholder: 'Ej: 6.0 - 6.3' },
                                                    { key: 'solidos_yema', label: 'SOLIDOS DE YEMA', placeholder: 'Ej: 48 - 50 %' },
                                                    { key: 'estado_separacion', label: 'ESTADO DE SEPARACION', placeholder: 'Conforme / Limpio' }
                                                ].map((param, idx) => (
                                                    <tr key={param.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                        <td className="px-4 py-2 font-bold text-slate-800 text-[11px]">
                                                            {param.label}
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                disabled={!canEditQuality}
                                                                placeholder={param.placeholder}
                                                                value={qualityModal.physicochemical[param.key]?.val1 || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setQualityModal(prev => ({
                                                                        ...prev,
                                                                        physicochemical: {
                                                                            ...prev.physicochemical,
                                                                            [param.key]: {
                                                                                ...(prev.physicochemical[param.key] || {}),
                                                                                val1: val
                                                                            }
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="text"
                                                                disabled={!canEditQuality}
                                                                placeholder={param.placeholder}
                                                                value={qualityModal.physicochemical[param.key]?.val2 || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setQualityModal(prev => ({
                                                                        ...prev,
                                                                        physicochemical: {
                                                                            ...prev.physicochemical,
                                                                            [param.key]: {
                                                                                ...(prev.physicochemical[param.key] || {}),
                                                                                val2: val
                                                                            }
                                                                        }
                                                                    }));
                                                                }}
                                                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-center font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: ORGANOLEPTICOS & TRANSPORTE */}
                            {qualityModal.activeTab === 'organo' && (
                                <div className="space-y-4">
                                    {/* Olores Organolépticos */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                            Análisis Organolépticos • Evaluación de Olor
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {[
                                                { key: 'olor_normal', label: 'OLOR CARACTERISTICO A HUEVO NORMAL', desc: 'Conforme, sin notas extrañas' },
                                                { key: 'olor_fuerte', label: 'OLOR CARACTERISTICO A HUEVO FUERTE', desc: 'Alerta por intensidad o edad del huevo' },
                                                { key: 'olor_descomposicion_prematura', label: 'OLOR EN DESCOMPOSICION PREMATURA', desc: 'No conforme, riesgo biológico' },
                                                { key: 'olor_descomposicion_avanzada', label: 'OLOR EN DESCOMPOSICION AVANZADA', desc: 'Rechazo inmediato de lote' }
                                            ].map((item) => (
                                                <label
                                                    key={item.key}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                        qualityModal.organoleptic[item.key]
                                                            ? item.key.includes('descomposicion')
                                                                ? 'bg-rose-50 border-rose-300 text-rose-900'
                                                                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        disabled={!canEditQuality}
                                                        checked={!!qualityModal.organoleptic[item.key]}
                                                        onChange={(e) => {
                                                            const chk = e.target.checked;
                                                            setQualityModal(prev => ({
                                                                ...prev,
                                                                organoleptic: {
                                                                    ...prev.organoleptic,
                                                                    [item.key]: chk
                                                                }
                                                            }));
                                                        }}
                                                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                                                    />
                                                    <div>
                                                        <span className="text-xs font-bold block">{item.label}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">{item.desc}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Consistencia de Cascarón */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wide block">
                                            CONSISTENCIA CASCARON
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { val: 'resistente', label: 'RESISTENTE', color: 'emerald' },
                                                { val: 'poco_resistente', label: 'POCO RESISTENTE', color: 'amber' },
                                                { val: 'fragil', label: 'FRAGIL', color: 'rose' }
                                            ].map((c) => {
                                                const isSel = (qualityModal.organoleptic.consistencia_cascaron || 'resistente') === c.val;
                                                return (
                                                    <button
                                                        key={c.val}
                                                        type="button"
                                                        disabled={!canEditQuality}
                                                        onClick={() => setQualityModal(prev => ({
                                                            ...prev,
                                                            organoleptic: { ...prev.organoleptic, consistencia_cascaron: c.val }
                                                        }))}
                                                        className={`py-2 px-3 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                                            isSel
                                                                ? c.color === 'emerald'
                                                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                                                    : c.color === 'amber'
                                                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                                                    : 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {isSel && <Check size={14} />}
                                                        <span>{c.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Transporte y Almacenaje */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                                            Transporte y Almacenaje
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                    Limpieza / Orden Camión
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: CONFORME / LIMPIO"
                                                    value={qualityModal.transport_storage?.limpieza_camion || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setQualityModal(prev => ({
                                                            ...prev,
                                                            transport_storage: { ...prev.transport_storage, limpieza_camion: val }
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                    Apariencia de Cajas a su Ingreso
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: BUEN ESTADO / LIMPIAS"
                                                    value={qualityModal.transport_storage?.apariencia_cajas || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setQualityModal(prev => ({
                                                            ...prev,
                                                            transport_storage: { ...prev.transport_storage, apariencia_cajas: val }
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                    T° Transporte
                                                </label>
                                                <input
                                                    type="text"
                                                    disabled={!canEditQuality}
                                                    placeholder="Ej: 18.5 °C"
                                                    value={qualityModal.transport_storage?.temperatura_transporte || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setQualityModal(prev => ({
                                                            ...prev,
                                                            transport_storage: { ...prev.transport_storage, temperatura_transporte: val }
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: DICTAMEN OFICIAL & FIRMAS */}
                            {qualityModal.activeTab === 'review' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {/* Dictamen Oficial del Lote */}
                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                Dictamen Oficial del Lote *
                                            </label>
                                            <select
                                                disabled={!canEditQuality}
                                                value={qualityModal.quality_status}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_status: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            >
                                                <option value="aprobado">✅ Aprobado para Producción y Quebrado</option>
                                                <option value="condicional">⚠️ Aprobado Condicional (Uso Restringido o Mezcla)</option>
                                                <option value="cuarentena">⏳ Cuarentena / En Espera de Laboratorio</option>
                                                <option value="rechazado">❌ No Conforme / Rechazado para Producción</option>
                                            </select>
                                        </div>

                                        {/* Muestreo de Defectos Físicos */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                % Huevo Roto / Fisurado
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    disabled={!canEditQuality}
                                                    placeholder="0.00"
                                                    value={qualityModal.quality_defect_broken_pct}
                                                    onChange={(e) => setQualityModal({ ...qualityModal, quality_defect_broken_pct: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                % Huevo Sucio / Manchado
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    disabled={!canEditQuality}
                                                    placeholder="0.00"
                                                    value={qualityModal.quality_defect_dirty_pct}
                                                    onChange={(e) => setQualityModal({ ...qualityModal, quality_defect_dirty_pct: e.target.value })}
                                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                                />
                                                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                °Brix / Sólidos Totales (Opcional)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                disabled={!canEditQuality}
                                                placeholder="Opcional. Ej: 23.5"
                                                value={qualityModal.quality_brix}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_brix: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Observaciones Técnicas */}
                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                OBSERVACIONES :
                                            </label>
                                            <textarea
                                                rows={3}
                                                disabled={!canEditQuality}
                                                placeholder="Detalle aquí cualquier observación sobre el lote, cámara de aire, olor, aspecto de cáscara o acuerdos con proveedor..."
                                                value={qualityModal.quality_notes}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_notes: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        {/* Firmas: Realizado y Revisado */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                REALIZADO : (Inspector de Calidad) *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                disabled={!canEditQuality}
                                                placeholder="Nombre del técnico analista"
                                                value={qualityModal.inspector_name}
                                                onChange={(e) => setQualityModal({ ...qualityModal, inspector_name: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                REVISADO : (Supervisor / Jefe de Calidad) *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                disabled={!canEditQuality}
                                                placeholder="Nombre del supervisor que valida"
                                                value={qualityModal.quality_reviewed_by}
                                                onChange={(e) => setQualityModal({ ...qualityModal, quality_reviewed_by: e.target.value })}
                                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-2xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: CERTIFICADO DE CALIDAD DE ORIGEN (FORMATO OFICIAL PROVEEDOR - ANDELSA) */}
                            {qualityModal.activeTab === 'origin_cert' && (
                                <div className="space-y-4">
                                    {/* Cabecera del Certificado de Origen */}
                                    <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-teal-200/80 pb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="p-1.5 bg-teal-600 text-white rounded-xl shadow-2xs">
                                                        <ShieldCheck size={16} />
                                                    </span>
                                                    <h3 className="text-xs font-black uppercase tracking-wider text-teal-950">
                                                        Certificado de Calidad de Origen • Cadena de Custodia
                                                    </h3>
                                                </div>
                                                <p className="text-[11px] text-teal-800 font-medium mt-0.5">
                                                    Documento legal emitido por el proveedor para <b>ANDELSA</b> acreditando inocuidad, transporte y razas de aves
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={printingPdfId === qualityModal.rm?.id}
                                                    onClick={handlePrintOriginCertFromModal}
                                                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <Printer size={13} />
                                                    <span>PDF</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={printingPdfId === qualityModal.rm?.id}
                                                    onClick={handleDownloadOriginCertDocxFromModal}
                                                    className="px-3 py-1.5 bg-white hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                                >
                                                    <FileText size={13} className="text-teal-700" />
                                                    <span>Word (.docx)</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Recuadro Lote ANDELSA vs Lote Proveedor */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                            <div className="bg-white border border-teal-200 rounded-xl p-3 space-y-1">
                                                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-tight block">
                                                    EMISOR (PROVEEDOR) :
                                                </span>
                                                <strong className="text-xs text-slate-900 font-bold block truncate">
                                                    {qualityModal.rm?.provider_name || 'INVERSIONES AVÍCOLAS DE HONDURAS, S.A.'}
                                                </strong>
                                                <span className="text-[10px] text-slate-500 font-medium block">
                                                    Lote Proveedor: <b>{qualityModal.provider_lot || '---'}</b>
                                                </span>
                                            </div>

                                            <div className="bg-amber-50/90 border-2 border-amber-400 rounded-xl p-3 space-y-1 shadow-2xs">
                                                <span className="text-[10px] font-black text-amber-900 uppercase tracking-tight block">
                                                    LOTE (SE LO COLOCAMOS EN ANDELSA) :
                                                </span>
                                                <strong className="text-sm font-black text-slate-900 font-mono block">
                                                    {qualityModal.rm?.andelsa_lot || qualityModal.rm?.lot_code || `REC-${qualityModal.rm?.id}`}
                                                </strong>
                                                <span className="text-[10px] text-amber-800 font-medium block">
                                                    Destinatario: <b>ANDELSA</b>
                                                </span>
                                            </div>

                                            <div className="bg-white border border-teal-200 rounded-xl p-3 space-y-1">
                                                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-tight block">
                                                    FECHAS CLAVE :
                                                </span>
                                                <div className="text-[11px] text-slate-700 space-y-0.5">
                                                    <div>Producción: <b>{qualityModal.production_date || '---'}</b></div>
                                                    <div>Entrega: <b>{qualityModal.reception_date || '---'}</b></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sección: Requerimientos y Conformidades del Transporte y Empaque */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                            <Truck size={14} className="text-teal-600" />
                                            Requerimientos y Conformidades de Inocuidad
                                        </h4>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                                                    Color del Huevo
                                                </label>
                                                <div className="flex items-center gap-4">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                                        <input
                                                            type="radio"
                                                            name="origin_egg_color"
                                                            value="blanco"
                                                            checked={(qualityModal.egg_color || 'blanco').toLowerCase() === 'blanco'}
                                                            onChange={() => setQualityModal({ ...qualityModal, egg_color: 'blanco' })}
                                                            className="text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Blanco (Conforme)</span>
                                                    </label>
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                                        <input
                                                            type="radio"
                                                            name="origin_egg_color"
                                                            value="marron"
                                                            checked={(qualityModal.egg_color || '').toLowerCase() === 'marron'}
                                                            onChange={() => setQualityModal({ ...qualityModal, egg_color: 'marron' })}
                                                            className="text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Marrón / Rojo</span>
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                                                    Conformidades Físicas (Transporte y Empaque)
                                                </label>
                                                <div className="space-y-2">
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={qualityModal.is_camion_cerrado}
                                                            onChange={(e) => setQualityModal({ ...qualityModal, is_camion_cerrado: e.target.checked })}
                                                            className="rounded text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Camión cerrado</span>
                                                    </label>
                                                    <br />
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={qualityModal.is_limpieza_camion}
                                                            onChange={(e) => setQualityModal({ ...qualityModal, is_limpieza_camion: e.target.checked })}
                                                            className="rounded text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Limpieza del camión</span>
                                                    </label>
                                                    <br />
                                                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                        <input
                                                            type="checkbox"
                                                            checked={qualityModal.is_cartones_limpios}
                                                            onChange={(e) => setQualityModal({ ...qualityModal, is_cartones_limpios: e.target.checked })}
                                                            className="rounded text-teal-600 focus:ring-teal-500"
                                                        />
                                                        <span>Cartones no reciclables y limpios sin plagas ni objetos extraños</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sección: Tabla Dinámica de Razas y Semanas de Edad de las Aves */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                    Lotes de Aves en Origen (Raza y Edad)
                                                </h4>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    Registre las razas y semanas de postura correspondientes a este cargamento
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQualityModal(prev => ({
                                                        ...prev,
                                                        bird_batches: [
                                                            ...(prev.bird_batches || []),
                                                            { breed: 'DEKALB WHITE', age_weeks: '35 SEMANAS DE EDAD' }
                                                        ]
                                                    }));
                                                }}
                                                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                                            >
                                                <Plus size={13} />
                                                <span>+ Agregar Lote de Aves</span>
                                            </button>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                        <th className="p-2.5 w-12 text-center">#</th>
                                                        <th className="p-2.5">Raza del Ave</th>
                                                        <th className="p-2.5">Edad en Semanas</th>
                                                        <th className="p-2.5 w-12 text-center">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-xs">
                                                    {(qualityModal.bird_batches || []).map((batch, bIdx) => (
                                                        <tr key={bIdx} className="hover:bg-slate-50/60 transition-colors">
                                                            <td className="p-2.5 text-center font-mono font-bold text-slate-400 text-[11px]">
                                                                {bIdx + 1}
                                                            </td>
                                                            <td className="p-2.5">
                                                                <input
                                                                    type="text"
                                                                    value={batch.breed}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setQualityModal(prev => {
                                                                            const updated = [...(prev.bird_batches || [])];
                                                                            updated[bIdx] = { ...updated[bIdx], breed: val };
                                                                            return { ...prev, bird_batches: updated };
                                                                        });
                                                                    }}
                                                                    placeholder="Ej: DEKALB WHITE, BOVANS BROWN"
                                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold uppercase text-slate-800 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </td>
                                                            <td className="p-2.5">
                                                                <input
                                                                    type="text"
                                                                    value={batch.age_weeks}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setQualityModal(prev => {
                                                                            const updated = [...(prev.bird_batches || [])];
                                                                            updated[bIdx] = { ...updated[bIdx], age_weeks: val };
                                                                            return { ...prev, bird_batches: updated };
                                                                        });
                                                                    }}
                                                                    placeholder="Ej: 69 SEMANAS DE EDAD"
                                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold uppercase text-slate-800 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </td>
                                                            <td className="p-2.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setQualityModal(prev => ({
                                                                            ...prev,
                                                                            bird_batches: (prev.bird_batches || []).filter((_, i) => i !== bIdx)
                                                                        }));
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                                                    title="Eliminar fila"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!qualityModal.bird_batches || qualityModal.bird_batches.length === 0) && (
                                                        <tr>
                                                            <td colSpan={4} className="p-4 text-center text-slate-400 italic text-xs">
                                                                No se han registrado lotes de aves. Haga clic en "+ Agregar Lote de Aves".
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer Controls */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                                    <button
                                        type="button"
                                        disabled={printingPdfId === qualityModal.rm?.id}
                                        onClick={handlePrintOriginCertFromModal}
                                        className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-xl text-xs font-bold border border-teal-300 transition-colors shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        <ShieldCheck size={14} className="text-teal-700" />
                                        <span>Cert. Origen (PDF)</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={printingPdfId === qualityModal.rm?.id}
                                        onClick={handlePrintLab001FromModal}
                                        className="px-3.5 py-2 bg-white hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 transition-colors shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {printingPdfId === qualityModal.rm?.id ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} className="text-amber-700" />}
                                        <span>Reporte LAB 001</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors shadow-2xs"
                                    >
                                        {canEditQuality ? 'Cancelar' : 'Cerrar'}
                                    </button>
                                    {canEditQuality && (
                                        <button
                                            type="submit"
                                            disabled={qualityModal.isSubmitting}
                                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <ShieldCheck size={15} />
                                            <span>{qualityModal.isSubmitting ? 'Guardando Reporte...' : 'Guardar Reporte LAB 001'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
    );
};

export default EggQualityEvaluationModal;
