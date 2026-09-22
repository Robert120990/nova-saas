import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import SearchableSelect from '../ui/SearchableSelect';
import { Tag, XCircle, Scale, ExternalLink, Save } from 'lucide-react';

export default function ProviderLotConfigModal({
    isOpen,
    onClose,
    configToEdit = null,
    initialProviderId = '',
    providers = [],
    loadProvidersOptions = null,
    onSaved = null
}) {
    const [saving, setSaving] = useState(false);
    const [lotConfigForm, setLotConfigForm] = useState({
        provider_id: '',
        provider_name: '',
        provider_nrc: '',
        lot_prefix: '',
        suffix_format: 'correlativo',
        tare_tarima_lbs: 0,
        tare_separador_lbs: 48,
        tare_caja_lbs: 30,
        base_boxes_per_tarima: 24,
        default_has_caja: true,
        notes: ''
    });

    useEffect(() => {
        if (!isOpen) return;

        if (configToEdit) {
            setLotConfigForm({
                provider_id: configToEdit.provider_id || '',
                provider_name: configToEdit.provider_name || '',
                provider_nrc: configToEdit.provider_nrc || '',
                lot_prefix: configToEdit.lot_prefix || '',
                suffix_format: configToEdit.format_pattern || configToEdit.suffix_format || 'correlativo',
                tare_tarima_lbs: configToEdit.tare_tarima_lbs !== undefined ? configToEdit.tare_tarima_lbs : 0,
                tare_separador_lbs: configToEdit.tare_separador_lbs !== undefined ? configToEdit.tare_separador_lbs : 48,
                tare_caja_lbs: configToEdit.tare_caja_lbs !== undefined ? configToEdit.tare_caja_lbs : 30,
                base_boxes_per_tarima: configToEdit.base_boxes_per_tarima || 24,
                default_has_caja: configToEdit.default_has_caja !== undefined ? Boolean(configToEdit.default_has_caja) : true,
                notes: configToEdit.notes || ''
            });
        } else if (initialProviderId) {
            const matchedProv = providers.find(p => String(p.id) === String(initialProviderId));
            setLotConfigForm({
                provider_id: initialProviderId,
                provider_name: matchedProv?.nombre || '',
                provider_nrc: matchedProv?.nrc || '',
                lot_prefix: '',
                suffix_format: 'correlativo',
                tare_tarima_lbs: 0,
                tare_separador_lbs: 48,
                tare_caja_lbs: 30,
                base_boxes_per_tarima: 24,
                default_has_caja: true,
                notes: ''
            });
        } else {
            setLotConfigForm({
                provider_id: '',
                provider_name: '',
                provider_nrc: '',
                lot_prefix: '',
                suffix_format: 'correlativo',
                tare_tarima_lbs: 0,
                tare_separador_lbs: 48,
                tare_caja_lbs: 30,
                base_boxes_per_tarima: 24,
                default_has_caja: true,
                notes: ''
            });
        }
    }, [isOpen, configToEdit, initialProviderId, providers]);

    if (!isOpen) return null;

    const defaultLoadProviders = async (search, page) => {
        if (loadProvidersOptions) {
            return await loadProvidersOptions(search, page);
        }
        try {
            const { data } = await axios.get('/api/providers', {
                params: { search, page, limit: 20 }
            });
            return {
                options: Array.isArray(data) ? data : (data.data || []),
                hasMore: data.page < data.totalPages
            };
        } catch (e) {
            console.error('Error loading providers:', e);
            return { options: [], hasMore: false };
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!lotConfigForm.provider_id) {
            return toast.error('Debe seleccionar un proveedor.');
        }
        if (!lotConfigForm.lot_prefix.trim()) {
            return toast.error('Debe ingresar un prefijo de lote.');
        }

        setSaving(true);
        try {
            const payload = {
                provider_id: lotConfigForm.provider_id,
                lot_prefix: lotConfigForm.lot_prefix.trim().toUpperCase(),
                format_pattern: lotConfigForm.suffix_format,
                suffix_format: lotConfigForm.suffix_format,
                tare_tarima_lbs: parseFloat(lotConfigForm.tare_tarima_lbs) || 0,
                tare_separador_lbs: parseFloat(lotConfigForm.tare_separador_lbs) || 48,
                tare_caja_lbs: parseFloat(lotConfigForm.tare_caja_lbs) || 30,
                base_boxes_per_tarima: parseInt(lotConfigForm.base_boxes_per_tarima) || 24,
                default_has_caja: lotConfigForm.default_has_caja ? 1 : 0,
                notes: lotConfigForm.notes
            };

            await axios.post('/api/egg-industrial/provider-lot-configs', payload);
            toast.success('Parametrización de lote y taras guardada.');
            if (onSaved) {
                await onSaved({
                    ...payload,
                    provider_name: lotConfigForm.provider_name,
                    provider_nrc: lotConfigForm.provider_nrc
                });
            }
            onClose();
        } catch (error) {
            console.error('Error saving lot config:', error);
            toast.error(error.response?.data?.message || 'Error al guardar parametrización de lote.');
        } finally {
            setSaving(false);
        }
    };

    const baseB = parseInt(lotConfigForm.base_boxes_per_tarima) || 24;
    const tareTarima = parseFloat(lotConfigForm.tare_tarima_lbs) || 0;
    const tareSep = parseFloat(lotConfigForm.tare_separador_lbs) || 0;
    const tareCaja = parseFloat(lotConfigForm.tare_caja_lbs) || 0;
    const rateSep = baseB > 0 ? (tareSep / baseB) : 2.0;
    const rateCaja = baseB > 0 ? (tareCaja / baseB) : 1.25;
    const totalTareEstimada = tareTarima + tareSep + (lotConfigForm.default_has_caja ? tareCaja : 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto text-slate-900 space-y-4 sm:space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                            <Tag size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                {configToEdit ? 'Editar Parametrización de Proveedor' : 'Parametrizar Proveedor y Taras'}
                            </h3>
                            <p className="text-[11px] text-slate-500 font-medium">Reglas de codificación de lote y peso tara por tarima</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                    >
                        <XCircle size={20} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    {/* Proveedor */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                            Proveedor Avícola *
                        </label>
                        <SearchableSelect
                            options={providers}
                            loadOptions={defaultLoadProviders}
                            value={lotConfigForm.provider_id}
                            onChange={(e, opt) => setLotConfigForm(prev => ({
                                ...prev,
                                provider_id: e.target.value,
                                provider_name: opt ? (opt.nombre || opt.label) : prev.provider_name,
                                provider_nrc: opt ? opt.nrc : prev.provider_nrc
                            }))}
                            valueKey="id"
                            labelKey="nombre"
                            placeholder="Seleccionar proveedor de huevo..."
                            codeKey="nrc"
                            codeLabel="NRC"
                            selectedLabel={
                                lotConfigForm.provider_name
                                    ? `${lotConfigForm.provider_nrc ? `NRC: ${lotConfigForm.provider_nrc} - ` : ''}${lotConfigForm.provider_name}`
                                    : (configToEdit?.provider_name ? `${configToEdit?.provider_nrc ? `NRC: ${configToEdit.provider_nrc} - ` : ''}${configToEdit.provider_name}` : null)
                            }
                            dropdownWidth={440}
                        />
                    </div>

                    {/* Prefijo y Formato */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                                Prefijo de Lote Habitual *
                            </label>
                            <input
                                type="text"
                                value={lotConfigForm.lot_prefix}
                                onChange={(e) => setLotConfigForm({ ...lotConfigForm, lot_prefix: e.target.value.toUpperCase() })}
                                placeholder="Ej: INAVI, HD-25918"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                            />
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                Código impreso o prefijo habitual.
                            </span>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                                Formato de Sufijo
                            </label>
                            <select
                                value={lotConfigForm.suffix_format}
                                onChange={(e) => setLotConfigForm({ ...lotConfigForm, suffix_format: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                            >
                                <option value="correlativo">Correlativo Numérico (-01, -02...)</option>
                                <option value="fecha-juliana">Fecha Juliana del Día (J-DDD)</option>
                                <option value="secuencial">Secuencial Puro (1, 2, 3...)</option>
                            </select>
                        </div>
                    </div>

                    {/* Parámetros de Tara Estándar por Tarima */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Scale size={14} className="text-indigo-600" />
                                Parámetros de Tara por Defecto (Por Tarima)
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">Auto-cálculo de recepción</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                    Cajas Base
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={lotConfigForm.base_boxes_per_tarima}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, base_boxes_per_tarima: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                                    placeholder="24"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block" title="Peso de la tarima/pallet físico de madera o plástico">
                                    Tara Tarima (lb)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={lotConfigForm.tare_tarima_lbs}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, tare_tarima_lbs: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                    Tara Separador (lb) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={lotConfigForm.tare_separador_lbs}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, tare_separador_lbs: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                                    placeholder="48.00"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                    Tara Caja/Jaba (lb) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={lotConfigForm.tare_caja_lbs}
                                    onChange={(e) => setLotConfigForm({ ...lotConfigForm, tare_caja_lbs: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                                    placeholder="30.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                                Empaque Habitual de Envío
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setLotConfigForm({ ...lotConfigForm, default_has_caja: true })}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                                        lotConfigForm.default_has_caja
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    Con Cajas / Jabas
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLotConfigForm({ ...lotConfigForm, default_has_caja: false })}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                                        !lotConfigForm.default_has_caja
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    A Granel (Solo Separador)
                                </button>
                            </div>
                        </div>

                        {/* Tasas calculadas */}
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
                            <div className="flex justify-between items-center font-medium">
                                <span>Tasa Separador/Cartón:</span>
                                <strong className="text-slate-900 font-mono">
                                    {rateSep.toFixed(2)} lb/caja
                                </strong>
                            </div>
                            <div className="flex justify-between items-center font-medium">
                                <span>Tasa Jaba/Caja:</span>
                                <strong className="text-slate-900 font-mono">
                                    {rateCaja.toFixed(2)} lb/caja
                                </strong>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-slate-100 font-black text-indigo-700">
                                <span>Tara Estimada ({baseB} cjs {lotConfigForm.default_has_caja ? 'con caja' : 'a granel'}):</span>
                                <span className="font-mono text-xs">
                                    {totalTareEstimada.toFixed(2)} lb
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Notas */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                            Notas o Ubicación de Granja
                        </label>
                        <textarea
                            value={lotConfigForm.notes}
                            onChange={(e) => setLotConfigForm({ ...lotConfigForm, notes: e.target.value })}
                            placeholder="Ej: Galpón principal, granja Sonsonate..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-14 shadow-xs"
                        />
                    </div>

                    {/* Preview sugerencia */}
                    {lotConfigForm.lot_prefix && (
                        <div className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-center justify-between">
                            <span className="font-semibold text-[11px]">Sugerencia de lote en recepción:</span>
                            <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700">
                                {lotConfigForm.lot_prefix}-01
                            </span>
                        </div>
                    )}

                    {/* Footer buttons */}
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                        <Link
                            to="/industrial/configuracion?tab=lot-prefixes"
                            target="_blank"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline self-start sm:self-center"
                        >
                            <ExternalLink size={12} />
                            Ver módulo de configuración
                        </Link>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Save size={13} />
                                {saving ? 'Guardando...' : 'Guardar Parámetros'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
