

import {
    RefreshCw,
    CheckCircle2,
    Sparkles,
    Barcode,
    Search,
    Package,
    Filter,
    X,
    AlertCircle,
    Lock
} from 'lucide-react';


export default function ConfigIsProductCatalogModalOpenModal({ model, open = model.isProductCatalogModalOpen, onClose = () => {
                                        model.setIsProductCatalogModalOpen(false);
                                        model.setTargetCodeIndex(null);
                                    } }) {
    const { systemProducts, isMappingModalOpen, mappingForm, isProductCatalogModalOpen, setIsProductCatalogModalOpen, catalogSearchQuery, setCatalogSearchQuery, catalogFilterType, setCatalogFilterType, targetCodeIndex, setTargetCodeIndex, isFetchingProducts, fetchSystemProducts, isProductMapped, getProductMappingInfo, isProductInCurrentForm, handleSelectProductCode } = model;
    if (!open) return null;
    return (<>{isProductCatalogModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col text-slate-900 space-y-4">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                                    <Package size={22} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900">
                                            Catálogo de Productos y Códigos del Sistema
                                        </h3>
                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-bold">
                                            {systemProducts.length} productos
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {targetCodeIndex !== null
                                            ? `Selecciona un código para asignarlo al renglón #${targetCodeIndex + 1}`
                                            : 'Busca y selecciona códigos actuales (SKU / Código de Barra) para vincularlos al módulo industrial'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={fetchSystemProducts}
                                    disabled={isFetchingProducts}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-colors disabled:opacity-50"
                                    title="Recargar productos desde la base de datos"
                                >
                                    <RefreshCw size={13} className={isFetchingProducts ? 'animate-spin text-indigo-600' : ''} />
                                    <span>{isFetchingProducts ? 'Actualizando...' : 'Refrescar'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                    aria-label="Cerrar modal"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Search & Filters */}
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar por código SKU, código de barra, nombre del producto o categoría..."
                                    value={catalogSearchQuery}
                                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
                                />
                                {catalogSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setCatalogSearchQuery('')}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Filtros rápidos por chips */}
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mr-1">
                                    <Filter size={12} /> Filtrar:
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('all')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'all'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    Todos ({systemProducts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('egg')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'egg'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    🥚 Huevo / Ovoproductos ({systemProducts.filter(p => {
                                        const t = `${p.nombre || ''} ${p.descripcion || ''} ${p.category_name || ''} ${p.codigo || ''}`.toLowerCase();
                                        return t.includes('huevo') || t.includes('clara') || t.includes('yema') || t.includes('ovoproducto') || t.includes('pasteuriz');
                                    }).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('unmapped')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'unmapped'
                                        ? 'bg-amber-600 text-white shadow-2xs'
                                        : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                                        }`}
                                >
                                    ⚠️ Sin Vincular ({systemProducts.filter(p => !isProductMapped(p, mappingForm.id)).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCatalogFilterType('mapped')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${catalogFilterType === 'mapped'
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                >
                                    ✅ Ya Vinculados ({systemProducts.filter(p => isProductMapped(p, mappingForm.id)).length})
                                </button>
                            </div>
                        </div>

                        {/* Listado de Productos */}
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl max-h-[55vh] divide-y divide-slate-100">
                            {(() => {
                                const filtered = systemProducts.filter(p => {
                                    // Filtro por tipo
                                    if (catalogFilterType === 'egg') {
                                        const t = `${p.nombre || ''} ${p.descripcion || ''} ${p.category_name || ''} ${p.codigo || ''}`.toLowerCase();
                                        if (!t.includes('huevo') && !t.includes('clara') && !t.includes('yema') && !t.includes('ovoproducto') && !t.includes('pasteuriz')) {
                                            return false;
                                        }
                                    } else if (catalogFilterType === 'unmapped' && isProductMapped(p, mappingForm.id)) {
                                        return false;
                                    } else if (catalogFilterType === 'mapped' && !isProductMapped(p, mappingForm.id)) {
                                        return false;
                                    }

                                    // Filtro por búsqueda de texto
                                    if (!catalogSearchQuery.trim()) return true;
                                    const q = catalogSearchQuery.toLowerCase();
                                    return (
                                        (p.nombre || '').toLowerCase().includes(q) ||
                                        (p.codigo || '').toLowerCase().includes(q) ||
                                        (p.codigo_barra || '').toLowerCase().includes(q) ||
                                        (p.category_name || '').toLowerCase().includes(q) ||
                                        (p.descripcion || '').toLowerCase().includes(q)
                                    );
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <div className="p-8 text-center space-y-2">
                                            <Package className="h-10 w-10 text-slate-300 mx-auto" />
                                            <p className="text-xs font-bold text-slate-600">No se encontraron productos coincidentes.</p>
                                            <p className="text-[11px] text-slate-400">Intenta buscar por otro término o limpia los filtros.</p>
                                        </div>
                                    );
                                }

                                return (Array.isArray(filtered) ? filtered : []).map(prod => {
                                    const mappingInfo = getProductMappingInfo(prod, mappingForm.id);
                                    const alreadyMapped = Boolean(mappingInfo);
                                    const alreadyInForm = isProductInCurrentForm(prod, targetCodeIndex);
                                    const isBlocked = alreadyMapped || alreadyInForm;
                                    const hasSku = Boolean(prod.codigo?.trim());
                                    const hasBarcode = Boolean(prod.codigo_barra?.trim() && prod.codigo_barra !== prod.codigo);

                                    return (
                                        <div
                                            key={prod.id}
                                            className={`p-3 sm:p-3.5 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                                                isBlocked ? 'bg-slate-50/60 opacity-80' : 'hover:bg-slate-50/90'
                                            }`}
                                        >
                                            {/* Datos del producto */}
                                            <div className="space-y-1 flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                                                        {prod.nombre || prod.name}
                                                    </span>
                                                    {prod.category_name && (
                                                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            {prod.category_name}
                                                        </span>
                                                    )}
                                                    {prod.unidad_medida && (
                                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase">
                                                            {prod.unidad_medida}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Códigos disponibles */}
                                                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                                    {hasSku && (
                                                        <button
                                                            type="button"
                                                            onClick={() => !isBlocked && handleSelectProductCode(prod, 'sku')}
                                                            disabled={isBlocked}
                                                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                                                isBlocked
                                                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                                                    : 'text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200'
                                                            }`}
                                                            title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : 'Click para usar este código SKU'}
                                                        >
                                                            <Barcode size={12} />
                                                            <span>SKU: {prod.codigo}</span>
                                                        </button>
                                                    )}

                                                    {hasBarcode && (
                                                        <button
                                                            type="button"
                                                            onClick={() => !isBlocked && handleSelectProductCode(prod, 'barcode')}
                                                            disabled={isBlocked}
                                                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                                                isBlocked
                                                                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                                                    : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'
                                                            }`}
                                                            title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : 'Click para usar este código de barra'}
                                                        >
                                                            <Barcode size={12} />
                                                            <span>Barra: {prod.codigo_barra}</span>
                                                        </button>
                                                    )}

                                                    {!hasSku && !hasBarcode && (
                                                        <span className="text-[10px] text-amber-600 font-bold italic flex items-center gap-1">
                                                            <AlertCircle size={11} /> Sin código SKU ni Barra
                                                        </span>
                                                    )}

                                                    {/* Estado de vinculación */}
                                                    {alreadyMapped ? (
                                                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1" title={`Bloqueado: Ya vinculado a "${mappingInfo.product_name || mappingInfo.product_type}"`}>
                                                            <Lock size={11} className="text-amber-600 shrink-0" />
                                                            <span>Ya Vinculado: {mappingInfo.product_name || mappingInfo.product_type} ({mappingInfo.presentation})</span>
                                                        </span>
                                                    ) : alreadyInForm ? (
                                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1" title="Ya está agregado en este formulario">
                                                            <CheckCircle2 size={11} className="text-indigo-600 shrink-0" />
                                                            <span>Ya en este formulario</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                                            <Sparkles size={11} className="text-emerald-500 shrink-0" />
                                                            <span>Disponible para vincular</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Botones de acción rápida */}
                                            <div className="flex items-center gap-1.5 shrink-0 w-full md:w-auto justify-end">
                                                {hasSku && hasBarcode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => !isBlocked && handleSelectProductCode(prod, 'both')}
                                                        disabled={isBlocked}
                                                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                                                            isBlocked
                                                                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                                                        }`}
                                                        title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : 'Insertar ambos códigos (SKU + Barra)'}
                                                    >
                                                        + Ambos Códigos
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => !isBlocked && handleSelectProductCode(prod, hasSku ? 'sku' : 'barcode')}
                                                    disabled={isBlocked}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 ${
                                                        isBlocked
                                                            ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400'
                                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                    }`}
                                                    title={isBlocked ? (alreadyMapped ? `Ya vinculado a "${mappingInfo?.product_name || mappingInfo?.product_type}"` : 'Ya agregado en este formulario') : (isMappingModalOpen ? 'Usar en Formulario' : 'Crear Vinculación')}
                                                >
                                                    {isBlocked ? <Lock size={12} /> : <Sparkles size={12} />}
                                                    <span>
                                                        {isBlocked
                                                            ? (alreadyMapped ? 'Ya Vinculado' : 'Ya en Formulario')
                                                            : (isMappingModalOpen ? 'Usar en Formulario' : 'Crear Vinculación')}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                            <span className="font-medium">
                                Haz clic en cualquier código SKU o en <strong>Usar en Formulario</strong> para insertarlo instantáneamente.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsProductCatalogModalOpen(false);
                                    setTargetCodeIndex(null);
                                }}
                                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}</>);
}
