import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { 
    Smartphone, 
    X, 
    Loader2, 
    AlertCircle, 
    RefreshCw, 
    Package, 
    CheckCircle2, 
    Copy 
} from 'lucide-react';

/**
 * QrScanModal Component
 * Modal providing a QR code for smartphone camera DTE document scanning and AI extraction.
 */
const QrScanModal = ({ 
    isOpen, 
    onClose, 
    sessionId, 
    lanIp, 
    isLoading, 
    error, 
    status, 
    onRetry,
    recognizeProducts,
    onToggleRecognizeProducts
}) => {
    const [copied, setCopied] = useState(false);
    if (!isOpen) return null;

    const queryParam = recognizeProducts ? '?recognize_items=1' : '';
    let qrUrl = '';
    if (sessionId) {
        if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && lanIp) {
            qrUrl = `${window.location.protocol}//${lanIp}:${window.location.port}/scan-dte/${sessionId}${queryParam}`;
        } else {
            qrUrl = `${window.location.origin}/scan-dte/${sessionId}${queryParam}`;
        }
    }

    const handleCopy = () => {
        if (!qrUrl) return;
        navigator.clipboard.writeText(qrUrl);
        setCopied(true);
        toast.success('Enlace copiado al portapapeles');
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-slate-100">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-indigo-50/50 via-white to-violet-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                            <Smartphone size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 tracking-tight leading-none uppercase">
                                Escanear con Teléfono
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium mt-1">
                                Usa la cámara de tu smartphone para capturar el DTE
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col items-center text-center space-y-4">
                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center gap-3">
                            <Loader2 size={36} className="animate-spin text-indigo-600" />
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Generando sesión segura de escaneo...
                            </p>
                        </div>
                    ) : error ? (
                        <div className="py-8 flex flex-col items-center gap-3">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                                <AlertCircle size={32} />
                            </div>
                            <p className="text-sm font-bold text-rose-700">{error}</p>
                            <button
                                onClick={onRetry}
                                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all cursor-pointer shadow-sm"
                            >
                                <RefreshCw size={14} /> Reintentar
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Toggle Reconocimiento de Productos */}
                            <div className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-left">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                        <Package size={14} className="text-indigo-600" />
                                        <span>Reconocer productos con IA</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">
                                        Extrae automáticamente las líneas de productos, cantidades y precios
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input 
                                        type="checkbox" 
                                        checked={recognizeProducts} 
                                        onChange={(e) => onToggleRecognizeProducts?.(e.target.checked)} 
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {/* QR Code Container */}
                            <div className="relative p-4 bg-white rounded-2xl border-2 border-indigo-100 shadow-inner flex items-center justify-center">
                                {sessionId && (
                                    <QRCodeSVG
                                        value={qrUrl}
                                        size={210}
                                        level="M"
                                        includeMargin={false}
                                        className="rounded-lg"
                                    />
                                )}

                                {status === 'processing' && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 gap-2 animate-in fade-in">
                                        <Loader2 size={36} className="animate-spin text-violet-600" />
                                        <span className="text-xs font-black uppercase tracking-wider text-violet-700">
                                            Analizando DTE con IA...
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-medium text-center">
                                            La foto fue recibida del teléfono. Extrayendo datos...
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Status Indicator */}
                            {status === 'pending' && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-full text-xs font-bold">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span>Esperando captura desde el teléfono...</span>
                                </div>
                            )}

                            {status === 'processing' && (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 border border-violet-200/70 rounded-full text-xs font-bold">
                                    <Loader2 size={13} className="animate-spin text-violet-600" />
                                    <span>Procesando imagen con IA...</span>
                                </div>
                            )}

                            {/* Steps / Instructions */}
                            <div className="w-full bg-slate-50 rounded-2xl p-3.5 text-left border border-slate-100 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Instrucciones rápidas:
                                </p>
                                <ol className="text-[12px] text-slate-600 space-y-1.5 font-medium">
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">1</span>
                                        <span>Abre la app de cámara de tu teléfono y enfoca el código QR.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">2</span>
                                        <span>Toca el enlace para abrir la pantalla de escaneo móvil.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span>
                                        <span>Toma la foto del DTE/factura física y presiona procesar.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">✓</span>
                                        <span>Los datos se completarán aquí automáticamente en tiempo real.</span>
                                    </li>
                                </ol>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    {sessionId && !error && (
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            title="Copiar enlace directo"
                        >
                            {copied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            <span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-auto px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QrScanModal;
