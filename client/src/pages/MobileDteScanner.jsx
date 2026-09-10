import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
    Camera, 
    Sparkles, 
    CheckCircle2, 
    AlertCircle, 
    RotateCw, 
    Image as ImageIcon, 
    Clock, 
    Monitor,
    FileText,
    Zap,
    LogOut,
    QrCode,
    Package
} from 'lucide-react';

/**
 * Optimiza y comprime la imagen tomada desde la cámara móvil
 * Reduce fotos pesadas de 15MB-50MP a ~350KB-1600px para prevenir
 * cierres de pestaña por falta de memoria (OOM / Low Memory Killer) en teléfonos.
 */
function compressAndOptimizeImage(file, maxDimension = 1600, quality = 0.85) {
    if (!file || file.type === 'application/pdf') {
        return Promise.resolve({ file, dataUrl: null });
    }

    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            try {
                URL.revokeObjectURL(objectUrl);
                let { width, height } = img;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);

                canvas.toBlob((blob) => {
                    canvas.width = 0;
                    canvas.height = 0;
                    if (blob) {
                        const optimizedFile = new File([blob], 'comprobante_dte.jpg', {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve({ file: optimizedFile, dataUrl });
                    } else {
                        resolve({ file, dataUrl });
                    }
                }, 'image/jpeg', quality);
            } catch (err) {
                console.error('Error durante la optimización de imagen:', err);
                resolve({ file, dataUrl: null });
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ file, dataUrl: null });
        };

        img.src = objectUrl;
    });
}

function dataUrlToFile(dataUrl, filename = 'comprobante_dte.jpg') {
    try {
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime, lastModified: Date.now() });
    } catch (e) {
        console.error('Error al convertir DataURL a File:', e);
        return null;
    }
}

export default function MobileDteScanner() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const [sessionStatus, setSessionStatus] = useState('checking'); // 'checking' | 'valid' | 'expired' | 'error' | 'completed'
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [recognizeItems, setRecognizeItems] = useState(searchParams.get('recognize_items') === '1');
    const [isCompressing, setIsCompressing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [resultData, setResultData] = useState(null);
    const [countdown, setCountdown] = useState(4);

    const handleCloseWindow = () => {
        try {
            window.open('', '_self', '');
            window.close();
        } catch (e) {}
        try {
            window.close();
        } catch (e) {}
        try {
            if (window.history.length > 1) {
                window.history.back();
            }
        } catch (e) {}
    };

    // Temporizador para cerrar automáticamente la pestaña tras transmitir
    useEffect(() => {
        if (sessionStatus !== 'completed') return;

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleCloseWindow();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [sessionStatus]);

    // 1. Restaurar imagen si la pestaña se recargó y verificar validez de la sesión
    useEffect(() => {
        if (!sessionId) {
            setSessionStatus('error');
            return;
        }

        // Recuperar imagen en caché si el navegador móvil recargó la pestaña
        try {
            const cachedDataUrl = sessionStorage.getItem(`mobile_scan_cached_${sessionId}`);
            if (cachedDataUrl) {
                const recoveredFile = dataUrlToFile(cachedDataUrl);
                if (recoveredFile) {
                    setSelectedImage(recoveredFile);
                    setPreviewUrl(cachedDataUrl);
                }
            }
        } catch (e) {
            console.warn('No se pudo acceder a sessionStorage:', e);
        }

        const checkSession = async () => {
            try {
                const res = await axios.get(`/api/public/scan-session/${sessionId}`);
                if (res.data?.status === 'completed' && res.data?.data) {
                    setResultData(res.data.data);
                    setSessionStatus('completed');
                    try {
                        sessionStorage.removeItem(`mobile_scan_cached_${sessionId}`);
                    } catch (e) {}
                } else if (res.data?.status === 'expired') {
                    setSessionStatus('expired');
                } else {
                    setSessionStatus('valid');
                }
            } catch (err) {
                if (err.response?.status === 404 || err.response?.status === 410) {
                    setSessionStatus('expired');
                } else {
                    setSessionStatus('error');
                }
            }
        };

        checkSession();
    }, [sessionId]);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsCompressing(true);
        setUploadError(null);

        try {
            // Optimizar resolución y memoria inmediatamente
            const { file: optimizedFile, dataUrl } = await compressAndOptimizeImage(file, 1600, 0.85);
            setSelectedImage(optimizedFile);

            if (dataUrl) {
                setPreviewUrl(dataUrl);
                try {
                    sessionStorage.setItem(`mobile_scan_cached_${sessionId}`, dataUrl);
                } catch (e) {
                    console.warn('sessionStorage lleno:', e);
                }
            } else {
                const blobUrl = URL.createObjectURL(optimizedFile);
                setPreviewUrl(blobUrl);
            }
        } catch (err) {
            console.error('Error al procesar archivo:', err);
            setSelectedImage(file);
            try {
                setPreviewUrl(URL.createObjectURL(file));
            } catch (blobErr) {
                console.error('Error createObjectURL:', blobErr);
            }
        } finally {
            setIsCompressing(false);
        }
    };

    const handleUploadAndProcess = async () => {
        if (!selectedImage || !sessionId) return;

        setIsUploading(true);
        setUploadError(null);

        const formData = new FormData();
        formData.append('file', selectedImage);
        formData.append('recognizeItems', recognizeItems ? 'true' : 'false');

        try {
            const res = await axios.post(`/api/public/scan-session/${sessionId}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 45000 // 45 segundos para dar margen al análisis de IA
            });

            if (res.data?.success && res.data?.data) {
                setResultData(res.data.data);
                setSessionStatus('completed');
                try {
                    sessionStorage.removeItem(`mobile_scan_cached_${sessionId}`);
                } catch (e) {}
            } else {
                throw new Error(res.data?.message || 'No se pudieron extraer los datos fiscales');
            }
        } catch (err) {
            console.error('Error al subir comprobante:', err);
            setUploadError(err.response?.data?.message || err.message || 'Error al procesar la imagen con IA');
        } finally {
            setIsUploading(false);
        }
    };

    const handleReset = () => {
        setSelectedImage(null);
        if (previewUrl && previewUrl.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(previewUrl);
            } catch (e) {}
        }
        setPreviewUrl(null);
        setUploadError(null);
        setResultData(null);
        setSessionStatus('valid');
        try {
            sessionStorage.removeItem(`mobile_scan_cached_${sessionId}`);
        } catch (e) {}
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-600/30">
                        N
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white tracking-tight">Nova SaaS</h1>
                        <p className="text-[11px] text-slate-400">Escáner Móvil de DTE</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                    <Monitor className="w-3 h-3 text-indigo-400" />
                    <span>Conectado a PC</span>
                </div>
            </header>

            {/* Contenido Principal */}
            <main className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
                {/* 1. Estado Verificando */}
                {sessionStatus === 'checking' && (
                    <div className="text-center py-12 space-y-3">
                        <RotateCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                        <p className="text-xs text-slate-400">Verificando sesión con la computadora...</p>
                    </div>
                )}

                {/* 2. Estado Sesión Expirada o Inválida */}
                {sessionStatus === 'expired' && (
                    <div className="bg-slate-900/90 border border-rose-900/50 rounded-2xl p-6 text-center space-y-4 shadow-xl">
                        <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-base font-bold text-white">Sesión Expirada</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                El código QR tiene una vigencia temporal de 10 minutos por seguridad. Por favor, genera un nuevo código QR en tu computadora.
                            </p>
                        </div>
                    </div>
                )}

                {/* 3. Estado Error de Conexión */}
                {sessionStatus === 'error' && (
                    <div className="bg-slate-900/90 border border-amber-900/50 rounded-2xl p-6 text-center space-y-4 shadow-xl">
                        <div className="w-12 h-12 rounded-2xl bg-amber-950/80 border border-amber-800/80 text-amber-400 flex items-center justify-center mx-auto">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-base font-bold text-white">Error de Conexión</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">
                                No se pudo validar la sesión de escaneo. Verifica tu conexión a internet o vuelve a escanear el código QR.
                            </p>
                        </div>
                    </div>
                )}

                {/* 4. Estado Sesión Válida / Captura */}
                {sessionStatus === 'valid' && (
                    <div className="space-y-5">
                        {/* Inputs nativos en el DOM */}
                        <input
                            id="mobile-camera-file-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onClick={(e) => { e.target.value = ''; }}
                            onChange={handleFileSelect}
                            style={{
                                position: 'absolute',
                                width: '1px',
                                height: '1px',
                                padding: 0,
                                margin: '-1px',
                                overflow: 'hidden',
                                clip: 'rect(0, 0, 0, 0)',
                                whiteSpace: 'nowrap',
                                border: 0,
                                opacity: 0
                            }}
                        />
                        <input
                            id="mobile-gallery-file-input"
                            type="file"
                            accept="image/*,.pdf"
                            onClick={(e) => { e.target.value = ''; }}
                            onChange={handleFileSelect}
                            style={{
                                position: 'absolute',
                                width: '1px',
                                height: '1px',
                                padding: 0,
                                margin: '-1px',
                                overflow: 'hidden',
                                clip: 'rect(0, 0, 0, 0)',
                                whiteSpace: 'nowrap',
                                border: 0,
                                opacity: 0
                            }}
                        />

                        {isCompressing ? (
                            /* Pantalla de Optimización Rápida */
                            <div className="bg-slate-900/90 border border-indigo-900/50 rounded-2xl p-8 text-center space-y-4 shadow-xl animate-in fade-in duration-200">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-800/80 text-indigo-400 flex items-center justify-center mx-auto">
                                    <RotateCw className="w-6 h-6 animate-spin text-indigo-400" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-white">Preparando imagen...</h3>
                                    <p className="text-[11px] text-slate-400">Optimizando comprobante para un análisis ultrarrápido</p>
                                </div>
                            </div>
                        ) : !previewUrl ? (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                {/* Tarjeta de Instrucciones */}
                                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                                        <Sparkles className="w-4 h-4" />
                                        <span>Captura Inteligente con IA</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Toma una foto nítida de la factura o DTE impreso. La IA detectará automáticamente el proveedor, número de control, sello de Hacienda y montos.
                                    </p>
                                    <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                                        <li>Enfoca bien el texto y los números.</li>
                                        <li>Evita sombras intensas o reflejos directos.</li>
                                    </ul>
                                </div>

                                {/* Toggle Reconocimiento de Productos */}
                                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                            <Package className="w-4 h-4 text-indigo-400" />
                                            <span>Reconocer productos con IA</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400">
                                            Extrae lista de productos, cantidades y precios
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input 
                                            type="checkbox" 
                                            checked={recognizeItems} 
                                            onChange={(e) => setRecognizeItems(e.target.checked)} 
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                {/* Botón Principal: Abrir Cámara mediante Label nativo */}
                                <label
                                    htmlFor="mobile-camera-file-input"
                                    className="w-full py-4 px-6 rounded-2xl bg-linear-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 cursor-pointer select-none text-center"
                                >
                                    <Camera className="w-6 h-6" />
                                    <span>Tomar Foto con la Cámara</span>
                                </label>

                                {/* Botón Secundario: Galería o Archivo mediante Label nativo */}
                                <label
                                    htmlFor="mobile-gallery-file-input"
                                    className="w-full py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer select-none text-center"
                                >
                                    <ImageIcon className="w-4 h-4 text-slate-400" />
                                    <span>Subir desde Galería o Archivo</span>
                                </label>
                            </div>
                        ) : (
                            /* Previsualización y Envío */
                            <div className="space-y-4 animate-in zoom-in-95 duration-200">
                                <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-500/60 shadow-xl bg-slate-900 max-h-[46vh] flex items-center justify-center">
                                    {selectedImage?.type === 'application/pdf' ? (
                                        <div className="p-8 text-center space-y-2">
                                            <FileText className="w-12 h-12 text-indigo-400 mx-auto" />
                                            <p className="text-xs font-bold text-slate-300">{selectedImage.name}</p>
                                            <p className="text-[10px] text-slate-500">Documento PDF listo para analizar</p>
                                        </div>
                                    ) : (
                                        <img
                                            src={previewUrl}
                                            alt="Previsualización de comprobante"
                                            className="w-full h-full object-contain max-h-[46vh]"
                                        />
                                    )}

                                    {isUploading && (
                                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-4 text-center">
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                                                <Sparkles className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="text-sm font-bold text-white">Analizando con Inteligencia Artificial...</h3>
                                                <p className="text-[11px] text-slate-400">Extrayendo datos fiscales del comprobante</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {uploadError && (
                                    <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{uploadError}</span>
                                    </div>
                                )}

                                {!isUploading && (
                                    <div className="space-y-2.5 pt-1">
                                        {/* Toggle Reconocimiento en Previsualización */}
                                        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2 text-left">
                                            <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-medium">
                                                <Package className="w-3.5 h-3.5 text-indigo-400" />
                                                <span>Reconocer productos con IA</span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={recognizeItems} 
                                                    onChange={(e) => setRecognizeItems(e.target.checked)} 
                                                    className="sr-only peer"
                                                />
                                                <div className="w-8 h-4 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-600 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleUploadAndProcess}
                                            className="w-full py-4 px-6 rounded-2xl bg-linear-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Zap className="w-5 h-5" />
                                            <span>Analizar con IA y Enviar a PC</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleReset}
                                            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <RotateCw className="w-3.5 h-3.5" />
                                            <span>Tomar otra foto (descartar esta)</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 5. Estado Exitoso: Datos Transferidos a PC */}
                {sessionStatus === 'completed' && (
                    <div className="bg-slate-900/90 border border-emerald-900/60 rounded-2xl p-6 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-700/80 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/20">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-lg font-black text-white tracking-tight">¡Comprobante Transferido!</h2>
                            <p className="text-xs text-slate-300">
                                Los datos fueron enviados y procesados exitosamente en tu computadora.
                            </p>
                        </div>

                        {/* Resumen de Datos Detectados */}
                        {resultData && (
                            <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 text-left space-y-2 text-xs">
                                {resultData.tipo_documento_nombre && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Tipo DTE:</span>
                                        <span className="font-bold text-indigo-400">{resultData.tipo_documento_nombre}</span>
                                    </div>
                                )}
                                {(resultData.matchedProvider?.nombre || resultData.emisor?.nombre) && (
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-slate-400">Emisor:</span>
                                        <span className="font-bold text-slate-200 text-right truncate max-w-[200px]">
                                            {resultData.matchedProvider?.nombre || resultData.emisor?.nombre}
                                        </span>
                                    </div>
                                )}
                                {(resultData.codigo_generacion || resultData.numero_control) && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Doc / Control:</span>
                                        <span className="font-mono font-bold text-slate-300 truncate max-w-[190px]">
                                            {resultData.numero_control || resultData.codigo_generacion}
                                        </span>
                                    </div>
                                )}
                                {resultData.items && resultData.items.length > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Productos:</span>
                                        <span className="font-bold text-indigo-400">
                                            {resultData.items.length} detectados
                                        </span>
                                    </div>
                                )}
                                {resultData.totales?.monto_total !== undefined && (
                                    <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 font-bold">
                                        <span className="text-slate-400">Total:</span>
                                        <span className="text-emerald-400 text-sm">
                                            ${parseFloat(resultData.totales.monto_total || 0).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Botón de cierre y aviso de nueva compra */}
                        <div className="pt-2 space-y-3">
                            <button
                                type="button"
                                onClick={handleCloseWindow}
                                className="w-full py-3.5 px-5 rounded-2xl bg-linear-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>{countdown > 0 ? `Cerrar Pestaña Ahora (${countdown}s)` : 'Cerrar Pestaña'}</span>
                            </button>

                            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 text-[11px] leading-relaxed flex items-center gap-2.5 text-left">
                                <QrCode className="w-5 h-5 text-indigo-400 shrink-0" />
                                <span>Para registrar otra compra, genera y escanea un nuevo código QR en tu computadora.</span>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="text-center pt-4 text-[10px] text-slate-400">
                Nova SaaS • Sistema Integrado de Facturación y DTE
            </footer>
        </div>
    );
}
