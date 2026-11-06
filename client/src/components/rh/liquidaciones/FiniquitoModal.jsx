import { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { unwrapList } from '../../../utils/apiUtils';

const FiniquitoModal = ({ open, onClose, onSubmit, model, companyId }) => {
    const { fieldCls, labelCls } = model || {};
    const [motivo, setMotivo] = useState('RENUNCIA VOLUNTARIA');
    const [detectedCompanyName, setDetectedCompanyName] = useState('');
    const [detectedModalidad, setDetectedModalidad] = useState('');

    useEffect(() => {
        if (!open) return;
        setMotivo(model?.finiquitoMotivo || 'RENUNCIA VOLUNTARIA');
        
        // Leer empresa y modalidad directamente desde la tabla companies
        if (companyId) {
            axios.get('/api/companies')
                .then(res => {
                    const list = unwrapList(res);
                    const comp = (Array.isArray(list) ? list : []).find(c => String(c.id) === String(companyId));
                    if (comp) {
                        setDetectedCompanyName(comp.razon_social || '');
                        const isNat = comp.tipo_persona
                            ? String(comp.tipo_persona) === '1'
                            : !/S\.?A\.?|C\.?V\.?|SOCIEDAD|LTDA|LIMITADA|R\.L\./i.test(comp.razon_social || '');
                        setDetectedModalidad(isNat ? 'Persona Natural' : 'Persona Jurídica');
                    }
                })
                .catch(() => {});
        }
    }, [open, companyId, model?.finiquitoMotivo]);

    if (!open) return null;

    const handleFormSubmit = (e) => {
        if (e) e.preventDefault();
        if (onSubmit) {
            onSubmit({
                motivo: motivo.trim() || 'RENUNCIA VOLUNTARIA',
                format: 'pdf'
            });
        }
    };

    const quickMotivos = [
        'RENUNCIA VOLUNTARIA',
        'TERMINACIÓN DE CONTRATO',
        'RENUNCIA INMEDIATA',
        'DESPIDO INJUSTIFICADO',
        'MUTUO ACUERDO / RETIRO VOLUNTARIO'
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-7 py-6 text-white relative">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <ShieldCheck className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight">Emisión de Finiquito Laboral</h3>
                            <p className="text-xs text-indigo-200/80 font-medium">Documento legal adaptado automáticamente según la empresa</p>
                        </div>
                    </div>
                    {detectedCompanyName && (
                        <div className="mt-3 inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 text-white/90 text-[11px] font-medium backdrop-blur-md">
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Empresa: <strong className="text-white">{detectedCompanyName}</strong></span>
                            {detectedModalidad && (
                                <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 text-[10px] font-bold uppercase">
                                    {detectedModalidad}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <form onSubmit={handleFormSubmit} className="p-7 space-y-6">
                    {/* Motivo de Liquidación */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className={labelCls || "block text-[11px] font-bold text-slate-500 uppercase"}>
                                Motivo de Liquidación / Terminación
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">Editable</span>
                        </div>
                        <input
                            type="text"
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            className={fieldCls || "w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium text-slate-800 transition-all"}
                            placeholder="Ej. RENUNCIA VOLUNTARIA"
                            required
                        />

                        {/* Sugerencias Rápidas */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {quickMotivos.map((qm) => (
                                <button
                                    key={qm}
                                    type="button"
                                    onClick={() => setMotivo(qm)}
                                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                                        motivo === qm
                                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    {qm}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-2"
                        >
                            <span>Descargar Finiquito</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 uppercase tracking-wider">PDF</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default FiniquitoModal;
