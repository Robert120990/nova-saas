import { useState, useEffect, useRef } from 'react';
import { 
    Camera, 
    X, 
    QrCode, 
    RefreshCcw, 
    AlertTriangle, 
    Search, 
    Barcode
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Helper to emit a subtle audio beep on successful scan
 */
const playSuccessBeep = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
    } catch (e) {
        // Ignore audio restrictions
    }
};

/**
 * Parser for scanned text (supports JSON QR from TarimaLabelModal, Code128 barcodes TAR-LOT-NUM, or plain codes)
 */
export const parseTarimaScan = (rawText) => {
    const text = String(rawText || '').trim();
    if (!text) return null;

    // 1. JSON QR Format
    if (text.startsWith('{') && text.endsWith('}')) {
        try {
            const parsed = JSON.parse(text);
            return {
                lotCode: (parsed.lot || '').trim().toUpperCase(),
                tarimaNumber: parseInt(parsed.tarima, 10) || null,
                palletId: parsed.id || null,
                boxes: parseInt(parsed.boxes, 10) || null,
                weightLbs: parseFloat(parsed.net_lb) || null,
                rawText: text
            };
        } catch (e) {
            // Proceed to regex
        }
    }

    // 2. Barcode Format: TAR-LOTCODE-TARIMANUM (ej. TAR-LOTE-AV-0910-01 o TAR-AV991A-1)
    const match = text.match(/^TAR-(.+)-(\d+)$/i);
    if (match) {
        return {
            lotCode: match[1].trim().toUpperCase(),
            tarimaNumber: parseInt(match[2], 10),
            palletId: text.toUpperCase(),
            boxes: null,
            weightLbs: null,
            rawText: text
        };
    }

    // 3. Fallback format
    return {
        lotCode: text.toUpperCase(),
        tarimaNumber: null,
        palletId: text,
        boxes: null,
        weightLbs: null,
        rawText: text
    };
};

export default function ProductionTarimaScannerModal({
    isOpen = true,
    onClose,
    onScanTarima
}) {
    const [isScanning, setIsScanning] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [manualCode, setManualCode] = useState('');
    const [facingMode, setFacingMode] = useState('environment'); // 'environment' o 'user'

    const manualInputRef = useRef(null);
    const scannerRef = useRef(null);
    const isMountedRef = useRef(true);
    const lastScanRef = useRef(null);

    // Manejar el resultado decodificado
    const handleScanDecoded = (decodedText) => {
        if (!decodedText || !isMountedRef.current) return;
        const clean = decodedText.trim();
        if (clean === lastScanRef.current) return;

        lastScanRef.current = clean;

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([100, 50, 100]); } catch (e) {}
        }
        playSuccessBeep();

        const parsed = parseTarimaScan(clean);
        if (parsed && onScanTarima) {
            onScanTarima(parsed);
        }
    };

    // Inicializar cámara de forma segura
    useEffect(() => {
        isMountedRef.current = true;
        const readerElementId = 'production-tarima-qr-reader';
        let localScanner = null;

        const startCamera = async () => {
            try {
                // Esperar a que el modal se renderice en el DOM
                await new Promise(r => setTimeout(r, 120));
                if (!isMountedRef.current) return;

                const elem = document.getElementById(readerElementId);
                if (!elem) return;

                localScanner = new Html5Qrcode(readerElementId);
                scannerRef.current = localScanner;

                const config = {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                };

                await localScanner.start(
                    { facingMode },
                    config,
                    (decoded) => handleScanDecoded(decoded),
                    () => {}
                );

                if (isMountedRef.current) {
                    setIsScanning(true);
                    setCameraError(null);
                }
            } catch (err) {
                if (!isMountedRef.current) return;
                console.warn('[ProductionTarimaScannerModal] Camera error:', err);
                const msg = err?.message || err?.name || String(err);

                if (err.name === 'NotAllowedError' || msg.includes('Permission')) {
                    setCameraError('Permiso de cámara denegado. Actívalo en tu navegador o ingresa el código abajo.');
                } else if (err.name === 'NotFoundError') {
                    setCameraError('No se encontró una cámara en este dispositivo. Puedes ingresar el código manualmente.');
                } else if (err.name === 'OverconstrainedError' && facingMode === 'environment') {
                    setFacingMode('user');
                    return;
                } else {
                    setCameraError('No fue posible abrir la cámara en vivo. Puedes ingresar el código de la tarima abajo.');
                }

                setIsScanning(false);
                setTimeout(() => {
                    if (isMountedRef.current && manualInputRef.current) {
                        manualInputRef.current.focus();
                    }
                }, 200);
            }
        };

        startCamera();

        return () => {
            isMountedRef.current = false;
            if (scannerRef.current) {
                const s = scannerRef.current;
                scannerRef.current = null;
                try {
                    if (s.isScanning) {
                        s.stop().catch(() => {}).finally(() => {
                            try { s.clear(); } catch (e) {}
                        });
                    } else {
                        try { s.clear(); } catch (e) {}
                    }
                } catch (e) {}
            }
        };
    }, [facingMode]);

    // Conmutar entre cámara trasera y frontal
    const toggleCameraFacing = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
            } catch (e) {}
        }
        setIsScanning(false);
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    };

    // Manejar envío manual
    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (!manualCode.trim()) return;

        playSuccessBeep();
        const parsed = parseTarimaScan(manualCode.trim());
        if (parsed && onScanTarima) {
            onScanTarima(parsed);
        }
        setManualCode('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Cabecera del Modal */}
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md">
                            <Camera className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                                <span>Escanear Tarima</span>
                                <span className="text-[10px] bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                                    QR / Barcode
                                </span>
                            </h3>
                            <p className="text-[11px] text-indigo-100 font-medium">
                                Apunta la cámara a la etiqueta de la tarima o usa lector físico
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                        title="Cerrar escáner"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Contenido Central: Visor de Cámara */}
                <div className="p-6 overflow-y-auto space-y-4 flex-1">
                    
                    {/* Viewport del Escáner */}
                    <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square flex items-center justify-center border-2 border-indigo-100 shadow-inner">
                        <div id="production-tarima-qr-reader" className="w-full h-full object-cover" />

                        {/* Línea animada de escaneo si está activo */}
                        {isScanning && !cameraError && (
                            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 pointer-events-none">
                                <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
                                <div className="absolute -top-3 left-0 right-0 text-center">
                                    <span className="bg-slate-900/80 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 backdrop-blur-sm">
                                        Escaneando código...
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Banner de error de cámara */}
                        {cameraError && (
                            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                                <AlertTriangle className="w-10 h-10 text-amber-400" />
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-slate-200">Cámara no disponible</div>
                                    <div className="text-[11px] text-slate-400 max-w-xs">{cameraError}</div>
                                </div>
                                <div className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl">
                                    Puedes escanear con tu pistola USB o ingresar el código abajo
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botón para cambiar cámara (frontal/trasera) si no hay error */}
                    {!cameraError && (
                        <div className="flex items-center justify-between text-xs px-1">
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium text-[11px]">
                                <QrCode className="w-4 h-4 text-indigo-600" />
                                <span>Cámara {facingMode === 'environment' ? 'Trasera' : 'Frontal'} activa</span>
                            </div>
                            <button
                                type="button"
                                onClick={toggleCameraFacing}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-200"
                            >
                                <RefreshCcw className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Cambiar Cámara</span>
                            </button>
                        </div>
                    )}

                    {/* Formulario de Entrada Manual / Pistola Lectora */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                            <Barcode className="w-4 h-4 text-indigo-600" />
                            <span>Lector de Código de Barras / Entrada Manual</span>
                        </label>
                        <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                            <input
                                ref={manualInputRef}
                                type="text"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                placeholder="Ej. TAR-LOTE-AV-0910-01 o escanea con pistola..."
                                className="flex-1 bg-slate-50 border border-slate-300 focus:border-indigo-600 focus:bg-white rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                            />
                            <button
                                type="submit"
                                disabled={!manualCode.trim()}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                            >
                                <Search className="w-3.5 h-3.5" />
                                <span>Buscar</span>
                            </button>
                        </form>
                        <p className="text-[10px] text-slate-400 font-medium">
                            Tip: Si usas lector de mano USB o Bluetooth, apunta a la etiqueta y el código se cargará al presionar el gatillo.
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                        Identificación automática de Lote & Tarima
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all"
                    >
                        Cerrar
                    </button>
                </div>

            </div>
        </div>
    );
}
