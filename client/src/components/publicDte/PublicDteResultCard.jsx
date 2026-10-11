import { 
    FileText, 
    Download, 
    Send, 
    FileJson, 
    Building2, 
    MapPin, 
    Calendar, 
    User, 
    DollarSign,
    CheckCircle2,
    ShieldCheck,
    Hash,
    Stamp,
    Copy,
    Ban,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../../utils/dateUtils';

const dteTypeNames = {
    '01': 'Factura', 
    '03': 'Comprobante de Crédito Fiscal', 
    '04': 'Nota de Remisión',
    '05': 'Nota de Crédito', 
    '06': 'Nota de Débito', 
    '07': 'Comprobante de Retención',
    '08': 'Comprobante de Liquidación', 
    '09': 'Documento Contable de Liquidación',
    '11': 'Factura de Exportación', 
    '14': 'Factura de Sujeto Excluido', 
    '15': 'Comprobante de Donación'
};

export default function PublicDteResultCard({
    dteInfo,
    codigo,
    statusInfo,
    onDownloadPDF,
    onDownloadJSON,
    onDownloadInvalidationPDF,
    onDownloadInvalidationJSON,
    onSendEmail,
    email,
    setEmail,
    sendingEmail,
    showEmailInput,
    setShowEmailInput
}) {
    if (!dteInfo) return null;

    const isInvalidado = dteInfo.status === 'INVALIDADO' || Boolean(dteInfo.is_invalidado);

    return (
        <div className="p-4 sm:p-6 lg:p-7 space-y-5 sm:space-y-6">
            
            {/* Status Header */}
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isInvalidado ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
                    <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        Documento Encontrado
                    </span>
                </div>
                <span className={`inline-flex items-center gap-1.5 self-start xs:self-auto px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider border ring-1 ${statusInfo.cls}`}>
                    <CheckCircle2 size={12} className="shrink-0" />
                    {statusInfo.label}
                </span>
            </div>

            {/* Invalidation Alert Banner */}
            {isInvalidado && (
                <div className="bg-rose-50/90 border border-rose-200/90 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
                    <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                        <Ban size={18} />
                    </div>
                    <div className="text-xs flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-black uppercase tracking-wider text-rose-900 text-xs">
                                Documento Tributario Invalidado
                            </span>
                            {dteInfo.invalidacion?.fh_procesamiento && (
                                <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                                    {dteInfo.invalidacion.fh_procesamiento}
                                </span>
                            )}
                        </div>
                        <p className="text-rose-700 mt-1 leading-relaxed text-[11px]">
                            Este comprobante fue invalidado (anulado) ante el Ministerio de Hacienda. Se encuentran disponibles para su descarga tanto los archivos originales como el evento de invalidación oficial enviado al correo.
                        </p>
                        {dteInfo.invalidacion?.descripcion && (
                            <p className="mt-1 text-[11px] text-rose-800 font-semibold italic">
                                Motivo: {dteInfo.invalidacion.descripcion}
                            </p>
                        )}
                        {dteInfo.invalidacion?.sello_recepcion && (
                            <div className="mt-2 pt-2 border-t border-rose-200/70 flex items-center justify-between gap-1 flex-wrap font-mono text-[10px] text-rose-800">
                                <span className="font-bold">Sello Invalidación MH:</span>
                                <span className="break-all">{dteInfo.invalidacion.sello_recepcion}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                
                {/* Empresa Emisora */}
                <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Building2 size={13} className="text-indigo-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Empresa Emisora</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-800 break-words leading-snug">
                        {dteInfo.company_name || 'N/A'}
                    </span>
                </div>

                {/* Sucursal */}
                <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <MapPin size={13} className="text-indigo-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Establecimiento / Sucursal</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-800 break-words leading-snug">
                        {dteInfo.branch_name || 'N/A'}
                    </span>
                </div>

                {/* Tipo de Documento */}
                <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <FileText size={13} className="text-indigo-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo de Documento</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-indigo-700 break-words leading-snug">
                        {dteTypeNames[dteInfo.tipo_dte] || `Tipo ${dteInfo.tipo_dte}`}
                    </span>
                </div>

                {/* Número de Control */}
                <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck size={13} className="text-indigo-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Número de Control</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-800 font-mono break-all leading-snug">
                        {dteInfo.numero_control || 'N/A'}
                    </span>
                </div>

                {/* Receptor / Cliente (Full Width) */}
                <div className="sm:col-span-2 bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <User size={13} className="text-indigo-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cliente / Receptor</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-800 break-words leading-snug">
                        {dteInfo.receptor_nombre || 'Consumidor Final'}
                    </span>
                    {dteInfo.receptor_nit && (
                        <span className="text-[11px] font-mono text-slate-500 mt-0.5">
                            NIT / Identificación: {dteInfo.receptor_nit}
                        </span>
                    )}
                    {dteInfo.receptor_direccion && (
                        <span className="text-[11px] text-slate-500 mt-0.5 break-words">
                            {dteInfo.receptor_direccion}
                        </span>
                    )}
                </div>

                {/* Fecha de Emisión */}
                <div className="bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Calendar size={13} className="text-indigo-500 shrink-0" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha Emisión</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-800">
                        {formatDate(dteInfo.fecha_emision)}
                    </span>
                </div>

                {/* Código de Generación (UUID) */}
                <div className="sm:col-span-2 bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Hash size={13} className="text-indigo-500 shrink-0" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Código de Generación</span>
                        </div>
                        {(dteInfo.codigo_generacion || codigo) && (
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(dteInfo.codigo_generacion || codigo);
                                    toast.success('Código de generación copiado');
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-wider"
                                title="Copiar Código"
                            >
                                <Copy size={11} />
                                <span>Copiar</span>
                            </button>
                        )}
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-800 font-mono break-all leading-snug">
                        {dteInfo.codigo_generacion || codigo || 'N/A'}
                    </span>
                </div>

                {/* Sello de Recepción MH */}
                <div className="sm:col-span-2 bg-slate-50/80 p-3 sm:p-3.5 rounded-2xl border border-slate-100/90 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5">
                            <Stamp size={13} className="text-emerald-600 shrink-0" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sello de Recepción (MH)</span>
                        </div>
                        {dteInfo.sello_recepcion && (
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(dteInfo.sello_recepcion);
                                    toast.success('Sello de recepción copiado');
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors uppercase tracking-wider"
                                title="Copiar Sello"
                            >
                                <Copy size={11} />
                                <span>Copiar</span>
                            </button>
                        )}
                    </div>
                    <span className="text-xs sm:text-sm font-black text-slate-800 font-mono break-all leading-snug">
                        {dteInfo.sello_recepcion || 'PENDIENTE / NO ASIGNADO'}
                    </span>
                </div>

                {/* Total a Pagar */}
                <div className="sm:col-span-2 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 p-3.5 sm:p-4 rounded-2xl border border-indigo-100/90 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
                            <DollarSign size={16} />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">Total a Pagar</span>
                            <span className="text-[11px] font-medium text-slate-500 hidden xs:block">Monto final liquidado del documento</span>
                        </div>
                    </div>
                    <span className="text-lg sm:text-xl font-black text-indigo-900 font-mono">
                        ${(parseFloat(dteInfo.total_pagar) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

            </div>

            {/* Divider */}
            <div className="h-px bg-slate-100" />

            {/* Action Buttons Section */}
            <div className="space-y-3">
                
                {/* 1. SECCIÓN DE INVALIDACIÓN (Si el DTE está anulado/invalidado) */}
                {isInvalidado && (
                    <div className="space-y-2.5 pb-2">
                        <div className="flex items-center gap-1.5 px-1">
                            <ShieldAlert size={14} className="text-rose-600" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-rose-800">
                                Archivos del Evento de Invalidación (Enviados por Correo)
                            </span>
                        </div>

                        {/* Descargar Acta de Invalidación PDF */}
                        <button
                            type="button"
                            onClick={onDownloadInvalidationPDF}
                            className="flex items-center gap-3 w-full p-3 sm:p-3.5 bg-rose-50/90 hover:bg-rose-100 text-rose-800 rounded-2xl transition-all border border-rose-200 active:scale-[0.99] group shadow-sm"
                        >
                            <div className="p-2 sm:p-2.5 bg-rose-600 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform shrink-0">
                                <FileText size={18} />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <span className="block text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                                    Descargar Acta de Invalidación (PDF)
                                </span>
                                <span className="text-[10px] font-medium text-rose-600/80 block truncate">
                                    Constancia oficial del evento de anulación ante el Ministerio de Hacienda
                                </span>
                            </div>
                            <Download size={16} className="text-rose-500 group-hover:text-rose-800 shrink-0" />
                        </button>

                        {/* Descargar Evento de Invalidación JSON */}
                        <button
                            type="button"
                            onClick={onDownloadInvalidationJSON}
                            className="flex items-center gap-3 w-full p-3 sm:p-3.5 bg-slate-100/80 hover:bg-slate-200/80 text-slate-800 rounded-2xl transition-all border border-slate-200 active:scale-[0.99] group shadow-sm"
                        >
                            <div className="p-2 sm:p-2.5 bg-slate-800 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform shrink-0">
                                <FileJson size={18} />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <span className="block text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                                    Descargar Evento de Invalidación (JSON)
                                </span>
                                <span className="text-[10px] font-medium text-slate-500 block truncate">
                                    Estructura electrónica del evento certificada con sello de recepción MH
                                </span>
                            </div>
                            <Download size={16} className="text-slate-500 group-hover:text-slate-800 shrink-0" />
                        </button>

                        <div className="h-px bg-slate-100 my-2" />
                    </div>
                )}

                {/* 2. DOCUMENTOS ORIGINALES DEL DTE */}
                <button
                    type="button"
                    onClick={onDownloadPDF}
                    className="flex items-center gap-3 w-full p-3 sm:p-3.5 bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-700 rounded-2xl transition-all border border-indigo-100 active:scale-[0.99] group"
                >
                    <div className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform shrink-0">
                        <FileText size={18} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <span className="block text-xs sm:text-sm font-black uppercase tracking-wider truncate">
                            {isInvalidado ? 'Descargar PDF Oficial (Anulado)' : 'Descargar PDF Oficial'}
                        </span>
                        <span className="text-[10px] font-medium text-indigo-400 block truncate">
                            {isInvalidado ? 'Representación gráfica con marca de agua de anulación' : 'Representación gráfica con código QR'}
                        </span>
                    </div>
                    <Download size={16} className="text-indigo-400 group-hover:text-indigo-700 shrink-0" />
                </button>

                <button
                    type="button"
                    onClick={onDownloadJSON}
                    className="flex items-center gap-3 w-full p-3 sm:p-3.5 bg-slate-50 hover:bg-slate-100/90 text-slate-700 rounded-2xl transition-all border border-slate-200/80 active:scale-[0.99] group"
                >
                    <div className="p-2 sm:p-2.5 bg-slate-800 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform shrink-0">
                        <FileJson size={18} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <span className="block text-xs sm:text-sm font-black uppercase tracking-wider truncate">Descargar JSON Firmado</span>
                        <span className="text-[10px] font-medium text-slate-400 block truncate">Estructura tributaria original certificada</span>
                    </div>
                    <Download size={16} className="text-slate-400 group-hover:text-slate-700 shrink-0" />
                </button>

                {/* 3. ENVÍO POR CORREO */}
                {!showEmailInput ? (
                    <button
                        type="button"
                        onClick={() => setShowEmailInput(true)}
                        className="flex items-center gap-3 w-full p-3 sm:p-3.5 bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-800 rounded-2xl transition-all border border-emerald-100 active:scale-[0.99] group"
                    >
                        <div className="p-2 sm:p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform shrink-0">
                            <Send size={18} />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <span className="block text-xs sm:text-sm font-black uppercase tracking-wider truncate">Enviar a mi Correo</span>
                            <span className="text-[10px] font-medium text-emerald-600/80 block truncate">
                                {isInvalidado 
                                    ? 'Recibe el documento anulado y los archivos de invalidación en tu bandeja' 
                                    : 'Recibe el PDF y JSON en tu bandeja'}
                            </span>
                        </div>
                        <Send size={16} className="text-emerald-500 group-hover:text-emerald-700 shrink-0" />
                    </button>
                ) : (
                    <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100/90 space-y-2.5 animate-fadeIn">
                        <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Ingrese su correo electrónico</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="correo@ejemplo.com"
                                className="flex-1 px-3.5 py-2.5 bg-white border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs sm:text-sm font-medium shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={onSendEmail}
                                disabled={sendingEmail || !email.trim()}
                                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                            >
                                {sendingEmail ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send size={13} />
                                )}
                                <span>Enviar</span>
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setShowEmailInput(false); setEmail(''); }}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
