import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { 
    Search, 
    XCircle, 
    Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { PublicDteResultCard } from '../components/publicDte';

const statusConfig = {
    'ACCEPTED': { label: 'Aceptado por Hacienda', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20' },
    'SENT': { label: 'Transmitido', cls: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20' },
    'REJECTED': { label: 'Rechazado', cls: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20' },
    'INVALIDADO': { label: 'Anulado / Invalidado', cls: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20' }
};

const PublicDTE = () => {
    const [searchParams] = useSearchParams();
    const routeParams = useParams();
    const initialCode = searchParams.get('codigo') || searchParams.get('c') || routeParams.codigo || '';

    const [codigo, setCodigo] = useState(initialCode);
    const [dteInfo, setDteInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [email, setEmail] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const initialSearchDone = useRef(false);

    const executeSearch = async (targetCode) => {
        const trimmed = (targetCode || '').trim();
        if (!trimmed) return;
        setLoading(true);
        setSearched(true);
        setDteInfo(null);
        setShowEmailInput(false);
        try {
            const { data } = await axios.get(`/api/public/dte/${trimmed}/info`);
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

    useEffect(() => {
        if (initialCode && !initialSearchDone.current) {
            initialSearchDone.current = true;
            setCodigo(initialCode);
            executeSearch(initialCode);
        }
    }, [initialCode]);

    const handleSearch = async (e) => {
        e?.preventDefault?.();
        executeSearch(codigo);
    };

    const handleDownloadPDF = () => {
        window.open(`/api/public/dte/${codigo.trim()}/pdf`, '_blank');
    };

    const handleDownloadJSON = () => {
        const a = document.createElement('a');
        a.href = `/api/public/dte/${codigo.trim()}/json`;
        a.download = `DTE-${dteInfo?.numero_control || codigo.trim()}.json`;
        a.click();
    };

    const handleDownloadInvalidationPDF = () => {
        window.open(`/api/public/dte/${codigo.trim()}/invalidation/pdf`, '_blank');
    };

    const handleDownloadInvalidationJSON = () => {
        const a = document.createElement('a');
        a.href = `/api/public/dte/${codigo.trim()}/invalidation/json`;
        a.download = `INVALIDACION-${dteInfo?.numero_control || codigo.trim()}.json`;
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

    const statusInfo = dteInfo ? (statusConfig[dteInfo.status] || { label: dteInfo.status, cls: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/10' }) : {};

    return (
        <div className="min-h-screen bg-slate-50/70 bg-gradient-to-b from-indigo-50/50 via-white to-slate-100 flex flex-col justify-between p-3.5 sm:p-6 lg:p-8">
            <div className="w-full max-w-xl mx-auto flex-1 flex flex-col justify-center py-4">
                
                {/* Header Branding */}
                <div className="text-center mb-6 sm:mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl sm:rounded-3xl shadow-xl shadow-indigo-600/25 mb-3 sm:mb-4 text-white">
                        <Receipt size={30} className="sm:hidden" />
                        <Receipt size={34} className="hidden sm:block" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Consulta de DTE</h1>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1 max-w-md mx-auto px-2">
                        Documento Tributario Electrónico del Ministerio de Hacienda de El Salvador
                    </p>
                </div>

                {/* Search Bar Form */}
                <form onSubmit={handleSearch} className="mb-5 sm:mb-6">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                placeholder="Código de Generación (UUID)"
                                className="w-full pl-10 pr-3.5 py-3 sm:py-3.5 bg-white border border-slate-200/90 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all text-xs sm:text-sm font-mono font-bold shadow-sm placeholder:font-sans placeholder:text-slate-400 placeholder:font-normal"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !codigo.trim()}
                            className="w-full sm:w-auto px-6 py-3 sm:py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Search size={15} />
                            )}
                            <span>Buscar</span>
                        </button>
                    </div>
                </form>

                {/* Result Card */}
                {searched && !loading && (
                    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden transition-all">
                        {dteInfo ? (
                            <PublicDteResultCard
                                dteInfo={dteInfo}
                                codigo={codigo}
                                statusInfo={statusInfo}
                                onDownloadPDF={handleDownloadPDF}
                                onDownloadJSON={handleDownloadJSON}
                                onDownloadInvalidationPDF={handleDownloadInvalidationPDF}
                                onDownloadInvalidationJSON={handleDownloadInvalidationJSON}
                                onSendEmail={handleSendEmail}
                                email={email}
                                setEmail={setEmail}
                                sendingEmail={sendingEmail}
                                showEmailInput={showEmailInput}
                                setShowEmailInput={setShowEmailInput}
                            />
                        ) : (
                            <div className="p-8 sm:p-12 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-rose-50 rounded-2xl mb-3 text-rose-500">
                                    <XCircle size={28} />
                                </div>
                                <p className="font-black text-slate-700 text-sm sm:text-base uppercase tracking-wider">Documento no encontrado</p>
                                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                                    Verifique que el código de generación sea correcto o intente de nuevo en unos momentos.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Legal */}
                <div className="mt-8 text-center px-4">
                    <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                        &copy; {new Date().getFullYear()} — Consulta Oficial de Documentos Tributarios Electrónicos
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PublicDTE;
