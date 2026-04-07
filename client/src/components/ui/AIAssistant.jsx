import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, TrendingUp, Package, Users, DollarSign, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

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

    // Permission check
    const hasPermission = user?.role === 'SuperAdmin' || (user?.permissions && JSON.parse(user.permissions).includes('ai_assistant_access'));

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
    };

    const suggestions = [
        { label: '¿Cuánto vendí este mes?', icon: <DollarSign size={12} /> },
        { label: '¿Qué productos tienen stock bajo?', icon: <Package size={12} /> },
        { label: '¿Quiénes me deben más dinero?', icon: <Users size={12} /> },
        { label: '¿Cuántas compras hicimos este mes?', icon: <TrendingUp size={12} /> },
        { label: '¿Cuál es mi saldo de proveedores?', icon: <MessageSquare size={12} /> },
        { label: '¿Cuáles son mis 5 clientes top?', icon: <Users size={12} /> },
    ];

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end italic">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-[350px] md:w-[400px] h-[500px] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header */}
                    <div className="bg-slate-900 p-6 text-white flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Sparkles size={20} className="animate-pulse" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm tracking-widest uppercase">Novas AI</h3>
                                <div className="flex items-center gap-1.5 opacity-60">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">Especialista de Datos</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-4 py-3 rounded-3xl text-[13px] leading-relaxed shadow-sm ${
                                    m.role === 'user' 
                                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                                        : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200'
                                }`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
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
