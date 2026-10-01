import { useState } from 'react';
import axios from 'axios';
import { Download, Copy, Check, Loader2, ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';

const GasFusionAgentFiles = ({ branchId }) => {
    const [downloading, setDownloading] = useState({});
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [copiedConfig, setCopiedConfig] = useState(false);
    const [copiedBat, setCopiedBat] = useState(false);

    const handleDownload = async (endpoint, filename) => {
        try {
            setDownloading(prev => ({ ...prev, [filename]: true }));
            const res = await axios.get(endpoint, {
                params: { branch_id: branchId },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], {
                type: res.headers['content-type'] || 'application/octet-stream'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            toast.success(`${filename} descargado exitosamente`);
        } catch (error) {
            console.error('Error al descargar archivo:', error);
            toast.error(error.response?.data?.message || `Error al descargar ${filename}`);
        } finally {
            setDownloading(prev => ({ ...prev, [filename]: false }));
        }
    };

    const handleDownloadAll = async () => {
        setDownloadingAll(true);
        try {
            await handleDownload('/api/gas-station/fusion/agent-config', 'config.json');
            await new Promise(r => setTimeout(r, 600));
            await handleDownload('/api/gas-station/fusion/agent-launcher', 'iniciar-agente.bat');
            await new Promise(r => setTimeout(r, 600));
            await handleDownload('/api/gas-station/fusion/agent-script', 'fusion-agent.js');
        } catch (err) {
            console.error('Error al descargar archivos:', err);
        } finally {
            setDownloadingAll(false);
        }
    };

    const batContent = `@echo off\r\ntitle Conector Wayne Fusion FFC - SIPE WEB\r\ncolor 0A\r\ncd /d "%~dp0"\r\necho Conector Local Wayne Fusion FFC - SIPE WEB\r\nwhere node >nul 2>nul\r\nif %errorlevel% neq 0 ( echo [ERROR] Node.js no instalado. Descargue desde https://nodejs.org & pause & exit /b 1 )\r\nnode fusion-agent.js\r\nif %errorlevel% neq 0 pause\r\n`;

    const handleCopyBat = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(batContent);
        setCopiedBat(true);
        toast.success('Contenido de iniciar-agente.bat copiado');
        setTimeout(() => setCopiedBat(false), 2000);
    };

    const handleCopyConfig = async (e) => {
        e.stopPropagation();
        try {
            const res = await axios.get('/api/gas-station/fusion/agent-config', {
                params: { branch_id: branchId }
            });
            const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
            navigator.clipboard.writeText(text);
            setCopiedConfig(true);
            toast.success('Contenido de config.json copiado al portapapeles');
            setTimeout(() => setCopiedConfig(false), 2000);
        } catch {
            toast.error('Error al obtener contenido de config.json');
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Archivos del Conector (Descarga Segura)
                </label>
                <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                    {downloadingAll ? (
                        <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Descargando...</span>
                        </>
                    ) : (
                        <>
                            <ArrowDownToLine size={13} />
                            <span>Descargar los 3 archivos</span>
                        </>
                    )}
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. config.json */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between shadow-xs">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                1. config.json
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyConfig}
                                title="Copiar contenido JSON"
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
                            >
                                {copiedConfig ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2">Claves y parámetros pre-llenados</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleDownload('/api/gas-station/fusion/agent-config', 'config.json')}
                        disabled={downloading['config.json'] || downloadingAll}
                        className="w-full mt-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {downloading['config.json'] ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Download size={12} />
                        )}
                        <span>Descargar</span>
                    </button>
                </div>

                {/* 2. iniciar-agente.bat */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between shadow-xs">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                2. iniciar-agente.bat
                            </span>
                            <button
                                type="button"
                                onClick={handleCopyBat}
                                title="Copiar script BAT"
                                className="text-slate-400 hover:text-emerald-600 p-0.5 rounded transition-colors"
                            >
                                {copiedBat ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2">Iniciador Windows para doble clic</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleDownload('/api/gas-station/fusion/agent-launcher', 'iniciar-agente.bat')}
                        disabled={downloading['iniciar-agente.bat'] || downloadingAll}
                        className="w-full mt-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {downloading['iniciar-agente.bat'] ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Download size={12} />
                        )}
                        <span>Descargar</span>
                    </button>
                </div>

                {/* 3. fusion-agent.js */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col justify-between shadow-xs">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                3. fusion-agent.js
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2">Script ligero de comunicación</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleDownload('/api/gas-station/fusion/agent-script', 'fusion-agent.js')}
                        disabled={downloading['fusion-agent.js'] || downloadingAll}
                        className="w-full mt-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {downloading['fusion-agent.js'] ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Download size={12} />
                        )}
                        <span>Descargar</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GasFusionAgentFiles;
