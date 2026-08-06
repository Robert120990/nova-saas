import { useState } from 'react';
import axios from 'axios';
import { Search, FileText, Download, Send, FileJson, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const dteTypeNames = {
    '01': 'Factura', '03': 'Crédito Fiscal', '04': 'Nota de Remisión',
    '05': 'Nota de Crédito', '06': 'Nota de Débito', '07': 'Comprobante de Retención',
    '08': 'Comprobante de Liquidación', '09': 'Documento Contable de Liquidación',
    '11': 'Factura de Exportación', '14': 'Factura de Sujeto Excluido', '15': 'Comprobante de Donación'
};

const statusConfig = {
    'ACCEPTED': { label: 'Aceptado', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    'SENT': { label: 'Enviado', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
    'REJECTED': { label: 'Rechazado', cls: 'bg-rose-50 text-rose-600 border-rose-200' },
    'INVALIDADO': { label: 'Anulado', cls: 'bg-amber-50 text-amber-600 border-amber-200' }
};

const PublicDTE = () => {
    const [codigo, setCodigo] = useState('');
    const [dteInfo, setDteInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [email, setEmail] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!codigo.trim()) return;
        setLoading(true);
        setSearched(true);
        setDteInfo(null);
        setShowEmailInput(false);
        try {
            const { data } = await axios.get(`/api/public/dte/${codigo.trim()}/info`);
            if (data.encontrado) {
                setDteInfo(data);
            } else {
                setDteInfo(null);
            }
        } catch {
            setDteInfo(null);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        window.open(`/api/public/dte/${codigo.trim()}/pdf`, '_blank');
    };

    const handleDownloadJSON = () => {
        const a = document.createElement('a');
        a.href = `/api/public/dte/${codigo.trim()}/json`;
        a.download = `DTE-${dteInfo?.numero_control || codigo}.json`;
        a.click();
    };

    const handleSendEmail = async () => {
        if (!email.trim()) {
            toast.error('Ingrese un correo electrónico');
            return;
        }
        setSendingEmail(true);
        try {
            const { data } = await axios.post(`/api/public/dte/${codigo.trim()}/send-email`, { email: email.trim() });
            if (data.success) {
                toast.success('Correo enviado correctamente');
                setShowEmailInput(false);
                setEmail('');
            } else {
                toast.error(data.message || 'Error al enviar correo');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al enviar correo');
        } finally {
            setSendingEmail(false);
        }
    };

    const statusInfo = dteInfo ? (statusConfig[dteInfo.status] || { label: dteInfo.status, cls: 'bg-slate-50 text-slate-600 border-slate-200' }) : {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-3xl shadow-2xl shadow-indigo-600/20 mb-4">
                        <FileText size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Consulta de DTE</h1>
                    <p className="text-sm font-medium text-slate-400 mt-1">Ingrese el código de generación de su documento tributario electrónico</p>
                </div>

                <form onSubmit={handleSearch} className="mb-6">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                placeholder="Código de Generación (UUID)"
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-mono font-bold shadow-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !codigo.trim()}
                            className="px-6 py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search size={16} />
                            )}
                            Buscar
                        </button>
                    </div>
                </form>

                {searched && !loading && (
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                        {dteInfo ? (
                            <div className="p-6 space-y-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documento Encontrado</span>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusInfo.cls}`}>
                                        {statusInfo.label}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Empresa</span>
                                        <span className="text-sm font-black text-slate-800">{dteInfo.company_name || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Sucursal</span>
                                        <span className="text-sm font-black text-slate-800">{dteInfo.branch_name || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tipo</span>
                                        <span className="text-sm font-black text-slate-800">{dteTypeNames[dteInfo.tipo_dte] || dteInfo.tipo_dte}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Número</span>
                                        <span className="text-sm font-black text-slate-800 font-mono">{dteInfo.numero_control}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Receptor</span>
                                        <span className="text-sm font-black text-slate-800">{dteInfo.receptor_nombre}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">NIT</span>
                                        <span className="text-sm font-black text-slate-800 font-mono">{dteInfo.receptor_nit || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Dirección</span>
                                        <span className="text-sm font-black text-slate-800">{dteInfo.receptor_direccion || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Fecha</span>
                                        <span className="text-sm font-black text-slate-800">{dteInfo.fecha_emision ? new Date(dteInfo.fecha_emision).toLocaleDateString('es-SV') : 'N/A'}</span>
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100" />

                                <div className="space-y-2">
                                    <button
                                        onClick={handleDownloadPDF}
                                        className="flex items-center gap-3 w-full p-3.5 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition-all border border-indigo-100"
                                    >
                                        <div className="p-2 bg-indigo-600 text-white rounded-xl"><FileText size={18} /></div>
                                        <div className="flex-1 text-left">
                                            <span className="block text-xs font-black uppercase tracking-widest">Descargar PDF</span>
                                            <span className="text-[9px] font-medium text-indigo-400">Representación gráfica del DTE</span>
                                        </div>
                                        <Download size={16} />
                                    </button>

                                    <button
                                        onClick={handleDownloadJSON}
                                        className="flex items-center gap-3 w-full p-3.5 bg-slate-50 text-slate-700 rounded-2xl hover:bg-slate-100 transition-all border border-slate-100"
                                    >
                                        <div className="p-2 bg-slate-700 text-white rounded-xl"><FileJson size={18} /></div>
                                        <div className="flex-1 text-left">
                                            <span className="block text-xs font-black uppercase tracking-widest">Descargar JSON</span>
                                            <span className="text-[9px] font-medium text-slate-400">Archivo de datos del DTE</span>
                                        </div>
                                        <Download size={16} />
                                    </button>

                                    {!showEmailInput ? (
                                        <button
                                            onClick={() => setShowEmailInput(true)}
                                            className="flex items-center gap-3 w-full p-3.5 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition-all border border-emerald-100"
                                        >
                                            <div className="p-2 bg-emerald-600 text-white rounded-xl"><Send size={18} /></div>
                                            <div className="flex-1 text-left">
                                                <span className="block text-xs font-black uppercase tracking-widest">Enviar a mi Correo</span>
                                                <span className="text-[9px] font-medium text-emerald-400">Recibe el PDF y JSON por correo</span>
                                            </div>
                                            <Send size={16} />
                                        </button>
                                    ) : (
                                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Ingrese su correo electrónico</p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="correo@ejemplo.com"
                                                    className="flex-1 px-4 py-2.5 bg-white border border-emerald-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all text-sm font-medium"
                                                />
                                                <button
                                                    onClick={handleSendEmail}
                                                    disabled={sendingEmail || !email.trim()}
                                                    className="px-5 py-2.5 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                >
                                                    {sendingEmail ? (
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Send size={14} />
                                                    )}
                                                    Enviar
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => { setShowEmailInput(false); setEmail(''); }}
                                                className="text-[10px] font-bold text-emerald-500 hover:text-emerald-700 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="inline-flex items-center justify-center w-14 h-14 bg-rose-50 rounded-2xl mb-4">
                                    <XCircle size={28} className="text-rose-400" />
                                </div>
                                <p className="font-black text-slate-400 text-sm uppercase tracking-widest">Documento no encontrado</p>
                                <p className="text-xs text-slate-300 mt-1">Verifique que el código de generación sea correcto</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-6 text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        &copy; {new Date().getFullYear()} — Sistema de Consulta de Documentos Tributarios Electrónicos
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicDTE;
