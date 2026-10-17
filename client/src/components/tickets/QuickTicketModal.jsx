import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Ticket, Camera, Upload, Trash2, X, Send, Sparkles,
    AlertTriangle, HelpCircle, ClipboardList, CheckCircle2, RefreshCw, Pencil
} from 'lucide-react';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { toast } from 'sonner';
import { analyzeDiagnosticRelevance } from '../../utils/ticketDiagnostics';
import { compressTicketCanvas, compressTicketImage, getBase64SizeKb } from '../../utils/ticketImageCompressor';
import ScreenshotAnnotatorModal from './ScreenshotAnnotatorModal';
import TicketDiagnosticsPanel from './TicketDiagnosticsPanel';

const TICKET_TYPES = [
    { id: 'problema', label: 'Problema / Error', icon: AlertTriangle, color: 'text-rose-400 border-rose-500/40 bg-rose-500/10' },
    { id: 'requerimiento', label: 'Requerimiento', icon: ClipboardList, color: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10' },
    { id: 'mejora', label: 'Mejora', icon: Sparkles, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
    { id: 'consulta', label: 'Consulta', icon: HelpCircle, color: 'text-sky-400 border-sky-500/40 bg-sky-500/10' }
];

const PRIORITIES = [
    { id: 'baja', label: 'Baja', badge: 'bg-slate-800 text-slate-300 border-slate-700' },
    { id: 'media', label: 'Media', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
    { id: 'alta', label: 'Alta', badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40' },
    { id: 'urgente', label: 'Urgente', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/50' }
];

function inferModuleFromPath(pathname) {
    if (!pathname || pathname === '/') return 'Dashboard Principal';
    const seg = pathname.split('/').filter(Boolean)[0] || '';
    const map = {
        ventas: 'Ventas y Facturación', compras: 'Compras', inventario: 'Inventario',
        contabilidad: 'Contabilidad', iva: 'Libros de IVA', cxc: 'Cuentas por Cobrar',
        cxp: 'Cuentas por Pagar', 'gas-station': 'Gasolinera', rh: 'Recursos Humanos',
        industrial: 'Huevo Industrial', crm: 'CRM', pozo: 'Control de Pozo',
        restaurante: 'Restaurante', configuracion: 'Configuración', soporte: 'Soporte y Tickets'
    };
    return map[seg] || seg.toUpperCase();
}

const QuickTicketModal = ({ open, onClose, onSuccess, initialSubject = '', initialScreenshot = null }) => {
    const [type, setType] = useState('problema');
    const [priority, setPriority] = useState('media');
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [moduleName, setModuleName] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [annotatingIndex, setAnnotatingIndex] = useState(null);
    const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
    const [isCapturing, setIsCapturing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);
    const subjectInputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setSubject(initialSubject || '');
            setDescription('');
            setType('problema');
            setPriority('media');
            setModuleName(inferModuleFromPath(window.location.pathname));
            setIncludeDiagnostics(true);
            setAnnotatingIndex(null);
            setAttachments(initialScreenshot ? [{ id: `att_${Date.now()}`, dataUrl: initialScreenshot, caption: '', annotated: false }] : []);
            setTimeout(() => subjectInputRef.current?.focus(), 80);
        }
    }, [open, initialSubject, initialScreenshot]);

    const diagnosticsReport = useMemo(() => {
        if (!open) return null;
        return analyzeDiagnosticRelevance({
            currentRoute: typeof window !== 'undefined' ? window.location.pathname : '/',
            moduleName, subject, description, ticketType: type
        });
    }, [open, moduleName, subject, description, type]);

    const addAttachment = useCallback(async (rawSource, label = 'Imagen optimizada adjuntada') => {
        const compressedUrl = await compressTicketImage(rawSource);
        if (!compressedUrl) return;
        setAttachments((prev) => {
            if (prev.length >= 4) {
                toast.warning('Máximo 4 capturas por ticket');
                return prev;
            }
            return [...prev, { id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, dataUrl: compressedUrl, caption: '', annotated: false }];
        });
        toast.success(`${label} (${getBase64SizeKb(compressedUrl)} KB WebP)`);
    }, []);

    const handleCaptureCurrentScreen = useCallback(async () => {
        setIsCapturing(true);
        try {
            await new Promise((r) => setTimeout(r, 180));
            const canvas = await html2canvas(document.body, {
                useCORS: true, allowTaint: true, logging: false,
                scale: Math.min(window.devicePixelRatio || 1, 1.5),
                ignoreElements: (el) => el.getAttribute?.('data-ticket-modal') === 'true'
            });
            await addAttachment(compressTicketCanvas(canvas), 'Captura optimizada lista');
        } catch (err) {
            console.error('Error capturing screen:', err);
            toast.error('No se pudo capturar automáticamente. Usa Ctrl+V o Subir imagen.');
        } finally {
            setIsCapturing(false);
        }
    }, [addAttachment]);

    const handlePaste = useCallback((e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) addAttachment(file, 'Captura pegada y comprimida');
                break;
            }
        }
    }, [addAttachment]);

    const handleFileSelect = (e) => {
        Array.from(e.target.files || []).slice(0, 4).forEach((file) => {
            addAttachment(file, `Imagen "${file.name}" comprimida`);
        });
        e.target.value = '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!subject.trim()) return toast.error('Ingresa un asunto breve para el ticket');
        setSubmitting(true);
        try {
            const payload = {
                type, priority,
                subject: subject.trim(),
                description: description.trim() || subject.trim(),
                module_name: moduleName.trim() || inferModuleFromPath(window.location.pathname),
                page_url: window.location.pathname + window.location.search,
                browser_info: `${navigator.userAgent} | ${window.innerWidth}x${window.innerHeight}`,
                screenshot_base64: attachments[0]?.dataUrl || null,
                attachments: attachments.map((a) => ({ dataUrl: a.dataUrl, caption: a.caption || '', annotated: Boolean(a.annotated) })),
                diagnostics: includeDiagnostics ? diagnosticsReport : null,
                diagnostic_relevance: includeDiagnostics && diagnosticsReport ? diagnosticsReport.relevance : 'sin_errores',
                diagnostic_score: includeDiagnostics && diagnosticsReport ? diagnosticsReport.score : 0
            };
            const { data } = await axios.post('/api/tickets', payload);
            const created = data?.data || data?.ticket;
            toast.success(
                <div className="flex flex-col">
                    <span className="font-bold">Ticket {created?.code || created?.ticket_code} registrado</span>
                    <span className="text-xs opacity-85">Los técnicos recibieron tus capturas y el diagnóstico en Telegram.</span>
                </div>
            );
            if (onSuccess) onSuccess(created);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al crear el ticket de soporte');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open || isCapturing) return null;
    const currentAnnotating = annotatingIndex !== null ? attachments[annotatingIndex] : null;

    return (
        <>
            <div data-ticket-modal="true" onPaste={handlePaste} className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
                <div className="w-full max-w-3xl bg-[#0f172a] border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 my-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-gradient-to-r from-indigo-950/60 via-[#0f172a] to-[#0f172a]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                                <Ticket size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">Centro Inteligente de Tickets</h2>
                                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                        Anotación Visual + Diagnóstico Auto
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400">Adjunta capturas, dibuja flechas o comentarios sobre ellas y adjunta el diagnóstico del navegador.</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 max-h-[84vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {TICKET_TYPES.map((t) => {
                                const Icon = t.icon;
                                const active = type === t.id;
                                return (
                                    <button key={t.id} type="button" onClick={() => setType(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${active ? `${t.color} font-bold shadow-sm` : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'}`}>
                                        <Icon size={15} className="shrink-0" />
                                        <span className="text-[12px] truncate">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Prioridad</label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {PRIORITIES.map((p) => (
                                        <button key={p.id} type="button" onClick={() => setPriority(p.id)} className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold uppercase transition-all cursor-pointer ${priority === p.id ? p.badge : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Módulo / Pantalla</label>
                                <input type="text" value={moduleName} onChange={(e) => setModuleName(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3 py-1.5 text-[13px] font-medium text-white focus:outline-none focus:border-indigo-500" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Asunto del Ticket <span className="text-rose-400">*</span></label>
                            <input ref={subjectInputRef} type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej. No permite guardar factura cuando el cliente tiene retención..." className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3.5 py-2 text-[13px] font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500" />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Explicación / Comentarios Adicionales</label>
                            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escribe un par de líneas explicando qué intentabas hacer o qué necesitas..." className="w-full bg-slate-900/80 border border-slate-700/70 rounded-xl px-3.5 py-2 text-[13px] font-medium text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none" />
                        </div>

                        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Camera size={15} className="text-indigo-400" />
                                    <span className="text-[11px] font-bold text-slate-300 uppercase">Capturas de Pantalla y Trazos ({attachments.length}/4)</span>
                                    {attachments.length > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                            <CheckCircle2 size={11} /> Usa &ldquo;Dibujar / Señalar&rdquo; para marcar la foto
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={handleCaptureCurrentScreen} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold cursor-pointer">
                                        <RefreshCw size={12} /> <span>Capturar Pantalla</span>
                                    </button>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold cursor-pointer">
                                        <Upload size={12} /> <span>Subir Imagen</span>
                                    </button>
                                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                                </div>
                            </div>

                            {attachments.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(Array.isArray(attachments) ? attachments : []).map((att, idx) => (
                                        <div key={att.id || idx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-2 space-y-2">
                                            <div className="relative group rounded-lg overflow-hidden bg-black/50 h-32 flex items-center justify-center">
                                                <img src={att.dataUrl} alt={`Captura ${idx + 1}`} className="max-h-32 w-auto object-contain" />
                                                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-900/85 border border-slate-700 text-[10px] font-mono text-emerald-400">
                                                    WebP · {getBase64SizeKb(att.dataUrl)} KB
                                                </span>
                                                {att.annotated && (
                                                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-indigo-600/90 text-[10px] font-bold text-white shadow">Anotada</span>
                                                )}
                                                <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                                                    <button type="button" onClick={() => setAnnotatingIndex(idx)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-lg cursor-pointer" title="Dibujar flechas, líneas o texto sobre la captura">
                                                        <Pencil size={12} /> Dibujar / Señalar
                                                    </button>
                                                    <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))} className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white shadow-lg cursor-pointer" title="Eliminar captura">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                value={att.caption}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAttachments((prev) => prev.map((item, i) => (i === idx ? { ...item, caption: val } : item)));
                                                }}
                                                placeholder={`Comentario o nota sobre captura #${idx + 1}...`}
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="border border-dashed border-slate-700/80 rounded-xl p-3 text-center text-slate-400 text-xs">
                                    Presiona <strong>&ldquo;Capturar Pantalla&rdquo;</strong>, sube archivos o pega con <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700 font-mono text-[10px]">Ctrl + V</kbd> para adjuntar y rayar tus capturas.
                                </div>
                            )}
                        </div>

                        <TicketDiagnosticsPanel
                            diagnostics={diagnosticsReport}
                            compact={true}
                            includeDiagnostics={includeDiagnostics}
                            onToggleInclude={setIncludeDiagnostics}
                        />

                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer">Cancelar</button>
                            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-50">
                                <Send size={14} /> <span>{submitting ? 'Enviando...' : 'Crear Ticket y Avisar a Técnicos'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <ScreenshotAnnotatorModal
                open={annotatingIndex !== null && Boolean(currentAnnotating)}
                imageSrc={currentAnnotating?.dataUrl}
                initialCaption={currentAnnotating?.caption || ''}
                onClose={() => setAnnotatingIndex(null)}
                onSave={({ dataUrl, caption, annotated }) => {
                    setAttachments((prev) => prev.map((item, i) => (i === annotatingIndex ? { ...item, dataUrl, caption, annotated: item.annotated || annotated } : item)));
                    setAnnotatingIndex(null);
                    toast.success('Anotación visual guardada en la captura');
                }}
            />
        </>
    );
};

export default QuickTicketModal;
