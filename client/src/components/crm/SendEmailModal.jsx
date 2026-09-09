import { useState, useEffect } from 'react';
import { Mail, Send, X, Paperclip, FileText, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function SendEmailModal({ isOpen, onClose, quotation, onSent }) {
    const [to, setTo] = useState('');
    const [cc, setCc] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [includePdf, setIncludePdf] = useState(true);
    const [includeDocx, setIncludeDocx] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (quotation) {
            setTo(quotation.customer_email || '');
            setCc('');
            setSubject(`Cotización Comercial ${quotation.quote_number || ''} - ANDELSA / Eggcelent`);
            setMessage(
                `Estimado(a) ${quotation.customer_name || 'Cliente'}:\n\n` +
                `Es un gusto saludarle. Adjunto le hacemos llegar nuestra cotización comercial formal número ${quotation.quote_number || ''} ` +
                `por un monto total de $${parseFloat(quotation.total || 0).toFixed(2)} USD.\n\n` +
                `Quedamos a su entera disposición para cualquier consulta o coordinación de pedidos.`
            );
            setIncludePdf(true);
            setIncludeDocx(false);
        }
    }, [quotation]);

    if (!isOpen || !quotation) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        if (!to.trim()) {
            toast.error('Ingrese al menos un correo de destinatario.');
            return;
        }

        if (!includePdf && !includeDocx) {
            toast.error('Debe seleccionar al menos un archivo para adjuntar (PDF o Word).');
            return;
        }

        try {
            setSending(true);
            const res = await axios.post(`/api/crm/quotations/${quotation.id}/send-email`, {
                to: to.trim(),
                cc: cc.trim() || undefined,
                subject: subject.trim(),
                message: message.trim(),
                include_pdf: includePdf,
                include_docx: includeDocx
            });

            toast.success(res.data.message || 'Cotización enviada exitosamente por correo.');
            if (onSent) onSent();
            onClose();
        } catch (err) {
            console.error('Error enviando cotización por correo:', err);
            toast.error(err.response?.data?.message || 'Error al enviar el correo electrónico.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                {/* Cabecera */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-sky-600 to-indigo-700 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/15 rounded-xl backdrop-blur-md">
                            <Mail className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-extrabold tracking-tight">
                                Enviar Cotización por Correo
                            </h2>
                            <p className="text-xs text-sky-100 font-medium">
                                {quotation.quote_number} • {quotation.customer_name}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={sending}
                        className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSend} className="p-6 space-y-4">
                    {/* Destinatario (Para) */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Para (Destinatario) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            required
                            placeholder="ejemplo@cliente.com"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            disabled={sending}
                            className="w-full px-3.5 py-2 text-[13px] font-medium rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all disabled:bg-slate-100"
                        />
                    </div>

                    {/* Con Copia (CC) */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Con Copia (CC) <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                        </label>
                        <input
                            type="text"
                            placeholder="gerencia@empresa.com, ventas@andelsa.com.sv"
                            value={cc}
                            onChange={(e) => setCc(e.target.value)}
                            disabled={sending}
                            className="w-full px-3.5 py-2 text-[13px] font-medium rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all disabled:bg-slate-100"
                        />
                    </div>

                    {/* Asunto */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Asunto
                        </label>
                        <input
                            type="text"
                            required
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            disabled={sending}
                            className="w-full px-3.5 py-2 text-[13px] font-medium rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all disabled:bg-slate-100"
                        />
                    </div>

                    {/* Mensaje */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Mensaje Personalizado
                        </label>
                        <textarea
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={sending}
                            className="w-full px-3.5 py-2 text-[13px] font-medium rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all resize-none disabled:bg-slate-100"
                        />
                    </div>

                    {/* Opciones de Archivos Adjuntos */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <Paperclip className="w-4 h-4 text-slate-500" />
                            <span>Documentos a Adjuntar:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {/* PDF Oficial */}
                            <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                                includePdf ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900' : 'bg-white border-slate-200 text-slate-600'
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={includePdf}
                                    onChange={(e) => setIncludePdf(e.target.checked)}
                                    disabled={sending}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <div className="flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <span>PDF Oficial</span>
                                </div>
                            </label>

                            {/* Word Editable */}
                            <label className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                                includeDocx ? 'bg-blue-50/70 border-blue-200 text-blue-900' : 'bg-white border-slate-200 text-slate-600'
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={includeDocx}
                                    onChange={(e) => setIncludeDocx(e.target.checked)}
                                    disabled={sending}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <div className="flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                    <span>Word Editable (.docx)</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={sending}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={sending}
                            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-xl shadow-md shadow-sky-200 transition-all"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Enviando Correo...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Enviar Cotización</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
