import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, Trash2, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Money, { MoneyInput } from '../../../ui/Money';
import { unwrapList } from '../../../../utils/apiUtils';
import { formatDate } from '../../../../utils/dateUtils';

const inputClass = 'w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none';
const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase mb-1';
const UUID_REGEX = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

export default function CorrectionDocumentosTab({
    dteType,
    customerId,
    linkedDocuments,
    onChangeLinkedDocuments
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        let active = true;
        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const params = new URLSearchParams();
                if (customerId) params.set('customer_id', customerId);
                if (searchTerm.trim()) params.set('search', searchTerm.trim());
                const res = await axios.get(`/api/sales/dte-correction/search-docs?${params.toString()}`);
                if (active) setResults(unwrapList(res));
            } catch {
                if (active) setResults([]);
            } finally {
                if (active) setSearching(false);
            }
        }, 350);
        return () => { active = false; clearTimeout(timer); };
    }, [searchTerm, customerId]);

    const currentDocs = Array.isArray(linkedDocuments) ? linkedDocuments : [];
    const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' }).substring(0, 7);

    const handleDocChange = (idx, patch) => {
        onChangeLinkedDocuments(currentDocs.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
    };

    const handleAddEmptyDoc = () => {
        onChangeLinkedDocuments([
            ...currentDocs,
            {
                doc_type: '03',
                generation_type: 1,
                doc_number: '',
                emission_date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' }),
                monto_sujeto: 0,
                iva_retenido: 0,
                descripcion: ''
            }
        ]);
    };

    const handleDeleteDoc = (idx) => {
        onChangeLinkedDocuments(currentDocs.filter((_, i) => i !== idx));
    };

    const handleLinkExisting = (picked) => {
        const baseDoc = {
            doc_type: picked.tipo_documento || '03',
            generation_type: 1,
            doc_number: String(picked.codigo_generacion || '').toUpperCase(),
            emission_date: String(picked.fecha_emision || '').substring(0, 10),
            monto_sujeto: String(dteType) === '07' ? Number(picked.total_gravado || picked.total_pagar || 0) : null,
            iva_retenido: String(dteType) === '07' ? Number(((Number(picked.total_gravado || picked.total_pagar || 0)) * 0.01).toFixed(2)) : null,
            descripcion: `RETENCION AL DOCUMENTO ${picked.numero_control || picked.codigo_generacion}`
        };
        if (currentDocs.length === 1 && !UUID_REGEX.test(String(currentDocs[0].doc_number || ''))) {
            onChangeLinkedDocuments([{ ...currentDocs[0], ...baseDoc }]);
        } else {
            onChangeLinkedDocuments([...currentDocs, baseDoc]);
        }
    };

    return (
        <div className="space-y-4">
            {/* Buscador de DTEs electrónicos reales */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                        <Link2 size={14} className="text-indigo-600" />
                        <span>Buscar y Vincular DTE Electrónico (UUID Oficial)</span>
                    </span>
                    <button
                        type="button"
                        onClick={handleAddEmptyDoc}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                    >
                        <Plus size={13} /> Agregar Manual
                    </button>
                </div>

                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por N° control (DTE-03...), UUID, ID de venta o cliente..."
                        className={`${inputClass} pl-9`}
                    />
                </div>

                {searching ? (
                    <p className="text-xs text-slate-500 py-2">Buscando documentos...</p>
                ) : (Array.isArray(results) && results.length > 0) && (
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl">
                        {results.map(r => (
                            <div key={r.sale_id} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-indigo-50/40">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 truncate">
                                        [{r.tipo_documento}] {r.numero_control || r.codigo_generacion}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {formatDate(r.fecha_emision)} • {r.customer_name} • <span className="font-mono">{r.codigo_generacion}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Money value={r.total_pagar} className="font-bold text-slate-900" />
                                    <button
                                        type="button"
                                        onClick={() => handleLinkExisting(r)}
                                        className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold hover:bg-indigo-100 cursor-pointer"
                                    >
                                        Vincular
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Lista editable de documentos relacionados */}
            {currentDocs.length === 0 ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                    <span>No hay documentos vinculados. Busque arriba o agregue un documento manualmente.</span>
                </div>
            ) : (
                <div className="space-y-3">
                    {currentDocs.map((doc, idx) => {
                        const rawNum = String(doc.doc_number || '').trim();
                        const genType = parseInt(doc.generation_type || 1, 10);
                        const isUuid = UUID_REGEX.test(rawNum);
                        const isDteControl = rawNum.toUpperCase().startsWith('DTE-');
                        const badElectronic = genType === 1 && !isUuid && !isDteControl;
                        const docPeriod = String(doc.emission_date || '').substring(0, 7);
                        const wrongCrPeriod = String(dteType) === '07' && docPeriod && docPeriod !== currentMonth;

                        return (
                            <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-extrabold text-slate-700">Documento Relacionado #{idx + 1}</span>
                                        {genType === 1 && isUuid && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                                <CheckCircle2 size={10} /> UUID Válido
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteDoc(idx)}
                                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                        title="Quitar documento"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className={labelClass}>Tipo Documento</label>
                                        <select
                                            value={doc.doc_type || '03'}
                                            onChange={(e) => handleDocChange(idx, { doc_type: e.target.value })}
                                            className={inputClass}
                                        >
                                            <option value="03">03 - Crédito Fiscal (CCF)</option>
                                            <option value="01">01 - Factura Consumidor Final</option>
                                            <option value="04">04 - Nota de Remisión</option>
                                            <option value="07">07 - Comprobante Retención</option>
                                            <option value="14">14 - Sujeto Excluido</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Tipo Generación</label>
                                        <select
                                            value={String(genType)}
                                            onChange={(e) => handleDocChange(idx, { generation_type: Number(e.target.value) })}
                                            className={inputClass}
                                        >
                                            <option value="1">1 - Electrónico (UUID)</option>
                                            <option value="2">2 - Físico / Preimpreso</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Número / Código de Generación (UUID)</label>
                                        <input
                                            type="text"
                                            value={doc.doc_number || ''}
                                            onChange={(e) => handleDocChange(idx, { doc_number: e.target.value.toUpperCase() })}
                                            placeholder={genType === 1 ? 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' : 'Correlativo físico'}
                                            className={`${inputClass} font-mono ${badElectronic ? 'border-rose-400 bg-rose-50/40' : ''}`}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Fecha Emisión Original</label>
                                        <input
                                            type="date"
                                            value={String(doc.emission_date || '').substring(0, 10)}
                                            onChange={(e) => handleDocChange(idx, { emission_date: e.target.value })}
                                            className={`${inputClass} ${wrongCrPeriod ? 'border-amber-400 bg-amber-50/50' : ''}`}
                                        />
                                    </div>

                                    {String(dteType) === '07' && (
                                        <>
                                            <div>
                                                <label className={labelClass}>Monto Sujeto ($)</label>
                                                <MoneyInput
                                                    value={doc.monto_sujeto ?? 0}
                                                    onChange={(e) => {
                                                        const m = Number(e.target.value || 0);
                                                        handleDocChange(idx, {
                                                            monto_sujeto: m,
                                                            iva_retenido: Number((m * 0.01).toFixed(2))
                                                        });
                                                    }}
                                                    className={`${inputClass} text-right font-mono`}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>IVA Retenido 1% ($)</label>
                                                <MoneyInput
                                                    value={doc.iva_retenido ?? 0}
                                                    onChange={(e) => handleDocChange(idx, { iva_retenido: Number(e.target.value || 0) })}
                                                    className={`${inputClass} text-right font-mono`}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Descripción Retención</label>
                                                <input
                                                    type="text"
                                                    value={doc.descripcion || ''}
                                                    onChange={(e) => handleDocChange(idx, { descripcion: e.target.value })}
                                                    className={inputClass}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>

                                {(badElectronic || wrongCrPeriod || isDteControl) && (
                                    <div className="text-[11px] font-semibold space-y-0.5">
                                        {badElectronic && (
                                            <p className="text-rose-700">Para generación Electrónica (1), Hacienda exige un UUID de 36 caracteres (o use el buscador superior).</p>
                                        )}
                                        {isDteControl && (
                                            <p className="text-amber-700">Si este documento fue emitido en SIPE se convertirá automáticamente a su UUID al guardar; si es un DTE externo, ingrese directamente el Código de Generación (UUID de 36 caracteres) impreso en el documento original.</p>
                                        )}
                                        {wrongCrPeriod && (
                                            <p className="text-amber-700">Comprobante de Retención (07): la fecha pertenece a otro mes distinto al período vigente ({currentMonth}).</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
