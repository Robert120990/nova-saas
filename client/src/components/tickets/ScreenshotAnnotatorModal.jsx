import { useState, useRef, useEffect, useCallback } from 'react';
import {
    X, Pencil, MoveUpRight, Square, Type, Highlighter,
    Undo2, RotateCcw, Check, MessageSquarePlus
} from 'lucide-react';
import { compressTicketCanvas } from '../../utils/ticketImageCompressor';

const COLORS = [
    { id: '#ef4444', label: 'Rojo' },
    { id: '#facc15', label: 'Amarillo' },
    { id: '#10b981', label: 'Verde' },
    { id: '#38bdf8', label: 'Azul' },
    { id: '#d946ef', label: 'Magenta' }
];

const TOOLS = [
    { id: 'arrow', label: 'Flecha', icon: MoveUpRight },
    { id: 'pen', label: 'Trazo libre', icon: Pencil },
    { id: 'rect', label: 'Recuadro', icon: Square },
    { id: 'highlight', label: 'Resaltar', icon: Highlighter },
    { id: 'text', label: 'Escribir texto', icon: Type }
];

function drawSingleShape(ctx, s) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (s.type === 'pen' || s.type === 'highlight') {
        ctx.globalAlpha = s.type === 'highlight' ? 0.35 : 1;
        ctx.lineWidth = s.type === 'highlight' ? s.strokeWidth * 4.5 : s.strokeWidth;
        const pts = s.points || [];
        if (pts.length > 0) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            pts.forEach((p) => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        }
    } else if (s.type === 'rect') {
        ctx.lineWidth = s.strokeWidth;
        ctx.strokeRect(s.startX, s.startY, s.endX - s.startX, s.endY - s.startY);
    } else if (s.type === 'arrow') {
        ctx.lineWidth = s.strokeWidth;
        const headLen = Math.max(16, s.strokeWidth * 4);
        const angle = Math.atan2(s.endY - s.startY, s.endX - s.startX);

        ctx.beginPath();
        ctx.moveTo(s.startX, s.startY);
        ctx.lineTo(s.endX, s.endY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(s.endX, s.endY);
        ctx.lineTo(s.endX - headLen * Math.cos(angle - Math.PI / 6), s.endY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(s.endX - headLen * Math.cos(angle + Math.PI / 6), s.endY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
    } else if (s.type === 'text' && s.text) {
        const fontSize = Math.max(18, s.strokeWidth * 5);
        ctx.font = `bold ${fontSize}px sans-serif`;
        const metrics = ctx.measureText(s.text);
        const padX = 10;
        const padY = 6;
        const boxW = metrics.width + padX * 2;
        const boxH = fontSize + padY * 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(s.x, s.y - fontSize, boxW, boxH);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = s.color;
        ctx.strokeRect(s.x, s.y - fontSize, boxW, boxH);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(s.text, s.x + padX, s.y + 2);
    }
    ctx.restore();
}

export default function ScreenshotAnnotatorModal({ open, imageSrc, initialCaption = '', onClose, onSave }) {
    const canvasRef = useRef(null);
    const baseImageRef = useRef(null);

    const [tool, setTool] = useState('arrow');
    const [color, setColor] = useState('#ef4444');
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [shapes, setShapes] = useState([]);
    const [draftShape, setDraftShape] = useState(null);
    const [textPrompt, setTextPrompt] = useState(null);
    const [caption, setCaption] = useState(initialCaption || '');

    const renderCanvas = useCallback((img, shapeList, currentDraft) => {
        const canvas = canvasRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const scaleFactor = Math.max(1, canvas.width / 1000);
        shapeList.forEach((s) => drawSingleShape(ctx, { ...s, strokeWidth: (s.strokeWidth || 4) * scaleFactor }));
        if (currentDraft) {
            drawSingleShape(ctx, { ...currentDraft, strokeWidth: (currentDraft.strokeWidth || 4) * scaleFactor });
        }
    }, []);

    useEffect(() => {
        if (!open || !imageSrc) return;
        setShapes([]);
        setDraftShape(null);
        setTextPrompt(null);
        setCaption(initialCaption || '');

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            baseImageRef.current = img;
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = img.naturalWidth || img.width || 1280;
                canvas.height = img.naturalHeight || img.height || 720;
                renderCanvas(img, [], null);
            }
        };
        img.src = imageSrc;
    }, [open, imageSrc, initialCaption, renderCanvas]);

    useEffect(() => {
        if (baseImageRef.current) {
            renderCanvas(baseImageRef.current, shapes, draftShape);
        }
    }, [shapes, draftShape, renderCanvas]);

    if (!open || !imageSrc) return null;

    const getCanvasCoords = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches?.[0]?.clientX ?? e.clientX;
        const clientY = e.touches?.[0]?.clientY ?? e.clientY;
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const handlePointerDown = (e) => {
        if (textPrompt) return;
        const pos = getCanvasCoords(e);
        if (tool === 'text') {
            setTextPrompt({ x: pos.x, y: pos.y, value: '' });
            return;
        }
        if (tool === 'pen' || tool === 'highlight') {
            setDraftShape({ type: tool, color, strokeWidth, points: [pos] });
        } else {
            setDraftShape({ type: tool, color, strokeWidth, startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
        }
    };

    const handlePointerMove = (e) => {
        if (!draftShape) return;
        const pos = getCanvasCoords(e);
        if (draftShape.type === 'pen' || draftShape.type === 'highlight') {
            setDraftShape((prev) => ({ ...prev, points: [...prev.points, pos] }));
        } else {
            setDraftShape((prev) => ({ ...prev, endX: pos.x, endY: pos.y }));
        }
    };

    const handlePointerUp = () => {
        if (!draftShape) return;
        setShapes((prev) => [...prev, draftShape]);
        setDraftShape(null);
    };

    const confirmTextPrompt = () => {
        if (textPrompt?.value.trim()) {
            setShapes((prev) => [...prev, { type: 'text', color, strokeWidth, x: textPrompt.x, y: textPrompt.y, text: textPrompt.value.trim() }]);
        }
        setTextPrompt(null);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        const exportedUrl = canvas ? compressTicketCanvas(canvas) : imageSrc;
        onSave({ dataUrl: exportedUrl, caption: caption.trim(), annotated: shapes.length > 0 });
    };

    return (
        <div data-ticket-modal="true" className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden text-white">
                <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">Estudio de Anotación Visual</span>
                        <span className="hidden sm:inline text-[11px] text-slate-400">· Dibuja flechas, líneas o escribe sobre la imagen para señalar el detalle</span>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {TOOLS.map((t) => {
                            const Icon = t.icon;
                            const active = tool === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTool(t.id)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {t.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-xl">
                            {COLORS.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setColor(c.id)}
                                    title={c.label}
                                    className={`w-5 h-5 rounded-full transition-transform ${color === c.id ? 'scale-125 ring-2 ring-white' : 'opacity-75 hover:opacity-100'}`}
                                    style={{ backgroundColor: c.id }}
                                />
                            ))}
                        </div>

                        <select
                            value={strokeWidth}
                            onChange={(e) => setStrokeWidth(Number(e.target.value))}
                            className="bg-slate-800 text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-700"
                        >
                            <option value={3}>Grosor Fino</option>
                            <option value={5}>Grosor Medio</option>
                            <option value={8}>Grosor Grueso</option>
                        </select>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={shapes.length === 0}
                                onClick={() => setShapes((prev) => prev.slice(0, -1))}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-200"
                                title="Deshacer último trazo"
                            >
                                <Undo2 className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">Deshacer</span>
                            </button>
                            <button
                                type="button"
                                disabled={shapes.length === 0}
                                onClick={() => setShapes([])}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 disabled:opacity-40 text-xs font-bold text-slate-200"
                                title="Limpiar todos los trazos"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="relative flex-1 overflow-auto bg-slate-950/90 flex items-center justify-center p-3 select-none">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseLeave={handlePointerUp}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                        className="max-w-full max-h-[58vh] object-contain rounded-lg border border-slate-700 shadow-xl cursor-crosshair touch-none"
                    />

                    {textPrompt && (
                        <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center p-4">
                            <div className="bg-slate-900 border border-indigo-500 rounded-2xl p-4 w-full max-w-md shadow-2xl space-y-3">
                                <label className="block text-[11px] font-bold text-indigo-300 uppercase">Texto a estampar sobre la captura</label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={textPrompt.value}
                                    onChange={(e) => setTextPrompt({ ...textPrompt, value: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); confirmTextPrompt(); }
                                        else if (e.key === 'Escape') setTextPrompt(null);
                                    }}
                                    placeholder="Ej: Aquí da error al guardar..."
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <div className="flex justify-end gap-2">
                                    <button type="button" onClick={() => setTextPrompt(null)} className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800">Cancelar</button>
                                    <button type="button" onClick={confirmTextPrompt} className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white">Agregar texto</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1 flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
                        <MessageSquarePlus className="w-4 h-4 text-indigo-400 shrink-0" />
                        <input
                            type="text"
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Comentario o explicación breve para esta imagen (opcional)..."
                            className="w-full bg-transparent text-[13px] font-medium text-white placeholder-slate-400 focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800">Cancelar</button>
                        <button type="button" onClick={handleSave} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md">
                            <Check className="w-4 h-4" /> Guardar Anotación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
