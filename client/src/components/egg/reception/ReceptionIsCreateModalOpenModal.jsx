import SearchableSelect from '../../ui/SearchableSelect';
import {
    Plus,
    Thermometer,
    AlertTriangle,
    XCircle,
    Boxes,
    Pencil,
    Truck,
    Settings,
    Sparkles,
    History,
    Printer,
    Eye,
    EyeOff,
    Scale,
    Layers
} from 'lucide-react';


export default function ReceptionIsCreateModalOpenModal({ model, open = model.isCreateModalOpen, onClose = () => model.setUseTarimas(false), onSave = model.handleSubmit }) {
    const { providers, providerLotConfigs, providerLotIntel, useTarimas, setUseTarimas, globalHasCaja, showDetailedTares, setShowDetailedTares, bulkAddCount, setBulkAddCount, receptionBaseBoxes, globalStorageLocation, lastDraftSavedAt, hasRestoredDraft, tarimas, formData, setFormData, isSubmitting, isCreateModalOpen, editingId, discardDraft, handleOpenPrintTarima, addTarima, addMultipleTarimas, applyStorageLocationToAll, applyEmpaqueModeToAll, removeTarima, updateTarima, handleProviderSelect, loadProvidersOptions, handleOpenLotConfig, resetForm } = model;
    if (!open) return null;
    return (<>{isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            {editingId ? <Pencil className="h-4 w-4 text-indigo-600" /> : <Plus className="h-4 w-4 text-indigo-600" />}
                            {editingId ? `Editar Recepción #${editingId} - Lote: ${formData.provider_lot || ''}` : 'Boleta de Ingreso y Control de Calidad (LOG-004)'}
                        </h2>
                        <button
                            type="button"
                            onClick={resetForm}
                            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors"
                        >
                            <XCircle size={18} />
                        </button>
                    </div>

                    {/* Presets y Proveedores Parametrizados */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Boxes size={13} className="text-indigo-600" />
                                Proveedores Frecuentes y Prefijos Parametrizados:
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 font-medium">Autocompleta proveedor y correlativo</span>
                                <button
                                    type="button"
                                    onClick={() => handleOpenLotConfig()}
                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline cursor-pointer bg-transparent border-0 p-0"
                                    title="Parametrizar prefijo de lote y taras por proveedor"
                                >
                                    <Settings size={11} />
                                    Parametrizar
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {providerLotConfigs.length > 0 ? (
                                (Array.isArray(providerLotConfigs) ? providerLotConfigs : []).map((cfg) => (
                                    <div
                                        key={cfg.id}
                                        className={`inline-flex items-center rounded-xl border shadow-xs transition-all ${
                                            String(formData.provider_id) === String(cfg.provider_id)
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleProviderSelect(cfg.provider_id)}
                                            className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-transparent border-0 text-inherit"
                                        >
                                            <span>📦 {cfg.provider_name}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                                                String(formData.provider_id) === String(cfg.provider_id)
                                                    ? 'bg-indigo-700 text-white'
                                                    : 'bg-indigo-50 border border-indigo-100 text-indigo-700'
                                            }`}>
                                                {cfg.lot_prefix}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenLotConfig(cfg.provider_id);
                                            }}
                                            title={`Editar parametrización de ${cfg.provider_name}`}
                                            className={`pr-2.5 pl-1 py-1.5 cursor-pointer transition-opacity bg-transparent border-0 ${
                                                String(formData.provider_id) === String(cfg.provider_id)
                                                    ? 'text-indigo-200 hover:text-white'
                                                    : 'text-slate-400 hover:text-indigo-600'
                                            }`}
                                        >
                                            <Settings size={12} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-[11px] text-slate-500 italic flex items-center gap-2">
                                    <span>No hay proveedores con prefijo parametrizado aún.</span>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenLotConfig()}
                                        className="text-indigo-600 font-bold underline cursor-pointer bg-transparent border-0 p-0"
                                    >
                                        Parametrizar en Configuración de Planta
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <form onSubmit={onSave} className="space-y-6">
                        {/* Banner de Borrador Dinámico Restaurado */}
                        {hasRestoredDraft && (
                            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-200 text-amber-900 rounded-lg shrink-0">
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <p className="font-extrabold text-amber-950 text-xs">
                                            Borrador de Pesaje Restaurado ({lastDraftSavedAt})
                                        </p>
                                        <p className="text-[11px] text-amber-800">
                                            Se restauraron automáticamente {tarimas.length} tarimas y datos ingresados de la sesión previa para proteger tu trabajo contra cierres accidentales.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={discardDraft}
                                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer self-start sm:self-auto shrink-0"
                                    title="Descartar el borrador y volver al formulario vacío"
                                >
                                    Descartar Borrador
                                </button>
                            </div>
                        )}

                        {/* Datos del Transporte (LOG-004) */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-2">
                                <Truck size={15} />
                                Control de Transporte & Cadena de Frío (LOG-004)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Placa de Vehículo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: C123-456"
                                        value={formData.truck_plate}
                                        onChange={(e) => setFormData({ ...formData, truck_plate: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Motorista / Chofer</label>
                                    <input
                                        type="text"
                                        placeholder="Nombre del conductor"
                                        value={formData.driver_name}
                                        onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-600 uppercase">Temp. Termoking/Cabina (°C)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ej: 4.5"
                                            value={formData.truck_temperature_c}
                                            onChange={(e) => setFormData({ ...formData, truck_temperature_c: e.target.value })}
                                            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        />
                                        <Thermometer size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Datos de la Carga */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Provider selection */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Proveedor de Origen *</label>
                                <SearchableSelect
                                    options={providers}
                                    loadOptions={loadProvidersOptions}
                                    value={formData.provider_id}
                                    onChange={(e, opt) => {
                                        handleProviderSelect(e.target.value);
                                        if (opt) {
                                            setFormData(prev => ({
                                                ...prev,
                                                provider_id: e.target.value,
                                                provider_name: opt.nombre || opt.label || prev.provider_name
                                            }));
                                        }
                                    }}
                                    valueKey="id"
                                    labelKey="nombre"
                                    placeholder="Buscar proveedor..."
                                    codeKey="nrc"
                                    codeLabel="NRC"
                                    selectedLabel={formData.provider_name}
                                    dropdownWidth={460}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Fecha de Recepción</label>
                                <input
                                    type="date"
                                    value={formData.fecha}
                                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                />
                            </div>

                            {/* Egg type */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Tipo de Huevo</label>
                                <select
                                    value={formData.egg_type}
                                    onChange={(e) => setFormData({ ...formData, egg_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                >
                                    <option value="huevo cáscara">Huevo en Cáscara</option>
                                    <option value="huevo líquido">Huevo Líquido</option>
                                    <option value="clara">Clara Líquida</option>
                                    <option value="yema">Yema Líquida</option>
                                </select>
                            </div>

                            {/* Egg color, size & classification conditionally active */}
                            {formData.egg_type === 'huevo cáscara' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Color</label>
                                        <select
                                            value={formData.egg_color}
                                            onChange={(e) => setFormData({ ...formData, egg_color: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="blanco">Blanco</option>
                                            <option value="marrón">Marrón</option>
                                            <option value="mixto">Mixto</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Tamaño / Calibre</label>
                                        <select
                                            value={formData.egg_size}
                                            onChange={(e) => setFormData({ ...formData, egg_size: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="S">S (Chico)</option>
                                            <option value="M">M (Mediano)</option>
                                            <option value="L">L (Grande)</option>
                                            <option value="XL">XL (Extra Grande)</option>
                                            <option value="Jumbo">Jumbo</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-600 uppercase">Clasificación Inicial</label>
                                        <select
                                            value={formData.egg_classification}
                                            onChange={(e) => setFormData({ ...formData, egg_classification: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="Grado AA">Grado AA (Extra Especial)</option>
                                            <option value="Grado AA y A">Grado AA y A (Doble Clasificación: Selección Especial)</option>
                                            <option value="Grado A">Grado A (Estándar Premium)</option>
                                            <option value="Grado B">Grado B (Comercial)</option>
                                            <option value="Grado Industrial">Grado Industrial</option>
                                        </select>
                                    </div>
                                </div>
                            ) : null}

                            {/* Lote del proveedor con inteligencia histórica */}
                            <div className="space-y-1 md:col-span-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                                        <span>Lote del Proveedor *</span>
                                        {providerLotIntel?.prefix && (
                                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                                Prefijo: {providerLotIntel.prefix}
                                            </span>
                                        )}
                                    </label>
                                    {providerLotIntel?.last_registered_lot && (
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            Último: <strong className="text-slate-800 font-bold">{providerLotIntel.last_registered_lot}</strong>
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.provider_lot}
                                        onChange={(e) => setFormData({ ...formData, provider_lot: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        placeholder="Ej: LOTE-AV-0908"
                                    />
                                    {providerLotIntel?.suggested_lot && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, provider_lot: providerLotIntel.suggested_lot }))}
                                            className="absolute right-2 top-2 text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                                            title="Reaplicar sugerencia inteligente"
                                        >
                                            <Sparkles size={11} />
                                            Sugerir
                                        </button>
                                    )}
                                </div>

                                {/* Desglose de Histórico de Lotes Anteriores */}
                                {providerLotIntel?.historical_lots?.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-tight">
                                            <History size={11} className="text-slate-400" />
                                            Histórico Anterior:
                                        </span>
                                        {(Array.isArray(providerLotIntel.historical_lots) ? providerLotIntel.historical_lots : []).map((hl) => (
                                            <button
                                                key={hl.id}
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, provider_lot: hl.provider_lot }))}
                                                className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded text-[10px] font-mono font-bold transition-all"
                                                title={`Registrado el ${hl.fecha || 'N/D'} (${hl.weight_lbs} lbs)`}
                                            >
                                                {hl.provider_lot}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Temperature (NO REQUERIDA / OPCIONAL) */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                    <span>Temperatura Huevo (°C)</span>
                                    <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={formData.temperature_c}
                                        onChange={(e) => setFormData({ ...formData, temperature_c: e.target.value })}
                                        className="w-full pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        placeholder="Opcional (Máx 6.0°C si aplica)"
                                        step="0.01"
                                    />
                                    <Thermometer className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                                </div>
                            </div>
                        </div>

                        {/* MODO PESAJE: DIRECTO VS TARIMAS */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                        <Boxes size={15} className="text-indigo-600" />
                                        Detalle de Pesaje & Cajas
                                    </h4>
                                    <p className="text-[11px] text-slate-500">Seleccione si registrará el peso total directo o tarima por tarima de báscula</p>
                                </div>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${!useTarimas ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Pesaje Directo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUseTarimas(true)}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${useTarimas ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                                    >
                                        Por Tarimas (Báscula)
                                    </button>
                                </div>
                            </div>

                            {!useTarimas ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Total Cajas de Huevo</label>
                                        <input
                                            type="number"
                                            value={formData.total_boxes}
                                            onChange={(e) => setFormData({ ...formData, total_boxes: parseInt(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            placeholder="Ej: 360"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Peso Neto Recibido (Libras) *</label>
                                        <input
                                            type="number"
                                            value={formData.weight_lbs}
                                            onChange={(e) => setFormData({ ...formData, weight_lbs: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                            placeholder="Ej: 16500.50"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Ubicación de Almacenamiento</label>
                                        <select
                                            value={formData.storage_location || 'abajo'}
                                            onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                        >
                                            <option value="abajo">⬇ Abajo (Nivel 1 / Piso)</option>
                                            <option value="arriba">⬆ Arriba (Nivel 2 / Rack Superior)</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Espacio Interactivo de Edición de las 3 Taras: Tarima (Pallet), Cartón (Separador) y Caja (Jaba) */}
                                    {/* Cabecera compacta de control de empaque y aviso de taras */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200 rounded-xl shadow-2xs">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                                                <Scale size={16} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                                        Registro de Tarimas en Báscula
                                                    </h4>
                                                    {lastDraftSavedAt && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-[10px] font-bold shadow-2xs" title="Taras y pesajes guardados dinámicamente en borrador local">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                            Autoguardado {lastDraftSavedAt}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-medium">
                                                    Base proveedor: <span className="font-bold text-slate-700">{receptionBaseBoxes} Cajas</span> • Las taras y ubicaciones se calculan y editan directamente en la tabla de abajo.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Switch rápido de modo de empaque, ubicación masiva y visibilidad de desglose de taras */}
                                        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                                            <button
                                                type="button"
                                                onClick={() => setShowDetailedTares(!showDetailedTares)}
                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                                    showDetailedTares
                                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                                }`}
                                                title={showDetailedTares ? 'Ocultar columnas de Tara Cartón y Tara Caja' : 'Mostrar columnas de Tara Cartón y Tara Caja'}
                                            >
                                                {showDetailedTares ? <EyeOff size={13} /> : <Eye size={13} />}
                                                <span>{showDetailedTares ? 'Ocultar Tara Cartón / Caja' : 'Ver Tara Cartón / Caja'}</span>
                                            </button>

                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ubicación:</span>
                                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => applyStorageLocationToAll('abajo')}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                            globalStorageLocation === 'abajo'
                                                                ? 'bg-blue-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica ubicación Abajo (Piso) a todas las tarimas"
                                                    >
                                                        ⬇ Abajo (Piso)
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyStorageLocationToAll('arriba')}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                            globalStorageLocation === 'arriba'
                                                                ? 'bg-amber-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica ubicación Arriba (Rack) a todas las tarimas"
                                                    >
                                                        ⬆ Arriba (Rack)
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Empaque:</span>
                                                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => applyEmpaqueModeToAll(true)}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                            globalHasCaja
                                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica modo Con Caja a todas las tarimas"
                                                    >
                                                        Con Cajas
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => applyEmpaqueModeToAll(false)}
                                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                                            !globalHasCaja
                                                                ? 'bg-amber-600 text-white shadow-xs'
                                                                : 'text-slate-600 hover:text-slate-900'
                                                        }`}
                                                        title="Aplica modo A Granel (sin cajas) a todas las tarimas"
                                                    >
                                                        A Granel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-2 text-center w-10">#</th>
                                                    <th className="p-2 w-20 text-center">Empaque</th>
                                                    <th className="p-2 w-20 text-center">Ubicación</th>
                                                    <th className="p-2 w-16 text-center">Cajas</th>
                                                    <th className="p-2 w-24 text-right">Peso Bruto (lb)</th>
                                                    <th className="p-2 w-24 text-right">Tara Tarima (lb)</th>
                                                    {showDetailedTares && (
                                                        <>
                                                            <th className="p-2 w-24 text-right bg-indigo-50/50 text-indigo-900">Tara Cartón (lb)</th>
                                                            <th className="p-2 w-24 text-right bg-indigo-50/50 text-indigo-900">Tara Caja (lb)</th>
                                                        </>
                                                    )}
                                                    <th className="p-2 w-28 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span>Tara Total (lb)</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowDetailedTares(!showDetailedTares)}
                                                                className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 cursor-pointer"
                                                                title={showDetailedTares ? "Ocultar columnas de cartón y caja" : "Mostrar columnas de cartón y caja"}
                                                            >
                                                                {showDetailedTares ? <EyeOff size={12} /> : <Eye size={12} />}
                                                            </button>
                                                        </div>
                                                    </th>
                                                    <th className="p-2 text-right w-24">Peso Neto (lb)</th>
                                                    <th className="p-2 w-16 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                                {(Array.isArray(tarimas) ? tarimas : []).map((t, idx) => {
                                                    const hasC = t.has_caja !== undefined ? t.has_caja : globalHasCaja;

                                                    return (
                                                        <tr key={t.id || idx} className="hover:bg-slate-50">
                                                            <td className="p-2 text-center text-slate-500 text-xs font-bold">{t.tarima_number}</td>
                                                            <td className="p-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateTarima(idx, 'has_caja', !hasC)}
                                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                                                        hasC
                                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                                                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                                                    }`}
                                                                    title="Clic para alternar entre Con Caja y A Granel"
                                                                >
                                                                    {hasC ? 'Con Caja' : 'A Granel'}
                                                                </button>
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateTarima(idx, 'storage_location', (t.storage_location || 'abajo') === 'abajo' ? 'arriba' : 'abajo')}
                                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs ${
                                                                        (t.storage_location || 'abajo') === 'abajo'
                                                                            ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                                                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                                                                    }`}
                                                                    title="Clic para alternar entre Abajo (Piso) y Arriba (Rack)"
                                                                >
                                                                    {(t.storage_location || 'abajo') === 'abajo' ? '⬇ Abajo' : '⬆ Arriba'}
                                                                </button>
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    value={t.boxes_count}
                                                                    onChange={(e) => updateTarima(idx, 'boxes_count', e.target.value)}
                                                                    className="w-full px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    placeholder="0.0"
                                                                    value={t.gross_weight_lbs}
                                                                    onChange={(e) => updateTarima(idx, 'gross_weight_lbs', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.1"
                                                                    min="0"
                                                                    placeholder="0.0"
                                                                    value={t.tare_pallet_lbs !== undefined ? t.tare_pallet_lbs : ''}
                                                                    onChange={(e) => updateTarima(idx, 'tare_pallet_lbs', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                    title="Tara física del pallet/tarima en báscula"
                                                                />
                                                            </td>
                                                            {showDetailedTares && (
                                                                <>
                                                                    <td className="p-2 bg-indigo-50/20">
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            min="0"
                                                                            placeholder="0.0"
                                                                            value={t.tare_separador_lbs !== undefined ? t.tare_separador_lbs : ''}
                                                                            onChange={(e) => updateTarima(idx, 'tare_separador_lbs', e.target.value)}
                                                                            className="w-full px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                            title="Tara de separadores de cartón"
                                                                        />
                                                                    </td>
                                                                    <td className="p-2 bg-indigo-50/20">
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            min="0"
                                                                            placeholder="0.0"
                                                                            value={t.tare_caja_lbs !== undefined ? t.tare_caja_lbs : ''}
                                                                            onChange={(e) => updateTarima(idx, 'tare_caja_lbs', e.target.value)}
                                                                            className="w-full px-2 py-1 bg-white border border-indigo-200 rounded-lg text-xs text-slate-800 font-bold text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                            title="Tara de cajas o jabas plásticas"
                                                                        />
                                                                    </td>
                                                                </>
                                                            )}
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={t.tare_weight_lbs}
                                                                    onChange={(e) => updateTarima(idx, 'tare_weight_lbs', e.target.value)}
                                                                    className="w-full px-2 py-1 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs text-indigo-900 font-black text-right focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                                                    title={`Tara Total: ${t.tare_weight_lbs} lb (Pallet: ${t.tare_pallet_lbs || 0} lb + Cartón: ${t.tare_separador_lbs || 0} lb + Caja: ${t.tare_caja_lbs || 0} lb)`}
                                                                />
                                                            </td>
                                                            <td className="p-2 text-right font-black text-emerald-700 text-xs">
                                                                {parseFloat(t.net_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lb
                                                            </td>
                                                            <td className="p-2 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenPrintTarima(t, tarimas)}
                                                                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors shadow-xs"
                                                                        title={`Imprimir Ficha / Etiqueta de Tarima #${t.tarima_number}`}
                                                                    >
                                                                        <Printer size={14} />
                                                                    </button>
                                                                    {tarimas.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeTarima(idx)}
                                                                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                                                            title="Eliminar Tarima"
                                                                        >
                                                                            <XCircle size={15} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => addTarima(24, globalHasCaja)}
                                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-xs transition-all"
                                            >
                                                <Plus size={14} />
                                                Agregar Tarima #{tarimas.length + 1}
                                            </button>

                                            {/* Control de adición de múltiples tarimas */}
                                            <div className="inline-flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                                <span className="text-[11px] font-bold text-slate-500 pl-1.5">Lote:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={bulkAddCount}
                                                    onChange={(e) => setBulkAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-800 focus:bg-white"
                                                    placeholder="10"
                                                    title="Cantidad de tarimas a generar en bloque"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => addMultipleTarimas(bulkAddCount, 24, globalHasCaja)}
                                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 flex items-center gap-1 transition-all"
                                                    title={`Agregar ${bulkAddCount} tarimas de 24 cajas de un solo`}
                                                >
                                                    <Layers size={13} />
                                                    + Agregar {bulkAddCount} Tarimas
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenPrintTarima(tarimas[0], tarimas)}
                                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-1.5 shadow-xs transition-all"
                                                title="Imprimir etiquetas de todas las tarimas registradas"
                                            >
                                                <Printer size={14} />
                                                Imprimir Tarimas ({tarimas.length})
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs shadow-xs">
                                            <span className="text-slate-500">Tarimas: <strong className="text-slate-800">{tarimas.length}</strong></span>
                                            <span className="text-slate-500">Total Cajas: <strong className="text-indigo-700">{formData.total_boxes}</strong></span>
                                            <span className="text-slate-500">Neto Total: <strong className="text-emerald-700">{formData.weight_lbs || '0.00'} lb</strong></span>
                                            {parseFloat(formData.total_boxes || 0) > 0 && parseFloat(formData.weight_lbs || 0) > 0 && (
                                                <span className="text-slate-500">Prom. Caja: <strong className="text-indigo-900 font-bold">{(parseFloat(formData.weight_lbs) / parseFloat(formData.total_boxes)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lb/cj</strong></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Certificados y Calidad Inicial */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Estado Inicial Calidad</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                >
                                    <option value="pendiente_aprobacion">⏳ Pendiente de Aprobación (Por defecto)</option>
                                    <option value="aprobado">✅ Aprobado para Producción</option>
                                    <option value="cuarentena">⚠️ En Cuarentena</option>
                                    <option value="rechazado">❌ Rechazado (No Apto)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">URLs Certificados Inocuidad</label>
                                <input
                                    type="text"
                                    value={formData.certificate_urls}
                                    onChange={(e) => setFormData({ ...formData, certificate_urls: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                                    placeholder="Ej: https://docs.quality.com/cert1.pdf"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-55"
                            >
                                {isSubmitting ? 'Guardando...' : (editingId ? 'Guardar Cambios' : 'Confirmar Ingreso')}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}</>);
}
