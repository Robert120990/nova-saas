import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
    FlaskConical, CheckCircle2, Calendar, User, Save, FileText, X, FileSpreadsheet, FileDown, Loader2, Building2
} from 'lucide-react';

const PRODUCT_STANDARDS = {
    we: { name: 'Huevo Entero (WE)', ph: [7.0, 8.0], sol: [23.7, 24.7], temp: [2.0, 4.0], dens: [0.115, 0.145], hasSal: false },
    wrd: { name: "Huevo Rápido Denny's", ph: [6.8, 6.9], sol: [22.9, 23.7], temp: [2.0, 4.0], sal: [0.42, 0.46], hasSal: true },
    wl: { name: 'Huevo con Leche (W/L)', ph: [6.0, 7.0], sol: [20.0, 21.0], temp: [2.0, 4.0], sal: [0.46, 0.52], hasSal: true },
    cl: { name: 'Clara Pasteurizada (CL)', ph: [7.5, 8.5], sol: [11.5, 12.5], temp: [2.0, 4.0], dens: [0.300, 0.400], hasSal: false },
    ya: { name: 'Yema Azucarada (Y/A)', ph: [5.9, 6.5], sol: [43.0, 49.0], temp: [2.0, 4.0], hasSal: false },
    hf: { name: 'Huevo Formulado (HF)', ph: [6.7, 7.7], sol: [22.0, 23.0], temp: [2.0, 4.0], hasSal: false }
};

const resolveStandard = (productName = '') => {
    const p = String(productName).toLowerCase();
    if (p.includes('denny') || p.includes('wrd')) return PRODUCT_STANDARDS.wrd;
    if (p.includes('leche') || p.includes('w/l')) return PRODUCT_STANDARDS.wl;
    if (p.includes('clara')) return PRODUCT_STANDARDS.cl;
    if (p.includes('yema')) return PRODUCT_STANDARDS.ya;
    if (p.includes('form') || p.includes('hf')) return PRODUCT_STANDARDS.hf;
    return PRODUCT_STANDARDS.we;
};

const EggQualityFinishedProductModal = ({
    open,
    onClose,
    batch = null,
    logId = null,
    onSuccess
}) => {
    const [activeTab, setActiveTab] = useState('fq'); // 'fq', 'mb', 'release'
    const [saving, setSaving] = useState(false);
    const [_fetching, setFetching] = useState(false);
    const [existingLogId, setExistingLogId] = useState(null);
    const [downloadScope, setDownloadScope] = useState('all'); // 'all', 'fq', 'mb'
    const [downloadingFmt, setDownloadingFmt] = useState(null); // 'pdf', 'excel', 'word', null

    const [form, setForm] = useState({
        batch_id: '',
        commercial_lot_code: '',
        sample_date: new Date().toISOString().split('T')[0],
        customer_id: '',
        customer_name: '',
        presentation: 'Cubeta 30 Lb',
        // Físico-Químico (FQ)
        ph: '7.45',
        solids_percentage: '24.2',
        temperature_c: '3.5',
        salinity_pct: '',
        density: '0.130',
        brix: '23.8',
        fq_status: 'aprobado',
        // Microbiológico (MB - Mario 2025)
        mesophilic_aerobic_cfu: '150',
        total_coliforms_mpn: '0',
        e_coli_mpn: '',
        salmonella_25g: 'ausencia',
        fungi_yeasts_cfu: '0',
        staph_aureus: 'negativo',
        mb_status: 'en_incubacion',
        incubation_started_at: '',
        incubation_hours: 48,
        // Dictamen y Liberación
        status: 'cuarentena',
        release_status: 'cuarentena',
        observations: '',
        analyst_name: 'Mario (Control de Calidad)'
    });

    const standard = resolveStandard(batch?.product_type || form.presentation);

    useEffect(() => {
        if (!open) return;
        const bId = batch?.batch_id || batch?.id;
        if (!bId && !logId) return;

        setFetching(true);
        axios.get('/api/egg-industrial/lab/logs', {
            params: { batch_id: bId }
        }).then(res => {
            const list = Array.isArray(res.data) ? res.data : [];
            const found = logId ? list.find(l => l.id === logId) : (list.length > 0 ? list[0] : null);

            if (found && !String(found.id).startsWith('auto-')) {
                setExistingLogId(found.id);
                setForm({
                    batch_id: found.batch_id || bId,
                    commercial_lot_code: found.commercial_lot_code || found.pkg_lot_code || batch?.commercial_lot_code || batch?.batch_code_display || '',
                    sample_date: found.sample_date ? found.sample_date.split('T')[0] : new Date().toISOString().split('T')[0],
                    customer_id: found.customer_id || '',
                    customer_name: found.customer_name || '',
                    presentation: found.presentation || batch?.presentation || 'Cubeta 30 Lb',
                    ph: found.ph !== null ? String(found.ph) : '7.45',
                    solids_percentage: found.solids_percentage !== null ? String(found.solids_percentage) : '24.2',
                    temperature_c: found.temperature_c !== null ? String(found.temperature_c) : '3.5',
                    salinity_pct: found.salinity_pct !== null ? String(found.salinity_pct) : '',
                    density: found.density !== null ? String(found.density) : (standard.dens ? String(standard.dens[0]) : ''),
                    brix: found.brix !== null ? String(found.brix) : '23.8',
                    fq_status: found.fq_status || 'aprobado',
                    mesophilic_aerobic_cfu: found.mesophilic_aerobic_cfu !== null ? String(found.mesophilic_aerobic_cfu) : '150',
                    total_coliforms_mpn: found.total_coliforms_mpn !== null ? String(found.total_coliforms_mpn) : '0',
                    e_coli_mpn: found.e_coli_mpn !== null ? String(found.e_coli_mpn) : '',
                    salmonella_25g: found.salmonella_25g || 'ausencia',
                    fungi_yeasts_cfu: found.fungi_yeasts_cfu !== null ? String(found.fungi_yeasts_cfu) : '0',
                    staph_aureus: found.staph_aureus || 'negativo',
                    mb_status: found.mb_status || 'en_incubacion',
                    incubation_started_at: found.incubation_started_at ? found.incubation_started_at.split('T')[0] : '',
                    incubation_hours: found.incubation_hours || 48,
                    status: found.status || 'cuarentena',
                    release_status: found.release_status || 'cuarentena',
                    observations: found.observations || '',
                    analyst_name: found.analyst_name || 'Mario (Control de Calidad)'
                });
            } else {
                setExistingLogId(null);
                const defaultSolids = batch?.measured_solids_pct || (standard.sol ? standard.sol[1] : 24.2);
                setForm(prev => ({
                    ...prev,
                    batch_id: bId,
                    commercial_lot_code: batch?.commercial_lot_code || batch?.pkg_lot_code || batch?.batch_code_display || `LOTE-${bId}`,
                    presentation: batch?.presentation || 'Cubeta 30 Lb',
                    customer_name: batch?.customer_destination || batch?.pkg_customer_destination || batch?.sale_customer_name || '',
                    solids_percentage: String(defaultSolids)
                }));
            }
        }).catch(err => {
            console.error('Error fetching quality log:', err);
        }).finally(() => {
            setFetching(false);
        });
    }, [open, batch, logId]);

    if (!open) return null;

    const handleSave = async (e, shouldClose = true) => {
        if (e && e.preventDefault) e.preventDefault();
        setSaving(true);
        try {
            const bId = form.batch_id || batch?.batch_id || batch?.id;
            const payload = {
                ...form,
                batch_id: bId
            };

            let currentId = existingLogId;
            if (existingLogId) {
                await axios.put(`/api/egg-industrial/lab/logs/${existingLogId}`, payload);
                toast.success('Dictamen de calidad LAB-004 actualizado exitosamente.');
            } else {
                const res = await axios.post('/api/egg-industrial/lab/logs', payload);
                currentId = res.data?.id;
                setExistingLogId(currentId);
                toast.success('Control de calidad FQ & MB guardado exitosamente.');
            }
            if (onSuccess) onSuccess();
            if (shouldClose) {
                onClose();
            }
            return currentId;
        } catch (error) {
            console.error('Error saving quality log:', error);
            toast.error(error.response?.data?.message || 'Error al guardar control de calidad.');
            return null;
        } finally {
            setSaving(false);
        }
    };

    const handleDownload = async (fmt) => {
        const bId = form.batch_id || batch?.batch_id || batch?.id;
        if (!bId) {
            toast.error('No se identificó el ID del lote para generar la descarga.');
            return;
        }

        setDownloadingFmt(fmt);
        try {
            // Guardar automáticamente para reflejar cambios en tiempo real
            await handleSave(null, false);

            const response = await axios.get(`/api/egg-industrial/lab/quality-letter/${bId}/export`, {
                params: {
                    format: fmt,
                    scope: downloadScope,
                    customer_name: form.customer_name?.trim() || undefined
                },
                responseType: 'blob'
            });

            const safeCode = (form.commercial_lot_code || `LOTE-${bId}`).replace(/[^a-zA-Z0-9_-]/g, '_');
            const prefix = downloadScope === 'fq' ? 'Analisis_FQ' : downloadScope === 'mb' ? 'Analisis_MB' : 'Carta_Calidad';
            const ext = fmt === 'word' ? 'docx' : fmt === 'excel' ? 'xlsx' : 'pdf';
            const filename = `${prefix}_${safeCode}.${ext}`;

            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);

            toast.success(`Archivo descargado con éxito (${ext.toUpperCase()}).`);
        } catch (error) {
            console.error('Error al descargar archivo de calidad:', error);
            if (error.response && error.response.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    toast.error(json.message || 'Error al generar la descarga.');
                } catch (_) {
                    toast.error('Error al generar la descarga.');
                }
            } else {
                toast.error(error.response?.data?.message || 'Error al generar la descarga.');
            }
        } finally {
            setDownloadingFmt(null);
        }
    };

    const isPhInSpec = standard.ph ? (parseFloat(form.ph) >= standard.ph[0] && parseFloat(form.ph) <= standard.ph[1]) : true;
    const isSolInSpec = standard.sol ? (parseFloat(form.solids_percentage) >= standard.sol[0] && parseFloat(form.solids_percentage) <= standard.sol[1]) : true;
    const isTempInSpec = standard.temp ? (parseFloat(form.temperature_c) >= standard.temp[0] && parseFloat(form.temperature_c) <= standard.temp[1]) : true;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col text-slate-900 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                            <FlaskConical size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                Control de Calidad Oficial (FQ & MB) • LAB-004
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Lote: <strong className="font-mono text-slate-900">{form.commercial_lot_code || batch?.batch_code_display}</strong> • Perfil: <span className="text-teal-700 font-bold">{standard.name}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Sub-tabs Bar */}
                <div className="px-5 pt-3 border-b border-slate-100 flex gap-2 bg-white">
                    <button
                        onClick={() => setActiveTab('fq')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'fq' ? 'border-teal-600 text-teal-700 bg-teal-50/40' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <span>1. Físico-Químico (FQ)</span>
                        {isPhInSpec && isSolInSpec && <CheckCircle2 size={13} className="text-emerald-500" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('mb')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'mb' ? 'border-teal-600 text-teal-700 bg-teal-50/40' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <span>2. Microbiológico (MB)</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${form.mb_status === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {form.mb_status === 'en_incubacion' ? 'Incubando' : form.mb_status}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('release')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'release' ? 'border-teal-600 text-teal-700 bg-teal-50/40' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <span>3. Dictamen & Liberación</span>
                        <span className={`w-2 h-2 rounded-full ${form.release_status === 'liberado' ? 'bg-emerald-500' : form.release_status === 'bloqueado_haccp' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* TAB 1: FÍSICO-QUÍMICO */}
                    {activeTab === 'fq' && (
                        <div className="space-y-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center justify-between">
                                <span>Medición inmediata en planta (pH-metro, Refractómetro, Termómetro).</span>
                                <span className="font-semibold text-slate-800">Norma: {standard.name}</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Potencial de Hidrógeno (pH)</label>
                                    <input
                                        type="number" step="0.01"
                                        value={form.ph}
                                        onChange={e => setForm({ ...form, ph: e.target.value })}
                                        className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-bold focus:outline-none ${isPhInSpec ? 'border-slate-300 text-slate-800' : 'border-amber-400 text-amber-900 bg-amber-50/30'}`}
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">Estándar: {standard.ph ? `${standard.ph[0]} - ${standard.ph[1]}` : '7.0 - 8.0'}</span>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Sólidos Totales (%)</label>
                                    <input
                                        type="number" step="0.1"
                                        value={form.solids_percentage}
                                        onChange={e => setForm({ ...form, solids_percentage: e.target.value })}
                                        className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-bold focus:outline-none ${isSolInSpec ? 'border-slate-300 text-slate-800' : 'border-amber-400 text-amber-900 bg-amber-50/30'}`}
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">Estándar: {standard.sol ? `${standard.sol[0]}% - ${standard.sol[1]}%` : '≥ 23.7%'}</span>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Temperatura Producto (°C)</label>
                                    <input
                                        type="number" step="0.1"
                                        value={form.temperature_c}
                                        onChange={e => setForm({ ...form, temperature_c: e.target.value })}
                                        className={`w-full px-3 py-2 bg-white border rounded-xl text-xs font-bold focus:outline-none ${isTempInSpec ? 'border-slate-300 text-slate-800' : 'border-rose-400 text-rose-900 bg-rose-50/30'}`}
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">Estándar: 2.0°C - 4.0°C</span>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Grados Brix (°Bx)</label>
                                    <input
                                        type="number" step="0.1"
                                        value={form.brix}
                                        onChange={e => setForm({ ...form, brix: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">Lectura refractométrica directa</span>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Densidad (g/ml)</label>
                                    <input
                                        type="number" step="0.001"
                                        value={form.density}
                                        onChange={e => setForm({ ...form, density: e.target.value })}
                                        placeholder="Ej: 0.130"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">{standard.dens ? `Estándar: ${standard.dens[0]} - ${standard.dens[1]}` : 'Opcional según perfil'}</span>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Salinidad (% SAL)</label>
                                    <input
                                        type="number" step="0.01"
                                        value={form.salinity_pct}
                                        onChange={e => setForm({ ...form, salinity_pct: e.target.value })}
                                        placeholder={standard.hasSal ? '0.44' : 'N/A'}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">{standard.hasSal ? 'Requerido para WRD / Con Leche' : 'No aplica a huevo estándar'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: MICROBIOLÓGICO */}
                    {activeTab === 'mb' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-teal-50/50 p-3.5 rounded-xl border border-teal-200">
                                <div>
                                    <label className="text-[10px] font-bold text-teal-800 uppercase block mb-1">Estado de Incubación</label>
                                    <select
                                        value={form.mb_status}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setForm(prev => ({
                                                ...prev,
                                                mb_status: v,
                                                release_status: v === 'aprobado' ? 'liberado' : (v === 'rechazado' ? 'bloqueado_haccp' : 'cuarentena')
                                            }));
                                        }}
                                        className="w-full px-2.5 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-bold text-teal-900"
                                    >
                                        <option value="en_incubacion">⏳ En Incubación (Estufa 24-48h)</option>
                                        <option value="aprobado">✓ Lectura Final (Conforme / Aprobado)</option>
                                        <option value="pendiente">⚪ Pendiente de Siembra</option>
                                        <option value="rechazado">✕ Fuera de Límite (Rechazado)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-teal-800 uppercase block mb-1">Inicio de Incubación</label>
                                    <input
                                        type="date"
                                        value={form.incubation_started_at || form.sample_date}
                                        onChange={e => setForm({ ...form, incubation_started_at: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-medium"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-teal-800 uppercase block mb-1">Horas Proyectadas</label>
                                    <select
                                        value={form.incubation_hours}
                                        onChange={e => setForm({ ...form, incubation_hours: parseInt(e.target.value) })}
                                        className="w-full px-2.5 py-1.5 bg-white border border-teal-300 rounded-lg text-xs font-medium"
                                    >
                                        <option value={24}>24 Horas (Coliformes rápidos)</option>
                                        <option value={48}>48 Horas (Recuento Total / Salmonella)</option>
                                        <option value={72}>72 Horas (Hongos y Levaduras)</option>
                                    </select>
                                </div>
                            </div>

                            {/* 6 Parámetros Oficiales de Mario */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-900">1. Recuento Total Aeróbico</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border">Máx 1,000 UFC/g</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={form.mesophilic_aerobic_cfu}
                                        onChange={e => setForm({ ...form, mesophilic_aerobic_cfu: e.target.value })}
                                        placeholder="Ej: 150"
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                                    />
                                </div>

                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-900">2. Coliformes Totales</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border">&lt; 10 UFC/g</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={form.total_coliforms_mpn}
                                        onChange={e => setForm({ ...form, total_coliforms_mpn: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                                    />
                                </div>

                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-900">3. Escherichia coli (E. Coli)</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border">Ausente / Negativo</span>
                                    </div>
                                    <select
                                        value={form.e_coli_mpn ? 'positivo' : 'negativo'}
                                        onChange={e => setForm({ ...form, e_coli_mpn: e.target.value === 'positivo' ? '1' : '' })}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                                    >
                                        <option value="negativo">Negativo (Ausencia)</option>
                                        <option value="positivo">Positivo (Presencia - Bloqueo)</option>
                                    </select>
                                </div>

                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-900">4. Salmonella sp. en 25 g</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Ausente (Crítico)</span>
                                    </div>
                                    <select
                                        value={form.salmonella_25g}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setForm(prev => ({
                                                ...prev,
                                                salmonella_25g: v,
                                                release_status: v === 'presencia' ? 'bloqueado_haccp' : prev.release_status
                                            }));
                                        }}
                                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border ${form.salmonella_25g === 'presencia' ? 'bg-rose-50 border-rose-400 text-rose-800' : 'bg-white border-slate-300 text-slate-800'}`}
                                    >
                                        <option value="ausencia">Ausencia / Negativo (Conforme)</option>
                                        <option value="presencia">Presencia / Positivo (BLOQUEO HACCP)</option>
                                    </select>
                                </div>

                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-900">5. Hongos y Levaduras</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border">&lt; 10 UFC/g</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={form.fungi_yeasts_cfu}
                                        onChange={e => setForm({ ...form, fungi_yeasts_cfu: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                                    />
                                </div>

                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-900">6. Staphylococcus Aureus</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border">Negativo</span>
                                    </div>
                                    <select
                                        value={form.staph_aureus}
                                        onChange={e => setForm({ ...form, staph_aureus: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                                    >
                                        <option value="negativo">Negativo (Ausencia)</option>
                                        <option value="positivo">Positivo (Presencia)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: DICTAMEN & LIBERACIÓN */}
                    {activeTab === 'release' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl border flex items-center justify-between gap-4"
                                style={{
                                    backgroundColor: form.release_status === 'liberado' ? '#ecfdf5' : form.release_status === 'bloqueado_haccp' ? '#fff1f2' : '#fffbeb',
                                    borderColor: form.release_status === 'liberado' ? '#a7f3d0' : form.release_status === 'bloqueado_haccp' ? '#fecdd3' : '#fde68a'
                                }}
                            >
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold uppercase tracking-wider block"
                                        style={{ color: form.release_status === 'liberado' ? '#065f46' : form.release_status === 'bloqueado_haccp' ? '#9f1239' : '#92400e' }}
                                    >
                                        Estado de Inocuidad del Lote
                                    </span>
                                    <h4 className="text-sm font-black uppercase"
                                        style={{ color: form.release_status === 'liberado' ? '#047857' : form.release_status === 'bloqueado_haccp' ? '#be123c' : '#b45309' }}
                                    >
                                        {form.release_status === 'liberado' ? '✓ Lote Liberado para Venta y Despacho' : form.release_status === 'bloqueado_haccp' ? '✕ Bloqueado por Seguridad HACCP' : '⏳ Lote en Cuarentena (En Incubación)'}
                                    </h4>
                                    <p className="text-[11px] text-slate-600">
                                        {form.release_status === 'liberado'
                                            ? 'Los parámetros FQ y MB cumplen 100% de especificaciones. El producto está listo para remisión y facturación DTE.'
                                            : form.release_status === 'bloqueado_haccp'
                                                ? 'Se detectó patógeno o desvío crítico. Despacho y comercialización inhabilitados.'
                                                : 'El producto físico puede permanecer envasado en cámara fría mientras concluyen los ensayos microbiológicos.'}
                                    </p>
                                </div>
                                <select
                                    value={form.release_status}
                                    onChange={e => setForm({ ...form, release_status: e.target.value })}
                                    className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold shadow-xs shrink-0"
                                >
                                    <option value="cuarentena">En Cuarentena</option>
                                    <option value="liberado">Liberado / Conforme</option>
                                    <option value="bloqueado_haccp">Bloqueado HACCP</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Cliente / Destinatario (Opcional)</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                                        <Building2 size={15} className="text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            value={form.customer_name}
                                            onChange={e => setForm({ ...form, customer_name: e.target.value })}
                                            placeholder="A quien corresponda"
                                            className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Analista Responsable</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                                        <User size={15} className="text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            value={form.analyst_name}
                                            onChange={e => setForm({ ...form, analyst_name: e.target.value })}
                                            className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Fecha de Emisión del Dictamen</label>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                                        <Calendar size={15} className="text-slate-400 shrink-0" />
                                        <input
                                            type="date"
                                            value={form.sample_date}
                                            onChange={e => setForm({ ...form, sample_date: e.target.value })}
                                            className="w-full bg-transparent text-xs font-medium text-slate-800 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1">Observaciones Técnicas / Bitácora</label>
                                <textarea
                                    rows={2}
                                    value={form.observations}
                                    onChange={e => setForm({ ...form, observations: e.target.value })}
                                    placeholder="Notas de liberación técnica, comportamiento en pasteurizador o salinidad..."
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                                />
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer Actions & Export Bar */}
                <div className="px-5 py-3.5 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50/90">
                    {/* Descargas (PDF, Excel, Word con selector FQ/MB) */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ámbito:</span>
                            <select
                                value={downloadScope}
                                onChange={e => setDownloadScope(e.target.value)}
                                className="text-xs font-bold text-slate-700 bg-transparent border-0 focus:outline-none cursor-pointer"
                                disabled={downloadingFmt !== null}
                            >
                                <option value="all">Completo (FQ + MB)</option>
                                <option value="fq">Solo Físico-Químico (FQ)</option>
                                <option value="mb">Solo Microbiológico (MB)</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* Botón PDF */}
                            <button
                                type="button"
                                onClick={() => handleDownload('pdf')}
                                disabled={downloadingFmt !== null || saving}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                title="Descargar Certificado Oficial en PDF con membrete institucional"
                            >
                                {downloadingFmt === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-rose-600" />}
                                <span>PDF</span>
                            </button>

                            {/* Botón Excel */}
                            <button
                                type="button"
                                onClick={() => handleDownload('excel')}
                                disabled={downloadingFmt !== null || saving}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                title="Descargar Matriz Oficial en Excel (.xlsx)"
                            >
                                {downloadingFmt === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} className="text-emerald-600" />}
                                <span>Excel</span>
                            </button>

                            {/* Botón Word */}
                            <button
                                type="button"
                                onClick={() => handleDownload('word')}
                                disabled={downloadingFmt !== null || saving}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                                title="Descargar Informe Oficial en Word (.docx)"
                            >
                                {downloadingFmt === 'word' ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} className="text-blue-600" />}
                                <span>Word</span>
                            </button>
                        </div>
                    </div>

                    {/* Botones de acción principales */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            onClick={(e) => handleSave(e, true)}
                            disabled={saving || downloadingFmt !== null}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            <span>{saving ? 'Guardando...' : 'Guardar Dictamen LAB-004'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EggQualityFinishedProductModal;
