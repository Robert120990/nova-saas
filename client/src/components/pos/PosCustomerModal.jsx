import { UserCheck, Info } from 'lucide-react';
import Modal from '../ui/Modal';
import SearchableSelect from '../ui/SearchableSelect';

/**
 * PosCustomerModal Component
 * Full modal for customer creation and editing directly within POS terminal,
 * including Salvadoran tax compliance fields (DUI/NIT, NRC, activities CAT-019,
 * tax conditions, and municipal territorial divisions).
 */
const PosCustomerModal = ({
    isOpen,
    onClose,
    editingCustomer,
    handleCustomerSubmit,
    condicionFiscal,
    setCondicionFiscal,
    nrcValue,
    setNrcValue,
    docType,
    setDocType,
    docNumberValue,
    setDocNumberValue,
    formatDocumentNumber,
    formatNRC,
    isCustomerForeign,
    selectedPais,
    setSelectedPais,
    countries = [],
    activities = [],
    selectedActivity,
    setSelectedActivity,
    selectedDept,
    setSelectedDept,
    selectedMun,
    setSelectedMun,
    selectedDistrito,
    setSelectedDistrito,
    departments = [],
    distritos = [],
    municipalities = []
}) => {
    if (!isOpen) return null;

    const customerFieldCls = "w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-[13px] font-medium text-slate-800";
    const customerLabelCls = "block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
    const isCustomerAddressRequired = condicionFiscal === 'contribuyente' || condicionFiscal === 'gran contribuyente' || Boolean(nrcValue && nrcValue.trim());

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <UserCheck size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">
                            {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {editingCustomer ? 'Actualizar información fiscal y comercial' : 'Registro de nuevo cliente o contribuyente'}
                        </p>
                    </div>
                </div>
            }
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleCustomerSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="sm:col-span-2">
                        <label className={customerLabelCls}>
                            Nombre / Razón Social <span className="text-rose-500">*</span>
                        </label>
                        <input 
                            name="nombre" 
                            defaultValue={editingCustomer?.nombre} 
                            required 
                            placeholder="Ej: Comercializadora San Salvador S.A. de C.V."
                            className={customerFieldCls} 
                        />
                    </div>

                    <div>
                        <label className={customerLabelCls}>Nombre Comercial</label>
                        <input 
                            name="nombre_comercial" 
                            defaultValue={editingCustomer?.nombre_comercial} 
                            placeholder="Ej: Supertienda Central"
                            className={customerFieldCls} 
                        />
                    </div>

                    <div>
                        <label className={customerLabelCls}>Tipo de Documento</label>
                        <select 
                            name="tipo_documento" 
                            value={docType} 
                            onChange={(e) => {
                                const nextType = e.target.value;
                                setDocType(nextType);
                                if (formatDocumentNumber) {
                                    setDocNumberValue(formatDocumentNumber(docNumberValue, nextType));
                                }
                            }}
                            className={customerFieldCls}
                        >
                            <option value="DUI">DUI (Consumidor Final)</option>
                            <option value="NIT">NIT (Contribuyente / Empresa)</option>
                            <option value="Pasaporte">Pasaporte</option>
                            <option value="Carnet Resident">Carnet de Residente</option>
                            <option value="Otro">Otro Documento</option>
                        </select>
                    </div>

                    <div>
                        <label className={customerLabelCls}>Número de Documento (DUI / NIT)</label>
                        <input 
                            name="numero_documento" 
                            value={docNumberValue} 
                            onChange={(e) => {
                                if (formatDocumentNumber) {
                                    setDocNumberValue(formatDocumentNumber(e.target.value, docType));
                                } else {
                                    setDocNumberValue(e.target.value);
                                }
                            }}
                            placeholder={docType === 'DUI' ? "00000000-0" : docType === 'NIT' ? "0000-000000-000-0" : "Número de documento"} 
                            className={`${customerFieldCls} font-mono`} 
                            maxLength={docType === 'DUI' ? 10 : docType === 'NIT' ? 17 : 25}
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">
                            {docType === 'DUI' 
                                ? 'Persona Natural: DUI homologado (9 dígitos).' 
                                : docType === 'NIT' 
                                ? 'Empresas / Sociedades (S.A. de C.V.): NIT institucional (14 dígitos).' 
                                : 'Número de documento de identificación extranjera.'}
                        </p>
                    </div>

                    <div>
                        <label className={customerLabelCls}>NRC (Registro de Contribuyente)</label>
                        <input 
                            name="nrc" 
                            value={nrcValue} 
                            onChange={(e) => {
                                const formatted = formatNRC ? formatNRC(e.target.value) : e.target.value;
                                setNrcValue(formatted);
                                const clean = formatted.replace(/\D/g, '');
                                if (clean.length > 0) {
                                    if (condicionFiscal === 'otro') {
                                        setCondicionFiscal('contribuyente');
                                    }
                                } else {
                                    if (condicionFiscal === 'contribuyente') {
                                        setCondicionFiscal('otro');
                                    }
                                }
                            }}
                            placeholder="000000-0" 
                            className={`${customerFieldCls} font-mono`} 
                        />
                    </div>

                    {isCustomerForeign && (
                        <div className="sm:col-span-2">
                            <label className={customerLabelCls}>País de Origen</label>
                            <select 
                                name="pais" 
                                value={selectedPais} 
                                onChange={(e) => setSelectedPais(e.target.value)} 
                                className={customerFieldCls} 
                                required
                            >
                                {countries.map(t => <option key={t.code} value={t.code}>{t.description}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className={customerLabelCls}>Actividad Económica (Giro - CAT-019)</label>
                        <SearchableSelect 
                            name="codigo_actividad" 
                            options={activities} 
                            value={selectedActivity} 
                            onChange={(e) => setSelectedActivity(e.target.value)}
                            placeholder="Seleccionar actividad económica"
                        />
                    </div>

                    <div>
                        <label className={customerLabelCls}>Condición Fiscal</label>
                        <select 
                            name="condicion_fiscal" 
                            value={condicionFiscal} 
                            onChange={(e) => setCondicionFiscal(e.target.value)} 
                            className={customerFieldCls}
                        >
                            <option value="contribuyente">Contribuyente</option>
                            <option value="gran contribuyente">Gran Contribuyente</option>
                            <option value="exento IVA">Exento IVA</option>
                            <option value="extranjero">Extranjero</option>
                            <option value="otro">Otro (Consumidor Final)</option>
                        </select>
                    </div>

                    <div>
                        <label className={customerLabelCls}>Teléfono</label>
                        <input 
                            name="telefono" 
                            defaultValue={editingCustomer?.telefono} 
                            placeholder="2200-0000" 
                            className={customerFieldCls} 
                        />
                    </div>

                    <div>
                        <label className={customerLabelCls}>Correo Electrónico</label>
                        <input 
                            name="correo" 
                            type="email" 
                            defaultValue={editingCustomer?.correo} 
                            placeholder="cliente@ejemplo.com" 
                            className={customerFieldCls} 
                        />
                    </div>
                </div>

                <div className="w-full flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-slate-500 leading-relaxed">
                        <p><span className="font-bold text-slate-600">Percepción</span> = tú eres el agente de percepción (GC cobrándole a uno pequeño).</p>
                        <p><span className="font-bold text-slate-600">Retención</span> = el cliente es el agente (GC grande reteniéndote a ti).</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={customerLabelCls}>
                            Departamento {isCustomerAddressRequired && <span className="text-rose-500">*</span>}
                        </label>
                        <select 
                            name="departamento" 
                            className={customerFieldCls} 
                            value={selectedDept} 
                            onChange={(e) => { 
                                setSelectedDept(e.target.value); 
                                setSelectedMun(''); 
                                setSelectedDistrito(''); 
                            }} 
                            required={isCustomerAddressRequired}
                        >
                            <option value="">Seleccionar</option>
                            {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={customerLabelCls}>
                            Distrito {isCustomerAddressRequired && <span className="text-rose-500">*</span>}
                        </label>
                        <select 
                            name="distrito" 
                            value={selectedDistrito} 
                            onChange={(e) => { 
                                const sel = distritos.find(d => d.code === e.target.value); 
                                setSelectedDistrito(e.target.value); 
                                setSelectedMun(sel?.muni_code || ''); 
                            }} 
                            className={customerFieldCls} 
                            required={isCustomerAddressRequired}
                        >
                            <option value="">Seleccionar</option>
                            {distritos?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={customerLabelCls}>
                            Municipio {isCustomerAddressRequired && <span className="text-rose-500">*</span>}
                        </label>
                        <select 
                            name="municipio" 
                            value={selectedMun} 
                            onChange={(e) => setSelectedMun(e.target.value)} 
                            className={customerFieldCls} 
                            required={isCustomerAddressRequired}
                        >
                            <option value="">Seleccionar</option>
                            {municipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className={customerLabelCls}>
                        Dirección Exacta {isCustomerAddressRequired && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea 
                        name="direccion" 
                        defaultValue={editingCustomer?.direccion} 
                        required={isCustomerAddressRequired} 
                        placeholder={isCustomerAddressRequired ? "Dirección completa..." : "Dirección completa (opcional)..."} 
                        className={`${customerFieldCls} h-14 resize-none`} 
                    />
                </div>

                {/* Impuestos y Exenciones Compactos */}
                <div className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-xl flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Tributario:</span>
                    {[
                        { id: 'exento_iva', label: 'Exento IVA', default: false },
                        { id: 'aplica_fovial', label: 'Aplica FOVIAL', default: true },
                        { id: 'aplica_cotrans', label: 'Aplica COTRANS', default: true }
                    ].map(tax => (
                        <label key={tax.id} className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors select-none">
                            <input 
                                type="checkbox" 
                                name={tax.id} 
                                defaultChecked={editingCustomer ? (editingCustomer[tax.id] != null ? Boolean(editingCustomer[tax.id]) : tax.default) : tax.default} 
                                className="accent-indigo-600 rounded w-4 h-4 cursor-pointer" 
                            />
                            {tax.label}
                        </label>
                    ))}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-xs">
                        Cancelar
                    </button>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all text-xs shadow-md shadow-indigo-600/20 active:scale-95">
                        {editingCustomer ? 'Actualizar Cliente' : 'Registrar Cliente'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default PosCustomerModal;
