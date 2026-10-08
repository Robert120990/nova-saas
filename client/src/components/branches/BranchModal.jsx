import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../ui/Modal';
import { Info } from 'lucide-react';
import { toast } from 'sonner';

const REQUIRED_FIELDS = [
    ['codigo', 'Código'],
    ['tipo_establecimiento', 'Tipo de establecimiento'],
    ['nombre', 'Nombre'],
    ['ambiente', 'Ambiente'],
    ['departamento', 'Departamento'],
    ['municipio', 'Municipio'],
    ['distrito', 'Distrito'],
    ['direccion', 'Dirección']
];

const formatPercentages = (val) => {
    if (!val) return '5, 10, 15, 20';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed.join(', '); } catch { /* ignore */ }
        return val;
    }
    return '5, 10, 15, 20';
};

const BranchModal = ({
    isOpen,
    onClose,
    branch,
    onSave,
    isSaving,
    departments = [],
    establishmentTypes = [],
    environments = []
}) => {
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [selectedDistrito, setSelectedDistrito] = useState('');
    const [selectedEnv, setSelectedEnv] = useState('2');
    const [omitirDigitoVerificador, setOmitirDigitoVerificador] = useState(false);
    const [remisionConValores, setRemisionConValores] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [hasImageError, setHasImageError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedDept(branch?.departamento || '');
            setSelectedMun(branch?.municipio || '');
            setSelectedDistrito(branch?.distrito || '');
            setSelectedEnv(branch?.ambiente || '2');
            setOmitirDigitoVerificador(Boolean(branch?.omitir_digito_verificador));
            setRemisionConValores(Boolean(branch?.remision_con_valores));
            setPreviewUrl(null);
            setRemoveLogo(false);
            setHasImageError(false);
        }
    }, [isOpen, branch]);

    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept && isOpen
    });

    const { data: distritos = [] } = useQuery({
        queryKey: ['catalogs', 'distritos', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/districts?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept && isOpen
    });

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const values = Object.fromEntries(formData.entries());
        const missing = REQUIRED_FIELDS.filter(([name]) => !String(values[name] ?? '').trim());
        if (missing.length > 0) {
            toast.error(`Complete los siguientes campos: ${missing.map(([, label]) => label).join(', ')}`);
            form.querySelector(`[name="${missing[0][0]}"]`)?.focus();
            return;
        }
        onSave({ formData, editId: branch?.id || null });
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={branch ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}
            maxWidth="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Código</label>
                        <input name="codigo" defaultValue={branch?.codigo} placeholder="001" className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Tipo de Establecimiento</label>
                        <select name="tipo_establecimiento" defaultValue={branch?.tipo_establecimiento || '01'} className={fieldCls}>
                            {establishmentTypes.map(t => (
                                <option key={t.code} value={t.code}>{t.description}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label className={labelCls}>Nombre de Sucursal / Establecimiento</label>
                    <input name="nombre" defaultValue={branch?.nombre} placeholder="Ej: Sucursal Escalón" className={fieldCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Teléfono</label>
                        <input name="telefono" defaultValue={branch?.telefono} placeholder="2200-0000" className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Correo (Opcional)</label>
                        <input name="correo" type="email" defaultValue={branch?.correo} placeholder="sucursal@empresa.com" className={fieldCls} />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Código MH</label>
                        <input name="codigo_mh" defaultValue={branch?.codigo_mh} placeholder="Código Ministerio de Hacienda" className={fieldCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Ambiente de Facturación</label>
                        <select name="ambiente" value={selectedEnv} onChange={(e) => setSelectedEnv(e.target.value)} className={fieldCls}>
                            <option value="">Seleccionar</option>
                            {environments?.map(env => <option key={env.code} value={env.code}>{env.description}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Departamento</label>
                        <select
                            name="departamento"
                            className={fieldCls}
                            value={selectedDept}
                            onChange={(e) => { setSelectedDept(e.target.value); setSelectedMun(''); setSelectedDistrito(''); }}
                        >
                            <option value="">Seleccionar</option>
                            {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Municipio</label>
                        <select name="municipio" value={selectedMun} onChange={(e) => setSelectedMun(e.target.value)} className={fieldCls}>
                            <option value="">Seleccionar</option>
                            {municipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Distrito</label>
                        <select name="distrito" value={selectedDistrito} onChange={(e) => setSelectedDistrito(e.target.value)} className={fieldCls}>
                            <option value="">Seleccionar</option>
                            {distritos?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div>
                        <label className={labelCls}>Omitir Dígito Verificador</label>
                        <button
                            type="button"
                            onClick={() => setOmitirDigitoVerificador(v => !v)}
                            className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all ${
                                omitirDigitoVerificador
                                    ? 'bg-indigo-50 border-indigo-200'
                                    : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            <span className="text-sm font-semibold text-slate-700 text-left">
                                Omitir el último dígito del código al leer en POS
                            </span>
                            <span className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shrink-0 ${omitirDigitoVerificador ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <span className={`inline-block w-4 h-4 transform rounded-full bg-white transition-transform ${omitirDigitoVerificador ? 'translate-x-6' : 'translate-x-1'}`} />
                            </span>
                        </button>
                        <input
                            type="hidden"
                            name="omitir_digito_verificador"
                            value={omitirDigitoVerificador ? '1' : '0'}
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Valorizar Nota de Remisión (DTE-04)</label>
                        <button
                            type="button"
                            onClick={() => setRemisionConValores(v => !v)}
                            className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all ${
                                remisionConValores
                                    ? 'bg-indigo-50 border-indigo-200'
                                    : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            <div className="flex flex-col text-left pr-2">
                                <span className="text-sm font-semibold text-slate-700">
                                    Emitir con precios y montos reales
                                </span>
                                <span className="text-[11px] text-slate-400">
                                    {remisionConValores
                                        ? 'Activo: La nota se emitirá con precios y totales reales calculados.'
                                        : 'Inactivo: Mantendrá el comportamiento actual con precio simbólico ($0.00).'}
                                </span>
                            </div>
                            <span className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors shrink-0 ${remisionConValores ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <span className={`inline-block w-4 h-4 transform rounded-full bg-white transition-transform ${remisionConValores ? 'translate-x-6' : 'translate-x-1'}`} />
                            </span>
                        </button>
                        <input
                            type="hidden"
                            name="remision_con_valores"
                            value={remisionConValores ? '1' : '0'}
                        />
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1 block mb-2">Políticas de Descuento (POS)</label>
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                        <div>
                            <label className={labelCls}>Porcentajes Rápidos Disponibles (%)</label>
                            <input 
                                name="discount_percentages" 
                                defaultValue={formatPercentages(branch?.discount_percentages)} 
                                placeholder="5, 10, 15, 20" 
                                className={fieldCls} 
                            />
                            <span className="text-[10px] text-slate-400 mt-1 block">Valores separados por comas. Se mostrarán como botones rápidos en la terminal.</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Porcentaje Máximo Permitido (%)</label>
                                <input 
                                    name="max_discount_percentage" 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    max="100" 
                                    defaultValue={branch?.max_discount_percentage ?? ''} 
                                    placeholder="Ej: 50 (opcional)" 
                                    className={fieldCls} 
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Monto Máximo de Descuento ($)</label>
                                <input 
                                    name="max_discount_amount" 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    defaultValue={branch?.max_discount_amount ?? ''} 
                                    placeholder="Ej: 100.00 (opcional)" 
                                    className={fieldCls} 
                                />
                            </div>
                            <div className="col-span-1 sm:col-span-2 p-2.5 sm:p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-slate-600">
                                <div className="flex items-center gap-1.5 font-bold text-indigo-900 uppercase text-[10px] tracking-wider mb-1.5">
                                    <Info size={13} className="text-indigo-600 shrink-0" />
                                    <span>Reglas de Aplicación y Control de Topes</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] leading-relaxed">
                                    <p><strong className="text-slate-800">• Porcentaje Máximo (%):</strong> Tope de margen por producto y general.</p>
                                    <p><strong className="text-slate-800">• Monto Máximo ($):</strong> Tope monetario máximo acumulado por ticket.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Dirección</label>
                    <textarea name="direccion" defaultValue={branch?.direccion} placeholder="Calle, pasaje, local..." className={`${fieldCls} h-20 resize-none`} />
                </div>

                <div>
                    <label className={labelCls}>Logo</label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-3 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                        <div className="flex-1 w-full">
                            <input 
                                name="logo" 
                                type="file" 
                                accept="image/*" 
                                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setPreviewUrl(URL.createObjectURL(file));
                                        setRemoveLogo(false);
                                        setHasImageError(false);
                                    }
                                }}
                            />
                            <p className="mt-1 text-[10px] text-slate-400">PNG, JPG o GIF. Máximo 2MB.</p>
                        </div>
                        <input type="hidden" name="remove_logo" value={removeLogo ? '1' : '0'} />
                        {(previewUrl || (branch?.logo_url && !hasImageError)) && !removeLogo && (
                            <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 shadow-sm relative group">
                                <img 
                                    src={previewUrl || branch.logo_url} 
                                    alt="Vista previa" 
                                    className="w-full h-full object-contain"
                                    onError={() => { if (!previewUrl) setHasImageError(true); }}
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                    <button type="button" onClick={() => { setRemoveLogo(true); setPreviewUrl(null); }} className="text-[8px] bg-red-600 text-white font-bold uppercase px-1.5 py-0.5 rounded pointer-events-auto hover:bg-red-700 transition-colors">
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        )}
                        {removeLogo && (
                            <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-[8px] text-red-600 font-bold uppercase text-center leading-tight">Logo<br/>eliminado</span>
                            </div>
                        )}
                        {hasImageError && !previewUrl && !removeLogo && (
                            <div className="px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700 flex items-center shrink-0">
                                Logo no disponible
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95">
                        {isSaving ? 'Guardando…' : branch ? 'Actualizar' : 'Registrar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default BranchModal;
