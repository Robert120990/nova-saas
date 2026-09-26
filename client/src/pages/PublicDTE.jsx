import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
    Search, 
    FileText, 
    Download, 
    Send, 
    FileJson, 
    XCircle, 
    Building2, 
    MapPin, 
    Calendar, 
    User, 
    DollarSign,
    CheckCircle2,
    ShieldCheck,
    Receipt,
    Hash,
    Stamp,
    Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../utils/dateUtils';

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

const statusConfig = {
    'ACCEPTED': { label: 'Aceptado por Hacienda', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20' },
    'SENT': { label: 'Transmitido', cls: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20' },
    'REJECTED': { label: 'Rechazado', cls: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20' },
    'INVALIDADO': { label: 'Anulado / Invalidado', cls: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20' }
};

const PublicDTE = () => {
    const [searchParams] = useSearchParams();
    const routeParams = useParams();
    const initialCode = searchParams.get('codigo') || searchParams.get('c') || routeParams.codigo || '';

    const [codigo, setCodigo] = useState(initialCode);
    const [dteInfo, setDteInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [email, setEmail] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const initialSearchDone = useRef(false);

    const executeSearch = async (targetCode) => {
        const trimmed = (targetCode || '').trim();
        if (!trimmed) return;
        setLoading(true);
        setSearched(true);
        setDteInfo(null);
        setShowEmailInput(false);
        try {
            const { data } = await axios.get(`/api/public/dte/${trimmed}/info`);
            if (data.encontrado) {
                setDteInfo(data);
            } else {
                setDteInfo(null);
            }
        } catch {
            setDteInfo(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialCode && !initialSearchDone.current) {
            initialSearchDone.current = true;
            setCodigo(initialCode);
            executeSearch(initialCode);
        }
    }, [initialCode]);

    const handleSearch = async (e) => {
        e?.preventDefault?.();
        executeSearch(codigo);
    };

    const handleDownloadPDF = () => {
        window.open(`/api/public/dte/${codigo.trim()}/pdf`, '_blank');
    };

    const handleDownloadJSON = () => {
        const a = document.createElement('a');
        a.href = `/api/public/dte/${codigo.trim()}/json`;
        a.download = `DTE-${dteInfo?.numero_control || codigo}.json`;
        a.click();
    };

    const handleSendEmail = async () => {
        if (!email.trim()) {
            toast.error('Ingrese un correo electrónico');
            return;
        }
        setSendingEmail(true);
        try {
            const { data } = await axios.post(`/api/public/dte/${codigo.trim()}/send-email`, { email: email.trim() });
            if (data.success) {
                toast.success('Correo enviado correctamente');
                setShowEmailInput(false);
                setEmail('');
            } else {
                toast.error(data.message || 'Error al enviar correo');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al enviar correo');
        } finally {
            setSendingEmail(false);
        }
    };

    const statusInfo = dteInfo ? (statusConfig[dteInfo.status] || { label: dteInfo.status, cls: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/10' }) : {};

    return (
        <div className="min-h-screen bg-slate-50/70 bg-gradient-to-b from-indigo-50/50 via-white to-slate-100 flex flex-col justify-between p-3.5 sm:p-6 lg:p-8">
            <div className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-center py-4">
                
                {/* Header Branding */}
                <div className="text-center mb-6 sm:mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl sm:rounded-3xl shadow-xl shadow-indigo-600/25 mb-3 sm:mb-4 text-white">
                        <Receipt size={30} className="sm:hidden" />
                        <Receipt size={34} className="hidden sm:block" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Consulta de DTE</h1>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 max-w-md mx-auto px-2">
                        Documento Tributario Electrónico del Ministerio de Hacienda de El Salvador
                    </p>
                </div>

                {/* Search Bar Form */}
                <form onSubmit={handleSearch} className="mb-5 sm:mb-6">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                placeholder="Código de Generación (UUID)"
                                className="w-full pl-10 pr-3.5 py-3 sm:py-3.5 bg-white border border-slate-200/90 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all text-xs sm:text-sm font-mono font-bold shadow-sm placeholder:font-sans placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !codigo.trim()}
                            className="w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search size={15} />
                            )}
                            <span>Buscar</span>
                        </button>
                    </div>
                </form>

                {/* Result Card */}
                {searched && !loading && (
                    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden transition-all">
                        {dteInfo ? (
                            <div className="p-4 sm:p-6 lg:p-7 space-y-5 sm:space-y-6">
                                
                                {/* Status Header */}
                                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                            Documento Encontrado
                                        </span>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 self-start xs:self-auto px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider border ring-1 ${statusInfo.cls}`}>
                                        <CheckCircle2 size={12} className="shrink-0" />
                                        {statusInfo.label}
                                    </span>
                                </div>

                                {/* Information Grid (Responsive: 1 col on mobile, 2 cols on tablet/desktop) */}
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

                                {/* Action Buttons */}
                                <div className="space-y-2.5">
                                    <button
                                        type="button"
                                        onClick={handleDownloadPDF}
                                        className="flex items-center gap-3 w-full p-3 sm:p-3.5 bg-indigo-50/80 hover:bg-indigo-100/90 text-indigo-700 rounded-2xl transition-all border border-indigo-100 active:scale-[0.99] group"
                                    >
                                        <div className="p-2 sm:p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm group-hover:scale-105 transition-transform shrink-0">
                                            <FileText size={18} />
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <span className="block text-xs sm:text-sm font-black uppercase tracking-wider truncate">Descargar PDF Oficial</span>
                                            <span className="text-[10px] font-medium text-indigo-400 block truncate">Representación gráfica con código QR</span>
                                        </div>
                                        <Download size={16} className="text-indigo-400 group-hover:text-indigo-700 shrink-0" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleDownloadJSON}
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
                                                <span className="text-[10px] font-medium text-emerald-600/80 block truncate">Recibe el PDF y JSON en tu bandeja</span>
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
                                                    onClick={handleSendEmail}
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
                        ) : (
                            <div className="p-8 sm:p-12 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-rose-50 rounded-2xl mb-3 text-rose-500">
                                    <XCircle size={28} />
                                </div>
                                <p className="font-black text-slate-700 text-sm sm:text-base uppercase tracking-wider">Documento no encontrado</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                                    Verifique que el código de generación sea correcto o intente de nuevo en unos momentos.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Legal */}
                <div className="mt-8 text-center px-4">
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        &copy; {new Date().getFullYear()} — Consulta Oficial de Documentos Tributarios Electrónicos
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicDTE;

