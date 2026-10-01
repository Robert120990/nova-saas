export default function PackagingColdChainSection({ packagingForm, setPackagingForm }) {
    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
                Cadena de Frío & Vida Útil
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                        Estado / Proceso Frío
                    </label>
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
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block mb-1.5">
                        Zona de Bodega Destino
                    </label>
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
    );
}
