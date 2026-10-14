import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, TrendingUp, Package, Users, DollarSign, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

/**
 * Novas AI Assistant Component
 * Floating chat assistant powered by OpenAI
 */
const AIAssistant = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', content: `¡Hola ${user?.nombre || 'Usuario'}! Soy Novas AI, tu asistente de inteligencia de negocios. ¿En qué puedo ayudarte hoy?` }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const userPerms = (() => {
        if (!user?.permissions) return [];
        if (Array.isArray(user.permissions)) return user.permissions;
        try { return JSON.parse(user.permissions); } catch { return []; }
    })();
    const hasPermission = user?.role === 'SuperAdmin' || userPerms.includes('ai_assistant_access');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    if (!hasPermission) return null;

    const handleSend = async (text = input) => {
        if (!text.trim()) return;

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            const res = await axios.post('/api/ai/chat', { 
                messages: newMessages.slice(-6) // Send last context
            });

            const reply = res.data.message;
            setMessages(prev => [...prev, reply]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg = error.response?.data?.message || 'Hubo un error al procesar tu consulta. Por favor intenta de nuevo.';
            setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        } finally {
            setIsLoading(false);
        }
    };    const suggestions = [
        { label: '¿Cómo está la salud del servidor?', icon: <Sparkles size={12} /> },
        { label: '¿Cuánto vendí este mes?', icon: <DollarSign size={12} /> },
        { label: '¿Qué productos tienen stock bajo?', icon: <Package size={12} /> },
        { label: '¿Quiénes me deben más dinero?', icon: <Users size={12} /> },
        { label: '¿Cuáles son los niveles de tanques?', icon: <TrendingUp size={12} /> },
        { label: 'Generar partida de ventas de ayer', icon: <MessageSquare size={12} /> },
    ];

    const AGENT_INFO = {
        accounting: { name: 'Contador CPA', icon: '⚖️', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
        dte: { name: 'Fiscal & DTE', icon: '📑', bg: 'bg-blue-50 text-blue-800 border-blue-200' },
        sales: { name: 'Comercial & Ventas', icon: '📈', bg: 'bg-purple-50 text-purple-800 border-purple-200' },
        gas: { name: 'Combustibles & Pistas', icon: '⛽', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
        inventory: { name: 'Inventarios & Kardex', icon: '📦', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
        tech: { name: 'SysAdmin & Servidor', icon: '🛠️', bg: 'bg-rose-50 text-rose-800 border-rose-200' },
        operations: { name: 'Operaciones', icon: '⚙️', bg: 'bg-slate-100 text-slate-800 border-slate-300' },
        supervisor: { name: 'Supervisor Novas AI', icon: '🤖', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' }
    };

    const getAgentBadge = (m) => {
        if (m.agent_code && AGENT_INFO[m.agent_code]) {
            return AGENT_INFO[m.agent_code];
        }
        const text = (m.content || '').toLowerCase();
        if (text.includes('tanque') || text.includes('galon') || text.includes('combustible') || text.includes('pista')) {
            return AGENT_INFO.gas;
        }
        if (text.includes('partida') || text.includes('asiento') || text.includes('debe') || text.includes('haber') || text.includes('catalogo')) {
            return AGENT_INFO.accounting;
        }
        if (text.includes('dte') || text.includes('hacienda') || text.includes('svfe') || text.includes('contingencia')) {
            return AGENT_INFO.dte;
        }
        if (text.includes('ram') || text.includes('cpu') || text.includes('disco') || text.includes('uptime') || text.includes('servidor') || text.includes('latencia')) {
            return AGENT_INFO.tech;
        }
        if (text.includes('kardex') || text.includes('stock') || text.includes('existencia')) {
            return AGENT_INFO.inventory;
        }
        if (text.includes('venta') || text.includes('cliente') || text.includes('factura')) {
            return AGENT_INFO.sales;
        }
        return AGENT_INFO.supervisor;
    };

    return (
        <div className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-end italic">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[350px] md:w-[400px] h-[520px] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header */}
                    <div className="bg-slate-900 p-6 text-white flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Sparkles size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm tracking-widest uppercase">Novas AI</h3>
                                <div className="flex items-center gap-1.5 opacity-80">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-300">Red Multi-Agente Autónoma</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                        {messages.map((m, i) => {
                            const badge = m.role === 'user' ? null : getAgentBadge(m);
                            return (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[88%] px-4 py-3 rounded-3xl text-[13px] leading-relaxed shadow-sm ${
                                        m.role === 'user' 
                                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                                            : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200'
                                    }`}>
                                        {m.role === 'user' ? (
                                            m.content
                                        ) : (
                                            <>
                                                {badge && (
                                                    <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-200/70">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${badge.bg}`}>
                                                            <span>{badge.icon}</span>
                                                            <span>{badge.name}</span>
                                                        </span>
                                                    </div>
                                                )}
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        table: ({ children }) => (
                                                            <div className="overflow-x-auto my-2">
                                                                <table className="w-full text-[11px] border-collapse">{children}</table>
                                                            </div>
                                                        ),
                                                        thead: ({ children }) => (
                                                            <thead className="bg-slate-200/70">{children}</thead>
                                                        ),
                                                        th: ({ children }) => (
                                                            <th className="px-2 py-1.5 text-left font-bold text-slate-600 uppercase text-[10px] border-b border-slate-300">{children}</th>
                                                        ),
                                                        td: ({ children }) => (
                                                            <td className="px-2 py-1 border-b border-slate-100 text-slate-700">{children}</td>
                                                        ),
                                                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                                        strong: ({ children }) => <strong className="font-bold text-slate-800">{children}</strong>,
                                                    }}
                                                >
                                                    {m.content}
                                                </ReactMarkdown>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 px-4 py-3 rounded-3xl rounded-tl-none border border-slate-200 flex gap-1">
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div>
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestions Area */}
                    {showSuggestions && (
                        <div className="px-6 pb-3 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {suggestions.map((s, i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleSend(s.label)}
                                    className="px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-full text-[10px] font-bold uppercase text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-1"
                                >
                                    {s.icon} {s.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input Area */}
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                        <button 
                            type="button"
                            onClick={() => setShowSuggestions(!showSuggestions)}
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                                showSuggestions 
                                    ? 'bg-indigo-50 text-indigo-600 shadow-inner' 
                                    : 'bg-white text-slate-400 border border-slate-200 hover:text-indigo-500'
                            }`}
                            title={showSuggestions ? "Ocultar sugerencias" : "Mostrar sugerencias"}
                        >
                            <Sparkles size={16} className={showSuggestions ? "animate-pulse" : ""} />
                        </button>
                        <input 
                            type="text"
                            placeholder="Haz una pregunta de negocio..."
                            className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-2 text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isLoading}
                        />
                        <button 
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-indigo-600/20"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}

            {/* Bubble Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all duration-300 active:scale-90 group relative ${isOpen ? 'rotate-90' : ''}`}
            >
                {isOpen ? (
                    <X size={24} />
                ) : (
                    <>
                        <Bot size={24} className="relative z-10" />
                        <Sparkles size={12} className="absolute -top-1 -right-1 text-amber-300 animate-pulse" />
                        <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-ping"></span>
                    </>
                )}
            </button>
        </div>
    );
};

export default AIAssistant;
