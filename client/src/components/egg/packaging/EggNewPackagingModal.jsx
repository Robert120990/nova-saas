import { Plus, Boxes, Trash2, Lock, Scale, CheckCircle2, X } from 'lucide-react';

const EggNewPackagingModal = ({
    isOpen,
    onClose,
    packagingForm,
    setPackagingForm,
    batches = [],
    isSubmitting,
    onSubmit,
    onOpenCloseBatch,
    canClosePackaging
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 text-slate-900">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Plus className="h-5 w-5 text-purple-600" />
                            Registrar Empaque y Envasado de Producto
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">Genere la numeración de lote comercial e imprima la etiqueta QR de trazabilidad.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="h-px bg-slate-100" />

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Lote Pasteurizado Aprobado *</label>
                        <select
                            value={packagingForm.batch_id}
                            onChange={(e) => {
                                const bid = e.target.value;
                                const batch = batches.find(b => b.id === parseInt(bid));
                                const pType = (batch?.product_type || 'huevo entero').toLowerCase();
                                let defaultPres = 'cubeta 30LB';
                                let defaultW = '30.00';

                                if (batch?.presentation) {
                                    const firstPres = batch.presentation.split(',')[0].trim();
                                    if (firstPres.includes('32')) { defaultPres = 'cubeta 32LB'; defaultW = '32.00'; }
                                    else if (firstPres.toLowerCase().includes('galón') || firstPres.includes('8LB')) { defaultPres = 'galón 8LB'; defaultW = '8.00'; }
                                    else if (firstPres.includes('4LB') || firstPres.toLowerCase().includes('medio')) { defaultPres = 'medio galón 4LB'; defaultW = '4.00'; }
                                    else if (firstPres.includes('2LB') || firstPres.toLowerCase().includes('litro')) { defaultPres = 'litro 2LB'; defaultW = '2.00'; }
                                    else if (firstPres.includes('5LB') || firstPres.toLowerCase().includes('bolsa')) { defaultPres = 'bolsa 5LB'; defaultW = '5.00'; }
                                }

                                setPackagingForm({ 
                                    ...packagingForm, 
                                    batch_id: bid, 
                                    product_type: pType,
                                    items: [
                                        { presentation: defaultPres, units_packaged: '', weight_per_unit_lbs: defaultW }
                                    ]
                                });
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                            <option value="">Seleccione Lote Disponible...</option>
                            {batches.filter(b => {
                                const allowed = ['pasteurizado', 'aprobado_calidad', 'empaquetado', 'bloqueado_haccp'];
                                if (!allowed.includes(b.status)) return false;
                                if (b.packaging_status === 'cerrado' && b.id !== parseInt(packagingForm.batch_id)) return false;
                                const disp = parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0);
                                return disp > 0 || b.id === parseInt(packagingForm.batch_id);
                            }).map(b => {
                                const packaged = parseFloat(b.packaged_weight_lbs || 0);
                                const disp = Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - packaged);
                                const isPartial = packaged > 0 && disp > 0;
                                const labelPrefix = isPartial
                                    ? `⚠️ [PARCIAL: Faltan ${disp.toFixed(0)} Lbs]`
                                    : `🟢 [NUEVO: Disp ${disp.toFixed(0)} Lbs]`;
                                return (
                                    <option key={b.id} value={b.id} disabled={b.status === 'bloqueado_haccp'}>
                                         {labelPrefix} [{b.batch_code_display || b.batch_uuid}] {b.product_type} ({b.presentation}) - Env: {packaged.toFixed(0)} Lbs / Disp: {disp.toFixed(0)} Lbs{b.status === 'bloqueado_haccp' ? ' [BLOQUEADO HACCP]' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {packagingForm.batch_id && batches.find(b => b.id === parseInt(packagingForm.batch_id))?.status === 'bloqueado_haccp' && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 flex gap-2 font-bold text-xs">
                            <Lock size={16} className="shrink-0 text-rose-600" />
                            <span>Este lote tiene bloqueo de inocuidad activo. El envasado está inhabilitado hasta su evaluación de calidad.</span>
                        </div>
                    )}

                    {packagingForm.batch_id && (() => {
                        const b = batches.find(x => x.id === parseInt(packagingForm.batch_id));
                        if (b) {
                            const disp = Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0));
                            const currentProd = (packagingForm.items || []).reduce((acc, it) => acc + ((parseFloat(it.units_packaged) || 0) * (parseFloat(it.weight_per_unit_lbs) || 0)), 0);
                            const rem = Math.max(0, disp - currentProd);
                            return (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center text-xs">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Rendimiento</span>
                                            <strong className="text-teal-700 font-bold">{parseFloat(b.yield_liquid_lbs || 0).toLocaleString()} Lbs</strong>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Ya Envasado</span>
                                            <strong className="text-indigo-700 font-bold">{parseFloat(b.packaged_weight_lbs || 0).toLocaleString()} Lbs</strong>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Disp. Previa</span>
                                            <strong className="text-amber-700 font-bold">{disp.toLocaleString()} Lbs</strong>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Restante Tras Prod.</span>
                                            <strong className={`font-bold ${rem === 0 && currentProd > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                {rem.toLocaleString()} Lbs
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Banner y Botón de Cierre Técnico de Lote */}
                                    {b.packaging_status === 'cerrado' ? (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center justify-between">
                                            <span className="font-bold flex items-center gap-1.5">
                                                <CheckCircle2 size={16} className="text-emerald-600" />
                                                Lote Cerrado Técnicamente (Eficiencia: {b.packaging_efficiency_pct}%, Merma: {b.packaging_loss_lbs} Lbs)
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-3">
                                            <div>
                                                <span className="font-bold flex items-center gap-1.5 text-amber-800">
                                                    <Scale size={15} />
                                                    Balance de Envasado & Eficiencia
                                                </span>
                                                <p className="text-[11px] text-amber-700 mt-0.5">
                                                    {disp > 0
                                                        ? `Faltan ${disp.toLocaleString()} Lbs por envasar. Si ya finalizó la corrida, cierre el lote para computar mermas en tuberías.`
                                                        : `Lote completamente envasado (100% de rendimiento cubierto).`}
                                                </p>
                                            </div>
                                            {canClosePackaging && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenCloseBatch?.(b)}
                                                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0"
                                                >
                                                    <Lock size={13} />
                                                    Cerrar Envasado de Lote
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })()}

                    {/* Selección de Producto */}
                    <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                            Producto a Envasar *
                        </label>
                        <select
                            value={packagingForm.product_type}
                            onChange={(e) => setPackagingForm({ ...packagingForm, product_type: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                            <option value="huevo entero">Huevo Entero Pasteurizado</option>
                            <option value="huevo rapido">Huevo Entero Rápido</option>
                            <option value="clara">Clara de Huevo Pasteurizada</option>
                            <option value="clara ppg">Clara PPG Pasteurizada</option>
                            <option value="yema">Yema Líquida Pasteurizada</option>
                            <option value="yema azucarada">Yema Pasteurizada Azucarada</option>
                            <option value="yema salada">Yema Pasteurizada Salada</option>
                            <option value="fórmula especial">Fórmula Especial / Otros</option>
                        </select>
                    </div>

                    {/* PRESENTACIONES COMERCIALES Y UNIDADES (MULTI-PRESENTACIÓN) */}
                    <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                            <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Boxes className="w-4 h-4 text-purple-600" />
                                <span>Presentaciones Comerciales a Envasar</span>
                            </label>
                            <span className="text-[11px] text-slate-500 font-medium">
                                Puede empacar más de una presentación en este lote
                            </span>
                        </div>

                        {packagingForm.items.map((it, idx) => {
                            const itemTotal = ((parseFloat(it.units_packaged) || 0) * (parseFloat(it.weight_per_unit_lbs) || 0));
                            return (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-indigo-700 uppercase">
                                            Presentación #{idx + 1}
                                        </span>
                                        {packagingForm.items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = packagingForm.items.filter((_, i) => i !== idx);
                                                    setPackagingForm({ ...packagingForm, items: updated });
                                                }}
                                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                                                title="Eliminar esta presentación"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                        <div className="sm:col-span-5">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                Presentación Comercial *
                                            </label>
                                            <select
                                                value={it.presentation}
                                                onChange={(e) => {
                                                    const pres = e.target.value;
                                                    let defaultW = '30.00';
                                                    if (pres === 'cubeta 30LB') defaultW = '30.00';
                                                    else if (pres === 'cubeta 32LB') defaultW = '32.00';
                                                    else if (pres === 'galón 8LB') defaultW = '8.00';
                                                    else if (pres === 'medio galón 4LB') defaultW = '4.00';
                                                    else if (pres === 'litro 2LB') defaultW = '2.00';
                                                    else if (pres === 'bolsa 5LB') defaultW = '5.00';
                                                    else if (pres === 'tanque 2000LB') defaultW = '2000.00';
                                                    const updated = [...packagingForm.items];
                                                    updated[idx] = { ...it, presentation: pres, weight_per_unit_lbs: defaultW };
                                                    setPackagingForm({ ...packagingForm, items: updated });
                                                }}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            >
                                                <option value="cubeta 30LB">Cubeta 30 Lbs (Estándar)</option>
                                                <option value="cubeta 32LB">Cubeta 32 Lbs</option>
                                                <option value="galón 8LB">Galón (8 Lbs)</option>
                                                <option value="medio galón 4LB">Medio Galón (4 Lbs)</option>
                                                <option value="litro 2LB">Litro (2 Lbs)</option>
                                                <option value="bolsa 5LB">Bolsa (5 Lbs)</option>
                                                <option value="tanque 2000LB">Tanque / Tote (2,000 Lbs)</option>
                                                <option value="otra">Otra Presentación</option>
                                            </select>
                                        </div>

                                        <div className="sm:col-span-3">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                Unidades *
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={it.units_packaged}
                                                onChange={(e) => {
                                                    const updated = [...packagingForm.items];
                                                    updated[idx] = { ...it, units_packaged: e.target.value };
                                                    setPackagingForm({ ...packagingForm, items: updated });
                                                }}
                                                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-center"
                                                placeholder="Ej: 45"
                                                required
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                                                Peso/Ud (Lbs)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={it.weight_per_unit_lbs}
                                                onChange={(e) => {
                                                    const updated = [...packagingForm.items];
                                                    updated[idx] = { ...it, weight_per_unit_lbs: e.target.value };
                                                    setPackagingForm({ ...packagingForm, items: updated });
                                                }}
                                                className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-right"
                                                placeholder="30.00"
                                            />
                                        </div>

                                        <div className="sm:col-span-2 text-right">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Subtotal</span>
                                            <span className="text-xs font-bold text-teal-700">{itemTotal.toFixed(1)} Lbs</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => {
                                setPackagingForm({
                                    ...packagingForm,
                                    items: [
                                        ...packagingForm.items,
                                        { presentation: 'cubeta 30LB', units_packaged: '', weight_per_unit_lbs: '30.00' }
                                    ]
                                });
                            }}
                            className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all border border-purple-200 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                            <Plus size={13} />
                            + Agregar Otra Presentación Comercial
                        </button>
                    </div>

                    {/* Estado del Producto & Ubicación de Almacenamiento */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">Cadena de Frío & Vida Útil</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Estado / Proceso Frío</label>
                                <select
                                    value={packagingForm.product_state}
                                    onChange={(e) => {
                                        const state = e.target.value;
                                        const zone = state === 'congelado' ? 'BLAST' : 'COOLER';
                                        setPackagingForm({ ...packagingForm, product_state: state, warehouse_zone: zone });
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="líquido">Líquido Refrigerado (2-4°C) - Vida útil: 28 días</option>
                                    <option value="congelado">Congelado (-18°C) - Vida útil: 365 días (1 Año)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">Zona de Bodega Destino</label>
                                <select
                                    value={packagingForm.warehouse_zone}
                                    onChange={(e) => setPackagingForm({ ...packagingForm, warehouse_zone: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="COOLER">COOLER (Cámara de Refrigeración Líquido PT 2-4°C)</option>
                                    <option value="BLAST">BLAST (Túnel Congelación Ultra-rápida)</option>
                                    <option value="HOLDING">HOLDING (Cámara de Almacenamiento Congelados -18°C)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Resumen Total */}
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between text-xs">
                        <span className="font-bold text-teal-800 uppercase">Total Producción a Envasar:</span>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-600 font-medium">
                                Unidades: <strong className="text-slate-900 font-bold">{(packagingForm.items || []).reduce((acc, it) => acc + (parseInt(it.units_packaged) || 0), 0)} Uds</strong>
                            </span>
                            <span className="text-teal-900 font-black text-sm">
                                {(packagingForm.items || []).reduce((acc, it) => acc + ((parseFloat(it.units_packaged) || 0) * (parseFloat(it.weight_per_unit_lbs) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Lbs
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || (packagingForm.batch_id && batches.find(b => b.id === parseInt(packagingForm.batch_id))?.status === 'bloqueado_haccp')}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-40"
                        >
                            {isSubmitting ? 'Guardando...' : 'Confirmar & Generar Lote'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EggNewPackagingModal;
