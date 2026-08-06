import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    Camera, 
    CheckCircle2, 
    XCircle, 
    Package, 
    Hash,
    List,
    Clock,
    Pause,
    Play
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const ScanInventory = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    
    const [session, setSession] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [lastScan, setLastScan] = useState(null);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [scannedProduct, setScannedProduct] = useState(null);
    const [quantity, setQuantity] = useState('');
    const [ignoreCheckDigit, setIgnoreCheckDigit] = useState(() => 
        localStorage.getItem('scan_ignore_check_digit') === 'true'
    );
    const [scanner, setScanner] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const quantityInputRef = useRef(null);
    const manualInputRef = useRef(null);
    const scannerStartedRef = useRef(false);
    const [recentScans, setRecentScans] = useState([]);
    const [paused, setPaused] = useState(false);

    // Cargar sesión y productos permitidos
    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await axios.get(`/api/inventory/scan/${token}`);
                const data = res.data;
                
                if (!data.session) {
                    setError('Sesión de escaneo no encontrada');
                    return;
                }
                
                // Verificar estado del conteo padre
                if (data.inventory_status !== 'PENDIENTE') {
                    setError('Este conteo ya fue aplicado. El QR ha expirado.');
                    return;
                }

                setSession(data.session);
                setProducts(data.products || []);
                if (data.scans) {
                    setRecentScans(data.scans.map(s => ({
                        nombre: s.nombre,
                        codigo: s.codigo,
                        cantidad: s.cantidad_fisica,
                        hora: s.created_at
                    })));
                }
            } catch (err) {
                console.error('Error loading scan session:', err);
                if (err.response?.status === 410) {
                    setError(err.response.data.message || 'Esta sesión ha expirado');
                } else if (err.response?.status === 404) {
                    setError('Sesión de escaneo no encontrada');
                } else {
                    setError('Error al cargar la sesión de escaneo');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchSession();
    }, [token]);

    // Iniciar escáner
    useEffect(() => {
        if (!session || scannerStartedRef.current) return;
        scannerStartedRef.current = true;

        let html5Qrcode;
        try {
            html5Qrcode = new Html5Qrcode('qr-reader');
        } catch (err) {
            console.error('Html5Qrcode constructor failed:', err);
            setCameraError(`Error al inicializar escáner: ${err?.message || JSON.stringify(err) || 'desconocido'}`);
            return;
        }
        setScanner(html5Qrcode);

        const tryCamera = async (facingMode) => {
            setScanning(true);
            await html5Qrcode.start(
                { facingMode },
                {
                    fps: 5,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    handleScanResult(decodedText);
                },
                () => {}
            );
        };

        const startScanner = async () => {
            try {
                setCameraError(null);
                await tryCamera('environment');
            } catch (err) {
                if (err.name === 'OverconstrainedError') {
                    try {
                        await tryCamera('user');
                        return;
                    } catch (err2) {
                        console.error('Both cameras failed:', err2);
                    }
                }
                console.error('Error starting scanner:', err);
                const errMsg = err?.message || err?.name || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Error desconocido';
                if (err.name === 'NotAllowedError') {
                    setCameraError('Permiso de cámara denegado. Active el permiso en su navegador o ingrese el código manualmente.');
                } else if (err.name === 'NotFoundError') {
                    setCameraError('No se encontró ninguna cámara en este dispositivo.');
                } else if (err.name === 'NotReadableError') {
                    setCameraError('La cámara está siendo usada por otra aplicación.');
                } else if (errMsg.toLowerCase().includes('stream') || errMsg.toLowerCase().includes('not supported')) {
                    setCameraError('Cámara no disponible en este navegador/dispositivo. Use el campo de texto para ingresar el código manualmente.');
                } else {
                    setCameraError(`Error de cámara: ${errMsg}`);
                }
                setScanning(false);
            }
        };

        startScanner();

        return () => {
            if (html5Qrcode && html5Qrcode.isScanning) {
                html5Qrcode.stop().catch(() => {});
            }
        };
    }, [session]);

    // Auto-focus manual input when camera fails
    useEffect(() => {
        if (cameraError && manualInputRef.current) {
            manualInputRef.current.focus();
        }
    }, [cameraError]);

    const handleScanResult = async (code) => {
        if (!products.length) return;

        // Evitar escaneos duplicados rápidos
        if (lastScan === code) return;
        setLastScan(code);

        // Pausar escáner si está activo
        if (scanner && scanning) {
            await scanner.pause();
            setScanning(false);
        }

        // Buscar producto
        let searchCode = code.trim();
        if (ignoreCheckDigit && searchCode.length > 1) {
            searchCode = searchCode.slice(0, -1);
        }

        const product = products.find(p => 
            p.codigo === searchCode
        );

        if (!product) {
            toast.error(`Producto no encontrado en este conteo: ${code}`);
            if (scanner) resumeScanner();
            return;
        }

        setScannedProduct(product);
        setQuantity('');
        setShowQuantityModal(true);
        
        // Focus en input después de abrir modal
        setTimeout(() => quantityInputRef.current?.focus(), 100);
    };

    const resumeScanner = async () => {
        if (paused) return;
        if (scanner && !scanning) {
            try {
                await scanner.resume();
                setScanning(true);
                setPaused(false);
            } catch (err) {
                console.error('Error resuming scanner:', err);
            }
        }
        setLastScan(null);
    };

    const togglePause = async () => {
        if (!scanner) return;
        try {
            if (paused) {
                await scanner.resume();
                setScanning(true);
                setPaused(false);
            } else {
                await scanner.pause();
                setScanning(false);
                setPaused(true);
            }
        } catch (err) {
            console.error('Error toggling pause:', err);
        }
    };

    const handleSaveScan = async () => {
        if (!scannedProduct || !quantity) {
            toast.error('Ingrese una cantidad');
            return;
        }

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty < 0) {
            toast.error('Cantidad inválida');
            return;
        }

        try {
            const res = await axios.post(`/api/inventory/scan/${token}/submit`, {
                codigo_barras: scannedProduct.codigo,
                cantidad_fisica: qty,
                escaneado_por_nombre: 'Escáner Móvil'
            });

            const scanData = res.data;
            setRecentScans(prev => [{
                nombre: scanData.product?.nombre || scannedProduct.nombre,
                codigo: scanData.product?.codigo || scannedProduct.codigo,
                cantidad: scanData.cantidad_fisica ?? qty,
                hora: scanData.created_at || new Date()
            }, ...prev].slice(0, 10));

            toast.success(`Guardado: ${scanData.product?.nombre || scannedProduct.nombre} - ${qty} und`);
            setShowQuantityModal(false);
            setScannedProduct(null);
            setQuantity('');
            resumeScanner();
        } catch (err) {
            console.error('Error saving scan:', err);
            const msg = err.response?.data?.message || 'Error al guardar escaneo';
            toast.error(msg);
            resumeScanner();
        }
    };

    const handleCloseModal = () => {
        setShowQuantityModal(false);
        setScannedProduct(null);
        setQuantity('');
        resumeScanner();
    };

    useEffect(() => {
        if (showQuantityModal) {
            // Prevenir scroll en body
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [showQuantityModal]);

    const getRelativeTime = (date) => {
        const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
        if (diff < 10) return 'ahora';
        if (diff < 60) return `hace ${diff} seg`;
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
        return `hace ${Math.floor(diff / 86400)} d`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-600 font-medium">Cargando sesión de escaneo...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <XCircle size={64} className="mx-auto text-rose-500 mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">No se puede escanear</h2>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <button 
                        onClick={() => navigate('/login')}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header mejorado */}
            <header className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-4 py-4 sticky top-0 z-10 shadow-lg shadow-indigo-900/20">
                <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-sm font-bold text-white truncate">
                                {session.nombre_sesion}
                            </h1>
                            <p className="text-xs text-indigo-200 truncate">
                                Conteo: {session.physical_inventory_id ? `INV-${String(session.physical_inventory_id).padStart(5, '0')}` : 'N/A'}
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-xs font-semibold text-white shrink-0">
                            <Package size={14} />
                            {products.length}
                        </span>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={ignoreCheckDigit}
                                onClick={() => {
                                    const val = !ignoreCheckDigit;
                                    setIgnoreCheckDigit(val);
                                    localStorage.setItem('scan_ignore_check_digit', val);
                                }}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                                    ignoreCheckDigit ? 'bg-white' : 'bg-white/30'
                                }`}
                            >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-indigo-700 shadow-sm transition-transform duration-200 ${
                                    ignoreCheckDigit ? 'translate-x-[18px]' : 'translate-x-[3px]'
                                }`} />
                            </button>
                            <span className="text-xs font-medium text-white/80">Ignorar dígito verificador</span>
                        </label>
                    </div>
                </div>
            </header>

            {/* Área de escaneo */}
            <main className="flex-1 flex flex-col px-4 py-6">
                <div className="w-full max-w-md mx-auto flex flex-col gap-5">
                    {/* Cámara con marco decorativo */}
                    <div className="relative w-full aspect-square" style={{ minHeight: '320px', maxHeight: '480px' }}>
                        <div 
                            id="qr-reader" 
                            className="w-full h-full bg-slate-900 rounded-xl overflow-hidden relative"
                        />

                        {cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white z-20 p-4 rounded-xl">
                                <Camera size={48} className="mb-3 opacity-50" />
                                <p className="text-center font-medium mb-2">{cameraError}</p>
                                <button 
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    Reintentar
                                </button>
                            </div>
                        )}

                        {!cameraError && (
                            <>
                                {/* Botón pausa/reanudar */}
                                <button
                                    onClick={togglePause}
                                    className="absolute top-2 right-2 z-20 w-9 h-9 bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-all active:scale-90"
                                    title={paused ? 'Reanudar cámara' : 'Pausar cámara'}
                                >
                                    {paused ? <Play size={16} /> : <Pause size={16} />}
                                </button>

                                {/* Overlay de pausa */}
                                {paused && (
                                    <div className="absolute inset-0 bg-slate-900/85 flex flex-col items-center justify-center rounded-xl z-20">
                                        <Camera size={40} className="text-white/40 mb-2" />
                                        <p className="text-white/70 text-sm font-semibold">Cámara pausada</p>
                                        <p className="text-white/40 text-xs mt-1">Presione ▶ para reanudar</p>
                                    </div>
                                )}

                                {/* Esquinas decorativas */}
                                <div className="absolute inset-0 pointer-events-none z-10">
                                    <div className="absolute top-0 left-0 w-10 h-[3px] bg-indigo-400 rounded-r-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                    <div className="absolute top-0 left-0 w-[3px] h-10 bg-indigo-400 rounded-b-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                    <div className="absolute top-0 right-0 w-10 h-[3px] bg-indigo-400 rounded-l-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                    <div className="absolute top-0 right-0 w-[3px] h-10 bg-indigo-400 rounded-b-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                    <div className="absolute bottom-0 left-0 w-10 h-[3px] bg-indigo-400 rounded-r-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                    <div className="absolute bottom-0 left-0 w-[3px] h-10 bg-indigo-400 rounded-t-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                    <div className="absolute bottom-0 right-0 w-10 h-[3px] bg-indigo-400 rounded-l-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                    <div className="absolute bottom-0 right-0 w-[3px] h-10 bg-indigo-400 rounded-t-full" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
                                </div>
                                {/* Línea de escaneo animada */}
                                {!paused && <div className="scan-line absolute left-3 right-3 h-[2px] bg-gradient-to-r from-transparent via-indigo-300 to-transparent opacity-90 pointer-events-none z-10" />}
                            </>
                        )}
                    </div>

                    <div className="text-center">
                        <p className="text-slate-500 text-sm font-medium">
                            {cameraError ? 'Ingrese el código manualmente' : paused ? 'Cámara pausada' : 'Apunte la cámara al código de barras'}
                        </p>
                    </div>

                    {/* Manual barcode input */}
                    <div>
                        <div className="flex gap-2">
                            <input
                                ref={manualInputRef}
                                type="text"
                                id="manual-barcode"
                                placeholder={cameraError ? 'Ingrese el código aquí y presione Enter...' : 'Escanee o ingrese código...'}
                                className={`flex-1 px-4 py-3 border rounded-xl text-sm font-bold outline-none transition-all duration-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 ${cameraError ? 'border-indigo-300 bg-indigo-50 py-4 text-base' : 'border-slate-200 bg-white'}`}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.target.value.trim()) {
                                        handleScanResult(e.target.value.trim());
                                        e.target.value = '';
                                    }
                                }}
                                autoFocus={!cameraError}
                            />
                        </div>
                    </div>

                    {/* Últimos escaneos */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <List size={16} className="text-indigo-500" />
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Últimos escaneos</h3>
                            {recentScans.length > 0 && (
                                <span className="text-xs text-slate-400 font-medium">({recentScans.length})</span>
                            )}
                        </div>
                        
                        {recentScans.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <Camera size={28} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-xs text-slate-400">Aún no hay escaneos registrados</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5 max-h-[260px] overflow-y-auto -mx-1 px-1">
                                {recentScans.map((scan, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                                                <CheckCircle2 size={15} className="text-emerald-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-slate-800 truncate leading-snug">{scan.nombre}</p>
                                                <p className="text-[10px] font-mono text-slate-400 leading-snug">#{scan.codigo}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 ml-3">
                                            <span className="text-sm font-bold text-indigo-600 tabular-nums">{Number(scan.cantidad).toFixed(2)}</span>
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                <Clock size={10} />
                                                {getRelativeTime(scan.hora)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Modal cantidad */}
            {showQuantityModal && scannedProduct && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in slide-in-from-bottom-2 sm:zoom-in-95">
                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                                        <Package size={24} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">Producto encontrado</p>
                                        <p className="font-bold text-slate-900 truncate max-w-[200px]">{scannedProduct.nombre}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                                    <Hash size={16} className="text-slate-400" />
                                    <span className="font-mono font-bold text-slate-700">#{scannedProduct.codigo}</span>
                                </div>
                                
                                <label className="block text-sm font-bold text-slate-700 mb-2">Cantidad Física</label>
                                <input
                                    ref={quantityInputRef}
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveScan()}
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    autoFocus
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-bold text-center text-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                                    inputMode="decimal"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleCloseModal}
                                    className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveScan}
                                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors active:scale-95"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast container */}
            <div id="toast-container" className="fixed bottom-4 right-4 z-50" />

            {/* Styles para animación de escaneo */}
            <style>{`
                @keyframes scan-line-move {
                    0%, 100% { top: 3%; }
                    50% { top: 94%; }
                }
                .scan-line {
                    animation: scan-line-move 2.5s ease-in-out infinite;
                    filter: drop-shadow(0 0 6px rgba(99,102,241,0.6));
                }
            `}</style>
        </div>
    );
};

export default ScanInventory;