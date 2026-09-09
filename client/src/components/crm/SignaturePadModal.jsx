import { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCcw, Upload, PenTool } from 'lucide-react';
import { toast } from 'sonner';

export default function SignaturePadModal({ isOpen, onClose, onSave, initialSignature = null }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [saveAsDefault, setSaveAsDefault] = useState(true);
    const [title, setTitle] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setHasDrawn(false);

        // Configurar canvas después de que el DOM se monte
        const timer = setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#0f172a'; // Azul oscuro / slate profundo
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Limpiar fondo blanco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Si ya hay firma inicial, cargarla
            if (initialSignature && initialSignature.startsWith('data:image')) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    setHasDrawn(true);
                };
                img.src = initialSignature;
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [isOpen, initialSignature]);

    if (!isOpen) return null;

    const getPos = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDrawing = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Por favor selecciona una imagen válida.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Dibujar centrada y ajustada
                const hRatio = canvas.width / img.width;
                const vRatio = canvas.height / img.height;
                const ratio = Math.min(hRatio, vRatio, 1);
                const centerShiftX = (canvas.width - img.width * ratio) / 2;
                const centerShiftY = (canvas.height - img.height * ratio) / 2;
                ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
                setHasDrawn(true);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleConfirm = () => {
        if (!hasDrawn) {
            toast.warning('Por favor dibuja o sube una firma antes de guardar.');
            return;
        }
        const canvas = canvasRef.current;
        const dataUrl = canvas.toDataURL('image/png');
        onSave({
            signatureData: dataUrl,
            saveAsDefault,
            title,
            phone
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Cabecera */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                            <PenTool className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Firma Electrónica</h3>
                            <p className="text-xs text-slate-500">Dibuja tu firma con el ratón o pantalla táctil</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Contenedor del Canvas */}
                <div className="p-5 space-y-4">
                    <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
                        <canvas
                            ref={canvasRef}
                            width={460}
                            height={180}
                            className="w-full h-[180px] cursor-crosshair touch-none"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />

                        {/* Guía inferior para firmar */}
                        <div className="absolute bottom-4 left-6 right-6 border-b border-slate-300 pointer-events-none flex justify-between items-center pb-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Línea de firma</span>
                            <span className="text-[10px] text-slate-400">Firma aquí</span>
                        </div>
                    </div>

                    {/* Botones de acción del lienzo */}
                    <div className="flex items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={clearCanvas}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Limpiar lienzo
                        </button>

                        <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            Subir imagen
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </label>
                    </div>

                    {/* Guardar en perfil */}
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={saveAsDefault}
                                onChange={(e) => setSaveAsDefault(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-medium text-slate-700">
                                Guardar como mi firma predeterminada en mi cuenta
                            </span>
                        </label>

                        {saveAsDefault && (
                            <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Cargo / Puesto
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Ejecutivo Comercial"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full text-[13px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                        Teléfono de contacto
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: (503) 7069-5335"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full text-[13px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pie del Modal */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow transition-all"
                    >
                        <Check className="w-4 h-4" />
                        Confirmar y Usar Firma
                    </button>
                </div>
            </div>
        </div>
    );
}
